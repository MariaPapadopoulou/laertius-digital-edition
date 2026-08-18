/**
 * SPARQL-derived working model. At startup this module runs a fixed set of
 * bulk queries against the store and materialises plain-JS indexes
 * (assertions, passages, annotations, entities). Nothing here reads any
 * source other than the store: the indexes are pure query results, cached
 * because the dataset is immutable for the lifetime of the process.
 */
import { createHash } from "node:crypto";
import type { Store } from "oxigraph";
import { logger } from "./logger";
import { prologue, ns } from "./store";

interface OxTerm {
  termType: string;
  value: string;
  language?: string;
  datatype?: { value: string };
}

type Row = Map<string, OxTerm>;

export interface LinkOutRec {
  uri: string;
  label?: string;
}

export interface ProperNameRec {
  uri: string;
  form: string;
  lang: string;
}

export interface ChainLinkRec {
  authorityUri: string;
  authorityLabel: string;
  order: number;
}

export interface ConflictRec {
  uri: string;
  summary?: string;
}

export interface AssertionRec {
  uri: string;
  kind: "claim" | "relation";
  subjectUri: string;
  subjectLabel: string;
  predicateUri: string;
  predicateLabel: string;
  objectUri?: string;
  objectLabel?: string;
  objectValue?: string;
  objectLang?: string;
  certainty: string;
  accordingTo: LinkOutRec[];
  assertedInWork?: LinkOutRec;
  chain: ChainLinkRec[];
  conflictsWith: ConflictRec[];
  citation: string;
  ref: string;
  sectionId?: string;
  grc?: string;
  note?: string;
}

export interface AnnotationRec {
  annotationUri: string;
  start: number;
  end: number;
  lang: "grc" | "en";
  exact: string;
  entityUri: string;
  nameUri?: string;
  conceptUris?: string[];
  order: number;
}

export interface PassageRec {
  id: string;
  uri: string;
  citation: string;
  urn: string;
  book: number;
  chapter: string;
  section: string;
  lifeOf?: string;
  lifeOfUri?: string;
  greekText: string;
  englishText?: string;
  annotations: AnnotationRec[];
}

export interface EntityRec {
  uri: string;
  label: string;
  kind: string;
  kinds: string[];
  grcName?: string;
  properNames: ProperNameRec[];
  sameAs: LinkOutRec[];
  seeAlso: LinkOutRec[];
  schoolUri?: string;
  schoolLabel?: string;
  founderOf?: string;
  book?: number;
  chapter?: string;
  claimCount: number;
  annotationCount: number;
}

export interface Model {
  labelOf: (uri: string) => string | undefined;
  displayLabel: (uri: string) => string;
  predicateLabel: (uri: string) => string;
  typesOf: (uri: string) => ReadonlySet<string>;
  passagesOrdered: PassageRec[];
  passageById: Map<string, PassageRec>;
  claims: AssertionRec[];
  statements: AssertionRec[];
  assertionByUri: Map<string, AssertionRec>;
  assertionsBySubject: Map<string, AssertionRec[]>;
  assertionsByObject: Map<string, AssertionRec[]>;
  assertionsBySection: Map<string, AssertionRec[]>;
  entities: EntityRec[];
  entityByUri: Map<string, EntityRec>;
  annotationsByEntity: Map<string, { sectionId: string; ann: AnnotationRec }[]>;
  chapterOf: Map<string, { book: number; chapter: string }>;
  /** lo:accordingTo per assertion node (claim URI or statement blank-node key). */
  statementAccordingTo: Map<string, LinkOutRec[]>;
  resolveRef: (
    citation: string,
    subjectUri?: string,
    objectUri?: string,
  ) => { ref: string; sectionId?: string };
}

function termKey(t: OxTerm): string {
  return t.termType === "BlankNode" ? `_:${t.value}` : t.value;
}

function localName(uri: string): string {
  const cut = Math.max(uri.lastIndexOf("#"), uri.lastIndexOf("/"));
  return cut >= 0 ? uri.slice(cut + 1) : uri;
}

function camelToWords(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
}

