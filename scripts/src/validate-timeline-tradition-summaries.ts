/**
 * Source-level guard: the "How the major traditions compare" summary grid
 * at the bottom of the comparative timeline must stay in step with the
 * timeline entries and the filter chips. All three surfaces (chips, entry
 * badges, summary-card dots) draw label/color from TRADITION_META, so a
 * tradition added, renamed, or recolored there could silently drift:
 * a summary card could reference a tradition with no entries, or a new
 * entry tradition could ship with no summary strand.
 *
 * NOTE (2026-08-09): the comparative timeline was removed from the shipped
 * edition by editorial decision; the code is preserved in
 * attic/comparative-timeline.tsx, and this validator keeps guarding that
 * preserved copy so it stays revivable. It parses the attic file and checks:
 *
 * 1. The Tradition union type, TRADITION_META keys, ENTRIES traditions,
 *    and TRADITION_SUMMARIES traditions are mutually consistent:
 *    - every tradition used by an entry has a META record (label+color)
 *      and at least one summary card;
 *    - every summary card's tradition has at least one entry;
 *    - every META tradition (which becomes a filter chip) has at least
 *      one entry - no zero-count chips;
 *    - the union type and META keys match exactly.
 * 2. META labels and colors are non-empty, colors are valid hex, and no
 *    two traditions share a label or color (which would make chips,
 *    badges, and summary dots indistinguishable).
 * 3. The JSX still renders chips, entry badges, and summary dots from
 *    TRADITION_META (label/color single-sourcing), so a hardcoded label
 *    or color cannot quietly reappear.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-timeline-tradition-summaries
 * A different source file can be passed as argv[2] (used for self-tests).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const file =
  process.argv[2] ??
  path.resolve(
    import.meta.dirname,
    "../../attic/comparative-timeline.tsx",
  );
const src = readFileSync(file, "utf8");

const errors: string[] = [];

/** Extract a top-level `const NAME ... = [...] ;` or `= {...};` block. */
function block(name: string): string {
  const re = new RegExp(`const ${name}[^=]*=\\s*([\\s\\S]*?)\\n\\];?\\n`, "m");
  const m = src.match(re);
  if (m) return m[1] + "\n]";
  // Object literal form (TRADITION_META).
  const reObj = new RegExp(`const ${name}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`, "m");
  const mo = src.match(reObj);
  if (mo) return mo[1];
  errors.push(`could not locate const ${name} in ${file}`);
  return "";
}

// ---------------------------------------------------------------------
// 1. Parse the three data structures + the union type.
// ---------------------------------------------------------------------
const unionMatch = src.match(/type Tradition\s*=\s*([\s\S]*?);/);
const unionKeys = unionMatch
  ? [...unionMatch[1].matchAll(/"([a-z-]+)"/g)].map((m) => m[1])
  : [];
if (unionKeys.length === 0) errors.push("could not parse the Tradition union type");

const metaBlock = block("TRADITION_META");
const meta = new Map<string, { label: string; color: string }>();
for (const m of metaBlock.matchAll(
  /([a-zA-Z]+):\s*\{\s*label:\s*"([^"]*)",\s*color:\s*"([^"]*)"\s*\}/g,
)) {
  if (meta.has(m[1])) errors.push(`TRADITION_META: duplicate key "${m[1]}"`);
  meta.set(m[1], { label: m[2], color: m[3] });
}
if (meta.size === 0) errors.push("could not parse any TRADITION_META records");

const entriesBlock = block("ENTRIES");
const entryTraditions = [...entriesBlock.matchAll(/tradition:\s*"([a-z-]+)"/g)].map(
  (m) => m[1],
);
if (entryTraditions.length === 0)
  errors.push("could not parse any ENTRIES tradition fields");
const entryCounts = new Map<string, number>();
for (const t of entryTraditions)
  entryCounts.set(t, (entryCounts.get(t) ?? 0) + 1);

const summariesBlock = block("TRADITION_SUMMARIES");
const summaries = [
  ...summariesBlock.matchAll(/tradition:\s*"([a-z-]+)",\s*strand:\s*"([^"]*)"/g),
].map((m) => ({ tradition: m[1], strand: m[2] }));
if (summaries.length === 0)
  errors.push("could not parse any TRADITION_SUMMARIES records");
