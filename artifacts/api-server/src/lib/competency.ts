/**
 * Competency questions for the Laertius knowledge graph.
 *
 * Each question carries a SPARQL SELECT query (built from the runtime
 * LOD_BASE and ONT) and a list of seed philosopher names that anchor
 * the subgraph even when the query results are titles or place names
 * rather than philosopher labels.
 *
 * Queries target the oxigraph in-memory store loaded from graphAsTurtle()
 * and ontologyAsTurtle(). All philosopher rdfs:labels are @en-tagged;
 * FILTER(lang(?x) = "en") is used throughout to avoid duplicates.
 */

import { createHash } from "node:crypto";
import { OTV } from "./lod";

export interface CompetencyQuestion {
  id: string;
  question: string;
  greekTerm?: string;
  category: string;
  sparqlFn: (base: string, ont: string) => string;
  /** Philosopher names (KG node names) to anchor the subgraph. */
  seedLabels: string[];
  /**
   * Per-question person-sense hints for the Entities-card classifier
   * (classifyExtraTerm in routes/competency.ts). The classifier buckets
   * a row value by fixed table precedence (movement > place > work >
   * person), so a person whose name collides with an earlier table (the
   * city Croton, the dialogue title Telauges) could never surface as a
   * person chip. Listing the label here says: in THIS question's rows,
   * the value denotes the person, so the person sense wins — provided
   * the label still verifies as a person (curated Greek name or LOD
   * person typing); an unverifiable hint is ignored rather than minting
   * a bogus person chip. Hints are validated for honesty (present in
   * the live rows, verifiable, actually shadowed) by
   * validate-competency-counts.ts.
   */
  personTermHints?: readonly string[];
}

export type CompetencyQuestionMeta = Omit<
  CompetencyQuestion,
  "sparqlFn" | "seedLabels" | "personTermHints"
> & {
  /**
   * Fingerprint of the compiled SPARQL query, computed over the query text
   * built with fixed placeholder base/ontology URIs so it is independent of
   * the runtime LOD_BASE. Exposed in the catalogue so the bundle smoke test
   * can detect a query-only edit (same wording, different answers).
   */
  queryHash: string;
  /**
   * Fingerprint of the question's seedLabels (the anchor philosophers that
   * seed the answer subgraph), order-insensitive. Exposed so the bundle
   * smoke test can detect a seed-only edit: the served nodes/edges change
   * while wording and SPARQL stay the same.
   */
  seedHash: string;
};

/**
 * Hash a question's SPARQL query with placeholder URIs. Exported so the
 * bundle smoke test can compute the expected hash from this same module.
 */
