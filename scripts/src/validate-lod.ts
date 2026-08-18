/**
 * Validates the linked-open-data exports: parses graphAsTurtle() and
 * ontologyAsTurtle() with n3 (a single unescaped quote or newline in
 * curated data would make them unparseable), asserts the JSON-LD output
 * survives a JSON round-trip, and checks that the deduped Turtle triple
 * count equals the RDF/XML property-element count for both graphs.
 *
 * Run from the workspace root (LAERTIUS_DATA_DIR is optional; it defaults
 * to the api-server data directory):
 *   pnpm --filter @workspace/scripts run validate-lod
 */
import fs from "node:fs";
import path from "node:path";

import {
  CHAPTER_SUBJECT_PIN_COUNT,
  PHILOSOPHER_NODE_PIN_COUNT,
  SAGE_PIN_COUNT,
} from "./layer-pins";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

let failed = false;

// Import-isolation check for the test-only collision-guard hooks: the hooks
// can reset module-private state in lod.ts, so nothing outside this validator
// may ever reference them. Scans all workspace TypeScript sources and fails
// if the token appears anywhere except lod.ts (the definition) and this file.
{
  const repoRoot = path.resolve(import.meta.dirname, "../..");
  const scanRoots = ["artifacts", "lib", "scripts"].map((d) =>
    path.join(repoRoot, d),
  );
  const skipDirs = new Set(["node_modules", "dist", "build", ".git", "data"]);
  const allowed = new Set([
    path.join(repoRoot, "artifacts/api-server/src/lib/lod.ts"),
    path.join(repoRoot, "scripts/src/validate-lod.ts"),
  ]);
  const offenders: string[] = [];
  let scanned = 0;
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) walk(full);
      } else if (/\.(ts|tsx|mts|cts|js|mjs|cjs)$/.test(entry.name)) {
        scanned++;
        if (
          fs.readFileSync(full, "utf8").includes("__collisionGuardTestHooks") &&
          !allowed.has(full)
        ) {
          offenders.push(path.relative(repoRoot, full));
        }
      }
    }
  };
  for (const root of scanRoots) walk(root);
  if (scanned < 100) {
    failed = true;
    console.error(
      `HOOK ISOLATION SCAN BROKEN: only ${scanned} source files scanned (wrong roots?)`,
    );
  }
  if (offenders.length > 0) {
    failed = true;
    console.error(
      "TEST-ONLY HOOKS LEAKED: __collisionGuardTestHooks is referenced outside " +
        `lod.ts and validate-lod.ts (it can reset module-private collision state):`,
    );
    for (const f of offenders) console.error(`  >> ${f}`);
  } else {
    console.log(
      `test-only collision-guard hooks isolated (${scanned} files scanned): OK`,
    );
  }
}

const {
  graphAsTurtle,
  ontologyAsTurtle,
  graphAsJsonLd,
  graphAsRdfXml,
  annotatedGraphAsTurtle,
  annotatedGraphAsRdfXml,
  ontologyAsRdfXml,
  sectionQuads,
  sectionAsJsonLd,
  sectionAsRdfXml,
  voidAsTurtle,
  voidStats,
  LOD_BASE,
  __collisionGuardTestHooks,
} = await import("../../artifacts/api-server/src/lib/lod");
const { getClaims } = await import(
  "../../artifacts/api-server/src/lib/kg-claims"
);
const { sectionIdForRef } = await import(
  "../../artifacts/api-server/src/lib/claims-answer"
);
const { verses } = await import("../../artifacts/api-server/src/lib/verses");
const { getSourcesIndex } = await import(
  "../../artifacts/api-server/src/lib/sources-index"
);
const {
  WORK_FACETS,
  WORK_DECADES,
  WORK_FORM_INDIVIDUAL,
  WORK_TOPIC_INDIVIDUAL,
  WORK_SURVIVAL_INDIVIDUAL,
} = await import("../../artifacts/api-server/src/lib/work-ontology");
const {
  ALIGNMENT_PREFIXES,
  CLASS_BRIDGES,
  PROPERTY_BRIDGES,
  CONCEPT_MAPPINGS,
  UNMAPPED_CONCEPTS,
  VOCAB_CLASSES_UNDER_SKOS,
} = await import("../../artifacts/api-server/src/lib/ontology-alignments");
const { PERSON_ROLE_INDIVIDUAL } = await import(
  "../../artifacts/api-server/src/lib/person-ontology"
);
const { slugify } = await import("../../artifacts/api-server/src/lib/kg");
const { unicodeSlug } = await import(
  "../../artifacts/api-server/src/lib/kg-claims"
);
const { annotateSection } = await import(
  "../../artifacts/api-server/src/lib/annotate"
);
const { sectionById } = await import(
  "../../artifacts/api-server/src/lib/corpus"
);
const { Parser: N3Parser } = await import("n3");
const { XMLValidator } = await import("fast-xml-parser");
type Quad = import("n3").Quad;

function parseTurtle(label: string, turtle: string): Quad[] {
  try {
    return new N3Parser().parse(turtle);
  } catch (err) {
    failed = true;
    console.error(`TURTLE PARSE FAILED (${label}):`);
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    const m = /line (\d+)/.exec(err instanceof Error ? err.message : "");
    if (m) {
      const line = Number(m[1]);
      const lines = turtle.split("\n");
      const from = Math.max(0, line - 4);
      const to = Math.min(lines.length, line + 3);
      console.error(`  Context (lines ${from + 1}-${to}):`);
      for (let i = from; i < to; i++) {
        const marker = i + 1 === line ? ">>" : "  ";
        console.error(`  ${marker} ${i + 1}: ${lines[i]}`);
      }
    }
    return [];
  }
}

/** Deduped triple count, using the same signature as the RDF/XML serializer. */
function dedupedCount(quads: Quad[]): number {
  const seen = new Set<string>();
  for (const q of quads) {
    const o = q.object;
    const sig =
      `${q.subject.termType === "BlankNode" ? "_:" : ""}${q.subject.value}` +
      `\u0001${q.predicate.value}\u0001${o.termType}\u0001${o.value}` +
      `\u0001${o.termType === "Literal" ? o.language : ""}` +
      `\u0001${o.termType === "Literal" ? o.datatype.value : ""}`;
    seen.add(sig);
  }
  return seen.size;
}

/**
 * Count property elements in our RDF/XML output. Every property element is
 * emitted on its own line with a 4-space indent; raw "<" in literal text is
 * always escaped to "&lt;", so no other line can start with "    <"
 * (namespace decls start with "    xmlns", continuation lines of multiline
 * literals cannot begin with an unescaped "<").
 */
function rdfXmlPropertyCount(xml: string): number {
  return xml.split("\n").filter((l) => l.startsWith("    <")).length;
}

function checkGraph(
  label: string,
  turtle: string,
  rdfXml: string,
): { triples: number; quads: Quad[] } {
  const quads = parseTurtle(label, turtle);
  if (quads.length === 0) return { triples: 0, quads };
  const xmlCheck = XMLValidator.validate(rdfXml);
  if (xmlCheck !== true) {
    failed = true;
    console.error(`RDF/XML NOT WELL-FORMED (${label}):`);
    console.error(
      `  line ${xmlCheck.err.line}, col ${xmlCheck.err.col}: ${xmlCheck.err.msg}`,
    );
    const lines = rdfXml.split("\n");
    const bad = lines[xmlCheck.err.line - 1];
    if (bad !== undefined) console.error(`  >> ${bad}`);
    return { triples: 0, quads: [] };
  }
  const triples = dedupedCount(quads);
  const xmlProps = rdfXmlPropertyCount(rdfXml);
  if (triples !== xmlProps) {
    failed = true;
    console.error(
      `TRIPLE COUNT MISMATCH (${label}): ` +
        `Turtle has ${triples} deduped triples, RDF/XML has ${xmlProps} property elements`,
    );
  }
  return { triples, quads };
}

// Negative test for the collision-set init-order guard: before ANY graph
// serialization has run, the collision sets are unseeded, and the per-entity
// ProperName helpers must THROW rather than silently return shared name URIs.
// This proves the guard fires if a future serializer forgets to seed the sets.
// Safe to run here: the sets re-seed lazily on the first graph call below.
{
  const hooks = __collisionGuardTestHooks;
  hooks.resetCollisionSets();
  const entityUri = `${LOD_BASE}/philosopher/zeno-of-citium`;
  const expectThrow = (label: string, fn: () => string) => {
    let threw = false;
    try {
      fn();
    } catch (err) {
      threw = true;
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("init-order bug")) {
        failed = true;
        console.error(
          `GUARD WRONG ERROR (${label}): threw, but not the init-order guard: ${msg}`,
        );
      }
    }
    if (!threw) {
      failed = true;
      console.error(
        `GUARD DID NOT FIRE (${label}): returned a name URI with unseeded collision sets`,
      );
    }
  };
  expectThrow("perEntityGrcNameUri", () =>
    hooks.callPerEntityGrcNameUri("Ζήνων", entityUri),
  );
  expectThrow("perEntityEnNameUri", () =>
    hooks.callPerEntityEnNameUri("Zeno of Citium", entityUri),
  );
  if (hooks.collisionSetsSeeded()) {
    failed = true;
    console.error(
      "GUARD TEST BROKEN: collision sets are seeded before the first serialization",
    );
  }
  console.log("collision-set init-order guard fires when unseeded: OK");
}

