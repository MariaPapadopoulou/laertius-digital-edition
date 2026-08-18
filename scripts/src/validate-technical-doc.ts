/**
 * Keeps the technical overview document in sync with the codebase.
 *
 * scripts/generate-technical-doc.py hard-codes verified counts in its
 * "Verified constants" block (corpus sections, KG edges, claim counts,
 * annotation counts, ...). This validator parses those Python constants
 * and compares each one against its live source of truth: layer-pins.ts
 * for the pinned layers, and the api-server modules / data files for the
 * compiled-in layers. If a layer grows and the doc constant is not
 * updated, this fails and names the constant that drifted.
 *
 * It also guards against a stale export shipping after the numbers change:
 *   - freshness: if generate-technical-doc.py is newer than
 *     exports/laertius-technical-overview.pdf / .docx / laertius-arch.png,
 *     the exports were not regenerated after the script changed, and this
 *     fails naming the stale file(s)
 *   - embedded numbers: every distinctive constant (value >= 100) must
 *     actually appear in the PDF text (via pdftotext) and in the DOCX body
 *     (word/document.xml), so an export whose timestamp was touched but
 *     whose numbers are old still fails
 *
 * On failure: update the constant in scripts/generate-technical-doc.py,
 * then re-run the generator to rebuild the PDF/DOCX exports in exports/.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-technical-doc
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  VERSE_PIN_COUNT,
  TESTAMENT_PIN_COUNT,
  ANNOTATION_PIN_COUNT,
  TAGGED_ENTITY_PIN_COUNT,
  CHAPTER_SUBJECT_PIN_COUNT,
} from "./layer-pins";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getClaims } = await import(
  "../../artifacts/api-server/src/lib/kg-claims"
);
const { KG_EDGES, MOVEMENTS } = await import(
  "../../artifacts/api-server/src/lib/kg"
);

const DOC_SCRIPT = path.resolve(
  import.meta.dirname,
  "../generate-technical-doc.py",
);

// ---------------------------------------------------------------------
// Parse the numeric constants from the Python generator
// ---------------------------------------------------------------------
const pySource = fs.readFileSync(DOC_SCRIPT, "utf8");

function pyConst(name: string): number {
  const m = pySource.match(
    new RegExp(`^${name}\\s*=\\s*(\\d+(?:\\.\\d+)?)\\s*(?:#.*)?$`, "m"),
  );
  if (!m || m[1] === undefined) {
    throw new Error(
      `validate-technical-doc: constant ${name} not found in ${DOC_SCRIPT}. ` +
        "If it was renamed or removed, update validate-technical-doc.ts to match.",
    );
  }
  return Number(m[1]);
}

// ---------------------------------------------------------------------
// Live values from the codebase
// ---------------------------------------------------------------------
const corpusPath = path.join(
  process.env["LAERTIUS_DATA_DIR"]!,
  "laertius_sections.jsonl",
);
const corpusSections = fs
  .readFileSync(corpusPath, "utf8")
  .split("\n")
  .filter((l) => l.trim().length > 0).length;

const claims = getClaims();
const namedAuthorityClaims = claims.filter((c) => c.accordingTo).length;

// BM25 tuning parameters from the live search code.
const bm25Source = fs.readFileSync(
  path.resolve(
    import.meta.dirname,
    "../../artifacts/api-server/src/lib/bm25.ts",
  ),
  "utf8",
);
function bm25Number(name: string): number {
  const m = bm25Source.match(
    new RegExp(`^const ${name} = (\\d+(?:\\.\\d+)?);`, "m"),
  );
  if (!m || m[1] === undefined) {
    throw new Error(
      `validate-technical-doc: could not parse ${name} from bm25.ts; ` +
        "the BM25 tuning check would be vacuous. Update the regex in " +
        "validate-technical-doc.ts to match the new source shape.",
    );
  }
  return Number(m[1]);
}
const bm25K1 = bm25Number("K1");
const bm25B = bm25Number("B");

// ---------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------
const checks: { name: string; doc: number; live: number; source: string }[] = [
  {
    name: "CORPUS_SECTIONS",
    doc: pyConst("CORPUS_SECTIONS"),
    live: corpusSections,
    source: "laertius_sections.jsonl line count",
  },
  {
    name: "KG_EDGES",
    doc: pyConst("KG_EDGES"),
    live: KG_EDGES.length,
    source: "kg.ts KG_EDGES array",
  },
  {
    name: "MOVEMENT_COUNT",
    doc: pyConst("MOVEMENT_COUNT"),
    live: MOVEMENTS.length,
    source: "kg.ts MOVEMENTS array",
  },
  {
    name: "CLAIM_COUNT",
    doc: pyConst("CLAIM_COUNT"),
    live: claims.length,
    source: "kg-claims.ts getClaims()",
  },
  {
    name: "NAMED_AUTHORITY_CLAIMS",
    doc: pyConst("NAMED_AUTHORITY_CLAIMS"),
    live: namedAuthorityClaims,
    source: "claims with accordingTo",
  },
  {
    name: "ANNOTATION_COUNT",
    doc: pyConst("ANNOTATION_COUNT"),
    live: ANNOTATION_PIN_COUNT,
    source: "layer-pins.ts ANNOTATION_PIN_COUNT",
  },
  {
    name: "TAGGED_ENTITIES",
    doc: pyConst("TAGGED_ENTITIES"),
    live: TAGGED_ENTITY_PIN_COUNT,
    source: "layer-pins.ts TAGGED_ENTITY_PIN_COUNT",
  },
  {
    name: "VERSE_COUNT",
    doc: pyConst("VERSE_COUNT"),
    live: VERSE_PIN_COUNT,
    source: "layer-pins.ts VERSE_PIN_COUNT",
  },
  {
    name: "TESTAMENT_COUNT",
    doc: pyConst("TESTAMENT_COUNT"),
    live: TESTAMENT_PIN_COUNT,
    source: "layer-pins.ts TESTAMENT_PIN_COUNT",
  },
  {
    name: "K1",
    doc: pyConst("K1"),
    live: bm25K1,
    source: "bm25.ts const K1",
  },
  {
    name: "B",
    doc: pyConst("B"),
    live: bm25B,
    source: "bm25.ts const B",
  },
  {
    name: "CHAPTER_SUBJECTS",
    doc: pyConst("CHAPTER_SUBJECTS"),
    live: CHAPTER_SUBJECT_PIN_COUNT,
    source: "layer-pins.ts CHAPTER_SUBJECT_PIN_COUNT",
  },
];

// Positive control: every check must have compared a real live count.
if (checks.some((c) => !Number.isFinite(c.live) || c.live <= 0)) {
  throw new Error(
    "validate-technical-doc: a live count came back zero or invalid; " +
      "the comparison would be vacuous. Investigate the source module.",
  );
}

// ---------------------------------------------------------------------
// Approximate triple count: the figure and prose print
// "~{ANNOTATED_TRIPLES_K}k triples" for the annotated LOD export. It is
// an approximation, so an exact checks[] pin would flap on every small
// graph edit; instead require the constant to stay within 10% of the
// live annotated-graph triple count from lod.ts voidStats().
// ---------------------------------------------------------------------
const { voidStats } = await import("../../artifacts/api-server/src/lib/lod");
const liveAnnotatedTriples = voidStats().annotatedTriples;
if (!Number.isFinite(liveAnnotatedTriples) || liveAnnotatedTriples <= 0) {
  throw new Error(
    "validate-technical-doc: voidStats().annotatedTriples came back zero " +
      "or invalid; the ANNOTATED_TRIPLES_K tolerance check would be " +
      "vacuous. Investigate lod.ts.",
  );
}
const docTriples = pyConst("ANNOTATED_TRIPLES_K") * 1000;
const tripleDrift =
  Math.abs(docTriples - liveAnnotatedTriples) / liveAnnotatedTriples;
if (tripleDrift > 0.1) {
  console.error(
    "\nvalidate-technical-doc: ANNOTATED_TRIPLES_K HAS DRIFTED. The doc " +
      `prints "~${pyConst("ANNOTATED_TRIPLES_K")}k triples" (${docTriples}) ` +
      `but the live annotated LOD graph has ${liveAnnotatedTriples} triples ` +
      `(lod.ts voidStats().annotatedTriples), a ${(tripleDrift * 100).toFixed(1)}% ` +
      "difference (tolerance 10%).\n\nFix: set ANNOTATED_TRIPLES_K in " +
      "scripts/generate-technical-doc.py to the live count rounded to the " +
      "nearest thousand, then regenerate the exports.",
  );
  process.exit(1);
}
console.log(
  `ok   ANNOTATED_TRIPLES_K=${pyConst("ANNOTATED_TRIPLES_K")}k is within ` +
    `${(tripleDrift * 100).toFixed(1)}% of the live annotated graph ` +
    `(${liveAnnotatedTriples} triples).`,
);

// ---------------------------------------------------------------------
// Cited module filenames must still exist in the codebase
// ---------------------------------------------------------------------
const MODULE_SEARCH_ROOTS = [
  path.resolve(import.meta.dirname, "../../artifacts/api-server/src/lib"),
  path.resolve(import.meta.dirname, "../../artifacts/laertius/src"),
  path.resolve(import.meta.dirname, ".."), // scripts/ (src + generate-technical-doc.py)
];

function collectFilenames(dir: string, out: Set<string>): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFilenames(full, out);
    else out.add(entry.name);
  }
}

const existingFilenames = new Set<string>();
for (const root of MODULE_SEARCH_ROOTS) collectFilenames(root, existingFilenames);

const citedModules = [
  ...new Set(pySource.match(/[A-Za-z0-9_.-]+\.tsx?\b/g) ?? []),
].sort();

// Positive control: the doc is known to cite many modules; if extraction
// finds almost none, the regex or the doc structure changed.
if (citedModules.length < 10) {
  throw new Error(
    `validate-technical-doc: only ${citedModules.length} module filename(s) ` +
      "extracted from the doc source; the citation check would be vacuous.",
  );
}

const missingModules = citedModules.filter((f) => !existingFilenames.has(f));

for (const f of citedModules) {
  console.log(`${missingModules.includes(f) ? "MISSING" : "ok "}  module cited: ${f}`);
}

// ---------------------------------------------------------------------
// Validator names cited in the doc must exist in scripts/package.json
// ---------------------------------------------------------------------
// The "8.4 Validators" section lists validator bullets of the form
// fmt_bullet("name: description"). Each cited name must correspond to a
// registered script: either the name itself or "validate-<name>" (the doc
// uses the short registered names, e.g. "map-contract", "otb").
const validatorsSectionMatch = pySource.match(
  /fmt_h2\("8\.4 Validators"\)([\s\S]*?)fmt_h2\(/,
);
if (!validatorsSectionMatch || validatorsSectionMatch[1] === undefined) {
  throw new Error(
    "validate-technical-doc: could not find the '8.4 Validators' section in " +
      "the doc source; the validator-name check would be vacuous.",
  );
}
const citedValidators = [
  ...validatorsSectionMatch[1].matchAll(
    /fmt_bullet\("([a-z][a-z0-9-]*):\s/g,
  ),
].map((m) => m[1]!);
if (citedValidators.length < 3) {
  throw new Error(
    `validate-technical-doc: only ${citedValidators.length} validator name(s) ` +
      "extracted from the '8.4 Validators' bullets; the check would be vacuous.",
  );
}

const pkgJson = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, "../package.json"), "utf8"),
) as { scripts?: Record<string, string> };
const pkgScripts = new Set(Object.keys(pkgJson.scripts ?? {}));
if (pkgScripts.size === 0) {
  throw new Error(
    "validate-technical-doc: no scripts found in scripts/package.json; " +
      "the validator-name check would be vacuous.",
  );
}

const badValidators: string[] = [];
for (const name of citedValidators) {
  const registered = pkgScripts.has(name)
    ? name
    : pkgScripts.has(`validate-${name}`)
      ? `validate-${name}`
      : undefined;
  if (registered === undefined) {
    badValidators.push(name);
    console.log(`MISSING  validator cited: ${name} (no matching script)`);
  } else {
    console.log(`ok   validator cited: ${name} -> ${registered}`);
  }
}

// ---------------------------------------------------------------------
// Runnable command names cited anywhere in the doc must be real scripts
// ---------------------------------------------------------------------
// The prose cites runnable commands beyond the 8.4 bullets (e.g. the
// build-embeddings script, build-ionos-bundle, Orval codegen). Extract
// every command-shaped token from the whole doc source and require each
// to be a script registered in scripts/package.json or in some workspace
// package's package.json. A renamed or removed script cited by the doc
// fails here with the offending name.
const COMMAND_PREFIX_RE =
  /\b(?:build|parse|validate|smoke|fetch|check|e2e|audit)-[a-z0-9-]+/g;
// Prose compounds that share a command prefix but are ordinary English,
// not script names. Keep this list exact-match and short.
const PROSE_TOKENS = new Set([
  "smoke-test",
  "smoke-tests",
  "smoke-tested",
  "smoke-testing",
]);
const citedCommands = new Set<string>(
  [...pySource.matchAll(COMMAND_PREFIX_RE)]
    .map((m) => m[0])
    .filter((t) => !PROSE_TOKENS.has(t)),
);
// The doc also cites bare well-known workspace commands.
if (/\bcodegen\b/.test(pySource)) citedCommands.add("codegen");

// Positive control: the doc is known to cite several runnable commands;
// if extraction finds almost none, the regex or the doc prose changed.
if (citedCommands.size < 4) {
  throw new Error(
    `validate-technical-doc: only ${citedCommands.size} command name(s) ` +
      "extracted from the doc source; the command-name check would be vacuous.",
  );
}

// Collect every script name registered across the workspace.
const workspaceScriptNames = new Set<string>(pkgScripts);
const PKG_ROOT = path.resolve(import.meta.dirname, "../..");
const pkgJsonCandidates = [
  path.join(PKG_ROOT, "package.json"),
  ...["lib", "artifacts"].flatMap((dir) => {
    const base = path.join(PKG_ROOT, dir);
    if (!fs.existsSync(base)) return [];
    return fs
      .readdirSync(base, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.join(base, e.name, "package.json"));
  }),
];
for (const pj of pkgJsonCandidates) {
  if (!fs.existsSync(pj)) continue;
  const parsed = JSON.parse(fs.readFileSync(pj, "utf8")) as {
    scripts?: Record<string, string>;
  };
  for (const name of Object.keys(parsed.scripts ?? {})) {
    workspaceScriptNames.add(name);
  }
}
if (workspaceScriptNames.size < 10) {
  throw new Error(
    "validate-technical-doc: suspiciously few workspace scripts collected; " +
      "the command-name check would be vacuous. Investigate package.json paths.",
  );
}

// Guard the extraction itself: the prefix regex above only sees commands
// whose names start with a known prefix (build-, parse-, validate-, ...).
// If future doc prose cites a runnable script whose name falls outside
// those prefixes (say a new "export-..." or "generate-..." script), the
// check above silently skips it and a later rename goes unnoticed. So:
// every hyphenated token in the doc source that exactly equals a
// registered workspace script name must ALSO have been caught by the
// prefix extraction; otherwise fail and ask for a prefix-list update.
const HYPHENATED_TOKEN_RE = /\b[a-z][a-z0-9]*(?:-[a-z0-9]+)+\b/g;
const hyphenatedDocTokens = new Set(
  [...pySource.matchAll(HYPHENATED_TOKEN_RE)].map((m) => m[0]),
);
if (hyphenatedDocTokens.size < 10) {
  throw new Error(
    `validate-technical-doc: only ${hyphenatedDocTokens.size} hyphenated ` +
      "token(s) found in the doc source; the extraction-coverage check " +
      "would be vacuous. Investigate HYPHENATED_TOKEN_RE.",
  );
}
const escapedScriptTokens = [...hyphenatedDocTokens]
  .filter((t) => workspaceScriptNames.has(t))
  .filter((t) => !citedCommands.has(t))
  .sort();
// Positive control: the doc is known to cite many real scripts as
// hyphenated tokens; if the intersection is near-empty, the token regex
// or the doc prose changed and this coverage check is vacuous.
const scriptTokensInDoc = [...hyphenatedDocTokens].filter((t) =>
  workspaceScriptNames.has(t),
);
if (scriptTokensInDoc.length < 4) {
  throw new Error(
    `validate-technical-doc: only ${scriptTokensInDoc.length} hyphenated doc ` +
      "token(s) match a workspace script; the extraction-coverage check " +
      "would be vacuous. Investigate HYPHENATED_TOKEN_RE or the doc prose.",
  );
}
if (escapedScriptTokens.length > 0) {
  console.error(
    `\nvalidate-technical-doc: ${escapedScriptTokens.length} doc token(s) ` +
      "exactly match a registered workspace script but escaped the " +
      "command-name extraction (COMMAND_PREFIX_RE does not cover their prefix):\n" +
      escapedScriptTokens.map((t) => `  - ${t}`).join("\n") +
      "\n\nFix: add the missing prefix to COMMAND_PREFIX_RE in " +
      "scripts/src/validate-technical-doc.ts so renames of this script are " +
      "caught, or rename the script to use a covered prefix.",
  );
  process.exit(1);
}
console.log(
  `ok   extraction coverage: all ${scriptTokensInDoc.length} script-named doc ` +
    "tokens are covered by the prefix extraction.",
);

const badCommands: string[] = [];
for (const name of [...citedCommands].sort()) {
  if (workspaceScriptNames.has(name)) {
    console.log(`ok   command cited: ${name}`);
  } else {
    badCommands.push(name);
    console.log(`MISSING  command cited: ${name} (no matching script)`);
  }
}

// ---------------------------------------------------------------------
// Figure page names must match the app's actual routes
// ---------------------------------------------------------------------
const pagesMatch = pySource.match(/pages\s*=\s*\[([^\]]+)\]/);
if (!pagesMatch || pagesMatch[1] === undefined) {
  throw new Error(
    "validate-technical-doc: could not find the `pages = [...]` list in the doc source.",
  );
}
const docPages = [...pagesMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
if (docPages.length < 5) {
  throw new Error(
    `validate-technical-doc: only ${docPages.length} page name(s) parsed from ` +
      "the figure's pages list; the route check would be vacuous.",
  );
}

// Map each figure page name to the route path that must exist in App.tsx.
const PAGE_ROUTES: Record<string, string> = {
  // The Ask page moved from "/" to "/ask" when the dedicated homepage landed.
  Ask: "/ask",
  Search: "/search",
  Browse: "/browse",
  Section: "/section/:id",
  Graph: "/graph",
  Timeline: "/timeline",
  Map: "/map",
  Terminology: "/terminology",
  About: "/about",
};

const appTsx = fs.readFileSync(
  path.resolve(import.meta.dirname, "../../artifacts/laertius/src/App.tsx"),
  "utf8",
);
const routePaths = new Set(
  [...appTsx.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]!),
);
if (routePaths.size === 0) {
  throw new Error(
    "validate-technical-doc: no <Route path=...> entries found in App.tsx; " +
      "the page/route comparison would be vacuous.",
  );
}

const badPages: string[] = [];
for (const pg of docPages) {
  const route = PAGE_ROUTES[pg];
  if (route === undefined) {
    badPages.push(`${pg} (unknown page name; add it to PAGE_ROUTES if real)`);
    console.log(`MISSING  figure page: ${pg} (no known route mapping)`);
  } else if (!routePaths.has(route)) {
    badPages.push(`${pg} (expected route ${route} not found in App.tsx)`);
    console.log(`MISSING  figure page: ${pg} -> ${route}`);
  } else {
    console.log(`ok   figure page: ${pg} -> ${route}`);
  }
}

const drifted = checks.filter((c) => c.doc !== c.live);

for (const c of checks) {
  const mark = c.doc === c.live ? "ok " : "DRIFT";
  console.log(
    `${mark}  ${c.name}: doc=${c.doc} live=${c.live} (${c.source})`,
  );
}

if (
  missingModules.length > 0 ||
  badPages.length > 0 ||
  badValidators.length > 0 ||
  badCommands.length > 0
) {
  if (missingModules.length > 0) {
    console.error(
      `\nvalidate-technical-doc: ${missingModules.length} module filename(s) cited in ` +
        "scripts/generate-technical-doc.py no longer exist in the codebase:",
    );
    for (const f of missingModules) console.error(`  - ${f}`);
  }
  if (badPages.length > 0) {
    console.error(
      `\nvalidate-technical-doc: ${badPages.length} figure page name(s) do not match ` +
        "the app's routes in artifacts/laertius/src/App.tsx:",
    );
    for (const p of badPages) console.error(`  - ${p}`);
  }
  if (badValidators.length > 0) {
    console.error(
      `\nvalidate-technical-doc: ${badValidators.length} validator name(s) cited in ` +
        "the '8.4 Validators' section of scripts/generate-technical-doc.py have no " +
        "matching script (neither the name nor validate-<name>) in scripts/package.json:",
    );
    for (const v of badValidators) console.error(`  - ${v}`);
  }
  if (badCommands.length > 0) {
    console.error(
      `\nvalidate-technical-doc: ${badCommands.length} command name(s) cited in ` +
        "scripts/generate-technical-doc.py have no matching script in " +
        "scripts/package.json or any workspace package.json:",
    );
    for (const c of badCommands) console.error(`  - ${c}`);
  }
  console.error(
    "\nFix: update the prose/figure in scripts/generate-technical-doc.py " +
      "(or PAGE_ROUTES in validate-technical-doc.ts if a page was legitimately " +
      "renamed), then re-run the generator to rebuild the exports.",
  );
  process.exit(1);
}

if (drifted.length > 0) {
  console.error(
    `\nvalidate-technical-doc: ${drifted.length} constant(s) in ` +
      "scripts/generate-technical-doc.py no longer match the codebase:",
  );
  for (const c of drifted) {
    console.error(
      `  - ${c.name}: document says ${c.doc}, but ${c.source} gives ${c.live}`,
    );
  }
  console.error(
    "\nFix: update the constant(s) in scripts/generate-technical-doc.py, " +
      "then re-run the generator (python3 scripts/generate-technical-doc.py) " +
      "to rebuild exports/laertius-technical-overview.pdf and .docx.",
  );
  process.exit(1);
}

console.log(
  `validate-technical-doc: all ${checks.length} document constants match the codebase.`,
);

// ---------------------------------------------------------------------
// Export freshness: the generated files must not predate the generator
// ---------------------------------------------------------------------
const exportsDir = path.resolve(import.meta.dirname, "../../exports");
const EXPORT_FILES = [
  path.join(exportsDir, "laertius-technical-overview.pdf"),
  path.join(exportsDir, "laertius-technical-overview.docx"),
  path.join(exportsDir, "laertius-arch.png"),
];

const scriptMtime = fs.statSync(DOC_SCRIPT).mtimeMs;
const staleExports: string[] = [];
for (const f of EXPORT_FILES) {
  if (!fs.existsSync(f)) {
    staleExports.push(`${path.basename(f)} (missing)`);
  } else if (fs.statSync(f).mtimeMs < scriptMtime) {
    staleExports.push(
      `${path.basename(f)} (built ${new Date(fs.statSync(f).mtimeMs).toISOString()}, ` +
        `script changed ${new Date(scriptMtime).toISOString()})`,
    );
  }
}
if (staleExports.length > 0) {
  console.error(
    "\nvalidate-technical-doc: STALE EXPORTS. scripts/generate-technical-doc.py " +
      "changed after these files were generated:\n" +
      staleExports.map((s) => `  - ${s}`).join("\n") +
      "\n\nFix: re-run the generator (python3 scripts/generate-technical-doc.py) " +
      "to rebuild the exports in exports/.",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------
// Embedded numbers: distinctive constants must appear in the export text
// ---------------------------------------------------------------------
// Only constants large enough to be unambiguous in prose; small values
// (6, 17, 82...) appear everywhere and would make the check vacuous.
const embeddedChecks = checks.filter((c) => c.doc >= 100);
if (embeddedChecks.length < 4) {
  throw new Error(
    "validate-technical-doc: fewer than 4 constants qualify for the " +
      "embedded-number check; the guard would be vacuous. Investigate.",
  );
}

const pdfText = execFileSync(
  "pdftotext",
  [path.join(exportsDir, "laertius-technical-overview.pdf"), "-"],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);

const docxXml = execFileSync(
  "unzip",
  ["-p", path.join(exportsDir, "laertius-technical-overview.docx"), "word/document.xml"],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);
// Join the runs' text content so numbers split across XML tags still match.
const docxText = [...docxXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
  .map((m) => m[1])
  .join("");
if (docxText.length < 1000) {
  throw new Error(
    "validate-technical-doc: extracted DOCX body text is suspiciously short; " +
      "the embedded-number check would be vacuous. Investigate the DOCX.",
  );
}

const missing: { name: string; value: number; where: string }[] = [];
for (const c of embeddedChecks) {
  const re = new RegExp(`(?<!\\d)${c.doc}(?!\\d)`);
  if (!re.test(pdfText)) missing.push({ name: c.name, value: c.doc, where: "PDF" });
  if (!re.test(docxText)) missing.push({ name: c.name, value: c.doc, where: "DOCX" });
}
// ---------------------------------------------------------------------
// Small-constant phrases: values < 100 (6, 17, 82) are too ambiguous to
// grep as bare numbers, so pin the distinctive prose phrase each one is
// printed in. Prose phrases are checked in the rendered PDF and DOCX
// text; the figure-only phrase (TESTAMENT_COUNT lives inside the
// architecture PNG, invisible to pdftotext) is pinned against the
// generator source f-string instead, so a removed or reworded phrase in
// generate-technical-doc.py still fails here.
// ---------------------------------------------------------------------
function docValue(name: string): number {
  const c = checks.find((x) => x.name === name);
  if (!c) throw new Error(`validate-technical-doc: no check named ${name}`);
  return c.doc;
}

const PROSE_PHRASES: { name: string; phrase: string }[] = [
  {
    // Tuning parameter, not a layer count: no live comparison in checks[],
    // so pin the distinctive prose it is printed in.
    name: "RRF_K",
    phrase: `with k = ${pyConst("RRF_K")}`,
  },
  {
    name: "POOL",
    phrase: `top-${pyConst("POOL")} by cosine score`,
  },
  {
    name: "KG_EDGES",
    phrase: `${docValue("KG_EDGES")} curated directed edges`,
  },
  {
    // Section 2.1 prose interpolates the BM25 tuning constants.
    name: "K1",
    phrase: `Parameters (from bm25.ts): K1 = ${docValue("K1")}, B = ${docValue("B")}`,
  },
  {
    // Section 9.1 references prose interpolates them too.
    name: "B",
    phrase: `Parameters K1=${docValue("K1")}, B=${docValue("B")} follow the BM25F defaults`,
  },
  {
    name: "MOVEMENT_COUNT",
    phrase: `${docValue("MOVEMENT_COUNT")} philosophical movements are modelled`,
  },
  {
    name: "CHAPTER_SUBJECTS",
    phrase: `${docValue("CHAPTER_SUBJECTS")} philosophers who have a Life in the corpus`,
  },
];

// Figure-only phrases: pinned in the generator source (constant name must
// still be interpolated right before the phrase text).
const SOURCE_PHRASES: { name: string; pattern: RegExp; describe: string }[] = [
  {
    // The architecture figure box must interpolate the constants, never
    // hard-code "K1=1.5, B=0.75" as literal text.
    name: "K1",
    pattern: /K1=\{K1\}, B=\{B\}/,
    describe: 'f"...K1={K1}, B={B}..." in the architecture figure box',
  },
  {
    name: "TESTAMENT_COUNT",
    pattern: /\{TESTAMENT_COUNT\}\s+wills verbatim/,
    describe: 'f"...{TESTAMENT_COUNT} wills verbatim" in the architecture figure',
  },
];

// Positive control: the phrase guard must cover every small constant the
// exports print. If a constant drops below this list, the check is vacuous.
const smallConstants = checks.filter((c) => c.doc < 100).map((c) => c.name);
const coveredSmall = new Set([
  ...PROSE_PHRASES.map((p) => p.name),
  ...SOURCE_PHRASES.map((p) => p.name),
]);
const uncovered = smallConstants.filter((n) => !coveredSmall.has(n));
if (uncovered.length > 0) {
  throw new Error(
    "validate-technical-doc: small constant(s) with no phrase check: " +
      uncovered.join(", ") +
      ". Add a distinctive phrase for each to PROSE_PHRASES or SOURCE_PHRASES.",
  );
}

// ---------------------------------------------------------------------
// Interpolated small constants: a brand-new small number in the generator
// must not ship without a phrase pin. The check above only covers
// constants that are already in checks[]; a NEW integer constant under
// 100 that is interpolated into prose or figure text (f-string {NAME})
// but never joins checks[] would otherwise get no phrase pin and no
// live-value comparison at all. Scan the generator source for such
// constants and require each to be covered by checks[] or a phrase list.
// ---------------------------------------------------------------------
const INT_CONST_RE = /^([A-Z][A-Z0-9_]*)\s*=\s*(\d+)\s*(?:#.*)?$/gm;
const checkNames = new Set(checks.map((c) => c.name));
const interpolatedSmall: string[] = [];
for (const m of pySource.matchAll(INT_CONST_RE)) {
  const [, name, value] = m as unknown as [string, string, string];
  if (Number(value) >= 100) continue;
  if (!pySource.includes(`{${name}}`)) continue; // never interpolated
  interpolatedSmall.push(name);
}
// Positive control: the generator is known to interpolate several small
// constants (RRF_K, POOL, KG_EDGES, TESTAMENT_COUNT, ...); if the scan
// finds almost none, the constant regex or the source layout changed.
if (interpolatedSmall.length < 4) {
  throw new Error(
    `validate-technical-doc: only ${interpolatedSmall.length} interpolated ` +
      "small constant(s) found in generate-technical-doc.py; the new-number " +
      "scan would be vacuous. Investigate INT_CONST_RE.",
  );
}
const unpinnedSmall = interpolatedSmall.filter(
  (n) => !checkNames.has(n) && !coveredSmall.has(n),
);
if (unpinnedSmall.length > 0) {
  console.error(
    "\nvalidate-technical-doc: NEW SMALL CONSTANT WITHOUT A PHRASE PIN. " +
      "These integer constants under 100 are interpolated into the doc " +
      "(f-string {NAME}) but appear in neither checks[] nor the phrase lists, " +
      "so nothing would catch them drifting or vanishing:\n" +
      unpinnedSmall.map((n) => `  - ${n}`).join("\n") +
      "\n\nFix: in scripts/src/validate-technical-doc.ts, either add the " +
      "constant to checks[] with a live source of truth, or pin the " +
      "distinctive phrase it is printed in via PROSE_PHRASES/SOURCE_PHRASES.",
  );
  process.exit(1);
}
for (const n of interpolatedSmall) {
  console.log(
    `ok   interpolated small constant covered: ${n} (${
      checkNames.has(n) ? "checks[]" : "phrase pin"
    })`,
  );
}

// ---------------------------------------------------------------------
// Numbers hidden inside string constants: the generator defines string
// constants that embed numeric fragments (e.g. KG_MATCHED = "0.5 / 60",
// which hard-codes the RRF k divisor inside a quoted string). None of
// the checks above see inside strings, so if rag.ts changes its boost
// numerator or RRF_K, these strings drift silently. Parse the live
// values from rag.ts and require each pinned string constant to embed
// exactly those numbers; then scan the verified-constants block for any
// OTHER string constant with a standalone number and demand a pin.
// ---------------------------------------------------------------------
const ragSource = fs.readFileSync(
  path.resolve(
    import.meta.dirname,
    "../../artifacts/api-server/src/lib/rag.ts",
  ),
  "utf8",
);
function ragNumber(re: RegExp, what: string): string {
  const m = ragSource.match(re);
  if (!m || m[1] === undefined) {
    throw new Error(
      `validate-technical-doc: could not parse ${what} from rag.ts; ` +
        "the string-embedded-number check would be vacuous. Update the " +
        "regex in validate-technical-doc.ts to match the new source shape.",
    );
  }
  return m[1];
}
// rag.ts now centralises the tuned fusion constants in DEFAULT_FUSION_PARAMS
// (weighted RRF; see gold-eval-v0.5-fusion-tuning.md).
const ragRrfK = ragNumber(/^\s*rrfK: (\d+),/m, "DEFAULT_FUSION_PARAMS.rrfK");
const ragMatchedNumerator = ragNumber(
  /^\s*kgMatchedBoost: (\d+(?:\.\d+)?) \/ \d+,/m,
  "DEFAULT_FUSION_PARAMS.kgMatchedBoost numerator",
);
const ragRelatedNumerator = ragNumber(
  /^\s*kgRelatedBoost: (\d+(?:\.\d+)?) \/ \d+,/m,
  "DEFAULT_FUSION_PARAMS.kgRelatedBoost numerator",
);
// The boost divisors must stay in lockstep with rrfK, or the "numerator / k"
// doc strings below would silently mispin.
const ragMatchedDivisor = ragNumber(
  /^\s*kgMatchedBoost: \d+(?:\.\d+)? \/ (\d+),/m,
  "DEFAULT_FUSION_PARAMS.kgMatchedBoost divisor",
);
const ragRelatedDivisor = ragNumber(
  /^\s*kgRelatedBoost: \d+(?:\.\d+)? \/ (\d+),/m,
  "DEFAULT_FUSION_PARAMS.kgRelatedBoost divisor",
);
if (ragMatchedDivisor !== ragRrfK || ragRelatedDivisor !== ragRrfK) {
  throw new Error(
    `validate-technical-doc: KG boost divisors (${ragMatchedDivisor}, ${ragRelatedDivisor}) ` +
      `do not match DEFAULT_FUSION_PARAMS.rrfK (${ragRrfK}) in rag.ts.`,
  );
}

function pyStrConst(name: string): string {
  const m = pySource.match(
    new RegExp(`^${name}\\s*=\\s*"([^"]*)"`, "m"),
  );
  if (!m || m[1] === undefined) {
    throw new Error(
      `validate-technical-doc: string constant ${name} not found in ${DOC_SCRIPT}. ` +
        "If it was renamed or removed, update STRING_CONST_PINS in " +
        "validate-technical-doc.ts to match.",
    );
  }
  return m[1];
}

const STRING_CONST_PINS: { name: string; expected: string; source: string }[] = [
  {
    name: "KG_MATCHED",
    expected: `${ragMatchedNumerator} / ${ragRrfK}`,
    source: "rag.ts KG_MATCHED_BOOST numerator / RRF_K",
  },
  {
    name: "KG_RELATED",
    expected: `${ragRelatedNumerator} / ${ragRrfK}`,
    source: "rag.ts KG_RELATED_BOOST numerator / RRF_K",
  },
];

const stringDrift: { name: string; doc: string; expected: string; source: string }[] =
  [];
for (const pin of STRING_CONST_PINS) {
  const doc = pyStrConst(pin.name);
  if (doc !== pin.expected) {
    stringDrift.push({ name: pin.name, doc, expected: pin.expected, source: pin.source });
  }
}
// The generator's own RRF_K must agree with rag.ts too, or the string
// pin above could pass while the interpolated prose (k = {RRF_K}) drifts.
if (pyConst("RRF_K") !== Number(ragRrfK)) {
  stringDrift.push({
    name: "RRF_K",
    doc: String(pyConst("RRF_K")),
    expected: ragRrfK,
    source: "rag.ts RRF_K",
  });
}
if (stringDrift.length > 0) {
  console.error(
    "\nvalidate-technical-doc: NUMBER EMBEDDED IN A STRING CONSTANT DRIFTED. " +
      "These generator constants hard-code numbers inside quoted strings that " +
      "no longer match the codebase:\n" +
      stringDrift
        .map(
          (d) =>
            `  - ${d.name}: document says "${d.doc}", but ${d.source} gives "${d.expected}"`,
        )
        .join("\n") +
      "\n\nFix: update the constant(s) in scripts/generate-technical-doc.py, " +
      "then re-run the generator (python3 scripts/generate-technical-doc.py) " +
      "to rebuild the exports.",
  );
  process.exit(1);
}
for (const pin of STRING_CONST_PINS) {
  console.log(`ok   string constant: ${pin.name} = "${pin.expected}" (${pin.source})`);
}
console.log(`ok   string constant: RRF_K denominator agrees with rag.ts (${ragRrfK})`);

// ---------------------------------------------------------------------
// Embedding model / dimension pins: the generator's EMBED_MODEL,
// EMBED_DIM, and EMBED_DTYPE constants feed the prose and the
// architecture figure, but nothing above compares them to the live
// embedding stack. Parse the default model and dtype from embedder.ts
// and the vector dimension from the built embedding index, and fail
// naming the constant when any of them drifts.
// ---------------------------------------------------------------------
const embedderSource = fs.readFileSync(
  path.resolve(
    import.meta.dirname,
    "../../artifacts/api-server/src/lib/embedder.ts",
  ),
  "utf8",
);
function embedderFragment(re: RegExp, what: string): string {
  const m = embedderSource.match(re);
  if (!m || m[1] === undefined) {
    throw new Error(
      `validate-technical-doc: could not parse ${what} from embedder.ts; ` +
        "the embedding-model pin would be vacuous. Update the regex in " +
        "validate-technical-doc.ts to match the new source shape.",
    );
  }
  return m[1];
}
const liveEmbedModel = embedderFragment(
  /process\.env\["EMBEDDING_MODEL"\]\s*\?\?\s*"([^"]+)"/,
  "default EMBEDDING_MODEL",
);
const liveEmbedDtype = embedderFragment(
  /dtype:\s*"([^"]+)"/,
  "pipeline dtype",
);
const embedIndexPath = path.resolve(
  process.env["LAERTIUS_DATA_DIR"]!,
  "embedding-index.json",
);
const embedIndex = JSON.parse(fs.readFileSync(embedIndexPath, "utf8")) as {
  model?: string;
  dim?: number;
};
if (typeof embedIndex.dim !== "number" || embedIndex.dim <= 0) {
  throw new Error(
    "validate-technical-doc: embedding-index.json has no positive numeric " +
      "'dim'; the EMBED_DIM pin would be vacuous. Rebuild the index or " +
      "update validate-technical-doc.ts.",
  );
}
const embedDrift: { name: string; doc: string; expected: string; source: string }[] = [];
if (pyStrConst("EMBED_MODEL") !== liveEmbedModel) {
  embedDrift.push({
    name: "EMBED_MODEL",
    doc: pyStrConst("EMBED_MODEL"),
    expected: liveEmbedModel,
    source: "embedder.ts default EMBEDDING_MODEL",
  });
}
if (pyStrConst("EMBED_DTYPE") !== liveEmbedDtype) {
  embedDrift.push({
    name: "EMBED_DTYPE",
    doc: pyStrConst("EMBED_DTYPE"),
    expected: liveEmbedDtype,
    source: "embedder.ts pipeline dtype",
  });
}
if (pyConst("EMBED_DIM") !== embedIndex.dim) {
  embedDrift.push({
    name: "EMBED_DIM",
    doc: String(pyConst("EMBED_DIM")),
    expected: String(embedIndex.dim),
    source: "embedding-index.json dim",
  });
}
if (embedIndex.model !== undefined && embedIndex.model !== liveEmbedModel) {
  embedDrift.push({
    name: "EMBED_MODEL (index)",
    doc: embedIndex.model,
    expected: liveEmbedModel,
    source:
      "embedding-index.json was built with a different model than embedder.ts defaults to",
  });
}
if (embedDrift.length > 0) {
  console.error(
    "\nvalidate-technical-doc: EMBEDDING CONSTANT DRIFTED. The generator's " +
      "embedding constants no longer match the live embedding stack:\n" +
      embedDrift
        .map(
          (d) =>
            `  - ${d.name}: document says "${d.doc}", but ${d.source} gives "${d.expected}"`,
        )
        .join("\n") +
      "\n\nFix: update the constant(s) in scripts/generate-technical-doc.py, " +
      "then re-run the generator (python3 scripts/generate-technical-doc.py) " +
      "to rebuild the exports.",
  );
  process.exit(1);
}
console.log(
  `ok   embedding pins: EMBED_MODEL="${liveEmbedModel}", ` +
    `EMBED_DTYPE="${liveEmbedDtype}", EMBED_DIM=${embedIndex.dim} agree with the live stack`,
);

// ---------------------------------------------------------------------
// Figure interpolation pins: the architecture figure once hard-coded
// "KG Boost\n+0.5/60 matched" and "Dense\nE5-small q8\n384-dim cosine"
// as literal strings, bypassing every constant check above. Require the
// figure box source lines to interpolate the pinned constants, so a
// retune cannot ship a figure PNG with stale numbers.
// ---------------------------------------------------------------------
const FIGURE_INTERPOLATIONS: { name: string; fragment: string }[] = [
  { name: "KG_MATCHED", fragment: `+{KG_MATCHED.replace(' ', '')} matched` },
  { name: "KG_RELATED", fragment: `+{KG_RELATED.replace(' ', '')} related` },
  { name: "EMBED_SHORT/EMBED_DTYPE", fragment: "{EMBED_SHORT} {EMBED_DTYPE}" },
  { name: "EMBED_DIM", fragment: "{EMBED_DIM}-dim cosine" },
  { name: "RRF_K/POOL", fragment: "k={RRF_K}, pool={POOL}" },
  {
    name: "ANNOTATED_TRIPLES_K",
    fragment: "(~{ANNOTATED_TRIPLES_K}k triples",
  },
];
const missingInterpolations = FIGURE_INTERPOLATIONS.filter(
  (f) => !pySource.includes(f.fragment),
);
if (missingInterpolations.length > 0) {
  console.error(
    "\nvalidate-technical-doc: ARCHITECTURE FIGURE NO LONGER INTERPOLATES A " +
      "PINNED CONSTANT. These figure fragments were not found in " +
      "generate-technical-doc.py, so the figure may hard-code the number " +
      "as a literal string again:\n" +
      missingInterpolations
        .map((f) => `  - ${f.name}: expected source fragment "${f.fragment}"`)
        .join("\n") +
      "\n\nFix: keep the figure box text as an f-string interpolating the " +
      "constant, or update FIGURE_INTERPOLATIONS in validate-technical-doc.ts " +
      "if the formatting deliberately changed.",
  );
  process.exit(1);
}
console.log(
  `ok   figure interpolation: all ${FIGURE_INTERPOLATIONS.length} pinned ` +
    "constants are interpolated into the architecture figure source.",
);

// Coverage: any string constant in the verified-constants block that
// embeds a standalone number must have a pin above, or a NEW quoted
// number would ship unchecked exactly like KG_MATCHED once did.
const blockStart = pySource.indexOf("Verified constants from the codebase");
const blockEnd = pySource.indexOf("1. Architecture figure");
if (blockStart < 0 || blockEnd < 0 || blockEnd <= blockStart) {
  throw new Error(
    "validate-technical-doc: could not locate the verified-constants block " +
      "in generate-technical-doc.py; the string-number coverage scan would " +
      "be vacuous. Update the block markers in validate-technical-doc.ts.",
  );
}
const constBlock = pySource.slice(blockStart, blockEnd);
const STANDALONE_NUMBER_RE = /(?<![\w.])\d+(?:\.\d+)?(?![\w.])/g;
const pinnedStringNames = new Set(STRING_CONST_PINS.map((p) => p.name));
let pinnedNumericFragments = 0;
const unpinnedStrings: string[] = [];
for (const m of constBlock.matchAll(
  /^([A-Z][A-Z0-9_]*)\s*=\s*"([^"]*)"/gm,
)) {
  const [, name, value] = m as unknown as [string, string, string];
  const numbers = value.match(STANDALONE_NUMBER_RE) ?? [];
  if (numbers.length === 0) continue;
  if (pinnedStringNames.has(name)) {
    pinnedNumericFragments += numbers.length;
  } else {
    unpinnedStrings.push(`${name} = "${value}" (embeds ${numbers.join(", ")})`);
  }
}
// Positive control: KG_MATCHED and KG_RELATED are known to embed four
// numeric fragments between them; if the scan sees fewer, the regex or
// the source layout changed and this guard is vacuous.
if (pinnedNumericFragments < 4) {
  throw new Error(
    `validate-technical-doc: only ${pinnedNumericFragments} numeric ` +
      "fragment(s) found inside pinned string constants; the string-number " +
      "scan would be vacuous. Investigate STANDALONE_NUMBER_RE or the block markers.",
  );
}
if (unpinnedStrings.length > 0) {
  console.error(
    "\nvalidate-technical-doc: STRING CONSTANT WITH AN UNPINNED NUMBER. " +
      "These quoted constants in the verified-constants block embed numbers " +
      "that nothing cross-checks against the codebase:\n" +
      unpinnedStrings.map((s) => `  - ${s}`).join("\n") +
      "\n\nFix: add each constant to STRING_CONST_PINS in " +
      "scripts/src/validate-technical-doc.ts with a live source of truth.",
  );
  process.exit(1);
}
console.log(
  `ok   string-number coverage: all ${pinnedNumericFragments} numeric fragments ` +
    "inside quoted constants are pinned to live sources.",
);

// Normalize whitespace so line wraps in pdftotext output do not break
// multi-word phrase matches.
const pdfProse = pdfText.replace(/\s+/g, " ");
const docxProse = docxText.replace(/\s+/g, " ");

const missingPhrases: { name: string; detail: string }[] = [];
for (const p of PROSE_PHRASES) {
  if (!pdfProse.includes(p.phrase)) {
    missingPhrases.push({
      name: p.name,
      detail: `phrase "${p.phrase}" not found in the PDF text`,
    });
  }
  if (!docxProse.includes(p.phrase)) {
    missingPhrases.push({
      name: p.name,
      detail: `phrase "${p.phrase}" not found in the DOCX text`,
    });
  }
}
for (const p of SOURCE_PHRASES) {
  if (!p.pattern.test(pySource)) {
    missingPhrases.push({
      name: p.name,
      detail: `generator source no longer contains ${p.describe}`,
    });
  }
}
if (missingPhrases.length > 0) {
  console.error(
    "\nvalidate-technical-doc: SMALL-CONSTANT PHRASE DRIFT. The exports " +
      "print these small constants inside distinctive phrases, and a pinned " +
      "phrase is gone (the prose was removed or reworded, or the export is stale):\n" +
      missingPhrases.map((m) => `  - ${m.name}: ${m.detail}`).join("\n") +
      "\n\nFix: if the prose in scripts/generate-technical-doc.py was reworded " +
      "deliberately, update PROSE_PHRASES/SOURCE_PHRASES in " +
      "validate-technical-doc.ts to the new wording; then re-run the generator " +
      "(python3 scripts/generate-technical-doc.py) to rebuild the exports.",
  );
  process.exit(1);
}
for (const p of PROSE_PHRASES) {
  console.log(`ok   phrase (PDF+DOCX): ${p.name} -> "${p.phrase}"`);
}
for (const p of SOURCE_PHRASES) {
  console.log(`ok   phrase (source): ${p.name} -> ${p.describe}`);
}

if (missing.length > 0) {
  console.error(
    "\nvalidate-technical-doc: STALE EXPORT CONTENT. These constants are " +
      "correct in generate-technical-doc.py but absent from the export text, " +
      "so the shipped file still carries old numbers:\n" +
      missing
        .map((m) => `  - ${m.name} = ${m.value} not found in the ${m.where}`)
        .join("\n") +
      "\n\nFix: re-run the generator (python3 scripts/generate-technical-doc.py) " +
      "to rebuild exports/laertius-technical-overview.pdf and .docx.",
  );
  process.exit(1);
}

console.log(
  `validate-technical-doc: exports are fresh (newer than the generator) and ` +
    `all ${embeddedChecks.length} distinctive constants appear in both the PDF and DOCX text.`,
);
