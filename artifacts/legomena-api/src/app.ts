import cors from "cors";
import express, { type Express } from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { pinoHttp } from "pino-http";
import { logger } from "./logger";
import { router } from "./routes";
import { rateLimit, rateLimitMaxFromEnv, securityHeaders } from "./security";

export const BASE_PATH = "/legomena/api";

export function createApp(): Express {
  const app = express();
  // Behind exactly one reverse proxy (the IONOS front end, or the
  // workspace preview proxy in development), so req.ip reflects the real
  // client for rate limiting.
  app.set("trust proxy", 1);
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req: (req: { method: string; url: string }) => ({
          method: req.method,
          url: req.url,
        }),
        res: (res: { statusCode: number }) => ({
          statusCode: res.statusCode,
        }),
      },
    }),
  );
  app.use(cors());
  app.use(securityHeaders());
  app.use(express.json({ limit: "1mb" }));

  // Rate limits: a generous per-IP cap on the whole API, plus a strict
  // cap on the expensive /ask endpoint (retrieval work per request).
  // Separate buckets; overridable via env (0 disables).
  const RATE_WINDOW_MS = 60_000;
  app.use(
    BASE_PATH,
    rateLimit({
      windowMs: RATE_WINDOW_MS,
      max: rateLimitMaxFromEnv("RATE_LIMIT_API_MAX", 600),
      name: "api",
    }),
  );
  app.use(
    `${BASE_PATH}/ask`,
    rateLimit({
      windowMs: RATE_WINDOW_MS,
      max: rateLimitMaxFromEnv("RATE_LIMIT_RAG_MAX", 30),
      name: "ask",
    }),
  );
  // POST /sparql evaluates arbitrary read queries against the in-memory
  // store — compute-heavy per request, so it gets its own strict bucket
  // too. Registered with app.post on the exact path (not app.use, whose
  // prefix match would also throttle the cheap GET /sparql/examples).
  app.post(
    `${BASE_PATH}/sparql`,
    rateLimit({
      windowMs: RATE_WINDOW_MS,
      max: rateLimitMaxFromEnv("RATE_LIMIT_RAG_MAX", 30),
      name: "sparql",
    }),
  );
  app.use(BASE_PATH, router);

  // Optional: serve the built frontend (Vite base /legomena/) from a
  // directory — single-server deployment, e.g. the IONOS bundle. Set
  // SERVE_STATIC_DIR to the frontend build output.
  const staticDir = process.env["SERVE_STATIC_DIR"];
  if (staticDir) {
    const resolved = path.resolve(staticDir);
    if (!existsSync(resolved)) {
      throw new Error(`SERVE_STATIC_DIR does not exist: ${resolved}`);
    }
    app.use("/legomena", express.static(resolved));
    // SPA fallback: any non-API GET under /legomena serves the app's
    // index.html (client-side routing handles the rest). Note: sendFile
    // refuses dotfiles by default — the Vite build emits none, keep it so.
    app.use("/legomena", (req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile("index.html", { root: resolved });
    });
    logger.info({ staticDir: resolved }, "Serving static frontend");
  }

  // The artifact proxy probes the service root for liveness; answer it
  // instead of 404ing (the API itself lives under BASE_PATH).
  app.get("/", (_req, res) => {
    res.json({ service: "legomena-api", api: BASE_PATH });
  });
  return app;
}
