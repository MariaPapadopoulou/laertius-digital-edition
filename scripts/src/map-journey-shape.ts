/**
 * Shared replay of the Map page's life-journey drawing rules (map.tsx),
 * used by BOTH validate-map-journeys (against the source getItineraries()
 * builder) and smoke-ionos-bundle (against the booted bundle's served
 * /api/map/itineraries), so the two checks can never disagree on what a
 * journey's drawn shape is: consecutive same-place claims collapse into
 * one numbered stop, a stop is hedged when none of its claims are
 * asserted, a candidate leg is skipped when both ends share coordinates,
 * rival same-kind birth/death legs are suppressed, and a drawn leg is
 * dashed when either end is hedged.
 */
import type { PinnedJourney, PinnedStop } from "./map-journey-pins";

/** The minimal stop fields the drawing-rule replay needs. */
export interface ShapeStop {
  place: string;
  lat: number;
  lon: number;
  property: string;
  certainty: string;
  ref: string;
  sectionId?: string | null;
}

interface MergedStop {
  place: string;
  lat: number;
  lon: number;
  entries: ShapeStop[];
}

export interface JourneyShape {
  stops: PinnedStop[];
  dashedLegs: string[];
  suppressedLegs: string[];
  missingSectionIds: string[];
}

/** Replays the frontend's stop merge and leg rules (map.tsx). */
export function journeyShapeOf(stops: ShapeStop[]): JourneyShape {
  const merged: MergedStop[] = [];
  for (const e of stops) {
    const last = merged[merged.length - 1];
    if (last && last.place === e.place) last.entries.push(e);
    else {
      merged.push({ place: e.place, lat: e.lat, lon: e.lon, entries: [e] });
    }
  }
  const hedged = merged.map((s) =>
    s.entries.every((e) => e.certainty !== "asserted"),
  );
  const dashedLegs: string[] = [];
  const suppressedLegs: string[] = [];
  for (let i = 1; i < merged.length; i++) {
    const a = merged[i - 1];
    const b = merged[i];
    const leg = `${a.place}->${b.place}`;
    if (a.lat === b.lat && a.lon === b.lon) {
      suppressedLegs.push(leg);
      continue;
    }
    const aProp = a.entries[0].property;
    const bProp = b.entries[0].property;
    if (aProp === bProp && (aProp === "birthPlace" || aProp === "deathPlace")) {
      suppressedLegs.push(leg);
      continue;
    }
    if (hedged[i - 1] || hedged[i]) dashedLegs.push(leg);
  }
  const missingSectionIds = stops
    .filter((s) => !s.sectionId)
    .map((s) => `${s.place} (ref ${s.ref})`);
  return {
    stops: merged.map(
      (s, i): PinnedStop => [s.entries[0].property, s.place, hedged[i]],
    ),
    dashedLegs,
    suppressedLegs,
    missingSectionIds,
  };
}

export const journeyStopKey = (s: PinnedStop): string =>
  `${s[0]} ${s[1]}${s[2] ? " (hedged)" : ""}`;

/**
 * Compares one journey's replayed shape against its pin, returning
 * human-readable drift messages that name the philosopher and the exact
 * stop or leg that drifted (empty array when the shape matches).
 */
export function compareJourneyShapeToPin(
  philosopher: string,
  shape: JourneyShape,
  pinned: PinnedJourney,
): string[] {
  const errors: string[] = [];
  const n = Math.max(shape.stops.length, pinned.stops.length);
  if (shape.stops.length !== pinned.stops.length) {
    errors.push(
      `${philosopher}: stop count changed ` +
        `(expected ${pinned.stops.length}, got ${shape.stops.length})`,
    );
  }
  for (let i = 0; i < n; i++) {
    const want = pinned.stops[i];
    const got = shape.stops[i];
    if (!want) {
      errors.push(
        `${philosopher}: unpinned new stop ${i + 1}: ${journeyStopKey(got)}`,
      );
    } else if (!got) {
      errors.push(
        `${philosopher}: pinned stop ${i + 1} missing: ${journeyStopKey(want)}`,
      );
    } else if (want[0] !== got[0] || want[1] !== got[1] || want[2] !== got[2]) {
      errors.push(
        `${philosopher}: stop ${i + 1} drifted ` +
          `(expected "${journeyStopKey(want)}", got "${journeyStopKey(got)}")`,
      );
    }
  }
  const cmpLegs = (kind: string, want: string[], got: string[]) => {
    const wantSet = new Set(want);
    const gotSet = new Set(got);
    for (const l of want) {
      if (!gotSet.has(l)) {
        errors.push(`${philosopher}: ${kind} leg lost: ${l}`);
      }
    }
    for (const l of got) {
      if (!wantSet.has(l)) {
        errors.push(`${philosopher}: unpinned new ${kind} leg: ${l}`);
      }
    }
  };
  cmpLegs("dashed", pinned.dashedLegs, shape.dashedLegs);
  cmpLegs("suppressed rival", pinned.suppressedLegs, shape.suppressedLegs);
  return errors;
}