const graph = checkGraph("graph.ttl", graphAsTurtle(), graphAsRdfXml());
if (!__collisionGuardTestHooks.collisionSetsSeeded()) {
  failed = true;
  console.error(
    "COLLISION SETS NOT SEEDED after graph serialization: lazy re-seed broken",
  );
}
const ontology = checkGraph(
  "ontology.ttl",
  ontologyAsTurtle(),
  ontologyAsRdfXml(),
);

// Annotated full-graph export: the whole graph plus every lo:Passage node
// and the complete stand-off oa:Annotation layer. Must contain the plain
// full graph as a strict subset, one oa:Annotation per deterministic tag
// (the 8423 pinned by validate-annotations), one passage per tagged
// section, and every annotation body must be a described subject.
const annotated = checkGraph(
  "graph-annotated.ttl",
  annotatedGraphAsTurtle(),
  annotatedGraphAsRdfXml(),
);
{
  const OA = "http://www.w3.org/ns/oa#";
  const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
  const annErr = (msg: string): void => {
    failed = true;
    console.error(`ANNOTATED GRAPH FAILED: ${msg}`);
  };
  const tripleSig = (q: Quad): string => {
    const o = q.object;
    return (
      `${q.subject.termType}\u0001${q.predicate.value}\u0001${o.termType}\u0001${o.value}` +
      `\u0001${o.termType === "Literal" ? o.language : ""}` +
      `\u0001${o.termType === "Literal" ? o.datatype.value : ""}` +
      `\u0001${q.subject.termType === "NamedNode" ? q.subject.value : ""}`
    );
  };
  // Subset check on named-subject triples only (blank-node labels differ
  // between independent parses, so blank-rooted triples can't be compared
  // by signature).
  const annotatedSigs = new Set(
    annotated.quads
      .filter((q) => q.subject.termType === "NamedNode")
      .map(tripleSig),
  );
  let missing = 0;
  for (const q of graph.quads) {
    if (q.subject.termType !== "NamedNode") continue;
    if (!annotatedSigs.has(tripleSig(q))) missing += 1;
  }
  if (missing > 0) {
    annErr(
      `${missing} named-subject triples of graph.ttl are missing from graph-annotated.ttl`,
    );
  }
  let expectedAnns = 0;
  let expectedPassages = 0;
  let expectedExtraBodies = 0;
  for (const s of sectionById.values()) {
    const tags = annotateSection(s);
    expectedAnns += tags.length;
    for (const t of tags) {
      if (t.nameUri) expectedExtraBodies += 1;
      expectedExtraBodies += t.conceptUris?.length ?? 0;
    }
    if (tags.length > 0) expectedPassages += 1;
  }
  const annNodes = annotated.quads.filter(
    (q) =>
      q.predicate.value === RDF_TYPE && q.object.value === `${OA}Annotation`,
  ).length;
  if (annNodes !== expectedAnns) {
    annErr(
      `${annNodes} oa:Annotation nodes, tagger produced ${expectedAnns}`,
    );
  }
  const passageNodes = annotated.quads.filter(
    (q) =>
      q.predicate.value === RDF_TYPE &&
      q.object.value === `${LOD_BASE}/ontology#Passage`,
  ).length;
  if (passageNodes !== expectedPassages) {
    annErr(
      `${passageNodes} lo:Passage nodes, expected ${expectedPassages} tagged sections`,
    );
  }
  const subjects = new Set(
    annotated.quads.map((q) =>
      q.subject.termType === "BlankNode"
        ? `_:${q.subject.value}`
        : q.subject.value,
    ),
  );
  // OTV double dimension: name tags carry a second, linguistic body (the
  // otv:ProperName node) alongside the conceptual one; term tags body the
  // otv:Term plus each doctrine otv:Concept the term denotes.
  const bodies = annotated.quads.filter(
    (q) => q.predicate.value === `${OA}hasBody`,
  );
  const expectedBodies = expectedAnns + expectedExtraBodies;
  if (bodies.length !== expectedBodies) {
    annErr(
      `${bodies.length} oa:hasBody quads, expected ${expectedBodies} ` +
        `(${expectedAnns} annotations + ${expectedExtraBodies} name/concept bodies)`,
    );
  }
  let undescribed = 0;
  for (const b of bodies) {
    if (!subjects.has(b.object.value)) undescribed += 1;
  }
  if (undescribed > 0) {
    annErr(`${undescribed} annotation bodies are not described subjects`);
  }
  const exactCount = annotated.quads.filter(
    (q) => q.predicate.value === `${OA}exact`,
  ).length;
  const startCount = annotated.quads.filter(
    (q) => q.predicate.value === `${OA}start`,
  ).length;
  if (exactCount !== expectedAnns || startCount !== expectedAnns) {
    annErr(
      `selector mismatch: ${exactCount} oa:exact / ${startCount} oa:start, expected ${expectedAnns} each`,
    );
  }
}

// JSON-LD: the route serializes graphAsJsonLd() with JSON.stringify, so
// assert the object survives a full stringify -> parse round-trip and has
// the expected top-level shape.
type JsonLdNode = { "@id"?: string; "@type"?: unknown } & Record<
  string,
  unknown
>;
let jsonLdNodes = 0;
let jsonLdGraph: JsonLdNode[] = [];
try {
  const jsonld = JSON.parse(JSON.stringify(graphAsJsonLd())) as {
    "@context"?: unknown;
    "@graph"?: unknown[];
  };
  if (typeof jsonld !== "object" || jsonld === null) {
    throw new Error("JSON-LD output is not an object");
  }
  if (!jsonld["@context"]) throw new Error("JSON-LD output has no @context");
  if (!Array.isArray(jsonld["@graph"]) || jsonld["@graph"].length === 0) {
    throw new Error("JSON-LD output has no non-empty @graph array");
  }
  jsonLdNodes = jsonld["@graph"].length;
  jsonLdGraph = jsonld["@graph"] as JsonLdNode[];
} catch (err) {
  failed = true;
  console.error("JSON-LD ROUND-TRIP FAILED:");
  console.error(`  ${err instanceof Error ? err.message : String(err)}`);
}