/** Reading-order sort key for a section id "book.chapter.section". */
export function sectionOrderKey(id: string): [number, number, number, string] {
  const parts = id.split(".");
  const book = Number(parts[0] ?? 0) || 0;
  const chapterRaw = parts[1] ?? "";
  const chapter = /^\d+$/.test(chapterRaw) ? Number(chapterRaw) : -1;
  const sectionRaw = parts.slice(2).join(".");
  const m = sectionRaw.match(/^(\d+)([a-z]*)$/i);
  const section = m ? Number(m[1]) : 0;
  const suffix = m ? (m[2] ?? "") : sectionRaw;
  return [book, chapter, section, suffix];
}

export function compareSectionIds(a: string, b: string): number {
  const ka = sectionOrderKey(a);
  const kb = sectionOrderKey(b);
  for (let i = 0; i < 3; i++) {
    if ((ka[i] as number) !== (kb[i] as number))
      return (ka[i] as number) - (kb[i] as number);
  }
  return ka[3].localeCompare(kb[3]);
}

const CERTAINTY_ORDER: Record<string, number> = {
  asserted: 0,
  reported: 1,
  disputed: 2,
  conjectured: 3,
};

export function certaintyRank(c: string): number {
  return CERTAINTY_ORDER[c] ?? 4;
}

let model: Model | null = null;

export function getModel(): Model {
  if (!model) throw new Error("Model not built");
  return model;
}

