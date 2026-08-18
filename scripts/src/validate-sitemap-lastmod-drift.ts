/**
 * validate-sitemap-lastmod-drift — keeps validate-sitemap-section-isolation's
 * positive control honest as the code evolves.
 *
 * That validator builds its positive control by textually rewriting copies of
 * update-sitemap-lastmod.ts and sitemap-lastmod.ts: it swaps the updater's
 * import specifier for the library, relocates the library's relative imports,
 * and breaks the per-section hash expression. A rename/move of either file
 * would make it crash instead of degrading gracefully, and a refactor that
 * keeps the markers but changes semantics would silently weaken the control.
 *
 * This check asserts, cheaply and with clear messages:
 *  1. Both files still live at the expected paths.
 *  2. The updater still imports the library via the exact specifier the
 *     positive control rewrites, and the library still uses the relative
 *     imports ("./corpus", "./otb/build") the control relocates.
 *  3. The per-section hash expression the control breaks still exists and
 *     still lives inside currentSectionHashes().
 *  4. Semantics: currentSectionHashes() really hashes each section on its
 *     own — every id's hash equals sha256(JSON.stringify(section)) recomputed
 *     independently, and hashes are not all identical (the whole-corpus
 *     regression).
 *  5. Positive controls: mutated copies of the sources (moved import,
 *     rewritten hash expression) and a synthetic whole-corpus hash map must
 *     each be flagged, proving none of the checks are vacuous.
 *
 * Run: pnpm --filter @workspace/scripts run validate-sitemap-lastmod-drift
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const libPath = path.resolve(
  repoRoot,
  "artifacts/api-server/src/lib/sitemap-lastmod.ts",
);
const updaterPath = path.resolve(here, "update-sitemap-lastmod.ts");
const isolationValidatorPath = path.resolve(
  here,
  "validate-sitemap-section-isolation.ts",
);

// The exact markers validate-sitemap-section-isolation rewrites when it
// builds its broken positive-control copies. If any of these drift, that
// validator either crashes or (worse) keeps passing with a weakened control.
const UPDATER_IMPORT_SPEC =
  '"../../artifacts/api-server/src/lib/sitemap-lastmod"';
const LIB_CORPUS_IMPORT = 'from "./corpus"';
const LIB_OTB_IMPORT = 'from "./otb/build"';
const PER_SECTION_HASH_EXPR = "sha256(JSON.stringify(s))";

let failures = 0;
function fail(msg: string): void {
  failures++;
  console.error(`FAIL: ${msg}`);
}
function ok(msg: string): void {
  console.log(`ok: ${msg}`);
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

// ------------------------------------------------------------ marker checks
/**
 * Static drift problems for a given (updater source, lib source) pair.
 * Empty array = layout still matches what the isolation validator rewrites.
 */
function markerProblems(updaterSrc: string, libSrc: string): string[] {
  const problems: string[] = [];
  if (!updaterSrc.includes(UPDATER_IMPORT_SPEC)) {
    problems.push(
      `update-sitemap-lastmod.ts no longer imports the library via ${UPDATER_IMPORT_SPEC} — validate-sitemap-section-isolation's positive control rewrites that exact specifier`,
    );
  }
  if (!libSrc.includes(LIB_CORPUS_IMPORT)) {
    problems.push(
      `sitemap-lastmod.ts no longer imports ${LIB_CORPUS_IMPORT} — the positive control relocates that import when copying the library`,
    );
  }
  if (!libSrc.includes(LIB_OTB_IMPORT)) {
    problems.push(
      `sitemap-lastmod.ts no longer imports ${LIB_OTB_IMPORT} — the positive control relocates that import when copying the library`,
    );
  }
  const fnStart = libSrc.indexOf("function currentSectionHashes(");
  if (fnStart === -1) {
    problems.push(
      "sitemap-lastmod.ts no longer defines currentSectionHashes() — the per-section manifest and its validator depend on it",
    );
  } else {
    const fnEnd = libSrc.indexOf("\n}", fnStart);
    const body = libSrc.slice(fnStart, fnEnd === -1 ? undefined : fnEnd);
    if (!body.includes(PER_SECTION_HASH_EXPR)) {
      problems.push(
        `currentSectionHashes() no longer contains ${PER_SECTION_HASH_EXPR} — the positive control breaks that exact expression, so it must live inside the per-section hasher`,
      );
    }
  }
  return problems;
}

// --------------------------------------------------------- semantic checks
/**
 * Problems with the live per-section hash map: every hash must equal an
 * independently recomputed sha256(JSON.stringify(section)), and the map must
 * not collapse to a single value (the whole-corpus regression).
 */
