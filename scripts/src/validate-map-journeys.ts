/**
 * Validates the Map page's life-journey shapes straight from the
 * itinerary builder (map.ts getItineraries, the exact builder
 * /api/map/itineraries serves), replaying the frontend's drawing rules
 * (map.tsx): consecutive same-place claims collapse into one numbered
 * stop, a stop is hedged when none of its claims are asserted, a
 * candidate leg is skipped when both ends share coordinates, rival
 * same-kind birth/death legs (two reported birthplaces, two competing
 * deathplaces) are suppressed, and a drawn leg is dashed when either
 * end is hedged.
 *
 * Against the pins in map-journey-pins.ts it checks, per philosopher:
 *
 * 1. The exact ordered stop list as [property, place, hedged] triples,
 *    so a claims edit that adds, drops, reorders, or re-hedges a stop
 *    fails with the philosopher and stop named.
 * 2. The dashed legs and the suppressed rival legs, so a certainty
 *    change that silently un-dashes a leg (or joins rival accounts)
 *    is caught at validation time, not in a browser run.
 * 3. That no journey appears or disappears unpinned, and that every
 *    stop still resolves a sectionId from its ref.
 *
 * A deliberate claims change requires updating the pins. The live
 * browser check (e2e-map-journey) keeps its role of confirming the
 * frontend really renders Plato's pinned shape.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-map-journeys
 */
import path from "node:path";

import { PINNED_JOURNEYS, PINNED_JOURNEY_COUNT } from "./map-journey-pins";
import { PINNED_PLACE_COORDS, PINNED_PLACE_COUNT } from "./map-place-pins";
import { journeyShapeOf, type ShapeStop } from "./map-journey-shape";
import { compareJourneyShapeToPin } from "./map-journey-shape";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getItineraries } = await import(
  "../../artifacts/api-server/src/lib/map"
);
type Itinerary = ReturnType<typeof getItineraries>[number];
type ItineraryStop = Itinerary["stops"][number];

const errors: string[] = [];

/** Replays the frontend's stop merge and leg rules (map.tsx), via the
 * shared module also used by smoke-ionos-bundle against the booted
 * bundle's served /api/map/itineraries. */
function shapeOf(it: Itinerary) {
  return journeyShapeOf(it.stops as ShapeStop[]);
}

const itineraries = getItineraries();

// ---------------------------------------------------------------------
// 1. No journey appears or disappears unpinned.
// ---------------------------------------------------------------------
if (itineraries.length !== PINNED_JOURNEY_COUNT) {
  errors.push(
    `journey count changed: expected ${PINNED_JOURNEY_COUNT}, got ${itineraries.length}`,
  );
}
const actualNames = new Set(itineraries.map((i) => i.philosopher));
for (const name of Object.keys(PINNED_JOURNEYS)) {
  if (!actualNames.has(name)) {
    errors.push(`${name}: pinned journey no longer built`);
  }
}
for (const name of actualNames) {
  if (!(name in PINNED_JOURNEYS)) {
    errors.push(`${name}: new journey is not pinned yet`);
  }
}

// ---------------------------------------------------------------------
// 2. Per-philosopher stop list, dashed legs, suppressed rival legs.
// ---------------------------------------------------------------------
let dashedTotal = 0;
let suppressedTotal = 0;
for (const it of itineraries) {
  const pinned = PINNED_JOURNEYS[it.philosopher];
  if (!pinned) continue;
  const shape = shapeOf(it);
  dashedTotal += shape.dashedLegs.length;
  suppressedTotal += shape.suppressedLegs.length;

  errors.push(...compareJourneyShapeToPin(it.philosopher, shape, pinned));

  for (const m of shape.missingSectionIds) {
    errors.push(`${it.philosopher}: stop resolves no section: ${m}`);
  }
}

// ---------------------------------------------------------------------
// 3. Place coordinate pins stay in lockstep with the source: every place
//    getMapPlaces() serves (claim places from place-coords.ts plus
//    mention-only places from place-mentions.ts) must have a matching
//    human-reviewed pin in map-place-pins.ts, and no pin may go stale.
//    The smoke test compares the SERVED coordinates against the same
//    pins; this side keeps the pin table honest against the source, so a
//    curated coordinate correction for ANY map marker place must update
//    PINNED_PLACE_COORDS too (and a pin typo is caught immediately).
// ---------------------------------------------------------------------
const { getMapPlaces } = await import(
  "../../artifacts/api-server/src/lib/map"
);
const sourcePlaces = getMapPlaces();
if (sourcePlaces.length !== PINNED_PLACE_COUNT) {
  errors.push(
    `place count changed: map-place-pins.ts pins ${PINNED_PLACE_COUNT}, ` +
      `getMapPlaces() builds ${sourcePlaces.length} - update the pin table ` +
      `and PINNED_PLACE_COUNT if the change is deliberate`,
  );
}
const sourceLabels = new Set<string>();
for (const p of sourcePlaces) {
  sourceLabels.add(p.label);
  const pin = PINNED_PLACE_COORDS[p.label];
  if (!pin) {
    errors.push(
      `${p.label}: served map place has no coordinate pin in map-place-pins.ts`,
    );
    continue;
  }
  if (pin[0] !== p.lat || pin[1] !== p.lon) {
    errors.push(
      `${p.label}: coordinate pin [${pin[0]}, ${pin[1]}] does not match ` +
        `the source [${p.lat}, ${p.lon}] - update PINNED_PLACE_COORDS ` +
        `if the correction is deliberate`,
    );
  }
}
for (const place of Object.keys(PINNED_PLACE_COORDS)) {
  if (!sourceLabels.has(place)) {
    errors.push(
      `${place}: pinned coordinates but no map place carries that label any more - drop the stale pin`,
    );
  }
}
// Positive control: every journey stop's place must be covered by the
// full pin table (a stop place can only come from the same served list).
for (const j of Object.values(PINNED_JOURNEYS)) {
  for (const [, place] of j.stops) {
    if (!PINNED_PLACE_COORDS[place]) {
      errors.push(`${place}: journey stop place has no coordinate pin`);
    }
  }
}

if (errors.length) {
  console.error(`validate-map-journeys: ${errors.length} error(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
const stopTotal = itineraries.reduce(
  (n, it) => n + shapeOf(it).stops.length,
  0,
);
console.log(
  `validate-map-journeys OK: ${itineraries.length} journeys, ` +
    `${stopTotal} merged stops, ${dashedTotal} dashed legs, ` +
    `${suppressedTotal} suppressed rival legs pinned`,
);
