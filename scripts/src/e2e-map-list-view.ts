/// <reference lib="dom" />
// Real-browser check that the map's accessible List view (/map?view=list)
// really keeps its substance: a refactor of map.tsx could silently drop the
// philosopher names from the "Cited life events" column, the Pleiades /
// Wikidata gazetteer links, the ordered journey lists, or the ?view=list URL
// sync without any existing validator noticing (validate-map-contract pins
// the API payload only, not the rendered list).
//
// Layers:
// 1. API contract: /api/map/places and /api/map/itineraries are non-empty
//    and contain places WITH events/qid/pleiades — otherwise every DOM
//    check below would be vacuous (see audit-positive-controls).
// 2. Rendered DOM at /map?view=list:
//    - the List toggle is selected on load (aria-pressed round-trips the URL)
//    - the places table has a row per place; sampled rows show the exact
//      philosopher names the API cites in the "Cited life events" column
//    - sampled places with pleiades/qid render working gazetteer links with
//      the exact expected hrefs
//    - the journeys section renders one entry per itinerary, and a sampled
//      itinerary lists its stops in the API's order
// 3. Toggle round-trip: clicking Map drops ?view=list from the URL and hides
//    the list; clicking List restores both.
//
// Positive controls: counts of philosopher names, gazetteer links, and
// journey stops actually verified must all be > 0. Negative control: a
// mutated philosopher name must NOT be found in the events cell, proving
// the containment test can fire.
//
// Requirements: API server + laertius web workflows running (shared proxy,
// default http://localhost:80) and a Chromium headless shell installed for
// playwright-core.

// playwright-core resolves its browser registry at import time from
// PLAYWRIGHT_BROWSERS_PATH; pick the candidate that actually holds chromium.
import "./lib/playwright-browsers-path";
import { PAGE_HEADING_SELECTOR } from "./lib/card-headings";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

interface MapEvent {
  philosopher: string;
  property: string;
  sectionId?: string;
}
interface Place {
  label: string;
  qid?: string;
  pleiades?: string;
  events: MapEvent[];
}
interface ItineraryStop {
  place: string;
}
interface Itinerary {
  philosopher: string;
  stops: ItineraryStop[];
}

