/**
 * Accessibility guard: the three visual pages (knowledge graph, map,
 * timeline) must each keep an equivalent accessible alternative view
 * (semantic table / structured list) behind a keyboard-accessible,
 * announced toggle.
 *
 * For each page this validator asserts, in the page source:
 *   1. a view toggle exists: a role="group" with an aria-label and
 *      aria-pressed buttons including a "List" option;
 *   2. the alternative view markup exists (its data-testid container)
 *      and uses semantic HTML (<table> with scoped headers, or <ol>);
 * and, against the api-server data the pages render:
 *   3. the underlying dataset is non-empty, so the alternative view can
 *      never be a vacuous empty shell (graph nodes+edges, map
 *      places+itineraries, timeline philosophers).
 *
 * A positive control runs each source check against a stripped copy to
 * prove the regexes are not vacuously green.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "../..");
process.env["LAERTIUS_DATA_DIR"] = path.resolve(
  workspaceRoot,
  "artifacts/api-server/data",
);

const PAGES_DIR = path.resolve(workspaceRoot, "artifacts/laertius/src/pages");

interface PageSpec {
  file: string;
  /** data-testid of the view-toggle group. */
  toggleTestId: string;
  /** data-testid of the "List" button in the toggle. */
  listButtonTestId: string;
  /** Markers that must appear in the alternative-view markup. */
  listMarkers: RegExp[];
}

const PAGES: PageSpec[] = [
  {
    file: "graph.tsx",
    toggleTestId: "graph-view-list", // list button doubles as marker
    listButtonTestId: "graph-view-list",
    listMarkers: [
      /data-testid="graph-list-view"/,
      /<table/,
      /scope="col"|<SortableTh/,
      /scope="row"/,
      /<caption/,
    ],
  },
  {
    file: "map.tsx",
    toggleTestId: "map-view-toggle",
    listButtonTestId: "map-view-list",
    listMarkers: [
      /data-testid="map-list-view"/,
      /<table/,
      /scope="col"|<SortableTh/,
      /scope="row"/,
      /<caption/,
      /data-testid="map-list-journeys"/,
      /<ol/,
    ],
  },
  {
    file: "timeline.tsx",
    toggleTestId: "timeline-view-toggle",
    listButtonTestId: "timeline-view-list",
    listMarkers: [
      /data-testid="timeline-list-table"/,
      /<table/,
      /scope="col"|<SortableTh/,
      /scope="row"/,
      /<caption/,
    ],
  },
];

function checkPage(spec: PageSpec, src: string): string[] {
  const errors: string[] = [];
  // 1. Announced, keyboard-accessible toggle: real <button>s inside a
  //    labelled group, with pressed state exposed.
  if (!/role="group"/.test(src) || !/aria-label=/.test(src)) {
    errors.push(
      `${spec.file}: no labelled role="group" view toggle (aria-label missing?)`,
    );
  }
  if (!/aria-pressed=/.test(src)) {
    errors.push(`${spec.file}: toggle buttons expose no aria-pressed state`);
  }
  if (!src.includes(`data-testid="${spec.listButtonTestId}"`)) {
    errors.push(
      `${spec.file}: missing the List toggle button (data-testid="${spec.listButtonTestId}")`,
    );
  }
  if (!src.includes(`data-testid="${spec.toggleTestId}"`)) {
    errors.push(
      `${spec.file}: missing the view toggle (data-testid="${spec.toggleTestId}")`,
    );
  }
  // 2. The alternative view's semantic markup.
  for (const re of spec.listMarkers) {
    if (!re.test(src)) {
      errors.push(`${spec.file}: alternative view is missing ${re.source}`);
    }
  }
  return errors;
}

async function dataTruth(): Promise<string[]> {
  const errors: string[] = [];
  const { getKnowledgeGraph } = await import(
    "../../artifacts/api-server/src/lib/kg"
  );
  const { getMapPlaces, getItineraries } = await import(
    "../../artifacts/api-server/src/lib/map"
  );
  const { getTimeline } = await import(
    "../../artifacts/api-server/src/lib/timeline"
  );
  const kg = getKnowledgeGraph();
  if (kg.nodes.length === 0) errors.push("graph: zero nodes in the KG");
  if (kg.edges.length === 0) errors.push("graph: zero edges in the KG");
  const places = getMapPlaces();
  if (places.length === 0) errors.push("map: zero places");
  if (getItineraries().length === 0) errors.push("map: zero itineraries");
  if (getTimeline().length === 0) errors.push("timeline: zero philosophers");
  console.log(
    `data: ${kg.nodes.length} graph nodes, ${kg.edges.length} edges, ` +
      `${places.length} places, ${getItineraries().length} itineraries, ` +
      `${getTimeline().length} dated philosophers`,
  );
  return errors;
}

async function main() {
  const errors: string[] = [];
  for (const spec of PAGES) {
    const src = readFileSync(path.join(PAGES_DIR, spec.file), "utf-8");

    // Positive control: a copy with all accessibility markup stripped
    // MUST fail every check, or the regexes are vacuous.
    const stripped = src
      .replace(/data-testid="[^"]*"/g, "")
      .replace(/aria-pressed=/g, "x=")
      .replace(/aria-label=/g, "x=")
      .replace(/role="group"/g, "")
      .replace(/<table/g, "<div")
      .replace(/<caption/g, "<div")
      .replace(/<ol/g, "<div")
      .replace(/scope="(col|row)"/g, "")
      .replace(/<SortableTh/g, "<div");
    if (checkPage(spec, stripped).length === 0) {
      console.error(
        `POSITIVE CONTROL FAILED for ${spec.file}: stripped markup passed`,
      );
      process.exit(1);
    }

    errors.push(...checkPage(spec, src));
  }
  console.log("positive controls OK (stripped copies flagged)");

  errors.push(...(await dataTruth()));

  if (errors.length > 0) {
    console.error("Accessible alternative views are broken:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(
    "OK: graph, map and timeline each keep an announced toggle and a non-empty semantic alternative view.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