export function buildModel(store: Store): Model {
  const t0 = performance.now();
  const LO = ns("lo");
  const OA = ns("oa");
  const OTV = ns("otv");
  const RDF = ns("rdf");
  const DCT = ns("dcterms");
  const FOAF = ns("foaf");

  const q = (body: string): Row[] =>
    store.query(`${prologue()}\n${body}`) as Row[];

  // ---- labels (prefer @en, then untagged) --------------------------------
  const labelMap = new Map<string, string>();
  const labelRank = new Map<string, number>();
  for (const r of q(`SELECT ?s ?l WHERE { ?s rdfs:label ?l }`)) {
    const s = r.get("s");
    const l = r.get("l");
    if (!s || !l) continue;
    const key = termKey(s);
    const lang = l.language ?? "";
    const rank = lang === "en" ? 0 : lang === "" ? 1 : lang === "grc" ? 3 : 2;
    const prev = labelRank.get(key);
    if (prev === undefined || rank < prev) {
      labelMap.set(key, l.value);
      labelRank.set(key, rank);
    }
  }

  // ---- rdf:type ----------------------------------------------------------
  const typesMap = new Map<string, Set<string>>();
  for (const r of q(`SELECT ?s ?t WHERE { ?s a ?t }`)) {
    const s = r.get("s");
    const t = r.get("t");
    if (!s || !t) continue;
    const key = termKey(s);
    let set = typesMap.get(key);
    if (!set) {
      set = new Set();
      typesMap.set(key, set);
    }
    set.add(t.value);
  }
  const typesOf = (uri: string): ReadonlySet<string> =>
    typesMap.get(uri) ?? new Set();

  const labelOf = (uri: string): string | undefined => labelMap.get(uri);
  const displayLabel = (uri: string): string =>
    labelMap.get(uri) ?? decodeURIComponent(localName(uri)).replace(/[-_]/g, " ");
  const predicateLabel = (uri: string): string =>
    labelMap.get(uri) ?? camelToWords(localName(uri));

  // ---- passages ----------------------------------------------------------
  const passageById = new Map<string, PassageRec>();
  for (const r of q(
    `SELECT ?p ?cit ?urn ?grc ?en ?life WHERE {
      ?p a lo:Passage ;
         dcterms:bibliographicCitation ?cit ;
         dcterms:source ?urn ;
         lo:greekText ?grc .
      OPTIONAL { ?p lo:englishText ?en }
      OPTIONAL { ?p lo:inLifeOf ?life }
    }`,
  )) {
    const p = r.get("p");
    if (!p) continue;
    const uri = p.value;
    const marker = "/passage/";
    const id = uri.slice(uri.lastIndexOf(marker) + marker.length);
    const parts = id.split(".");
    const life = r.get("life");
    passageById.set(id, {
      id,
      uri,
      citation: r.get("cit")?.value ?? "",
      urn: r.get("urn")?.value ?? "",
      book: Number(parts[0] ?? 0) || 0,
      chapter: parts[1] ?? "",
      section: parts.slice(2).join("."),
      lifeOfUri: life?.value,
      lifeOf: life ? labelMap.get(life.value) : undefined,
      greekText: r.get("grc")?.value ?? "",
      englishText: r.get("en")?.value,
      annotations: [],
    });
  }
  const passagesOrdered = [...passageById.values()].sort((a, b) =>
    compareSectionIds(a.id, b.id),
  );

  // ---- annotations (grouped by annotation URI; bodies classified by type)
  interface AnnAgg {
    uri: string;
    sectionId: string;
    order: number;
    passage?: string;
    lang?: string;
    exact?: string;
    start?: number;
    end?: number;
    bodies: string[];
  }
  const annAgg = new Map<string, AnnAgg>();
  for (const r of q(
    `SELECT ?a ?body ?src ?lang ?exact ?start ?end WHERE {
      ?a a oa:Annotation ;
         oa:hasBody ?body ;
         oa:hasTarget ?t .
      ?t oa:hasSource ?src ;
         dcterms:language ?lang .
      ?t oa:hasSelector ?qs .
      ?qs a oa:TextQuoteSelector ; oa:exact ?exact .
      ?t oa:hasSelector ?ps .
      ?ps a oa:TextPositionSelector ; oa:start ?start ; oa:end ?end .
    }`,
  )) {
    const a = r.get("a");
    const body = r.get("body");
    if (!a || !body) continue;
    const uri = a.value;
    let agg = annAgg.get(uri);
    if (!agg) {
      const marker = "/annotation/";
      const tail = uri.slice(uri.lastIndexOf(marker) + marker.length);
      const slash = tail.lastIndexOf("/");
      agg = {
        uri,
        sectionId: tail.slice(0, slash),
        order: Number(tail.slice(slash + 1)) || 0,
        bodies: [],
      };
      annAgg.set(uri, agg);
    }
    agg.passage = r.get("src")?.value;
    agg.lang = r.get("lang")?.value;
    agg.exact = r.get("exact")?.value;
    agg.start = Number(r.get("start")?.value ?? 0);
    agg.end = Number(r.get("end")?.value ?? 0);
    if (!agg.bodies.includes(body.value)) agg.bodies.push(body.value);
  }
  const annotationsByEntity = new Map<
    string,
    { sectionId: string; ann: AnnotationRec }[]
  >();
  for (const agg of annAgg.values()) {
    const passage = passageById.get(agg.sectionId);
    if (!passage || agg.exact === undefined) continue;
    let entityUri: string | undefined;
    let nameUri: string | undefined;
    const conceptUris: string[] = [];
    for (const b of agg.bodies) {
      const types = typesOf(b);
      if (types.has(`${OTV}ProperName`)) nameUri = b;
      else if (types.has(`${OTV}Concept`)) conceptUris.push(b);
      else entityUri = entityUri ?? b;
    }
    if (!entityUri) continue;
    const rec: AnnotationRec = {
      annotationUri: agg.uri,
      start: agg.start ?? 0,
      end: agg.end ?? 0,
      lang: agg.lang === "en" ? "en" : "grc",
      exact: agg.exact,
      entityUri,
      nameUri,
      conceptUris: conceptUris.length > 0 ? conceptUris : undefined,
      order: agg.order,
    };
    passage.annotations.push(rec);
    let list = annotationsByEntity.get(entityUri);
    if (!list) {
      list = [];
      annotationsByEntity.set(entityUri, list);
    }
    list.push({ sectionId: agg.sectionId, ann: rec });
  }
  for (const p of passageById.values()) {
    p.annotations.sort((a, b) => a.order - b.order);
  }

  // ---- ref -> passage resolution ----------------------------------------
  const refToPassages = new Map<string, PassageRec[]>();
  for (const p of passagesOrdered) {
    const key = `${p.book}.${p.section}`;
    let list = refToPassages.get(key);
    if (!list) {
      list = [];
      refToPassages.set(key, list);
    }
    list.push(p);
  }
  const refsFromCitation = (cit: string): string[] =>
    [...cit.matchAll(/(\d+)\.(\d+[a-z]?)/g)].map((m) => `${m[1]}.${m[2]}`);
  const resolveRef = (
    citation: string,
    subjectUri?: string,
    objectUri?: string,
  ): { ref: string; sectionId?: string } => {
    const refs = refsFromCitation(citation);
    const ref = refs[0] ?? citation.trim();
    // Pass 1: a candidate section inside the subject's own Life.
    for (const r of refs) {
      const c = refToPassages.get(r);
      const hit = c?.find((p) => p.lifeOfUri && p.lifeOfUri === subjectUri);
      if (hit) return { ref: r, sectionId: hit.id };
    }
    // Pass 2: the object's Life (e.g. a teacher cited in the pupil's Life).
    for (const r of refs) {
      const c = refToPassages.get(r);
      const hit = c?.find((p) => p.lifeOfUri && p.lifeOfUri === objectUri);
      if (hit) return { ref: r, sectionId: hit.id };
    }
    // Pass 3: unambiguous or first candidate in reading order.
    for (const r of refs) {
      const c = refToPassages.get(r);
      if (c && c.length > 0) return { ref: r, sectionId: c[0]?.id };
    }
    return { ref };
  };

  // ---- shared optional-property maps (claims + reified statements) -------
  const accordingToMap = new Map<string, LinkOutRec[]>();
  for (const r of q(`SELECT ?x ?src WHERE { ?x lo:accordingTo ?src }`)) {
    const x = r.get("x");
    const src = r.get("src");
    if (!x || !src) continue;
    const key = termKey(x);
    let list = accordingToMap.get(key);
    if (!list) {
      list = [];
      accordingToMap.set(key, list);
    }
    list.push({ uri: src.value, label: labelMap.get(src.value) });
  }
  const workMap = new Map<string, LinkOutRec>();
  for (const r of q(`SELECT ?x ?w WHERE { ?x lo:assertedInWork ?w }`)) {
    const x = r.get("x");
    const w = r.get("w");
    if (!x || !w) continue;
    workMap.set(termKey(x), { uri: w.value, label: labelMap.get(w.value) });
  }
  const chainMap = new Map<string, ChainLinkRec[]>();
  for (const r of q(
    `SELECT ?x ?link ?auth WHERE {
      ?x lo:transmissionChain ?link .
      ?link lo:chainAuthority ?auth .
    }`,
  )) {
    const x = r.get("x");
    const link = r.get("link");
    const auth = r.get("auth");
    if (!x || !link || !auth) continue;
    const key = termKey(x);
    let list = chainMap.get(key);
    if (!list) {
      list = [];
      chainMap.set(key, list);
    }
    const m = link.value.match(/(\d+)(?!.*\d)/);
    list.push({
      authorityUri: auth.value,
      authorityLabel: displayLabel(auth.value),
      order: m ? Number(m[1]) + 1 : list.length + 1,
    });
  }
  for (const list of chainMap.values()) list.sort((a, b) => a.order - b.order);
  const conflictsMap = new Map<string, string[]>();
  for (const r of q(`SELECT ?x ?o WHERE { ?x lo:conflictsWith ?o }`)) {
    const x = r.get("x");
    const o = r.get("o");
    if (!x || !o) continue;
    const key = termKey(x);
    let list = conflictsMap.get(key);
    if (!list) {
      list = [];
      conflictsMap.set(key, list);
    }
    list.push(o.value);
  }
  const grcMap = new Map<string, string>();
  for (const r of q(
    `SELECT ?x ?g WHERE { ?x a lo:Claim ; lo:greekText ?g }`,
  )) {
    const x = r.get("x");
    const g = r.get("g");
    if (x && g) grcMap.set(termKey(x), g.value);
  }
  const noteMap = new Map<string, string>();
  for (const r of q(
    `SELECT ?x ?n WHERE { ?x rdf:subject ?any . ?x rdfs:comment ?n }`,
  )) {
    const x = r.get("x");
    const n = r.get("n");
    if (x && n) noteMap.set(termKey(x), n.value);
  }

  // ---- claims -------------------------------------------------------------
  const claims: AssertionRec[] = [];
  for (const r of q(
    `SELECT ?c ?subj ?pred ?obj ?cert ?cit WHERE {
      ?c a lo:Claim ;
         rdf:subject ?subj ;
         rdf:predicate ?pred ;
         rdf:object ?obj ;
         lo:certainty ?cert ;
         dcterms:bibliographicCitation ?cit .
    }`,
  )) {
    const c = r.get("c");
    const subj = r.get("subj");
    const pred = r.get("pred");
    const obj = r.get("obj");
    if (!c || !subj || !pred || !obj) continue;
    const key = termKey(c);
    const citation = r.get("cit")?.value ?? "";
    const isLiteral = obj.termType === "Literal";
    const { ref, sectionId } = resolveRef(
      citation,
      subj.value,
      isLiteral ? undefined : obj.value,
    );
    claims.push({
      uri: c.value,
      kind: "claim",
      subjectUri: subj.value,
      subjectLabel: displayLabel(subj.value),
      predicateUri: pred.value,
      predicateLabel: predicateLabel(pred.value),
      objectUri: isLiteral ? undefined : obj.value,
      objectLabel: isLiteral ? undefined : displayLabel(obj.value),
      objectValue: isLiteral ? obj.value : undefined,
      objectLang: isLiteral ? obj.language || undefined : undefined,
      certainty: localName(r.get("cert")?.value ?? "").toLowerCase(),
      accordingTo: accordingToMap.get(key) ?? [],
      assertedInWork: workMap.get(key),
      chain: chainMap.get(key) ?? [],
      conflictsWith: (conflictsMap.get(key) ?? []).map((uri) => ({ uri })),
      citation,
      ref,
      sectionId,
      grc: grcMap.get(key),
      note: noteMap.get(key),
    });
  }
  claims.sort((a, b) => a.uri.localeCompare(b.uri));

  // ---- reified relation statements ---------------------------------------
  const statements: AssertionRec[] = [];
  for (const r of q(
    `SELECT ?st ?subj ?pred ?obj ?cit WHERE {
      ?st a rdf:Statement ;
          rdf:subject ?subj ;
          rdf:predicate ?pred ;
          rdf:object ?obj ;
          dcterms:bibliographicCitation ?cit .
    }`,
  )) {
    const st = r.get("st");
    const subj = r.get("subj");
    const pred = r.get("pred");
    const obj = r.get("obj");
    if (!st || !subj || !pred || !obj) continue;
    const key = termKey(st);
    const citation = r.get("cit")?.value ?? "";
    const isLiteral = obj.termType === "Literal";
    const digest = createHash("sha1")
      .update(`${subj.value}|${pred.value}|${obj.value}|${citation}`)
      .digest("hex")
      .slice(0, 16);
    // Direct triple present => Diogenes asserts the relation in his own
    // voice; reification-only => it is a report he transmits.
    const asserted =
      !isLiteral &&
      (store.query(
        `ASK { <${subj.value}> <${pred.value}> <${obj.value}> }`,
      ) as boolean);
    const { ref, sectionId } = resolveRef(
      citation,
      subj.value,
      isLiteral ? undefined : obj.value,
    );
    statements.push({
      uri: `urn:legomena:statement:${digest}`,
      kind: "relation",
      subjectUri: subj.value,
      subjectLabel: displayLabel(subj.value),
      predicateUri: pred.value,
      predicateLabel: predicateLabel(pred.value),
      objectUri: isLiteral ? undefined : obj.value,
      objectLabel: isLiteral ? undefined : displayLabel(obj.value),
      objectValue: isLiteral ? obj.value : undefined,
      objectLang: isLiteral ? obj.language || undefined : undefined,
      certainty: asserted ? "asserted" : "reported",
      accordingTo: accordingToMap.get(key) ?? [],
      assertedInWork: workMap.get(key),
      chain: chainMap.get(key) ?? [],
      conflictsWith: (conflictsMap.get(key) ?? []).map((uri) => ({ uri })),
      citation,
      ref,
      sectionId,
      note: noteMap.get(key),
    });
  }
  statements.sort(
    (a, b) =>
      a.subjectLabel.localeCompare(b.subjectLabel) ||
      a.predicateUri.localeCompare(b.predicateUri) ||
      (a.objectLabel ?? "").localeCompare(b.objectLabel ?? ""),
  );

  // Conflict summaries need every claim parsed first.
  const assertionByUri = new Map<string, AssertionRec>();
  for (const a of [...claims, ...statements]) assertionByUri.set(a.uri, a);
  for (const a of [...claims, ...statements]) {
    for (const cf of a.conflictsWith) {
      const other = assertionByUri.get(cf.uri);
      if (other) {
        cf.summary = `${other.subjectLabel} ${other.predicateLabel} ${
          other.objectLabel ?? other.objectValue ?? ""
        } (${other.certainty}, ${other.citation})`.trim();
      }
    }
  }

  const assertionsBySubject = new Map<string, AssertionRec[]>();
  const assertionsByObject = new Map<string, AssertionRec[]>();
  const assertionsBySection = new Map<string, AssertionRec[]>();
  for (const a of [...claims, ...statements]) {
    let s = assertionsBySubject.get(a.subjectUri);
    if (!s) {
      s = [];
      assertionsBySubject.set(a.subjectUri, s);
    }
    s.push(a);
    if (a.objectUri) {
      let o = assertionsByObject.get(a.objectUri);
      if (!o) {
        o = [];
        assertionsByObject.set(a.objectUri, o);
      }
      o.push(a);
    }
    if (a.sectionId) {
      let sec = assertionsBySection.get(a.sectionId);
      if (!sec) {
        sec = [];
        assertionsBySection.set(a.sectionId, sec);
      }
      sec.push(a);
    }
  }

  // ---- proper names, external links, chapters ----------------------------
  const properNamesMap = new Map<string, ProperNameRec[]>();
  for (const r of q(
    `SELECT ?e ?n ?form ?lang WHERE {
      ?e otv:denotedByProperName ?n .
      ?n otv:properName ?form .
      OPTIONAL { ?n otv:language ?lang }
    }`,
  )) {
    const e = r.get("e");
    const n = r.get("n");
    const form = r.get("form");
    if (!e || !n || !form) continue;
    let list = properNamesMap.get(e.value);
    if (!list) {
      list = [];
      properNamesMap.set(e.value, list);
    }
    const lang = r.get("lang")?.value ?? form.language ?? "";
    if (!list.some((p) => p.uri === n.value && p.form === form.value)) {
      list.push({ uri: n.value, form: form.value, lang });
    }
  }
  const sameAsMap = new Map<string, LinkOutRec[]>();
  for (const r of q(`SELECT ?s ?o WHERE { ?s owl:sameAs ?o }`)) {
    const s = r.get("s");
    const o = r.get("o");
    if (!s || !o) continue;
    let list = sameAsMap.get(s.value);
    if (!list) {
      list = [];
      sameAsMap.set(s.value, list);
    }
    list.push({ uri: o.value });
  }
  const seeAlsoMap = new Map<string, LinkOutRec[]>();
  for (const r of q(`SELECT ?s ?o WHERE { ?s rdfs:seeAlso ?o }`)) {
    const s = r.get("s");
    const o = r.get("o");
    if (!s || !o) continue;
    let list = seeAlsoMap.get(s.value);
    if (!list) {
      list = [];
      seeAlsoMap.set(s.value, list);
    }
    list.push({ uri: o.value });
  }
  const chapterOf = new Map<string, { book: number; chapter: string }>();
  for (const r of q(
    `SELECT ?phil ?book ?num WHERE {
      ?ch a lo:Chapter ;
          lo:hasMainSubject ?phil ;
          lo:inBook ?book ;
          lo:chapterNumber ?num .
    }`,
  )) {
    const phil = r.get("phil");
    if (!phil) continue;
    chapterOf.set(phil.value, {
      book: Number(r.get("book")?.value ?? 0) || 0,
      chapter: r.get("num")?.value ?? "",
    });
  }
  const schoolMap = new Map<string, string>();
  for (const r of q(`SELECT ?s ?school WHERE { ?s lo:memberOf ?school }`)) {
    const s = r.get("s");
    const school = r.get("school");
    if (!s || !school) continue;
    if (!schoolMap.has(s.value)) schoolMap.set(s.value, school.value);
  }
  const foundedMap = new Map<string, string>();
  for (const r of q(`SELECT ?s ?school WHERE { ?s lo:foundedSchool ?school }`)) {
    const s = r.get("s");
    const school = r.get("school");
    if (s && school && !foundedMap.has(s.value))
      foundedMap.set(s.value, school.value);
  }

  // ---- entity catalogue ---------------------------------------------------
  const kindOf = (uri: string): { kind: string; kinds: string[] } | null => {
    const types = typesMap.get(uri);
    if (!types) return null;
    const has = (local: string): boolean => types.has(`${LO}${local}`);
    const kinds = [...types]
      .filter((t) => t.startsWith(LO) || t === `${FOAF}Person`)
      .map((t) => localName(t));
    if (has("Philosopher")) return { kind: "philosopher", kinds };
    if (has("Sage")) return { kind: "sage", kinds };
    if (has("School")) return { kind: "school", kinds };
    if (
      [
        "Place",
        "City",
        "Island",
        "Region",
        "Deme",
        "Landmark",
        "NaturalFeature",
      ].some(has)
    )
      return { kind: "place", kinds };
    if (has("Work")) return { kind: "work", kinds };
    if (has("Source")) return { kind: "source", kinds };
    if (has("Doctrine")) return { kind: "doctrine", kinds };
    if (has("Term") || has("GreekTerm")) return { kind: "term", kinds };
    if (types.has(`${FOAF}Person`)) return { kind: "person", kinds };
    return null;
  };
  const KIND_PRIORITY: Record<string, number> = {
    philosopher: 0,
    sage: 1,
    school: 2,
    person: 3,
    place: 4,
    work: 5,
    source: 6,
    doctrine: 7,
    term: 8,
  };
  const entities: EntityRec[] = [];
  const entityByUri = new Map<string, EntityRec>();
  for (const [uri, ,] of [...typesMap.entries()]) {
    if (uri.startsWith("_:")) continue;
    const k = kindOf(uri);
    if (!k) continue;
    const label = labelMap.get(uri);
    if (!label) continue;
    const properNames = properNamesMap.get(uri) ?? [];
    const grc = properNames.find((p) => p.lang === "grc");
    const schoolUri = schoolMap.get(uri);
    const founded = foundedMap.get(uri);
    const ch = chapterOf.get(uri);
    const claimCount =
      (assertionsBySubject.get(uri)?.length ?? 0) +
      (assertionsByObject.get(uri)?.length ?? 0);
    const annotationCount = annotationsByEntity.get(uri)?.length ?? 0;
    const rec: EntityRec = {
      uri,
      label,
      kind: k.kind,
      kinds: k.kinds.sort(),
      grcName: grc?.form,
      properNames,
      sameAs: sameAsMap.get(uri) ?? [],
      seeAlso: seeAlsoMap.get(uri) ?? [],
      schoolUri,
      schoolLabel: schoolUri ? labelMap.get(schoolUri) : undefined,
      founderOf: founded ? (labelMap.get(founded) ?? localName(founded)) : undefined,
      book: ch?.book,
      chapter: ch?.chapter,
      claimCount,
      annotationCount,
    };
    entities.push(rec);
    entityByUri.set(uri, rec);
  }
  entities.sort(
    (a, b) =>
      (KIND_PRIORITY[a.kind] ?? 9) - (KIND_PRIORITY[b.kind] ?? 9) ||
      b.claimCount + b.annotationCount - (a.claimCount + a.annotationCount) ||
      a.label.localeCompare(b.label),
  );

  model = {
    labelOf,
    displayLabel,
    predicateLabel,
    typesOf,
    passagesOrdered,
    passageById,
    claims,
    statements,
    assertionByUri,
    assertionsBySubject,
    assertionsByObject,
    assertionsBySection,
    entities,
    entityByUri,
    annotationsByEntity,
    chapterOf,
    statementAccordingTo: accordingToMap,
    resolveRef,
  };
  logger.info(
    {
      ms: Math.round(performance.now() - t0),
      passages: passagesOrdered.length,
      annotations: [...annotationsByEntity.values()].reduce(
        (n, l) => n + l.length,
        0,
      ),
      claims: claims.length,
      statements: statements.length,
      entities: entities.length,
    },
    "SPARQL-derived model built",
  );
  return model;
}
