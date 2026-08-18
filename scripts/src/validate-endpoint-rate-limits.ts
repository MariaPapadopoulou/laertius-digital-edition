/**
 * Catch a new expensive endpoint shipping without its own strict rate
 * limit.
 *
 * The two APIs carry per-IP rate limits: a generous cap on the whole API
 * plus strict buckets (default 30/min, RATE_LIMIT_RAG_MAX) on the
 * compute-heavy endpoints (embedding/retrieval Ask & Search, the SPARQL
 * query endpoints). Nothing structural forces a FUTURE compute-heavy
 * route to get a strict bucket — it would silently ride the generous
 * general cap and be abusable.
 *
 * This validator:
 *  1. Enumerates every route registered in
 *     artifacts/api-server/src/routes/*.ts (all mounted flat under /api)
 *     and artifacts/legomena-api/src/routes.ts (mounted under
 *     /legomena/api).
 *  2. Requires every enumerated route to be pinned below as either
 *     EXPENSIVE (must sit under a strict limiter mount) or CHEAP.
 *     An unpinned route fails with instructions.
 *  3. Parses the strict limiter mounts out of the two app.ts files
 *     (mounts whose max comes from RATE_LIMIT_RAG_MAX / a literal
 *     <= STRICT_MAX_CEILING) and checks that every EXPENSIVE route is
 *     covered by one, and every strict mount covers at least one
 *     EXPENSIVE route (no stale mounts).
 *  4. Heuristic backstop: a non-GET route whose source file does
 *     retrieval/embedding/SPARQL work (imports retrieve/embedQuery/
 *     denseRank/executeSparql, or calls store.query) may NOT be pinned
 *     CHEAP — so a new expensive POST route cannot be waved through by
 *     just adding it to the cheap list.
 *  5. Positive controls: both apps must keep their generous general
 *     limiter, and the expensive set must be non-empty per app.
 *
 * To ship a new expensive endpoint: mount a strict rateLimit() for it in
 * the app.ts, then add it to EXPENSIVE below. To ship a cheap one: add it
 * to CHEAP below.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-endpoint-rate-limits
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const API_SERVER_ROUTES_DIR = path.join(
  ROOT,
  "artifacts/api-server/src/routes",
);
const API_SERVER_APP = path.join(ROOT, "artifacts/api-server/src/app.ts");
const LEGOMENA_ROUTES = path.join(
  ROOT,
  "artifacts/legomena-api/src/routes.ts",
);
const LEGOMENA_APP = path.join(ROOT, "artifacts/legomena-api/src/app.ts");

// A limiter literal max at or below this is "strict"; the generous
// general caps (1200 / 600) sit far above it.
const STRICT_MAX_CEILING = 60;

// ---------------------------------------------------------------------------
// THE PIN. Keys are "METHOD <full path>" ("ALL" for router.all).
// ---------------------------------------------------------------------------

const EXPENSIVE = new Set<string>([
  // api-server: embedding + hybrid retrieval per request.
  "POST /api/ask",
  "POST /api/search",
  // api-server: arbitrary read SPARQL over the in-memory graph store.
  "ALL /api/lod/sparql",
  // legomena: hybrid retrieval (BM25 + dense embeddings) per request.
  "POST /legomena/api/ask",
  // legomena: arbitrary read SPARQL over the in-memory store.
  "POST /legomena/api/sparql",
]);

const CHEAP = new Set<string>([
  // api-server (all GET, precomputed/in-memory lookups and static-ish
  // serialized exports).
  "GET /api/healthz",
  "GET /api/anecdotes",
  "GET /api/sections",
  "GET /api/sections/:id",
  "GET /api/sections/:id/annotations",
  "GET /api/annotations/entities",
  "GET /api/annotations/sections",
  "GET /api/competency/questions",
  "GET /api/competency/questions/:id",
  "GET /api/corpus/stats",
  "GET /api/philosophers",
  "GET /api/doxai",
  "GET /api/epistles",
  "GET /api/graph",
  "GET /api/claims/:philosopher",
  "GET /api/map/places",
  "GET /api/map/itineraries",
  "GET /api/exports/laertius-ionos.zip",
  "GET /api/exports/laertius-full-source.zip",
  "GET /api/lod/graph.jsonld",
  "GET /api/lod/graph.ttl",
  "GET /api/lod/graph.rdf",
  "GET /api/lod/graph-annotated.jsonld",
  "GET /api/lod/graph-annotated.ttl",
  "GET /api/lod/graph-annotated.rdf",
  "GET /api/lod/section/:id.jsonld",
  "GET /api/lod/section/:id.rdf",
  "GET /api/lod/ontology.html",
  "GET /api/lod/ontology.jsonld",
  "GET /api/lod/ontology.ttl",
  "GET /api/lod/ontology.rdf",
  "GET /api/lod/shapes.ttl",
  "GET /api/lod/void.ttl",
  "GET /api/lod/dcat.ttl",
  // eval harness (in-memory/file-backed CRUD over topic sets, snapshots,
  // runs, pools, judgments — no retrieval/embedding/SPARQL per request).
  "GET /api/eval/overview",
  "GET /api/eval/snapshots",
  "POST /api/eval/snapshots",
  "GET /api/eval/snapshots/:id",
  "GET /api/eval/snapshots/:id/corpus.jsonl",
  "GET /api/eval/topic-sets",
  "POST /api/eval/topic-sets",
  "GET /api/eval/topic-sets/:id",
  "GET /api/eval/runs",
  "POST /api/eval/runs",
  "GET /api/eval/pools",
  "POST /api/eval/pools",
  "GET /api/eval/pools/:id",
  "GET /api/eval/pools/:id/coverage",
  "GET /api/eval/pools/:id/batches",
  "POST /api/eval/pools/:id/batches",
  // Judge-facing token-scoped batch listing: same file-backed reads.
  "GET /api/eval/judge/batches",
  "GET /api/eval/batches/:id",
  // In-memory batch state flip, no retrieval/embedding work.
  "POST /api/eval/batches/:id/revoke",
  "GET /api/eval/judgments",
  "POST /api/eval/judgments",
  "GET /api/eval/pools/:id/agreement",
  "GET /api/eval/pools/:id/disagreements",
  "POST /api/eval/adjudications",
  "GET /api/eval/pools/:id/qrels",
  // DTS read-only API: precomputed in-memory corpus lookups.
  "GET /api/dts",
  "GET /api/dts/collection",
  "GET /api/dts/navigation",
  "GET /api/dts/document",
  "GET /api/otb/overview",
  "GET /api/otb/concepts",
  "GET /api/otb/objects",
  "GET /api/otb/objects/:id",
  "GET /api/otb/names",
  "GET /api/otb/dictionary.html",
  "GET /api/otb/dictionary.en.html",
  "GET /api/otb/dictionary.grc.html",
  // Registered in a loop with a template literal; pinned verbatim.
  "GET /api/otb/proper-names.${pnLang}.html",
  "GET /api/otb/proper-names.html",
  "GET /api/otb/viewer.html",
  "GET /api/otb/ontoterminology.rdf",
  "GET /api/sayings",
  "GET /api/stats/detailed",
  "GET /api/testaments",
  "GET /api/timeline",
  "GET /api/verses",
  // legomena (all GET, precomputed/in-memory lookups).
  "GET /legomena/api/healthz",
  "GET /legomena/api/dataset/stats",
  "GET /legomena/api/graph",
  "GET /legomena/api/entities",
  "GET /legomena/api/entity",
  "GET /legomena/api/sections",
  "GET /legomena/api/sections/:id",
  "GET /legomena/api/sparql/examples",
]);

// Source files doing retrieval/embedding/SPARQL-evaluation work: any
// non-GET route defined in a file matching one of these markers must be
// pinned EXPENSIVE.
const EXPENSIVE_WORK_MARKERS: RegExp[] = [
  /\bretrieve\s*\(/,
  /\bembedQuery\s*\(/,
  /\bdenseRank\s*\(/,
  /\bexecuteSparql\s*\(/,
  /\bcomposeExtractiveAnswer\s*\(/,
  /\.query\s*\(\s*query\b/, // oxigraph store.query(query, ...)
  /\bask\s*\(\s*model\b/, // legomena ask(model, question, ...)
];

// ---------------------------------------------------------------------------
// Route enumeration
// ---------------------------------------------------------------------------

interface RouteRec {
  key: string; // "METHOD /full/path"
  file: string; // workspace-relative source file
  expensiveWork: boolean; // file does retrieval/embedding/SPARQL work
}

const ROUTE_RE =
  /\brouter\.(get|post|put|patch|delete|all)\(\s*(["'`])([^"'`]+)\2/g;

function routesInFile(
  absFile: string,
  mountPrefix: string,
  routes: RouteRec[],
): void {
  const src = readFileSync(absFile, "utf8");
  const expensiveWork = EXPENSIVE_WORK_MARKERS.some((re) => re.test(src));
  const rel = path.relative(ROOT, absFile);
  let m: RegExpExecArray | null;
  ROUTE_RE.lastIndex = 0;
  while ((m = ROUTE_RE.exec(src)) !== null) {
    const method = m[1].toUpperCase();
    const routePath = m[3];
    routes.push({
      key: `${method} ${mountPrefix}${routePath}`,
      file: rel,
      expensiveWork,
    });
  }
}

// ---------------------------------------------------------------------------
// Strict-limiter mount extraction from app.ts
// ---------------------------------------------------------------------------

interface StrictMount {
  method: string; // "USE" (any method) or a specific verb for app.post etc.
  prefix: string; // full path prefix the limiter covers
}

function extractLimiterMounts(
  appSrc: string,
  basePathValue: string | null,
): { strict: StrictMount[]; generalMountCount: number } {
  const strict: StrictMount[] = [];
  let generalMountCount = 0;
  // Match: app.use("/path", rateLimit({ ... })) or app.post(`${BASE_PATH}/x`,
  // rateLimit({ ... })) — non-greedy body up to the closing "}))".
  // Mount path is either a quoted string / template literal, or the bare
  // BASE_PATH identifier (legomena's general limiter).
  const mountRe =
    /\bapp\.(use|get|post|put|patch|delete|all)\(\s*(?:(["'`])([^"'`]+)\2|(BASE_PATH))\s*,\s*rateLimit\(\s*\{([\s\S]*?)\}\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = mountRe.exec(appSrc)) !== null) {
    const method = m[1] === "use" ? "USE" : m[1].toUpperCase();
    let mountPath = m[4] !== undefined ? "${BASE_PATH}" : m[3];
    if (basePathValue !== null) {
      mountPath = mountPath.replace(/\$\{BASE_PATH\}/g, basePathValue);
    }
    if (mountPath.includes("${")) {
      throw new Error(
        `Unresolvable template in limiter mount path: ${m[3]} — teach validate-endpoint-rate-limits about it.`,
      );
    }
    const body = m[5];
    const envMatch = body.match(
      /rateLimitMaxFromEnv\(\s*["']([A-Z0-9_]+)["']\s*,\s*(\d+)/,
    );
    const litMatch = body.match(/\bmax\s*:\s*(\d+)/);
    const identMatch = body.match(/\bmax\s*:\s*([A-Za-z_$][\w$]*)\s*[,}]/);
    let strictBucket: boolean;
    if (envMatch) {
      strictBucket = Number(envMatch[2]) <= STRICT_MAX_CEILING;
    } else if (litMatch) {
      strictBucket = Number(litMatch[1]) <= STRICT_MAX_CEILING;
    } else if (identMatch) {
      // Resolve a `max: someConst` identifier defined from
      // rateLimitMaxFromEnv elsewhere in the file (e.g. ragMax).
      const def = appSrc.match(
        new RegExp(
          `\\b${identMatch[1]}\\s*=\\s*rateLimitMaxFromEnv\\(\\s*["'][A-Z0-9_]+["']\\s*,\\s*(\\d+)`,
        ),
      );
      if (!def) {
        throw new Error(
          `Cannot resolve limiter max identifier "${identMatch[1]}" — teach validate-endpoint-rate-limits about it.`,
        );
      }
      strictBucket = Number(def[1]) <= STRICT_MAX_CEILING;
    } else {
      throw new Error(
        `Cannot determine max for limiter mounted at ${mountPath} — teach validate-endpoint-rate-limits about it.`,
      );
    }
    if (strictBucket) {
      strict.push({ method, prefix: mountPath });
    } else {
      generalMountCount += 1;
    }
  }
  return { strict, generalMountCount };
}

/** Express-style path-segment prefix match. */
function coversPath(prefix: string, routePath: string): boolean {
  if (routePath === prefix) return true;
  return routePath.startsWith(`${prefix}/`);
}

