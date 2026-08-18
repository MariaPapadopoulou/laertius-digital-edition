import { createApp } from "./app";
import { initRetrieval } from "./ask";
import { deriveGraph } from "./derive";
import { loadDenseIndex } from "./dense";
import { warmUpEmbedder } from "./embedder";
import { logger } from "./logger";
import { buildModel } from "./model";
import { getStore, initStore } from "./store";

const portRaw = process.env["PORT"];
if (!portRaw) {
  logger.error("PORT environment variable is required");
  process.exit(1);
}
const port = Number(portRaw);
if (!Number.isInteger(port) || port <= 0) {
  logger.error({ portRaw }, "PORT must be a positive integer");
  process.exit(1);
}

// Everything the endpoints serve is derived from the store, so the store,
// the model, the derived graph and the retrieval indexes are all built
// before the port opens; only the query embedder warms up in background.
initStore();
const model = buildModel(getStore());
deriveGraph(getStore(), model);
initRetrieval(model);
loadDenseIndex();

const app = createApp();
app.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "Legomena API listening");
});

void warmUpEmbedder();
