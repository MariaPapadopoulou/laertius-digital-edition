import { corpus, indexById, type CorpusSection } from "./corpus";
import { Bm25Index } from "./bm25";
import { denseIndexReady, denseRank } from "./dense";
import { embedQuery } from "./embedder";
import { detectPhilosophers, kgNeighbors, getKnowledgeGraph } from "./kg";
import { detectSchools } from "./schools";
import { sectionIdForRef } from "./claims-answer";
import { normalizeGreek } from "./greek";
import { logger } from "./logger";

const POOL = 50;

/** Tunable hybrid-fusion parameters (weighted RRF + knowledge-graph boost). */
export interface FusionParams {
  /** RRF rank constant: contribution is weight / (rrfK + rank + 1). */
  rrfK: number;
  /** Weight on the dense (embedding) ranking's RRF contribution. */
  denseWeight: number;
  /** Weight on the sparse (BM25) ranking's RRF contribution. */
  sparseWeight: number;
  /** Additive boost for passages by philosophers named in the query. */
  kgMatchedBoost: number;
  /** Additive boost for passages by KG neighbours of named philosophers. */
  kgRelatedBoost: number;
  /** Additive boost for passages of schools named in the query (defaults to kgMatchedBoost). */
  schoolBoost?: number;
}

/**
 * Default fusion parameters, tuned against gold v0.5
 * (see data/eval/gold/gold-eval-v0.5-fusion-tuning.md). Dense-leaning
 * weighted RRF keeps the answerable gains of the original equal-weight
 * fusion while no longer burying the abstention evidence (false-premise
 * contradicting passages, homonym rosters) that dense retrieval surfaces.
 */
export const DEFAULT_FUSION_PARAMS: FusionParams = {
  rrfK: 20,
  denseWeight: 1,
  sparseWeight: 0.3,
  kgMatchedBoost: 0.5 / 20,
  kgRelatedBoost: 0.15 / 20,
};

const bm25 = new Bm25Index(
  corpus.map((s) => (s.textEn ? `${s.text} ${s.textEn}` : s.text)),
);
logger.info({ sections: corpus.length }, "BM25 index built");

export interface RankedPassage extends CorpusSection {
  score: number;
  source: string;
}

export type RetrievalMode = "hybrid" | "sparse" | "dense";

export interface GraphContext {
  matched: string[];
  related: string[];
  /**
   * Section ids that assert a teacher/pupil/succession relation of a
   * matched philosopher (edge refs plus the diadochai lists in the
   * prologue). Populated only for relational queries ("students of X",
   * "who taught X"), where the answer lives outside X's own chapter.
   */
  relationSections?: string[];
}

/**
 * Diogenes Laertius' own succession lists (diadochai), 1.13-15 of the
 * prologue: the canonical source for "who succeeded whom" questions.
 */
const SUCCESSION_LIST_SECTIONS = ["1.prol.13", "1.prol.14", "1.prol.15"];

const RELATIONAL_CUES = [
  // Greek (normalized word-start stems). "δασκαλ" is word-start matched so
  // it does NOT fire on διδασκαλία (doctrine/teachings), which would drag
  // relation boosts into ordinary doctrine queries.
  "μαθητ",
  "δασκαλ",
  "διδαξ",
  "διδαχθηκ",
  "διαδοχ",
  "διαδεχ",
  // English
  "student",
  "pupil",
  "disciple",
  "teacher",
  "taught",
  "successor",
  "succession",
  "succeeded",
].map((w) => normalizeGreek(w));

/**
 * True when the query asks about teacher/pupil/succession relations.
 * Cues match at word starts only, to keep doctrine wording (διδασκαλία)
 * from triggering the relation boost.
 */
export function detectRelationalIntent(query: string): boolean {
  const words = normalizeGreek(query).match(/[\p{L}\p{N}_]+/gu) ?? [];
  return words.some((w) => RELATIONAL_CUES.some((cue) => w.startsWith(cue)));
}

/**
 * Sections asserting a relation of the given philosophers: the KG edge
 * refs (resolved into the counterpart's chapter, where D.L. states the
 * relation) plus the prologue succession lists.
 */
function relationSectionsFor(matched: string[]): string[] {
  const names = new Set(matched);
  const out = new Set<string>();
  let inChain = false;
  for (const e of getKnowledgeGraph().edges) {
    // Marriage edges are not teacher/pupil/succession relations.
    if (e.type === "spouseOf") continue;
    if (!names.has(e.from) && !names.has(e.to)) continue;
    inChain = true;
    if (!e.ref) continue;
    // By this KG's citation convention the ref lives in the pupil's
    // (edge target's) chapter, so resolve ambiguous book.section refs
    // against e.to - never a query-relative counterpart.
    const id = sectionIdForRef(e.ref, e.to);
    if (id) out.add(id);
  }
  // The prologue diadochai lists answer succession questions, but only
  // for philosophers who actually sit in a succession chain.
  if (inChain) {
    for (const id of SUCCESSION_LIST_SECTIONS) {
      if (indexById.has(id)) out.add(id);
    }
  }
  return [...out];
}

/**
 * Philosophers named in the query plus their knowledge-graph neighbours
 * (teachers, pupils, doctrinal influences).
 */
export function graphContextFor(query: string): GraphContext {
  const matched = detectPhilosophers(query);
  const related = new Set<string>();
  for (const name of matched) {
    for (const neighbor of kgNeighbors(name)) {
      if (!matched.includes(neighbor)) related.add(neighbor);
    }
  }
  const context: GraphContext = { matched, related: [...related] };
  if (matched.length > 0 && detectRelationalIntent(query)) {
    context.relationSections = relationSectionsFor(matched);
  }
  return context;
}

