/**
 * Guards the competency subgraph legend contract: the API payload keeps
 * carrying curated Greek school forms for machine consumers, while the
 * legend itself (per an explicit editorial decision, 2026-08-09) shows
 * the ENGLISH label only.
 *
 * Two sides can drift independently: the API route
 * (routes/competency.ts) attaches greekSchoolGrc(m.label) to each
 * subgraph movement it ships in the `movements` payload, and the
 * SubgraphViz legend (pages/competency.tsx) renders `m.label` without
 * the grc form. If either side changes, this degrades to
 * English-only while everything else stays green.
 *
 * This validator pins both sides:
 *  1. Data: it replicates the route's subMovements construction for every
 *     competency question (same store, same subgraph rules) and asserts
 *     each shipped movement except "Unaffiliated" carries a real
 *     Greek-script grc. Positive counts are printed so a vacuous pass is
 *     impossible.
 *  2. Wiring: source pins on the route (grc attachment + movements
 *     payload) and on the legend (m.grc rendered with lang="grc" inside
 *     the usedMovements map), following the validate-competency-terms
 *     source-pin pattern.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-subgraph-legend
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { Store } from "oxigraph";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { COMPETENCY_QUESTIONS } = await import(
  "../../artifacts/api-server/src/lib/competency"
);
const { getKnowledgeGraph, MOVEMENTS } = await import(
  "../../artifacts/api-server/src/lib/kg"
);
const { graphAsTurtle, ontologyAsTurtle, LOD_BASE, ONT } = await import(
  "../../artifacts/api-server/src/lib/lod"
);
const { greekSchoolGrc } = await import(
  "../../artifacts/api-server/src/lib/greek-names"
);

let failures = 0;
function check(label: string, ok: boolean) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}`);
  }
}

interface SparqlResultsJson {
  head?: { vars?: string[] };
  results?: {
    bindings?: Array<Record<string, { value: string }>>;
  };
}

const GREEK_RE = /[\u0370-\u03FF\u1F00-\u1FFF]/;

const graph = getKnowledgeGraph();
const nodesByName = new Map(graph.nodes.map((n) => [n.name, n]));

console.log(
  `Inputs: ${COMPETENCY_QUESTIONS.length} competency questions, ` +
    `${graph.nodes.length} KG nodes, ${MOVEMENTS.length} movements`,
);
check("competency catalogue is non-empty", COMPETENCY_QUESTIONS.length > 0);
check("knowledge graph has nodes", graph.nodes.length > 0);

const store = new Store();
store.load(graphAsTurtle(), { format: "text/turtle" });
store.load(ontologyAsTurtle(), { format: "text/turtle" });

// Replicate the route's subgraph movement construction per question and
// assert every shipped movement except Unaffiliated carries a real Greek
// grc, exactly as the payload the legend consumes would.
console.log("Subgraph movements per question:");
let movementsShipped = 0;
let grcAttached = 0;
let questionsWithGrcMovements = 0;

for (const q of COMPETENCY_QUESTIONS) {
  let rows: string[][];
  try {
    const rawJson = String(
      store.query(q.sparqlFn(LOD_BASE, ONT), { results_format: "json" }),
    );
    const parsed: SparqlResultsJson = JSON.parse(rawJson);
    const variables = parsed.head?.vars ?? [];
    rows = (parsed.results?.bindings ?? []).map((b) =>
      variables.map((v) => b[v]?.value ?? ""),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    check(`${q.id}: SPARQL query executes (${message})`, false);
    continue;
  }

  // Same subgraph rule as the route: seed labels plus SPARQL row values,
  // keeping only names that are KG nodes; movements are those of the
  // resulting subgraph nodes.
  const relevantNames = new Set<string>(q.seedLabels);
  for (const row of rows) {
    for (const val of row) {
      if (nodesByName.has(val)) relevantNames.add(val);
    }
  }
  const subNodes = [...relevantNames]
    .map((name) => nodesByName.get(name))
    .filter((n): n is NonNullable<typeof n> => n !== undefined);
  const movementIds = new Set(subNodes.map((n) => n.movement));
  const subMovements = MOVEMENTS.filter((m) => movementIds.has(m.id)).map(
    (m) => {
      const grc = greekSchoolGrc(m.label);
      return grc ? { ...m, grc } : m;
    },
  );

  const problems: string[] = [];
  let qGrc = 0;
  for (const m of subMovements) {
    movementsShipped++;
    const grc = (m as { grc?: string }).grc;
    if (m.label === "Unaffiliated") {
      // Deliberately English-only: not a school
      if (grc !== undefined)
        problems.push(`Unaffiliated unexpectedly carries grc "${grc}"`);
      continue;
    }
    if (!grc || !GREEK_RE.test(grc)) {
      problems.push(`${m.label}: no real Greek form ("${grc ?? ""}")`);
      continue;
    }
    grcAttached++;
    qGrc++;
  }
  if (qGrc > 0) questionsWithGrcMovements++;
  check(
    `${q.id}: ${subMovements.length} subgraph movement(s), ${qGrc} with Greek forms` +
      (problems.length ? ` (${problems.join("; ")})` : ""),
    problems.length === 0,
  );
}

// Positive controls: the loop must have actually shipped movements and
// attached Greek forms, otherwise every per-question check went vacuous.
check(
  `shipped ${movementsShipped} subgraph movements across the catalogue (must be > 0)`,
  movementsShipped > 0,
);
check(
  `${grcAttached} movements carry a Greek school form (must be > 0)`,
  grcAttached > 0,
);
check(
  `${questionsWithGrcMovements} question(s) ship at least one Greek-named movement (must be > 0)`,
  questionsWithGrcMovements > 0,
);
// Negative control: the Greek-form test itself must be able to fire.
check(
  "negative control: a Latin-only string is not a real Greek form",
  !GREEK_RE.test("Stoa"),
);

// Wiring pins: the data check above only covers the real code path while
// the route keeps attaching grc to the movements payload and the legend
// keeps rendering it.
console.log("Wiring:");
const routeSource = readFileSync(
  path.resolve(
    import.meta.dirname,
    "../../artifacts/api-server/src/routes/competency.ts",
  ),
  "utf8",
);
// The route must attach greekSchoolGrc to each subgraph movement...
check(
  "competency route attaches greekSchoolGrc to subMovements",
  /const subMovements = MOVEMENTS\.filter\([\s\S]{0,300}?greekSchoolGrc\(m\.label\)[\s\S]{0,200}?grc \? \{ \.\.\.m, grc \} : m/.test(
    routeSource,
  ),
);
// ...and ship exactly those movements as the response's movements payload.
check(
  "competency route ships subMovements as the movements payload",
  routeSource.includes("movements: subMovements"),
);

const pageSource = readFileSync(
  path.resolve(
    import.meta.dirname,
    "../../artifacts/laertius/src/pages/competency.tsx",
  ),
  "utf8",
);
// Per an explicit editorial decision (2026-08-09) the legend shows the
// ENGLISH label only: it must render m.label and must NOT render the grc
// form (the payload keeps carrying grc for machine consumers).
check(
  "SubgraphViz legend renders m.label WITHOUT a grc span",
  /usedMovements\.map\(\(m\) =>[\s\S]{0,700}?\{m\.label\}/.test(pageSource) &&
    !/\{m\.grc/.test(pageSource),
);
// The legend's movements come from the response payload (movements prop
// filtered to those used by subgraph nodes), so the grc it renders is the
// one the route attached.
check(
  "SubgraphViz filters the movements payload into usedMovements",
  /const usedMovements = movements\.filter\(/.test(pageSource),
);

if (failures > 0) {
  console.error(`\nvalidate-subgraph-legend: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nvalidate-subgraph-legend: all checks passed");