function semanticProblems(
  hashes: Record<string, string>,
  sections: ReadonlyArray<{ id: string }>,
): string[] {
  const problems: string[] = [];
  if (Object.keys(hashes).length !== sections.length) {
    problems.push(
      `currentSectionHashes() returned ${Object.keys(hashes).length} entries for ${sections.length} corpus sections`,
    );
  }
  if (new Set(Object.values(hashes)).size <= 1 && sections.length > 1) {
    problems.push(
      "all section hashes are identical — currentSectionHashes() is not hashing per-section",
    );
  }
  let mismatches = 0;
  for (const s of sections) {
    const expected = sha256(JSON.stringify(s));
    if (hashes[s.id] !== expected) mismatches++;
  }
  if (mismatches > 0) {
    problems.push(
      `${mismatches} section hash(es) differ from independently recomputed sha256(JSON.stringify(section)) — the hashing semantics drifted`,
    );
  }
  return problems;
}

// -------------------------------------------------------------------- main
try {
  // 1. Files still where the isolation validator expects them.
  for (const [label, p] of [
    ["update-sitemap-lastmod.ts", updaterPath],
    ["sitemap-lastmod.ts", libPath],
    ["validate-sitemap-section-isolation.ts", isolationValidatorPath],
  ] as const) {
    if (!existsSync(p)) {
      throw new Error(`${label} is missing at ${p} — the file layout moved`);
    }
  }
  ok("updater, library, and isolation validator are at their expected paths");

  const updaterSrc = readFileSync(updaterPath, "utf-8");
  const libSrc = readFileSync(libPath, "utf-8");

  // Guard against this validator itself drifting from the isolation
  // validator's markers: the strings we pin must be the ones it rewrites.
  const isolationSrc = readFileSync(isolationValidatorPath, "utf-8");
  for (const marker of [
    UPDATER_IMPORT_SPEC,
    PER_SECTION_HASH_EXPR,
    LIB_CORPUS_IMPORT.replace("from ", ""),
    LIB_OTB_IMPORT.replace("from ", ""),
  ]) {
    if (!isolationSrc.includes(marker)) {
      fail(
        `validate-sitemap-section-isolation.ts no longer references ${marker} — its positive control changed; update this drift check to match`,
      );
    }
  }
  if (failures === 0) {
    ok("isolation validator still rewrites the same markers this check pins");
  }

  // 2 & 3. Static markers.
  const staticProblems = markerProblems(updaterSrc, libSrc);
  if (staticProblems.length === 0) {
    ok("import specifiers and per-section hash expression are unchanged");
  } else {
    for (const p of staticProblems) fail(p);
  }

  // Positive control for the marker checks: mutated copies must be flagged.
  const movedUpdater = updaterSrc.replace(
    UPDATER_IMPORT_SPEC,
    '"../lib/sitemap-lastmod"',
  );
  const rewrittenLib = libSrc.replace(
    PER_SECTION_HASH_EXPR,
    "sha256(JSON.stringify(corpus))",
  );
  const controlA = markerProblems(movedUpdater, libSrc);
  const controlB = markerProblems(updaterSrc, rewrittenLib);
  if (controlA.length > 0 && controlB.length > 0) {
    ok(
      `positive control: moved import flagged ("${controlA[0]}"); rewritten hash expression flagged ("${controlB[0]}")`,
    );
  } else {
    fail(
      `positive control: marker checks did NOT flag mutated sources (moved import: ${controlA.length} problem(s), rewritten hash: ${controlB.length} problem(s))`,
    );
  }

  // 4. Semantics of the live library.
  process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
    repoRoot,
    "artifacts/api-server/data",
  );
  const lib = await import("../../artifacts/api-server/src/lib/sitemap-lastmod");
  const { corpus } = await import("../../artifacts/api-server/src/lib/corpus");
  const liveHashes = lib.currentSectionHashes();
  const liveProblems = semanticProblems(liveHashes, corpus);
  if (liveProblems.length === 0) {
    ok(
      `currentSectionHashes() hashes all ${corpus.length} sections individually, matching independent recomputation`,
    );
  } else {
    for (const p of liveProblems) fail(p);
  }

  // 5. Positive control for the semantic check: a whole-corpus hash map
  //    (every id -> the same hash) must be flagged.
  const collapsed = sha256(JSON.stringify(corpus));
  const brokenHashes: Record<string, string> = {};
  for (const s of corpus) brokenHashes[s.id] = collapsed;
  const controlC = semanticProblems(brokenHashes, corpus);
  if (controlC.length > 0) {
    ok(
      `positive control: whole-corpus hash map flagged (${controlC.length} problem(s), e.g. "${controlC[0]}")`,
    );
  } else {
    fail(
      "positive control: semantic check did NOT flag a whole-corpus hash map",
    );
  }
} catch (err) {
  fail(String(err instanceof Error ? (err.stack ?? err.message) : err));
}

if (failures > 0) {
  console.error(`validate-sitemap-lastmod-drift: ${failures} failure(s)`);
  process.exit(1);
}
console.log("validate-sitemap-lastmod-drift: all checks passed");
export {};
