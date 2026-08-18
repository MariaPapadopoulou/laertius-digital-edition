import { KG_CLAIMS, type Certainty, type ClaimProperty } from "./kg-claims";
import { PLACE_COORDS } from "./place-coords";
import { PLACE_QIDS } from "./entity-links";
import { PLACE_PLEIADES } from "./place-pleiades";
import { PLACE_LOCATED_IN, PLACE_TYPES, type PlaceType } from "./place-ontology";
import { MENTION_PLACES } from "./place-mentions";
import { sectionIdForRef } from "./claims-answer";
import { corpus } from "./corpus";
import { annotateSection } from "./annotate";
import { placeUri } from "./lod";

/** Claim properties whose value is a place - the map's event types. */
export type MapEventProperty =
  | "birthPlace"
  | "deathPlace"
  | "livedIn"
  | "traveledTo";

const PLACE_PROPS: ReadonlySet<ClaimProperty> = new Set<ClaimProperty>([
  "birthPlace",
  "deathPlace",
  "livedIn",
  "traveledTo",
]);

/**
 * One of D.L.'s recorded accounts of how a philosopher died, joined from
 * the mannerOfDeath claims. He often records several rival versions
 * (Empedocles has six) - all are kept, each with its own hedging.
 */
export interface MapDeathAccount {
  value: string;
  certainty: Certainty;
  accordingTo?: string;
  ref: string;
  sectionId?: string;
}

export interface MapPlaceEvent {
  philosopher: string;
  property: MapEventProperty;
  certainty: Certainty;
  accordingTo?: string;
  ref: string;
  sectionId?: string;
  /** For deathPlace events: every manner-of-death account D.L. records. */
  deathAccounts?: MapDeathAccount[];
}

/** A passage where the tagger found the place named in the text. */
export interface MapPlaceMention {
  sectionId: string;
  /** Occurrences within the section (usually 1). */
  count: number;
}

export interface MapPlace {
  label: string;
  qid?: string;
  /** Curated Pleiades gazetteer id (place-pleiades.ts). */
  pleiades?: string;
  /** Curated ontology type (place-ontology.ts). */
  placeType: PlaceType;
  /** Curated containing place label, when asserted (place-ontology.ts). */
  locatedIn?: string;
  lat: number;
  lon: number;
  events: MapPlaceEvent[];
  mentions: MapPlaceMention[];
}

let cached: MapPlace[] | null = null;

/** Fail-fast like lod.ts: the curated ontology must cover every place. */
function placeTypeOf(label: string): PlaceType {
  const t = PLACE_TYPES[label];
  if (!t) {
    throw new Error(`place-ontology: no curated type for place "${label}"`);
  }
  return t;
}

/**
 * Text mentions per place node, from the deterministic occurrence
 * tagger (annotate.ts): place URI -> section id -> occurrence count,
 * in corpus order. Covers claim places and mention-only places alike  - 
 * the tagger works off the LOD graph, which carries both.
 */
function mentionIndex(): Map<string, MapPlaceMention[]> {
  const bySection = new Map<string, Map<string, number>>();
  for (const s of corpus) {
    for (const a of annotateSection(s)) {
      if (a.kind !== "place") continue;
      let m = bySection.get(a.entityUri);
      if (!m) {
        m = new Map();
        bySection.set(a.entityUri, m);
      }
      m.set(s.id, (m.get(s.id) ?? 0) + 1);
    }
  }
  const order = new Map(corpus.map((s, i) => [s.id, i]));
  const out = new Map<string, MapPlaceMention[]>();
  for (const [uri, m] of bySection) {
    out.set(
      uri,
      [...m.entries()]
        .sort((a, b) => order.get(a[0])! - order.get(b[0])!)
        .map(([sectionId, count]) => ({ sectionId, count })),
    );
  }
  return out;
}

/**
 * Manner-of-death accounts per philosopher, in source order (the per-book
 * claim files preserve D.L.'s narrative order), asserted accounts first.
 */
function deathAccountIndex(): Map<string, MapDeathAccount[]> {
  const out = new Map<string, MapDeathAccount[]>();
  for (const c of KG_CLAIMS) {
    if (c.property !== "mannerOfDeath") continue;
    let list = out.get(c.subject);
    if (!list) {
      list = [];
      out.set(c.subject, list);
    }
    list.push({
      value: c.value,
      certainty: c.certainty,
      accordingTo: c.accordingTo,
      ref: c.ref,
      sectionId: sectionIdForRef(c.ref, c.subject),
    });
  }
  for (const list of out.values()) {
    list.sort(
      (a, b) =>
        Number(b.certainty === "asserted") - Number(a.certainty === "asserted"),
    );
  }
  return out;
}

/** One cited stop on a philosopher's life journey. */
export interface MapItineraryStop {
  /** Place label - joins to MapPlace.label. */
  place: string;
  lat: number;
  lon: number;
  property: MapEventProperty;
  certainty: Certainty;
  accordingTo?: string;
  ref: string;
  sectionId?: string;
}

export interface MapItinerary {
  philosopher: string;
  /**
   * Ordered journey: birthplace(s) first, then residences and travels
   * in D.L.'s narrative order, deathplace(s) last.
   */
  stops: MapItineraryStop[];
  /** Distinct places along the journey. */
  placeCount: number;
}

