/**
 * Catches the homonym roster on /competency?q=homonymy-proper-names
 * falling back to a flat 45-chip wall if Greek forms go missing.
 *
 * The Entities card groups person chips under their shared Greek form
 * (pages/competency.tsx, Zone C): person terms whose `grc` is borne by
 * two or more bearers render as named groups, the rest as singletons.
 * That grouping is driven entirely by the `grc` field the API ships on
 * person terms. If `grc` ever stops arriving — codegen dropping the
 * field from the wire schema, the greek-names curation losing the
 * homonym bearers, or the classifier rebucketing them — the UI silently
 * degrades to the old flat wall of 45 undifferentiated chips with no
 * error anywhere.
 *
 * This validator replicates the /api/competency/questions/:id term
 * building source-level for the homonymy question (same SPARQL, same
 * classifyExtraTerm path, same greekNameSpec grc assignment) and
 * asserts:
 *   1. the question yields person terms at all (positive control),
 *   2. every person term carries a `grc` value,
 *   3. grouping the person terms by `grc` — exactly the page's Zone C
 *      logic — yields at least one shared-form group of >= 2 bearers,
 *   4. the wire schema (GetCompetencyQuestionResponse) still preserves
 *      `grc` on terms, so codegen drift cannot strip the field the UI
 *      groups on.
 *
 * Positive counts are printed so a vacuous pass is impossible.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-competency-homonym-roster
 */
import path from "node:path";
import { Store } from "oxigraph";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { COMPETENCY_QUESTIONS } = await import(
  "../../artifacts/api-server/src/lib/competency"
);
const { graphAsTurtle, ontologyAsTurtle, LOD_BASE, ONT } = await import(
  "../../artifacts/api-server/src/lib/lod"
);
const { classifyExtraTerm } = await import(
  "../../artifacts/api-server/src/routes/competency"
);
const { getKnowledgeGraph, MOVEMENTS } = await import(
  "../../artifacts/api-server/src/lib/kg"
);
const { greekNameSpec } = await import(
  "../../artifacts/api-server/src/lib/greek-names"
);
const { GetCompetencyQuestionResponse } = await import(
  "../../lib/api-zod/src/generated/api"
);

const QUESTION_ID = "homonymy-proper-names";

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

const question = COMPETENCY_QUESTIONS.find((q) => q.id === QUESTION_ID);
check(`competency catalogue still contains ${QUESTION_ID}`, !!question);
if (!question) {
  console.error("validate-competency-homonym-roster FAILED");
  process.exit(1);
}

const store = new Store();
store.load(graphAsTurtle(), { format: "text/turtle" });
store.load(ontologyAsTurtle(), { format: "text/turtle" });

// --- Same rows extraction as the route ---
const rawJson = String(
  store.query(question.sparqlFn(LOD_BASE, ONT), { results_format: "json" }),
);
const parsed: SparqlResultsJson = JSON.parse(rawJson);
const variables = parsed.head?.vars ?? [];
const rows: string[][] = (parsed.results?.bindings ?? []).map((b) =>
  variables.map((v) => b[v]?.value ?? ""),
);
console.log(`Inputs: ${rows.length} SPARQL rows for ${QUESTION_ID}`);
check("homonymy SPARQL query returns rows (positive control)", rows.length > 0);

// --- Same term building as the route (routes/competency.ts) ---
const graph = getKnowledgeGraph();
const nodesByName = new Map(graph.nodes.map((n) => [n.name, n]));

const relevantNames = new Set<string>(question.seedLabels);
for (const row of rows) {
  for (const val of row) {
    if (nodesByName.has(val)) relevantNames.add(val);
  }
}
const subNodes = [...relevantNames]
  .map((name) => nodesByName.get(name))
  .filter((n): n is NonNullable<typeof n> => n !== undefined);
const movementIds = new Set(subNodes.map((n) => n.movement));
const subMovements = MOVEMENTS.filter((m) => movementIds.has(m.id));

