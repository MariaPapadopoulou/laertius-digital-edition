/**
 * Validates the curated ALT_TITLES layer against the wrote-claims: every
 * alt-title record's work must appear as exactly one wrote-claim value
 * whose subject equals the record's owner. Otherwise the "also titled"
 * note silently vanishes from the claims panel (routes/graph.ts only
 * attaches it when claim.subject === alt.owner and claim.value === alt.work).
 *
 * Also asserts work titles are unique within ALT_TITLES, since the route
 * keys its lookup map by work title.
 *
 * Prints a positive count of checked entries so it can't pass vacuously.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-alt-titles
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getClaims } = await import("../../artifacts/api-server/src/lib/kg-claims");
const { ALT_TITLES } = await import("../../artifacts/api-server/src/lib/kg-ontology");

const errors: string[] = [];

if (ALT_TITLES.length === 0) {
  errors.push("ALT_TITLES is empty — validator would pass vacuously");
}

// Route lookup is keyed by work title; duplicates would shadow each other.
const seenWorks = new Map<string, number>();
for (const a of ALT_TITLES) {
  seenWorks.set(a.work, (seenWorks.get(a.work) ?? 0) + 1);
}
for (const [work, n] of seenWorks) {
  if (n > 1) {
    errors.push(`duplicate ALT_TITLES work title "${work}" (${n} entries) — route map keyed by work would drop all but one`);
  }
}

// Index wrote-claims: value -> subjects that wrote it.
const wroteBy = new Map<string, string[]>();
for (const c of getClaims()) {
  if (c.property !== "wrote") continue;
  const list = wroteBy.get(c.value) ?? [];
  list.push(c.subject);
  wroteBy.set(c.value, list);
}

let checked = 0;
for (const a of ALT_TITLES) {
  checked++;
  const subjects = wroteBy.get(a.work) ?? [];
  const matches = subjects.filter((s) => s === a.owner);
  if (matches.length === 0) {
    errors.push(
      `ALT_TITLES entry "${a.work}" (owner: ${a.owner}, ref ${a.ref}) has no wrote-claim ` +
        `with subject "${a.owner}"` +
        (subjects.length > 0
          ? `; the work is a wrote-claim value for: ${subjects.join(", ")}`
          : "; the work is not any wrote-claim value"),
    );
  } else if (matches.length > 1) {
    errors.push(
      `ALT_TITLES entry "${a.work}" (owner: ${a.owner}) matches ${matches.length} wrote-claims for that owner — expected exactly one`,
    );
  }
}

if (errors.length > 0) {
  console.error(`validate-alt-titles: ${errors.length} error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `validate-alt-titles: OK — ${checked} alt-title entries each match exactly one wrote-claim for their owner.`,
);
