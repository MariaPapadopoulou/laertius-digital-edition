import { Router, type IRouter } from "express";
// Pull in pino-http's Express Request augmentation (req.log) explicitly:
// this file is also compiled inside the scripts package's tsc program
// (via validate-competency-cache-invalidation.ts), where nothing else
// imports pino-http, so without this the augmentation is missing there.
import type {} from "pino-http";
import {
  ListCompetencyQuestionsResponse,
  GetCompetencyQuestionResponse,
} from "@workspace/api-zod";
import { getKnowledgeGraph } from "../lib/kg";
import { MOVEMENTS } from "../lib/kg";
import { LOD_BASE } from "../lib/lod";
import {
  getCompetencyQuestions,
  findCompetencyQuestion,
  getDroppedSeeds,
  COMPETENCY_QUESTIONS,
} from "../lib/competency";
import { getStore } from "./sparql";
import {
  greekNameSpec,
  greekWorkTitleSpec,
  greekSchoolGrc,
} from "../lib/greek-names";
import { sectionById } from "../lib/corpus";
import { getIndexEntries, sectionsForEntity } from "../lib/annotate";
import { PLACE_TYPES } from "../lib/place-ontology";
import { WORK_FACETS } from "../lib/work-ontology";

const router: IRouter = Router();

const ONT = `${LOD_BASE}/ontology#`;

// Pre-built label sets for entity classification
const PLACE_NAMES = new Set(Object.keys(PLACE_TYPES));
const WORK_TITLES = new Set(Object.keys(WORK_FACETS));

interface SparqlResultsJson {
  head?: { vars?: string[] };
  results?: {
    bindings?: Array<Record<string, { type: string; value: string; "xml:lang"?: string }>>;
  };
}

const SNIP = 220;

// A SPARQL row value that is a resource URI (e.g. a lo:principalDoctrine
// object) must never ship as a term's en label — Zone C renders en labels
// as clickable chips. Resolve the resource's English rdfs:label instead.
const URI_SHAPED = /^https?:\/\//i;

// A SPARQL row value written in Greek script (e.g. the shared ?form
// literal of the homonymy question) is a raw proper-name form, not an
// entity in its own right: the philosopher chips already carry their
// Greek forms next to the English name, so shipping the form again as
// a separate chip only duplicates them. Doctrine labels are English by
// the questions' FILTER(lang = "en") clauses, so a Greek-script value
// can never be a legitimate doctrine chip.
const GREEK_SCRIPT = /[\u0370-\u03FF\u1F00-\u1FFF]/;

function labelForResource(
  store: ReturnType<typeof getStore>,
  uri: string,
): string | undefined {
  const rawJson = String(
    store.query(
      `SELECT ?l WHERE { <${uri}> <http://www.w3.org/2000/01/rdf-schema#label> ?l }`,
      { results_format: "json" },
    ),
  );
  const parsed: SparqlResultsJson = JSON.parse(rawJson);
  const bindings = parsed.results?.bindings ?? [];
  const en = bindings.find((b) => b["l"]?.["xml:lang"] === "en") ?? bindings[0];
  return en?.["l"]?.value || undefined;
}

