/**
 * Check that exports/laertius-full-source.zip (the downloadable full-source
 * archive served at /api/exports/laertius-full-source.zip) is not stale: its
 * entry list must match the current source-file selection (git ls-files +
 * EXCLUDE from source-archive-contract.ts) and every entry's CONTENT must
 * match the file on disk. Content (CRC-32 + size), not mtimes — checkpoint
 * commits touch unchanged files, so mtime comparisons false-fail.
 *
 * The zip's central directory is parsed directly here instead of shelling
 * out to `unzip -Z1`: unzip replaces non-ASCII filename bytes with `?` in
 * its listing (the workspace has Greek-named attachment files), which would
 * make those entries permanently look added+removed.
 *
 * Exit codes:
 *   0 — zip exists, entry set matches, all contents identical
 *   1 — zip missing, files added/removed since the build, or content differs
 *
 * Run: pnpm --filter @workspace/scripts run validate-source-archive-freshness
 * Rebuild when stale: pnpm --filter @workspace/scripts run build-source-archive
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { listSourceFiles } from "./source-archive-contract";
import { readCentralDirectory } from "./zip-central-directory";

const root = path.resolve(import.meta.dirname, "../..");
const zipPath = path.join(root, "exports/laertius-full-source.zip");
const REBUILD = "pnpm --filter @workspace/scripts run build-source-archive";

function fail(msg: string): never {
  console.error(msg);
  console.error(`Rebuild the archive: ${REBUILD}`);
  process.exit(1);
}

if (!existsSync(zipPath)) {
  fail(`Missing ${path.relative(root, zipPath)}.`);
}

const current = listSourceFiles(root);
if (current.length < 500) {
  // Positive control: an empty/broken selection would vacuously "match"
  // nothing; refuse to certify anything from it.
  fail(`Suspiciously few source files selected (${current.length}); refusing to judge freshness.`);
}
const currentSet = new Set(current);

const entries = readCentralDirectory(readFileSync(zipPath)).filter(
  (e) => !e.name.endsWith("/"), // directory entries, if any
);
const zipByName = new Map(entries.map((e) => [e.name, e]));

const added = current.filter((f) => !zipByName.has(f));
const removed = entries.filter((e) => !currentSet.has(e.name)).map((e) => e.name);
if (added.length > 0 || removed.length > 0) {
  const lines: string[] = ["Source archive is STALE: file set changed since the last build."];
  if (added.length > 0) {
    lines.push(`  ${added.length} file(s) on disk but missing from the zip:`);
    for (const f of added.slice(0, 15)) lines.push(`    + ${f}`);
    if (added.length > 15) lines.push(`    … and ${added.length - 15} more`);
  }
  if (removed.length > 0) {
    lines.push(`  ${removed.length} zip entrie(s) no longer in the source set:`);
    for (const f of removed.slice(0, 15)) lines.push(`    - ${f}`);
    if (removed.length > 15) lines.push(`    … and ${removed.length - 15} more`);
  }
  fail(lines.join("\n"));
}

// Content comparison: CRC-32 + uncompressed size of the disk file vs the
// values recorded in the central directory for the same entry.
const changed: string[] = [];
for (const f of current) {
  const entry = zipByName.get(f)!;
  const data = readFileSync(path.join(root, f));
  if (data.length !== entry.size || (zlib.crc32(data) >>> 0) !== entry.crc) {
    changed.push(f);
  }
}

if (changed.length > 0) {
  const lines = [
    `Source archive is STALE: ${changed.length} file(s) differ from the zipped copy:`,
  ];
  for (const f of changed.slice(0, 15)) lines.push(`    ~ ${f}`);
  if (changed.length > 15) lines.push(`    … and ${changed.length - 15} more`);
  fail(lines.join("\n"));
}

console.log(
  `Source archive is fresh: ${current.length} files, entry set and all contents match disk.`,
);