/** Candidate pools that feed hybrid fusion, computed once per query. */
export interface HybridPools {
  sparseIndices: number[];
  denseIndices: number[];
  graphContext: GraphContext;
  /** Corpus school labels named in the query (e.g. "Cynics" for "κυνικοι"). */
  schoolMatched?: string[];
}

/**
 * Weighted reciprocal-rank fusion of the sparse and dense pools plus the
 * knowledge-graph boost. Pure: same pools + params always give the same
 * ranking, so offline tuning sweeps reuse cached pools.
 */
export function fuseHybrid(
  pools: HybridPools,
  params: FusionParams = DEFAULT_FUSION_PARAMS,
): Array<{ docIdx: number; score: number }> {
  const fused = new Map<number, number>();
  const contributions: Array<[number[], number]> = [
    [pools.sparseIndices, params.sparseWeight],
    [pools.denseIndices, params.denseWeight],
  ];
  for (const [ranking, weight] of contributions) {
    ranking.forEach((docIdx, rank) => {
      fused.set(docIdx, (fused.get(docIdx) ?? 0) + weight / (params.rrfK + rank + 1));
    });
  }
  // Knowledge-graph boost: passages by philosophers named in the query
  // (or their teachers/pupils/influences) rise in the fused ranking.
  if (pools.graphContext.matched.length > 0) {
    const matched = new Set(pools.graphContext.matched);
    const related = new Set(pools.graphContext.related);
    // Relational queries ("students of X"): the sections asserting the
    // relation (edge refs, diadochai lists) get the full matched-level
    // boost even though they live outside X's own chapter, so the
    // chapter boost cannot bury them.
    const relationSections = new Set(pools.graphContext.relationSections ?? []);
    for (const [docIdx, score] of fused) {
      const section = corpus[docIdx]!;
      let boost = 0;
      if (matched.has(section.philosopher)) boost = params.kgMatchedBoost;
      else if (related.has(section.philosopher)) boost = params.kgRelatedBoost;
      if (relationSections.has(section.id)) {
        boost = Math.max(boost, params.kgMatchedBoost);
      }
      if (boost > 0) fused.set(docIdx, score + boost);
    }
  }
  // School boost: queries naming a school ("κυνικοι", "Stoics") lift that
  // school's sections, mirroring the philosopher-name boost above.
  const schools = pools.schoolMatched ?? [];
  if (schools.length > 0) {
    const schoolSet = new Set(schools);
    const boost = params.schoolBoost ?? params.kgMatchedBoost;
    for (const [docIdx, score] of fused) {
      if (schoolSet.has(corpus[docIdx]!.school)) {
        fused.set(docIdx, score + boost);
      }
    }
  }
  return [...fused.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([docIdx, score]) => ({ docIdx, score }));
}

/** Compute the sparse + dense candidate pools for a query (dense index required). */
export async function hybridPools(query: string): Promise<HybridPools> {
  const graphContext = graphContextFor(query);
  const queryVector = await embedQuery(query);
  const dense = denseRank(queryVector, POOL);
  const denseIndices = dense
    .map((d) => indexById.get(d.id))
    .filter((i): i is number => i !== undefined);
  const { indices: sparseIndices } = bm25.rank(query, POOL);
  return { sparseIndices, denseIndices, graphContext, schoolMatched: detectSchools(query) };
}

export async function retrieve(
  query: string,
  topK: number,
  requestedMode: RetrievalMode,
): Promise<{ hits: RankedPassage[]; mode: string; graphContext: GraphContext }> {
  const graphContext = graphContextFor(query);
  let mode: RetrievalMode = requestedMode;
  if ((mode === "hybrid" || mode === "dense") && !denseIndexReady()) {
    mode = "sparse";
  }

  if (mode === "sparse") {
    const { indices, scores } = bm25.rank(query, topK);
    return {
      hits: indices.map((i) => ({
        ...corpus[i]!,
        score: scores[i] ?? 0,
        source: "bm25",
      })),
      mode: "sparse",
      graphContext,
    };
  }

  if (mode === "dense") {
    const queryVector = await embedQuery(query);
    const dense = denseRank(queryVector, POOL);
    return {
      hits: dense.slice(0, topK).flatMap((d) => {
        const i = indexById.get(d.id);
        if (i === undefined) return [];
        return [{ ...corpus[i]!, score: d.score, source: "dense" }];
      }),
      mode: "dense",
      graphContext,
    };
  }

  const pools = await hybridPools(query);
  const ordered = fuseHybrid(pools).slice(0, topK);

  return {
    hits: ordered.map(({ docIdx, score }) => ({
      ...corpus[docIdx]!,
      score,
      source: "hybrid",
    })),
    mode: "hybrid",
    graphContext: pools.graphContext,
  };
}

const EXCERPT_LENGTH = 420;

function excerpt(text: string): string {
  if (text.length <= EXCERPT_LENGTH) return text;
  const cut = text.slice(0, EXCERPT_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : EXCERPT_LENGTH)} …`;
}

export function composeExtractiveAnswer(passages: RankedPassage[]): string {
  if (passages.length === 0) {
    return "No relevant passages were found in the Lives of Eminent Philosophers for this question.";
  }
  const top = passages.slice(0, 3);
  const parts = top.map((p) => {
    const body = p.textEn ? excerpt(p.textEn) : excerpt(p.text);
    return `D.L. ${p.id} - ${p.philosopher} (${p.school}): ${body}`;
  });
  const more =
    passages.length > top.length
      ? `\n\nFurther passages are listed below (${passages.length} retrieved in total).`
      : "";
  return `The most relevant passages retrieved for your question:\n\n${parts.join("\n\n")}${more}`;
}
