/**
 * Local query embedder for dense retrieval. The model cache is shared with
 * the api-server's local cache when present (same model, same weights);
 * override with LEGOMENA_MODEL_CACHE. When no model can be loaded the Ask
 * pipeline degrades to sparse-only retrieval and says so in its response.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import {
  pipeline,
  env,
  type FeatureExtractionPipeline,
} from "@huggingface/transformers";
import { dataDir } from "./store";
import { logger } from "./logger";
import { EMBEDDING_MODEL } from "./embedding-config";

export { EMBEDDING_MODEL } from "./embedding-config";

const sharedCache = path.resolve(
  dataDir,
  "..",
  "..",
  "api-server",
  "data",
  "models",
);
env.cacheDir =
  process.env["LEGOMENA_MODEL_CACHE"] ??
  (existsSync(sharedCache) ? sharedCache : path.resolve(dataDir, "models"));

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;
let ready = false;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    logger.info(
      { model: EMBEDDING_MODEL, cacheDir: env.cacheDir },
      "Loading local embedding model",
    );
    extractorPromise = pipeline("feature-extraction", EMBEDDING_MODEL, {
      dtype: "q8",
    });
  }
  return extractorPromise;
}

export async function warmUpEmbedder(): Promise<void> {
  try {
    const extractor = await getExtractor();
    await extractor("query: warmup", { pooling: "mean", normalize: true });
    ready = true;
    logger.info("Local embedding model ready");
  } catch (err) {
    logger.error({ err }, "Failed to load local embedding model");
  }
}

export function embedderReady(): boolean {
  return ready;
}

export async function embedQuery(query: string): Promise<Float32Array> {
  const extractor = await getExtractor();
  const output = await extractor(`query: ${query.slice(0, 2000)}`, {
    pooling: "mean",
    normalize: true,
  });
  return new Float32Array(output.data as Float32Array);
}
