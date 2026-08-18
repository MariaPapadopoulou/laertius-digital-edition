/**
 * Dataset-statistics answering for /ask.
 *
 * Corpus-wide count/distribution questions ("How many sayings have been
 * recorded?", "Which book has the most assertions?") cannot be answered
 * authoritatively by passage retrieval — the answers only exist as live
 * dataset counts. This module detects such questions (Greek and English
 * phrasing) and answers them from the same computed statistics the
 * /corpus/stats and /stats/detailed endpoints serve, citing the dataset
 * statistics source rather than a CTS passage.
 *
 * Detection is deliberately conservative: a question must combine a
 * statistics cue (how many / πόσες, which book has the most / ποιο βιβλίο
 * … περισσότερ-, most frequent / συχνότερ-, distributed / κατανέμ-) with a
 * known dataset-layer noun (sections, assertions, sayings, …). Count
 * questions about things the dataset does not tally (e.g. "how many
 * readers visited the Academy") fall through to normal retrieval, so
 * abstain topics stay abstainable.
 */
import { GetDetailedStatsResponse } from "@workspace/api-zod";
import { computeStats } from "../routes/stats";
import { corpus, philosophers, totalGreekWords } from "./corpus";
import { getEntitySummaries } from "./annotate";
import { getSourcesIndex } from "./sources-index";

type DetailedStats = ReturnType<(typeof GetDetailedStatsResponse)["parse"]>;

export interface StatsAnswer {
  intent: string;
  value: string;
  text: string;
  source: string;
}

const SOURCE = "Dataset statistics (live corpus counts)";

let statsCache: DetailedStats | null = null;
function stats(): DetailedStats {
  if (!statsCache) statsCache = GetDetailedStatsResponse.parse(computeStats());
  return statsCache;
}

/** Lowercase, strip Greek diacritics, fold final sigma. */
function normalize(q: string): string {
  return q
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ς/g, "σ");
}

// --- cues -----------------------------------------------------------------
// NB: \b is ASCII-only in JS regexes, so the Greek alternative uses explicit
// letter-class boundaries instead (the input is already normalized).
const COUNT_CUE = /\bhow many\b|(?:^|[^a-zα-ω])ποσ(?:εσ|α|οι|ουσ|ων)(?![a-zα-ω])/;
const BOOK_SUPERLATIVE_CUE =
  /(which book|what book).*\bmost\b|ποιο βιβλιο.*περισσοτερ/;
const MOST_FREQUENT_CUE = /most frequent|occurs most|συχνοτερ/;
const DISTRIBUTION_CUE = /\bdistributed\b|\bdistribution\b|κατανεμ/;

// --- layer nouns ----------------------------------------------------------
const N = {
  sections: /section|ενοτητ/,
  books: /\bbooks?\b|βιβλι/,
  philosophers: /philosopher|φιλοσοφ/,
  claims: /assertion|\bclaims?\b/,
  verses: /\bverses?\b|στιχ/,
  sayings: /saying|apophthegm|αποφθεγμ/,
  anecdotes: /anecdote|ανεκδοτ/,
  epistles: /letter|epistle|επιστολ/,
  testaments: /testament|διαθηκ/,
  doxai: /doxograph|δοξογραφ/,
  annotationsTotal: /\bannotations\b|επισημανσ/,
  entities: /entit|οντοτητ/,
  citations: /citation|παραπομπ/,
  greekWords: /\bwords?\b|λεξ/,
  speaker: /speaker|ομιλητ/,
  protagonist: /protagonist|πρωταγωνιστ/,
  certainty: /certainty|βεβαιοτητ/,
  property: /propert|ιδιοτητ/,
  authenticity: /authenticity|αυθεντικ/,
};

const fmt = (n: number) => String(n);

function answer(intent: string, value: string, sentence: string): StatsAnswer {
  return {
    intent,
    value,
    text: `${sentence} [${SOURCE}]`,
    source: SOURCE,
  };
}

function topBook(
  intent: string,
  field: "claims" | "verses" | "sayings" | "doxai" | "anecdotes",
  noun: string,
): StatsAnswer {
  const best = [...stats().books].sort((a, b) => b[field] - a[field])[0]!;
  const value = `Book ${best.book} (${best.label}): ${best[field]}`;
  return answer(
    intent,
    value,
    `${value} — Book ${best.book} contains the most ${noun} in the dataset.`,
  );
}

/**
 * Answer a dataset-statistics question from live dataset counts, or null
 * when the question is not a recognized statistics question.
 */
