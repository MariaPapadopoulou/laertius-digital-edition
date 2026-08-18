/**
 * Detailed statistics endpoint: per-book coverage, knowledge-layer
 * distributions, work-ontology facets, tagging figures, map coverage, and
 * Linked Open Data counts.
 *
 * Design notes:
 *   - Works facets and every LOD figure are counted from the annotated
 *     graph quads (annotatedGraphQuads, cached) rather than re-deriving
 *     them from the curation tables, so the numbers can never drift from
 *     the published LOD exports (century resolution in particular lives in
 *     lod.ts and is deliberately not duplicated here).
 *   - The triple count is deduped by (subject, predicate, object)
 *     signature, matching how validate-lod and the RDF/XML serializer
 *     count, so the page shows the same figure the exports report.
 *   - The full response is computed once and cached for the process
 *     lifetime - every underlying layer is immutable after load.
 */
import { Router, type IRouter } from "express";
import { GetDetailedStatsResponse } from "@workspace/api-zod";
import type { Quad } from "n3";
import { corpus, philosophers } from "../lib/corpus";
import { KG_CLAIMS } from "../lib/kg-claims";
import { verses } from "../lib/verses";
import { getSayings } from "../lib/sayings";
import { getAnecdotes } from "../lib/anecdotes";
import { getEpistles } from "../lib/epistles";
import { getTestaments } from "../lib/testaments";
import { getDoxai } from "../lib/doxai";
import { getEntitySummaries } from "../lib/annotate";
import { getSourcesIndex } from "../lib/sources-index";
import { getMapPlaces, getItineraries } from "../lib/map";
import { annotatedGraphQuads, ONT, OTV } from "../lib/lod";
import {
  WORK_FORM_INDIVIDUAL,
  WORK_SURVIVAL_INDIVIDUAL,
  WORK_TOPIC_INDIVIDUAL,
} from "../lib/work-ontology";

const router: IRouter = Router();

/** Conventional descriptions of each book's contents (Hicks). */
const BOOK_LABELS: Record<number, string> = {
  1: "Prologue & the Seven Sages",
  2: "Ionians & Socratics",
  3: "Plato",
  4: "The Academy",
  5: "Aristotle & the Peripatetics",
  6: "The Cynics",
  7: "The Stoics",
  8: "Pythagoras & the Italian School",
  9: "Heraclitus, Eleatics & Sceptics",
  10: "Epicurus",
};

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const OA_ANNOTATION = "http://www.w3.org/ns/oa#Annotation";

/** Reverse the individual-name tables so graph URIs map back to facet keys. */
const invert = (rec: Record<string, string>): Map<string, string> =>
  new Map(Object.entries(rec).map(([key, individual]) => [individual, key]));
const FORM_BY_INDIVIDUAL = invert(WORK_FORM_INDIVIDUAL);
const SURVIVAL_BY_INDIVIDUAL = invert(WORK_SURVIVAL_INDIVIDUAL);
const TOPIC_BY_INDIVIDUAL = invert(WORK_TOPIC_INDIVIDUAL);

/** Core ontology classes surfaced in the nodes-by-class breakdown. */
const NODE_CLASSES: [string, string][] = [
  ["Philosophers & sages", `${ONT}ChapterSubject`],
  ["Schools", `${ONT}School`],
  ["Places", `${ONT}Place`],
  ["Works", `${ONT}Work`],
  ["Cited sources", `${ONT}Source`],
  ["Doctrines", `${ONT}Doctrine`],
  ["Claims", `${ONT}Claim`],
  ["Verses", `${ONT}Verse`],
  ["Sayings", `${ONT}Saying`],
  ["Anecdotes", `${ONT}Anecdote`],
  ["Epistles", `${ONT}Epistle`],
  ["Testaments", `${ONT}Testament`],
  ["Passages", `${ONT}Passage`],
];

function bookOfRef(ref: string): number {
  return parseInt(ref, 10);
}

function toCounts(
  m: Map<string, number>,
  order?: "desc" | "insertion",
): { name: string; count: number }[] {
  const entries = [...m.entries()].map(([name, count]) => ({ name, count }));
  if (order === "desc") entries.sort((a, b) => b.count - a.count);
  return entries;
}

function tally<T>(items: T[], key: (item: T) => string | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k === undefined) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/** Literal value of a quad's object when it is a literal, else undefined. */
function literalValue(q: Quad): string | undefined {
  return q.object.termType === "Literal" ? q.object.value : undefined;
}