// ---------------------------------------------------------------- OTV layer
// The graph carries an ontoterminological layer (Christophe Roche's OTV):
// otv:Concept / otv:Term / otv:ProperName nodes with denotation links.
const OTV = "http://www.ontologia.fr/OTB/otv#";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const ONT_NS = `${LOD_BASE}/ontology#`;
let otvSummary = "";
{
  const q = graph.quads;
  const typesBySubject = new Map<string, Set<string>>();
  const quadIndex = new Set<string>();
  for (const quad of q) {
    if (quad.predicate.value === RDF_TYPE) {
      const set = typesBySubject.get(quad.subject.value) ?? new Set();
      set.add(quad.object.value);
      typesBySubject.set(quad.subject.value, set);
    }
    quadIndex.add(
      `${quad.subject.value}\u0001${quad.predicate.value}\u0001${quad.object.value}`,
    );
  }
  const has = (s: string, p: string, o: string) =>
    quadIndex.has(`${s}\u0001${p}\u0001${o}`);
  const subjectsTyped = (type: string) =>
    new Set(
      [...typesBySubject.entries()]
        .filter(([, t]) => t.has(type))
        .map(([s]) => s),
    );
  const otvErr = (msg: string) => {
    failed = true;
    console.error(`OTV CHECK FAILED: ${msg}`);
  };

  const concepts = subjectsTyped(`${OTV}Concept`);
  const terms = subjectsTyped(`${OTV}Term`);
  const properNames = subjectsTyped(`${OTV}ProperName`);
  if (concepts.size === 0) otvErr("no otv:Concept nodes in graph.ttl");
  if (terms.size === 0) otvErr("no otv:Term nodes in graph.ttl");
  if (properNames.size === 0) otvErr("no otv:ProperName nodes in graph.ttl");

  // Every lo:GreekTerm is also otv:Term; every lo:Doctrine also otv:Concept.
  for (const s of subjectsTyped(`${ONT_NS}GreekTerm`)) {
    if (!terms.has(s)) otvErr(`lo:GreekTerm ${s} is not typed otv:Term`);
  }
  for (const s of subjectsTyped(`${ONT_NS}Doctrine`)) {
    if (!concepts.has(s)) otvErr(`lo:Doctrine ${s} is not typed otv:Concept`);
  }

  // Per-subject property maps for shape checks.
  const propsBySubject = new Map<string, Map<string, Quad[]>>();
  for (const quad of q) {
    let m = propsBySubject.get(quad.subject.value);
    if (!m) propsBySubject.set(quad.subject.value, (m = new Map()));
    const arr = m.get(quad.predicate.value) ?? [];
    arr.push(quad);
    m.set(quad.predicate.value, arr);
  }

  // ProperName shape: >=1 otv:properName literal, otv:language, >=1
  // otv:denotedObject whose target holds the inverse otv:denotedByProperName.
  for (const s of properNames) {
    const props = propsBySubject.get(s) ?? new Map<string, Quad[]>();
    if (!props.has(`${OTV}properName`)) otvErr(`${s} has no otv:properName`);
    if (!props.has(`${OTV}language`)) otvErr(`${s} has no otv:language`);
    const denoted = props.get(`${OTV}denotedObject`) ?? [];
    if (denoted.length !== 1) otvErr(`${s} must have exactly one otv:denotedObject (got ${denoted.length})`);
    for (const d of denoted) {
      if (!has(d.object.value, `${OTV}denotedByProperName`, s)) {
        otvErr(
          `${d.object.value} lacks inverse otv:denotedByProperName -> ${s}`,
        );
      }
    }
  }

  // owl:differentFrom shape: each pair must link two person-like nodes
  // (corpus philosopher/sage, lo:Person, or lo:Source authority), must be
  // symmetric (A->B implies B->A), and no node may be differentFrom itself.
  {
    const OWL_DIFFERENT_FROM = "http://www.w3.org/2002/07/owl#differentFrom";
    const isPersonLike = (uri: string): boolean => {
      const types = typesBySubject.get(uri);
      if (!types) return false;
      return (
        types.has(`${ONT_NS}Philosopher`) ||
        types.has(`${ONT_NS}Sage`) ||
        types.has(`${ONT_NS}Person`) ||
        types.has(`${ONT_NS}Source`) ||
        types.has("http://xmlns.com/foaf/0.1/Person")
      );
    };
    const diffFromPairs = q.filter(
      (quad) => quad.predicate.value === OWL_DIFFERENT_FROM,
    );
    for (const quad of diffFromPairs) {
      const s = quad.subject.value;
      const o = quad.object.value;
      if (s === o) otvErr(`owl:differentFrom self-reference on ${s}`);
      if (!isPersonLike(s))
        otvErr(`owl:differentFrom subject ${s} is not a person-like node`);
      if (!isPersonLike(o))
        otvErr(`owl:differentFrom object ${o} is not a person-like node`);
      if (!has(o, OWL_DIFFERENT_FROM, s))
        otvErr(`owl:differentFrom not symmetric: ${s} -> ${o} but not ${o} -> ${s}`);
    }
  }

  // Term shape: otv:termName + otv:language "grc"; denotedByTerm inverse.
  for (const s of terms) {
    const props = propsBySubject.get(s) ?? new Map<string, Quad[]>();
    if (!props.has(`${OTV}termName`)) otvErr(`${s} has no otv:termName`);
    const langs = props.get(`${OTV}language`) ?? [];
    if (!langs.some((l) => l.object.value === "grc")) {
      otvErr(`${s} has no otv:language "grc"`);
    }
  }
  for (const quad of q) {
    if (quad.predicate.value !== `${OTV}denotedByTerm`) continue;
    if (!has(quad.object.value, `${OTV}denotedConcept`, quad.subject.value)) {
      otvErr(
        `${quad.object.value} lacks inverse otv:denotedConcept -> ${quad.subject.value}`,
      );
    }
  }

  // instanceOf discipline: targets are otv:Concept; concepts (doctrines
  // included) never carry otv:instanceOf (Concept and Object are disjoint).
  const instanceOfSubjects = new Set<string>();
  for (const quad of q) {
    if (quad.predicate.value !== `${OTV}instanceOf`) continue;
    instanceOfSubjects.add(quad.subject.value);
    if (!concepts.has(quad.object.value)) {
      otvErr(`otv:instanceOf target ${quad.object.value} is not otv:Concept`);
    }
  }
  for (const s of concepts) {
    if (instanceOfSubjects.has(s)) {
      otvErr(`otv:Concept ${s} carries otv:instanceOf (disjointness breach)`);
    }
  }

  // Turtle <-> JSON-LD parity on the OTV layer, compared as @id SETS (URI
  // collisions between movement schools and claim schools make raw node
  // counts unreliable).
  const jsonIdsWhere = (pred: (n: JsonLdNode) => boolean) =>
    new Set(
      jsonLdGraph.filter(pred).map((n) => n["@id"]).filter((x): x is string => !!x),
    );
  const typeIncludes = (n: JsonLdNode, t: string) =>
    Array.isArray(n["@type"]) ? n["@type"].includes(t) : n["@type"] === t;
  const expandId = (id: string) => id; // JSON-LD @ids are absolute already
  const comparisons: [string, Set<string>, Set<string>][] = [
    [
      "otv:Concept nodes",
      concepts,
      jsonIdsWhere((n) => typeIncludes(n, "otv:Concept")),
    ],
    [
      "otv:Term nodes",
      terms,
      jsonIdsWhere((n) => typeIncludes(n, "otv:Term")),
    ],
    [
      "otv:ProperName nodes",
      properNames,
      jsonIdsWhere((n) => typeIncludes(n, "otv:ProperName")),
    ],
    [
      "otv:instanceOf subjects",
      instanceOfSubjects,
      jsonIdsWhere((n) => "otv:instanceOf" in n),
    ],
  ];
  for (const [label, turtleSet, jsonSet] of comparisons) {
    const jsonExpanded = new Set([...jsonSet].map(expandId));
    const missing = [...turtleSet].filter((s) => !jsonExpanded.has(s));
    const extra = [...jsonExpanded].filter((s) => !turtleSet.has(s));
    if (missing.length > 0 || extra.length > 0) {
      otvErr(
        `${label} differ between Turtle and JSON-LD ` +
          `(missing in JSON-LD: ${missing.slice(0, 3).join(", ") || "none"}; ` +
          `extra in JSON-LD: ${extra.slice(0, 3).join(", ") || "none"})`,
      );
    }
  }
  otvSummary =
    `OTV ${concepts.size} concepts / ${terms.size} terms / ` +
    `${properNames.size} proper names / ${instanceOfSubjects.size} instanceOf subjects`;
}

// Ontology-side OTV: the closed controlled vocabularies are concepts in the
// ontoterminological reading. Every individual of the six vocabulary classes
// must also be typed otv:Concept and carry an otv:conceptName, and each class
// must be aligned via rdfs:subClassOf otv:Concept.
{
  const RDFS_NS = "http://www.w3.org/2000/01/rdf-schema#";
  const RDFS_SUBCLASS = `${RDFS_NS}subClassOf`;
  const VOCAB_CLASSES = [
    "CertaintyLevel",
    "AuthenticityLevel",
    "Role",
    "WorkForm",
    "WorkTopic",
    "SurvivalStatus",
  ];
  const otvErr = (msg: string) => {
    failed = true;
    console.error(`OTV ONTOLOGY CHECK FAILED: ${msg}`);
  };
  const typesBySubject = new Map<string, Set<string>>();
  const predsBySubject = new Map<string, Map<string, Set<string>>>();
  for (const quad of ontology.quads) {
    if (quad.predicate.value === RDF_TYPE) {
      const set = typesBySubject.get(quad.subject.value) ?? new Set();
      set.add(quad.object.value);
      typesBySubject.set(quad.subject.value, set);
    }
    let m = predsBySubject.get(quad.subject.value);
    if (!m) predsBySubject.set(quad.subject.value, (m = new Map()));
    const objs = m.get(quad.predicate.value) ?? new Set();
    objs.add(quad.object.value);
    m.set(quad.predicate.value, objs);
  }
  let vocabConcepts = 0;
  for (const cls of VOCAB_CLASSES) {
    const clsUri = `${ONT_NS}${cls}`;
    const aligned = predsBySubject
      .get(clsUri)
      ?.get(RDFS_SUBCLASS)
      ?.has(`${OTV}Concept`);
    if (!aligned) {
      otvErr(`lo:${cls} is not rdfs:subClassOf otv:Concept`);
    }
    const individuals = [...typesBySubject.entries()]
      .filter(([, t]) => t.has(clsUri))
      .map(([s]) => s);
    if (individuals.length === 0) {
      otvErr(`ontology declares no lo:${cls} individuals`);
    }
    for (const s of individuals) {
      if (!typesBySubject.get(s)?.has(`${OTV}Concept`)) {
        otvErr(`${s} (a lo:${cls}) is not typed otv:Concept`);
      }
      if (!predsBySubject.get(s)?.has(`${OTV}conceptName`)) {
        otvErr(`${s} (a lo:${cls}) has no otv:conceptName`);
      }
      vocabConcepts += 1;
    }
  }
  otvSummary += ` / ${vocabConcepts} ontology vocab concepts`;

  // Mirrored OTV core skeleton: since the ontology deliberately carries no
  // owl:imports of the (http-only) otv.rdf, the core classes and properties
  // the graph uses must be declared locally, faithful to the source
  // vocabulary (subclass of otv:OTVCore, pairwise disjointness, exact
  // domains/ranges, rdfs:isDefinedBy back to otv.rdf).
  const OWL_NS = "http://www.w3.org/2002/07/owl#";
  const XSD_STRING = "http://www.w3.org/2001/XMLSchema#string";
  const ISDEFINEDBY = "http://www.w3.org/2000/01/rdf-schema#isDefinedBy";
  const OTV_RDF = "http://www.ontologia.fr/OTB/otv.rdf";
  const expectPred = (subj: string, pred: string, obj: string, what: string) => {
    if (!predsBySubject.get(subj)?.get(pred)?.has(obj)) {
      otvErr(`mirrored OTV core: ${what}`);
    }
  };
  const expectCore = (local: string, type: string) => {
    const uri = `${OTV}${local}`;
    if (!typesBySubject.get(uri)?.has(`${OWL_NS}${type}`)) {
      otvErr(`mirrored OTV core: otv:${local} is not declared owl:${type}`);
    }
    expectPred(uri, ISDEFINEDBY, OTV_RDF, `otv:${local} lacks rdfs:isDefinedBy otv.rdf`);
  };
  expectCore("OTVCore", "Class");
  for (const cls of ["Concept", "Object", "Term", "ProperName"]) {
    expectCore(cls, "Class");
    expectPred(
      `${OTV}${cls}`,
      RDFS_SUBCLASS,
      `${OTV}OTVCore`,
      `otv:${cls} is not rdfs:subClassOf otv:OTVCore`,
    );
  }
  const DISJOINT_PAIRS: Array<[string, string]> = [
    ["Concept", "Object"],
    ["Concept", "Term"],
    ["Concept", "ProperName"],
    ["Object", "Term"],
    ["Object", "ProperName"],
    ["Term", "ProperName"],
  ];
  for (const [a, b] of DISJOINT_PAIRS) {
    expectPred(
      `${OTV}${a}`,
      `${OWL_NS}disjointWith`,
      `${OTV}${b}`,
      `otv:${a} is not owl:disjointWith otv:${b}`,
    );
  }
  const OBJECT_PROPS: Array<[string, string, string]> = [
    ["instanceOf", "Object", "Concept"],
    ["isA", "Concept", "Concept"],
    ["denotedByTerm", "Concept", "Term"],
    ["denotedConcept", "Term", "Concept"],
    ["denotedByProperName", "Object", "ProperName"],
    ["denotedObject", "ProperName", "Object"],
  ];
  for (const [prop, domain, range] of OBJECT_PROPS) {
    expectCore(prop, "ObjectProperty");
    expectPred(
      `${OTV}${prop}`,
      `${RDFS_NS}domain`,
      `${OTV}${domain}`,
      `otv:${prop} domain is not otv:${domain}`,
    );
    expectPred(
      `${OTV}${prop}`,
      `${RDFS_NS}range`,
      `${OTV}${range}`,
      `otv:${prop} range is not otv:${range}`,
    );
  }
  const DATA_PROPS: Array<[string, string | null]> = [
    ["conceptName", "Concept"],
    ["termName", "Term"],
    ["properName", "ProperName"],
    ["language", null], // union domain in the source vocabulary, not mirrored
  ];
  for (const [prop, domain] of DATA_PROPS) {
    expectCore(prop, "DatatypeProperty");
    if (domain) {
      expectPred(
        `${OTV}${prop}`,
        `${RDFS_NS}domain`,
        `${OTV}${domain}`,
        `otv:${prop} domain is not otv:${domain}`,
      );
    } else if (predsBySubject.get(`${OTV}${prop}`)?.has(`${RDFS_NS}domain`)) {
      otvErr(
        `otv:${prop} asserts a domain (source vocabulary uses a class union, deliberately not mirrored)`,
      );
    }
    expectPred(
      `${OTV}${prop}`,
      `${RDFS_NS}range`,
      XSD_STRING,
      `otv:${prop} range is not xsd:string`,
    );
  }
  otvSummary += ` / OTV core mirrored (5 classes, 10 properties)`;
}

