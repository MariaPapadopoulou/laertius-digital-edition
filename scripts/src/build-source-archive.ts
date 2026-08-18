/**
 * Build the downloadable full-source archive of the whole workspace:
 * every git-tracked (and untracked-but-not-ignored) file, minus
 * generated exports, env/secret files, logs and archives. The zip is
 * written to exports/laertius-full-source.zip and streamed by the API
 * server at /api/exports/laertius-full-source.zip.
 *
 * Run: pnpm --filter @workspace/scripts run build-source-archive
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { EXCLUDE, PROBE_FILES, listSourceFiles } from "./source-archive-contract";

const root = path.resolve(import.meta.dirname, "../..");
const outZip = path.join(root, "exports/laertius-full-source.zip");

// Selection rules (git ls-files + EXCLUDE) live in source-archive-contract.ts,
// shared with check-source-archive-freshness.ts.
const files = listSourceFiles(root);

if (files.length < 500) {
  throw new Error(`Suspiciously few files selected (${files.length}); refusing to build.`);
}
for (const probe of PROBE_FILES) {
  if (!files.includes(probe)) throw new Error(`Expected file missing from archive list: ${probe}`);
}

mkdirSync(path.dirname(outZip), { recursive: true });
rmSync(outZip, { force: true });

// zip -@ reads newline-separated names from a list file.
const listFile = path.join(os.tmpdir(), `source-archive-list-${process.pid}.txt`);
writeFileSync(listFile, files.join("\n") + "\n");
try {
  execSync(`zip -q -X "${outZip}" -@ < "${listFile}"`, { cwd: root, stdio: "inherit" });
} finally {
  rmSync(listFile, { force: true });
}

if (!existsSync(outZip)) throw new Error("zip did not produce an output file");

// Post-build guard: assert the zip actually contains none of the
// excluded material (exports, verification artifacts, env files, logs,
// nested archives), so the exclusion list cannot silently regress.
const entries = execSync(`unzip -Z1 "${outZip}"`, {
  maxBuffer: 64 * 1024 * 1024,
})
  .toString("utf8")
  .split("\n")
  .filter(Boolean);
const leaked = entries.filter((e) => EXCLUDE.some((re) => re.test(e)));
if (leaked.length > 0) {
  rmSync(outZip, { force: true });
  throw new Error(
    `Archive contained excluded paths (deleted it):\n${leaked.slice(0, 20).join("\n")}`,
  );
}
const size = statSync(outZip).size;
console.log(`Wrote ${outZip} (${(size / 1024 / 1024).toFixed(1)} MB, ${files.length} files)`);