let cachedItineraries: MapItinerary[] | null = null;

/**
 * Per-philosopher life journeys, joined from the located place claims:
 * birthplace(s) first, then residences and travels in the order D.L.
 * gives them (the per-book claim files preserve his narrative order),
 * deathplace(s) last. Only philosophers whose cited events span at
 * least two distinct places qualify - a single located event is a pin,
 * not a journey. Rival accounts (disputed birthplaces, competing
 * deathplaces) are kept as stops with their own hedging, like
 * everywhere else in the claims layer.
 */
export function getItineraries(): MapItinerary[] {
  if (cachedItineraries) return cachedItineraries;
  const byPhilosopher = new Map<
    string,
    {
      births: MapItineraryStop[];
      middle: MapItineraryStop[];
      deaths: MapItineraryStop[];
    }
  >();
  for (const c of KG_CLAIMS) {
    if (!PLACE_PROPS.has(c.property)) continue;
    const coord = PLACE_COORDS[c.value];
    if (!coord) continue;
    let g = byPhilosopher.get(c.subject);
    if (!g) {
      g = { births: [], middle: [], deaths: [] };
      byPhilosopher.set(c.subject, g);
    }
    const stop: MapItineraryStop = {
      place: c.value,
      lat: coord.lat,
      lon: coord.lon,
      property: c.property as MapEventProperty,
      certainty: c.certainty,
      accordingTo: c.accordingTo,
      ref: c.ref,
      sectionId: sectionIdForRef(c.ref, c.subject),
    };
    if (c.property === "birthPlace") g.births.push(stop);
    else if (c.property === "deathPlace") g.deaths.push(stop);
    else g.middle.push(stop);
  }
  const out: MapItinerary[] = [];
  for (const [philosopher, g] of byPhilosopher) {
    const stops = [...g.births, ...g.middle, ...g.deaths];
    const places = new Set(stops.map((s) => s.place));
    if (places.size < 2) continue;
    out.push({ philosopher, stops, placeCount: places.size });
  }
  out.sort(
    (a, b) =>
      b.stops.length - a.stops.length ||
      a.philosopher.localeCompare(b.philosopher),
  );
  cachedItineraries = out;
  return out;
}

/**
 * Every place with curated coordinates: claim-value places (the cited
 * life events located there) plus the curated mention-only places
 * (place-mentions.ts, events always empty). Both carry the passages
 * where the text names them. Sorted busiest first: by event count,
 * then mention count.
 */
export function getMapPlaces(): MapPlace[] {
  if (cached) return cached;
  const mentions = mentionIndex();
  const deathAccounts = deathAccountIndex();
  const byLabel = new Map<string, MapPlace>();
  for (const c of KG_CLAIMS) {
    if (!PLACE_PROPS.has(c.property)) continue;
    const coord = PLACE_COORDS[c.value];
    if (!coord) continue;
    let place = byLabel.get(c.value);
    if (!place) {
      place = {
        label: c.value,
        qid: PLACE_QIDS[c.value],
        ...(PLACE_PLEIADES[c.value]
          ? { pleiades: PLACE_PLEIADES[c.value] }
          : {}),
        placeType: placeTypeOf(c.value),
        ...(PLACE_LOCATED_IN[c.value]
          ? { locatedIn: PLACE_LOCATED_IN[c.value] }
          : {}),
        lat: coord.lat,
        lon: coord.lon,
        events: [],
        mentions: mentions.get(placeUri(c.value)) ?? [],
      };
      byLabel.set(c.value, place);
    }
    const accounts =
      c.property === "deathPlace" ? deathAccounts.get(c.subject) : undefined;
    place.events.push({
      philosopher: c.subject,
      property: c.property as MapEventProperty,
      certainty: c.certainty,
      accordingTo: c.accordingTo,
      ref: c.ref,
      sectionId: sectionIdForRef(c.ref, c.subject),
      ...(accounts && accounts.length > 0 ? { deathAccounts: accounts } : {}),
    });
  }
  for (const m of MENTION_PLACES) {
    // Curation invariant: mention places never duplicate claim places
    // (place-mentions.ts documents the skips). Keep the claim place if
    // a collision ever slips in - its events must not be overwritten.
    if (byLabel.has(m.label)) continue;
    byLabel.set(m.label, {
      label: m.label,
      ...(m.qid ? { qid: m.qid } : {}),
      ...(PLACE_PLEIADES[m.label] ? { pleiades: PLACE_PLEIADES[m.label] } : {}),
      placeType: placeTypeOf(m.label),
      ...(PLACE_LOCATED_IN[m.label]
        ? { locatedIn: PLACE_LOCATED_IN[m.label] }
        : {}),
      lat: m.lat,
      lon: m.lon,
      events: [],
      mentions: mentions.get(placeUri(m.label)) ?? [],
    });
  }
  cached = [...byLabel.values()].sort(
    (a, b) =>
      b.events.length - a.events.length ||
      b.mentions.length - a.mentions.length ||
      a.label.localeCompare(b.label),
  );
  return cached;
}
