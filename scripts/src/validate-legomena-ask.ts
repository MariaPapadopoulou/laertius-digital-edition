/**
 * Legomena Ask grounding: for a fixed set of questions, every answer line
 * must be a real assertion in the store (claims resolvable by ASK query,
 * relation statements present in the model), carry a citation, and be
 * grounded in a retrieved passage (its sectionId is one of the retrieved
 * sections AND exists in the dataset). Sparse-only mode is tolerated (the
 * validator may run without the embedding model) but retrieval and
 * grounding must still produce lines. Prints positive counts.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-legomena-ask
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const QUESTIONS = [
  "Who taught Plato?",
  "How did Zeno of Citium die?",
  "Where was Epicurus born?",
  "What did Pythagoras believe about the soul?",
];

let failed = false;
function fail(msg: string): void {
  console.error(`  ✗ ${msg}`);
  failed = true;
}

async function main(): Promise<void> {
  const { initStore, getStore } = await import(
    "../../artifacts/legomena-api/src/store"
  );
  const { buildModel } = await import(
    "../../artifacts/legomena-api/src/model"
  );
  const { initRetrieval, ask } = await import(
    "../../artifacts/legomena-api/src/ask"
  );
  const { loadDenseIndex } = await import(
    "../../artifacts/legomena-api/src/dense"
  );
  const { warmUpEmbedder } = await import(
    "../../artifacts/legomena-api/src/embedder"
  );

  initStore();
  const store = getStore();
  const model = buildModel(store);
  initRetrieval(model);
  loadDenseIndex();
  try {
    await warmUpEmbedder();
  } catch {
    // sparse-only is acceptable for the validator
  }

  let totalLines = 0;
  let claimLines = 0;
  let relationLines = 0;
  for (const question of QUESTIONS) {
    const res = await ask(model, question, 8);
    if (res.lines.length === 0) {
      fail(`"${question}": no grounded answer lines`);
      continue;
    }
    const retrievedIds = new Set(res.retrieved.map((r) => r.passage.id));
    for (const line of res.lines) {
      const a = line.assertion;
      if (!model.assertionByUri.has(a.uri)) {
        fail(`"${question}": line cites unknown assertion ${a.uri}`);
        continue;
      }
      if (a.kind === "claim") {
        const inStore = store.query(`ASK { <${a.uri}> ?p ?o }`) as boolean;
        if (!inStore) {
          fail(`"${question}": claim ${a.uri} not present in the store`);
        }
        claimLines += 1;
      } else {
        relationLines += 1;
      }
      if (!a.citation || !/\d+\.\d+/.test(a.citation)) {
        fail(`"${question}": line has no resolvable citation (${a.citation})`);
      }
      if (!a.sectionId || !retrievedIds.has(a.sectionId)) {
        fail(
          `"${question}": line's section ${a.sectionId ?? "(none)"} is not among the retrieved passages`,
        );
      } else if (!model.passageById.has(a.sectionId)) {
        fail(`"${question}": section ${a.sectionId} not in the dataset`);
      }
      if (!line.text.trim()) fail(`"${question}": empty answer line text`);
    }
    if (res.entities.length === 0) {
      fail(`"${question}": no grounding entities reported`);
    }
    totalLines += res.lines.length;
    console.log(
      `  ✓ "${question}" → ${res.lines.length} cited lines from ${res.retrieved.length} passages (${res.mode})`,
    );
  }

  if (totalLines < QUESTIONS.length) {
    fail(`only ${totalLines} lines across ${QUESTIONS.length} questions`);
  }

  if (failed) {
    console.error("validate-legomena-ask: FAILED");
    process.exit(1);
  }
  console.log(
    `✓ Ask grounding: ${totalLines} answer lines (${claimLines} claims, ${relationLines} relation statements), every line a cited store assertion inside a retrieved passage`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
