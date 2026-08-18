/**
 * build-repro-deposit — assembles a reproducibility deposit package for a
 * repository with a persistent identifier (e.g. Zenodo): the SPARQL queries,
 * the retrieved Wikidata QIDs, the derived tables, and this generation
 * script itself, plus a README and licence note.
 *
 * Everything is derived live from the curated knowledge-base modules, never
 * hand-copied, so the deposit always matches the code state at build time.
 *
 * Output: exports/repro-deposit/ and exports/laertius-repro-deposit.zip
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts exec tsx src/build-repro-deposit.ts
 */
import path from "node:path";
import { mkdirSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { COMPETENCY_QUESTIONS } = await import(
  "../../artifacts/api-server/src/lib/competency"
);
const { LOD_BASE, ONT } = await import(
  "../../artifacts/api-server/src/lib/lod"
);
const { PHILOSOPHER_META, KG_EDGES, getKnowledgeGraph } = await import(
  "../../artifacts/api-server/src/lib/kg"
);
const { getMapPlaces, getItineraries } = await import(
  "../../artifacts/api-server/src/lib/map"
);

const repoRoot = path.resolve(import.meta.dirname, "../..");
const outDir = path.join(repoRoot, "exports", "repro-deposit");
const zipPath = path.join(repoRoot, "exports", "laertius-repro-deposit.zip");
const today = new Date().toISOString().slice(0, 10);
const SITE = "https://laertius.humanisticadigitalia.eu";
const ENDPOINT = `${SITE}/api/sparql`;

rmSync(outDir, { recursive: true, force: true });
for (const d of ["queries", "qids", "derived-tables", "scripts"]) {
  mkdirSync(path.join(outDir, d), { recursive: true });
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function writeCsv(file: string, header: string[], rows: unknown[][]) {
  const body = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  writeFileSync(path.join(outDir, file), body + "\n");
  console.log(`wrote ${file} (${rows.length} rows)`);
}

// ---- 1. SPARQL queries (materialized with the live base + ontology) ------
for (const q of COMPETENCY_QUESTIONS) {
  const body = q.sparqlFn(LOD_BASE, ONT).trim();
  const header = [
    `# Competency question ${q.id} (category: ${q.category})`,
    `# ${q.question.replace(/\n/g, " ")}`,
    q.greekTerm ? `# Greek term: ${q.greekTerm}` : null,
    `# Endpoint: ${ENDPOINT}`,
    `# Base URI: ${LOD_BASE}`,
    `# Retrieved: ${today}`,
  ]
    .filter(Boolean)
    .join("\n");
  writeFileSync(path.join(outDir, "queries", `${q.id}.rq`), header + "\n" + body + "\n");
}
console.log(`wrote ${COMPETENCY_QUESTIONS.length} SPARQL queries`);

// ---- 2. Retrieved Wikidata QIDs ------------------------------------------
writeCsv(
  "qids/philosophers-wikidata-qids.csv",
  ["name", "movement", "wikidata_qid", "wikidata_url"],
  Object.entries(PHILOSOPHER_META).map(([name, m]) => [
    name,
    m.movement,
    m.qid ?? "",
    m.qid ? `https://www.wikidata.org/entity/${m.qid}` : "",
  ]),
);
const places = getMapPlaces();
writeCsv(
  "qids/places-gazetteer-ids.csv",
  ["place", "place_type", "wikidata_qid", "wikidata_url", "pleiades_id", "pleiades_url", "lat", "lon"],
  places.map((p) => [
    p.label,
    p.placeType,
    p.qid ?? "",
    p.qid ? `https://www.wikidata.org/entity/${p.qid}` : "",
    p.pleiades ?? "",
    p.pleiades ? `https://pleiades.stoa.org/places/${p.pleiades}` : "",
    p.lat,
    p.lon,
  ]),
);

// ---- 3. Derived tables -----------------------------------------------------
const kg = getKnowledgeGraph();
writeCsv(
  "derived-tables/knowledge-graph-edges.csv",
  ["from", "relation", "to", "citation"],
  KG_EDGES.map((e: any) => [e.from, e.type, e.to, e.cite ?? e.citation ?? ""]),
);
writeCsv(
  "derived-tables/knowledge-graph-nodes.csv",
  ["name", "movement"],
  kg.nodes.map((n: any) => [n.name, n.movement]),
);
writeCsv(
  "derived-tables/place-life-events.csv",
  ["place", "event_property", "philosopher"],
  places.flatMap((p) => p.events.map((e) => [p.label, e.property, e.philosopher])),
);
writeCsv(
  "derived-tables/itineraries.csv",
  ["philosopher", "stop_order", "place", "lat", "lon"],
  getItineraries().flatMap((i) =>
    i.stops.map((s, idx) => [i.philosopher, idx + 1, s.place, s.lat, s.lon]),
  ),
);

// ---- 4. Scripts (this generator, self-contained provenance) --------------
copyFileSync(
  path.join(import.meta.dirname, "build-repro-deposit.ts"),
  path.join(outDir, "scripts", "build-repro-deposit.ts"),
);

// ---- 5. README + licence ---------------------------------------------------
writeFileSync(
  path.join(outDir, "README.md"),
  `# Laertius: reproducibility deposit

Curated and prepared by Dr. Maria Papadopoulou, Digital Humanities and
Classics, Department of Philology, University of Crete.

This package deposits the SPARQL queries, the retrieved Wikidata QIDs, the
derived tables, and the generation script behind the Laertius digital
scholarly edition of Diogenes Laertius' *Lives of Eminent Philosophers*
(${SITE}), snapshotted on ${today}.

## Contents

- \`queries/\` — the competency-question SPARQL queries (one \`.rq\` file per
  question), exactly as executable against the project's public endpoint
  \`${ENDPOINT}\`. Each file records the endpoint, the base URI
  (\`${LOD_BASE}\`) and the retrieval date.
- \`qids/\` — the external identifiers retrieved and curated for the edition:
  - \`philosophers-wikidata-qids.csv\`: every philosopher node with its
    Wikidata QID.
  - \`places-gazetteer-ids.csv\`: every located place with its Wikidata QID
    and Pleiades gazetteer id, plus coordinates.
- \`derived-tables/\` — the tables derived from the curated corpus on which
  the edition's figures and visualisations (relations graph, map, journeys)
  are based: knowledge-graph nodes and edges, place-anchored life events,
  and philosopher itineraries.
- \`scripts/build-zenodo-deposit.ts\` — the script that generated this
  package from the project source, for full provenance.

The figure-generation code (the interactive relations graph, the map and the
timeline) is part of the open project codebase; the tables here are the
exact inputs those figures render.

## Reproducibility

All queries run against the live endpoint above. Because the knowledge base
is versioned and hand-curated, the CSV snapshots in this package preserve
the state of the retrieved identifiers and derived tables on the date of
deposit; re-running the queries against a later state of the knowledge base
may legitimately return updated results.

## Licence

Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)
https://creativecommons.org/licenses/by-nc/4.0/
`,
);
writeFileSync(
  path.join(outDir, "LICENSE.txt"),
  `Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)
https://creativecommons.org/licenses/by-nc/4.0/legalcode

Curated and prepared by Dr. Maria Papadopoulou, University of Crete.
`,
);

// ---- 6. Zip -----------------------------------------------------------------
rmSync(zipPath, { force: true });
execFileSync("zip", ["-r", zipPath, "repro-deposit"], {
  cwd: path.join(repoRoot, "exports"),
  stdio: "inherit",
});
console.log(`\nDeposit ready: ${zipPath}`);

export {};
