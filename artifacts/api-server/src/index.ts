import app from "./app";
import { logger } from "./lib/logger";
import { warmUpEmbedder } from "./lib/embedder";
import { getEntitySummaries } from "./lib/annotate";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void warmUpEmbedder();
  // Warm the corpus-wide annotation index so the first /annotations/entities
  // request doesn't pay the one-time build cost (~0.5s).
  setImmediate(() => {
    const count = getEntitySummaries().length;
    logger.info({ entities: count }, "Annotation index warmed");
  });
});
