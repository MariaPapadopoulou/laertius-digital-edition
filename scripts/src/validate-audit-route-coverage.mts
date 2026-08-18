// Validator (task 689, reworked in task 818): catch a newly added page
// slipping past the audit sweeps unchecked. The mobile audit gate
// (e2e-mobile-audit.mts), the full-site audit (e2e-full-audit.mts), and the
// accessibility audit (e2e-a11y-audit.mts) all iterate the ONE shared
// sample-route list in scripts/src/lib/audit-routes; a route added to the
// app router but not to that list would silently escape the
// console-error/network/overflow/axe checks.
//
// This check imports the shared list directly (no source-regex parsing of
// the audit scripts) and verifies:
//   1. every route registered in the laertius router
//      (artifacts/laertius/src/App.tsx — the Legomena pages are routed
//      there too, under /legomena/*) is covered by at least one sample;
//      parameterized routes (e.g. /section/:id) are satisfied by any
//      matching sample path;
//   2. every sample matches some registered route (no stale entries);
//   3. each audit script actually imports the shared module, so none can
//      quietly regrow its own hardcoded list and drift.
import { readFileSync } from "node:fs";
import { SAMPLE_ROUTES, NOT_FOUND_ROUTE } from "./lib/audit-routes";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const APP_ROUTER = `${ROOT}/artifacts/laertius/src/App.tsx`;
const AUDIT_FILES = [
  `${ROOT}/scripts/src/e2e-mobile-audit.mts`,
  `${ROOT}/scripts/src/e2e-full-audit.mts`,
  `${ROOT}/scripts/src/e2e-a11y-audit.mts`,
];

let failed = false;
const fail = (msg: string) => {
  failed = true;
  console.error(`FAIL: ${msg}`);
};

// ---- 1. Extract routed paths from the app router --------------------------
const appSrc = readFileSync(APP_ROUTER, "utf8");
const routePaths: string[] = [];
for (const m of appSrc.matchAll(/<Route\s+path="([^"]+)"/g)) {
  routePaths.push(m[1]);
}
// The homepage renders outside the <Switch> (location === "/" early return),
// so add it explicitly when the router special-cases it.
if (/location\s*===\s*"\/"/.test(appSrc) && !routePaths.includes("/")) {
  routePaths.unshift("/");
}

// Positive control: an empty or barely-parsed route list means the regex no
// longer matches the router source — never pass vacuously.
if (routePaths.length < 15) {
  fail(
    `only ${routePaths.length} <Route path="..."> entries parsed from ${APP_ROUTER}; ` +
      `the router format may have changed — update validate-audit-route-coverage.mts`,
  );
}
// Positive control on the imported shared list too.
if (SAMPLE_ROUTES.length < 15) {
  fail(
    `only ${SAMPLE_ROUTES.length} entries in the shared SAMPLE_ROUTES list ` +
      `(scripts/src/lib/audit-routes) — list looks gutted`,
  );
}

// ---- 2. Match each routed pattern against the shared samples ---------------
function matchesPattern(pattern: string, sample: string): boolean {
  const samplePath = sample.split("?")[0];
  const pSegs = pattern.split("/").filter(Boolean);
  const sSegs = samplePath.split("/").filter(Boolean);
  if (pattern === "/") return samplePath === "/";
  if (pSegs.length !== sSegs.length) return false;
  return pSegs.every((seg, i) =>
    seg.startsWith(":") ? sSegs[i].length > 0 : seg === sSegs[i],
  );
}

const missing = routePaths.filter(
  (pattern) => !SAMPLE_ROUTES.some((sample) => matchesPattern(pattern, sample)),
);
for (const pattern of missing) {
  fail(
    `route "${pattern}" (registered in artifacts/laertius/src/App.tsx) is not covered ` +
      `by the shared SAMPLE_ROUTES list in scripts/src/lib/audit-routes — add a ` +
      `sample path so the audit sweeps check the new page`,
  );
}

// Reverse check: a sample that matches no registered pattern is stale
// (page removed/renamed). The deliberate 404 probe lives in NOT_FOUND_ROUTE,
// not in SAMPLE_ROUTES, so every sample must match.
const stale = SAMPLE_ROUTES.filter(
  (sample) => !routePaths.some((pattern) => matchesPattern(pattern, sample)),
);
for (const sample of stale) {
  fail(
    `SAMPLE_ROUTES entry "${sample}" (scripts/src/lib/audit-routes) matches no ` +
      `registered route in the app router — remove it or fix the path`,
  );
}
if (SAMPLE_ROUTES.includes(NOT_FOUND_ROUTE)) {
  fail(
    `NOT_FOUND_ROUTE "${NOT_FOUND_ROUTE}" must not appear inside SAMPLE_ROUTES — ` +
      `audits handle the 404 probe separately`,
  );
}
if (missing.length === 0 && stale.length === 0) {
  console.log(
    `ok: shared SAMPLE_ROUTES covers all ${routePaths.length} registered routes`,
  );
}

// ---- 3. Each audit script must import the shared module --------------------
for (const auditFile of AUDIT_FILES) {
  const short = auditFile.slice(ROOT.length + 1);
  const src = readFileSync(auditFile, "utf8");
  if (!/["']\.\/lib\/audit-routes(?:\.ts)?["']/.test(src)) {
    fail(
      `${short} does not import scripts/src/lib/audit-routes — audits must use the ` +
        `shared SAMPLE_ROUTES list, not a private hardcoded one`,
    );
  } else if (/const ROUTES\s*=\s*\[\s*"/.test(src)) {
    fail(
      `${short} still defines a hardcoded ROUTES string array alongside the shared ` +
        `import — derive ROUTES from SAMPLE_ROUTES instead`,
    );
  } else {
    console.log(`ok: ${short} imports the shared audit-routes module`);
  }
}

if (failed) process.exit(1);
console.log(
  `\nAudit route coverage OK (${routePaths.length} routed paths vs shared list; ${AUDIT_FILES.length} sweeps import it)`,
);