function buildLodAndWorks() {
  const quads = annotatedGraphQuads();

  // Deduped triple count, same signature idea as validate-lod / RDF/XML.
  const sigs = new Set<string>();
  for (const q of quads) {
    const o = q.object;
    const oSig =
      o.termType === "Literal"
        ? `L${o.language}\u0001${o.datatype?.value ?? ""}\u0001${o.value}`
        : `${o.termType[0]}${o.value}`;
    sigs.add(
      `${q.subject.termType[0]}${q.subject.value}\u0000${q.predicate.value}\u0000${oSig}`,
    );
  }

  // Type census over named subjects (blank-node annotation bodies excluded
  // from the class table but oa:Annotation nodes are counted separately).
  const typeCount = new Map<string, number>();
  const workUris = new Set<string>();
  for (const q of quads) {
    if (q.predicate.value !== RDF_TYPE) continue;
    const t = q.object.value;
    typeCount.set(t, (typeCount.get(t) ?? 0) + 1);
    if (t === `${ONT}Work` && q.subject.termType === "NamedNode") {
      workUris.add(q.subject.value);
    }
  }

  // Work facets straight from the emitted triples (parity with exports).
  const survival = new Map<string, number>();
  const form = new Map<string, number>();
  const topic = new Map<string, number>();
  const century = new Map<number, number>();
  let philosophical = 0;
  const localName = (uri: string): string => uri.slice(ONT.length);
  for (const q of quads) {
    if (q.subject.termType !== "NamedNode" || !workUris.has(q.subject.value)) {
      continue;
    }
    switch (q.predicate.value) {
      case `${ONT}survival`: {
        const s =
          SURVIVAL_BY_INDIVIDUAL.get(localName(q.object.value)) ??
          localName(q.object.value);
        survival.set(s, (survival.get(s) ?? 0) + 1);
        break;
      }
      case `${ONT}hasForm`: {
        const f =
          FORM_BY_INDIVIDUAL.get(localName(q.object.value)) ??
          localName(q.object.value);
        form.set(f, (form.get(f) ?? 0) + 1);
        break;
      }
      case `${ONT}hasWorkTopic`: {
        const t =
          TOPIC_BY_INDIVIDUAL.get(localName(q.object.value)) ??
          localName(q.object.value);
        topic.set(t, (topic.get(t) ?? 0) + 1);
        break;
      }
      case `${ONT}philosophical`: {
        if (literalValue(q) === "true") philosophical += 1;
        break;
      }
      case `${ONT}compositionCentury`: {
        const c = Number(literalValue(q));
        if (Number.isFinite(c)) century.set(c, (century.get(c) ?? 0) + 1);
        break;
      }
    }
  }

  const totalWorks = workUris.size;
  const datedWorks = [...century.values()].reduce((a, b) => a + b, 0);
  const knownSurvival = [...survival.values()].reduce((a, b) => a + b, 0);
  if (totalWorks - knownSurvival > 0) {
    survival.set("unasserted", totalWorks - knownSurvival);
  }

  return {
    works: {
      total: totalWorks,
      philosophical,
      bySurvival: toCounts(survival, "desc"),
      byForm: toCounts(form, "desc"),
      byTopic: toCounts(topic, "desc"),
      byCentury: [...century.entries()]
        .map(([c, count]) => ({ century: c, count }))
        .sort((a, b) => a.century - b.century),
      unknownCentury: totalWorks - datedWorks,
    },
    lod: {
      triples: sigs.size,
      nodesByClass: NODE_CLASSES.map(([name, uri]) => ({
        name,
        count: typeCount.get(uri) ?? 0,
      })).filter((c) => c.count > 0),
      annotationBodies: typeCount.get(OA_ANNOTATION) ?? 0,
      properNames: typeCount.get(`${OTV}ProperName`) ?? 0,
      terms: typeCount.get(`${OTV}Term`) ?? 0,
      concepts: typeCount.get(`${OTV}Concept`) ?? 0,
    },
  };
}

/**
 * The exact (pre-Zod) stats payload /stats/detailed serves, exported so
 * validate-page-contracts can compare the inline byKind/topEntities/
 * byCentury rows of the OpenAPI DetailedStats schema against the served
 * shape before response validation strips undeclared keys.
 */
