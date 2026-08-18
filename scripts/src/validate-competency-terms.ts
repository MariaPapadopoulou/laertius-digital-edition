/**
 * Catches a competency term's firstId pointing at a section that never
 * names the entity.
 *
 * The terms panel on /competency links each philosopher/sage term chip to
 * /section/<firstId> (pages/competency.tsx). The route builds those terms
 * from KG nodes, whose firstId comes from the corpus chapter layout, while
 * the tagging layer (annotate.ts) independently decides which sections
 * actually carry a tag for the entity. A gazetteer or annotation change
 * could drift the two apart: the link would still open a rendered section,
 * so the browser test stays green, but the destination would never name
 * the entity the reader clicked.
 *
 * This validator replicates the /api/competency/questions/:id term
 * building source-level (same oxigraph store, same subgraph rules), then
 * for every term that carries a firstId it resolves the entity the way
 * the panel does (label match against the entities index, philosopher
 * kind first) and asserts the firstId is one of that entity's tagged
 * sections from sectionsForEntity(). Positive counts are printed so a
 * vacuous pass is impossible.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-competency-terms
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
const { getKnowledgeGraph } = await import(
  "../../artifacts/api-server/src/lib/kg"
);
const { graphAsTurtle, ontologyAsTurtle, LOD_BASE, ONT } = await import(
  "../../artifacts/api-server/src/lib/lod"
);
const { getIndexEntries, sectionsForEntity } = await import(
  "../../artifacts/api-server/src/lib/annotate"
);
const { MOVEMENTS } = await import("../../artifacts/api-server/src/lib/kg");
const { GREEK_SCHOOL_NAMES, greekNameSpec, greekWorkTitleSpec } = await import(
  "../../artifacts/api-server/src/lib/greek-names"
);
const { PLACE_TYPES } = await import(
  "../../artifacts/api-server/src/lib/place-ontology"
);
const { WORK_FACETS } = await import(
  "../../artifacts/api-server/src/lib/work-ontology"
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

const graph = getKnowledgeGraph();
const nodesByName = new Map(graph.nodes.map((n) => [n.name, n]));
const entries = getIndexEntries();

// The panel resolves a term's entity by label, philosopher kind first —
// same logic pinned by validate-competency-index-links.
function resolveLikePanel(name: string) {
  return (
    entries.find((e) => e.label === name && e.kind === "philosopher") ??
    entries.find((e) => e.label === name)
  );
}

console.log(
  `Inputs: ${COMPETENCY_QUESTIONS.length} competency questions, ` +
    `${graph.nodes.length} KG nodes, ${entries.length} index entries`,
);
check("competency catalogue is non-empty", COMPETENCY_QUESTIONS.length > 0);
check("knowledge graph has nodes", graph.nodes.length > 0);
check("entities index is non-empty", entries.length > 0);

const store = new Store();
store.load(graphAsTurtle(), { format: "text/turtle" });
store.load(ontologyAsTurtle(), { format: "text/turtle" });

let termsChecked = 0;
let uriRowValues = 0;
let movementLabelRowValues = 0;
const movementLabelSet = new Set(MOVEMENTS.map((m) => m.label));

// A SPARQL row value that is a resource URI (e.g. a lo:principalDoctrine
// object) must never ship as a term's en label. The route resolves such
// values to the resource's English rdfs:label; this validator asserts
// every URI-shaped row value actually HAS an en label in the store, and
// that the resolved label is not itself URI-shaped, so the resolution can
// never fall through to a raw web address chip.
const URI_SHAPED = /^https?:\/\//i;

// Same rule as the route's extra-terms classifier: is this English label
// borne by a person-typed resource in the LOD graph (lo:Person,
// lo:Philosopher, lo:Sage, or a lo:Source authority)? A value passing
// this test must never ship as a doctrine chip.
const GREEK_SCRIPT_RE = /[\u0370-\u03FF\u1F00-\u1FFF]/;
function isPersonLabel(label: string): boolean {
  const lit = label.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const rawJson = String(
    store.query(
      `ASK { ?s <http://www.w3.org/2000/01/rdf-schema#label> "${lit}"@en ; a ?t .
         FILTER(?t IN (<${ONT}Person>, <${ONT}Philosopher>, <${ONT}Sage>, <${ONT}Source>)) }`,
      { results_format: "json" },
    ),
  );
  const parsed: { boolean?: boolean } = JSON.parse(rawJson);
  return parsed.boolean === true;
}

const PLACE_NAMES = new Set(Object.keys(PLACE_TYPES));
const WORK_TITLES = new Set(Object.keys(WORK_FACETS));

// Analogous to isPersonLabel, for the place/work buckets: is this label
// borne by a lo:Place or lo:Work resource in the LOD graph? The route's
// place/work buckets key off the PLACE_TYPES/WORK_FACETS ontology key
// sets — if a place or work lost its ontology entry (or the bucket order
// changed), its name would fall through to the doctrine fallback. A value
// passing this test must never ship as a doctrine chip. Labels here are
// plain literals (no @en tag), so match on str().
function isPlaceOrWorkLabel(label: string): boolean {
  const lit = label.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const rawJson = String(
    store.query(
      `ASK { ?s <http://www.w3.org/2000/01/rdf-schema#label> ?l ; a ?t .
         FILTER(str(?l) = "${lit}")
         FILTER(?t IN (<${ONT}Place>, <${ONT}Work>)) }`,
      { results_format: "json" },
    ),
  );
  const parsed: { boolean?: boolean } = JSON.parse(rawJson);
  return parsed.boolean === true;
}

let personTermsTotal = 0;
let askOnlyPersonTerms = 0;
const personTermsByQuestion = new Map<string, number>();
let placeTermsTotal = 0;
let workTermsTotal = 0;
const placeTermsByQuestion = new Map<string, string[]>();

function enLabelFor(uri: string): string | undefined {
  const rawJson = String(
    store.query(
      `SELECT ?l WHERE { <${uri}> <http://www.w3.org/2000/01/rdf-schema#label> ?l }`,
      { results_format: "json" },
    ),
  );
  const parsed: SparqlResultsJson = JSON.parse(rawJson);
  const bindings = parsed.results?.bindings ?? [];
  const en =
    bindings.find(
      (b) => (b["l"] as { "xml:lang"?: string } | undefined)?.["xml:lang"] === "en",
    ) ?? bindings[0];
  return en?.["l"]?.value || undefined;
}

console.log("Term firstId targets per question:");
for (const q of COMPETENCY_QUESTIONS) {
  // Same rows extraction as the route (results_format json -> row values).
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

  // URI-shaped row values become extra terms in the route only after
  // resolving to an English rdfs:label; a URI with no label (or a
  // URI-shaped label) would either vanish or ship as a raw address chip.
  const uriProblems: string[] = [];
  const seenUris = new Set<string>();
  for (const row of rows) {
    for (const val of row) {
      if (!val || !URI_SHAPED.test(val) || seenUris.has(val)) continue;
      seenUris.add(val);
      uriRowValues++;
      const label = enLabelFor(val);
      if (!label) uriProblems.push(`${val}: no rdfs:label in the store`);
      else if (URI_SHAPED.test(label))
        uriProblems.push(`${val}: rdfs:label is itself URI-shaped ("${label}")`);
    }
  }
  if (seenUris.size > 0) {
    check(
      `${q.id}: all ${seenUris.size} URI-shaped row values resolve to a readable label` +
        (uriProblems.length ? ` (${uriProblems.join("; ")})` : ""),
      uriProblems.length === 0,
    );
  }

  // Same subgraph rule as the route: seed labels plus SPARQL row values,
  // keeping only names that are KG nodes. Those nodes are exactly the
  // terms that carry a firstId in the response.
  const relevantNames = new Set<string>(q.seedLabels);
  for (const row of rows) {
    for (const val of row) {
      if (nodesByName.has(val)) relevantNames.add(val);
    }
  }
  const subNodes = [...relevantNames]
    .map((name) => nodesByName.get(name))
    .filter((n): n is NonNullable<typeof n> => n !== undefined);

  const problems: string[] = [];
  for (const n of subNodes) {
    termsChecked++;
    if (!n.firstId) {
      problems.push(`${n.name}: empty firstId`);
      continue;
    }
    const entity = resolveLikePanel(n.name);
    if (!entity) {
      problems.push(`${n.name}: no entities-index entry to check tags against`);
      continue;
    }
    const tagged = sectionsForEntity(entity.entityUri);
    if (!tagged || tagged.length === 0) {
      problems.push(`${n.name}: entity has no tagged sections at all`);
      continue;
    }
    if (!tagged.includes(n.firstId)) {
      problems.push(
        `${n.name}: firstId ${n.firstId} is not among its ${tagged.length} tagged sections (first tagged: ${tagged[0]})`,
      );
    }
  }
  check(
    `${q.id}: all ${subNodes.length} term firstIds land on a section tagged for the entity` +
      (problems.length ? ` (${problems.join("; ")})` : ""),
    problems.length === 0 && subNodes.length > 0,
  );

  // School labels bound by the query (subMovements or not) must never
  // fall through to the doctrine branch of the extra-terms classifier.
  // The route ships each of these once, as a school term; here we scan
  // the rows for movement labels and count them, so the wiring pin below
  // is backed by real data hitting that branch.
  for (const row of rows) {
    for (const val of row) {
      if (val && movementLabelSet.has(val)) movementLabelRowValues++;
    }
  }

  // Replicate the route's extra-terms classifier (same dedupe seed, same
  // bucket order) and pin the doctrine bucket: no Greek-script value and
  // no person-borne label may land there. The route skips Greek forms and
  // routes person labels through greekNameSpec/isPersonLabel before the
  // doctrine fallback; if a corpus or query change (e.g. a person node
  // losing its lo:Person typing, or a curated name disappearing) pushed
  // person names back into the doctrine bucket, this fails.
  const movementIds = new Set(subNodes.map((n) => n.movement));
  const subMovementLabels = MOVEMENTS.filter((m) => movementIds.has(m.id)).map(
    (m) => m.label,
  );
  const seenExtra = new Set<string>([
    ...subNodes.map((n) => n.name),
    ...subMovementLabels,
  ]);
  let qPersonTerms = 0;
  const doctrineProblems: string[] = [];
  let doctrineCount = 0;
  for (const row of rows) {
    for (let val of row) {
      if (!val || seenExtra.has(val)) continue;
      seenExtra.add(val);
      if (URI_SHAPED.test(val)) {
        const label = enLabelFor(val);
        if (!label || URI_SHAPED.test(label) || seenExtra.has(label)) continue;
        seenExtra.add(label);
        val = label;
      }
      if (GREEK_SCRIPT_RE.test(val)) continue; // raw Greek form, never a chip
      // Per-question person-sense hints (CompetencyQuestion.personTermHints)
      // win before every lookup-table bucket, exactly like the route: in
      // the hinted question's rows the value denotes a person even though
      // its name collides with PLACE_TYPES/WORK_FACETS (Croton, Telauges).
      // Without this the replication counts Croton as a place term the
      // route actually ships as a PERSON, making the place positive
      // control below vacuously green.
      if (
        q.personTermHints?.includes(val) &&
        (greekNameSpec(val) !== undefined || isPersonLabel(val))
      ) {
        qPersonTerms++;
        personTermsTotal++;
        continue;
      }
      if (movementLabelSet.has(val)) continue; // school bucket
      if (PLACE_NAMES.has(val)) {
        placeTermsTotal++;
        const arr = placeTermsByQuestion.get(q.id) ?? [];
        arr.push(val);
        placeTermsByQuestion.set(q.id, arr);
        continue; // place bucket
      }
      if (WORK_TITLES.has(val)) {
        workTermsTotal++;
        continue; // work bucket
      }
      const curated = greekNameSpec(val) !== undefined;
      if (curated || isPersonLabel(val)) {
        qPersonTerms++;
        personTermsTotal++;
        if (!curated) askOnlyPersonTerms++;
        continue;
      }
      // Doctrine bucket: independently re-assert neither exclusion applies.
      doctrineCount++;
      if (GREEK_SCRIPT_RE.test(val))
        doctrineProblems.push(`Greek-script value "${val}" in doctrine bucket`);
      if (isPersonLabel(val))
        doctrineProblems.push(`person-borne label "${val}" in doctrine bucket`);
      if (isPlaceOrWorkLabel(val))
        doctrineProblems.push(
          `place- or work-borne label "${val}" in doctrine bucket`,
        );
    }
  }
  personTermsByQuestion.set(q.id, qPersonTerms);
  if (qPersonTerms > 0 || doctrineCount > 0) {
    check(
      `${q.id}: doctrine bucket (${doctrineCount}) holds no Greek-script or person-borne values; ${qPersonTerms} person term(s)` +
        (doctrineProblems.length ? ` (${doctrineProblems.join("; ")})` : ""),
      doctrineProblems.length === 0,
    );
  }
}

// Positive control: school-doctrines binds school labels (Stoa, Cynic,
// Cyrenaic, Epicurean (Garden)) as row values, so a scan that finds no
// movement labels in any question's rows means the check went vacuous.
check(
  `found ${movementLabelRowValues} movement-label row values across the catalogue (must be > 0)`,
  movementLabelRowValues > 0,
);

// Positive controls for the person/doctrine split: the homonymy question
// must actually exercise the person branch (currently 45 person terms —
// homonym bearers and sources that are not KG nodes), and at least one
// person term must have been caught by the LOD ASK alone (a person with
// no curated Greek form, e.g. the claim-source "Antigonus"), so neither
// path of the classifier's person branch can go vacuous.
const homonymyPersons = personTermsByQuestion.get("homonymy-proper-names") ?? 0;
check(
  `homonymy-proper-names exercises the person branch (${homonymyPersons} person terms, must be > 0)`,
  homonymyPersons > 0,
);
check(
  `person terms across the catalogue: ${personTermsTotal} total, ` +
    `${askOnlyPersonTerms} classified by the LOD ASK alone (both must be > 0)`,
  personTermsTotal > 0 && askOnlyPersonTerms > 0,
);

// Positive controls for the place/work buckets: the classifier loop must
// have actually routed row values into both buckets, otherwise the
// doctrine-bucket assertion above never sees the values it protects.
check(
  `place terms across the catalogue: ${placeTermsTotal} classified (must be > 0)`,
  placeTermsTotal > 0,
);
// Pin the place showcase: born-in-athens (People & Places, greekTerm
// Ἀθῆναι) deliberately projects its ?birthplace label so it ships a
// place chip with a curated Greek form. A query or classification change
// that stops "Athens" bucketing as a place term here (e.g. the value
// getting swallowed by a hint, a movement label, or dropping out of
// PLACE_TYPES) would silently re-idle the place branch of both the route
// and the e2e bilingual-terms check.
const bornInAthensPlaces = placeTermsByQuestion.get("born-in-athens") ?? [];
check(
  `born-in-athens classifies "Athens" as a place term (got: ${bornInAthensPlaces.join(", ") || "none"})`,
  bornInAthensPlaces.includes("Athens"),
);
const athensGrc = greekNameSpec("Athens")?.grc;
check(
  `the place chip's curated Greek form is real Greek ("${athensGrc ?? ""}")`,
  !!athensGrc && GREEK_SCRIPT_RE.test(athensGrc),
);
check(
  `work terms across the catalogue: ${workTermsTotal} classified (must be > 0)`,
  workTermsTotal > 0,
);

// Guard the ASK itself against going vacuous (wrong namespace / typing
// drift): at least one known place name and one known work title from the
// ontology key sets must be found as a lo:Place / lo:Work label in the
// LOD graph.
const askPlaceHits = [...PLACE_NAMES].filter((n) => isPlaceOrWorkLabel(n)).length;
const askWorkHits = [...WORK_TITLES].filter((t) => isPlaceOrWorkLabel(t)).length;
check(
  `place/work ASK finds ontology names in the LOD graph (${askPlaceHits}/${PLACE_NAMES.size} places, ${askWorkHits}/${WORK_TITLES.size} works, both must be > 0)`,
  askPlaceHits > 0 && askWorkHits > 0,
);
check(
  "negative control: a bogus label is not a place/work label",
  !isPlaceOrWorkLabel("No Such Place Or Work XYZ"),
);

// Reverse-drift guard: the classifier routes row values into the school,
// place, and work buckets BEFORE the doctrine fallback, keyed on exact
// label match. If a curated work title (WORK_FACETS key), place name
// (PLACE_TYPES key), or movement label ever coincided with a genuine
// doctrine label, the doctrine chip would be silently reclassified and
// vanish from the Doctrines list. Scan every lo:Doctrine label in the
// LOD graph (the superset of anything a query can bind as a doctrine,
// incl. lo:principalDoctrine targets) and assert none collides.
console.log("Doctrine-label collisions:");
const doctrineLabelsRaw = String(
  store.query(
    `SELECT DISTINCT ?l WHERE { ?d a <${ONT}Doctrine> ; <http://www.w3.org/2000/01/rdf-schema#label> ?l }`,
    { results_format: "json" },
  ),
);
const doctrineLabelsParsed: SparqlResultsJson = JSON.parse(doctrineLabelsRaw);
const doctrineLabels = (doctrineLabelsParsed.results?.bindings ?? [])
  .map((b) => b["l"]?.value ?? "")
  .filter((l) => l.length > 0);
function collisionsFor(label: string): string[] {
  const hits: string[] = [];
  if (PLACE_NAMES.has(label))
    hits.push(`doctrine label "${label}" is also a PLACE_TYPES key`);
  if (WORK_TITLES.has(label))
    hits.push(`doctrine label "${label}" is also a WORK_FACETS key`);
  if (movementLabelSet.has(label))
    hits.push(`doctrine label "${label}" is also a movement label`);
  return hits;
}
const collisionProblems = doctrineLabels.flatMap(collisionsFor);
check(
  `scanned ${doctrineLabels.length} doctrine labels (must be > 0) against ` +
    `${PLACE_NAMES.size} place names, ${WORK_TITLES.size} work titles, ` +
    `${movementLabelSet.size} movement labels — no collisions` +
    (collisionProblems.length ? ` (${collisionProblems.join("; ")})` : ""),
  doctrineLabels.length > 0 && collisionProblems.length === 0,
);
// Negative control: the collision test itself must be able to fire — a
// known work title fed through the same detector must report a collision.
const firstWorkTitle = [...WORK_TITLES][0];
check(
  `negative control: work title "${firstWorkTitle}" fed to the detector collides`,
  firstWorkTitle !== undefined && collisionsFor(firstWorkTitle).length > 0,
);

// Positive control: the loop above must have actually checked terms.
check(
  `checked ${termsChecked} term firstIds in total (must be > 0)`,
  termsChecked > 0,
);

// Pin: no question ships URI-shaped row values any more. school-doctrines
// used to bind raw doctrine URIs; its SPARQL now binds rdfs:label, so a
// results table can never show a web address. If a future question emits a
// URI-shaped value again, this fails, and the per-question label check
// above covers whether it would at least resolve to a readable chip.
check(
  `no URI-shaped row values in any question's results (found ${uriRowValues})`,
  uriRowValues === 0,
);

// School terms ship bilingually: every movement label except the
// "Unaffiliated" curatorial bucket must have a curated Greek school name
// (real Greek letters, not Latin or empty), Unaffiliated must have NONE
// (it is not a school and renders English-only), and the map may not
// carry orphan keys that no movement label matches (a renamed movement
// would silently drop its Greek chip otherwise).
console.log("Greek school names:");
const GREEK_RE = /[\u0370-\u03FF\u1F00-\u1FFF]/;
const schoolGrcProblems: string[] = [];
for (const m of MOVEMENTS) {
  if (m.label === "Unaffiliated") continue;
  const grc = GREEK_SCHOOL_NAMES[m.label];
  if (!grc || !GREEK_RE.test(grc))
    schoolGrcProblems.push(`${m.label}: no real Greek form ("${grc ?? ""}")`);
}
check(
  `every school label except Unaffiliated has a Greek form` +
    (schoolGrcProblems.length ? ` (${schoolGrcProblems.join("; ")})` : ""),
  schoolGrcProblems.length === 0,
);
check(
  "Unaffiliated carries no Greek school form",
  GREEK_SCHOOL_NAMES["Unaffiliated"] === undefined,
);
const orphanKeys = Object.keys(GREEK_SCHOOL_NAMES).filter(
  (k) => !movementLabelSet.has(k),
);
check(
  `GREEK_SCHOOL_NAMES has no orphan keys` +
    (orphanKeys.length ? ` (${orphanKeys.join(", ")})` : ""),
  orphanKeys.length === 0,
);

// Negative control: the tagged-section check must be able to fail — a
// section id that is not in any entity's tag list must not pass.
const control = resolveLikePanel("Plato");
check(
  "negative control: a bogus section id is rejected for Plato",
  control !== undefined &&
    !(sectionsForEntity(control.entityUri) ?? []).includes("9.99.999"),
);

// Wiring pins: the invariant only covers the real code path while the
// route keeps sourcing firstId from KG nodes and the panel keeps linking
// term chips to /section/<firstId>.
console.log("Wiring:");
const routeSource = readFileSync(
  path.resolve(
    import.meta.dirname,
    "../../artifacts/api-server/src/routes/competency.ts",
  ),
  "utf8",
);
check(
  "competency route builds philosopher terms with firstId: n.firstId",
  routeSource.includes("firstId: n.firstId"),
);
// A movement label bound as a row value must ship as a school term, never
// a doctrine chip: the route must seed its dedupe set with the subgraph's
// movement labels and test movementLabels before the doctrine fallback.
check(
  "competency route seeds seenExtra with subMovements labels",
  routeSource.includes("...subMovements.map((m) => m.label)"),
);
// personTermHints wiring: the route must test the per-question hints
// BEFORE the movement/place/work lookup tables — otherwise a hinted
// person label colliding with those tables (Croton the city, Telauges
// the dialogue) would rebucket, and the hint replication above would no
// longer mirror the served classification.
check(
  "competency route applies personTermHints before the lookup-table buckets",
  /personHints\?\.includes\(val\)[\s\S]{0,900}?type: "person"/.test(routeSource) &&
    routeSource.indexOf("personHints?.includes(val)") <
      routeSource.indexOf("MOVEMENT_LABELS.has(val)"),
);
check(
  "competency route classifies movement-label row values as school terms",
  /MOVEMENT_LABELS\.has\(val\)[\s\S]{0,300}?type: "school"/.test(routeSource) &&
    routeSource.indexOf("MOVEMENT_LABELS.has(val)") <
      routeSource.indexOf("PLACE_NAMES.has(val)"),
);
// Both school-term builders must attach the curated Greek school name,
// so the bilingual contract covers subgraph movements AND row-value
// schools alike.
check(
  "competency route builds subgraph school terms with grc: greekSchoolGrc(m.label)",
  routeSource.includes("grc: greekSchoolGrc(m.label)"),
);
check(
  "competency route builds row-value school terms with grc: greekSchoolGrc(label)",
  routeSource.includes("grc: greekSchoolGrc(label)"),
);
// Person/doctrine split wiring: the route must keep skipping raw
// Greek-script row values before any bucket, and must test
// greekNameSpec/isPersonLabel (shipping a person term) BEFORE the
// doctrine fallback — otherwise the doctrine-bucket assertions above run
// against replicated rules the route no longer follows.
check(
  "competency route skips Greek-script row values before classification",
  /GREEK_SCRIPT\.test\(val\)\)\s*return null/.test(routeSource) &&
    routeSource.indexOf("GREEK_SCRIPT.test(val)) return null") <
      routeSource.indexOf("MOVEMENT_LABELS.has(val)"),
);
// Place/work split wiring: the route must keep routing PLACE_NAMES /
// WORK_TITLES hits into their own buckets, in that order, BEFORE the
// doctrine fallback — otherwise the doctrine-bucket place/work assertion
// above runs against replicated rules the route no longer follows.
check(
  "competency route classifies PLACE_NAMES row values as place terms",
  /PLACE_NAMES\.has\(val\)[\s\S]{0,120}?type: "place"/.test(routeSource) &&
    routeSource.indexOf("PLACE_NAMES.has(val)") <
      routeSource.indexOf("WORK_TITLES.has(val)"),
);
check(
  "competency route classifies WORK_TITLES row values as work terms",
  /WORK_TITLES\.has\(val\)[\s\S]{0,120}?type: "work"/.test(routeSource) &&
    routeSource.indexOf("WORK_TITLES.has(val)") <
      routeSource.indexOf('type: "doctrine"'),
);
check(
  'competency route classifies person labels before the doctrine fallback',
  /greekNameSpec\(val\) \|\| isPersonLabel\(store, val\)[\s\S]{0,800}?type: "person"/.test(
    routeSource,
  ) &&
    routeSource.indexOf("isPersonLabel(store, val)") <
      routeSource.indexOf('type: "doctrine"'),
);
const pageSource = readFileSync(
  path.resolve(
    import.meta.dirname,
    "../../artifacts/laertius/src/pages/competency.tsx",
  ),
  "utf8",
);
check(
  "competency.tsx links term chips to /section/${t.firstId}",
  pageSource.includes("`/section/${t.firstId}`"),
);

if (failures > 0) {
  console.error(`\nvalidate-competency-terms: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nvalidate-competency-terms: all checks passed");
