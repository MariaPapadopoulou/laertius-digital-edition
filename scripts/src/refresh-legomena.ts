/**
 * One-command Legomena dataset refresh: chains materialize-legomena →
 * build-legomena-embeddings (chunk-resumable) and then re-runs
 * validate-legomena-dataset, printing per-file quad counts and hash
 * changes so it is obvious what actually moved.
 *
 * Safety: if passages.ttl content changed, the /tmp embedding progress
 * file is cleared first — its cached vectors were computed from the OLD
 * passage text and would silently be reused otherwise. A refresh that is
 * interrupted and re-run keeps its progress (the second materialize
 * produces identical bytes, so no clear happens).
 *
 * Run: pnpm --filter @workspace/scripts run refresh-legomena
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const scriptsDir = path.resolve(here, "..");
const dataDir = path.resolve(here, "../../artifacts/legomena-api/data");
const progressPath = "/tmp/legomena-embeddings-progress.jsonl";

const DATASET_FILES = ["base.ttl", "tbox.ttl", "passages.ttl"];

function sha256File(p: string): string | null {
  if (!existsSync(p)) return null;
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

function run(step: string, script: string): void {
  console.log(`\n── ${step} ──`);
  const res = spawnSync("pnpm", ["run", script], {
    cwd: scriptsDir,
    stdio: "inherit",
  });
  if (res.status !== 0) {
    console.error(`✗ ${script} failed (exit ${res.status ?? "signal"})`);
    process.exit(res.status ?? 1);
  }
}

interface ManifestFile {
  name: string;
  sha256: string;
  quads: number;
}

function readManifest(): { files: ManifestFile[]; counts: Record<string, number> } | null {
  const p = path.join(dataDir, "manifest.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf-8"));
}

function main(): void {
  const before = new Map<string, string | null>();
  for (const name of [...DATASET_FILES, "embedding-index.json", "manifest.json"]) {
    before.set(name, sha256File(path.join(dataDir, name)));
  }
  const beforeManifest = readManifest();

  run("1/3 materialize dataset", "materialize-legomena");

  const afterManifest = readManifest();
  if (!afterManifest) {
    console.error("✗ manifest.json missing after materialize");
    process.exit(1);
  }

  console.log("\nDataset changes:");
  let anyDatasetChange = false;
  let passagesChanged = false;
  for (const name of DATASET_FILES) {
    const old = before.get(name) ?? null;
    const now = sha256File(path.join(dataDir, name));
    const entry = afterManifest.files.find((f) => f.name === name);
    const quads = entry ? `${entry.quads} quads` : "quads unknown";
    if (old === now) {
      console.log(`  = ${name}: unchanged (${quads}, sha256 ${now?.slice(0, 12)}…)`);
    } else {
      anyDatasetChange = true;
      if (name === "passages.ttl") passagesChanged = true;
      console.log(
        `  ~ ${name}: CHANGED (${quads}) ${old ? old.slice(0, 12) : "absent"}… → ${now?.slice(0, 12)}…`,
      );
    }
  }
  if (beforeManifest && afterManifest) {
    const bs = beforeManifest.counts["sections"] ?? 0;
    const as_ = afterManifest.counts["sections"] ?? 0;
    const ba = beforeManifest.counts["annotations"] ?? 0;
    const aa = afterManifest.counts["annotations"] ?? 0;
    console.log(
      `  sections: ${bs === as_ ? as_ : `${bs} → ${as_}`}, annotations: ${ba === aa ? aa : `${ba} → ${aa}`}`,
    );
  }

  // Stale-cache guard (belt): the embeddings builder itself now verifies a
  // passages.ttl+model fingerprint header on its progress file and discards
  // any mismatching cache, so provenance protection does not depend on this
  // script. Clearing here just avoids a pointless parse of a known-stale file.
  if (passagesChanged && existsSync(progressPath)) {
    rmSync(progressPath);
    console.log(
      "  cleared stale embedding progress cache (passages.ttl content changed)",
    );
  }

  const passagesSha256 = sha256File(path.join(dataDir, "passages.ttl"));
  const indexPath = path.join(dataDir, "embedding-index.json");
  const indexOk = (): boolean => {
    if (!existsSync(indexPath)) return false;
    try {
      const index = JSON.parse(readFileSync(indexPath, "utf-8")) as {
        ids: string[];
        passagesSha256?: string;
      };
      const sections = afterManifest.counts["sections"] ?? 0;
      if (sections === 0 || index.ids.length !== sections) return false;
      // Indexes built after provenance tracking record the passages.ttl hash
      // they were computed from; require an exact match. Legacy indexes
      // without the field fall back to the coverage check above.
      if (index.passagesSha256 !== undefined)
        return index.passagesSha256 === passagesSha256;
      return true;
    } catch {
      return false;
    }
  };

  if (!passagesChanged && indexOk()) {
    console.log(
      "\n── 2/3 embeddings ──\n  passages.ttl unchanged and embedding-index.json covers all sections; skipping rebuild",
    );
  } else {
    run("2/3 build embedding index (resumable)", "build-legomena-embeddings");
  }

  const indexBefore = before.get("embedding-index.json") ?? null;
  const indexAfter = sha256File(indexPath);

  run("3/3 validate dataset freshness", "validate-legomena-dataset");

  console.log("\n══ refresh summary ══");
  console.log(
    anyDatasetChange
      ? "  dataset: files regenerated with changes (see hash diffs above)"
      : "  dataset: already up to date, no byte changes",
  );
  console.log(
    indexBefore === indexAfter
      ? `  embedding index: unchanged (sha256 ${indexAfter?.slice(0, 12)}…)`
      : `  embedding index: rebuilt ${indexBefore ? indexBefore.slice(0, 12) : "absent"}… → ${indexAfter?.slice(0, 12)}…`,
  );
  console.log("✓ refresh-legomena complete; validate-legomena-dataset passed");
}

main();
