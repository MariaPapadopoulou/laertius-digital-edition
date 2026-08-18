import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { dataDir } from "./corpus";
import { EMBEDDING_MODEL } from "./embedder";
import { logger } from "./logger";

const indexPath = path.resolve(dataDir, "embedding-index.json");

interface StoredIndex {
  model: string;
  dim: number;
  ids: string[];
  vectorsBase64: string;
}

let vectors: Float32Array | null = null;
let dim = 0;
let ids: string[] = [];

export function loadDenseIndex(): boolean {
  if (!existsSync(indexPath)) {
    logger.info({ indexPath }, "No dense embedding index found");
    return false;
  }
  try {
    const stored = JSON.parse(readFileSync(indexPath, "utf-8")) as StoredIndex;
    if (
      !Number.isInteger(stored.dim) ||
      stored.dim <= 0 ||
      !Array.isArray(stored.ids) ||
      stored.ids.length === 0
    ) {
      throw new Error(
        `Invalid embedding index: dim=${stored.dim}, ids=${stored.ids?.length}`,
      );
    }
    if (stored.model !== EMBEDDING_MODEL) {
      throw new Error(
        `Embedding index model mismatch: index built with "${stored.model}" but server uses "${EMBEDDING_MODEL}". Rebuild with: pnpm --filter @workspace/scripts run build-embeddings`,
      );
    }
    const buf = Buffer.from(stored.vectorsBase64, "base64");
    if (buf.byteLength !== stored.ids.length * stored.dim * 4) {
      throw new Error(
        `Embedding index size mismatch: expected ${stored.ids.length * stored.dim * 4} bytes for ${stored.ids.length} vectors of dim ${stored.dim}, got ${buf.byteLength}`,
      );
    }
    const raw = new Float32Array(
      buf.buffer,
      buf.byteOffset,
      buf.byteLength / 4,
    );
    vectors = new Float32Array(raw);
    dim = stored.dim;
    ids = stored.ids;
    logger.info(
      { sections: ids.length, dim, model: stored.model },
      "Dense embedding index loaded",
    );
    return true;
  } catch (err) {
    logger.error({ err }, "Failed to load dense embedding index");
    vectors = null;
    ids = [];
    dim = 0;
    return false;
  }
}

export function denseIndexReady(): boolean {
  return vectors !== null && ids.length > 0;
}

export function embeddedSectionCount(): number {
  return ids.length;
}

export function denseRank(
  queryVector: Float32Array,
  pool: number,
): { id: string; score: number }[] {
  if (!vectors || ids.length === 0) return [];
  if (queryVector.length !== dim) {
    logger.error(
      { queryDim: queryVector.length, indexDim: dim },
      "Query vector dimension does not match embedding index",
    );
    return [];
  }
  let qNorm = 0;
  for (let i = 0; i < queryVector.length; i++) {
    qNorm += queryVector[i]! * queryVector[i]!;
  }
  qNorm = Math.sqrt(qNorm) || 1;

  const results: { id: string; score: number }[] = [];
  for (let d = 0; d < ids.length; d++) {
    let dot = 0;
    const offset = d * dim;
    for (let i = 0; i < dim; i++) {
      dot += vectors[offset + i]! * queryVector[i]!;
    }
    results.push({ id: ids[d]!, score: dot / qNorm });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, pool);
}

loadDenseIndex();
