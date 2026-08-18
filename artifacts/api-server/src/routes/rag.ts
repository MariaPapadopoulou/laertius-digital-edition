import { Router, type IRouter } from "express";
import {
  SearchCorpusBody,
  SearchCorpusResponse,
  AskQuestionBody,
  AskQuestionResponse,
} from "@workspace/api-zod";
import {
  retrieve,
  composeExtractiveAnswer,
  type RankedPassage,
} from "../lib/rag";
import { claimAnswersFor } from "../lib/claims-answer";
import { generateAnswer, generativeAvailable } from "../lib/generate-answer";
import { statsAnswerFor } from "../lib/stats-answer";
import { versesForPhilosophers } from "../lib/verses";
import { sayingsForPhilosophers } from "../lib/sayings";
import {
  schoolGrcForCorpusLabel,
  displaySchoolLabel,
} from "../lib/greek-names";

// Questions that are asking for the verse layer (a death-epigram, an oracle,
// an epitaph, quoted poetry) rather than prose.
const VERSE_INTENT =
  /\b(epigram|epitaph|verse|verses|poem|poetry|poetic|lines|oracle|couplet|inscription|elegy|elegiac)\b/i;

// Questions asking for the sayings layer (an apophthegm, a retort, a maxim,
// a witticism) rather than prose. Gated on philosophers matched in the query.
const SAYING_INTENT =
  /\b(saying|sayings|apophthegm|apophthegms|apothegm|apothegms|maxim|maxims|quip|quips|retort|retorts|witticism|witty|joke|jokes|anecdote|anecdotes|remark|remarked|quote|quotes|quoted|famous(?:ly)?|reply|replied|answer(?:ed)?|say|said|says)\b/i;

const router: IRouter = Router();

function serialize(h: RankedPassage) {
  return {
    id: h.id,
    urn: h.urn,
    book: h.book,
    chapter: h.chapter,
    section: h.section,
    philosopher: h.philosopher,
    // Display form (e.g. "Garden (Epicurus)" renders as "Garden"); the
    // Greek lookup keys on the canonical label BEFORE the override.
    school: displaySchoolLabel(h.school),
    schoolGrc: schoolGrcForCorpusLabel(h.school),
    text: h.text,
    textEn: h.textEn,
    score: h.score,
    source: h.source,
  };
}

router.post("/search", async (req, res) => {
  const parsed = SearchCorpusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { query, topK = 10, mode = "hybrid" } = parsed.data;
  try {
    const { hits, mode: usedMode } = await retrieve(query, topK, mode);
    const data = SearchCorpusResponse.parse({
      hits: hits.map(serialize),
      mode: usedMode,
    });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Search failed");
    res.status(500).json({ error: "Search failed" });
  }
});

router.post("/ask", async (req, res) => {
  const parsed = AskQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { query, topK = 8 } = parsed.data;
  try {
    // Dataset-statistics questions (corpus-wide counts/distributions) are
    // answered authoritatively from live dataset counts, cited to the
    // dataset statistics source rather than a CTS passage. Retrieval still
    // runs so the response shape (passages, graph context) is unchanged.
    const statsAnswer = statsAnswerFor(query);
    const { hits, graphContext } = await retrieve(query, topK, "hybrid");
    const claimAnswers = claimAnswersFor(query, graphContext.matched);
    const verseAnswers = VERSE_INTENT.test(query)
      ? versesForPhilosophers(graphContext.matched, query, 5)
      : [];
    const sayingAnswers = SAYING_INTENT.test(query)
      ? sayingsForPhilosophers(graphContext.matched, query, 5)
      : [];
    // Generative RAG: synthesize a grounded answer from the retrieved
    // context. Any failure (no key, offline bundle, LLM error/timeout)
    // falls back to the extractive answer under the same response shape.
    let generated = null;
    if (!statsAnswer && generativeAvailable()) {
      try {
        generated = await generateAnswer(query, {
          passages: hits,
          claimAnswers,
          verseAnswers,
          sayingAnswers,
        });
      } catch (err) {
        req.log.warn({ err }, "LLM answer generation failed; extractive fallback");
      }
    }
    const data = AskQuestionResponse.parse({
      answer: statsAnswer ? statsAnswer.text : composeExtractiveAnswer(hits),
      answerMode: statsAnswer
        ? "stats"
        : generated
          ? "generative"
          : "extractive",
      ...(statsAnswer ? { statsAnswer } : {}),
      ...(generated ? { generated } : {}),
      passages: hits.map(serialize),
      graphContext,
      claimAnswers,
      verseAnswers,
      sayingAnswers,
    });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Ask failed");
    res.status(500).json({ error: "Passage retrieval failed" });
  }
});

export default router;
