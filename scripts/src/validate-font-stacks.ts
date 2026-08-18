/**
 * Guards the Laertius app against hardcoded font stacks drifting from
 * the shared typography tokens.
 *
 * Task 603 removed the homepage's inline 'Playfair Display' /
 * 'Source Serif 4' / system-ui stacks and the Google Fonts CDN link in
 * favor of the shared tokens (--app-font-sans/serif/display/mono,
 * defined once in src/index.css) and self-hosted @fontsource imports.
 * Nothing structural stops a future page from hardcoding a font-family
 * string or re-adding a fonts.googleapis.com link, silently splitting
 * the typography again. This validator makes that a failing check.
 *
 * Rules:
 * 1. No file under artifacts/laertius/src, and not index.html, may
 *    reference fonts.googleapis.com or fonts.gstatic.com.
 * 2. Every `font-family:` (CSS) or `fontFamily:` (JSX/TS) declaration
 *    outside src/index.css must resolve exclusively to the shared
 *    tokens: its value may only be var(--app-font-*) references
 *    (fallbacks inside the var() are allowed).
 * 3. src/index.css is the single place allowed to hold literal stacks,
 *    and only in `--app-font-*:` token definitions; other font-family
 *    declarations there must also use the tokens.
 * 4. Positive controls: index.css must define all four --app-font-*
 *    tokens, and the sweep must actually see a healthy number of
 *    font-family usages (a vacuous pass is impossible).
 *
 * Allowed exceptions: none at present. The former monospace stacks in
 * sparql-playground.tsx were migrated to var(--app-font-mono); if a
 * genuine exception is ever needed, add it to ALLOWLIST below with a
 * comment explaining why.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-font-stacks
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const APP_DIR = path.join(REPO_ROOT, "artifacts/laertius");
const SRC_DIR = path.join(APP_DIR, "src");
const INDEX_HTML = path.join(APP_DIR, "index.html");
const INDEX_CSS = path.join(SRC_DIR, "index.css");

// ---- Legomena coverage (task 655) -----------------------------------
// The Legomena mini-site ships in the same IONOS bundle and must not
// drift typographically from the edition. Since the merge (standalone
// artifact retired), its pages live INSIDE artifacts/laertius/src/pages/
// legomena, so the main sweep above covers them — but only as long as
// they stay there. Three guards keep that from silently changing:
//
// a) The merged pages directory must exist and contribute files to the
//    sweep (if the mini-site is ever split back out, this fails loudly
//    instead of losing coverage).
// b) If source ever reappears under artifacts/legomena (src/ or
//    index.html), it is swept with the same rules — including the
//    external-font-host ban — automatically.
// c) The legomena-api service (the only live code under the Legomena
//    artifact; it can emit HTML and sets the CSP) is swept for external
//    font hosts, and its CSP must keep font-src locked to 'self' so an
//    external font could not even load.
const LEGOMENA_PAGES_DIR = path.join(SRC_DIR, "pages/legomena");
const LEGOMENA_ARTIFACT_DIR = path.join(REPO_ROOT, "artifacts/legomena");
const LEGOMENA_API_SRC = path.join(REPO_ROOT, "artifacts/legomena-api/src");

// file (relative to APP_DIR) -> exact declaration values permitted there.
const ALLOWLIST = new Map<string, string[]>([
  // (none — keep literal stacks out of pages and components)
]);

const EXTS = new Set([".ts", ".tsx", ".css", ".html"]);

let failures = 0;
function fail(msg: string) {
  failures++;
  console.error(`  FAIL: ${msg}`);
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (EXTS.has(path.extname(p))) yield p;
  }
}

// A declaration value is token-pure when, after stripping every
// var(--app-font-...) reference (fallback text inside var() included),
// nothing but separators/quotes remains.
function isTokenPure(value: string): boolean {
  // Nested fallbacks like var(--app-font-display, var(--app-font-serif))
  // are token-pure too, so strip var( / --app-font-* / parens separately.
  const stripped = value
    .replace(/var\(/g, "")
    .replace(/--app-font-[a-z-]+/g, "")
    .replace(/[()"'`,\s;]/g, "");
  return stripped.length === 0;
}

// JSX/TS form: fontFamily: "<value>" — quote-aware per delimiter, so a
// value like "'Courier New', monospace" (single quotes inside double
// quotes, the conventional shape) is still captured and validated.
const JSX_FONT_FAMILY_RE =
  /fontFamily\s*:\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g;

// Self-test: the matcher and purity check must behave on known
// fixtures, or the whole sweep could pass vacuously.
{
  const fixtures: { src: string; expectValue: string; pure: boolean }[] = [
    { src: `fontFamily: "'Courier New', monospace"`, expectValue: "'Courier New', monospace", pure: false },
    { src: `fontFamily: '"Courier New", monospace'`, expectValue: '"Courier New", monospace', pure: false },
    { src: `fontFamily: "system-ui, sans-serif"`, expectValue: "system-ui, sans-serif", pure: false },
    { src: `fontFamily: "var(--app-font-mono)"`, expectValue: "var(--app-font-mono)", pure: true },
    { src: `fontFamily: "var(--app-font-display, var(--app-font-serif))"`, expectValue: "var(--app-font-display, var(--app-font-serif))", pure: true },
  ];
  for (const f of fixtures) {
    const m = [...f.src.matchAll(JSX_FONT_FAMILY_RE)];
    const value = m.length ? (m[0]![1] ?? m[0]![2] ?? m[0]![3] ?? "").trim() : undefined;
    if (value !== f.expectValue) {
      fail(`self-test: matcher failed to extract "${f.expectValue}" from ${f.src} (got ${JSON.stringify(value)})`);
    } else if (isTokenPure(value) !== f.pure) {
      fail(`self-test: isTokenPure("${value}") should be ${f.pure}`);
    }
  }
  if (failures === 0) console.log(`Self-test passed on ${fixtures.length} matcher fixtures.`);
}

const files = [...walk(SRC_DIR), INDEX_HTML];

// (b) Sweep any resurrected standalone Legomena source with the same rules.
const legomenaSrc = path.join(LEGOMENA_ARTIFACT_DIR, "src");
if (existsSync(legomenaSrc)) files.push(...walk(legomenaSrc));
const legomenaIndexHtml = path.join(LEGOMENA_ARTIFACT_DIR, "index.html");
if (existsSync(legomenaIndexHtml)) files.push(legomenaIndexHtml);

// (c) Sweep the legomena-api source too (it can emit HTML/CSS strings).
files.push(...walk(LEGOMENA_API_SRC));

let declCount = 0;
let checkedFiles = 0;

for (const file of files) {
  const rel = file.startsWith(APP_DIR + path.sep)
    ? path.relative(APP_DIR, file)
    : path.relative(REPO_ROOT, file);
  const text = readFileSync(file, "utf8");
  checkedFiles++;

  // Rule 1: no Google Fonts CDN anywhere (comments included — a
  // commented-out link is one uncomment away from shipping).
  for (const m of text.matchAll(/fonts\.(googleapis|gstatic)\.com/g)) {
    const line = text.slice(0, m.index).split("\n").length;
    fail(`${rel}:${line} references ${m[0]} — fonts must stay self-hosted`);
  }

  // Rule 2/3: collect font-family declarations.
  // CSS form: font-family: <value up to ; or }>
  // JS/JSX form: fontFamily: "<value>" (or '...' / `...`)
  const decls: { line: number; value: string }[] = [];
  for (const m of text.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
    decls.push({
      line: text.slice(0, m.index).split("\n").length,
      value: m[1]!.trim(),
    });
  }
  for (const m of text.matchAll(JSX_FONT_FAMILY_RE)) {
    decls.push({
      line: text.slice(0, m.index).split("\n").length,
      value: (m[1] ?? m[2] ?? m[3] ?? "").trim(),
    });
  }

  for (const d of decls) {
    declCount++;
    // index.css may define the tokens themselves with literal stacks.
    if (file === INDEX_CSS) {
      const lineText = text.split("\n")[d.line - 1] ?? "";
      if (/^\s*--app-font-[a-z-]+\s*:/.test(lineText)) continue;
      if (isTokenPure(d.value)) continue;
      fail(
        `${rel}:${d.line} font-family outside an --app-font-* token definition hardcodes a stack: "${d.value}"`,
      );
      continue;
    }
    if (isTokenPure(d.value)) continue;
    const allowed = ALLOWLIST.get(rel) ?? [];
    if (allowed.includes(d.value)) continue;
    fail(
      `${rel}:${d.line} hardcodes a font stack: "${d.value}" — use var(--app-font-sans|serif|display|mono) instead`,
    );
  }
}

// Rule 4a: the four shared tokens must exist in index.css.
const indexCss = readFileSync(INDEX_CSS, "utf8");
for (const token of ["sans", "serif", "display", "mono"]) {
  if (!new RegExp(`--app-font-${token}\\s*:`).test(indexCss)) {
    fail(`index.css no longer defines --app-font-${token}`);
  }
}

// Rule 4b: positive control — the sweep must have seen real usage.
console.log(
  `Scanned ${checkedFiles} files; found ${declCount} font-family declaration(s).`,
);
if (declCount < 10) {
  fail(
    `positive control: expected at least 10 font-family declarations across the app, found ${declCount} — the sweep may be matching nothing`,
  );
}
if (!indexCss.includes("@fontsource/")) {
  fail("index.css no longer imports self-hosted @fontsource fonts");
}

// Rule 5 (task 655): Legomena coverage positive controls.
// (a) The merged Legomena pages must still live inside the swept tree.
if (!existsSync(LEGOMENA_PAGES_DIR)) {
  fail(
    "artifacts/laertius/src/pages/legomena no longer exists — the Legomena " +
      "mini-site moved out of the swept tree; extend this validator to its " +
      "new location before removing this check",
  );
} else {
  const legomenaFiles = [...walk(LEGOMENA_PAGES_DIR)];
  console.log(
    `Legomena coverage: ${legomenaFiles.length} merged page file(s) inside the sweep.`,
  );
  if (legomenaFiles.length < 5) {
    fail(
      `positive control: expected at least 5 Legomena page files under the sweep, found ${legomenaFiles.length}`,
    );
  }
}
// (c) legomena-api CSP must keep fonts locked to self-hosted.
const securityTs = path.join(LEGOMENA_API_SRC, "security.ts");
if (!existsSync(securityTs)) {
  fail(
    "artifacts/legomena-api/src/security.ts is gone — the CSP font-src " +
      "'self' guard has no anchor; update this validator",
  );
} else if (!/font-src 'self'/.test(readFileSync(securityTs, "utf8"))) {
  fail(
    "legomena-api CSP no longer pins font-src 'self' — external font hosts " +
      "could load in the Legomena API's responses",
  );
}

if (failures > 0) {
  console.error(`\nvalidate-font-stacks: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("validate-font-stacks: all checks passed");
