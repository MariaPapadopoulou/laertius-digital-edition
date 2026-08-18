import { usePageTitle } from "@/lib/use-page-title";
import { AboutLink } from "@/components/about-link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  useListMapPlaces,
  getListMapPlacesQueryKey,
  useListMapItineraries,
  getListMapItinerariesQueryKey,
  type MapPlace,
  type MapItineraryStop,
} from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
import { useResetOnSamePageNav } from "@/hooks/use-reset-on-same-page-nav";
import { SortableTh, sortRows, useTableSort } from "@/components/sortable-table";

/**
 * Colors and labels per life-event kind. A place's marker takes the
 * color of its dominant event kind (ties resolved in this order).
 */
const EVENT_META: Record<
  string,
  { label: string; plural: string; color: string; chip: string }
> = {
  birthPlace: {
    label: "Born here",
    plural: "Births",
    color: "#059669",
    chip: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
  },
  deathPlace: {
    label: "Died here",
    plural: "Deaths",
    color: "#e11d48",
    chip: "bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200",
  },
  livedIn: {
    label: "Lived here",
    plural: "Residences",
    color: "#d97706",
    chip: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
  },
  traveledTo: {
    label: "Traveled here",
    plural: "Travels",
    color: "#0284c7",
    chip: "bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200",
  },
};

const PLACE_TYPE_LABEL: Record<string, string> = {
  city: "City",
  island: "Island",
  region: "Region",
  deme: "Attic deme",
  landmark: "Landmark",
  naturalFeature: "Natural feature",
  place: "Place",
};

const EVENT_ORDER = ["birthPlace", "deathPlace", "livedIn", "traveledTo"];

/** Stop labels for the journey view. */
const STOP_LABEL: Record<string, string> = {
  birthPlace: "Born in",
  deathPlace: "Died in",
  livedIn: "Lived in",
  traveledTo: "Traveled to",
};

/** A numbered journey stop: consecutive same-place claims collapsed. */
interface JourneyStop {
  place: string;
  lat: number;
  lon: number;
  entries: MapItineraryStop[];
}

/**
 * Marker style for mention-only places: mentioned in the text, but no
 * cited life event locates anyone there.
 */
const MENTION_META = {
  label: "Mentioned in the text",
  plural: "Mentions",
  color: "#64748b",
};

const CERTAINTY_BADGE: Record<string, string> = {
  asserted: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
  reported: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
  disputed: "bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200",
  conjectured: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
};

