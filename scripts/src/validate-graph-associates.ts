/**
 * Validates the Graph page's satellite associates (graph-associates.ts,
 * the exact builder /api/graph serves). The list is joined at runtime
 * from school-members.ts (roster) and succession-links.ts (teacher
 * legs) by label: a roster edit, a founder rename, or a drifted teacher
 * label would silently drop satellites or legs from the Graph page with
 * no failing check. This validator pins:
 *
 * 1. Per-school associate counts (stoa 6, epicurean 8, sceptic 23,
 *    academy 3 = 40) and the exact founder anchor of each school.
 * 2. The exact set of teacher legs as [pupil, teacher, asserted]
 *    triples (30 legs), so a broken pupil/teacher join surfaces as a
 *    missing leg, not a silent star around the founder.
 * 3. The hedged roster entries (dashed dot + "hedged" badge in the UI).
 * 4. That every associate resolves a sectionId from its ref, no
 *    associate name collides with a KG node (that would double-draw),
 *    and every teacher is drawable (a KG node or another associate).
 *
 * A deliberate roster or succession change requires updating the pins.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-graph-associates
 */
import path from "node:path";

import {
  PINNED_ANCHORS,
  PINNED_COUNTS,
  PINNED_HEDGED,
  PINNED_LEGS,
  PINNED_TOTAL,
  type Leg,
} from "./graph-associate-pins";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { buildGraphAssociates } = await import(
  "../../artifacts/api-server/src/lib/graph-associates"
);
const { getKnowledgeGraph } = await import(
  "../../artifacts/api-server/src/lib/kg"
);

const errors: string[] = [];

const associates = buildGraphAssociates();
const kgNames = new Set(getKnowledgeGraph().nodes.map((n) => n.name));

// ---------------------------------------------------------------------
// 1. Per-school counts, total, and founder anchors.
// ---------------------------------------------------------------------
const counts = new Map<string, number>();
for (const a of associates) {
  counts.set(a.movement, (counts.get(a.movement) ?? 0) + 1);
}
if (associates.length !== PINNED_TOTAL) {
  errors.push(
    `total associates changed: expected ${PINNED_TOTAL}, got ${associates.length}`,
  );
}
for (const [school, expected] of Object.entries(PINNED_COUNTS)) {
  const got = counts.get(school) ?? 0;
  if (got !== expected) {
    errors.push(`${school}: expected ${expected} associates, got ${got}`);
  }
}
for (const school of counts.keys()) {
  if (!(school in PINNED_COUNTS)) {
    errors.push(`unpinned school in associates: ${school}`);
  }
}
for (const a of associates) {
  const anchor = PINNED_ANCHORS[a.movement];
  if (anchor && a.anchor !== anchor) {
    errors.push(
      `${a.name}: anchor changed (expected "${anchor}", got "${a.anchor}")`,
    );
  }
}

// ---------------------------------------------------------------------
// 2. Exact teacher-leg snapshot, order-free.
// ---------------------------------------------------------------------
const actualLegs: Leg[] = associates
  .filter((a) => a.teacher !== undefined)
  .map((a): Leg => [a.name, a.teacher as string, a.teacherAsserted === true]);
const key = (l: Leg) => JSON.stringify(l);
const pinnedLegSet = new Set(PINNED_LEGS.map(key));
const actualLegSet = new Set(actualLegs.map(key));
if (actualLegs.length !== PINNED_LEGS.length) {
  errors.push(
    `teacher leg count changed: expected ${PINNED_LEGS.length}, got ${actualLegs.length}`,
  );
}
for (const k of pinnedLegSet) {
  if (!actualLegSet.has(k)) errors.push(`missing pinned teacher leg: ${k}`);
}
for (const k of actualLegSet) {
  if (!pinnedLegSet.has(k)) errors.push(`unpinned new teacher leg: ${k}`);
}

// ---------------------------------------------------------------------
// 3. Hedged roster entries.
// ---------------------------------------------------------------------
const hedged = associates
  .filter((a) => !a.asserted)
  .map((a) => a.name)
  .sort();
if (JSON.stringify(hedged) !== JSON.stringify([...PINNED_HEDGED].sort())) {
  errors.push(
    `hedged associates changed: expected ${JSON.stringify(PINNED_HEDGED)}, got ${JSON.stringify(hedged)}`,
  );
}

// ---------------------------------------------------------------------
// 4. Structural joins: sectionId resolves, no KG-name collisions,
//    every teacher is drawable.
// ---------------------------------------------------------------------
const associateNames = new Set(associates.map((a) => a.name));
if (associateNames.size !== associates.length) {
  errors.push("duplicate associate names in the roster");
}
for (const a of associates) {
  if (!a.sectionId) {
    errors.push(`${a.name}: ref "${a.ref}" resolves to no section`);
  }
  if (kgNames.has(a.name)) {
    errors.push(
      `${a.name}: associate name collides with a KG node (double-drawn)`,
    );
  }
  if (a.teacher && !kgNames.has(a.teacher) && !associateNames.has(a.teacher)) {
    errors.push(
      `${a.name}: teacher "${a.teacher}" is neither a KG node nor an associate`,
    );
  }
}

if (errors.length) {
  console.error(`validate-graph-associates: ${errors.length} error(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `validate-graph-associates OK: ${associates.length} associates ` +
    `(stoa ${counts.get("stoa")}, epicurean ${counts.get("epicurean")}, ` +
    `sceptic ${counts.get("sceptic")}, academy ${counts.get("academy")}), ` +
    `${actualLegs.length} teacher legs, ${hedged.length} hedged pinned`,
);