async function main() {
  // --- Layer 1: the API payloads the list view consumes ---
  console.log("API contract: map places & itineraries carry real substance");
  const placesRes = await fetch(`${BASE_URL}/api/map/places`);
  check("GET /api/map/places responds 200", placesRes.ok, `${placesRes.status}`);
  const places = (placesRes.ok ? await placesRes.json() : []) as Place[];
  check(`places payload non-empty (${places.length})`, places.length > 0);

  const withEvents = places.filter((p) => p.events.length > 0);
  const withPleiades = places.filter((p) => p.pleiades);
  const withQid = places.filter((p) => p.qid);
  check(
    `places with cited life events exist (${withEvents.length})`,
    withEvents.length > 0,
  );
  check(
    `places with a Pleiades id exist (${withPleiades.length})`,
    withPleiades.length > 0,
  );
  check(
    `places with a Wikidata QID exist (${withQid.length})`,
    withQid.length > 0,
  );

  const itinRes = await fetch(`${BASE_URL}/api/map/itineraries`);
  check("GET /api/map/itineraries responds 200", itinRes.ok, `${itinRes.status}`);
  const itineraries = (itinRes.ok ? await itinRes.json() : []) as Itinerary[];
  check(
    `itineraries payload non-empty (${itineraries.length})`,
    itineraries.length > 0,
  );
  const multiStop = itineraries.find((i) => i.stops.length >= 2);
  check(
    "an itinerary with >= 2 ordered stops exists",
    !!multiStop,
    "all itineraries have < 2 stops",
  );

  if (failures > 0) {
    console.error("\nAPI layer failed; skipping browser checks");
    process.exit(1);
  }

  // Samples: busiest event place, plus one gazetteer-linked place of each
  // kind (they may coincide; hrefs are still asserted independently).
  const eventPlace = [...withEvents].sort(
    (a, b) => b.events.length - a.events.length,
  )[0];
  const pleiadesPlace = withPleiades[0];
  const qidPlace = withQid[0];
  const expectedNames = [
    ...new Set(eventPlace.events.map((e) => e.philosopher)),
  ];

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    const guard = attachPageGuard(page);

    console.log("\nRendered list view at /map?view=list");
    await page.goto(`${BASE_URL}/map?view=list`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForSelector('[data-testid="map-list-view"]', { timeout: 30000 }),
    );
    // Wait until the table has real data rows (queries resolved).
    await guard.guarded(
      page.waitForFunction(
        () =>
          document.querySelectorAll(
            '[data-testid="map-list-view"] table tbody tr',
          ).length > 0,
        undefined,
        { timeout: 30000 },
      ),
    );

    // --- URL -> toggle: ?view=list on load selects List ---
    const togglesOnLoad = await page.evaluate(() => ({
      list: document
        .querySelector('[data-testid="map-view-list"]')
        ?.getAttribute("aria-pressed"),
      map: document
        .querySelector('[data-testid="map-view-map"]')
        ?.getAttribute("aria-pressed"),
    }));
    check(
      "?view=list on load selects the List toggle (aria-pressed=true)",
      togglesOnLoad.list === "true",
      `aria-pressed=${togglesOnLoad.list}`,
    );
    check(
      "…and the Map toggle is not pressed",
      togglesOnLoad.map === "false",
      `aria-pressed=${togglesOnLoad.map}`,
    );

    // --- Places table: rows, philosopher names, gazetteer links ---
    const table = await page.evaluate(
      (args: {
        eventLabel: string;
        names: string[];
        mutatedName: string;
        pleiadesLabel: string;
        pleiadesId: string;
        qidLabel: string;
        qid: string;
      }) => {
        // NOTE: no named helper functions in in-page blocks (tsx __name).
        const root = document.querySelector('[data-testid="map-list-view"]');
        const rows = Array.from(
          root?.querySelectorAll("table tbody tr") ?? [],
        );
        // No named helpers (tsx __name wrapping): build the three rows
        // in one pass with inline predicates only.
        const [eventRow, pRow, qRow] = [
          args.eventLabel,
          args.pleiadesLabel,
          args.qidLabel,
        ].map(
          (label) =>
            rows.find((r) =>
              r.querySelector(
                `[data-testid="map-list-place-${CSS.escape(label)}"]`,
              ),
            ) ?? null,
        );
        // Columns: th(Place), td[0]=Type, td[1]=Cited life events,
        // td[2]=Mentions, td[3]=Links.
        const eventsText =
          eventRow?.querySelectorAll("td")[1]?.textContent ?? "";

        const pleiadesHref =
          pRow
            ?.querySelector<HTMLAnchorElement>('a[href*="pleiades.stoa.org"]')
            ?.getAttribute("href") ?? null;
        const qidHref =
          qRow
            ?.querySelector<HTMLAnchorElement>('a[href*="wikidata.org"]')
            ?.getAttribute("href") ?? null;

        return {
          rowCount: rows.length,
          eventRowFound: !!eventRow,
          eventsText,
          namesPresent: args.names.filter((n) => eventsText.includes(n)),
          mutatedPresent: eventsText.includes(args.mutatedName),
          pleiadesHref,
          qidHref,
        };
      },
      {
        eventLabel: eventPlace.label,
        names: expectedNames,
        mutatedName: `${expectedNames[0]}-MUTATED-CONTROL`,
        pleiadesLabel: pleiadesPlace.label,
        pleiadesId: pleiadesPlace.pleiades!,
        qidLabel: qidPlace.label,
        qid: qidPlace.qid!,
      },
    );

    check(
      `places table renders every place (${table.rowCount}/${places.length} rows)`,
      table.rowCount === places.length,
    );
    check(`row for "${eventPlace.label}" found`, table.eventRowFound);
    check(
      `"${eventPlace.label}" events cell names all ${expectedNames.length} cited philosophers`,
      table.namesPresent.length === expectedNames.length,
      `missing: ${expectedNames
        .filter((n) => !table.namesPresent.includes(n))
        .join(", ")}`,
    );
    // Negative control: the containment test must be able to fire.
    check(
      "negative control: a mutated philosopher name is NOT in the events cell",
      !table.mutatedPresent,
    );
    check(
      `"${pleiadesPlace.label}" links to its Pleiades entry`,
      table.pleiadesHref ===
        `https://pleiades.stoa.org/places/${pleiadesPlace.pleiades}`,
      `href=${table.pleiadesHref}`,
    );
    check(
      `"${qidPlace.label}" links to its Wikidata entry`,
      table.qidHref === `https://www.wikidata.org/wiki/${qidPlace.qid}`,
      `href=${table.qidHref}`,
    );

    // --- Journeys section: one entry per itinerary, ordered stops ---
    const journeys = await page.evaluate((sample: {
      philosopher: string;
      stopPlaces: string[];
    }) => {
      const section = document.querySelector(
        '[data-testid="map-list-journeys"]',
      );
      const entries = Array.from(section?.querySelectorAll("details") ?? []);
      const entry = entries.find((d) =>
        (d.querySelector("summary")?.textContent ?? "").includes(
          sample.philosopher,
        ),
      );
      const stops = Array.from(entry?.querySelectorAll("ol > li") ?? []).map(
        (li) => li.textContent ?? "",
      );
      return {
        sectionFound: !!section,
        entryCount: entries.length,
        entryFound: !!entry,
        renderedStops: stops,
      };
    }, {
      philosopher: multiStop!.philosopher,
      stopPlaces: multiStop!.stops.map((s) => s.place),
    });

    check("journeys section rendered", journeys.sectionFound);
    check(
      `one journey entry per itinerary (${journeys.entryCount}/${itineraries.length})`,
      journeys.entryCount === itineraries.length,
    );
    check(
      `journey entry for ${multiStop!.philosopher} found`,
      journeys.entryFound,
    );
    const orderOk =
      journeys.renderedStops.length === multiStop!.stops.length &&
      multiStop!.stops.every((s, i) =>
        journeys.renderedStops[i]?.includes(s.place),
      );
    check(
      `${multiStop!.philosopher}'s ${multiStop!.stops.length} stops render in the API's order`,
      orderOk,
      `rendered ${journeys.renderedStops.length} stop(s)`,
    );

    // --- Place selection: clicking a place button opens the side panel ---
    // The place-name button is the keyboard/screen-reader path to the
    // evidence: it must select the place and render its cited passages,
    // gazetteer ids, and philosopher links in the <aside> panel.
    // Sample: a place with events that carry a D.L. sectionId, preferring
    // one that also has BOTH gazetteer ids so the panel checks aren't split.
    const selectable = withEvents.filter((p) =>
      p.events.some((e) => e.sectionId),
    );
    check(
      `places with section-linked events exist (${selectable.length})`,
      selectable.length > 0,
    );
    const selectPlace =
      selectable.find((p) => p.qid && p.pleiades) ??
      selectable.find((p) => p.qid || p.pleiades) ??
      selectable[0];
    const selectSectionIds = [
      ...new Set(
        selectPlace.events.flatMap((e) => (e.sectionId ? [e.sectionId] : [])),
      ),
    ];
    const selectNames = [
      ...new Set(selectPlace.events.map((e) => e.philosopher)),
    ];

    console.log(
      `\nSelecting "${selectPlace.label}" opens its cited passages in the panel`,
    );
    // Before the click the aside must NOT already show the place heading —
    // otherwise the post-click assertions would be vacuous.
    const beforeClick = await page.evaluate(
      ([label, sel]: readonly [string, string]) => {
        const aside = document.querySelector("aside");
        const h2 = aside?.querySelector(sel);
        return {
          asideFound: !!aside,
          headingIsPlace: (h2?.textContent ?? "").trim() === label,
        };
      },
      [selectPlace.label, PAGE_HEADING_SELECTOR] as const,
    );
    check("aside panel exists", beforeClick.asideFound);
    check(
      "positive control: panel does NOT show the place heading before the click",
      !beforeClick.headingIsPlace,
    );

    await page.click(
      `[data-testid="map-list-place-${selectPlace.label.replace(/"/g, '\\"')}"]`,
    );
    await guard.guarded(
      page.waitForFunction(
        (label: string) =>
          Array.from(document.querySelectorAll("aside h2")).some(
            (h) => (h.textContent ?? "").trim() === label,
          ),
        selectPlace.label,
        { timeout: 15000 },
      ),
    );

    const panel = await page.evaluate(
      (args: {
        sectionIds: string[];
        names: string[];
        mutatedName: string;
        qid: string | null;
        pleiades: string | null;
      }) => {
        // NOTE: no named helper functions in in-page blocks (tsx __name).
        const aside = document.querySelector("aside");
        const text = aside?.textContent ?? "";
        const sectionHrefs = Array.from(
          aside?.querySelectorAll<HTMLAnchorElement>('a[href*="/section/"]') ??
            [],
        ).map((a) => a.getAttribute("href") ?? "");
        const philosopherLinks = Array.from(
          aside?.querySelectorAll<HTMLAnchorElement>('a[href*="/graph?p="]') ??
            [],
        ).map((a) => (a.textContent ?? "").trim());
        return {
          sectionHrefs,
          matchedSectionIds: args.sectionIds.filter((id) =>
            sectionHrefs.some((h) => h.endsWith(`/section/${id}`)),
          ),
          philosopherLinks,
          namesLinked: args.names.filter((n) => philosopherLinks.includes(n)),
          mutatedLinked: philosopherLinks.includes(args.mutatedName),
          qidHref: args.qid
            ? (aside
                ?.querySelector<HTMLAnchorElement>(
                  `a[href="https://www.wikidata.org/wiki/${args.qid}"]`,
                )
                ?.getAttribute("href") ?? null)
            : null,
          qidTextShown: args.qid ? text.includes(`Wikidata ${args.qid}`) : false,
          pleiadesHref: args.pleiades
            ? (aside
                ?.querySelector<HTMLAnchorElement>(
                  `a[href="https://pleiades.stoa.org/places/${args.pleiades}"]`,
                )
                ?.getAttribute("href") ?? null)
            : null,
          pleiadesTextShown: args.pleiades
            ? text.includes(`Pleiades ${args.pleiades}`)
            : false,
        };
      },
      {
        sectionIds: selectSectionIds,
        names: selectNames,
        mutatedName: `${selectNames[0]}-MUTATED-CONTROL`,
        qid: selectPlace.qid ?? null,
        pleiades: selectPlace.pleiades ?? null,
      },
    );

    check(
      `panel shows at least one D.L. section link (${panel.sectionHrefs.length} found)`,
      panel.sectionHrefs.length > 0,
    );
    check(
      `panel links every section-cited passage (${panel.matchedSectionIds.length}/${selectSectionIds.length})`,
      panel.matchedSectionIds.length === selectSectionIds.length,
      `missing: ${selectSectionIds
        .filter((id) => !panel.matchedSectionIds.includes(id))
        .join(", ")}`,
    );
    check(
      `panel links all ${selectNames.length} cited philosopher(s)`,
      panel.namesLinked.length === selectNames.length,
      `missing: ${selectNames
        .filter((n) => !panel.namesLinked.includes(n))
        .join(", ")}`,
    );
    // Negative control: the philosopher-link containment test must be able
    // to fire (a mutated name must not match).
    check(
      "negative control: a mutated philosopher name is NOT linked in the panel",
      !panel.mutatedLinked,
    );
    if (selectPlace.qid) {
      check(
        `panel shows Wikidata id ${selectPlace.qid} with the exact href`,
        !!panel.qidHref && panel.qidTextShown,
        `href=${panel.qidHref} text=${panel.qidTextShown}`,
      );
    }
    if (selectPlace.pleiades) {
      check(
        `panel shows Pleiades id ${selectPlace.pleiades} with the exact href`,
        !!panel.pleiadesHref && panel.pleiadesTextShown,
        `href=${panel.pleiadesHref} text=${panel.pleiadesTextShown}`,
      );
    }
    check(
      "sampled place has at least one gazetteer id to verify (not vacuous)",
      !!(selectPlace.qid || selectPlace.pleiades),
    );
    // Positive control: real substance was verified by the selection run.
    check(
      `positive control: verified ${panel.matchedSectionIds.length} passage link(s) and ${panel.namesLinked.length} philosopher link(s) (> 0 each)`,
      panel.matchedSectionIds.length > 0 && panel.namesLinked.length > 0,
    );

    // --- Close returns the panel to the default overview ---
    // The Close button clears the selection; the panel must drop the place
    // heading and show the default "Places" overview again (heading, helper
    // text, and the full place list) — otherwise keyboard readers are
    // trapped on a stale place panel. This also restores the baseline the
    // toggle round-trip below assumed.
    console.log("\nClosing the place panel restores the default overview");
    // Positive control: the place panel really is open right now (heading
    // matches the selected place and the default heading is absent), so the
    // post-close assertions cannot pass vacuously.
    const beforeClose = await page.evaluate(
      ([label, sel]: readonly [string, string]) => {
        const aside = document.querySelector("aside");
        const headings = Array.from(aside?.querySelectorAll(sel) ?? []).map(
          (h) => (h.textContent ?? "").trim(),
        );
        return {
          placeHeadingShown: headings.includes(label),
          defaultHeadingShown: headings.includes("Places"),
          placeButtonCount:
            aside?.querySelectorAll("ul button").length ?? 0,
        };
      },
      [selectPlace.label, PAGE_HEADING_SELECTOR] as const,
    );
    check(
      "positive control: place heading is shown before Close",
      beforeClose.placeHeadingShown,
    );
    check(
      'positive control: default "Places" heading is absent before Close',
      !beforeClose.defaultHeadingShown,
    );

    await page.click("aside button:has-text('Close')");
    await guard.guarded(
      page.waitForFunction(
        () =>
          Array.from(document.querySelectorAll("aside h2")).some(
            (h) => (h.textContent ?? "").trim() === "Places",
          ),
        undefined,
        { timeout: 15000 },
      ),
    );
    const afterClose = await page.evaluate(([label, sel]: readonly [
      string,
      string,
    ]) => {
      const aside = document.querySelector("aside");
      const headings = Array.from(aside?.querySelectorAll(sel) ?? []).map(
        (h) => (h.textContent ?? "").trim(),
      );
      return {
        placeHeadingShown: headings.includes(label),
        defaultHeadingShown: headings.includes("Places"),
        helperShown: (aside?.textContent ?? "").includes(
          "Select a marker on the map, or a place below.",
        ),
        placeButtonCount: aside?.querySelectorAll("ul button").length ?? 0,
      };
    }, [selectPlace.label, PAGE_HEADING_SELECTOR] as const);
    check(
      `Close removes the "${selectPlace.label}" heading from the panel`,
      !afterClose.placeHeadingShown,
    );
    check(
      'Close restores the default "Places" heading',
      afterClose.defaultHeadingShown,
    );
    check(
      "…and the default helper text",
      afterClose.helperShown,
    );
    check(
      `…and the full place list (${afterClose.placeButtonCount}/${places.length} buttons)`,
      afterClose.placeButtonCount === places.length,
    );

    // --- Toggle -> URL round-trip ---
    await page.click('[data-testid="map-view-map"]');
    await page.waitForTimeout(200);
    const afterMap = await page.evaluate(() => ({
      view: new URLSearchParams(window.location.search).get("view"),
      listShown: !!document.querySelector('[data-testid="map-list-view"]'),
    }));
    check(
      "clicking Map removes ?view=list from the URL",
      afterMap.view === null,
      `view=${afterMap.view}`,
    );
    check("…and hides the list view", !afterMap.listShown);

    await page.click('[data-testid="map-view-list"]');
    await page.waitForTimeout(200);
    const afterList = await page.evaluate(() => ({
      view: new URLSearchParams(window.location.search).get("view"),
      listShown: !!document.querySelector('[data-testid="map-list-view"]'),
    }));
    check(
      "clicking List puts ?view=list back in the URL",
      afterList.view === "list",
      `view=${afterList.view}`,
    );
    check("…and shows the list view again", afterList.listShown);

    // --- Legend filter narrows the List view table too ---
    // The page promises "The legend filters above apply here too"; prove a
    // legend chip really shrinks the table to exactly the places carrying
    // that event kind per /api/map/places, and "Show all" restores it.
    console.log("\nLegend filter narrows the List view table");
    const birthPlaces = places.filter((p) =>
      p.events.some((e) => e.property === "birthPlace"),
    );
    // Positive control preconditions: the filter must be able to both
    // match something and exclude something, or the check is vacuous.
    check(
      `positive control: places with a birth event exist (${birthPlaces.length} > 0)`,
      birthPlaces.length > 0,
    );
    check(
      `positive control: birth filter excludes places (${birthPlaces.length} < ${places.length})`,
      birthPlaces.length < places.length,
    );

    await page.click('button:has-text("Births")');
    await guard.guarded(
      page.waitForFunction(
        (expected: number) =>
          document.querySelectorAll(
            '[data-testid="map-list-view"] table tbody tr',
          ).length === expected,
        birthPlaces.length,
        { timeout: 10000 },
      ).catch(() => null),
    );
    const filtered = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="map-list-view"]');
      return Array.from(root?.querySelectorAll("table tbody tr") ?? []).map(
        (r) =>
          r
            .querySelector('[data-testid^="map-list-place-"]')
            ?.getAttribute("data-testid")
            ?.replace(/^map-list-place-/, "") ?? "",
      );
    });
    check(
      `clicking Births shrinks the table to ${birthPlaces.length} row(s) (got ${filtered.length})`,
      filtered.length === birthPlaces.length,
    );
    const expectedLabels = new Set(birthPlaces.map((p) => p.label));
    const wrongRows = filtered.filter((l) => !expectedLabels.has(l));
    const missingRows = [...expectedLabels].filter(
      (l) => !filtered.includes(l),
    );
    check(
      "filtered rows are exactly the places with a birth event",
      wrongRows.length === 0 && missingRows.length === 0,
      `unexpected: [${wrongRows.join(", ")}] missing: [${missingRows.join(", ")}]`,
    );
    check(
      `positive control: filtered rows (${filtered.length}) > 0 and < full count (${places.length})`,
      filtered.length > 0 && filtered.length < places.length,
    );

    // --- Journeys section is intentionally NOT legend-filtered ---
    // Journeys are chronological itineraries; dropping stops by event kind
    // would break their chronology. The section states this explicitly, and
    // its entry count must be unchanged while a legend chip is active.
    const journeysWhileFiltered = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="map-list-journeys"]');
      return {
        entryCount: root?.querySelectorAll(":scope > ul > li").length ?? -1,
        noteFound: (root?.textContent ?? "").includes(
          "legend filters above do not apply here",
        ),
      };
    });
    check(
      `journeys section unaffected by active legend chip (${journeysWhileFiltered.entryCount}/${itineraries.length} entries)`,
      journeysWhileFiltered.entryCount === itineraries.length,
    );
    check(
      "journeys section states the legend filters do not apply to it",
      journeysWhileFiltered.noteFound,
    );

    // "Show all" restores the full table. (Exact-text match: the page also
    // has "Show names", and "Show all places" only exists with ?p= focus.)
    await page.click('button:text-is("Show all")');
    await guard.guarded(
      page.waitForFunction(
        (expected: number) =>
          document.querySelectorAll(
            '[data-testid="map-list-view"] table tbody tr',
          ).length === expected,
        places.length,
        { timeout: 10000 },
      ).catch(() => null),
    );
    const restoredCount = await page.evaluate(
      () =>
        document.querySelectorAll(
          '[data-testid="map-list-view"] table tbody tr',
        ).length,
    );
    check(
      `"Show all" restores every place (${restoredCount}/${places.length} rows)`,
      restoredCount === places.length,
    );

    // --- Mentioned chip: the mention-only filter branch ---
    // Mention-only places (events.length === 0) go through a DIFFERENT
    // filter branch in map.tsx (the synthetic "mention" kind), so the
    // Births check above cannot catch a regression there.
    console.log("\nMentioned chip narrows the table to mention-only places");
    const mentionPlaces = places.filter((p) => p.events.length === 0);
    // Positive control preconditions: must match something AND exclude
    // something, or the check is vacuous.
    check(
      `positive control: mention-only places exist (${mentionPlaces.length} > 0)`,
      mentionPlaces.length > 0,
    );
    check(
      `positive control: mention filter excludes places (${mentionPlaces.length} < ${places.length})`,
      mentionPlaces.length < places.length,
    );

    await page.click('button:has-text("Mentioned")');
    await guard.guarded(
      page.waitForFunction(
        (expected: number) =>
          document.querySelectorAll(
            '[data-testid="map-list-view"] table tbody tr',
          ).length === expected,
        mentionPlaces.length,
        { timeout: 10000 },
      ).catch(() => null),
    );
    const mentionFiltered = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="map-list-view"]');
      return Array.from(root?.querySelectorAll("table tbody tr") ?? []).map(
        (r) =>
          r
            .querySelector('[data-testid^="map-list-place-"]')
            ?.getAttribute("data-testid")
            ?.replace(/^map-list-place-/, "") ?? "",
      );
    });
    check(
      `clicking Mentioned shrinks the table to ${mentionPlaces.length} row(s) (got ${mentionFiltered.length})`,
      mentionFiltered.length === mentionPlaces.length,
    );
    const expectedMentionLabels = new Set(mentionPlaces.map((p) => p.label));
    const wrongMentionRows = mentionFiltered.filter(
      (l) => !expectedMentionLabels.has(l),
    );
    const missingMentionRows = [...expectedMentionLabels].filter(
      (l) => !mentionFiltered.includes(l),
    );
    check(
      "Mentioned rows are exactly the places with zero events",
      wrongMentionRows.length === 0 && missingMentionRows.length === 0,
      `unexpected: [${wrongMentionRows.join(", ")}] missing: [${missingMentionRows.join(", ")}]`,
    );
    check(
      `positive control: Mentioned rows (${mentionFiltered.length}) > 0 and < full count (${places.length})`,
      mentionFiltered.length > 0 && mentionFiltered.length < places.length,
    );

    // Restore the full table so later checks aren't affected.
    await page.click('button:text-is("Show all")');
    await guard.guarded(
      page.waitForFunction(
        (expected: number) =>
          document.querySelectorAll(
            '[data-testid="map-list-view"] table tbody tr',
          ).length === expected,
        places.length,
        { timeout: 10000 },
      ).catch(() => null),
    );
    const restoredAfterMention = await page.evaluate(
      () =>
        document.querySelectorAll(
          '[data-testid="map-list-view"] table tbody tr',
        ).length,
    );
    check(
      `"Show all" restores every place after Mentioned (${restoredAfterMention}/${places.length} rows)`,
      restoredAfterMention === places.length,
    );

    // --- Multi-select: Births + Mentioned together show the UNION ---
    // activeKinds is a Set, so multiple chips can be active at once. The
    // single-chip checks above cannot catch a combination regression
    // (e.g. the second chip replacing the first, or the mix showing
    // everything). Activate both and assert the table is exactly the
    // union: places with a birthPlace event PLUS mention-only places
    // (zero events). The two groups are disjoint by construction, so the
    // union count is the sum.
    console.log(
      "\nBirths + Mentioned together show the union of both groups",
    );
    const unionPlaces = places.filter(
      (p) =>
        p.events.length === 0 ||
        p.events.some((e) => e.property === "birthPlace"),
    );
    // Positive-control preconditions: the union must be strictly larger
    // than each individual group AND strictly smaller than the full list,
    // or a broken combination (one group only / everything) would pass.
    check(
      `positive control: union (${unionPlaces.length}) > Births alone (${birthPlaces.length})`,
      unionPlaces.length > birthPlaces.length,
    );
    check(
      `positive control: union (${unionPlaces.length}) > Mentioned alone (${mentionPlaces.length})`,
      unionPlaces.length > mentionPlaces.length,
    );
    check(
      `positive control: union (${unionPlaces.length}) < full count (${places.length})`,
      unionPlaces.length < places.length,
    );

    await page.click('button:has-text("Births")');
    await page.click('button:has-text("Mentioned")');
    // Assert both chips really are active (aria-pressed) so a failed
    // toggle gives a clear message instead of only a count mismatch.
    // NOTE: no named helper functions in in-page blocks (tsx __name).
    const chipsPressed = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      return {
        births: buttons.some(
          (b) =>
            (b.textContent ?? "").includes("Births") &&
            b.getAttribute("aria-pressed") === "true",
        ),
        mentioned: buttons.some(
          (b) =>
            (b.textContent ?? "").includes("Mentioned") &&
            b.getAttribute("aria-pressed") === "true",
        ),
      };
    });
    check("Births chip is pressed", chipsPressed.births);
    check("Mentioned chip is pressed too", chipsPressed.mentioned);

    await guard.guarded(
      page.waitForFunction(
        (expected: number) =>
          document.querySelectorAll(
            '[data-testid="map-list-view"] table tbody tr',
          ).length === expected,
        unionPlaces.length,
        { timeout: 10000 },
      ).catch(() => null),
    );
    const unionFiltered = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="map-list-view"]');
      return Array.from(root?.querySelectorAll("table tbody tr") ?? []).map(
        (r) =>
          r
            .querySelector('[data-testid^="map-list-place-"]')
            ?.getAttribute("data-testid")
            ?.replace(/^map-list-place-/, "") ?? "",
      );
    });
    check(
      `Births + Mentioned shows ${unionPlaces.length} row(s) (got ${unionFiltered.length})`,
      unionFiltered.length === unionPlaces.length,
    );
    const expectedUnionLabels = new Set(unionPlaces.map((p) => p.label));
    const wrongUnionRows = unionFiltered.filter(
      (l) => !expectedUnionLabels.has(l),
    );
    const missingUnionRows = [...expectedUnionLabels].filter(
      (l) => !unionFiltered.includes(l),
    );
    check(
      "combined rows are exactly the union (birth-event places + mention-only places)",
      wrongUnionRows.length === 0 && missingUnionRows.length === 0,
      `unexpected: [${wrongUnionRows.join(", ")}] missing: [${missingUnionRows.join(", ")}]`,
    );
    check(
      `positive control: combined rows (${unionFiltered.length}) exceed each single-chip count (${birthPlaces.length}, ${mentionPlaces.length}) and stay below ${places.length}`,
      unionFiltered.length > birthPlaces.length &&
        unionFiltered.length > mentionPlaces.length &&
        unionFiltered.length < places.length,
    );

    // Restore the full table so later checks aren't affected.
    await page.click('button:text-is("Show all")');
    await guard.guarded(
      page.waitForFunction(
        (expected: number) =>
          document.querySelectorAll(
            '[data-testid="map-list-view"] table tbody tr',
          ).length === expected,
        places.length,
        { timeout: 10000 },
      ).catch(() => null),
    );
    const restoredAfterUnion = await page.evaluate(
      () =>
        document.querySelectorAll(
          '[data-testid="map-list-view"] table tbody tr',
        ).length,
    );
    check(
      `"Show all" restores every place after the combined filter (${restoredAfterUnion}/${places.length} rows)`,
      restoredAfterUnion === places.length,
    );

    // --- Follow a panel D.L. link: it must open the RIGHT passage ---
    // The panel checks above only assert the href SHAPE (/section/<id>).
    // A routing or sectionId regression could keep that shape intact while
    // landing readers on the wrong (or missing) passage page. Click one
    // link, wait for the SPA navigation, and assert the section page
    // renders the exact passage /api/sections/<id> describes.
    console.log("\nFollowing a panel D.L. link lands on the right passage");
    const followSectionId = selectSectionIds[0];
    const secRes = await fetch(
      `${BASE_URL}/api/sections/${encodeURIComponent(followSectionId)}`,
    );
    check(
      `GET /api/sections/${followSectionId} responds 200`,
      secRes.ok,
      `${secRes.status}`,
    );
    if (!secRes.ok) {
      console.error("cannot verify the passage page without the section API");
      process.exit(1);
    }
    const expectedSection = (await secRes.json()) as {
      id: string;
      urn: string;
      book: number;
      chapter: string;
      section: string;
      philosopher: string;
    };
    // Cross-check: the map event's D.L. ref must agree with the section's
    // own book/section numbering, or the link text itself is misleading.
    const followEvent = selectPlace.events.find(
      (e) => e.sectionId === followSectionId,
    ) as (MapEvent & { ref?: string }) | undefined;
    if (followEvent?.ref) {
      check(
        `map event ref "${followEvent.ref}" matches section ${expectedSection.book}.${expectedSection.section}`,
        followEvent.ref ===
          `${expectedSection.book}.${expectedSection.section}`,
      );
    }

    // Re-open the place panel (the legend checks above reset it) and click
    // the specific D.L. link for the sampled sectionId.
    await page.click(
      `[data-testid="map-list-place-${selectPlace.label.replace(/"/g, '\\"')}"]`,
    );
    await guard.guarded(
      page.waitForFunction(
        (label: string) =>
          Array.from(document.querySelectorAll("aside h2")).some(
            (h) => (h.textContent ?? "").trim() === label,
          ),
        selectPlace.label,
        { timeout: 15000 },
      ),
    );
    const linkSelector = `aside a[href$="/section/${followSectionId}"]`;
    const linkText = await page.evaluate(
      (sel: string) =>
        (document.querySelector(sel)?.textContent ?? "").trim(),
      linkSelector,
    );
    check(
      `panel link text cites a D.L. reference ("${linkText}")`,
      linkText.startsWith("D.L. "),
    );
    await page.click(linkSelector);
    await guard.guarded(
      page.waitForFunction(
        (sid: string) => window.location.pathname.endsWith(`/section/${sid}`),
        followSectionId,
        { timeout: 15000 },
      ),
    );
    // Wait for the passage to load (h1 is the philosopher name).
    await guard.guarded(
      page.waitForFunction(
        (name: string) =>
          (document.querySelector("h1")?.textContent ?? "").trim() === name,
        expectedSection.philosopher,
        { timeout: 30000 },
      ),
    );
    const sectionPage = await page.evaluate(() => ({
      h1: (document.querySelector("h1")?.textContent ?? "").trim(),
      bodyText: document.body.textContent ?? "",
      title: document.title,
    }));
    check(
      `section page h1 is the cited philosopher ("${expectedSection.philosopher}")`,
      sectionPage.h1 === expectedSection.philosopher,
      `h1=${sectionPage.h1}`,
    );
    const expectedRefLine = `Book ${expectedSection.book}, Chapter ${expectedSection.chapter}, Section ${expectedSection.section}`;
    check(
      `section page shows the D.L. reference line ("${expectedRefLine}")`,
      sectionPage.bodyText.includes(expectedRefLine),
    );
    check(
      `section page shows the CTS URN (${expectedSection.urn})`,
      sectionPage.bodyText.includes(expectedSection.urn),
    );
    check(
      `page title cites section id ${expectedSection.id}`,
      sectionPage.title.includes(expectedSection.id),
      `title=${sectionPage.title}`,
    );
    // Negative controls: prove the passage assertions can fire — a mutated
    // philosopher must NOT match the h1, and a mutated reference line must
    // NOT be found in the page.
    check(
      "negative control: a mutated philosopher name does NOT match the h1",
      sectionPage.h1 !== `${expectedSection.philosopher}-MUTATED-CONTROL`,
    );
    check(
      "negative control: a mutated reference line is NOT on the page",
      !sectionPage.bodyText.includes(
        `Book ${expectedSection.book}, Chapter ${expectedSection.chapter}, Section ${expectedSection.section}-MUTATED`,
      ),
    );

    // --- Positive controls: the run verified real substance ---
    check(
      `positive control: verified ${table.namesPresent.length} philosopher name(s) (> 0)`,
      table.namesPresent.length > 0,
    );
    const linksVerified =
      Number(!!table.pleiadesHref) + Number(!!table.qidHref);
    check(
      `positive control: verified ${linksVerified} gazetteer link(s) (2 expected)`,
      linksVerified === 2,
    );
    check(
      `positive control: verified ${journeys.renderedStops.length} ordered journey stop(s) (> 1)`,
      journeys.renderedStops.length > 1,
    );
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll map list-view checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
