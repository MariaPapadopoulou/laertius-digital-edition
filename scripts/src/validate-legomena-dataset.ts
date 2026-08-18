/**
 * Legomena dataset freshness: recomputes the three exporter documents
 * (base graph, ontology TBox, passage layer) from the curated sources and
 * compares CONTENT HASHES against the committed Turtle files and the
 * manifest. Hashes, not mtimes: rebuilds and checkpoint commits touch
 * files without changing bytes. Every check prints a positive count so a
 * vacuously green run is impossible.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-legomena-dataset
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Parser as N3Parser } from "n3";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const dataDir = path.resolve(
  import.meta.dirname,
  "../../artifacts/legomena-api/data",
);

// Positive controls: a dataset file that parses to fewer quads than this
// means the exporter emitted nothing (wrong namespace, empty corpus...).
const MIN_QUADS: Record<string, number> = {
  "base.ttl": 50_000,
  "tbox.ttl": 800,
  "passages.ttl": 100_000,
};

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

let failed = false;
function fail(msg: string): void {
  console.error(`  ✗ ${msg}`);
  failed = true;
}

interface ManifestFile {
  name: string;
  sha256: string;
  bytes: number;
  quads: number;
}

async function main(): Promise<void> {
  const lod = await import("../../artifacts/api-server/src/lib/lod");
  // The exact model+dim the Legomena API uses to embed queries at runtime.
  const embeddingConfig = await import(
    "../../artifacts/legomena-api/src/embedding-config"
  );
  const expected: Record<string, string> = {
    "base.ttl": lod.graphAsTurtle(),
    "tbox.ttl": lod.ontologyAsTurtle(),
    "passages.ttl": lod.passageLayerAsTurtle(),
  };
  const manifestPath = path.join(dataDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    fail(`missing ${manifestPath}; run materialize-legomena`);
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
    generatedAt: string;
    files: ManifestFile[];
    counts: Record<string, number>;
  };

  let checked = 0;
  for (const [name, content] of Object.entries(expected)) {
    const file = path.join(dataDir, name);
    if (!existsSync(file)) {
      fail(`missing dataset file ${name}; run materialize-legomena`);
      continue;
    }
    const committed = readFileSync(file, "utf-8");
    const committedHash = sha256(committed);
    const expectedHash = sha256(content);
    if (committedHash !== expectedHash) {
      fail(
        `${name} is stale (committed ${committedHash.slice(0, 12)}…, expected ${expectedHash.slice(0, 12)}…); re-run materialize-legomena`,
      );
      continue;
    }
    const entry = manifest.files.find((f) => f.name === name);
    if (!entry) {
      fail(`${name} missing from manifest.json`);
      continue;
    }
    if (entry.sha256 !== committedHash) {
      fail(`manifest hash for ${name} does not match the committed file`);
      continue;
    }
    const quads = new N3Parser().parse(committed).length;
    const min = MIN_QUADS[name] ?? 1;
    if (quads < min) {
      fail(`${name}: only ${quads} quads (< ${min}); exporter emitted too little`);
      continue;
    }
    if (entry.quads !== quads) {
      fail(`manifest quad count for ${name} (${entry.quads}) != parsed (${quads})`);
      continue;
    }
    console.log(`  ✓ ${name}: content hash matches curated sources, ${quads} quads`);
    checked += 1;
  }
  if (checked !== 3) failed = true;

  // The committed dense index must cover exactly the dataset's sections.
  const indexPath = path.join(dataDir, "embedding-index.json");
  if (!existsSync(indexPath)) {
    fail("embedding-index.json missing; run build-legomena-embeddings");
  } else {
    const index = JSON.parse(readFileSync(indexPath, "utf-8")) as {
      model: string;
      dim: number;
      ids: string[];
    };
    const sections = manifest.counts["sections"] ?? 0;
    if (index.ids.length !== sections || sections === 0) {
      fail(
        `embedding index covers ${index.ids.length} sections, manifest says ${sections}; re-run build-legomena-embeddings`,
      );
    } else if (index.model !== embeddingConfig.EMBEDDING_MODEL) {
      fail(
        `embedding index was built with model "${index.model}" but the Legomena API embeds queries with "${embeddingConfig.EMBEDDING_MODEL}"; re-run build-legomena-embeddings`,
      );
    } else if (index.dim !== embeddingConfig.EMBEDDING_DIM) {
      fail(
        `embedding index dim ${index.dim} != expected ${embeddingConfig.EMBEDDING_DIM} for model ${embeddingConfig.EMBEDDING_MODEL}; re-run build-legomena-embeddings`,
      );
    } else {
      console.log(
        `  ✓ embedding-index.json: ${index.ids.length} sections, model "${index.model}" and dim ${index.dim} match the Legomena API's query embedder`,
      );
    }
  }

  if (failed) {
    console.error("validate-legomena-dataset: FAILED");
    process.exit(1);
  }
  console.log(
    `✓ Legomena dataset is fresh: 3 files hash-identical to the exporters, ${manifest.counts["sections"]} sections, ${manifest.counts["annotations"]} annotations`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