export function competencyQueryHash(
  sparqlFn: (base: string, ont: string) => string,
): string {
  return createHash("sha256")
    .update(sparqlFn("__BASE__", "__ONT__#"))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Hash a question's seedLabels, order-insensitive (sorted copy). Exported so
 * the bundle smoke test can compute the expected hash from this same module.
 */
export function competencySeedHash(seedLabels: string[]): string {
  return createHash("sha256")
    .update(JSON.stringify([...seedLabels].sort()))
    .digest("hex")
    .slice(0, 16);
}

function prolog(ont: string): string {
  return (
    `PREFIX lo: <${ont}>\n` +
    `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n`
  );
}

function prologWithOtv(ont: string): string {
  return (
    `PREFIX lo: <${ont}>\n` +
    `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n` +
    `PREFIX otv: <${OTV}>\n`
  );
}

/**
 * Reviewed exceptions: seed labels that are deliberately NOT knowledge-graph
 * nodes because the figure has no Life chapter (and thus no KG node). The
 * answer route drops them from the subgraph by design; this map is the
 * single source of truth read by BOTH the /competency UI (which surfaces
 * them as a labelled note instead of a silent omission) and the
 * validate-competency-index-links guard (which pins the exception list so
 * any new drift fails loudly).
 */
export const KNOWN_DROPPED_SEEDS: ReadonlyMap<string, readonly string[]> =
  new Map([
    ["homonymy-proper-names", ["Zeno of Sidon", "Diogenes Laertius"]],
  ]);

/**
 * The reviewed dropped seeds for a question: anchors that are curated in
 * seedLabels but have no Life chapter, so they never appear in the answer
 * subgraph. Empty for questions without a pinned exception.
 */
export function getDroppedSeeds(id: string): string[] {
  return [...(KNOWN_DROPPED_SEEDS.get(id) ?? [])];
}

export const COMPETENCY_QUESTIONS: CompetencyQuestion[] = [
  // ── Schools & Membership ─────────────────────────────────────────────────
  {
    id: "stoa-members",
    question: "Which philosophers belonged to the Stoic school?",
    greekTerm: "Στωικοί",
    category: "Schools & Membership",
    seedLabels: ["Zeno of Citium", "Cleanthes", "Chrysippus"],
    sparqlFn: (base, ont) =>
      `${prolog(ont)}
SELECT ?name WHERE {
  ?p a lo:Philosopher ;
     rdfs:label ?name ;
     lo:memberOf <${base}/school/stoa> .
  FILTER(lang(?name) = "en")
}
ORDER BY ?name`,
  },
  {
    id: "academy-members",
    question: "Which philosophers studied at Plato's Academy?",
    greekTerm: "Ἀκαδήμεια",
    category: "Schools & Membership",
    seedLabels: ["Plato", "Speusippus", "Xenocrates", "Aristotle", "Arcesilaus"],
    sparqlFn: (base, ont) =>
      `${prolog(ont)}
SELECT ?name WHERE {
  ?p a lo:Philosopher ;
     rdfs:label ?name ;
     lo:memberOf <${base}/school/academy> .
  FILTER(lang(?name) = "en")
}
ORDER BY ?name`,
  },
  {
    id: "school-founders",
    question: "Who founded which philosophical school?",
    greekTerm: "διαδοχαί",
    category: "Schools & Membership",
    seedLabels: [
      "Socrates", "Plato", "Aristotle", "Epicurus",
      "Zeno of Citium", "Antisthenes", "Pythagoras",
    ],
    sparqlFn: (_base, ont) =>
      `${prolog(ont)}
SELECT ?name ?school WHERE {
  ?p lo:foundedSchool ?s ;
     rdfs:label ?name .
  ?s rdfs:label ?school .
  FILTER(lang(?name) = "en")
  FILTER(lang(?school) = "en")
}
ORDER BY ?name`,
  },
  {
    id: "cynic-line",
    question: "Who formed the Cynic line of succession from Antisthenes?",
    greekTerm: "Κυνικοί",
    category: "Schools & Membership",
    seedLabels: ["Antisthenes", "Diogenes of Sinope", "Crates of Thebes", "Hipparchia", "Menippus"],
    sparqlFn: (base, ont) =>
      `${prolog(ont)}
SELECT ?name WHERE {
  ?p a lo:Philosopher ;
     rdfs:label ?name ;
     lo:memberOf <${base}/school/cynic> .
  FILTER(lang(?name) = "en")
}
ORDER BY ?name`,
  },
  {
    id: "peripatos-members",
    question: "Who were the Peripatetic philosophers in the Lives?",
    greekTerm: "Περίπατος",
    category: "Schools & Membership",
    seedLabels: ["Aristotle", "Theophrastus", "Strato", "Lyco", "Demetrius of Phalerum"],
    sparqlFn: (base, ont) =>
      `${prolog(ont)}
SELECT ?name WHERE {
  ?p a lo:Philosopher ;
     rdfs:label ?name ;
     lo:memberOf <${base}/school/peripatos> .
  FILTER(lang(?name) = "en")
}
ORDER BY ?name`,
  },
  {
    // Deliberately NO class constraint: the Garden roster of 10.22-26
    // (school-members.ts) attaches lo:memberOf to cited disciples who
    // are foaf:Person and lo:Source nodes, not chapter subjects, so a
    // lo:Philosopher constraint would hide everyone but Epicurus.
    id: "garden-members",
    question: "Who belonged to Epicurus' Garden?",
    greekTerm: "Κῆπος",
    category: "Schools & Membership",
    seedLabels: ["Epicurus"],
    sparqlFn: (base, ont) =>
      `${prolog(ont)}
SELECT ?name WHERE {
  ?p rdfs:label ?name ;
     lo:memberOf <${base}/school/epicurean> .
  FILTER(lang(?name) = "en")
}
ORDER BY ?name`,
  },
  // ── Biography ────────────────────────────────────────────────────────────
  {
    id: "socrates-students",
    question: "Who were the direct students of Socrates?",
    greekTerm: "Σωκράτης",
    category: "Biography",
    seedLabels: ["Socrates", "Plato", "Xenophon", "Antisthenes", "Aristippus", "Aeschines"],
    sparqlFn: (base, ont) =>
      `${prolog(ont)}
SELECT ?name WHERE {
  <${base}/philosopher/socrates> lo:teacherOf ?s .
  ?s rdfs:label ?name .
  FILTER(lang(?name) = "en")
}
ORDER BY ?name`,
  },
  {
    id: "aristotle-teachers",
    question: "Who were the teachers of Aristotle?",
    greekTerm: "Ἀριστοτέλης",
    category: "Biography",
    seedLabels: ["Plato", "Aristotle"],
    sparqlFn: (base, ont) =>
      `${prolog(ont)}
SELECT ?name WHERE {
  ?t lo:teacherOf <${base}/philosopher/aristotle> .
  ?t rdfs:label ?name .
  FILTER(lang(?name) = "en")
}
ORDER BY ?name`,
  },
  {
    id: "marriages",
    question: "Which philosophers in the Lives had known marriages?",
    greekTerm: "γάμος",
    category: "Biography",
    seedLabels: ["Socrates", "Crates of Thebes", "Hipparchia"],
    sparqlFn: (_base, ont) =>
      `${prolog(ont)}
SELECT ?a ?b WHERE {
  ?p lo:spouseOf ?q .
  ?p rdfs:label ?a .
  ?q rdfs:label ?b .
  FILTER(lang(?a) = "en")
  FILTER(lang(?b) = "en")
}
ORDER BY ?a`,
  },
  {
    id: "eleatic-atomist-chain",
    question: "How did the Eleatic teaching chain lead to Atomism?",
    greekTerm: "ἄτομος",
    category: "Biography",
    seedLabels: [
      "Xenophanes", "Parmenides", "Zeno of Elea", "Melissus",
      "Leucippus", "Democritus", "Anaxarchus", "Pyrrho",
    ],
    sparqlFn: (base, ont) =>
      `${prolog(ont)}
SELECT ?from ?to WHERE {
  VALUES ?p {
    <${base}/philosopher/xenophanes>
    <${base}/philosopher/parmenides>
    <${base}/philosopher/zeno-of-elea>
    <${base}/philosopher/leucippus>
    <${base}/philosopher/democritus>
    <${base}/philosopher/anaxarchus>
  }
  { ?p lo:teacherOf ?q } UNION { ?p lo:influenced ?q }
  ?p rdfs:label ?from .
  ?q rdfs:label ?to .
  FILTER(lang(?from) = "en")
  FILTER(lang(?to) = "en")
}
ORDER BY ?from ?to`,
  },
  // ── People & Places ──────────────────────────────────────────────────────
  {
    id: "born-in-athens",
    question: "Which philosophers in the Lives were born in Athens?",
    greekTerm: "Ἀθῆναι",
    category: "People & Places",
    seedLabels: ["Socrates", "Plato"],
    // ?birthplace projects the place label ("Athens") into the rows so
    // this People & Places question ships a place term (with its curated
    // Greek form, Ἀθῆναι) in the Entities card — the place branch of the
    // extra-terms classifier is exercised by a real question instead of
    // staying dormant. Pinned by validate-competency-terms and the
    // e2e bilingual-terms check.
    sparqlFn: (_base, ont) =>
      `${prolog(ont)}
SELECT ?name ?birthplace WHERE {
  ?p a lo:ChapterSubject ;
     rdfs:label ?name ;
     lo:bornIn ?place .
  ?place rdfs:label ?birthplace .
  FILTER(?birthplace = "Athens"@en)
  FILTER(lang(?name) = "en")
}
ORDER BY ?name`,
  },
  {
    id: "died-in-athens",
    question: "Which philosophers died in Athens?",
    greekTerm: "Ἀθῆναι",
    category: "People & Places",
    seedLabels: ["Socrates", "Plato", "Aristotle"],
    sparqlFn: (_base, ont) =>
      `${prolog(ont)}
SELECT ?name WHERE {
  ?p a lo:ChapterSubject ;
     rdfs:label ?name ;
     lo:diedIn ?place .
  ?place rdfs:label "Athens"@en .
  FILTER(lang(?name) = "en")
}
ORDER BY ?name`,
  },
  // ── Works & Survival ─────────────────────────────────────────────────────
  {
    id: "plato-works",
    question: "What works did Plato write, according to Diogenes Laertius?",
    greekTerm: "Πλάτων",
    category: "Works & Survival",
    seedLabels: ["Plato"],
    sparqlFn: (base, ont) =>
      `${prolog(ont)}
SELECT ?title WHERE {
  <${base}/philosopher/plato> lo:wrote ?w .
  ?w rdfs:label ?title .
  FILTER(lang(?title) = "en")
}
ORDER BY ?title`,
  },
  {
    id: "aristotle-works",
    question: "What works did Aristotle write, according to Diogenes Laertius?",
    greekTerm: "Ἀριστοτέλης",
    category: "Works & Survival",
    seedLabels: ["Aristotle"],
    sparqlFn: (base, ont) =>
      `${prolog(ont)}
SELECT ?title WHERE {
  <${base}/philosopher/aristotle> lo:wrote ?w .
  ?w rdfs:label ?title .
  FILTER(lang(?title) = "en")
}
ORDER BY ?title`,
  },
  {
    id: "epicurus-works",
    question: "What works did Epicurus write, according to Diogenes Laertius?",
    greekTerm: "Ἐπίκουρος",
    category: "Works & Survival",
    seedLabels: ["Epicurus"],
    sparqlFn: (base, ont) =>
      `${prolog(ont)}
SELECT ?title WHERE {
  <${base}/philosopher/epicurus> lo:wrote ?w .
  ?w rdfs:label ?title .
  FILTER(lang(?title) = "en")
}
ORDER BY ?title`,
  },
  // ── Doctrines & Topics ───────────────────────────────────────────────────
  {
    id: "school-doctrines",
    question: "What was the principal doctrine (telos) of each philosophical school?",
    greekTerm: "τέλος",
    category: "Doctrines & Topics",
    seedLabels: [
      "Plato", "Aristotle", "Epicurus", "Zeno of Citium",
      "Antisthenes", "Pyrrho", "Arcesilaus",
    ],
    sparqlFn: (_base, ont) =>
      `${prolog(ont)}
SELECT ?school ?doctrine WHERE {
  ?s a lo:School ;
     rdfs:label ?school ;
     lo:principalDoctrine ?d .
  ?d rdfs:label ?doctrine .
  FILTER(lang(?school) = "en")
  FILTER(lang(?doctrine) = "en")
}
ORDER BY ?school`,
  },
  {
    id: "homonymy-proper-names",
    question:
      "Which pairs of ProperName nodes share the same Greek proper-name literal but denote different individuals?",
    category: "Homonymy & Identity",
    seedLabels: [
      "Zeno of Citium", "Zeno of Elea", "Zeno of Sidon",
      "Diogenes of Sinope", "Diogenes Laertius",
      "Crates of Thebes", "Crates of Athens",
    ],
    // In this question's rows every name1/name2 label denotes a PERSON
    // (a homonym bearer), so the two labels shadowed by earlier
    // classifier tables — Croton (also a city in PLACE_TYPES) and
    // Telauges (also an Aeschines dialogue title in WORK_FACETS) —
    // must bucket as person chips here, not place/work chips.
    personTermHints: ["Croton", "Telauges"],
    sparqlFn: (_base, ont) =>
      `${prologWithOtv(ont)}
SELECT DISTINCT ?form ?name1 ?name2 WHERE {
  ?pn1 a otv:ProperName ;
       otv:language "grc" ;
       otv:properName ?form ;
       otv:denotedObject ?obj1 .
  ?pn2 a otv:ProperName ;
       otv:language "grc" ;
       otv:properName ?form ;
       otv:denotedObject ?obj2 .
  FILTER(STR(?pn1) < STR(?pn2) && ?obj1 != ?obj2)
  OPTIONAL { ?obj1 rdfs:label ?name1 . FILTER(lang(?name1) = "en") }
  OPTIONAL { ?obj2 rdfs:label ?name2 . FILTER(lang(?name2) = "en") }
}
ORDER BY ?form`,
  },
];

export function getCompetencyQuestions(): CompetencyQuestionMeta[] {
  return COMPETENCY_QUESTIONS.map(
    ({ id, question, greekTerm, category, sparqlFn, seedLabels }) => ({
      id,
      question,
      ...(greekTerm ? { greekTerm } : {}),
      category,
      queryHash: competencyQueryHash(sparqlFn),
      seedHash: competencySeedHash(seedLabels),
    }),
  );
}

export function findCompetencyQuestion(id: string): CompetencyQuestion | undefined {
  return COMPETENCY_QUESTIONS.find((q) => q.id === id);
}