function covers(mount: StrictMount, routeKey: string): boolean {
  const sp = routeKey.indexOf(" ");
  const method = routeKey.slice(0, sp);
  const routePath = routeKey.slice(sp + 1);
  if (mount.method === "USE") return coversPath(mount.prefix, routePath);
  // Method-specific mounts (app.post) only cover same-method routes;
  // router.all routes are NOT fully covered by a single-method mount.
  if (method !== mount.method) return false;
  return coversPath(mount.prefix, routePath);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let failures = 0;
function fail(msg: string): void {
  failures += 1;
  console.error(`FAIL: ${msg}`);
}

const routes: RouteRec[] = [];
const routeFiles = readdirSync(API_SERVER_ROUTES_DIR)
  .filter((f) => f.endsWith(".ts") && f !== "index.ts")
  .sort();
for (const f of routeFiles) {
  routesInFile(path.join(API_SERVER_ROUTES_DIR, f), "/api", routes);
}
routesInFile(LEGOMENA_ROUTES, "/legomena/api", routes);

// Positive controls: the enumeration itself must keep finding routes.
const apiCount = routes.filter((r) => r.key.includes(" /api/")).length;
const legCount = routes.filter((r) =>
  r.key.includes(" /legomena/api/"),
).length;
if (apiCount < 10) {
  fail(
    `Only ${apiCount} api-server routes enumerated — the route regex or directory layout drifted.`,
  );
}
if (legCount < 5) {
  fail(
    `Only ${legCount} legomena routes enumerated — the route regex or file layout drifted.`,
  );
}

// 1. Every route pinned exactly once; heuristic backstop for cheap pins.
const seenKeys = new Set<string>();
for (const r of routes) {
  seenKeys.add(r.key);
  const inExpensive = EXPENSIVE.has(r.key);
  const inCheap = CHEAP.has(r.key);
  if (inExpensive && inCheap) {
    fail(`Route pinned as BOTH expensive and cheap: ${r.key}`);
  } else if (!inExpensive && !inCheap) {
    fail(
      `Unclassified route ${r.key} (${r.file}). Pin it in scripts/src/validate-endpoint-rate-limits.ts: add to EXPENSIVE (and mount a strict rateLimit() for it in the app.ts) if it does retrieval/embedding/SPARQL or other compute-heavy work per request, otherwise add to CHEAP.`,
    );
  } else if (inCheap && r.key.split(" ")[0] !== "GET" && r.expensiveWork) {
    fail(
      `Route ${r.key} is pinned CHEAP, but it is a non-GET route in a source file that does retrieval/embedding/SPARQL work (${r.file}). Pin it EXPENSIVE and mount a strict rateLimit() for it in the app.ts (or move the route out of the expensive-work module if it truly is cheap).`,
    );
  }
}

// Stale pins: a pinned key that no longer matches any enumerated route.
for (const key of [...EXPENSIVE, ...CHEAP]) {
  if (!seenKeys.has(key)) {
    fail(
      `Pinned route ${key} no longer exists — remove it from the pin (and its limiter mount, if expensive).`,
    );
  }
}

// 2. Strict limiter coverage.
const apiApp = extractLimiterMounts(readFileSync(API_SERVER_APP, "utf8"), null);
const legomenaAppSrc = readFileSync(LEGOMENA_APP, "utf8");
const basePathMatch = legomenaAppSrc.match(
  /BASE_PATH\s*=\s*["'`]([^"'`]+)["'`]/,
);
if (!basePathMatch) {
  fail("Cannot find BASE_PATH in legomena app.ts");
}
const legApp = extractLimiterMounts(
  legomenaAppSrc,
  basePathMatch ? basePathMatch[1] : "",
);

if (apiApp.generalMountCount < 1) {
  fail("api-server app.ts lost its generous general /api rate limiter.");
}
if (legApp.generalMountCount < 1) {
  fail("legomena app.ts lost its generous general rate limiter.");
}

const allStrict = [...apiApp.strict, ...legApp.strict];
for (const key of EXPENSIVE) {
  if (!allStrict.some((mnt) => covers(mnt, key))) {
    fail(
      `Expensive route ${key} has no strict rate-limiter mount covering it in its app.ts.`,
    );
  }
}
for (const mnt of allStrict) {
  const covered = [...EXPENSIVE].filter((key) => covers(mnt, key));
  if (covered.length === 0) {
    fail(
      `Strict limiter mount ${mnt.method} ${mnt.prefix} covers no pinned expensive route — stale mount or missing pin.`,
    );
  }
}

// 3. Positive controls on the pin itself.
if (![...EXPENSIVE].some((k) => k.includes(" /api/"))) {
  fail("No api-server route pinned expensive — pin drifted.");
}
if (![...EXPENSIVE].some((k) => k.includes(" /legomena/api/"))) {
  fail("No legomena route pinned expensive — pin drifted.");
}
if (allStrict.length === 0) {
  fail("No strict limiter mounts found in either app.ts.");
}

console.log(
  `Enumerated ${routes.length} routes (${apiCount} api-server, ${legCount} legomena); ` +
    `${EXPENSIVE.size} pinned expensive, ${CHEAP.size} cheap; ` +
    `${allStrict.length} strict limiter mounts.`,
);
if (failures > 0) {
  console.error(`validate-endpoint-rate-limits: ${failures} failure(s).`);
  process.exit(1);
}
console.log("validate-endpoint-rate-limits: OK");