const summaryTraditions = new Set(summaries.map((s) => s.tradition));

// ---------------------------------------------------------------------
// 2. Cross-consistency checks.
// ---------------------------------------------------------------------
const metaKeys = new Set(meta.keys());

for (const k of unionKeys)
  if (!metaKeys.has(k))
    errors.push(`Tradition union has "${k}" but TRADITION_META has no record for it`);
for (const k of metaKeys)
  if (!unionKeys.includes(k))
    errors.push(`TRADITION_META key "${k}" is not in the Tradition union type`);

for (const [t, n] of entryCounts) {
  if (!metaKeys.has(t))
    errors.push(`entries use tradition "${t}" (${n}x) but TRADITION_META has no label/color for it`);
  if (!summaryTraditions.has(t))
    errors.push(
      `tradition "${t}" has ${n} timeline entr${n === 1 ? "y" : "ies"} but no card in the "How the major traditions compare" grid`,
    );
}
for (const s of summaries) {
  if (!metaKeys.has(s.tradition))
    errors.push(`summary card "${s.strand}" references unknown tradition "${s.tradition}"`);
  if (!entryCounts.has(s.tradition))
    errors.push(
      `summary card "${s.strand}" references tradition "${s.tradition}" which has no timeline entries`,
    );
}
for (const k of metaKeys)
  if (!entryCounts.has(k))
    errors.push(`TRADITION_META "${k}" would render a filter chip with zero entries`);

// Duplicate strands would collide as React keys and confuse readers.
const seenStrands = new Set<string>();
for (const s of summaries) {
  if (seenStrands.has(s.strand))
    errors.push(`duplicate summary strand "${s.strand}"`);
  seenStrands.add(s.strand);
}

// ---------------------------------------------------------------------
// 3. Label/color sanity in META.
// ---------------------------------------------------------------------
const seenLabels = new Map<string, string>();
const seenColors = new Map<string, string>();
for (const [k, { label, color }] of meta) {
  if (!label.trim()) errors.push(`TRADITION_META "${k}" has an empty label`);
  if (!/^#[0-9a-fA-F]{6}$/.test(color))
    errors.push(`TRADITION_META "${k}" color "${color}" is not a 6-digit hex color`);
  const l = seenLabels.get(label);
  if (l) errors.push(`traditions "${l}" and "${k}" share the label "${label}"`);
  seenLabels.set(label, k);
  const c = seenColors.get(color.toLowerCase());
  if (c) errors.push(`traditions "${c}" and "${k}" share the color "${color}"`);
  seenColors.set(color.toLowerCase(), k);
}

// ---------------------------------------------------------------------
// 4. Single-sourcing: chips, badges, and summary dots all read META.
// ---------------------------------------------------------------------
const jsxChecks: [string, RegExp][] = [
  [
    "filter chips iterate over TRADITION_META keys",
    /Object\.keys\(TRADITION_META\)/,
  ],
  [
    "entry badge label comes from TRADITION_META",
    /\{TRADITION_META\[e\.tradition\]\.label\}/,
  ],
  [
    "entry color comes from TRADITION_META",
    /TRADITION_META\[e\.tradition\]\.color/,
  ],
  [
    "summary-card dot color comes from TRADITION_META",
    /backgroundColor:\s*TRADITION_META\[s\.tradition\]\.color/,
  ],
];
for (const [what, re] of jsxChecks)
  if (!re.test(src)) errors.push(`JSX drift: ${what} - pattern not found`);

// ---------------------------------------------------------------------
// Report (with positive counts so a vacuous pass is visible).
// ---------------------------------------------------------------------
console.log(
  `Parsed ${unionKeys.length} union members, ${meta.size} META records, ` +
    `${entryTraditions.length} entries across ${entryCounts.size} traditions, ` +
    `${summaries.length} summary cards.`,
);
if (errors.length > 0) {
  console.error(`\n${errors.length} tradition-summary drift problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  "All traditions consistent across chips, entries, and summary cards; labels/colors single-sourced from TRADITION_META.",
);