// ------------------------------------- external ontology alignments layer
// Curated class/property bridges to CIDOC CRM, LAWD, FaBiO, schema.org and
// WGS84 Geo, plus SKOS mappings to Wikidata. All alignments must live on
// the conceptual side of the ontoterminology only: no linguistic node
// (otv:Term, otv:ProperName, /name/, /term/) may ever carry one. Counts
// are pinned so any curation change is a conscious act.
let alignSummary = "";
{
  const RDFS_NS = "http://www.w3.org/2000/01/rdf-schema#";
  const RDFS_SUBCLASS = `${RDFS_NS}subClassOf`;
  const RDFS_SUBPROP = `${RDFS_NS}subPropertyOf`;
  const RDFS_COMMENT = `${RDFS_NS}comment`;
  const SKOS_NS = ALIGNMENT_PREFIXES["skos"]!;
  const WD_NS = "http://www.wikidata.org/entity/";
  const FOAF_NS = "http://xmlns.com/foaf/0.1/";
  const alignErr = (msg: string) => {
    failed = true;
    console.error(`ALIGNMENT CHECK FAILED: ${msg}`);
  };

  // Pinned expectations. Update deliberately when curation changes.
  const PINNED_CLASS_BRIDGES: Record<string, number> = {
    crm: 3, // E21_Person, E53_Place, E74_Group
    lawd: 4, // Person, Place, ConceptualWork, Group
    fabio: 1, // Work
    schema: 4, // Person, Place, CreativeWork, Organization
    geo: 1, // SpatialThing
  };
  const PINNED_PROP_BRIDGES: Record<string, number> = {
    foaf: 1, // made
    crm: 1, // P89_falls_within
    schema: 3, // birthPlace, deathPlace, memberOf
  };
  const PINNED_EXACT = 29;
  const PINNED_CLOSE = 16;
  const PINNED_UNMAPPED = 12;
  const PINNED_VOCAB_UNDER_SKOS = 6;

  const nsOf = (prefix: string): string =>
    prefix === "foaf" ? FOAF_NS : (ALIGNMENT_PREFIXES[prefix] ?? "");

  // 1. The curated module must agree with the pins.
  const bridgeCount: Record<string, number> = {};
  for (const b of CLASS_BRIDGES) {
    const prefix = b.ext.split(":")[0]!;
    bridgeCount[prefix] = (bridgeCount[prefix] ?? 0) + 1;
  }
  for (const [prefix, expected] of Object.entries(PINNED_CLASS_BRIDGES)) {
    if ((bridgeCount[prefix] ?? 0) !== expected) {
      alignErr(
        `class bridges to ${prefix}: expected ${expected}, module has ${bridgeCount[prefix] ?? 0}`,
      );
    }
  }
  const propCount: Record<string, number> = {};
  for (const b of PROPERTY_BRIDGES) {
    const prefix = b.ext.split(":")[0]!;
    propCount[prefix] = (propCount[prefix] ?? 0) + 1;
  }
  for (const [prefix, expected] of Object.entries(PINNED_PROP_BRIDGES)) {
    if ((propCount[prefix] ?? 0) !== expected) {
      alignErr(
        `property bridges to ${prefix}: expected ${expected}, module has ${propCount[prefix] ?? 0}`,
      );
    }
  }
  const exact = CONCEPT_MAPPINGS.filter((m) => m.rel === "exactMatch").length;
  const close = CONCEPT_MAPPINGS.filter((m) => m.rel === "closeMatch").length;
  if (exact !== PINNED_EXACT) {
    alignErr(`skos:exactMatch mappings: expected ${PINNED_EXACT}, module has ${exact}`);
  }
  if (close !== PINNED_CLOSE) {
    alignErr(`skos:closeMatch mappings: expected ${PINNED_CLOSE}, module has ${close}`);
  }
  if (UNMAPPED_CONCEPTS.length !== PINNED_UNMAPPED) {
    alignErr(
      `unmapped concepts: expected ${PINNED_UNMAPPED}, module has ${UNMAPPED_CONCEPTS.length}`,
    );
  }
  if (VOCAB_CLASSES_UNDER_SKOS.length !== PINNED_VOCAB_UNDER_SKOS) {
    alignErr(
      `vocab classes under skos:Concept: expected ${PINNED_VOCAB_UNDER_SKOS}, module has ${VOCAB_CLASSES_UNDER_SKOS.length}`,
    );
  }

  // 2. Mapped + unmapped vocab individuals must exactly cover all 51
  // closed-vocabulary individuals (mapping subjects that are the six
  // place-type classes are accounted separately).
  const PLACE_TYPE_CLASSES = new Set([
    "lo:City",
    "lo:Island",
    "lo:Region",
    "lo:Deme",
    "lo:Landmark",
    "lo:NaturalFeature",
  ]);
  const allVocabIndividuals = new Set<string>([
    ...Object.values(PERSON_ROLE_INDIVIDUAL).map((n) => `lo:${n}`),
    ...Object.values(WORK_FORM_INDIVIDUAL).map((n) => `lo:${n}`),
    ...Object.values(WORK_TOPIC_INDIVIDUAL).map((n) => `lo:${n}`),
    ...Object.values(WORK_SURVIVAL_INDIVIDUAL).map((n) => `lo:${n}`),
    "lo:Asserted",
    "lo:Reported",
    "lo:Disputed",
    "lo:Conjectured",
    "lo:Authentic",
    "lo:DisputedAuthenticity",
    "lo:Spurious",
  ]);
  const covered = new Set<string>();
  let placeTypeMappings = 0;
  for (const m of CONCEPT_MAPPINGS) {
    if (PLACE_TYPE_CLASSES.has(m.subject)) {
      placeTypeMappings += 1;
      continue;
    }
    if (!allVocabIndividuals.has(m.subject)) {
      alignErr(`mapping subject ${m.subject} is not a known vocab individual`);
    }
    if (covered.has(m.subject)) alignErr(`duplicate mapping for ${m.subject}`);
    covered.add(m.subject);
  }
  for (const u of UNMAPPED_CONCEPTS) {
    if (!allVocabIndividuals.has(u.subject)) {
      alignErr(`unmapped subject ${u.subject} is not a known vocab individual`);
    }
    if (covered.has(u.subject)) {
      alignErr(`${u.subject} is both mapped and listed unmapped`);
    }
    covered.add(u.subject);
  }
  if (placeTypeMappings !== PLACE_TYPE_CLASSES.size) {
    alignErr(
      `place-type class mappings: expected ${PLACE_TYPE_CLASSES.size}, module has ${placeTypeMappings}`,
    );
  }
  if (covered.size !== allVocabIndividuals.size) {
    const missing = [...allVocabIndividuals].filter((s) => !covered.has(s));
    alignErr(
      `vocab individuals neither mapped nor recorded unmapped: ${missing.join(", ")}`,
    );
  }

  // 3. The serialized ontology must carry exactly the curated alignments.
  const predsBySubject = new Map<string, Map<string, Set<string>>>();
  const typesBySubject = new Map<string, Set<string>>();
  for (const quad of ontology.quads) {
    if (quad.predicate.value === RDF_TYPE) {
      const set = typesBySubject.get(quad.subject.value) ?? new Set();
      set.add(quad.object.value);
      typesBySubject.set(quad.subject.value, set);
    }
    let m = predsBySubject.get(quad.subject.value);
    if (!m) predsBySubject.set(quad.subject.value, (m = new Map()));
    const objs = m.get(quad.predicate.value) ?? new Set();
    objs.add(quad.object.value);
    m.set(quad.predicate.value, objs);
  }
  const expand = (prefixed: string): string => {
    const [prefix, local] = prefixed.split(":") as [string, string];
    if (prefix === "lo") return `${ONT_NS}${local}`;
    return `${nsOf(prefix)}${local}`;
  };
  for (const b of CLASS_BRIDGES) {
    if (!predsBySubject.get(expand(b.cls))?.get(RDFS_SUBCLASS)?.has(expand(b.ext))) {
      alignErr(`ontology is missing ${b.cls} rdfs:subClassOf ${b.ext}`);
    }
  }
  for (const b of PROPERTY_BRIDGES) {
    if (!predsBySubject.get(expand(b.prop))?.get(RDFS_SUBPROP)?.has(expand(b.ext))) {
      alignErr(`ontology is missing ${b.prop} rdfs:subPropertyOf ${b.ext}`);
    }
  }
  for (const cls of VOCAB_CLASSES_UNDER_SKOS) {
    if (
      !predsBySubject.get(expand(cls))?.get(RDFS_SUBCLASS)?.has(`${SKOS_NS}Concept`)
    ) {
      alignErr(`ontology is missing ${cls} rdfs:subClassOf skos:Concept`);
    }
  }
  let ontExact = 0;
  let ontClose = 0;
  for (const quad of ontology.quads) {
    if (quad.predicate.value === `${SKOS_NS}exactMatch`) ontExact += 1;
    if (quad.predicate.value === `${SKOS_NS}closeMatch`) ontClose += 1;
    if (
      quad.predicate.value.startsWith(SKOS_NS) &&
      !quad.object.value.startsWith(WD_NS) &&
      quad.predicate.value !== `${RDFS_SUBCLASS}` &&
      (quad.predicate.value === `${SKOS_NS}exactMatch` ||
        quad.predicate.value === `${SKOS_NS}closeMatch`)
    ) {
      alignErr(
        `${quad.subject.value} maps to non-Wikidata target ${quad.object.value}`,
      );
    }
  }
  if (ontExact !== PINNED_EXACT || ontClose !== PINNED_CLOSE) {
    alignErr(
      `serialized skos mappings ${ontExact} exact / ${ontClose} close, expected ${PINNED_EXACT} / ${PINNED_CLOSE}`,
    );
  }

  // 4. The ontoterminology contract: the ontology node documents the
  // conceptual-side-only policy, and NO linguistic node in ontology or
  // graph carries any alignment (skos:*, or a subClassOf/subPropertyOf
  // into an external namespace).
  const ontologyComments =
    predsBySubject.get(`${LOD_BASE}/ontology`)?.get(RDFS_COMMENT) ?? new Set();
  if (![...ontologyComments].some((c) => c.includes("conceptual dimension"))) {
    alignErr(
      "ontology node lacks the rdfs:comment stating the conceptual-side-only alignment contract",
    );
  }
  const OTV_TERM = `${OTV}Term`;
  const OTV_PROPER = `${OTV}ProperName`;
  const EXTERNAL_NSS = Object.values(ALIGNMENT_PREFIXES).filter(
    (ns) => ns !== SKOS_NS,
  );
  const isLinguisticSubject = (
    subject: string,
    types: Set<string> | undefined,
  ): boolean =>
    subject.includes("/name/") ||
    subject.includes("/term/") ||
    types?.has(OTV_TERM) === true ||
    types?.has(OTV_PROPER) === true;
  const graphTypes = new Map<string, Set<string>>();
  for (const quad of graph.quads) {
    if (quad.predicate.value === RDF_TYPE) {
      const set = graphTypes.get(quad.subject.value) ?? new Set();
      set.add(quad.object.value);
      graphTypes.set(quad.subject.value, set);
    }
  }
  const checkQuads = (
    quads: typeof ontology.quads,
    types: Map<string, Set<string>>,
    which: string,
  ) => {
    for (const quad of quads) {
      if (!isLinguisticSubject(quad.subject.value, types.get(quad.subject.value)))
        continue;
      if (quad.predicate.value.startsWith(SKOS_NS)) {
        alignErr(
          `${which}: linguistic node ${quad.subject.value} carries ${quad.predicate.value}`,
        );
      }
      if (
        (quad.predicate.value === RDFS_SUBCLASS ||
          quad.predicate.value === RDFS_SUBPROP) &&
        EXTERNAL_NSS.some((ns) => quad.object.value.startsWith(ns))
      ) {
        alignErr(
          `${which}: linguistic node ${quad.subject.value} bridges to ${quad.object.value}`,
        );
      }
    }
  };
  checkQuads(ontology.quads, typesBySubject, "ontology");
  checkQuads(graph.quads, graphTypes, "graph");

  const classBridgeTotal = CLASS_BRIDGES.length;
  alignSummary =
    `alignments: ${classBridgeTotal} class bridges ` +
    `(crm ${PINNED_CLASS_BRIDGES["crm"]}, lawd ${PINNED_CLASS_BRIDGES["lawd"]}, ` +
    `fabio ${PINNED_CLASS_BRIDGES["fabio"]}, schema ${PINNED_CLASS_BRIDGES["schema"]}, ` +
    `geo ${PINNED_CLASS_BRIDGES["geo"]}) / ${PROPERTY_BRIDGES.length} property bridges / ` +
    `${PINNED_EXACT} exactMatch + ${PINNED_CLOSE} closeMatch to Wikidata / ` +
    `${PINNED_UNMAPPED} recorded unmapped / linguistic side clean`;
  console.log(alignSummary);
}

