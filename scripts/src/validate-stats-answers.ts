/**
 * validate-stats-answers — /ask must answer dataset-statistics questions
 * from live dataset counts.
 *
 * The gold set's statistics-* and synthesis-* topics ask corpus-wide counts and
 * distributions ("How many sayings have been recorded?", "Which book has
 * the most assertions?"). These are answered by lib/stats-answer.ts from
 * the computed dataset statistics (the same figures /corpus/stats and
 * /stats/detailed serve), cited to the dataset-statistics source rather
 * than a CTS passage.
 *
 * Checks:
 *  1. Every statistics-* and synthesis-* gold topic (Greek AND English
 *     phrasing) is detected and answered, and the answer value matches the
 *     gold expected_answer — except the two documented stale-gold entity
 *     counts (statistics-011/012), whose gold values (783/9305) predate
 *     the 2026-08-05 scoped gazetteer entries for Bryson and Heraclides of
 *     Heraclea; for those the live value must be numeric and >= gold.
 *  2. Negative controls: the statistics-abstain topic ("how many readers
 *     visited the Academy") and ordinary biography/quote gold questions
 *     must NOT be routed to stats answering.
 *  3. Non-vacuity: at least 25 stats topics were checked in both
 *     languages, and every answered value is non-empty.
 *
 * Run: pnpm --filter @workspace/scripts run validate-stats-answers
 */
import path from "node:path";
import { readFileSync } from "node:fs";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { statsAnswerFor } = await import(
  "../../artifacts/api-server/src/lib/stats-answer"
);

const GOLD = path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data/eval/gold/gold-topics-v0.5.jsonl",
);

/** Gold values frozen before the 2026-08-05 gazetteer additions. */
const STALE_GOLD: Record<string, string> = {
  "statistics-011": "783",
  "statistics-012": "9305",
};

interface Topic {
  topic_id: string;
  question: string;
  question_en?: string;
  question_type?: string;
  expected_answer?: string;
  expected_action?: string;
}

const topics: Topic[] = readFileSync(GOLD, "utf8")
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l));

const errors: string[] = [];
let statsChecked = 0;
let negativesChecked = 0;

for (const t of topics) {
  const isStats = /^(statistics|synthesis)-\d/.test(t.topic_id);
  const questions = [t.question, t.question_en].filter(
    (q): q is string => !!q,
  );
  for (const q of questions) {
    const a = statsAnswerFor(q);
    if (isStats) {
      statsChecked++;
      if (!a) {
        errors.push(`${t.topic_id}: not detected as a stats question: ${q}`);
        continue;
      }
      if (!a.value || !a.text.includes(a.value) || !a.source) {
        errors.push(`${t.topic_id}: malformed stats answer for: ${q}`);
        continue;
      }
      const staleGold = STALE_GOLD[t.topic_id];
      if (staleGold !== undefined) {
        const live = Number(a.value);
        if (!Number.isFinite(live) || live < Number(staleGold)) {
          errors.push(
            `${t.topic_id}: live value ${a.value} below stale gold ${staleGold} for: ${q}`,
          );
        }
      } else if (a.value !== t.expected_answer) {
        errors.push(
          `${t.topic_id}: value "${a.value}" != gold "${t.expected_answer}" for: ${q}`,
        );
      }
    } else {
      negativesChecked++;
      if (a) {
        errors.push(
          `${t.topic_id}: falsely routed to stats (${a.intent} = ${a.value}) for: ${q}`,
        );
      }
    }
  }
}

// Non-vacuity: the gold file must actually contain the stats topics, and
// the abstain trap must have been among the negatives.
if (statsChecked < 50) {
  errors.push(
    `only ${statsChecked} stats question phrasings checked (expected >= 50: 25 topics x 2 languages)`,
  );
}
if (negativesChecked < 100) {
  errors.push(`only ${negativesChecked} negative controls checked`);
}
if (!topics.some((t) => t.topic_id === "statistics-abstain-01")) {
  errors.push("statistics-abstain-01 trap topic missing from gold file");
}

// Positive control: a seeded wrong expectation must be detectable — the
// checker cannot pass vacuously if statsAnswerFor starts returning null
// for everything (covered above) or empty values.
const control = statsAnswerFor("How many sayings have been recorded?");
if (!control || control.value === "" || Number(control.value) <= 0) {
  errors.push("positive control failed: sayings count missing or zero");
}

if (errors.length > 0) {
  console.error(`validate-stats-answers: ${errors.length} error(s)`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(
  `validate-stats-answers OK — ${statsChecked} stats phrasings answered, ${negativesChecked} negative controls clean`,
);
