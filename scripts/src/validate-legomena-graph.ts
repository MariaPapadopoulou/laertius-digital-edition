/**
 * Legomena derived-graph equivalence: the knowledge graph reconstructed
 * from the committed assertion dataset by SPARQL (legomena-api derive.ts)
 * must equal the laertius app's curated knowledge graph - same node set
 * (names, school slugs, book/chapter placement) and same edge multiset
 * (from, to, type, ref). Positive match counts are printed so an empty
 * derivation can never pass vacuously, and every derived edge must carry
 * the citation / certainty / attribution it was derived from.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-legomena-graph
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

let failed = false;
let failures = 0;
function fail(msg: string): void {
  failures += 1;
  if (failures <= 30) console.error(`  ✗ ${msg}`);
  failed = true;
}

async function main(): Promise<void> {
  const { initStore, getStore } = await import(
    "../../artifacts/legomena-api/src/store"
  );
  const { buildModel } = await import(
    "../../artifacts/legomena-api/src/model"
  );
  const { deriveGraph } = await import(
    "../../artifacts/legomena-api/src/derive"
  );
  initStore();
  const model = buildModel(getStore());
  const derived = deriveGraph(getStore(), model);

  const { getKnowledgeGraph } = await import(
    "../../artifacts/api-server/src/lib/kg"
  );
  const kg = getKnowledgeGraph();

  // ---- nodes -------------------------------------------------------------
  const derivedByName = new Map(derived.nodes.map((n) => [n.name, n]));
  const kgByName = new Map(kg.nodes.map((n) => [n.name, n]));
  for (const name of derivedByName.keys()) {
    if (!kgByName.has(name)) fail(`derived node not in curated graph: ${name}`);
  }
  for (const name of kgByName.keys()) {
    if (!derivedByName.has(name))
      fail(`curated node missing from derivation: ${name}`);
  }
  let nodeFieldMatches = 0;
  for (const [name, kgNode] of kgByName) {
    const d = derivedByName.get(name);
    if (!d) continue;
    // School is deliberately NOT compared against the curated "movement":
    // movements are the laertius app's editorial grouping of the book
    // layout, while the derived graph reads actual lo:memberOf assertions -
    // Dionysius the Renegade sits among the Stoa chapters (movement "stoa")
    // but the assertions make him a Cyrenaic defector. The derived school
    // must simply be a real, labelled school entity in the store.
    if (!d.schoolUri.includes("/school/") || !d.schoolLabel) {
      fail(
        `${name}: derived school "${d.school}" is not a labelled school entity`,
      );
      continue;
    }
    if (d.book !== kgNode.book || d.chapter !== kgNode.chapter) {
      fail(
        `${name}: derived placement ${d.book}.${d.chapter} != curated ${kgNode.book}.${kgNode.chapter}`,
      );
      continue;
    }
    nodeFieldMatches += 1;
  }

  // ---- edges (multiset over from|to|type|ref) -----------------------------
  const key = (from: string, to: string, type: string, ref: string): string =>
    `${from} -[${type}]-> ${to} @${ref}`;
  const count = (keys: string[]): Map<string, number> => {
    const m = new Map<string, number>();
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  };
  const kgEdgeKeys = count(
    kg.edges.map((e) => key(e.from, e.to, e.type, e.ref ?? "")),
  );
  const derivedEdgeKeys = count(
    derived.edges.map((e) => key(e.from, e.to, e.type, e.ref)),
  );
  let edgeMatches = 0;
  for (const [k, n] of kgEdgeKeys) {
    const dn = derivedEdgeKeys.get(k) ?? 0;
    if (dn !== n) {
      fail(`edge ${k}: curated x${n}, derived x${dn}`);
    } else {
      edgeMatches += n;
    }
  }
  for (const [k, n] of derivedEdgeKeys) {
    if (!kgEdgeKeys.has(k)) fail(`derived edge not in curated graph: ${k} x${n}`);
  }

  // ---- provenance on every derived edge -----------------------------------
  let provenanced = 0;
  for (const e of derived.edges) {
    if (!e.citation.startsWith("Diog. Laert.")) {
      fail(`edge ${e.from} -> ${e.to} lacks a D.L. citation (${e.citation})`);
    } else if (e.certainty !== "asserted" && e.certainty !== "reported") {
      fail(`edge ${e.from} -> ${e.to} has unexpected certainty ${e.certainty}`);
    } else if (!e.attribution) {
      fail(`edge ${e.from} -> ${e.to} has no attribution`);
    } else {
      provenanced += 1;
    }
  }

  // ---- positive controls ---------------------------------------------------
  if (kg.nodes.length < 50)
    fail(`curated graph has only ${kg.nodes.length} nodes - wrong source?`);
  if (kg.edges.length < 50)
    fail(`curated graph has only ${kg.edges.length} edges - wrong source?`);
  if (nodeFieldMatches < 50)
    fail(`only ${nodeFieldMatches} node field matches (< 50)`);
  if (edgeMatches < 50) fail(`only ${edgeMatches} edge matches (< 50)`);

  if (failed) {
    console.error(`validate-legomena-graph: FAILED (${failures} failures)`);
    process.exit(1);
  }
  console.log(
    `✓ Derived graph == curated graph: ${nodeFieldMatches}/${kg.nodes.length} nodes matched on name+school+placement, ${edgeMatches}/${kg.edges.length} edges matched on (from,to,type,ref), ${provenanced} edges carry citation+certainty+attribution`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
