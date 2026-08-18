/**
 * Validates the Timeline chronology derived from the dated claims
 * (timeline.ts). The classification of claim texts is regex-driven, so
 * a wording tweak in kg-claims could silently turn a headship year into
 * a fake birth year or drop a philosopher off the chart. This validator
 * pins:
 *
 * 1. The philosopher count and, per philosopher, birth/death/floruit
 *    years and approx flags (exact snapshot).
 * 2. That every dated claim (one whose value carries a BCE year gloss)
 *    is classified by a known rule, with the role matching the claim's
 *    surface shape (Born.../Died.../floruit anchors/observations). A
 *    new gloss shape no rule covers fails loudly.
 * 3. That headship/arrival anchors ("Became head", "Came to Athens",
 *    "Presided over the school", ...) never surface as a literal birth
 *    or death year - they must classify as floruit.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-timeline
 */
import path from "node:path";

import { TIMELINE_PINS, type TimelinePinRow as Row } from "./timeline-pins";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getTimeline, parseYear, timelineRoleFor } = await import(
  "../../artifacts/api-server/src/lib/timeline"
);
const { getClaims } = await import(
  "../../artifacts/api-server/src/lib/kg-claims"
);

const errors: string[] = [];

// ---------------------------------------------------------------------
// 1. Pinned snapshot: [name, birthYear, deathYear, floruitYear,
//    approxBirth, approxDeath] in timeline order (negative = BCE).
// ---------------------------------------------------------------------
const PINNED = TIMELINE_PINS;

const timeline = getTimeline();
if (timeline.length !== PINNED.length) {
  errors.push(
    `philosopher count changed: expected ${PINNED.length}, got ${timeline.length}`,
  );
}
const actualByName = new Map(timeline.map((p) => [p.name, p]));
for (const [name, birth, death, floruit, aBirth, aDeath] of PINNED) {
  const p = actualByName.get(name);
  if (!p) {
    errors.push(`${name}: dropped off the timeline`);
    continue;
  }
  const got: Row = [
    name,
    p.birthYear ?? null,
    p.deathYear ?? null,
    p.floruitYear ?? null,
    p.approxBirth === true,
    p.approxDeath === true,
  ];
  const want: Row = [name, birth, death, floruit, aBirth, aDeath];
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    errors.push(
      `${name}: chronology changed\n      expected ${JSON.stringify(want)}\n      got      ${JSON.stringify(got)}`,
    );
  }
}
for (const p of timeline) {
  if (!PINNED.some(([name]) => name === p.name)) {
    errors.push(
      `${p.name}: new on the timeline - verify the chronology and add a pin`,
    );
  }
}

// ---------------------------------------------------------------------
// 2 + 3. Every dated claim must classify under a known rule, and the
// role must match the claim's surface shape. Headship/arrival anchors
// must always land on floruit, never on a literal birth/death year.
// ---------------------------------------------------------------------

/** Anchors that date active life, not birth/death (mirrors timeline.ts). */
const LIFE_ANCHOR =
  /Became head|Rose to be head|Assumed the headship|Presided over the school|Was head of the school|Came to Athens|^Succeeded\b|^Was (already )?an old man|^Flourish|^Lived in the/;

const SHAPES: Record<string, RegExp> = {
  born: /^Born\b/,
  died: /^(Died|Departed this life)\b|^Lived\b|^Said to have been\b/,
  flourished: /floruit|flourish/i,
  observation: /^Was\b/,
};

for (const c of getClaims()) {
  if (c.property !== "birthDate" && c.property !== "deathDate") continue;
  if (parseYear(c.value) === undefined) continue;

  const role = timelineRoleFor(c);
  const anchored = LIFE_ANCHOR.test(c.value);

  if (anchored && role !== "flourished") {
    errors.push(
      `${c.id}: headship/arrival/floruit anchor classified as "${role}" - ` +
        `its year would surface as a literal ${role} year\n      value: ${c.value}`,
    );
    continue;
  }
  const shape = anchored ? LIFE_ANCHOR : SHAPES[role];
  if (!shape || !shape.test(c.value)) {
    errors.push(
      `${c.id}: dated claim classified as "${role}" but its wording matches ` +
        `no known rule - verify the year lands on the right endpoint\n      value: ${c.value}`,
    );
  }
}

if (errors.length > 0) {
  console.error(`TIMELINE VALIDATION FAILED (${errors.length}):`);
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}

const dated = getClaims().filter(
  (c) =>
    (c.property === "birthDate" || c.property === "deathDate") &&
    parseYear(c.value) !== undefined,
);
console.log(
  `OK: ${timeline.length} philosophers pinned, ${dated.length} dated claims classified`,
);
