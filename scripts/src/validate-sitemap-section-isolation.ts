/**
 * validate-sitemap-section-isolation — proves the end-to-end promise of the
 * per-section sitemap lastmod manifest: editing ONE section's text and
 * re-running update-sitemap-lastmod bumps exactly that section's date and
 * leaves every other section's date untouched, drops orphaned ids, and keeps
 * unchanged entries byte-identical.
 *
 * How it works:
 *  1. Builds a temp data dir (symlinks to the real data files, private copies
 *     of laertius_sections.jsonl and both lastmod manifests).
 *  2. Runs the real updater once to sync hashes, then rewrites every section
 *     date to a sentinel (2000-01-01) so any rewrite is detectable.
 *  3. Mutates one section's Greek text and deletes another section entirely,
 *     re-runs the updater, and asserts: exactly one date changed (to today),
 *     all other dates still carry the sentinel, the deleted id is gone, and
 *     unchanged entries kept their exact hashes.
 *  4. Positive control: the same scenario is re-run through a deliberately
 *     broken build of the library whose currentSectionHashes() hashes the
 *     WHOLE corpus per section (the regression this validator exists to
 *     catch). The assertion suite must flag that run, proving the checks are
 *     not vacuous.
 *
 * Run: pnpm --filter @workspace/scripts run validate-sitemap-section-isolation
 */
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const scriptsDir = path.resolve(here, "..");
const realDataDir = path.resolve(repoRoot, "artifacts/api-server/data");
const libPath = path.resolve(
  repoRoot,
  "artifacts/api-server/src/lib/sitemap-lastmod.ts",
);
const updaterPath = path.resolve(here, "update-sitemap-lastmod.ts");

const SENTINEL = "2000-01-01";
const today = new Date().toISOString().slice(0, 10);

let failures = 0;
function fail(msg: string): void {
  failures++;
  console.error(`FAIL: ${msg}`);
}
function ok(msg: string): void {
  console.log(`ok: ${msg}`);
}

interface SectionManifest {
  [id: string]: { hash: string; date: string };
}

// ------------------------------------------------------------ temp data dir
const COPIED = new Set([
  "laertius_sections.jsonl",
  "sitemap-lastmod.json",
  "sitemap-lastmod-sections.json",
]);

const tempDataDir = mkdtempSync(
  path.join(tmpdir(), "sitemap-section-isolation-"),
);
for (const entry of readdirSync(realDataDir)) {
  const src = path.join(realDataDir, entry);
  const dst = path.join(tempDataDir, entry);
  if (COPIED.has(entry)) copyFileSync(src, dst);
  else symlinkSync(src, dst);
}

const jsonlPath = path.join(tempDataDir, "laertius_sections.jsonl");
const sectionsManifestPath = path.join(
  tempDataDir,
  "sitemap-lastmod-sections.json",
);

function runUpdater(script: string): void {
  const res = spawnSync("pnpm", ["exec", "tsx", script], {
    cwd: scriptsDir,
    env: { ...process.env, LAERTIUS_DATA_DIR: tempDataDir },
    encoding: "utf-8",
    timeout: 300_000,
  });
  if (res.status !== 0) {
    throw new Error(
      `updater ${script} exited ${res.status}:\n${res.stdout}\n${res.stderr}`,
    );
  }
}

function readSections(): SectionManifest {
  return JSON.parse(readFileSync(sectionsManifestPath, "utf-8"));
}

function writeSentinelDates(): void {
  const m = readSections();
  for (const id of Object.keys(m)) {
    (m[id] as { date: string }).date = SENTINEL;
  }
  writeFileSync(sectionsManifestPath, JSON.stringify(m, null, 2) + "\n");
}

/**
 * Assertion suite over the post-run manifest. Returns human-readable
 * problems (empty = the updater behaved: exactly one date bumped, orphan
 * dropped, everything else untouched).
 */
function checkManifest(
  after: SectionManifest,
  before: SectionManifest,
  mutatedId: string,
  deletedId: string,
): string[] {
  const problems: string[] = [];
  if (deletedId in after) {
    problems.push(`orphaned section ${deletedId} was not dropped`);
  }
  const expectedCount = Object.keys(before).length - 1;
  if (Object.keys(after).length !== expectedCount) {
    problems.push(
      `manifest has ${Object.keys(after).length} entries, expected ${expectedCount}`,
    );
  }
  const bumped: string[] = [];
  for (const [id, entry] of Object.entries(after)) {
    const prev = before[id];
    if (id === mutatedId) {
      if (entry.date !== today) {
        problems.push(
          `mutated section ${id} has date ${entry.date}, expected ${today}`,
        );
      }
      if (prev && entry.hash === prev.hash) {
        problems.push(`mutated section ${id} kept its old hash`);
      }
      continue;
    }
    if (entry.date !== SENTINEL) bumped.push(id);
    if (prev && entry.hash !== prev.hash) {
      problems.push(`unchanged section ${id} got a new hash`);
    }
  }
  if (bumped.length > 0) {
    problems.push(
      `${bumped.length} unrelated section(s) had their date bumped (e.g. ${bumped.slice(0, 3).join(", ")})`,
    );
  }
  return problems;
}