const seenExtra = new Set<string>([
  ...subNodes.map((n) => n.name),
  ...subMovements.map((m) => m.label),
]);
const personTerms: Array<{ en: string; grc?: string }> = [];
for (const row of rows) {
  for (const val of row) {
    if (!val || seenExtra.has(val)) continue;
    seenExtra.add(val);
    const classified = classifyExtraTerm(store, val, question.personTermHints);
    if (!classified) continue;
    const { label, type } = classified;
    if (label !== val) {
      if (seenExtra.has(label)) continue;
      seenExtra.add(label);
    }
    if (type === "person") {
      // Same grc assignment as the route's person branch
      personTerms.push({ en: label, grc: greekNameSpec(label)?.grc });
    }
  }
}

console.log(`Person terms built for the Entities card: ${personTerms.length}`);
check(
  "homonymy question ships person terms (positive control)",
  personTerms.length > 0,
);

// --- Check 2: every person term carries a Greek form ---
// Reviewed exception: "Antigonus" is the deliberately formless
// claim-source authority (see the isPersonLabel comment in
// routes/competency.ts) — it buckets as a person via the LOD ASK, not
// the greek-names curation, and carries no curated grc by design. It
// renders as a singleton chip either way, so it cannot cause the flat
// fallback. Any OTHER person term losing its grc fails here.
const GRC_EXEMPT = new Set(["Antigonus"]);
const missingGrc = personTerms
  .filter((t) => !t.grc && !GRC_EXEMPT.has(t.en))
  .map((t) => t.en);
const exemptSeen = personTerms.filter((t) => !t.grc && GRC_EXEMPT.has(t.en));
if (exemptSeen.length > 0) {
  console.log(
    `  note: reviewed grc-less exceptions present: ${exemptSeen.map((t) => t.en).join(", ")}`,
  );
}
check(
  `all non-exempt person terms carry a grc Greek form` +
    (missingGrc.length ? ` (missing: ${missingGrc.join(", ")})` : ""),
  missingGrc.length === 0,
);

// --- Check 3: the page's Zone C grouping (pages/competency.tsx) yields
// at least one shared-form group of >= 2 bearers; otherwise the UI
// silently falls back to the flat chip wall ---
const byGrc = new Map<string, string[]>();
for (const t of personTerms) {
  if (!t.grc) continue;
  const arr = byGrc.get(t.grc) ?? [];
  arr.push(t.en);
  byGrc.set(t.grc, arr);
}
const shared = [...byGrc.entries()].filter(([, arr]) => arr.length > 1);
console.log(
  `Shared-form groups (>=2 bearers): ${shared.length}; ` +
    `grouped bearers: ${shared.reduce((n, [, arr]) => n + arr.length, 0)}; ` +
    `singletons: ${personTerms.length - shared.reduce((n, [, arr]) => n + arr.length, 0)}`,
);
check(
  "at least one Greek form is shared by >= 2 bearers (grouped roster, not the flat wall)",
  shared.length > 0,
);

// --- Check 4: the wire schema still preserves grc on terms, so codegen
// drift cannot strip the field the UI groups on ---
const sampleTerm = personTerms.find((t) => t.grc);
if (sampleTerm) {
  const parsedPayload = GetCompetencyQuestionResponse.parse({
    id: question.id,
    question: question.question,
    category: question.category,
    variables,
    rows: [],
    nodes: [],
    edges: [],
    movements: [],
    sectionIds: [],
    terms: [{ en: sampleTerm.en, grc: sampleTerm.grc, type: "person" }],
    passages: [],
  });
  const survived = parsedPayload.terms?.[0]?.grc === sampleTerm.grc;
  check(
    "GetCompetencyQuestionResponse wire schema preserves grc on person terms",
    survived === true,
  );
} else {
  check("a grc-bearing person term exists to probe the wire schema", false);
}

if (failures > 0) {
  console.error(`validate-competency-homonym-roster FAILED: ${failures} check(s)`);
  process.exit(1);
}
console.log("validate-competency-homonym-roster passed");
