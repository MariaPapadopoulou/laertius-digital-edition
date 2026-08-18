/**
 * validate-playwright-bootstrap — stops browser checks from sneaking back in
 * their own Chromium-finding code.
 *
 * All browser e2e/validate scripts share ONE bootstrap
 * (scripts/src/lib/playwright-browsers-path.ts) that sets
 * PLAYWRIGHT_BROWSERS_PATH before playwright-core is imported. If a future
 * script copy-pastes the old inline candidate-directory block instead, the
 * drift this refactor removed silently returns: the moment the cache
 * location changes, that one script starts failing with "browser not found"
 * while every other check keeps working.
 *
 * Sweeps scripts/src/*.ts, *.mts and scripts/src/lib/*.ts and fails when:
 *  1. Any file (outside lib/playwright-browsers-path.ts and
 *     headless-chromium.ts) assigns process.env.PLAYWRIGHT_BROWSERS_PATH
 *     inline (plain =, ??=, ||=, &&=, or bracket-notation forms).
 *  2. Any file that dynamically imports playwright-core does not import the
 *     shared bootstrap, or imports it AFTER the first dynamic
 *     import("playwright-core") in source order.
 *  3. Any file statically imports playwright-core values (a static import is
 *     hoisted and would resolve the browser registry before the bootstrap's
 *     side effect can run in dynamic-ordering-dependent files; `import type`
 *     is erased and allowed).
 *
 * Positive controls: the same classifier is run against mutated in-memory
 *  fixtures — one with the old inline block, one importing playwright-core
 *  without the bootstrap, one with the bootstrap AFTER the dynamic import,
 *  and one compliant file — and must flag exactly the bad ones. It also
 *  fails if the sweep finds zero playwright-core consumers (the reference
 *  scripts exist, so zero means the scan itself broke).
 *
 * Run: pnpm --filter @workspace/scripts run validate-playwright-bootstrap
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Files allowed to touch PLAYWRIGHT_BROWSERS_PATH / own the candidate list. */
const EXEMPT = new Set([
  "lib/playwright-browsers-path.ts",
  "headless-chromium.ts",
  // This validator only ever mentions the names inside strings/comments,
  // but exempt it explicitly so fixture literals can never trip the sweep.
  "validate-playwright-bootstrap.ts",
]);

/** Strip // line comments and block comments (leaves strings intact). */
export function stripComments(src: string): string {
  let out = "";
  let i = 0;
  let mode: "code" | "line" | "block" | "sq" | "dq" | "tpl" = "code";
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    const ch = src[i];
    if (mode === "code") {
      if (two === "//") {
        mode = "line";
        i += 2;
      } else if (two === "/*") {
        mode = "block";
        i += 2;
      } else {
        if (ch === "'") mode = "sq";
        else if (ch === '"') mode = "dq";
        else if (ch === "`") mode = "tpl";
        out += ch;
        i += 1;
      }
    } else if (mode === "line") {
      if (ch === "\n") {
        mode = "code";
        out += ch;
      }
      i += 1;
    } else if (mode === "block") {
      if (two === "*/") {
        mode = "code";
        i += 2;
      } else {
        if (ch === "\n") out += ch; // keep line numbers stable
        i += 1;
      }
    } else {
      // inside a string/template: copy verbatim, honoring escapes
      if (ch === "\\") {
        out += src.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (
        (mode === "sq" && ch === "'") ||
        (mode === "dq" && ch === '"') ||
        (mode === "tpl" && ch === "`")
      ) {
        mode = "code";
      }
      out += ch;
      i += 1;
    }
  }
  return out;
}