// ---------------------------------------------------- sources-index layer
// One lo:SourceCitation node per workbook row; lo:citedAuthor targets must
// be real nodes; Turtle and JSON-LD must carry the same citation @ids.
let sourcesSummary = "";
{
  const q = graph.quads;
  const srcIndex = getSourcesIndex();
  const srcErr = (msg: string) => {
    failed = true;
    console.error(`SOURCES LAYER CHECK FAILED: ${msg}`);
  };

  const citationIds = new Set(
    q
      .filter(
        (quad) =>
          quad.predicate.value === RDF_TYPE &&
          quad.object.value === `${ONT_NS}SourceCitation`,
      )
      .map((quad) => quad.subject.value),
  );
  if (citationIds.size !== srcIndex.rows.length) {
    srcErr(
      `expected ${srcIndex.rows.length} lo:SourceCitation nodes, found ${citationIds.size}`,
    );
  }

  const subjects = new Set(q.map((quad) => quad.subject.value));
  const labelled = new Set(
    q
      .filter(
        (quad) =>
          quad.predicate.value === "http://www.w3.org/2000/01/rdf-schema#label",
      )
      .map((quad) => quad.subject.value),
  );
  let citedAuthorCount = 0;
  for (const quad of q) {
    if (quad.predicate.value !== `${ONT_NS}citedAuthor`) continue;
    citedAuthorCount++;
    if (!citationIds.has(quad.subject.value)) {
      srcErr(`lo:citedAuthor on non-citation subject ${quad.subject.value}`);
    }
    if (!subjects.has(quad.object.value)) {
      srcErr(`lo:citedAuthor target ${quad.object.value} is not in the graph`);
    }
  }
  const expectedAuthored = srcIndex.rows.length - srcIndex.anonymousRows.length;
  if (citedAuthorCount !== expectedAuthored) {
    srcErr(
      `expected ${expectedAuthored} lo:citedAuthor triples, found ${citedAuthorCount}`,
    );
  }
  for (const id of citationIds) {
    if (!labelled.has(id)) srcErr(`citation ${id} has no rdfs:label`);
  }

  // Every reconciled group's node must exist as a subject in the graph
  // (mirrors the URI builders in lod.ts / sources-index.ts).
  for (const gr of srcIndex.groups) {
    const uri =
      gr.kind === "philosopher"
        ? `${LOD_BASE}/philosopher/${slugify(gr.label)}`
        : `${LOD_BASE}/${gr.kind}/${unicodeSlug(gr.label)}`;
    if (!subjects.has(uri)) {
      srcErr(`group "${gr.label}" node ${uri} is not a subject in the graph`);
    }
  }

  // Turtle <-> JSON-LD parity on citation @ids.
  const jsonCitationIds = new Set(
    jsonLdGraph
      .filter((n) =>
        Array.isArray(n["@type"])
          ? n["@type"].includes("lo:SourceCitation")
          : n["@type"] === "lo:SourceCitation",
      )
      .map((n) => n["@id"])
      .filter((x): x is string => !!x),
  );
  const missing = [...citationIds].filter((s) => !jsonCitationIds.has(s));
  const extra = [...jsonCitationIds].filter((s) => !citationIds.has(s));
  if (missing.length > 0 || extra.length > 0) {
    srcErr(
      `citation @ids differ between Turtle and JSON-LD ` +
        `(missing in JSON-LD: ${missing.slice(0, 3).join(", ") || "none"}; ` +
        `extra: ${extra.slice(0, 3).join(", ") || "none"})`,
    );
  }
  sourcesSummary = `${citationIds.size} source citations (${citedAuthorCount} authored, Turtle = JSON-LD)`;
}

