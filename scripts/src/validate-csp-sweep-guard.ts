/**
 * validate-csp-sweep-guard — makes sure build-ionos-bundle's CSP browser
 * sweep and its loud skip banner can't silently vanish (task: "Make sure the
 * build's CSP-sweep skip warning can't silently vanish").
 *
 * build-ionos-bundle runs the CSP sweep (e2e-csp-violations) after a passed
 * smoke test, and prints a loud "CSP BROWSER SWEEP NOT RUN" banner on every
 * skip path (SKIP_CSP=1, SKIP_SMOKE=1, missing headless Chromium). Nothing
 * else guards that wiring: a refactor could drop the runCspSweep() call or a
 * banner and bundles would ship CSP-unverified with no warning.
 *
 * Static wiring checks against scripts/src/build-ionos-bundle.ts:
 *   1. the banner helper prints the loud "CSP BROWSER SWEEP NOT RUN" text via
 *      console.warn and names the e2e-csp-violations command to run
 *   2. the sweep runner actually invokes e2e-csp-violations against the zip,
 *      and on failure deletes the zip + manifest and exits non-zero
 *   3. the sweep is invoked after the smoke test passes (after the "passed"
 *      manifest write) in the build's verify phase
 *   4. every skip path keeps its banner:
 *        - SKIP_CSP=1 branch calls the banner before returning
 *        - missing-Chromium branch calls the banner before returning
 *        - SKIP_SMOKE=1 early-return branch calls the banner too
 *   5. the sweep pages + positive control still live in e2e-csp-violations
 *      (header assertion and injected-inline-script control)
 *
 * Positive controls: the same analysis is re-run against mutated copies of
 * the build script (sweep call dropped, each banner call dropped, banner text
 * softened) and must flag every mutation, so the validator cannot pass
 * vacuously after a refactor moves the code it inspects.
 *
 * Run: pnpm --filter @workspace/scripts run validate-csp-sweep-guard
 * Exit codes: 0 = all checks pass, 1 = at least one failure.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const buildScriptPath = path.join(scriptsDir, "src", "build-ionos-bundle.ts");
const sweepScriptPath = path.join(scriptsDir, "src", "e2e-csp-violations.ts");

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`PASS: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}${detail ? `\n  ${detail}` : ""}`);
  }
}

/** Extract a `function name(...) {...}` body by brace matching. */
function functionBody(src: string, name: string): string | null {
  const declIdx = src.indexOf(`function ${name}(`);
  if (declIdx === -1) return null;
  const open = src.indexOf("{", declIdx);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  return null;
}

/**
 * Slice from an anchor to the first `return` after it — the body of an
 * early-return skip branch. Returns null when the anchor is missing.
 */
function skipBranch(body: string, anchor: string): string | null {
  const idx = body.indexOf(anchor);
  if (idx === -1) return null;
  const ret = body.indexOf("return", idx);
  if (ret === -1) return null;
  return body.slice(idx, ret);
}

const BANNER_TEXT = "CSP BROWSER SWEEP NOT RUN";

/**
 * Paths the sweep's PAGES list must always cover. Each entry carries the
 * regression it guards against, so a trimmed list fails with a reason.
 */
const REQUIRED_SWEEP_PATHS: { path: string; why: string }[] = [
  { path: "/", why: "home page (hashed theme-bootstrap inline script)" },
  { path: "/section/1.1.22", why: "a passage page" },
  { path: "/map", why: "Map page (OSM tiles / img-src)" },
  { path: "/legomena/", why: "Legomena Ask page (merged SPA)" },
  { path: "/legomena/graph", why: "Legomena deep link via SPA fallback" },
];

/**
 * Extract the sweep's PAGES page list from its source. Returns null when the
 * declaration can't be found (renamed/removed — that itself is a problem).
 * Pure so the positive controls can re-run it on mutated copies.
 */
function extractSweepPages(src: string): string[] | null {
  const decl = /const PAGES\s*(?::[^=]*)?=\s*\[/.exec(src);
  if (!decl) return null;
  // The `[` of the array literal is the last char of the match (indexOf from
  // the declaration start would hit the `[]` in the type annotation instead).
  const open = decl.index + decl[0].length - 1;
  let depth = 0;
  let close = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "[") depth++;
    else if (src[i] === "]") {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close === -1) return null;
  const body = src.slice(open + 1, close);
  const paths: string[] = [];
  for (const m of body.matchAll(/path:\s*"([^"]*)"/g)) {
    paths.push(m[1]);
  }
  return paths;
}

/** Which required paths are missing from the sweep source's PAGES list. */
function missingSweepPaths(src: string): string[] {
  const pages = extractSweepPages(src);
  if (pages === null) {
    return REQUIRED_SWEEP_PATHS.map(
      (r) => `${r.path} (PAGES list not found in the sweep source at all)`,
    );
  }
  return REQUIRED_SWEEP_PATHS.filter((r) => !pages.includes(r.path)).map(
    (r) => `${r.path} — ${r.why}`,
  );
}