const INLINE_ASSIGN_RE =
  /process\.env(?:\.|\[\s*["'])PLAYWRIGHT_BROWSERS_PATH(?:["']\s*\])?\s*(?:\?\?=|\|\|=|&&=|=(?!=))/;
const DYNAMIC_PWCORE_RE = /import\s*\(\s*["']playwright-core["']\s*\)/;
const STATIC_PWCORE_RE =
  /(?:^|\n)\s*import\s+(?!type[\s{])[^;]*?from\s*["']playwright-core["']|(?:^|\n)\s*import\s*["']playwright-core["']|require\s*\(\s*["']playwright-core["']\s*\)/;
// Bootstrap import from src/ ("./lib/playwright-browsers-path") or from
// lib/ itself ("./playwright-browsers-path"); optional .ts/.js extension.
const BOOTSTRAP_IMPORT_RE =
  /import\s*["'](?:\.\.?\/)*(?:lib\/)?playwright-browsers-path(?:\.[cm]?[jt]s)?["']/;

export function classify(source: string): {
  violations: string[];
  usesPlaywrightCore: boolean;
} {
  const code = stripComments(source);
  const violations: string[] = [];

  const assign = code.match(INLINE_ASSIGN_RE);
  if (assign) {
    const line = code.slice(0, assign.index).split("\n").length;
    violations.push(
      `inline PLAYWRIGHT_BROWSERS_PATH assignment at line ${line} — import "./lib/playwright-browsers-path" instead`,
    );
  }

  const staticImport = code.match(STATIC_PWCORE_RE);
  if (staticImport) {
    const line =
      code.slice(0, (staticImport.index ?? 0) + 1).split("\n").length;
    violations.push(
      `static (non-type) import of playwright-core near line ${line} — use the dynamic form after importing the shared bootstrap`,
    );
  }

  const dynamic = code.match(DYNAMIC_PWCORE_RE);
  const usesPlaywrightCore = Boolean(dynamic) || Boolean(staticImport);
  if (dynamic) {
    const bootstrap = code.match(BOOTSTRAP_IMPORT_RE);
    if (!bootstrap) {
      violations.push(
        `dynamically imports playwright-core but never imports the shared bootstrap ("./lib/playwright-browsers-path")`,
      );
    } else if ((bootstrap.index ?? 0) > (dynamic.index ?? 0)) {
      violations.push(
        `shared bootstrap import appears AFTER the first import("playwright-core") — move it above so the ordering intent stays readable`,
      );
    }
  }

  return { violations, usesPlaywrightCore };
}

function listSweptFiles(): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(here, { withFileTypes: true })) {
    if (entry.isFile() && /\.(ts|mts|cts)$/.test(entry.name)) {
      files.push(entry.name);
    }
    if (entry.isDirectory() && entry.name === "lib") {
      for (const sub of readdirSync(path.join(here, "lib"))) {
        if (/\.(ts|mts|cts)$/.test(sub)) files.push(`lib/${sub}`);
      }
    }
  }
  return files.filter((f) => !EXEMPT.has(f)).sort();
}

function runPositiveControls(): string[] {
  const errors: string[] = [];
  const badInline = `
import { existsSync } from "node:fs";
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  const candidates = ["/tmp/ms-playwright"];
  process.env.PLAYWRIGHT_BROWSERS_PATH =
    candidates.find((p) => existsSync(p)) ?? candidates[0];
}
import "./lib/playwright-browsers-path";
const { chromium } = await import("playwright-core");
`;
  const badNoBootstrap = `
const { chromium } = await import("playwright-core");
`;
  const badLateBootstrap = `
const { chromium } = await import("playwright-core");
import "./lib/playwright-browsers-path";
`;
  const badStatic = `
import "./lib/playwright-browsers-path";
import { chromium } from "playwright-core";
`;
  const good = `
// PLAYWRIGHT_BROWSERS_PATH is set by the shared bootstrap.
import "./lib/playwright-browsers-path";
const { chromium } = await import("playwright-core");
`;
  const goodCommentOnly = `
// Install once: PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright ...
const msg = "PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright";
console.log(msg);
`;
  const cases: Array<[string, string, boolean]> = [
    ["inline-assignment fixture", badInline, true],
    ["missing-bootstrap fixture", badNoBootstrap, true],
    ["late-bootstrap fixture", badLateBootstrap, true],
    ["static-import fixture", badStatic, true],
    ["compliant fixture", good, false],
    ["comment/string-only mention fixture", goodCommentOnly, false],
  ];
  for (const [name, src, mustFlag] of cases) {
    const { violations } = classify(src);
    if (mustFlag && violations.length === 0) {
      errors.push(`positive control failed: ${name} was NOT flagged`);
    }
    if (!mustFlag && violations.length > 0) {
      errors.push(
        `positive control failed: ${name} was wrongly flagged (${violations.join("; ")})`,
      );
    }
  }
  return errors;
}

function main(): void {
  let failures = 0;
  const files = listSweptFiles();
  let consumers = 0;

  for (const rel of files) {
    const source = readFileSync(path.join(here, rel), "utf8");
    const { violations, usesPlaywrightCore } = classify(source);
    if (usesPlaywrightCore) consumers += 1;
    for (const v of violations) {
      console.error(`FAIL scripts/src/${rel}: ${v}`);
      failures += 1;
    }
  }

  if (consumers === 0) {
    console.error(
      "FAIL sweep found zero playwright-core consumers — the scan itself is broken (the e2e scripts exist)",
    );
    failures += 1;
  }

  for (const err of runPositiveControls()) {
    console.error(`FAIL ${err}`);
    failures += 1;
  }

  console.log(
    `playwright-bootstrap: swept ${files.length} files, ${consumers} playwright-core consumers, ${failures} violation(s)`,
  );
  if (failures > 0) {
    console.error(`\nvalidate-playwright-bootstrap: ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("validate-playwright-bootstrap: OK");
}

main();