// ---------------------------------------------------- work-ontology layer
// Every lo:Work node carries curated facets; the emitted facet triple
// counts must match the curation exactly and agree between Turtle and
// JSON-LD; facet objects must be declared ontology individuals.
let workFacetSummary = "";
{
  const q = graph.quads;
  const workErr = (msg: string) => {
    failed = true;
    console.error(`WORK ONTOLOGY CHECK FAILED: ${msg}`);
  };

  const workIds = new Set(
    q
      .filter(
        (quad) =>
          quad.predicate.value === RDF_TYPE &&
          quad.object.value === `${ONT_NS}Work`,
      )
      .map((quad) => quad.subject.value),
  );
  const labelOf = new Map<string, string>();
  for (const quad of q) {
    if (
      quad.predicate.value === "http://www.w3.org/2000/01/rdf-schema#label" &&
      workIds.has(quad.subject.value)
    ) {
      labelOf.set(quad.subject.value, quad.object.value);
    }
  }
  const facetKeys = new Set(Object.keys(WORK_FACETS));
  if (workIds.size !== facetKeys.size) {
    workErr(
      `${workIds.size} lo:Work nodes but ${facetKeys.size} curated facet entries`,
    );
  }
  for (const [id, label] of labelOf) {
    if (!facetKeys.has(label)) {
      workErr(`work "${label}" (${id}) has no curated facet entry`);
    }
  }

  const facets = Object.values(WORK_FACETS);
  const expected = {
    hasForm: facets.filter((f) => f.form !== null).length,
    hasWorkTopic: facets.filter((f) => f.topic !== null).length,
    survival: facets.filter((f) => f.survival !== null).length,
  };
  const countPred = (local: string) =>
    q.filter((quad) => quad.predicate.value === `${ONT_NS}${local}`).length;
  const actual = {
    hasForm: countPred("hasForm"),
    hasWorkTopic: countPred("hasWorkTopic"),
    survival: countPred("survival"),
  };
  for (const key of ["hasForm", "hasWorkTopic", "survival"] as const) {
    if (actual[key] !== expected[key]) {
      workErr(
        `lo:${key}: ${actual[key]} triples, curation expects ${expected[key]}`,
      );
    }
  }
  const philosophicalCount = countPred("philosophical");
  const centuryCount = countPred("compositionCentury");
  const decadeCount = countPred("compositionDecade");
  if (decadeCount !== Object.keys(WORK_DECADES).length) {
    workErr(
      `lo:compositionDecade: ${decadeCount} triples, curation expects ${Object.keys(WORK_DECADES).length}`,
    );
  }
  if (philosophicalCount < actual.hasWorkTopic) {
    workErr(
      `lo:philosophical (${philosophicalCount}) fewer than lo:hasWorkTopic (${actual.hasWorkTopic}) — every topic derives a flag`,
    );
  }
  if (centuryCount === 0) workErr("no lo:compositionCentury triples at all");

  // Facet objects must be the declared closed-union individuals.
  const allowed: Record<string, Set<string>> = {
    hasForm: new Set(
      Object.values(WORK_FORM_INDIVIDUAL).map((n) => `${ONT_NS}${n}`),
    ),
    hasWorkTopic: new Set(
      Object.values(WORK_TOPIC_INDIVIDUAL).map((n) => `${ONT_NS}${n}`),
    ),
    survival: new Set(
      Object.values(WORK_SURVIVAL_INDIVIDUAL).map((n) => `${ONT_NS}${n}`),
    ),
  };
  for (const quad of q) {
    for (const [local, set] of Object.entries(allowed)) {
      if (quad.predicate.value !== `${ONT_NS}${local}`) continue;
      if (!workIds.has(quad.subject.value)) {
        workErr(`lo:${local} on non-work subject ${quad.subject.value}`);
      }
      if (!set.has(quad.object.value)) {
        workErr(`lo:${local} target ${quad.object.value} is not a declared individual`);
      }
    }
  }
  // The individuals themselves are declared in the ontology graph.
  const ontSubjects = new Set(ontology.quads.map((quad) => quad.subject.value));
  for (const set of Object.values(allowed)) {
    for (const iri of set) {
      if (!ontSubjects.has(iri)) {
        workErr(`ontology does not declare individual ${iri}`);
      }
    }
  }

  // Turtle <-> JSON-LD parity on all six facet predicates.
  const jsonCount = (key: string) =>
    jsonLdGraph.filter((n) => key in n).length;
  const parity: [string, number][] = [
    ["lo:hasForm", actual.hasForm],
    ["lo:hasWorkTopic", actual.hasWorkTopic],
    ["lo:philosophical", philosophicalCount],
    ["lo:survival", actual.survival],
    ["lo:compositionCentury", centuryCount],
    ["lo:compositionDecade", decadeCount],
  ];
  for (const [key, turtleCount] of parity) {
    const j = jsonCount(key);
    if (j !== turtleCount) {
      workErr(`${key}: ${turtleCount} in Turtle but ${j} JSON-LD nodes carry it`);
    }
  }
  workFacetSummary =
    `${workIds.size} works faceted (${actual.hasForm} form / ` +
    `${actual.hasWorkTopic} topic / ${actual.survival} survival / ` +
    `${centuryCount} century, Turtle = JSON-LD)`;
}