// --------------------------------------------------- broken-hash lib + updater
// Copies of the real library/updater with currentSectionHashes() broken to
// hash the whole corpus per section — the exact regression under test.
const brokenDir = path.join(here, "tmp-sitemap-isolation-broken");

function buildBrokenUpdater(): string {
  mkdirSync(brokenDir, { recursive: true });
  let lib = readFileSync(libPath, "utf-8");
  const libDir = path.dirname(libPath);
  const relCorpus = path
    .relative(brokenDir, path.join(libDir, "corpus"))
    .replaceAll(path.sep, "/");
  const relOtb = path
    .relative(brokenDir, path.join(libDir, "otb/build"))
    .replaceAll(path.sep, "/");
  lib = lib
    .replace('from "./corpus"', `from "${relCorpus}"`)
    .replace('from "./otb/build"', `from "${relOtb}"`);
  const goodExpr = "sha256(JSON.stringify(s))";
  if (!lib.includes(goodExpr)) {
    throw new Error(
      "could not find per-section hash expression in sitemap-lastmod.ts — update the positive control",
    );
  }
  lib = lib.replace(goodExpr, "sha256(JSON.stringify(corpus))");
  const brokenLibPath = path.join(brokenDir, "sitemap-lastmod-broken.ts");
  writeFileSync(brokenLibPath, lib);

  let updater = readFileSync(updaterPath, "utf-8");
  const importSpec = '"../../artifacts/api-server/src/lib/sitemap-lastmod"';
  if (!updater.includes(importSpec)) {
    throw new Error(
      "could not find the sitemap-lastmod import in update-sitemap-lastmod.ts — update the positive control",
    );
  }
  updater = updater.replace(importSpec, '"./sitemap-lastmod-broken.ts"');
  const brokenUpdaterPath = path.join(brokenDir, "update-sitemap-lastmod.ts");
  writeFileSync(brokenUpdaterPath, updater);
  return brokenUpdaterPath;
}

// -------------------------------------------------------------------- main
try {
  // 1. Baseline: sync the temp manifests to the temp corpus, then plant
  //    sentinel dates so any rewrite is visible.
  runUpdater(updaterPath);
  writeSentinelDates();
  const baseline = readSections();
  const ids = Object.keys(baseline);
  if (ids.length < 3) {
    throw new Error(`only ${ids.length} sections in manifest — data missing?`);
  }
  console.log(`baseline: ${ids.length} sections with sentinel dates`);

  // 2. Mutate one section, delete another (orphan case).
  const lines = readFileSync(jsonlPath, "utf-8")
    .split("\n")
    .filter((l) => l.trim().length > 0);
  const mutatedId = JSON.parse(lines[0] as string).id as string;
  const deletedId = JSON.parse(lines[1] as string).id as string;
  const preparedLines = lines
    .filter((l) => (JSON.parse(l).id as string) !== deletedId)
    .map((l) => {
      const rec = JSON.parse(l);
      if (rec.id === mutatedId) {
        rec.text = `${rec.text} [validator mutation]`;
        return JSON.stringify(rec);
      }
      return l;
    });
  const preparedJsonl = preparedLines.join("\n") + "\n";
  const preparedManifest = readFileSync(sectionsManifestPath, "utf-8");
  writeFileSync(jsonlPath, preparedJsonl);
  console.log(`mutated ${mutatedId}, deleted ${deletedId}`);

  // 3. Real updater on the mutated corpus.
  runUpdater(updaterPath);
  const problems = checkManifest(readSections(), baseline, mutatedId, deletedId);
  if (problems.length === 0) {
    ok(
      `real updater bumped exactly ${mutatedId}, dropped ${deletedId}, left ${ids.length - 2} sections untouched`,
    );
  } else {
    for (const p of problems) fail(`real updater: ${p}`);
  }

  // 4. Positive control: broken hash function must fail the same checks.
  writeFileSync(jsonlPath, preparedJsonl);
  writeFileSync(sectionsManifestPath, preparedManifest);
  const brokenUpdaterPath = buildBrokenUpdater();
  runUpdater(brokenUpdaterPath);
  const controlProblems = checkManifest(
    readSections(),
    baseline,
    mutatedId,
    deletedId,
  );
  const sawCollapse = controlProblems.some((p) =>
    p.includes("had their date bumped"),
  );
  if (sawCollapse) {
    ok(
      `positive control: broken whole-corpus hash flagged (${controlProblems.length} problem(s), e.g. "${controlProblems[0]}")`,
    );
  } else {
    fail(
      `positive control: broken hash function was NOT flagged (problems: ${JSON.stringify(controlProblems)})`,
    );
  }
} catch (err) {
  fail(String(err instanceof Error ? (err.stack ?? err.message) : err));
} finally {
  rmSync(tempDataDir, { recursive: true, force: true });
  rmSync(brokenDir, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`validate-sitemap-section-isolation: ${failures} failure(s)`);
  process.exit(1);
}
console.log("validate-sitemap-section-isolation: all checks passed");
export {};