export function computeStats(): unknown {
  const sayings = getSayings();
  const anecdotes = getAnecdotes();
  const epistles = getEpistles();
  const entities = getEntitySummaries();
  const sourcesIndex = getSourcesIndex();
  const places = getMapPlaces();

  // Per-book coverage.
  const books = [...new Set(corpus.map((s) => s.book))].sort((a, b) => a - b);
  const claimsByBook = tally(KG_CLAIMS, (c) => String(bookOfRef(c.ref)));
  const versesByBook = tally(verses, (v) => String(v.book));
  const sayingsByBook = tally(sayings, (s) => String(bookOfRef(s.ref)));
  const anecdotesByBook = tally(anecdotes, (a) => String(bookOfRef(a.ref)));
  // Book membership comes from the ref's book part alone, so the two
  // owner-ambiguous Hicks refs (7.160, 7.166) tally identically either way.
  const doxaiByBook = tally(getDoxai(), (d) => String(bookOfRef(d.ref)));
  const bookStats = books.map((book) => ({
    book,
    label: BOOK_LABELS[book] ?? `Book ${book}`,
    sections: corpus.filter((s) => s.book === book).length,
    lives: philosophers.filter((p) => p.book === book).length,
    claims: claimsByBook.get(String(book)) ?? 0,
    verses: versesByBook.get(String(book)) ?? 0,
    sayings: sayingsByBook.get(String(book)) ?? 0,
    doxai: doxaiByBook.get(String(book)) ?? 0,
    anecdotes: anecdotesByBook.get(String(book)) ?? 0,
  }));

  // Claims: certainty in the model's canonical order, properties by weight.
  const certaintyOrder = ["asserted", "reported", "disputed", "conjectured"];
  const byCertainty = tally(KG_CLAIMS, (c) => c.certainty);
  // Count distinct unordered pairs rather than links/2, so an asymmetric
  // conflictsWith entry (mutuality is not enforced by validation) cannot
  // silently skew the figure.
  const conflictPairs = new Set<string>();
  for (const c of KG_CLAIMS) {
    for (const other of c.conflictsWith ?? []) {
      conflictPairs.add([c.id, other].sort().join("\u0000"));
    }
  }

  // Sayings / anecdotes topic + protagonist distributions.
  const TOP_N = 10;
  const sayingSpeakers = tally(sayings, (s) => s.philosopher);
  const anecdoteProtagonists = tally(anecdotes, (a) => a.philosopher);

  // Tagging layer.
  const kindStats = new Map<string, { entities: number; occurrences: number }>();
  for (const e of entities) {
    const k = kindStats.get(e.kind) ?? { entities: 0, occurrences: 0 };
    k.entities += 1;
    k.occurrences += e.occurrences;
    kindStats.set(e.kind, k);
  }
  const topEntities = [...entities]
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 12)
    .map((e) => ({
      uri: e.entityUri,
      label: e.label,
      kind: e.kind,
      occurrences: e.occurrences,
      sections: e.sectionCount,
    }));

  // Map coverage: distinct sections with a mapped-place mention.
  const mentionSections = new Set<string>();
  let events = 0;
  for (const p of places) {
    events += p.events.length;
    for (const m of p.mentions) mentionSections.add(m.sectionId);
  }

  const { works, lod } = buildLodAndWorks();

  return {
    books: bookStats,
    claims: {
      total: KG_CLAIMS.length,
      byCertainty: certaintyOrder
        .map((name) => ({ name, count: byCertainty.get(name) ?? 0 }))
        .filter((c) => c.count > 0),
      byProperty: toCounts(tally(KG_CLAIMS, (c) => c.property), "desc"),
      withGreekExcerpt: KG_CLAIMS.filter((c) => c.grc).length,
      conflictPairs: conflictPairs.size,
    },
    verses: {
      total: verses.length,
      attributed: verses.filter((v) => v.author).length,
      poets: new Set(verses.map((v) => v.author).filter(Boolean)).size,
      epigrams: verses.filter((v) => v.genre === "epigram").length,
    },
    sayings: {
      total: sayings.length,
      speakers: sayingSpeakers.size,
      byTopic: toCounts(tally(sayings, (s) => s.topic), "desc"),
      topSpeakers: toCounts(sayingSpeakers, "desc").slice(0, TOP_N),
    },
    anecdotes: {
      total: anecdotes.length,
      protagonists: anecdoteProtagonists.size,
      byTopic: toCounts(tally(anecdotes, (a) => a.topic), "desc"),
      topProtagonists: toCounts(anecdoteProtagonists, "desc").slice(0, TOP_N),
    },
    epistles: {
      total: epistles.length,
      byAuthenticity: toCounts(tally(epistles, (e) => e.authenticity), "desc"),
    },
    testaments: { total: getTestaments().length },
    entities: {
      total: entities.length,
      annotations: entities.reduce((n, e) => n + e.occurrences, 0),
      byKind: [...kindStats.entries()]
        .map(([kind, k]) => ({ kind, ...k }))
        .sort((a, b) => b.occurrences - a.occurrences),
      topEntities,
    },
    works,
    places: {
      total: places.length,
      events,
      mentionSections: mentionSections.size,
      itineraries: getItineraries().length,
    },
    sources: {
      citations: sourcesIndex.rows.length,
      authorities: sourcesIndex.groups.length,
    },
    lod,
  };
}

let cache: unknown | null = null;

router.get("/stats/detailed", (_req, res) => {
  if (!cache) cache = GetDetailedStatsResponse.parse(computeStats());
  res.json(cache);
});

export default router;
