/**
 * Single source of truth for the embedding model the Legomena service uses
 * for query embedding. The offline index builder
 * (scripts/src/build-legomena-embeddings.ts) and the dataset validator
 * (scripts/src/validate-legomena-dataset.ts) import these same constants,
 * so the committed embedding-index.json can never silently drift from the
 * model the running service embeds queries with.
 *
 * Kept dependency-free (no @huggingface/transformers import) so validators
 * can load it without pulling in the native inference runtime.
 */
export const EMBEDDING_MODEL =
  process.env["EMBEDDING_MODEL"] ?? "Xenova/multilingual-e5-small";

/** Output dimension of the model above (multilingual-e5-small = 384). */
export const EMBEDDING_DIM = 384;