export function statsAnswerFor(query: string): StatsAnswer | null {
  const q = normalize(query);

  // Distributions ----------------------------------------------------------
  if (DISTRIBUTION_CUE.test(q) && N.epistles.test(q) && N.authenticity.test(q)) {
    const value = stats()
      .epistles.byAuthenticity.map((c) => `${c.name}: ${c.count}`)
      .join("; ");
    return answer(
      "epistles-by-authenticity",
      value,
      `The curated letters are distributed by authenticity as follows — ${value}.`,
    );
  }

  // "Which book has the most …" --------------------------------------------
  if (BOOK_SUPERLATIVE_CUE.test(q)) {
    if (N.claims.test(q)) return topBook("top-book-claims", "claims", "assertions");
    if (N.sayings.test(q)) return topBook("top-book-sayings", "sayings", "sayings");
    if (N.doxai.test(q))
      return topBook("top-book-doxai", "doxai", "doxographical positions");
    if (N.anecdotes.test(q))
      return topBook("top-book-anecdotes", "anecdotes", "anecdotes");
    if (N.verses.test(q)) return topBook("top-book-verses", "verses", "verses");
  }

  // "Most frequent …" --------------------------------------------------------
  if (MOST_FREQUENT_CUE.test(q)) {
    if (N.speaker.test(q)) {
      const top = stats().sayings.topSpeakers[0];
      if (top) {
        const value = `${top.name}: ${top.count}`;
        return answer(
          "top-saying-speaker",
          value,
          `The most frequent speaker in the sayings collection is ${top.name} (${value} sayings).`,
        );
      }
    }
    if (N.protagonist.test(q)) {
      const top = stats().anecdotes.topProtagonists[0];
      if (top) {
        const value = `${top.name}: ${top.count}`;
        return answer(
          "top-anecdote-protagonist",
          value,
          `The most frequent protagonist in the anecdote collection is ${top.name} (${value} anecdotes).`,
        );
      }
    }
    if (N.certainty.test(q)) {
      const top = [...stats().claims.byCertainty].sort(
        (a, b) => b.count - a.count,
      )[0];
      if (top) {
        const value = `${top.name}: ${top.count}`;
        return answer(
          "top-claim-certainty",
          value,
          `The most frequent certainty status among the assertions is ${value} (assertions so classified).`,
        );
      }
    }
    if (N.property.test(q)) {
      const top = stats().claims.byProperty[0];
      if (top) {
        const value = `${top.name}: ${top.count}`;
        return answer(
          "top-claim-property",
          value,
          `The most frequent property among the assertions is ${value} (assertions with this property).`,
        );
      }
    }
  }

  // Plain counts -------------------------------------------------------------
  if (!COUNT_CUE.test(q)) return null;

  // Assertions classified with a specific certainty status.
  if (N.claims.test(q)) {
    const status = stats().claims.byCertainty.find((c) =>
      new RegExp(`\\b${c.name}\\b`).test(q),
    );
    if (status) {
      return answer(
        `claims-${status.name}`,
        fmt(status.count),
        `${status.count} assertions are classified as "${status.name}" in the dataset.`,
      );
    }
  }

  const s = stats();
  // Order matters: "entity annotations" must hit the annotations total, not
  // the entity count; the noun checks below go from most to least specific.
  const counts: [string, RegExp, number, string][] = [
    ["total-sections", N.sections, corpus.length, "sections"],
    ["total-claims", N.claims, s.claims.total, "curated assertions"],
    ["total-verses", N.verses, s.verses.total, "verses recorded as distinct units"],
    ["total-sayings", N.sayings, s.sayings.total, "sayings"],
    ["total-anecdotes", N.anecdotes, s.anecdotes.total, "anecdotes"],
    ["total-epistles", N.epistles, s.epistles.total, "curated letters"],
    ["total-testaments", N.testaments, s.testaments.total, "testaments"],
    ["total-doxai", N.doxai, stats().books.reduce((n, b) => n + b.doxai, 0), "doxographical positions"],
    [
      "total-annotations",
      N.annotationsTotal,
      getEntitySummaries().reduce((n, e) => n + e.occurrences, 0),
      "entity annotations in total",
    ],
    [
      "total-entities",
      N.entities,
      getEntitySummaries().length,
      "distinct annotated entities",
    ],
    [
      "total-citations",
      N.citations,
      getSourcesIndex().rows.length,
      "source citations",
    ],
    ["total-philosophers", N.philosophers, philosophers.length, "philosophers"],
    ["total-books", N.books, s.books.length, "books of Diogenes Laertius"],
    ["total-greek-words", N.greekWords, totalGreekWords, "Greek words"],
  ];
  for (const [intent, re, count, noun] of counts) {
    if (re.test(q)) {
      return answer(
        intent,
        fmt(count),
        `The dataset contains ${count} ${noun}.`,
      );
    }
  }

  return null;
}