// ---------------------------------------------- chapter-subject layer
// Book-level classification of the 82 subjects of the Lives: the eleven
// Book 1 sages are lo:Sage, Books 2-10 subjects are lo:Philosopher,
// Thales alone carries both classes, all share lo:ChapterSubject, and
// each Life is reified as a lo:Chapter node with lo:hasMainSubject.
let chapterSummary = "";
{
  const chapterErr = (msg: string) => {
    failed = true;
    console.error(`CHAPTER-SUBJECT LAYER FAILED: ${msg}`);
  };
  const typed = (type: string) => {
    const out = new Set<string>();
    for (const quad of graph.quads) {
      if (
        quad.predicate.value === RDF_TYPE &&
        quad.object.value === `${ONT_NS}${type}`
      ) {
        out.add(quad.subject.value);
      }
    }
    return out;
  };
  const chapterSubjects = typed("ChapterSubject");
  const philosophers = typed("Philosopher");
  const sages = typed("Sage");
  const chapters = typed("Chapter");
  if (chapterSubjects.size !== CHAPTER_SUBJECT_PIN_COUNT) {
    chapterErr(
      `${chapterSubjects.size} lo:ChapterSubject nodes, expected ${CHAPTER_SUBJECT_PIN_COUNT}`,
    );
  }
  if (philosophers.size !== PHILOSOPHER_NODE_PIN_COUNT) {
    chapterErr(
      `${philosophers.size} lo:Philosopher nodes, expected ${PHILOSOPHER_NODE_PIN_COUNT}`,
    );
  }
  if (sages.size !== SAGE_PIN_COUNT) {
    chapterErr(`${sages.size} lo:Sage nodes, expected ${SAGE_PIN_COUNT}`);
  }
  const dual = [...philosophers].filter((s) => sages.has(s));
  const thalesUri = `${LOD_BASE}/philosopher/thales`;
  if (dual.length !== 1 || dual[0] !== thalesUri) {
    chapterErr(
      `dual-classified set is [${dual.join(", ")}], expected exactly [${thalesUri}]`,
    );
  }
  if (philosophers.size - dual.length !== 71) {
    chapterErr(
      `${philosophers.size - dual.length} strict philosophers, expected 71`,
    );
  }
  for (const s of philosophers) {
    if (!chapterSubjects.has(s)) {
      chapterErr(`lo:Philosopher ${s} is not typed lo:ChapterSubject`);
    }
  }
  for (const s of sages) {
    if (!chapterSubjects.has(s)) {
      chapterErr(`lo:Sage ${s} is not typed lo:ChapterSubject`);
    }
  }
  for (const s of chapterSubjects) {
    if (!philosophers.has(s) && !sages.has(s)) {
      chapterErr(`lo:ChapterSubject ${s} is neither Philosopher nor Sage`);
    }
  }
  // Every sage's Life is in Book 1 and no philosopher-only subject's is.
  for (const quad of graph.quads) {
    if (quad.predicate.value !== `${ONT_NS}describedInBook`) continue;
    const s = quad.subject.value;
    if (!chapterSubjects.has(s)) continue;
    const book = Number(quad.object.value);
    if (sages.has(s) && book !== 1) {
      chapterErr(`sage ${s} is described in Book ${book}, expected 1`);
    }
    if (!sages.has(s) && book === 1) {
      chapterErr(`Book 1 subject ${s} is not typed lo:Sage`);
    }
  }
  // Chapter nodes: 82, one lo:hasMainSubject each, a bijection onto the
  // chapter subjects, with the pinned per-book distribution.
  if (chapters.size !== 82) {
    chapterErr(`${chapters.size} lo:Chapter nodes, expected 82`);
  }
  const mainSubjects = graph.quads.filter(
    (q) => q.predicate.value === `${ONT_NS}hasMainSubject`,
  );
  if (mainSubjects.length !== 82) {
    chapterErr(`${mainSubjects.length} lo:hasMainSubject quads, expected 82`);
  }
  const seenSubjects = new Set<string>();
  for (const q of mainSubjects) {
    if (!chapters.has(q.subject.value)) {
      chapterErr(`hasMainSubject on non-chapter node ${q.subject.value}`);
    }
    if (!chapterSubjects.has(q.object.value)) {
      chapterErr(`chapter main subject ${q.object.value} is not a ChapterSubject`);
    }
    if (seenSubjects.has(q.object.value)) {
      chapterErr(`${q.object.value} is the main subject of two chapters`);
    }
    seenSubjects.add(q.object.value);
  }
  const bookDist = new Map<number, number>();
  for (const q of graph.quads) {
    if (q.predicate.value !== `${ONT_NS}inBook`) continue;
    if (!chapters.has(q.subject.value)) continue;
    const book = Number(q.object.value);
    bookDist.set(book, (bookDist.get(book) ?? 0) + 1);
  }
  const expectedDist: Record<number, number> = {
    1: 11, 2: 17, 3: 1, 4: 10, 5: 6, 6: 9, 7: 7, 8: 8, 9: 12, 10: 1,
  };
  for (const [book, expected] of Object.entries(expectedDist)) {
    const actual = bookDist.get(Number(book)) ?? 0;
    if (actual !== expected) {
      chapterErr(`Book ${book} has ${actual} chapters, expected ${expected}`);
    }
  }
  if (bookDist.size !== 10) {
    chapterErr(`chapters span ${bookDist.size} books, expected 10`);
  }
  // Turtle = JSON-LD parity on the four class extensions.
  const jsonTyped = (type: string) =>
    new Set(
      jsonLdGraph
        .filter((n) => {
          const t = n["@type"];
          return Array.isArray(t) ? t.includes(`lo:${type}`) : t === `lo:${type}`;
        })
        .map((n) => n["@id"] ?? ""),
    );
  for (const [type, ttlSet] of [
    ["ChapterSubject", chapterSubjects],
    ["Philosopher", philosophers],
    ["Sage", sages],
    ["Chapter", chapters],
  ] as const) {
    const jset = jsonTyped(type);
    if (
      jset.size !== ttlSet.size ||
      [...ttlSet].some((s) => !jset.has(s))
    ) {
      chapterErr(
        `lo:${type}: ${ttlSet.size} in Turtle but ${jset.size} in JSON-LD (or ids differ)`,
      );
    }
  }
  chapterSummary =
    `${chapters.size} chapters -> ${chapterSubjects.size} subjects ` +
    `(${philosophers.size} philosophers / ${sages.size} sages, Thales dual, Turtle = JSON-LD)`;
}

// Per-passage exports: sample a claim-rich section and a Prologue section
// (the Prologue has no philosopher node — the lo:inLifeOf edge case).
const firstClaim = getClaims()[0];
const claimSection = firstClaim ? sectionIdForRef(firstClaim.ref) : null;
const prologueSection =
  verses.find((v) => v.sectionId.includes(".prol."))?.sectionId ?? null;
const sampleSections = [claimSection, prologueSection].filter(
  (s): s is string => s !== null,
);
if (sampleSections.length < 2) {
  failed = true;
  console.error(
    `SECTION SAMPLES MISSING: claim-rich=${claimSection}, prologue=${prologueSection}`,
  );
}
let sectionTriples = 0;
for (const id of sampleSections) {
  try {
    const quads = sectionQuads(id);
    if (!quads || quads.length === 0) {
      throw new Error("sectionQuads returned null or empty");
    }
    const passageSubject = quads[0]!.subject.value;
    if (!passageSubject.endsWith(`/passage/${id}`)) {
      throw new Error(
        `first quad subject is ${passageSubject}, expected .../passage/${id}`,
      );
    }
    const jsonld = JSON.parse(JSON.stringify(sectionAsJsonLd(id))) as {
      "@context"?: unknown;
      "@graph"?: { "@id"?: string; "@type"?: unknown }[];
    };
    if (!jsonld["@context"]) throw new Error("section JSON-LD has no @context");
    const graphNodes = jsonld["@graph"];
    if (!Array.isArray(graphNodes) || graphNodes.length === 0) {
      throw new Error("section JSON-LD has no non-empty @graph");
    }
    const first = graphNodes[0]!;
    if (first["@type"] !== "lo:Passage" || first["@id"] !== passageSubject) {
      throw new Error(
        `section JSON-LD does not start with the lo:Passage node (got ${first["@id"]})`,
      );
    }
    const rdfXml = sectionAsRdfXml(id);
    if (!rdfXml) throw new Error("sectionAsRdfXml returned null");
    const xmlCheck = XMLValidator.validate(rdfXml);
    if (xmlCheck !== true) {
      throw new Error(
        `RDF/XML not well-formed: line ${xmlCheck.err.line}: ${xmlCheck.err.msg}`,
      );
    }
    const triples = dedupedCount(quads);
    const xmlProps = rdfXmlPropertyCount(rdfXml);
    if (triples !== xmlProps) {
      throw new Error(
        `quads have ${triples} deduped triples, RDF/XML has ${xmlProps} property elements`,
      );
    }
    // The claim-rich sample seeds a philosopher node, so its one-hop
    // expansion must pull in the OTV proper-name node.
    if (
      id === claimSection &&
      !quads.some((q) => q.predicate.value === `${OTV}denotedByProperName`)
    ) {
      throw new Error(
        "claim-rich passage export carries no otv:denotedByProperName quad",
      );
    }
    // oa: annotation layer — one oa:Annotation per deterministic OTV tag
    // (annotate.ts), each with a SpecificResource target on the passage
    // node, both selectors, and a self-describing body node.
    const OA = "http://www.w3.org/ns/oa#";
    const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
    const corpusSection = sectionById.get(id);
    if (!corpusSection) throw new Error(`section ${id} missing from corpus`);
    const sectionTags = annotateSection(corpusSection);
    const expectedAnns = sectionTags.length;
    // OTV double dimension: name tags carry a second, linguistic body
    // (the otv:ProperName node); term tags body the otv:Term plus each
    // doctrine otv:Concept the term denotes.
    const expectedSectionBodies =
      expectedAnns +
      sectionTags.reduce(
        (n, t) => n + (t.nameUri ? 1 : 0) + (t.conceptUris?.length ?? 0),
        0,
      );
    if (id === claimSection && expectedAnns === 0) {
      throw new Error("claim-rich sample section has no annotations at all");
    }
    const annNodes = quads.filter(
      (q) =>
        q.predicate.value === RDF_TYPE &&
        q.object.value === `${OA}Annotation`,
    );
    if (annNodes.length !== expectedAnns) {
      throw new Error(
        `${annNodes.length} oa:Annotation nodes, tagger produced ${expectedAnns}`,
      );
    }
    const subjects = new Set(
      quads.map((q) =>
        q.subject.termType === "BlankNode"
          ? `_:${q.subject.value}`
          : q.subject.value,
      ),
    );
    const bodies = quads.filter((q) => q.predicate.value === `${OA}hasBody`);
    if (bodies.length !== expectedSectionBodies) {
      throw new Error(
        `${bodies.length} oa:hasBody quads, expected ${expectedSectionBodies} ` +
          `(${expectedAnns} annotations + name bodies)`,
      );
    }
    for (const b of bodies) {
      if (!subjects.has(b.object.value)) {
        throw new Error(`annotation body ${b.object.value} is not described`);
      }
    }
    const sources = quads.filter(
      (q) => q.predicate.value === `${OA}hasSource`,
    );
    if (
      sources.length !== expectedAnns ||
      sources.some((q) => q.object.value !== passageSubject)
    ) {
      throw new Error(
        "oa:hasSource quads do not all point at the passage node",
      );
    }
    const exactCount = quads.filter(
      (q) => q.predicate.value === `${OA}exact`,
    ).length;
    const startCount = quads.filter(
      (q) => q.predicate.value === `${OA}start`,
    ).length;
    if (exactCount !== expectedAnns || startCount !== expectedAnns) {
      throw new Error(
        `selector mismatch: ${exactCount} oa:exact / ${startCount} oa:start, expected ${expectedAnns} each`,
      );
    }
    sectionTriples += triples;
  } catch (err) {
    failed = true;
    console.error(`SECTION EXPORT FAILED (${id}):`);
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
  }
}
if (sectionQuads("no.such.section") !== null) {
  failed = true;
  console.error("SECTION EXPORT FAILED: unknown section id did not return null");
}

