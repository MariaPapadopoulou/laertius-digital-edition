import path from "node:path";
import { pipeline, env, type FeatureExtractionPipeline } from "@huggingface/transformers";
import { dataDir } from "./corpus";
import { logger } from "./logger";

export const EMBEDDING_MODEL =
  process.env["EMBEDDING_MODEL"] ?? "Xenova/multilingual-e5-small";

env.cacheDir = path.resolve(dataDir, "models");

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;
let modelReady = false;

/**
 * True once the local embedding model has successfully produced at least one
 * embedding this process. Stays false if the model cache is missing and the
 * download fails (e.g. first boot without network access), in which case
 * hybrid/dense retrieval is degraded.
 */
export function embedderReady(): boolean {
  return modelReady;
}

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    logger.info({ model: EMBEDDING_MODEL }, "Loading local embedding model");
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
    modelReady = true;
    logger.info("Local embedding model ready");
  } catch (err) {
    logger.error({ err }, "Failed to load local embedding model");
  }
}

export async function embedQuery(query: string): Promise<Float32Array> {
  const extractor = await getExtractor();
  const output = await extractor(`query: ${query.slice(0, 2000)}`, {
    pooling: "mean",
    normalize: true,
  });
  return new Float32Array(output.data as Float32Array);
}
