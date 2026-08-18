/**
 * validate-abstain-reporting — abstention results must ALWAYS be reported
 * per subtype (out_of_corpus, false_premise, underspecified_homonym) and
 * never collapsed into one merged number. The gold set is guaranteed to
 * contain all three subtypes (validate-gold-abstain); this is the same
 * guarantee on the REPORTING side:
 *
 *  1. Store/API path: topicSetSummary (the single abstention aggregate the
 *     eval API serves, /eval/topic-sets list + detail) is exercised with a
 *     synthetic topic set containing every ABSTAIN_TYPES subtype and must
 *     report each subtype separately with the exact per-subtype count,
 *     with the counts summing to the total (nothing merged, nothing lost).
 *  2. UI path: every eval frontend source file that renders an abstention
 *     figure (references nAbstain) must also render the per-subtype
 *     breakdown (byAbstainType) — a dashboard card showing only the merged
 *     total fails here.
 *  3. Positive controls: deliberately broken reports — subtypes merged
 *     into one row, an empty breakdown next to a nonzero total, a dropped
 *     subtype, a miscounted subtype, and a UI source stripped of its
 *     breakdown — must each be flagged.
 *  4. Drift guard: the synthetic set is built FROM the store's own
 *     ABSTAIN_TYPES (a newly added subtype is covered automatically), and
 *     the three documented subtypes must still be present.
 *
 * Run: pnpm --filter @workspace/scripts run validate-abstain-reporting
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
// The eval store imports the api-server corpus module, which resolves its
// data files against LAERTIUS_DATA_DIR — pin it BEFORE importing the store.
process.env["LAERTIUS_DATA_DIR"] ??= path.join(
  repoRoot,
  "artifacts",
  "api-server",
  "data",
);

const EVAL_SRC_DIR = path.join(repoRoot, "artifacts", "eval", "src");

const DOCUMENTED_TYPES = [
  "out_of_corpus",
  "false_premise",
  "underspecified_homonym",
] as const;

let failures = 0;
const fail = (msg: string): void => {
  failures += 1;
  console.error(`  ✗ ${msg}`);
};
const ok = (msg: string): void => console.log(`  ✓ ${msg}`);

/* ------------------------------------------------------------------ */
/* Shared checkers (run against the real surfaces AND the controls)    */
/* ------------------------------------------------------------------ */

interface SummaryLike {
  nAbstain: number;
  byAbstainType: Array<{ name: string; count: number }>;
}

/**
 * A summary reports abstentions per subtype iff every expected subtype
 * appears as its OWN row with the exact expected count, no unexpected
 * rows exist, and the rows sum to the merged total. Returns the list of
 * problems (empty = compliant).
 */
function summaryProblems(
  summary: SummaryLike,
  expected: ReadonlyMap<string, number>,
): string[] {
  const problems: string[] = [];
  const rows = new Map(summary.byAbstainType.map((r) => [r.name, r.count]));
  if (rows.size !== summary.byAbstainType.length) {
    problems.push("byAbstainType contains duplicate subtype rows");
  }
  for (const [type, count] of expected) {
    const got = rows.get(type);
    if (got === undefined) {
      problems.push(`subtype "${type}" is missing from byAbstainType (merged or dropped)`);
    } else if (got !== count) {
      problems.push(`subtype "${type}" reports ${got}, expected ${count}`);
    }
  }
  for (const name of rows.keys()) {
    if (!expected.has(name)) {
      problems.push(`unexpected byAbstainType row "${name}" (a merged bucket?)`);
    }
  }
  const sum = summary.byAbstainType.reduce((n, r) => n + r.count, 0);
  if (sum !== summary.nAbstain) {
    problems.push(
      `byAbstainType rows sum to ${sum} but nAbstain=${summary.nAbstain} — the ` +
        `per-subtype breakdown does not account for every abstention`,
    );
  }
  return problems;
}

/**
 * A UI source that shows an abstention figure must also render the
 * per-subtype breakdown. Returns problems (empty = compliant).
 */
function uiSourceProblems(relPath: string, source: string): string[] {
  if (!source.includes("nAbstain")) return [];
  if (!source.includes("byAbstainType")) {
    return [
      `${relPath} renders an abstention figure (nAbstain) without the ` +
        `per-subtype breakdown (byAbstainType) — abstention subtypes must ` +
        `never be shown as one merged number`,
    ];
  }
  return [];
}

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(tsx?|mts)$/.test(name)) yield p;
  }
}

