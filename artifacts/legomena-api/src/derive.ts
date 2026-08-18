/**
 * Knowledge-graph derivation: philosopher nodes and relation edges are
 * reconstructed from the store by SPARQL alone - nodes from the lo:Chapter
 * assertions, edges from the reified rdf:Statement assertions that carry a
 * D.L. citation. The queries below are served verbatim in the /graph
 * payload so the client can show exactly how its picture was derived.
 */
import type { Store } from "oxigraph";
import { logger } from "./logger";
import { prologue } from "./store";
import { certaintyRank, type Model } from "./model";

export const NODE_QUERY = `SELECT DISTINCT ?phil ?name ?school ?book ?chapter WHERE {
  ?ch a lo:Chapter ;
      lo:hasMainSubject ?phil ;
      lo:inBook ?book ;
      lo:chapterNumber ?chapter .
  ?phil rdfs:label ?name ;
        lo:memberOf ?school .
}
ORDER BY ?book ?chapter`;

export const EDGE_QUERY = `SELECT DISTINCT ?stmt ?from ?to ?pred ?cit WHERE {
  ?stmt a rdf:Statement ;
        rdf:subject ?from ;
        rdf:predicate ?pred ;
        rdf:object ?to ;
        dcterms:bibliographicCitation ?cit .
  VALUES ?pred { lo:teacherOf lo:influenced lo:spouseOf }
  { ?from a lo:Philosopher } UNION { ?from a lo:Sage }
  { ?to a lo:Philosopher } UNION { ?to a lo:Sage }
  FILTER NOT EXISTS { ?stmt lo:accordingTo ?src }
  FILTER NOT EXISTS { ?stmt rdfs:comment ?note }
}`;

export const DERIVATION_DESCRIPTION =
  "Nodes are the chapter subjects: every lo:Chapter names its lo:hasMainSubject, and the subject's label, school membership and book placement are read off the assertion graph. Edges are the reified rdf:Statement assertions whose predicate is one of the three curated relations (teacherOf, influenced, spouseOf), whose endpoints are both chapter subjects, and which carry no lo:accordingTo or editorial rdfs:comment - source-attributed succession reports (Diocles on Chrysippus' teachers, for instance) belong to the entity pages, not the canonical graph. Each edge keeps the statement's D.L. citation and its certainty: asserted when the direct triple also holds, reported when the relation exists only as a reification.";

export interface DerivedNode {
  uri: string;
  name: string;
  grcName?: string;
  school: string;
  schoolUri: string;
  schoolLabel: string;
  book: number;
  chapter: string;
  claimCount: number;
  sage?: boolean;
}

export interface DerivedEdge {
  from: string;
  to: string;
  fromUri: string;
  toUri: string;
  type: string;
  predicateUri: string;
  ref: string;
  citation: string;
  certainty: string;
  attribution: string;
  sectionId?: string;
}

export interface DerivedGraph {
  nodes: DerivedNode[];
  edges: DerivedEdge[];
}

interface OxTerm {
  termType: string;
  value: string;
}

type Row = Map<string, OxTerm>;

function localName(uri: string): string {
  const cut = Math.max(uri.lastIndexOf("#"), uri.lastIndexOf("/"));
  return cut >= 0 ? uri.slice(cut + 1) : uri;
}

let derived: DerivedGraph | null = null;

export function getDerivedGraph(): DerivedGraph {
  if (!derived) throw new Error("Derived graph not built");
  return derived;
}

export function deriveGraph(store: Store, model: Model): DerivedGraph {
  const t0 = performance.now();
  const q = (body: string): Row[] =>
    store.query(`${prologue()}\n${body}`) as Row[];

  const nodes: DerivedNode[] = [];
  const nodeByUri = new Map<string, DerivedNode>();
  for (const r of q(NODE_QUERY)) {
    const phil = r.get("phil");
    const school = r.get("school");
    if (!phil || !school) continue;
    if (nodeByUri.has(phil.value)) continue;
    const entity = model.entityByUri.get(phil.value);
    // ?name binds ANY rdfs:label (the dataset carries several languages);
    // the model's label index ranks @en first, so use it for display.
    const node: DerivedNode = {
      uri: phil.value,
      name: model.labelOf(phil.value) ?? r.get("name")?.value ?? phil.value,
      grcName: entity?.grcName,
      school: localName(school.value),
      schoolUri: school.value,
      schoolLabel: model.labelOf(school.value) ?? localName(school.value),
      book: Number(r.get("book")?.value ?? 0) || 0,
      chapter: r.get("chapter")?.value ?? "",
      claimCount: model.assertionsBySubject.get(phil.value)?.length ?? 0,
      sage: sageFlag(model, phil.value),
    };
    nodes.push(node);
    nodeByUri.set(phil.value, node);
  }

  const edges: DerivedEdge[] = [];
  const seen = new Set<string>();
  for (const r of q(EDGE_QUERY)) {
    const stmt = r.get("stmt");
    const from = r.get("from");
    const to = r.get("to");
    const pred = r.get("pred");
    if (!stmt || !from || !to || !pred) continue;
    // Both endpoints must be chapter subjects: the succession-links layer
    // also reifies teacherOf statements for pupils without a Life of their
    // own, and those belong to the entity pages, not the curated graph.
    const fromNode = nodeByUri.get(from.value);
    const toNode = nodeByUri.get(to.value);
    if (!fromNode || !toNode) continue;
    const citation = r.get("cit")?.value ?? "";
    const dedupe = `${from.value}|${pred.value}|${to.value}|${citation}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const asserted = store.query(
      `ASK { <${from.value}> <${pred.value}> <${to.value}> }`,
    ) as boolean;
    const stmtKey = stmt.termType === "BlankNode" ? `_:${stmt.value}` : stmt.value;
    const attribution = attributionFor(model, stmtKey);
    const { ref, sectionId } = model.resolveRef(citation, from.value, to.value);
    edges.push({
      from: fromNode.name,
      to: toNode.name,
      fromUri: from.value,
      toUri: to.value,
      type: localName(pred.value),
      predicateUri: pred.value,
      ref,
      citation,
      certainty: asserted ? "asserted" : "reported",
      attribution,
      sectionId,
    });
  }
  edges.sort(
    (a, b) =>
      a.type.localeCompare(b.type) ||
      a.from.localeCompare(b.from) ||
      a.to.localeCompare(b.to) ||
      certaintyRank(a.certainty) - certaintyRank(b.certainty),
  );

  derived = { nodes, edges };
  logger.info(
    {
      ms: Math.round(performance.now() - t0),
      nodes: nodes.length,
      edges: edges.length,
    },
    "Knowledge graph derived from assertions",
  );
  return derived;
}

function sageFlag(model: Model, uri: string): boolean | undefined {
  for (const t of model.typesOf(uri)) {
    if (t.endsWith("#Sage")) return true;
  }
  return undefined;
}

function attributionFor(model: Model, stmtKey: string): string {
  // The model keeps lo:accordingTo for claim URIs and statement blank
  // nodes alike, keyed by term id; graph edges rarely carry one, in which
  // case the relation is Diogenes' own report.
  const sources = model.statementAccordingTo.get(stmtKey);
  if (sources && sources.length > 0) {
    return sources
      .map((s) => s.label ?? s.uri.split("/").pop() ?? s.uri)
      .join(", ");
  }
  return "Diogenes Laertius";
}