/** Marker color: dominant event kind, or the mention grey when no events. */
function markerColor(place: MapPlace): string {
  if (place.events.length === 0) return MENTION_META.color;
  const counts = new Map<string, number>();
  for (const e of place.events) {
    counts.set(e.property, (counts.get(e.property) ?? 0) + 1);
  }
  let best = EVENT_ORDER[0];
  let bestN = -1;
  for (const k of EVENT_ORDER) {
    const n = counts.get(k) ?? 0;
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return EVENT_META[best].color;
}

function mentionCount(place: MapPlace): number {
  // `?? []` guards against stale cached responses from before the
  // mentions field existed.
  return (place.mentions ?? []).reduce((n, m) => n + m.count, 0);
}

export default function MapPage() {
  usePageTitle("Map of the Lives");
  const { data: places, isLoading } = useListMapPlaces({
    query: { queryKey: getListMapPlacesQueryKey() },
  });
  // Selected place, read from ?place= so a shared link reopens the same
  // place panel.
  const [selected, setSelected] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("place") || null,
  );
  // Optional philosopher focus, read from ?p= (e.g. arriving from a
  // philosopher's "Map" link). When set, the places with one of that
  // philosopher's cited life events are highlighted and the rest dimmed.
  const [focusPhilosopher, setFocusPhilosopher] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("p") || null,
  );
  const { data: itineraries } = useListMapItineraries({
    query: { queryKey: getListMapItinerariesQueryKey() },
  });
  // Life-journey mode, read from ?journey= - draws the philosopher's
  // itinerary (birth → residences/travels → death) as a numbered route.
  const [journey, setJourney] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("journey") || null,
  );
  const journeyLayerRef = useRef<L.LayerGroup | null>(null);
  // Legend filter: empty set = show everything. "mention" stands for
  // the grey mention-only places.
  // Initialized from ?kinds= (comma-separated) so a narrowed map is
  // shareable / reloadable.
  const [activeKinds, setActiveKinds] = useState<Set<string>>(() => {
    const raw = new URLSearchParams(window.location.search).get("kinds");
    return new Set(raw ? raw.split(",").filter(Boolean) : []);
  });
  // "Show names": when on, every visible place marker carries a
  // permanent name label instead of a hover-only tooltip. ?names=1.
  const [showNames, setShowNames] = useState(
    () => new URLSearchParams(window.location.search).get("names") === "1",
  );
  // Accessible alternative: "list" swaps the Leaflet canvas for a
  // semantic table of the same places plus structured journey lists,
  // navigable by keyboard and screen reader. Initialized from ?view=
  // so the list view is shareable / reloadable, like the graph's.
  const [view, setView] = useState<"map" | "list">(() =>
    new URLSearchParams(window.location.search).get("view") === "list"
      ? "list"
      : "map",
  );
  const mapDiv = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());

  // Clicking the "Map" nav link while already here starts fresh: clear the
  // selection, focus, journey, legend filter, and the "Show names" labels,
  // and re-frame the map on its default view. (Links carrying ?p= or
  // ?journey= have a query string and are not affected.)
  useResetOnSamePageNav(() => {
    setSelected(null);
    setFocusPhilosopher(null);
    setJourney(null);
    setActiveKinds(new Set());
    setShowNames(false);
    setView("map");
    mapRef.current?.setView([38.5, 25], 5);
  });

  const toggleKind = (kind: string) => {
    setActiveKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const visiblePlaces = useMemo(() => {
    if (!places) return [];
    if (activeKinds.size === 0) return places;
    return places.filter((p) => {
      if (p.events.length === 0) return activeKinds.has("mention");
      return p.events.some((e) => activeKinds.has(e.property));
    });
  }, [places, activeKinds]);

  const selectedPlace = useMemo(
    () => places?.find((p) => p.label === selected) ?? null,
    [places, selected],
  );

  // Labels of places where the focused philosopher has a cited life event.
  // null when no philosopher is focused; an empty set means the philosopher
  // has no place-located events in the corpus.
  const focusLabels = useMemo(() => {
    if (!focusPhilosopher || !places) return null;
    const set = new Set<string>();
    for (const p of places) {
      if (p.events.some((e) => e.philosopher === focusPhilosopher)) {
        set.add(p.label);
      }
    }
    return set;
  }, [focusPhilosopher, places]);

  const activeItinerary = useMemo(
    () => itineraries?.find((i) => i.philosopher === journey) ?? null,
    [itineraries, journey],
  );

  // Numbered journey stops: consecutive claims at the same place merge
  // into one stop that keeps every citation. Numbers match the map.
  const journeyStops = useMemo<JourneyStop[]>(() => {
    if (!activeItinerary) return [];
    const out: JourneyStop[] = [];
    for (const s of activeItinerary.stops) {
      const last = out[out.length - 1];
      if (last && last.place === s.place) {
        last.entries.push(s);
        continue;
      }
      out.push({ place: s.place, lat: s.lat, lon: s.lon, entries: [s] });
    }
    return out;
  }, [activeItinerary]);

  const journeyLabels = useMemo(
    () =>
      activeItinerary
        ? new Set(activeItinerary.stops.map((s) => s.place))
        : null,
    [activeItinerary],
  );

  // Sidebar order: with a philosopher focused, their places float to the top
  // (stable sort keeps the busiest-first order within each group).
  const placeSort = useTableSort<
    "place" | "type" | "events" | "mentions" | "links"
  >();
  const sidebarPlaces = useMemo(() => {
    if (!focusLabels || focusLabels.size === 0) return visiblePlaces;
    return [...visiblePlaces].sort(
      (a, b) =>
        Number(focusLabels.has(b.label)) - Number(focusLabels.has(a.label)),
    );
  }, [visiblePlaces, focusLabels]);

  // Keep ?p= in sync so the focused view is shareable / reloadable.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (focusPhilosopher) url.searchParams.set("p", focusPhilosopher);
    else url.searchParams.delete("p");
    window.history.replaceState(null, "", url);
  }, [focusPhilosopher]);

  // Keep ?journey= in sync so a drawn journey is shareable / reloadable.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (journey) url.searchParams.set("journey", journey);
    else url.searchParams.delete("journey");
    window.history.replaceState(null, "", url);
  }, [journey]);

  // Keep ?place= in sync so an opened place panel is shareable / reloadable.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selected) url.searchParams.set("place", selected);
    else url.searchParams.delete("place");
    if (url.href !== window.location.href) {
      window.history.replaceState(null, "", url);
    }
  }, [selected]);

  // Keep ?kinds= in sync so a legend-narrowed map is shareable / reloadable.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeKinds.size > 0) {
      url.searchParams.set("kinds", [...activeKinds].sort().join(","));
    } else {
      url.searchParams.delete("kinds");
    }
    if (url.href !== window.location.href) {
      window.history.replaceState(null, "", url);
    }
  }, [activeKinds]);

  // Keep ?names= in sync so the permanent-labels mode survives sharing.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (showNames) url.searchParams.set("names", "1");
    else url.searchParams.delete("names");
    if (url.href !== window.location.href) {
      window.history.replaceState(null, "", url);
    }
  }, [showNames]);

  // When the search string changes from outside this page's own sync
  // effects (browser back/forward, a link with ?view=list or ?p=), adopt
  // the URL's state so the page always matches what the URL says.
  const search = useSearch();
  useEffect(() => {
    const params = new URLSearchParams(search);
    const v = params.get("view") === "list" ? "list" : "map";
    setView((cur) => (cur === v ? cur : v));
    const p = params.get("p") || null;
    setFocusPhilosopher((cur) => (cur === p ? cur : p));
    const j = params.get("journey") || null;
    setJourney((cur) => (cur === j ? cur : j));
    const pl = params.get("place") || null;
    // Do not resurrect a selection that the legend filter is hiding: the
    // hide-selection effect below would clear it again, and the two
    // effects would ping-pong through the URL sync into an infinite
    // update loop. (visiblePlaces/journeyLabels are in the deps; the
    // guarded setters make extra runs no-ops.)
    const placeAdoptable =
      pl === null ||
      !places ||
      journeyLabels?.has(pl) ||
      visiblePlaces.some((p) => p.label === pl);
    if (placeAdoptable) {
      setSelected((cur) => (cur === pl ? cur : pl));
    } else {
      // A loaded, non-journey place hidden by the kinds filter: drop the
      // stale ?place= so the URL matches the (panel-less) UI instead of
      // carrying an unadoptable parameter through reloads/navigation.
      const url = new URL(window.location.href);
      url.searchParams.delete("place");
      if (url.href !== window.location.href) {
        window.history.replaceState(null, "", url);
      }
    }
    const kindsRaw = params.get("kinds");
    const kinds = new Set(kindsRaw ? kindsRaw.split(",").filter(Boolean) : []);
    setActiveKinds((cur) => {
      if (cur.size === kinds.size && [...kinds].every((k) => cur.has(k))) {
        return cur;
      }
      return kinds;
    });
    const names = params.get("names") === "1";
    setShowNames((cur) => (cur === names ? cur : names));
  }, [search]);

  // Keep ?view= in sync so the accessible list view is shareable /
  // reloadable, consistent with the graph page's ?view=list.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (view === "list") url.searchParams.set("view", "list");
    else url.searchParams.delete("view");
    if (url.href !== window.location.href) {
      window.history.replaceState(null, "", url);
    }
  }, [view]);

  // Drop the selection if the filter hides the selected place - unless
  // it is a stop of the drawn journey (journey markers stay clickable
  // regardless of the legend filter).
  useEffect(() => {
    if (!places) return; // still loading: keep a ?place= restored selection
    if (
      selected &&
      !visiblePlaces.some((p) => p.label === selected) &&
      !journeyLabels?.has(selected)
    ) {
      setSelected(null);
    }
  }, [places, visiblePlaces, selected, journeyLabels]);

  useEffect(() => {
    if (!mapDiv.current || mapRef.current) return;
    const map = L.map(mapDiv.current, {
      center: [38.5, 25],
      zoom: 5,
      minZoom: 3,
      maxZoom: 10,
      scrollWheelZoom: true,
      worldCopyJump: false,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      journeyLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !places) return;
    for (const m of markersRef.current.values()) {
      // A permanent "Show names" tooltip is its own map layer; removing
      // the marker alone can leave the label orphaned on the map.
      m.unbindTooltip();
      m.remove();
    }
    markersRef.current.clear();
    // Highlight set: a drawn journey wins over the ?p= focus.
    const highlightSet = journeyLabels ?? focusLabels;
    for (const p of visiblePlaces) {
      const color = markerColor(p);
      const mentionOnly = p.events.length === 0;
      // Focus state: true = this philosopher's place, false = dimmed,
      // null = no philosopher focused and no journey drawn.
      const focused = highlightSet ? highlightSet.has(p.label) : null;
      const baseRadius = mentionOnly
        ? 3 + Math.min(Math.sqrt(mentionCount(p)), 3)
        : 5 + Math.sqrt(p.events.length) * 3;
      // With names on and a journey drawn, the numbered stop marker at
      // the same coordinates carries its own permanent label; a second
      // permanent label on the circle marker would stack on top of it,
      // so stop places fall back to the hover-only tooltip.
      const labelledByStop = showNames && !!journeyLabels?.has(p.label);
      const marker = L.circleMarker([p.lat, p.lon], {
        radius: focused ? baseRadius + 2 : baseRadius,
        color: focused ? "#1e293b" : color,
        weight: focused ? 3 : focused === false ? 0.75 : mentionOnly ? 1 : 1.5,
        opacity: focused === false ? 0.3 : 1,
        fillColor: color,
        fillOpacity:
          focused === false ? 0.08 : focused ? 0.85 : mentionOnly ? 0.35 : 0.45,
      })
        .addTo(map)
        .bindTooltip(
          showNames && !labelledByStop
            ? p.label
            : mentionOnly
              ? `${p.label} · ${mentionCount(p)} mention${mentionCount(p) === 1 ? "" : "s"}`
              : `${p.label} · ${p.events.length}`,
          showNames && !labelledByStop
            ? {
                direction: "top",
                permanent: true,
                className: "map-name-label",
              }
            : { direction: "top" },
        )
        .on("click", () => setSelected(p.label));
      if (focused) marker.bringToFront();
      markersRef.current.set(p.label, marker);
    }
  }, [places, visiblePlaces, focusLabels, journeyLabels, showNames]);

  // Draw the active journey: numbered stop markers joined by ordered
  // legs. A leg is dashed when either end rests only on hedged accounts;
  // rival accounts of the same event (two reported birthplaces, two
  // competing deathplaces) are deliberately not joined by a leg.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Unbind permanent "Show names" tooltips before removing the layer,
    // or the stop labels can be orphaned on the map (same Leaflet quirk
    // as the circle-marker redraw above).
    journeyLayerRef.current?.eachLayer((l) => {
      if (l instanceof L.Marker) l.unbindTooltip();
    });
    journeyLayerRef.current?.remove();
    journeyLayerRef.current = null;
    if (journeyStops.length === 0) return;
    const layer = L.layerGroup();
    const hedged = journeyStops.map((s) =>
      s.entries.every((e) => e.certainty !== "asserted"),
    );
    for (let i = 1; i < journeyStops.length; i++) {
      const a = journeyStops[i - 1];
      const b = journeyStops[i];
      if (a.lat === b.lat && a.lon === b.lon) continue;
      const aProp = a.entries[0].property;
      const bProp = b.entries[0].property;
      if (
        aProp === bProp &&
        (aProp === "birthPlace" || aProp === "deathPlace")
      ) {
        continue;
      }
      L.polyline(
        [
          [a.lat, a.lon],
          [b.lat, b.lon],
        ],
        {
          color: "#1e293b",
          weight: 2,
          opacity: 0.7,
          ...(hedged[i - 1] || hedged[i] ? { dashArray: "6 6" } : {}),
        },
      ).addTo(layer);
    }
    journeyStops.forEach((s, i) => {
      const color = EVENT_META[s.entries[0].property].color;
      L.marker([s.lat, s.lon], {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:22px;height:22px;border-radius:9999px;background:${color};color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)">${i + 1}</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
        zIndexOffset: 1000,
      })
        .addTo(layer)
        .bindTooltip(
          showNames
            ? s.place
            : `${i + 1}. ${STOP_LABEL[s.entries[0].property]} ${s.place}`,
          showNames
            ? {
                direction: "top",
                permanent: true,
                className: "map-name-label",
                offset: [0, -11],
              }
            : { direction: "top" },
        )
        .on("click", () => setSelected(s.place));
    });
    layer.addTo(map);
    journeyLayerRef.current = layer;
  }, [journeyStops, showNames]);

  // Frame the map to the drawn journey.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || journeyStops.length === 0 || selected) return;
    const pts = journeyStops.map((s) => [s.lat, s.lon] as [number, number]);
    if (pts.length === 1) {
      map.setView(pts[0], 6);
    } else {
      map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 7 });
    }
    // Intentionally excludes `selected`: only frame on journey change, not
    // when the user later clicks or closes a marker (mirrors focus framing).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyStops]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPlace) return;
    map.panTo([selectedPlace.lat, selectedPlace.lon]);
    const marker = markersRef.current.get(selectedPlace.label);
    marker?.bringToFront();
  }, [selectedPlace]);

  // When focusing a philosopher, frame the map to their places -
  // unless a journey is drawn (its own framing wins).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusLabels || !places || selected || journeyLabels) return;
    const pts = places
      .filter((p) => focusLabels.has(p.label))
      .map((p) => [p.lat, p.lon] as [number, number]);
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.setView(pts[0], 6);
    } else {
      map.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 7 });
    }
    // Intentionally excludes `selected`: only frame on focus/data change,
    // not when the user later clicks a marker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusLabels, places, journeyLabels]);

  const grouped = useMemo(() => {
    if (!selectedPlace) return [];
    return EVENT_ORDER.map((k) => ({
      kind: k,
      events: selectedPlace.events.filter((e) => e.property === k),
    })).filter((g) => g.events.length > 0);
  }, [selectedPlace]);

  const totalEvents = visiblePlaces.reduce((n, p) => n + p.events.length, 0);
  const totalMentions = visiblePlaces.reduce((n, p) => n + mentionCount(p), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl md:text-4xl font-serif font-bold">
          Map of the <span className="italic">Lives</span>
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          Every place the <span className="italic">Lives</span> mention,
          plotted from the cited claims of the knowledge graph. Click a
          marker for the philosophers and passages behind it, or draw a
          philosopher's life journey.
        </p>
        <AboutLink anchor="knowledge-graph" label="About the knowledge graph" />
      </div>

      <div
        className="inline-flex rounded-lg border border-border bg-card p-0.5 text-sm"
        role="group"
        aria-label="Choose how to view the places and journeys"
        data-testid="map-view-toggle"
      >
        <button
          type="button"
          aria-pressed={view === "map"}
          onClick={() => setView("map")}
          data-testid="map-view-map"
          className={`px-3 py-1.5 rounded-md transition-colors ${
            view === "map"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Map
        </button>
        <button
          type="button"
          aria-pressed={view === "list"}
          onClick={() => setView("list")}
          data-testid="map-view-list"
          className={`px-3 py-1.5 rounded-md transition-colors ${
            view === "list"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          List
        </button>
      </div>

      {focusPhilosopher && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
          <span className="flex items-center gap-1.5">
            {focusLabels && focusLabels.size > 0 ? (
              <span>
                Highlighting the{" "}
                <span className="font-semibold">{focusLabels.size}</span> place
                {focusLabels.size === 1 ? "" : "s"} associated with{" "}
                <span className="font-semibold">{focusPhilosopher}</span>
              </span>
            ) : (
              <span>
                No mapped places for{" "}
                <span className="font-semibold">{focusPhilosopher}</span> - the
                text cites no located life events for this philosopher
              </span>
            )}
          </span>
          <Link
            href={`/graph?p=${encodeURIComponent(focusPhilosopher)}`}
            className="text-primary underline hover:text-foreground"
          >
            View in graph
          </Link>
          {itineraries?.some((i) => i.philosopher === focusPhilosopher) && (
            <button
              type="button"
              onClick={() => {
                setJourney(focusPhilosopher);
                setSelected(null);
              }}
              className="text-primary underline hover:text-foreground"
            >
              Draw life journey
            </button>
          )}
          <button
            type="button"
            onClick={() => setFocusPhilosopher(null)}
            className="text-muted-foreground underline hover:text-foreground"
          >
            Show all places
          </button>
        </div>
      )}

      {itineraries && itineraries.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label
            htmlFor="journey-select"
            className="text-muted-foreground"
          >
            Life journeys
          </label>
          <select
            id="journey-select"
            value={journey ?? ""}
            onChange={(e) => {
              setJourney(e.target.value || null);
              setSelected(null);
            }}
            className="border border-border rounded-md bg-card px-2 py-1.5 text-sm max-w-[300px]"
          >
            <option value="">Pick a philosopher…</option>
            {itineraries.map((i) => (
              <option key={i.philosopher} value={i.philosopher}>
                {i.philosopher} - {i.placeCount} place
                {i.placeCount === 1 ? "" : "s"}
              </option>
            ))}
          </select>
          {activeItinerary && (
            <button
              type="button"
              onClick={() => setJourney(null)}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Clear journey
            </button>
          )}
          {journey && itineraries && !activeItinerary && (
            <span className="text-xs text-muted-foreground">
              No mapped journey for “{journey}” - the text cites fewer than
              two located places
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
        {/* The legend filter chips live in this group so e2e sweeps can scope
            their aria-pressed checks here instead of the whole document
            (which would trip on persistent toggles like the Map/List view
            switch or a default-on names toggle). display:contents keeps the
            chips participating in the parent flex layout. */}
        <div data-testid="map-legend-chips" className="contents">
        {EVENT_ORDER.map((k) => {
          const active = activeKinds.has(k);
          const dimmed = activeKinds.size > 0 && !active;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={active}
              onClick={() => toggleKind(k)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full border transition-colors ${
                active
                  ? "border-transparent font-medium " + EVENT_META[k].chip
                  : `border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 ${
                      dimmed ? "opacity-50" : ""
                    }`
              }`}
            >
              <span
                className="inline-block w-3 h-3 rounded-full border"
                style={{ backgroundColor: `${EVENT_META[k].color}73`, borderColor: EVENT_META[k].color }}
              />
              {EVENT_META[k].plural}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={activeKinds.has("mention")}
          onClick={() => toggleKind("mention")}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-full border transition-colors ${
            activeKinds.has("mention")
              ? "border-transparent font-medium bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
              : `border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 ${
                  activeKinds.size > 0 ? "opacity-50" : ""
                }`
          }`}
        >
          <span
            className="inline-block w-3 h-3 rounded-full border"
            style={{ backgroundColor: `${MENTION_META.color}59`, borderColor: MENTION_META.color }}
          />
          Mentioned
        </button>
        {activeKinds.size > 0 && (
          <button
            type="button"
            onClick={() => setActiveKinds(new Set())}
            className="text-muted-foreground underline hover:text-foreground px-1"
          >
            Show all
          </button>
        )}
        </div>
        <button
          type="button"
          aria-pressed={showNames}
          onClick={() => setShowNames((v) => !v)}
          className={`px-2 py-1 rounded-full border transition-colors ${
            showNames
              ? "border-transparent font-medium bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
              : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
          }`}
        >
          Show names
        </button>
        {places && (
          <span className="text-muted-foreground/70 flex items-center gap-2">
            {visiblePlaces.length} places · {totalEvents} cited events ·{" "}
            {totalMentions} mentions
          </span>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* The Leaflet container stays mounted (only hidden) so switching
            views never tears the map down and re-initializes it. */}
        <div
          className={`lg:col-span-2 relative rounded-lg overflow-hidden border border-border ${
            view === "list" ? "hidden" : ""
          }`}
        >
          <div ref={mapDiv} className="h-[520px] md:h-[600px] w-full z-0" />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}
        </div>

        {view === "list" && (
          <div
            className="lg:col-span-2 rounded-lg border border-border bg-card p-4 sm:p-5 space-y-8 max-h-[600px] overflow-y-auto"
            data-testid="map-list-view"
          >
            <section aria-labelledby="map-list-places-heading" className="space-y-3">
              <h2
                id="map-list-places-heading"
                className="text-lg font-serif font-bold"
              >
                Places
              </h2>
              <p className="text-sm text-muted-foreground max-w-3xl">
                A text equivalent of the map: every plotted place with its
                type, the region the gazetteer locates it in, its cited life
                events with the philosophers behind them, how often the text
                mentions it in passing, and its gazetteer links. Select a
                place for the cited passages behind it. The legend filters
                above apply here too.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <caption className="sr-only">
                    Places of the Lives: name, type, located in, cited life
                    events with their philosophers, passing mentions, and
                    gazetteer links.
                  </caption>
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <SortableTh
                        label="Place"
                        sortKey="place"
                        sort={placeSort.sort}
                        onToggle={placeSort.toggle}
                        className="py-2 pr-3"
                        testId="sort-place-name"
                      />
                      <SortableTh
                        label="Type"
                        sortKey="type"
                        sort={placeSort.sort}
                        onToggle={placeSort.toggle}
                        className="py-2 pr-3"
                        testId="sort-place-type"
                      />
                      <SortableTh
                        label="Cited life events"
                        sortKey="events"
                        sort={placeSort.sort}
                        onToggle={placeSort.toggle}
                        className="py-2 pr-3"
                        testId="sort-place-events"
                      />
                      <SortableTh
                        label="Mentions"
                        sortKey="mentions"
                        sort={placeSort.sort}
                        onToggle={placeSort.toggle}
                        className="py-2 pr-3 text-right"
                        numeric
                        testId="sort-place-mentions"
                      />
                      <SortableTh
                        label="Links"
                        sortKey="links"
                        sort={placeSort.sort}
                        onToggle={placeSort.toggle}
                        className="py-2 pr-3"
                        testId="sort-place-links"
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sortRows(sidebarPlaces, placeSort.sort, {
                      place: (p) => p.label,
                      type: (p) => PLACE_TYPE_LABEL[p.placeType] ?? "Place",
                      events: (p) => p.events.length,
                      mentions: (p) => mentionCount(p),
                      links: (p) => (p.qid ? 1 : 0) + (p.pleiades ? 1 : 0),
                    }).map((p) => (
                      <tr
                        key={p.label}
                        className="border-b border-border/60 align-top"
                      >
                        <th
                          scope="row"
                          className="py-2 pr-3 font-medium text-left"
                        >
                          <button
                            type="button"
                            data-testid={`map-list-place-${p.label}`}
                            className="text-primary hover:underline text-left"
                            onClick={() => setSelected(p.label)}
                          >
                            {p.label}
                          </button>
                          {p.locatedIn && (
                            <span className="block text-xs text-muted-foreground font-normal">
                              in {p.locatedIn}
                            </span>
                          )}
                        </th>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {PLACE_TYPE_LABEL[p.placeType] ?? "Place"}
                        </td>
                        <td className="py-2 pr-3">
                          {p.events.length > 0 ? (
                            <ul className="space-y-0.5">
                              {EVENT_ORDER.filter((k) =>
                                p.events.some((e) => e.property === k),
                              ).map((k) => {
                                const names = [
                                  ...new Set(
                                    p.events
                                      .filter((e) => e.property === k)
                                      .map((e) => e.philosopher),
                                  ),
                                ];
                                return (
                                  <li key={k} className="text-xs">
                                    <span className="text-muted-foreground">
                                      {EVENT_META[k].plural}:
                                    </span>{" "}
                                    {names.join(", ")}
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <span className="text-muted-foreground/50">-</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {mentionCount(p) > 0 ? (
                            mentionCount(p)
                          ) : (
                            <span className="text-muted-foreground/50">-</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {p.qid || p.pleiades ? (
                            <span className="flex flex-col gap-0.5 text-xs">
                              {p.pleiades && (
                                <a
                                  href={`https://pleiades.stoa.org/places/${p.pleiades}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground underline hover:text-foreground whitespace-nowrap"
                                >
                                  Pleiades
                                  <span className="sr-only">
                                    {" "}
                                    entry for {p.label}
                                  </span>
                                </a>
                              )}
                              {p.qid && (
                                <a
                                  href={`https://www.wikidata.org/wiki/${p.qid}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground underline hover:text-foreground whitespace-nowrap"
                                >
                                  Wikidata
                                  <span className="sr-only">
                                    {" "}
                                    entry for {p.label}
                                  </span>
                                </a>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {itineraries && itineraries.length > 0 && (
              <section
                aria-labelledby="map-list-journeys-heading"
                className="space-y-3"
                data-testid="map-list-journeys"
              >
                <h2
                  id="map-list-journeys-heading"
                  className="text-lg font-serif font-bold"
                >
                  Life journeys
                </h2>
                <p className="text-sm text-muted-foreground max-w-3xl">
                  Each philosopher&apos;s itinerary as an ordered list:
                  birthplace first, then residences and travels in the order
                  the text gives them, deathplace last - every stop cited.
                  The legend filters above do not apply here: each journey
                  is always shown in full, since dropping stops would break
                  its chronology.
                </p>
                <ul className="space-y-2">
                  {itineraries.map((it) => (
                    <li key={it.philosopher}>
                      <details className="rounded-md border border-border bg-background px-3 py-2">
                        <summary className="cursor-pointer text-sm font-medium">
                          {it.philosopher}{" "}
                          <span className="text-muted-foreground font-normal">
                            - {it.placeCount} place
                            {it.placeCount === 1 ? "" : "s"}
                          </span>
                        </summary>
                        <ol className="mt-2 space-y-1.5">
                          {it.stops.map((s, i) => (
                            <li
                              key={`${s.place}-${i}`}
                              className="text-sm flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
                            >
                              <span>
                                {STOP_LABEL[s.property]}{" "}
                                <span className="font-medium">{s.place}</span>
                              </span>
                              {s.sectionId ? (
                                <Link
                                  href={`/section/${s.sectionId}`}
                                  className="text-xs text-muted-foreground underline hover:text-foreground"
                                >
                                  D.L. {s.ref}
                                </Link>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  D.L. {s.ref}
                                </span>
                              )}
                              {s.certainty !== "asserted" && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${CERTAINTY_BADGE[s.certainty] ?? ""}`}
                                >
                                  {s.certainty}
                                </span>
                              )}
                              {s.accordingTo && (
                                <span className="text-xs text-muted-foreground">
                                  per {s.accordingTo}
                                </span>
                              )}
                            </li>
                          ))}
                        </ol>
                      </details>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        <aside className="rounded-lg border border-border bg-card p-5 h-[520px] md:h-[600px] overflow-y-auto">
          {selectedPlace ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-2xl font-serif font-bold">{selectedPlace.label}</h2>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {PLACE_TYPE_LABEL[selectedPlace.placeType] ?? "Place"}
                      {selectedPlace.locatedIn && <> · in {selectedPlace.locatedIn}</>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="text-xs text-muted-foreground hover:text-foreground underline shrink-0 mt-2"
                  >
                    Close
                  </button>
                </div>
                <div className="flex flex-wrap gap-x-3">
                  {selectedPlace.qid && (
                    <a
                      href={`https://www.wikidata.org/wiki/${selectedPlace.qid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground underline hover:text-foreground mt-1"
                    >
                      Wikidata {selectedPlace.qid}
                    </a>
                  )}
                  {selectedPlace.pleiades && (
                    <a
                      href={`https://pleiades.stoa.org/places/${selectedPlace.pleiades}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground underline hover:text-foreground mt-1"
                    >
                      Pleiades {selectedPlace.pleiades}
                    </a>
                  )}
                </div>
              </div>
              {grouped.map((g) => (
                <div key={g.kind}>
                  <h3 className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: EVENT_META[g.kind].color }}
                    />
                    {EVENT_META[g.kind].plural}
                  </h3>
                  <ul className="space-y-2">
                    {g.events.map((e, i) => (
                      <li
                        key={`${e.philosopher}-${e.ref}-${i}`}
                        className="text-sm border border-border rounded-md px-3 py-2 bg-background"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Link
                            href={`/graph?p=${encodeURIComponent(e.philosopher)}`}
                            className="font-medium hover:underline"
                          >
                            {e.philosopher}
                          </Link>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${CERTAINTY_BADGE[e.certainty] ?? ""}`}
                          >
                            {e.certainty}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2">
                          {e.sectionId ? (
                            <Link
                              href={`/section/${e.sectionId}`}
                              className="underline hover:text-foreground"
                            >
                              D.L. {e.ref}
                            </Link>
                          ) : (
                            <span>D.L. {e.ref}</span>
                          )}
                          {e.accordingTo && <span>· according to {e.accordingTo}</span>}
                        </div>
                        {(e.deathAccounts ?? []).length > 0 && (
                          <ul className="mt-2 space-y-1.5 border-t border-border/60 pt-2">
                            {(e.deathAccounts ?? []).map((a, j) => (
                              <li key={`${a.ref}-${j}`} className="text-xs">
                                <span className="text-muted-foreground">
                                  {a.value}
                                </span>{" "}
                                <span className="whitespace-nowrap">
                                  {a.sectionId ? (
                                    <Link
                                      href={`/section/${a.sectionId}`}
                                      className="text-muted-foreground underline hover:text-foreground"
                                    >
                                      D.L. {a.ref}
                                    </Link>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      D.L. {a.ref}
                                    </span>
                                  )}
                                  {a.certainty !== "asserted" && (
                                    <span
                                      className={`ml-1.5 px-1 py-px rounded text-[10px] font-medium ${CERTAINTY_BADGE[a.certainty] ?? ""}`}
                                    >
                                      {a.accordingTo
                                        ? `per ${a.accordingTo}`
                                        : "some say"}
                                    </span>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {(selectedPlace.mentions ?? []).length > 0 && (
                <div>
                  <h3 className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: MENTION_META.color }}
                    />
                    Mentioned in the text
                  </h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {selectedPlace.mentions.map((m) => (
                      <li key={m.sectionId}>
                        <Link
                          href={`/section/${m.sectionId}`}
                          className="inline-block text-xs border border-border rounded px-2 py-1 bg-background hover:bg-secondary"
                        >
                          D.L. {m.sectionId}
                          {m.count > 1 && (
                            <span className="text-muted-foreground"> ×{m.count}</span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : activeItinerary ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-serif font-bold">
                  {activeItinerary.philosopher}&rsquo;s journey
                </h2>
                <button
                  type="button"
                  onClick={() => setJourney(null)}
                  className="text-xs text-muted-foreground hover:text-foreground underline shrink-0 mt-1"
                >
                  Close
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                Birthplace first, then residences and travels in the order
                the text gives them, deathplace last - every stop cited.
                Legs resting only on hedged accounts are dashed; rival
                accounts of the same event are not joined.
              </p>
              <ol className="space-y-2">
                {journeyStops.map((s, i) => (
                  <li
                    key={`${s.place}-${i}`}
                    className="text-sm border border-border rounded-md px-3 py-2 bg-background"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white shrink-0"
                        style={{
                          backgroundColor:
                            EVENT_META[s.entries[0].property].color,
                        }}
                      >
                        {i + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelected(s.place)}
                        className="font-medium hover:underline text-left"
                      >
                        {s.place}
                      </button>
                    </div>
                    <ul className="mt-1.5 space-y-1">
                      {s.entries.map((e, j) => (
                        <li
                          key={`${e.ref}-${j}`}
                          className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5"
                        >
                          <span>{STOP_LABEL[e.property]}</span>
                          {e.sectionId ? (
                            <Link
                              href={`/section/${e.sectionId}`}
                              className="underline hover:text-foreground"
                            >
                              D.L. {e.ref}
                            </Link>
                          ) : (
                            <span>D.L. {e.ref}</span>
                          )}
                          {e.certainty !== "asserted" && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${CERTAINTY_BADGE[e.certainty] ?? ""}`}
                            >
                              {e.certainty}
                            </span>
                          )}
                          {e.accordingTo && <span>· per {e.accordingTo}</span>}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
              <Link
                href={`/graph?p=${encodeURIComponent(activeItinerary.philosopher)}`}
                className="inline-block text-xs text-primary underline hover:text-foreground"
              >
                View {activeItinerary.philosopher} in the graph
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-lg font-serif font-bold">
                {focusLabels && focusLabels.size > 0
                  ? `${focusPhilosopher}'s places`
                  : "Places"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {focusLabels && focusLabels.size > 0
                  ? "Highlighted below and on the map. Select one for its cited passages."
                  : "Select a marker on the map, or a place below."}
              </p>
              <ul className="space-y-1">
                {sidebarPlaces.map((p) => (
                  <li key={p.label}>
                    <button
                      type="button"
                      onClick={() => setSelected(p.label)}
                      className={`w-full text-left text-sm px-2 py-1.5 rounded hover:bg-secondary flex items-center justify-between gap-2 ${
                        focusLabels && !focusLabels.has(p.label)
                          ? "opacity-45"
                          : ""
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: markerColor(p) }}
                        />
                        <span className="truncate">{p.label}</span>
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {p.events.length > 0 ? p.events.length : `${mentionCount(p)}m`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