// ------------------------------------------------ VoID dataset description
// The /api/lod/void.ttl document advertising the dataset, its dumps, the
// SPARQL endpoint, the vocabularies and the external linksets. Its counts
// must equal the counts of the published serializations, and the linkset
// sizes are pinned so any change in external identifiers is a conscious act.
let voidSummary = "";
{
  const voidErr = (msg: string): void => {
    failed = true;
    console.error(`VOID CHECK FAILED: ${msg}`);
  };
  const VOID_NS = "http://rdfs.org/ns/void#";
  const stats = voidStats();
  // 2026-07 Garden members: +3 wikidata links (Leonteus Q1225067,
  // Polyaenus Q740432, Themista Q1229024), mention-person QIDs.
  // 2026-07 Sceptics: +9 wikidata links from the succession
  // mention-persons (Dioscurides of Cyprus, Eubulus of Alexandria,
  // Euphranor of Seleucia, Evander, Herodotus of Tarsus, Nicolochus
  // of Rhodes, Praylus of the Troad, Ptolemy of Cyrene, Telecles -
  // QIDs verified against the D.L. context, never guessed; the other
  // eight new mention-persons have no verifiable Wikidata item).
  // 2026-07 frequently-mentioned figures: +4 wikidata links
  // (Aristocreon Q2572655, Isocrates Q221182, Dion of Syracuse
  // Q457885, Asclepiades of Phlius Q2087377), mention-person QIDs
  // verified against the D.L. context at curation time.
  // 2026-07 second frequently-mentioned batch: +5 wikidata links
  // (Alcibiades Q187982, Croesus Q184462, Cyrus the Younger Q297960,
  // Hermias Q948620, Philip II of Macedon Q130650), mention-person
  // QIDs verified via the Wikidata API against the D.L. context;
  // Nicanor deliberately carries no QID (Q1971955 is Parmenion's son
  // per P22, Q1990046 is undescribed - never guess a homonym).
  // Pisistratus' Q242172 rides his existing source node.
  // 2026-07 chapter philosophers: +4 wikidata links for the last four
  // PHILOSOPHER_META entries without QIDs (Pyrrho Q192313, Herillus
  // Q248975, Clitomachus Q466951, Glaucon Q1364945 - Plato's brother,
  // whose enwiki article records D.L. 2.124's nine dialogues), all
  // verified via the Wikidata API against the D.L. context.
  const PINNED_LINKSETS: Record<string, number> = {
    // 2026-07 kings and tyrants batch: +4 wikidata links (Alexander
    // the Great Q8409, Dionysius the Elder Q332750, Dionysius the
    // Younger Q380453, Ptolemy I Soter Q168261), all verified via the
    // Wikidata API against the D.L. context.
    wikidata: 494,
    dbpedia: 139,
    viaf: 77,
    inpho: 54,
    pleiades: 171,
  };
  for (const [id, expected] of Object.entries(PINNED_LINKSETS)) {
    if (stats.linksets[id] !== expected) {
      voidErr(
        `linkset ${id}: expected ${expected} owl:sameAs links, graph has ${stats.linksets[id]}`,
      );
    }
  }
  for (const id of Object.keys(stats.linksets)) {
    if (!(id in PINNED_LINKSETS)) voidErr(`unpinned linkset target ${id}`);
  }
  if (stats.triples !== graph.triples) {
    voidErr(
      `void:triples ${stats.triples} != graph deduped count ${graph.triples}`,
    );
  }
  if (stats.annotatedTriples !== annotated.triples) {
    voidErr(
      `annotated void:triples ${stats.annotatedTriples} != annotated deduped count ${annotated.triples}`,
    );
  }
  const PINNED_SKOS_MAPPINGS = 45; // = 29 exactMatch + 16 closeMatch pinned above
  if (stats.skosMappings !== PINNED_SKOS_MAPPINGS) {
    voidErr(
      `skos concept-mapping linkset: expected ${PINNED_SKOS_MAPPINGS}, module has ${stats.skosMappings}`,
    );
  }

  // The document itself must parse, carry the counts it claims, describe
  // one dataset per linkset target plus the main and annotated datasets,
  // and point at every dump and the SPARQL endpoint.
  const quads = parseTurtle("void.ttl", voidAsTurtle());
  const byPred = (p: string) =>
    quads.filter((q) => q.predicate.value === `${VOID_NS}${p}`);
  const linksetNodes = quads.filter(
    (q) =>
      q.predicate.value === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type" &&
      q.object.value === `${VOID_NS}Linkset`,
  );
  const expectedLinksets = Object.keys(PINNED_LINKSETS).length + 1; // + skos mappings
  if (linksetNodes.length !== expectedLinksets) {
    voidErr(
      `void.ttl has ${linksetNodes.length} void:Linkset nodes, expected ${expectedLinksets}`,
    );
  }
  const tripleCounts = byPred("triples").map((q) => Number(q.object.value));
  for (const expected of [
    graph.triples,
    annotated.triples,
    ...Object.values(PINNED_LINKSETS),
    PINNED_SKOS_MAPPINGS,
  ]) {
    if (!tripleCounts.includes(expected)) {
      voidErr(`void.ttl carries no void:triples ${expected}`);
    }
  }
  const dumps = new Set(byPred("dataDump").map((q) => q.object.value));
  if (dumps.size !== 6) {
    voidErr(`void.ttl lists ${dumps.size} void:dataDump URLs, expected 6`);
  }
  for (const dump of dumps) {
    if (!/\/api\/lod\/graph(-annotated)?\.(ttl|jsonld|rdf)$/.test(dump)) {
      voidErr(`unexpected void:dataDump URL ${dump}`);
    }
  }
  if (byPred("sparqlEndpoint").length !== 1) {
    voidErr("void.ttl must declare exactly one void:sparqlEndpoint");
  }
  // VoID-only harvesters must learn the published SHACL shapes exist:
  // the main dataset advertises them via dcterms:conformsTo.
  // Both the main dataset AND the annotated dataset (whose dump provably
  // passes the shapes — validate-shapes runs pySHACL over it) must carry
  // the triple, pinned per subject so one can't silently vanish.
  const conformsToBySubject = new Map<string, string[]>();
  for (const q of quads) {
    if (q.predicate.value !== "http://purl.org/dc/terms/conformsTo") continue;
    const arr = conformsToBySubject.get(q.subject.value) ?? [];
    arr.push(q.object.value);
    conformsToBySubject.set(q.subject.value, arr);
  }
  for (const subject of [`${LOD_BASE}/void#dataset`, `${LOD_BASE}/void#annotated`]) {
    const targets = conformsToBySubject.get(subject) ?? [];
    if (!targets.some((u) => u.endsWith("/api/lod/shapes.ttl"))) {
      voidErr(
        `void.ttl: <${subject}> carries no dcterms:conformsTo pointing at /api/lod/shapes.ttl`,
      );
    }
  }
  const vocabs = byPred("vocabulary").map((q) => q.object.value);
  const PINNED_VOCABULARIES = 14; // 13 on the dataset + oa: on the annotated
  if (vocabs.length !== PINNED_VOCABULARIES) {
    voidErr(
      `void.ttl lists ${vocabs.length} void:vocabulary URIs, expected ${PINNED_VOCABULARIES}`,
    );
  }

  voidSummary =
    `void: ${stats.triples} triples / linksets wikidata ${PINNED_LINKSETS["wikidata"]}, ` +
    `dbpedia ${PINNED_LINKSETS["dbpedia"]}, viaf ${PINNED_LINKSETS["viaf"]}, ` +
    `inpho ${PINNED_LINKSETS["inpho"]}, pleiades ${PINNED_LINKSETS["pleiades"]} ` +
    `+ ${PINNED_SKOS_MAPPINGS} skos mappings / ${vocabs.length} vocabularies / 6 dumps + sparql`;
  console.log(voidSummary);
}

if (failed) process.exit(1);

console.log(
  `OK: graph ${graph.triples} triples (Turtle = RDF/XML), ` +
    `annotated graph ${annotated.triples} triples (Turtle = RDF/XML, full oa: layer), ` +
    `ontology ${ontology.triples} triples (Turtle = RDF/XML), ` +
    `JSON-LD ${jsonLdNodes} @graph nodes round-trip clean, ` +
    `${otvSummary} (Turtle = JSON-LD), ` +
    `${sourcesSummary}, ` +
    `${workFacetSummary}, ` +
    `${chapterSummary}, ` +
    `${sampleSections.length} sample passages ${sectionTriples} triples (quads = RDF/XML, JSON-LD clean)`,
);