// Is this English label borne by a person-typed resource in the LOD
// graph (lo:Person, lo:Philosopher, lo:Sage, or a lo:Source authority,
// which names a person)? Used by the extra-terms classifier so a person
// name with no curated Greek form (e.g. the deliberately formless
// claim-source "Antigonus") still buckets as a person term instead of a
// bogus doctrine chip.
function isPersonLabel(
  store: ReturnType<typeof getStore>,
  label: string,
): boolean {
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

// The chip categories the extra-terms classifier can assign.
export type ExtraTermType = "school" | "place" | "work" | "person" | "doctrine";

const MOVEMENT_LABELS = new Set(MOVEMENTS.map((m) => m.label));

// Classifies one non-philosopher SPARQL row value into its Entities-card
// chip category. Returns null when the value never ships as a chip (an
// unresolvable/URI-shaped label, or a Greek-script proper-name form).
// This is the single classification path shared by the route below and
// by scripts/src/validate-competency-counts.ts, which pins each pinned
// answer value's term type so a curation change (a name added to
// PLACE_TYPES, a person losing its LOD typing, ...) cannot silently
// rebucket a chip while every other pin stays green.
export function classifyExtraTerm(
  store: ReturnType<typeof getStore>,
  rawVal: string,
  personHints?: readonly string[],
): { label: string; type: ExtraTermType } | null {
  let val = rawVal;
  if (URI_SHAPED.test(val)) {
    // Resource URI (e.g. a doctrine node): resolve its display label
    // from the LOD store; a resource with no label is skipped rather
    // than shipped as a raw web address chip
    const label = labelForResource(store, val);
    if (!label || URI_SHAPED.test(label)) return null;
    val = label;
  }
  if (GREEK_SCRIPT.test(val)) return null;
  if (
    personHints?.includes(val) &&
    (greekNameSpec(val) || isPersonLabel(store, val))
  ) {
    // Per-question person-sense hint (CompetencyQuestion.personTermHints):
    // in this question's rows the value denotes a person even though its
    // name collides with an earlier lookup table (the city Croton, the
    // dialogue title Telauges), so the person sense wins here. The hint
    // only applies when the label still verifies as a person (curated
    // Greek name or LOD person typing) — a stale hint cannot mint a
    // bogus person chip.
    return { label: val, type: "person" };
  }
  if (MOVEMENT_LABELS.has(val)) {
    // A school label bound by the query but not among the subgraph's
    // movements: ship it once as a school term, never a doctrine chip
    return { label: val, type: "school" };
  }
  if (PLACE_NAMES.has(val)) return { label: val, type: "place" };
  if (WORK_TITLES.has(val)) return { label: val, type: "work" };
  if (greekNameSpec(val) || isPersonLabel(store, val)) {
    // A person name that is not a KG node (homonym bearers, sources,
    // mentioned figures): ship it as a person term, never a doctrine
    // chip. greekNameSpec covers the curated names cheaply; the LOD ASK
    // catches person nodes whose name is deliberately formless.
    return { label: val, type: "person" };
  }
  // Doctrine or other term
  return { label: val, type: "doctrine" };
}

// First tagged corpus section for a person term, so its Entities-card
// chip can deep-link to a real passage naming THAT bearer instead of
// falling back to /graph?p=<name> (a dead end for non-KG homonym
// bearers). Resolution is kind-aware but still conservative: because
// the term IS a person, Index entries of non-person kinds (the city
// Croton, a work title) can never be the bearer, so they are dropped
// before disambiguating. Among the remaining person-kind entries the
// label must match exactly one (several homonym bearers can share a
// label; when the term's curated Greek form disambiguates among them,
// use it, otherwise ship no firstId rather than guess and send readers
// to the WRONG bearer's passage).
const PERSON_INDEX_KINDS = new Set(["philosopher", "person", "source"]);

export function firstSectionIdForPersonTerm(
  label: string,
  grc: string | undefined,
): string | undefined {
  const entries = getIndexEntries().filter(
    (e) => e.label === label && PERSON_INDEX_KINDS.has(e.kind),
  );
  let entry = entries.length === 1 ? entries[0] : undefined;
  if (!entry && entries.length > 1 && grc) {
    const byGrc = entries.filter((e) => e.grc === grc);
    if (byGrc.length === 1) entry = byGrc[0];
  }
  if (!entry) return undefined;
  return sectionsForEntity(entry.entityUri)?.[0];
}

function snippet(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  const t = text.trim();
  return t.length <= SNIP ? t : t.slice(0, SNIP).trimEnd() + "\u2026";
}

// Row counts per question, computed by running each question's SPARQL
// query against the shared oxigraph store and counting bindings, then
// cached so the catalogue endpoint costs no SPARQL round-trips on repeat
// hits.
//
// Invariant: the cache is keyed to the store *instance* it was computed
// against, not to the process. getStore() currently builds the store
// exactly once per process, but if it is ever rebuilt or hot-reloaded
// (returning a new Store object), the identity check below discards the
// stale counts and recomputes against the new graph, so the sidebar
// badges can never disagree with the results tables served from the
// fresh store. If getStore() ever gains an in-place mutation path
// (reloading triples into the SAME Store instance), this key is not
// enough: that path must also reset the cache (see resetRowCountCache).
let rowCountCache: Map<string, number> | null = null;
let rowCountCacheStore: ReturnType<typeof getStore> | null = null;

// Exposed for any future store-reload path (and for tests): drops the
// cached counts so the next catalogue request recomputes them.
export function resetRowCountCache(): void {
  rowCountCache = null;
  rowCountCacheStore = null;
}

// Exported for the cache-invalidation validator (scripts/src/
// validate-competency-cache-invalidation.ts), which proves a rebuilt
// store really triggers a recompute instead of serving stale counts.
export function getCompetencyRowCounts(): Map<string, number> {
  const store = getStore();
  if (rowCountCache && rowCountCacheStore === store) return rowCountCache;
  const counts = new Map<string, number>();
  for (const q of COMPETENCY_QUESTIONS) {
    const sparql = q.sparqlFn(LOD_BASE, ONT);
    const rawJson = String(store.query(sparql, { results_format: "json" }));
    const parsed: SparqlResultsJson = JSON.parse(rawJson);
    counts.set(q.id, parsed.results?.bindings?.length ?? 0);
  }
  rowCountCache = counts;
  rowCountCacheStore = store;
  return counts;
}

router.get("/competency/questions", (req, res) => {
  try {
    const counts = getCompetencyRowCounts();
    const questions = getCompetencyQuestions().map((q) => ({
      ...q,
      rowCount: counts.get(q.id) ?? 0,
    }));
    const data = ListCompetencyQuestionsResponse.parse({ questions });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to list competency questions");
    res.status(500).json({ error: "Failed to list competency questions" });
  }
});

/**
 * The exact (pre-Zod) answer payload /competency/questions/:id serves,
 * exported so validate-page-contracts can compare the served shape of the
 * inline terms/passages/droppedSeeds rows against the OpenAPI
 * CompetencyQuestionResult schema before response validation strips
 * undeclared keys.
 */
export function buildCompetencyAnswer(
  question: NonNullable<ReturnType<typeof findCompetencyQuestion>>,
) {
  const store = getStore();
  const sparql = question.sparqlFn(LOD_BASE, ONT);

    // SPARQL errors propagate to the outer catch (500) — do not swallow them
    const rawJson = String(store.query(sparql, { results_format: "json" }));
    const parsed: SparqlResultsJson = JSON.parse(rawJson);
    const variables: string[] = parsed.head?.vars ?? [];
    const bindings = parsed.results?.bindings ?? [];
    const rows: string[][] = bindings.map((b) =>
      variables.map((v) => b[v]?.value ?? ""),
    );

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

    const subNodeNames = new Set(subNodes.map((n) => n.name));

    const subEdges = graph.edges.filter(
      (e) => subNodeNames.has(e.from) && subNodeNames.has(e.to),
    );

    const movementIds = new Set(subNodes.map((n) => n.movement));
    // Attach the curated Greek school form (greek-names.ts) so the
    // subgraph legend can mirror the Entities card; "Unaffiliated" is
    // deliberately absent from the map and stays English-only.
    const subMovements = MOVEMENTS.filter((m) => movementIds.has(m.id)).map(
      (m) => {
        const grc = greekSchoolGrc(m.label);
        return grc ? { ...m, grc } : m;
      },
    );

    const sectionIds = subNodes
      .map((n) => n.firstId)
      .filter(Boolean);

    // Philosopher/sage terms from KG nodes
    const philosopherTerms = subNodes.map((n) => ({
      en: n.name,
      grc: greekNameSpec(n.name)?.grc,
      type: n.book === 1 ? ("sage" as const) : ("philosopher" as const),
      firstId: n.firstId,
    }));

    // School terms from movements; grc is the curated Greek school name
    // (D.L.'s own sect names from the prologue survey where attested),
    // absent for the Unaffiliated bucket which is not a school
    const schoolTerms = subMovements.map((m) => ({
      en: m.label,
      grc: greekSchoolGrc(m.label),
      type: "school" as const,
    }));

    // Classify SPARQL row values that are NOT philosopher nodes into
    // schools, places, works, persons, or doctrines — shown in the
    // bilingual terms panel. The classification itself lives in
    // classifyExtraTerm above (shared with the term-type validator).
    // Movement labels already shipped via schoolTerms seed the dedupe
    // set so a school never appears twice, and a movement label whose
    // movement is absent from the subgraph (e.g. Cyrenaic on
    // school-doctrines) still ships once, as a school term rather than a
    // bogus doctrine chip.
    const seenExtra = new Set<string>([
      ...subNodes.map((n) => n.name),
      ...subMovements.map((m) => m.label),
    ]);
    const extraTerms: Array<{
      en: string;
      grc?: string;
      type: "school" | "place" | "work" | "person" | "doctrine";
      firstId?: string;
    }> = [];

    for (const row of rows) {
      for (const val of row) {
        if (!val || seenExtra.has(val)) continue;
        seenExtra.add(val);
        const classified = classifyExtraTerm(store, val, question.personTermHints);
        if (!classified) continue;
        const { label, type } = classified;
        if (label !== val) {
          // The value was a resource URI resolved to its display label;
          // dedupe on the label too so the chip cannot ship twice
          if (seenExtra.has(label)) continue;
          seenExtra.add(label);
        }
        switch (type) {
          case "school":
            extraTerms.push({ en: label, grc: greekSchoolGrc(label), type });
            break;
          case "place":
            extraTerms.push({ en: label, grc: greekNameSpec(label)?.grc, type });
            break;
          case "person": {
            const grc = greekNameSpec(label)?.grc;
            const firstId = firstSectionIdForPersonTerm(label, grc);
            extraTerms.push({
              en: label,
              grc,
              type,
              ...(firstId ? { firstId } : {}),
            });
            break;
          }
          case "work":
            extraTerms.push({ en: label, grc: greekWorkTitleSpec(label)?.grc, type });
            break;
          case "doctrine":
            extraTerms.push({ en: label, type });
            break;
        }
      }
    }

    const terms = [...philosopherTerms, ...schoolTerms, ...extraTerms];

    // Reviewed exceptions: curated anchors without a Life chapter (no KG
    // node), dropped from the subgraph by design. Shipped so the panel can
    // surface the curation instead of silently showing fewer anchors than
    // curated. Single-sourced with the validator via KNOWN_DROPPED_SEEDS.
    const droppedSeeds = getDroppedSeeds(question.id).map((name) => ({
      en: name,
      grc: greekNameSpec(name)?.grc,
    }));

    // Bilingual passage snippets (up to 5 sections)
    const passages = sectionIds.slice(0, 5).map((sid) => {
      const sec = sectionById.get(sid);
      return {
        id: sid,
        en: snippet(sec?.textEn),
        grc: snippet(sec?.text),
      };
    });

  return {
    id: question.id,
    question: question.question,
    ...(question.greekTerm ? { greekTerm: question.greekTerm } : {}),
    category: question.category,
    variables,
    rows,
    nodes: subNodes,
    edges: subEdges,
    movements: subMovements,
    sectionIds,
    terms,
    passages,
    ...(droppedSeeds.length > 0 ? { droppedSeeds } : {}),
    sparql,
  };
}

router.get("/competency/questions/:id", (req, res) => {
  const { id } = req.params;

  const question = findCompetencyQuestion(id);
  if (!question) {
    res.status(404).json({ error: `Unknown competency question: ${id}` });
    return;
  }

  try {
    // SPARQL errors propagate to the outer catch (500) — do not swallow them
    const data = GetCompetencyQuestionResponse.parse(
      buildCompetencyAnswer(question),
    );
    res.json(data);
  } catch (err) {
    req.log.error({ err, id }, "Failed to run competency question");
    res.status(500).json({ error: "Failed to run competency question" });
  }
});

export default router;