async function main(): Promise<void> {
  const store = await import("../../artifacts/api-server/src/lib/eval/store");
  const { ABSTAIN_TYPES, topicSetSummary } = store;

  /* ---------------- drift guard ---------------- */
  console.log("Drift guard (store ABSTAIN_TYPES):");
  for (const t of DOCUMENTED_TYPES) {
    if (!ABSTAIN_TYPES.has(t)) {
      fail(`documented subtype "${t}" is missing from store ABSTAIN_TYPES`);
    }
  }
  if (ABSTAIN_TYPES.size < DOCUMENTED_TYPES.length) {
    fail(`store ABSTAIN_TYPES has only ${ABSTAIN_TYPES.size} subtype(s)`);
  } else {
    ok(
      `store ABSTAIN_TYPES has ${ABSTAIN_TYPES.size} subtype(s): ` +
        [...ABSTAIN_TYPES].sort().join(", "),
    );
  }

  /* ---------------- 1. store/API reporting path ---------------- */
  console.log("\nStore/API reporting path (topicSetSummary):");
  // Synthetic set derived from the store's own subtype list: distinct
  // per-subtype counts (2, 3, 4, …) so a swap or merge cannot cancel out.
  const types = [...ABSTAIN_TYPES].sort();
  const expected = new Map<string, number>(types.map((t, i) => [t, i + 2]));
  const topics: Array<Record<string, unknown>> = [
    { topic_id: "t-plain", question: "plain retrieval question" },
  ];
  for (const [type, count] of expected) {
    for (let i = 0; i < count; i++) {
      topics.push({
        topic_id: `t-${type}-${i}`,
        question: `synthetic ${type} hard negative ${i}`,
        must_abstain: true,
        abstain_type: type,
      });
    }
  }
  const summary = topicSetSummary({
    id: "topics-synthetic",
    label: "synthetic abstention reporting probe",
    snapshotId: "snap-synthetic",
    createdAt: new Date(0).toISOString(),
    topics: topics as never,
  });
  const problems = summaryProblems(summary, expected);
  if (problems.length > 0) {
    for (const p of problems) {
      fail(`topicSetSummary (served by /eval/topic-sets list + detail): ${p}`);
    }
  } else {
    ok(
      `topicSetSummary reports all ${expected.size} subtypes separately with ` +
        `exact counts (${[...expected].map(([t, c]) => `${t}: ${c}`).join(", ")})`,
    );
  }

  /* ---------------- 2. UI reporting surfaces ---------------- */
  console.log("\nEval UI reporting surfaces:");
  let uiSurfaces = 0;
  for (const file of walk(EVAL_SRC_DIR)) {
    const rel = path.relative(repoRoot, file);
    const src = readFileSync(file, "utf8");
    if (!src.includes("nAbstain")) continue;
    uiSurfaces++;
    const uiProblems = uiSourceProblems(rel, src);
    if (uiProblems.length > 0) uiProblems.forEach(fail);
    else ok(`${rel} renders the per-subtype breakdown alongside the total`);
  }
  // Sweep positive control: if no eval source references nAbstain at all,
  // either the field was renamed (checker blind) or abstention reporting
  // vanished from the UI — both must fail loudly, never pass vacuously.
  if (uiSurfaces === 0) {
    fail(
      `no file under ${path.relative(repoRoot, EVAL_SRC_DIR)} references ` +
        `nAbstain — the abstention reporting surface moved or was renamed; ` +
        `update validate-abstain-reporting.ts`,
    );
  }

  /* ---------------- 3. positive controls ---------------- */
  console.log("\nPositive controls (mutated reports must be flagged):");
  const controls: Array<{ name: string; broken: SummaryLike }> = [
    {
      name: "subtypes merged into one row",
      broken: {
        nAbstain: 9,
        byAbstainType: [{ name: "abstain", count: 9 }],
      },
    },
    {
      name: "empty breakdown next to a nonzero total",
      broken: { nAbstain: 9, byAbstainType: [] },
    },
    {
      name: "one subtype dropped (its count folded into another)",
      broken: {
        nAbstain: 9,
        byAbstainType: [
          { name: types[0]!, count: 5 },
          { name: types[1]!, count: 4 },
        ],
      },
    },
    {
      name: "right rows, wrong count on one subtype",
      broken: {
        nAbstain: 9,
        byAbstainType: types.map((t, i) => ({
          name: t,
          count: i === 0 ? 1 : i + 2,
        })),
      },
    },
  ];
  for (const c of controls) {
    if (summaryProblems(c.broken, expected).length > 0) {
      ok(`control flagged: ${c.name}`);
    } else {
      fail(`control NOT flagged: ${c.name} — summaryProblems() is broken`);
    }
  }
  // UI control: a real surface with its breakdown stripped must be flagged.
  const realSurface = path.join(EVAL_SRC_DIR, "pages", "topics", "TopicsList.tsx");
  const stripped = readFileSync(realSurface, "utf8").replaceAll("byAbstainType", "mergedTotal");
  if (uiSourceProblems("control:TopicsList-stripped", stripped).length > 0) {
    ok("control flagged: UI surface with the per-subtype breakdown stripped");
  } else {
    fail("control NOT flagged: stripped UI surface passed — uiSourceProblems() is broken");
  }

  console.log("");
  if (failures > 0) {
    console.error(`validate-abstain-reporting: FAILED (${failures} problem(s))`);
    process.exit(1);
  }
  console.log(
    `validate-abstain-reporting: OK (${expected.size} subtypes reported ` +
      `separately by the store; ${uiSurfaces} UI surface(s) show the breakdown)`,
  );
}

main().then(
  () => {},
  (err) => {
    console.error(String(err instanceof Error ? (err.stack ?? err.message) : err));
    process.exit(1);
  },
);
