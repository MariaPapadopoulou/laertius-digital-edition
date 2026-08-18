import path from "node:path";
import { existsSync } from "node:fs";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import dtsRouter from "./routes/dts";
import { logger } from "./lib/logger";
import {
  inlineScriptHashes,
  rateLimit,
  rateLimitMaxFromEnv,
  securityHeaders,
} from "./lib/security";
import { sitemapXml } from "./lib/sitemap";
import { evalAuth } from "./lib/eval-auth";

const app: Express = express();

// Behind exactly one reverse proxy (the IONOS front end, or the workspace
// preview proxy in development), so req.ip reflects the real client for
// rate limiting.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        // Visitor IP: req.raw is the Express request, whose .ip honours
        // "trust proxy" and so reflects the real client behind the IONOS
        // front end; fall back to the socket address on direct connections.
        const raw = req.raw as { ip?: string } | undefined;
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
          ip: raw?.ip ?? req.remoteAddress,
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Open CORS is deliberate for the public data surfaces (LOD, SPARQL, DTS,
// read-only API): they are meant to be consumed from anywhere. The
// authenticated evaluation workbench is excluded — it must not advertise
// Access-Control-Allow-Origin: * on credentialed endpoints.
const openCors = cors();
app.use((req, res, next) => {
  if (req.path === "/eval" || req.path.startsWith("/eval/") ||
      req.path === "/api/eval" || req.path.startsWith("/api/eval/")) {
    next();
    return;
  }
  openCors(req, res, next);
});

// Security headers (CSP, HSTS, nosniff, referrer policy). The CSP's
// script-src carries the hashes of the inline scripts in the built
// index.html (the theme-bootstrap snippet); img-src additionally allows
// the OpenStreetMap tile server the Map page draws its basemap from.
const staticDirEnv = process.env["SERVE_STATIC_DIR"];
const cspScriptHashes = staticDirEnv
  ? inlineScriptHashes(path.join(path.resolve(staticDirEnv), "index.html"))
  : [];
// The eval workbench (public/eval/) is a separate built SPA with its own
// inline-script hashes; fold them into the shared CSP when it ships in the
// bundle so its pages pass the same policy as the main app.
if (staticDirEnv) {
  const evalIndexHtml = path.join(
    path.resolve(staticDirEnv),
    "eval",
    "index.html",
  );
  if (existsSync(evalIndexHtml)) {
    for (const hash of inlineScriptHashes(evalIndexHtml)) {
      if (!cspScriptHashes.includes(hash)) cspScriptHashes.push(hash);
    }
  }
}
app.use(
  securityHeaders({
    scriptSrcExtra: cspScriptHashes,
    imgSrcExtra: ["https://tile.openstreetmap.org"],
  }),
);

// 2 MB: eval topic sets, run files and judgment JSONL uploads exceed the
// express default of 100 kB.
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Basic-auth gate for the evaluation workbench: its API (/api/eval*) and its
// static frontend (/eval*, served below). A no-op when EVAL_ACCESS_PASSWORD
// is unset (dev workspace stays open); otherwise every request whose
// CANONICAL path targets the eval workbench needs HTTP Basic credentials.
//
// This is deliberately a GLOBAL middleware, not app.use("/eval", …): a
// path-mounted gate only matches Express's own normalized mount path, while
// express.static resolves files from the raw URL, so //eval/assets/x,
// /eval%2Fassets%2Fx and /eval/../eval/ would reach the static file without
// ever matching a "/eval" mount — an auth bypass. The middleware decodes and
// canonicalizes the raw request target itself and gates on the result, so
// encoded-slash / traversal variants are caught. It runs BEFORE the rate
// limits, the /api router and express.static so nothing eval-related can be
// served ahead of the check, and nothing else on the site is affected.
app.use(evalAuth());

// Rate limits: a generous per-IP cap on the whole API, plus a strict cap
// on the expensive RAG endpoints (/api/ask, /api/search — embedding +
// retrieval work per request). Separate buckets so hammering Ask cannot
// starve ordinary page-data requests and vice versa. Overridable via env
// (0 disables), so operators can tune without a rebuild.
const RATE_WINDOW_MS = 60_000;
app.use(
  "/api",
  rateLimit({
    windowMs: RATE_WINDOW_MS,
    max: rateLimitMaxFromEnv("RATE_LIMIT_API_MAX", 1200),
    name: "api",
  }),
);
const ragMax = rateLimitMaxFromEnv("RATE_LIMIT_RAG_MAX", 30);
app.use(
  "/api/ask",
  rateLimit({ windowMs: RATE_WINDOW_MS, max: ragMax, name: "ask" }),
);
app.use(
  "/api/search",
  rateLimit({ windowMs: RATE_WINDOW_MS, max: ragMax, name: "search" }),
);
// The public SPARQL endpoint evaluates arbitrary read queries against the
// in-memory graph store — compute-heavy per request, so it gets its own
// strict bucket too.
app.use(
  "/api/lod/sparql",
  rateLimit({ windowMs: RATE_WINDOW_MS, max: ragMax, name: "sparql" }),
);

app.use("/api", router);

// Distributed Text Services (DTS) 1.0 read-only API. Mounted directly on
// the app (outside the /api router and its OpenAPI/Zod machinery, like the
// LOD and sitemap endpoints) so it answers at /dts both in development and
// on the live host (BASE_PATH=/). Registered BEFORE the static/SPA
// fallback so /dts* never falls through to index.html. GET is public from
// anywhere via the app-wide cors() middleware above.
app.use(dtsRouter);

// Conventional VoID discovery location (https://www.w3.org/TR/void/#discovery):
// harvesters probe /.well-known/void first. Redirect to the actual document.
app.get("/.well-known/void", (_req, res) => {
  res.redirect(302, "/api/lod/void.ttl");
});

// robots.txt advertises <LOD_BASE>/sitemap.xml; serve it here so the request
// does not fall through to the SPA fallback (which would return index.html
// instead of XML). Registered BEFORE the static/SPA middleware below. On the
// live IONOS deployment the front end strips the /Laertius prefix, so the
// path arrives here as /sitemap.xml.
app.get("/sitemap.xml", (_req, res) => {
  res.type("application/xml").send(sitemapXml());
});

// Optional: serve the built frontend from a directory (single-server
// deployment, e.g. on IONOS). Set SERVE_STATIC_DIR to the frontend build.
const staticDir = process.env["SERVE_STATIC_DIR"];
if (staticDir) {
  const resolved = path.resolve(staticDir);
  if (!existsSync(resolved)) {
    throw new Error(`SERVE_STATIC_DIR does not exist: ${resolved}`);
  }
  app.use(express.static(resolved));
  // SPA fallback: any non-API GET serves the app's index.html. The former
  // standalone Ontoterminology app is merged into the main app under
  // /terminology; old /ontoterminology links redirect permanently. Path
  // suffixes map one to one (e.g. /ontoterminology/objects/x ->
  // /terminology/objects/x) except the old /about page, whose content is
  // now the Overview at /terminology itself.
  app.use((req, res, next) => {
    if (
      req.method !== "GET" ||
      req.path === "/api" ||
      req.path.startsWith("/api/")
    ) {
      next();
      return;
    }
    if (
      req.path === "/ontoterminology" ||
      req.path.startsWith("/ontoterminology/")
    ) {
      let rest = req.originalUrl.slice("/ontoterminology".length);
      if (rest === "/about" || rest.startsWith("/about?")) {
        // The old app's /about page (formerly /terminology/model) is now
        // the Overview at /terminology itself.
        rest = rest.slice("/about".length);
      }
      res.redirect(301, `/terminology${rest === "/" ? "" : rest}`);
      return;
    }
    // Eval workbench SPA fallback: any /eval or /eval/* GET that is not a
    // real file (real assets under /eval/assets/... are already served by
    // express.static above) serves the eval app's index.html. This branch
    // must precede the main app's index.html fallback below so eval deep
    // links do not fall through to the laertius SPA.
    if (req.path === "/eval" || req.path.startsWith("/eval/")) {
      res.sendFile("eval/index.html", { root: resolved });
      return;
    }
    res.sendFile("index.html", { root: resolved });
  });
  logger.info({ staticDir: resolved }, "Serving static frontend");
}

export default app;
