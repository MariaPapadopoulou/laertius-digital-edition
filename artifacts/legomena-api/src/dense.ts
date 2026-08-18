/**
 * Dense retrieval over the committed embedding index. The index is built
 * offline from the dataset's own passage text literals
 * (scripts/src/build-legomena-embeddings.ts) and committed next to the
 * Turtle files; ids are section ids.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { dataDir } from "./store";
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
let ids: string[] = [];
let dim = 0;

export function loadDenseIndex(): boolean {
  try {
    if (!existsSync(indexPath)) {
      logger.warn({ indexPath }, "No dense embedding index; sparse-only mode");
      return false;
    }
    const parsed = JSON.parse(readFileSync(indexPath, "utf-8")) as StoredIndex;
    if (parsed.model !== EMBEDDING_MODEL) {
      logger.warn(
        { indexModel: parsed.model, runtimeModel: EMBEDDING_MODEL },
        "Embedding index model mismatch; sparse-only mode",
      );
      return false;
    }
    const buf = Buffer.from(parsed.vectorsBase64, "base64");
    vectors = new Float32Array(
      buf.buffer,
      buf.byteOffset,
      buf.byteLength / Float32Array.BYTES_PER_ELEMENT,
    );
    ids = parsed.ids;
    dim = parsed.dim;
    logger.info(
      { sections: ids.length, dim },
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
  const results: { id: string; score: number }[] = [];
  for (let d = 0; d < ids.length; d++) {
    let dot = 0;
    const offset = d * dim;
    for (let i = 0; i < dim; i++) {
      dot += (vectors[offset + i] as number) * (queryVector[i] as number);
    }
    results.push({ id: ids[d] as string, score: dot });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, pool);
}