/**
 * Analyze the build script source; returns a list of wiring problems.
 * Pure so the positive controls can re-run it on mutated copies.
 */
function analyzeBuildScript(src: string): string[] {
  const problems: string[] = [];

  // 1. Loud banner helper.
  const banner = functionBody(src, "cspSkipBanner");
  if (!banner) {
    problems.push("cspSkipBanner() helper is missing");
  } else {
    if (!banner.includes(BANNER_TEXT)) {
      problems.push(
        `cspSkipBanner no longer prints the loud "${BANNER_TEXT}" text`,
      );
    }
    if (!/console\.(warn|error)/.test(banner)) {
      problems.push("cspSkipBanner no longer prints via console.warn/error");
    }
    if (!banner.includes("e2e-csp-violations")) {
      problems.push(
        "cspSkipBanner no longer tells the reader to run e2e-csp-violations",
      );
    }
  }

  // 2. The sweep runner really runs the sweep and fails the build on a hit.
  const sweep = functionBody(src, "runCspSweep");
  if (!sweep) {
    problems.push("runCspSweep() function is missing");
  } else {
    if (!sweep.includes("e2e-csp-violations")) {
      problems.push("runCspSweep no longer invokes e2e-csp-violations");
    }
    if (!/rmSync\(zipPath/.test(sweep) || !/process\.exit\(1\)/.test(sweep)) {
      problems.push(
        "runCspSweep no longer deletes the zip and exits non-zero on a CSP failure",
      );
    }
    // 4a. SKIP_CSP=1 skip path keeps its banner.
    const skipCsp = skipBranch(sweep, "SKIP_CSP");
    if (!skipCsp) {
      problems.push("runCspSweep lost its SKIP_CSP early-return branch");
    } else if (!skipCsp.includes("cspSkipBanner(")) {
      problems.push(
        "the SKIP_CSP=1 skip path no longer prints the loud banner",
      );
    }
    // 4b. Missing-Chromium skip path keeps its banner.
    const noChromium = skipBranch(sweep, "!chromiumDir");
    if (!noChromium) {
      problems.push(
        "runCspSweep lost its missing-Chromium early-return branch (findHeadlessChromiumDir guard)",
      );
    } else if (!noChromium.includes("cspSkipBanner(")) {
      problems.push(
        "the missing-Chromium skip path no longer prints the loud banner",
      );
    }
  }

  // 3. The verify phase calls the sweep after the smoke test passed.
  const verify = functionBody(src, "buildAndVerify");
  if (!verify) {
    problems.push("buildAndVerify() function is missing");
  } else {
    const sweepCall = verify.indexOf("runCspSweep()");
    if (sweepCall === -1) {
      problems.push("buildAndVerify no longer calls runCspSweep()");
    } else {
      const passedWrite = verify.indexOf('writeSourcesManifest(repoRoot, "passed")');
      if (passedWrite === -1) {
        problems.push(
          'buildAndVerify no longer writes the "passed" sources manifest (smoke ordering anchor lost)',
        );
      } else if (sweepCall < passedWrite) {
        problems.push(
          "runCspSweep() runs BEFORE the passed smoke test is recorded — the sweep must follow a passed smoke",
        );
      }
    }
    // 4c. SKIP_SMOKE=1 early return keeps its banner too.
    const skipSmoke = skipBranch(verify, "SKIP_SMOKE");
    if (!skipSmoke) {
      problems.push("buildAndVerify lost its SKIP_SMOKE early-return branch");
    } else if (!skipSmoke.includes("cspSkipBanner(")) {
      problems.push(
        "the SKIP_SMOKE=1 skip path no longer prints the loud banner",
      );
    }
  }

  return problems;
}

/** Apply a mutation; throws if the pattern no longer matches (anchor drift). */
function mutate(src: string, label: string, pattern: RegExp, replacement: string): string {
  const out = src.replace(pattern, replacement);
  if (out === src) {
    throw new Error(
      `positive-control mutation "${label}" did not change the source — its anchor drifted; update validate-csp-sweep-guard`,
    );
  }
  return out;
}

function main() {
  const src = readFileSync(buildScriptPath, "utf8");

  // --- Real source must be clean. ---
  const problems = analyzeBuildScript(src);
  check(
    "build-ionos-bundle.ts keeps the CSP sweep + every loud skip banner wired",
    problems.length === 0,
    problems.join("\n  "),
  );

  // --- The sweep script itself keeps its anti-vacuous guards. ---
  const sweepSrc = readFileSync(sweepScriptPath, "utf8");
  check(
    "e2e-csp-violations asserts the CSP header is present on documents",
    sweepSrc.includes("content-security-policy") &&
      /header is present/i.test(sweepSrc),
  );
  check(
    "e2e-csp-violations keeps its injected-inline-script positive control",
    /positive control/i.test(sweepSrc) && sweepSrc.includes("__cspCanary"),
  );

  // --- The sweep's PAGES list still covers every key page. ---
  const missing = missingSweepPaths(sweepSrc);
  check(
    "e2e-csp-violations PAGES list still covers home, a passage page, /map, and the Legomena routes",
    missing.length === 0,
    missing.length > 0 ? `missing: ${missing.join("; ")}` : undefined,
  );
  // Sanity: the extractor really parsed the list (not vacuous on a rename).
  const parsedPages = extractSweepPages(sweepSrc);
  check(
    "PAGES list extractor parsed a non-empty page list from the sweep source",
    parsedPages !== null && parsedPages.length >= REQUIRED_SWEEP_PATHS.length,
    `parsed=${JSON.stringify(parsedPages)}`,
  );

  // Positive controls on the sweep source: a trimmed page list must be flagged.
  const sweepMutations: { label: string; mutated: string; expectPath: string }[] = [
    {
      label: "PAGES trimmed to just home",
      mutated: mutate(
        sweepSrc,
        "trim PAGES to home",
        /const PAGES: \{ path: string; label: string \}\[\] = \[[\s\S]*?\n\];/,
        'const PAGES: { path: string; label: string }[] = [\n  { path: "/", label: "home" },\n];',
      ),
      expectPath: "/map",
    },
    {
      label: "map page dropped from PAGES",
      mutated: mutate(
        sweepSrc,
        "drop /map entry",
        /\n\s*\{ path: "\/map",[^\n]*\},/,
        "\n",
      ),
      expectPath: "/map",
    },
    {
      label: "Legomena deep link dropped from PAGES",
      mutated: mutate(
        sweepSrc,
        "drop /legomena/graph entry",
        /\n\s*\{ path: "\/legomena\/graph",[^\n]*\},/,
        "\n",
      ),
      expectPath: "/legomena/graph",
    },
    {
      label: "PAGES declaration renamed away",
      mutated: mutate(
        sweepSrc,
        "rename PAGES",
        /const PAGES:/,
        "const ROUTES:",
      ),
      expectPath: "PAGES list not found",
    },
  ];
  for (const { label, mutated, expectPath } of sweepMutations) {
    const flagged = missingSweepPaths(mutated);
    check(
      `positive control: page-list check flags "${label}"`,
      flagged.some((m) => m.includes(expectPath)),
      `missing reported: ${JSON.stringify(flagged)}`,
    );
  }

  // --- Positive controls: the analysis must flag each seeded regression. ---
  const mutations: { label: string; mutated: string; expect: RegExp }[] = [
    {
      label: "sweep call dropped from buildAndVerify",
      mutated: mutate(src, "drop runCspSweep()", /\n\s*runCspSweep\(\);/, "\n"),
      expect: /no longer calls runCspSweep/,
    },
    {
      label: "SKIP_CSP banner dropped",
      mutated: mutate(
        src,
        "drop SKIP_CSP banner",
        /cspSkipBanner\(\s*"SKIP_CSP[\s\S]*?\n\s*\);/,
        "",
      ),
      expect: /SKIP_CSP=1 skip path no longer prints/,
    },
    {
      label: "SKIP_SMOKE banner dropped",
      mutated: mutate(
        src,
        "drop SKIP_SMOKE banner",
        /cspSkipBanner\(\s*"SKIP_SMOKE[\s\S]*?\n\s*\);/,
        "",
      ),
      expect: /SKIP_SMOKE=1 skip path no longer prints/,
    },
    {
      label: "missing-Chromium banner dropped",
      mutated: mutate(
        src,
        "drop no-Chromium banner",
        /cspSkipBanner\(\s*"no headless Chromium[\s\S]*?\n\s*\);/,
        "",
      ),
      expect: /missing-Chromium skip path no longer prints/,
    },
    {
      label: "banner text softened",
      mutated: mutate(
        src,
        "soften banner text",
        /CSP BROWSER SWEEP NOT RUN/g,
        "csp sweep note",
      ),
      expect: /no longer prints the loud/,
    },
    {
      label: "sweep moved before the smoke test",
      mutated: mutate(
        src,
        "move sweep before smoke",
        /(async function buildAndVerify\(\) \{\n  main\(\);\n)/,
        "$1  runCspSweep();\n",
      ).replace(/\n  runCspSweep\(\);\n\}/, "\n}"),
      expect: /BEFORE the passed smoke test|no longer calls runCspSweep/,
    },
  ];
  for (const { label, mutated, expect } of mutations) {
    const found = analyzeBuildScript(mutated);
    check(
      `positive control: analysis flags "${label}"`,
      found.some((p) => expect.test(p)),
      `problems reported: ${JSON.stringify(found)}`,
    );
  }

  console.log(
    failures === 0
      ? "\nAll CSP-sweep guard checks passed."
      : `\n${failures} check(s) FAILED.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
