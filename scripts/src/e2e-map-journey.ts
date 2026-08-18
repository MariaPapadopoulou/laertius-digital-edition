/// <reference lib="dom" />
/* Real-browser check: the Map page's life-journey mode. The bundle smoke
 * test verifies the journey API data end to end, but only a browser can
 * confirm the frontend actually draws it: /map?journey=Plato must render
 * the numbered stop markers and the route legs, hedged legs must render
 * dashed, and an unknown ?journey= value must degrade to the normal map
 * with a notice instead of a blank or broken state. The ?p= philosopher
 * focus mode is covered too: the banner count must match the API's place
 * set for that philosopher, the focused markers get the dark ring while
 * the rest dim, the sidebar floats the focused places first, the banner's
 * "Draw life journey" / "Show all places" buttons must switch modes and
 * clear the focus, and an unknown ?p= shows the no-mapped-places notice.
 *
 * Plato is the pinned journey because his stops exercise every drawing
 * rule at once: 8 stops, the first leg suppressed (two rival reported
 * birthplaces are never joined), the Aegina->Cyrene leg dashed (Aegina
 * rests only on a hedged account), and the remaining legs solid.
 *
 * Leaflet rendering notes the assertions rely on:
 * - numbered stops are divIcon markers in .leaflet-marker-pane whose html
 *   is a single <div> containing the stop number
 * - journey legs are SVG <path> elements with fill="none" in the overlay
 *   pane; place circle markers are also paths there but always carry a
 *   fill colour, so fill="none" isolates the legs
 * - a dashed leg carries stroke-dasharray="6 6"
 *
 * Needs the api-server and web workflows running plus the headless
 * Chromium shell installed (same setup as e2e-nav-reset). */

// playwright-core resolves its browser registry at import time from
// PLAYWRIGHT_BROWSERS_PATH; pick a candidate that actually holds a
// chromium install BEFORE importing it (same dance as e2e-nav-reset).
import "./lib/playwright-browsers-path";
import {
  CARD_HEADING_SELECTOR,
  PAGE_HEADING_SELECTOR,
} from "./lib/card-headings";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:80";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    // Fail fast with the failing URL/status instead of an opaque selector
    // timeout when the site itself fails to boot.
    const guard = attachPageGuard(page);

    console.log("Scenario 1: /map?journey=Plato draws the journey");
    await page.goto(`${BASE}/map?journey=Plato`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();
    // The journey layer mounts after both the places and the itineraries
    // queries resolve; wait for the numbered markers to appear.
    await guard.guarded(
      page.waitForFunction(
        () =>
          document.querySelectorAll(
            ".leaflet-marker-pane .leaflet-marker-icon div",
          ).length >= 2,
        undefined,
        { timeout: 20000 },
      ),
    );

    const drawn = await page.evaluate(() => {
      const numbers = Array.from(
        document.querySelectorAll(
          ".leaflet-marker-pane .leaflet-marker-icon div",
        ),
      )
        .map((el) => (el.textContent ?? "").trim())
        .filter((t) => /^\d+$/.test(t))
        .map(Number)
        .sort((a, b) => a - b);
      const paths = Array.from(
        document.querySelectorAll(".leaflet-overlay-pane svg path"),
      );
      const legs = paths.filter((p) => p.getAttribute("fill") === "none");
      const dashedLegs = legs.filter((p) =>
        (p.getAttribute("stroke-dasharray") ?? "").trim().length > 0,
      );
      const select = document.querySelector(
        "#journey-select",
      ) as HTMLSelectElement | null;
      return {
        numbers,
        legCount: legs.length,
        dashedCount: dashedLegs.length,
        selectValue: select?.value ?? null,
        journeyParam: new URLSearchParams(window.location.search).get(
          "journey",
        ),
      };
    });
    check(
      "all 8 numbered stops render in order",
      drawn.numbers.length === 8 &&
        drawn.numbers.every((n, i) => n === i + 1),
      `numbers=${JSON.stringify(drawn.numbers)}`,
    );
    // 8 stops give 7 candidate legs; the rival-birthplace leg (Athens ->
    // Aegina, both birthPlace) is suppressed, leaving 6.
    check(
      "route legs render (rival-birthplace leg suppressed)",
      drawn.legCount === 6,
      `legs=${drawn.legCount}`,
    );
    check(
      "exactly the hedged Aegina->Cyrene leg renders dashed",
      drawn.dashedCount === 1,
      `dashed=${drawn.dashedCount}`,
    );
    check(
      "journey dropdown reflects the URL",
      drawn.selectValue === "Plato",
      `value=${drawn.selectValue}`,
    );
    check(
      "?journey=Plato stays in the URL",
      drawn.journeyParam === "Plato",
      `journey=${drawn.journeyParam}`,
    );

    const sidePanel = await page.evaluate(() => {
      const body = document.body.textContent ?? "";
      // The stop list renders each place name as a button inside the
      // ordered list in the aside; capture them in order so the click
      // scenario can assert against the real first stop's place.
      const stopButtons = Array.from(
        document.querySelectorAll("aside ol li button"),
      ).map((el) => (el.textContent ?? "").trim());
      return {
        hasHeading: body.includes("Plato\u2019s journey"),
        stopPlaces: stopButtons,
      };
    });
    check("side panel shows the journey stop list", sidePanel.hasHeading);
    check(
      "stop list names all 8 places",
      sidePanel.stopPlaces.length === 8,
      `places=${JSON.stringify(sidePanel.stopPlaces)}`,
    );

    console.log(
      "Scenario 2: clicking a numbered stop opens that place's details",
    );
    const firstStopPlace = sidePanel.stopPlaces[0] ?? "";
    // Click the numbered marker whose divIcon text is exactly "1".
    // Neighbouring stops can overlap at the framed zoom (stop 2's icon
    // intercepts a coordinate-based click on stop 1), so dispatch the
    // click on the marker element itself; Leaflet's handler is bound to
    // that element, so this is the same code path as a real click.
    await page
      .locator(".leaflet-marker-pane .leaflet-marker-icon", {
        hasText: /^1$/,
      })
      .first()
      .dispatchEvent("click");
    await page.waitForFunction(
      () => document.querySelector("aside h2") !== null,
      undefined,
      { timeout: 10000 },
    );
    const panel = await page.evaluate(() => {
      const h2 = document.querySelector("aside h2");
      const sectionLinks = Array.from(
        document.querySelectorAll('aside a[href^="/section/"]'),
      ).length;
      const graphLinks = Array.from(
        document.querySelectorAll('aside a[href^="/graph?p="]'),
      ).length;
      return {
        heading: (h2?.textContent ?? "").trim(),
        sectionLinks,
        graphLinks,
        journeyParam: new URLSearchParams(window.location.search).get(
          "journey",
        ),
      };
    });
    check(
      "place panel opens for the clicked stop's place",
      panel.heading === firstStopPlace,
      `heading=${panel.heading} expected=${firstStopPlace}`,
    );
    check(
      "panel shows section links for the place's citations/mentions",
      panel.sectionLinks > 0,
      `sectionLinks=${panel.sectionLinks}`,
    );
    check(
      "panel links the philosophers behind the place",
      panel.graphLinks > 0,
      `graphLinks=${panel.graphLinks}`,
    );
    check(
      "?journey= survives selecting a stop",
      panel.journeyParam === "Plato",
      `journey=${panel.journeyParam}`,
    );
    // Close the panel so the journey stop list (and its Close button)
    // does not shadow the toolbar's "Clear journey" button text match.
    await page.getByRole("button", { name: "Close" }).first().click();

    console.log(
      "Scenario 3: Clear journey removes the layer and drops ?journey=",
    );
    await page.getByRole("button", { name: "Clear journey" }).click();
    await page.waitForFunction(
      () =>
        Array.from(
          document.querySelectorAll(
            ".leaflet-marker-pane .leaflet-marker-icon div",
          ),
        ).filter((el) => /^\d+$/.test((el.textContent ?? "").trim()))
          .length === 0,
      undefined,
      { timeout: 10000 },
    );
    const cleared = await page.evaluate(() => {
      const paths = Array.from(
        document.querySelectorAll(".leaflet-overlay-pane svg path"),
      );
      const select = document.querySelector(
        "#journey-select",
      ) as HTMLSelectElement | null;
      return {
        legCount: paths.filter((p) => p.getAttribute("fill") === "none")
          .length,
        journeyParam: new URLSearchParams(window.location.search).get(
          "journey",
        ),
        selectValue: select?.value ?? null,
      };
    });
    check(
      "route legs removed after Clear journey",
      cleared.legCount === 0,
      `legs=${cleared.legCount}`,
    );
    check(
      "?journey= dropped from the URL",
      cleared.journeyParam === null,
      `journey=${cleared.journeyParam}`,
    );
    check(
      "dropdown resets to the placeholder",
      cleared.selectValue === "",
      `value=${cleared.selectValue}`,
    );

    console.log(
      "Scenario 4: picking a philosopher in the dropdown draws the journey",
    );
    await page.selectOption("#journey-select", "Plato");
    await page.waitForFunction(
      () =>
        Array.from(
          document.querySelectorAll(
            ".leaflet-marker-pane .leaflet-marker-icon div",
          ),
        ).filter((el) => /^\d+$/.test((el.textContent ?? "").trim()))
          .length >= 2,
      undefined,
      { timeout: 10000 },
    );
    const reselected = await page.evaluate(() => {
      const numbered = Array.from(
        document.querySelectorAll(
          ".leaflet-marker-pane .leaflet-marker-icon div",
        ),
      ).filter((el) => /^\d+$/.test((el.textContent ?? "").trim()));
      const legs = Array.from(
        document.querySelectorAll(".leaflet-overlay-pane svg path"),
      ).filter((p) => p.getAttribute("fill") === "none");
      return {
        stops: numbered.length,
        legs: legs.length,
        journeyParam: new URLSearchParams(window.location.search).get(
          "journey",
        ),
      };
    });
    check(
      "dropdown selection draws all 8 stops",
      reselected.stops === 8,
      `stops=${reselected.stops}`,
    );
    check(
      "dropdown selection draws the 6 legs",
      reselected.legs === 6,
      `legs=${reselected.legs}`,
    );
    check(
      "dropdown selection sets ?journey= in the URL",
      reselected.journeyParam === "Plato",
      `journey=${reselected.journeyParam}`,
    );

    console.log(
      "Scenario 5: unknown ?journey= degrades to the normal map",
    );
    await page.goto(`${BASE}/map?journey=Nobody`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();
    // The normal map must still come up: wait for the place circle
    // markers (filled interactive paths in the overlay pane).
    await guard.guarded(
      page.waitForFunction(
        () =>
          Array.from(
            document.querySelectorAll(".leaflet-overlay-pane svg path"),
          ).filter((p) => p.getAttribute("fill") !== "none").length > 50,
        undefined,
        { timeout: 20000 },
      ),
    );

    const fallback = await page.evaluate(() => {
      const numbered = Array.from(
        document.querySelectorAll(
          ".leaflet-marker-pane .leaflet-marker-icon div",
        ),
      ).filter((el) => /^\d+$/.test((el.textContent ?? "").trim()));
      const paths = Array.from(
        document.querySelectorAll(".leaflet-overlay-pane svg path"),
      );
      return {
        numberedStops: numbered.length,
        legCount: paths.filter((p) => p.getAttribute("fill") === "none")
          .length,
        placeMarkers: paths.filter((p) => p.getAttribute("fill") !== "none")
          .length,
        hasNotice: (document.body.textContent ?? "").includes(
          "No mapped journey for",
        ),
      };
    });
    check(
      "no numbered stops for the unknown name",
      fallback.numberedStops === 0,
      `stops=${fallback.numberedStops}`,
    );
    check(
      "no route legs for the unknown name",
      fallback.legCount === 0,
      `legs=${fallback.legCount}`,
    );
    check(
      "place markers still render (map is not blank)",
      fallback.placeMarkers > 50,
      `markers=${fallback.placeMarkers}`,
    );
    check(
      "a 'No mapped journey' notice explains the state",
      fallback.hasNotice,
    );

    // The legend scenarios pin their expected marker counts against the
    // live API data, so a chip click is checked against the same numbers
    // the toolbar summary derives from.
    const apiPlaces = (await (
      await fetch(`${BASE}/api/map/places`)
    ).json()) as {
      label: string;
      events: {
        property: string;
        philosopher: string;
        ref: string;
        sectionId?: string;
      }[];
      mentions?: { count: number }[];
    }[];
    const totalPlaces = apiPlaces.length;
    const birthPlaces = apiPlaces.filter((p) =>
      p.events.some((e) => e.property === "birthPlace"),
    ).length;
    const mentionOnly = apiPlaces.find((p) => p.events.length === 0);

    // Reads the toolbar summary's leading "<n> places" figure and counts
    // the filled circle markers actually drawn in the overlay pane.
    const readMapState = () =>
      page.evaluate(() => {
        const summary = Array.from(document.querySelectorAll("span")).find(
          (el) => /\d+ places ·/.test(el.textContent ?? ""),
        );
        const m = (summary?.textContent ?? "").match(/(\d+) places ·/);
        return {
          summaryPlaces: m ? Number(m[1]) : null,
          markers: Array.from(
            document.querySelectorAll(".leaflet-overlay-pane svg path"),
          ).filter((p) => p.getAttribute("fill") !== "none").length,
          panelHeading:
            (document.querySelector("aside h2")?.textContent ?? "").trim() ||
            null,
        };
      });

    console.log(
      "Scenario 6: a legend chip filters the markers to that kind",
    );
    await page.goto(`${BASE}/map`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        (n) =>
          Array.from(
            document.querySelectorAll(".leaflet-overlay-pane svg path"),
          ).filter((p) => p.getAttribute("fill") !== "none").length === n,
        totalPlaces,
        { timeout: 20000 },
      ),
    );
    const baseline = await readMapState();
    check(
      "unfiltered map draws every place the API serves",
      baseline.markers === totalPlaces &&
        baseline.summaryPlaces === totalPlaces,
      `markers=${baseline.markers} summary=${baseline.summaryPlaces} api=${totalPlaces}`,
    );

    await page.getByRole("button", { name: "Births" }).click();
    await page.waitForFunction(
      (n) =>
        Array.from(
          document.querySelectorAll(".leaflet-overlay-pane svg path"),
        ).filter((p) => p.getAttribute("fill") !== "none").length === n,
      birthPlaces,
      { timeout: 10000 },
    );
    const filtered = await readMapState();
    check(
      "Births chip drops the markers to the birthplace count",
      filtered.markers === birthPlaces && birthPlaces < totalPlaces,
      `markers=${filtered.markers} expected=${birthPlaces}`,
    );
    check(
      "toolbar summary agrees with the drawn marker count",
      filtered.summaryPlaces === filtered.markers,
      `summary=${filtered.summaryPlaces} markers=${filtered.markers}`,
    );

    console.log("Scenario 7: Show all restores the full marker set");
    await page.getByRole("button", { name: "Show all", exact: true }).click();
    await page.waitForFunction(
      (n) =>
        Array.from(
          document.querySelectorAll(".leaflet-overlay-pane svg path"),
        ).filter((p) => p.getAttribute("fill") !== "none").length === n,
      totalPlaces,
      { timeout: 10000 },
    );
    const restored = await readMapState();
    check(
      "Show all restores every marker and the summary count",
      restored.markers === totalPlaces &&
        restored.summaryPlaces === totalPlaces,
      `markers=${restored.markers} summary=${restored.summaryPlaces}`,
    );

    console.log(
      "Scenario 8: filtering out the selected place closes its panel",
    );
    check(
      "a mention-only place exists to select",
      mentionOnly !== undefined,
    );
    if (mentionOnly) {
      // Select it from the sidebar list (same setSelected path as the
      // marker click, without hunting for an unlabeled circle).
      await page
        .locator("aside ul li button", { hasText: mentionOnly.label })
        .first()
        .click();
      await page.waitForFunction(
        (label) =>
          (document.querySelector("aside h2")?.textContent ?? "").trim() ===
          label,
        mentionOnly.label,
        { timeout: 10000 },
      );
      await page.getByRole("button", { name: "Births" }).click();
      await page.waitForFunction(
        (label) =>
          (document.querySelector("aside h2")?.textContent ?? "").trim() !==
          label,
        mentionOnly.label,
        { timeout: 10000 },
      );
      const afterHide = await readMapState();
      check(
        "hidden selection closes the side panel",
        afterHide.panelHeading !== mentionOnly.label,
        `heading=${afterHide.panelHeading}`,
      );
      await page
        .getByRole("button", { name: "Show all", exact: true })
        .click();
    }

    console.log(
      "Scenario 9: a filtered-out journey stop keeps its panel open",
    );
    await page.goto(`${BASE}/map?journey=Plato`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        () =>
          document.querySelectorAll(
            ".leaflet-marker-pane .leaflet-marker-icon div",
          ).length >= 2,
        undefined,
        { timeout: 20000 },
      ),
    );
    await page
      .locator(".leaflet-marker-pane .leaflet-marker-icon", {
        hasText: /^1$/,
      })
      .first()
      .dispatchEvent("click");
    await page.waitForFunction(
      () => document.querySelector("aside h2") !== null,
      undefined,
      { timeout: 10000 },
    );
    const stopHeading = await page.evaluate(() =>
      (document.querySelector("aside h2")?.textContent ?? "").trim(),
    );
    // "Mentioned" hides every event-bearing place, including the stop's,
    // but journey stops stay selected regardless of the legend filter.
    await page.getByRole("button", { name: "Mentioned" }).click();
    await page.waitForFunction(
      (n) =>
        Array.from(
          document.querySelectorAll(".leaflet-overlay-pane svg path"),
        ).filter((p) => p.getAttribute("fill") !== "none").length < n,
      totalPlaces,
      { timeout: 10000 },
    );
    const journeyFiltered = await readMapState();
    check(
      "journey stop's panel survives the legend filter",
      journeyFiltered.panelHeading === stopHeading,
      `heading=${journeyFiltered.panelHeading} expected=${stopHeading}`,
    );
    const numberedLeft = await page.evaluate(
      () =>
        Array.from(
          document.querySelectorAll(
            ".leaflet-marker-pane .leaflet-marker-icon div",
          ),
        ).filter((el) => /^\d+$/.test((el.textContent ?? "").trim())).length,
    );
    check(
      "numbered journey stops stay drawn under the filter",
      numberedLeft === 8,
      `stops=${numberedLeft}`,
    );

    console.log(
      "Scenario 10: clicking a place circle marker on the plain map opens its panel",
    );
    // Pick the place deterministically: the busiest event-bearing one.
    const busiest = apiPlaces.reduce((a, b) =>
      b.events.length > a.events.length ? b : a,
    );
    await page.goto(`${BASE}/map`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        (n) =>
          Array.from(
            document.querySelectorAll(".leaflet-overlay-pane svg path"),
          ).filter((p) => p.getAttribute("fill") !== "none").length === n,
        totalPlaces,
        { timeout: 20000 },
      ),
    );
    // Circle markers carry no label in the DOM; identify the busiest
    // place's path by hovering each filled path and reading the Leaflet
    // tooltip it opens ("<label> · <n>"), then dispatch the click on the
    // matched path element (the same element Leaflet's click handler is
    // bound to).
    const clickedLabel = await page.evaluate((label) => {
      const paths = Array.from(
        document.querySelectorAll<SVGPathElement>(
          ".leaflet-overlay-pane svg path",
        ),
      ).filter((p) => p.getAttribute("fill") !== "none");
      // No helper function here: tsx's esbuild transform decorates named
      // inner functions with a __name helper that does not exist inside
      // the page, so keep the evaluate body helper-free.
      for (const p of paths) {
        p.dispatchEvent(
          new MouseEvent("mouseover", { bubbles: true, cancelable: true }),
        );
        const tip = (
          document.querySelector(".leaflet-tooltip")?.textContent ?? ""
        ).trim();
        p.dispatchEvent(
          new MouseEvent("mouseout", { bubbles: true, cancelable: true }),
        );
        if (tip.startsWith(`${label} \u00b7`)) {
          p.dispatchEvent(
            new MouseEvent("click", { bubbles: true, cancelable: true }),
          );
          return tip;
        }
      }
      return null;
    }, busiest.label);
    check(
      "the busiest place's circle marker was found via its tooltip",
      clickedLabel !== null,
      `label=${busiest.label}`,
    );
    await page.waitForFunction(
      (label) =>
        (document.querySelector("aside h2")?.textContent ?? "").trim() ===
        label,
      busiest.label,
      { timeout: 10000 },
    );
    const placePanel = await page.evaluate(([cardHeadingSel, pageHeadingSel]) => {
      const aside = document.querySelector("aside");
      return {
        heading: (aside?.querySelector(pageHeadingSel)?.textContent ?? "").trim(),
        eventGroups: Array.from(aside?.querySelectorAll(cardHeadingSel) ?? [])
          .map((el) => (el.textContent ?? "").trim())
          .filter((t) => t.length > 0),
        sectionLinks: aside
          ? aside.querySelectorAll('a[href^="/section/"]').length
          : 0,
      };
    }, [CARD_HEADING_SELECTOR, PAGE_HEADING_SELECTOR] as const);
    check(
      "side panel opens with the clicked place's heading",
      placePanel.heading === busiest.label,
      `heading=${placePanel.heading} expected=${busiest.label}`,
    );
    check(
      "panel shows at least one event group",
      placePanel.eventGroups.length > 0,
      `groups=${JSON.stringify(placePanel.eventGroups)}`,
    );
    check(
      "panel shows section links for the cited passages",
      placePanel.sectionLinks > 0,
      `sectionLinks=${placePanel.sectionLinks}`,
    );
    await page.getByRole("button", { name: "Close" }).first().click();
    // The plain-map sidebar's "Places" list heading is itself an <h2>,
    // so wait for the heading text to flip rather than for h2 removal.
    await page.waitForFunction(
      () =>
        (document.querySelector("aside h2")?.textContent ?? "").trim() ===
        "Places",
      undefined,
      { timeout: 10000 },
    );
    const afterClose = await page.evaluate((sel) => {
      const aside = document.querySelector("aside");
      return {
        heading: (aside?.querySelector(sel)?.textContent ?? "").trim(),
        listItems: aside ? aside.querySelectorAll("ul li button").length : 0,
      };
    }, PAGE_HEADING_SELECTOR);
    check(
      "Close returns to the Places list",
      afterClose.heading === "Places" && afterClose.listItems > 0,
      `heading=${afterClose.heading} items=${afterClose.listItems}`,
    );

    console.log(
      "Scenario 11: a place panel's philosopher link selects them on the Graph page",
    );
    // The link target must survive URL encoding, so pick (deterministically)
    // the first philosopher at the busiest place whose name needs encoding
    // (spaces, e.g. "Zeno of Citium"), falling back to the first event's
    // philosopher if none does.
    const encodable = busiest.events
      .map((e) => e.philosopher)
      .find((n) => encodeURIComponent(n) !== n);
    const target = encodable ?? busiest.events[0].philosopher;
    check(
      "the busiest place cites a philosopher whose name needs URL encoding",
      encodable !== undefined,
      `place=${busiest.label}`,
    );
    // Reopen the place panel from the sidebar list (same setSelected path
    // as the marker click, already exercised in scenario 10).
    await page
      .locator("aside ul li button", { hasText: busiest.label })
      .first()
      .click();
    await page.waitForFunction(
      (label) =>
        (document.querySelector("aside h2")?.textContent ?? "").trim() ===
        label,
      busiest.label,
      { timeout: 10000 },
    );
    const linkHref = await page.evaluate((name) => {
      const link = Array.from(
        document.querySelectorAll<HTMLAnchorElement>(
          'aside a[href^="/graph?p="]',
        ),
      ).find((a) => (a.textContent ?? "").trim() === name);
      return link?.getAttribute("href") ?? null;
    }, target);
    check(
      "the philosopher link carries the URL-encoded ?p= target",
      linkHref === `/graph?p=${encodeURIComponent(target)}`,
      `href=${linkHref} expected=/graph?p=${encodeURIComponent(target)}`,
    );
    await page
      .locator('aside a[href^="/graph?p="]', { hasText: target })
      .first()
      .click();
    // The Graph page adopts ?p= into its selection: wait until the side
    // panel heading shows the philosopher's name.
    await page.waitForFunction(
      ([name, sel]) =>
        window.location.pathname === "/graph" &&
        Array.from(document.querySelectorAll(sel)).some(
          (h) => (h.textContent ?? "").trim() === name,
        ),
      [target, PAGE_HEADING_SELECTOR] as const,
      { timeout: 20000 },
    );
    const graphState = await page.evaluate(([name, sel]) => {
      // The selected node's <g> holds a <circle> with the selection ring
      // (stroke-width 2.5) and a <text> label with the node name.
      const rings = Array.from(
        document.querySelectorAll("svg g circle"),
      ).filter(
        (c) => parseFloat(c.getAttribute("stroke-width") ?? "0") > 2,
      );
      const ringNames = rings.map((c) =>
        (c.parentElement?.querySelector("text")?.textContent ?? "").trim(),
      );
      return {
        pathname: window.location.pathname,
        pParam: new URLSearchParams(window.location.search).get("p"),
        ringNames,
        panelHasName: Array.from(document.querySelectorAll(sel)).some(
          (h) => (h.textContent ?? "").trim() === name,
        ),
      };
    }, [target, PAGE_HEADING_SELECTOR] as const);
    check(
      "the link lands on /graph with ?p= set to the philosopher",
      graphState.pathname === "/graph" && graphState.pParam === target,
      `pathname=${graphState.pathname} p=${graphState.pParam}`,
    );
    check(
      "the Graph side panel opens with the philosopher's name",
      graphState.panelHasName,
      `name=${target}`,
    );
    check(
      "exactly that philosopher's node carries the selection ring",
      graphState.ringNames.length === 1 && graphState.ringNames[0] === target,
      `rings=${JSON.stringify(graphState.ringNames)}`,
    );

    console.log(
      "Scenario 12: Show names labels track the markers under a legend filter",
    );
    // Counts the permanent name labels ("Show names" tooltips carry the
    // map-name-label class) and the filled circle markers together.
    const readLabelState = () =>
      page.evaluate(() => ({
        labels: document.querySelectorAll(
          ".leaflet-tooltip-pane .map-name-label",
        ).length,
        markers: Array.from(
          document.querySelectorAll(".leaflet-overlay-pane svg path"),
        ).filter((p) => p.getAttribute("fill") !== "none").length,
      }));
    await page.goto(`${BASE}/map`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        (n) =>
          Array.from(
            document.querySelectorAll(".leaflet-overlay-pane svg path"),
          ).filter((p) => p.getAttribute("fill") !== "none").length === n,
        totalPlaces,
        { timeout: 20000 },
      ),
    );
    const namesToggle = page.getByRole("button", {
      name: "Show names",
      exact: true,
    });
    await namesToggle.click();
    await page.waitForFunction(
      (n) =>
        document.querySelectorAll(".leaflet-tooltip-pane .map-name-label")
          .length === n,
      totalPlaces,
      { timeout: 10000 },
    );
    const namedFull = await readLabelState();
    check(
      "Show names labels every marker on the unfiltered map",
      namedFull.labels === totalPlaces && namedFull.markers === totalPlaces,
      `labels=${namedFull.labels} markers=${namedFull.markers} api=${totalPlaces}`,
    );

    // Apply the Births chip while names are on: the label count must
    // follow the visible markers down to the live birthplace count, no
    // orphaned labels for hidden markers, no unlabeled visible ones.
    await page.getByRole("button", { name: "Births" }).click();
    await page.waitForFunction(
      (n) =>
        Array.from(
          document.querySelectorAll(".leaflet-overlay-pane svg path"),
        ).filter((p) => p.getAttribute("fill") !== "none").length === n,
      birthPlaces,
      { timeout: 10000 },
    );
    // Leaflet fades removed tooltips out, so labels of hidden markers
    // linger in the DOM for a moment; wait for the count to settle
    // before asserting (a real orphan would never drop and time out).
    await page.waitForFunction(
      (n) =>
        document.querySelectorAll(".leaflet-tooltip-pane .map-name-label")
          .length === n,
      birthPlaces,
      { timeout: 10000 },
    );
    const namedFiltered = await readLabelState();
    check(
      "filtered label count equals the visible marker count",
      namedFiltered.labels === namedFiltered.markers &&
        namedFiltered.labels === birthPlaces &&
        birthPlaces < totalPlaces,
      `labels=${namedFiltered.labels} markers=${namedFiltered.markers} expected=${birthPlaces}`,
    );

    // Toggling names off must clear every label even while filtered.
    await namesToggle.click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll(".leaflet-tooltip-pane .map-name-label")
          .length === 0,
      undefined,
      { timeout: 10000 },
    );
    const namesOff = await readLabelState();
    check(
      "toggling names off clears every label under the filter",
      namesOff.labels === 0 && namesOff.markers === birthPlaces,
      `labels=${namesOff.labels} markers=${namesOff.markers}`,
    );

    // Names back on, then Show all: the labels must come back for the
    // full place set.
    await namesToggle.click();
    await page.waitForFunction(
      (n) =>
        document.querySelectorAll(".leaflet-tooltip-pane .map-name-label")
          .length === n,
      birthPlaces,
      { timeout: 10000 },
    );
    await page.getByRole("button", { name: "Show all", exact: true }).click();
    await page.waitForFunction(
      (n) =>
        document.querySelectorAll(".leaflet-tooltip-pane .map-name-label")
          .length === n,
      totalPlaces,
      { timeout: 10000 },
    );
    const namedRestored = await readLabelState();
    check(
      "Show all with names on restores a label for every place",
      namedRestored.labels === totalPlaces &&
        namedRestored.markers === totalPlaces,
      `labels=${namedRestored.labels} markers=${namedRestored.markers}`,
    );

    console.log(
      "Scenario 13: Show names also labels the numbered journey stops",
    );
    // Plato's journey has 8 numbered stops; with names on, the stop
    // markers each carry a permanent name label, and the circle place
    // markers underneath a stop drop their own permanent label so the
    // two never stack (the stop's label is the only one at that spot).
    await page.goto(`${BASE}/map?journey=Plato`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        () =>
          document.querySelectorAll(
            ".leaflet-marker-pane .leaflet-marker-icon div",
          ).length === 8,
        undefined,
        { timeout: 20000 },
      ),
    );
    const stopPlaces = await page.evaluate(() =>
      Array.from(document.querySelectorAll("aside ol li button")).map(
        (el) => (el.textContent ?? "").trim(),
      ),
    );
    const distinctStopPlaces = new Set(stopPlaces).size;
    const journeyLabelCount = totalPlaces - distinctStopPlaces + 8;
    await page
      .getByRole("button", { name: "Show names", exact: true })
      .click();
    await page.waitForFunction(
      (n) =>
        document.querySelectorAll(".leaflet-tooltip-pane .map-name-label")
          .length === n,
      journeyLabelCount,
      { timeout: 10000 },
    );
    const journeyNamed = await page.evaluate(() => {
      const labels = Array.from(
        document.querySelectorAll(".leaflet-tooltip-pane .map-name-label"),
      ).map((el) => (el.textContent ?? "").trim());
      return { labels };
    });
    check(
      "every journey stop's place name appears among the labels",
      stopPlaces.length === 8 &&
        stopPlaces.every((p) => journeyNamed.labels.includes(p)),
      `stops=${JSON.stringify(stopPlaces)}`,
    );
    // The dedupe: a stop's place name must appear exactly as often as
    // its numbered stops (no second label from the circle marker).
    const stopCounts = new Map<string, number>();
    for (const p of stopPlaces) {
      stopCounts.set(p, (stopCounts.get(p) ?? 0) + 1);
    }
    const stacked = [...stopCounts.entries()].filter(
      ([p, n]) =>
        journeyNamed.labels.filter((l) => l === p).length !== n,
    );
    check(
      "no stop place carries a stacked circle-marker label",
      stacked.length === 0,
      `stacked=${JSON.stringify(stacked)}`,
    );

    // The circle marker under a numbered stop dropped its permanent
    // label, but it must still answer a hover with the count tooltip
    // ("<place> · <n>") — otherwise stop places would have no way to
    // show their event/mention counts while names are on. Pick stop 1,
    // find the circle path whose bounding box centres on that stop's
    // icon, and fire a synthetic mouseover straight at the path (the
    // divIcon sits on top, so a real pointer move would hit it instead).
    const hoveredStopPlace = stopPlaces[0];
    const hoverTooltip = await page.evaluate(() => {
      const icons = Array.from(
        document.querySelectorAll(
          ".leaflet-marker-pane .leaflet-marker-icon div",
        ),
      );
      const stopIcon = icons.find(
        (el) => (el.textContent ?? "").trim() === "1",
      );
      if (!stopIcon) return { error: "stop icon 1 not found" };
      const r = stopIcon.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const circles = Array.from(
        document.querySelectorAll(".leaflet-overlay-pane svg path"),
      ).filter((p) => p.getAttribute("fill") !== "none");
      let best: Element | null = null;
      let bestDist = Infinity;
      for (const c of circles) {
        const b = c.getBoundingClientRect();
        const dx = b.left + b.width / 2 - cx;
        const dy = b.top + b.height / 2 - cy;
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      if (!best) return { error: "no circle marker paths found" };
      best.dispatchEvent(
        new MouseEvent("mouseover", { bubbles: true }),
      );
      const hover = Array.from(
        document.querySelectorAll(".leaflet-tooltip-pane .leaflet-tooltip"),
      ).find((el) => !el.classList.contains("map-name-label"));
      const text = (hover?.textContent ?? "").trim();
      best.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
      return { text, dist: Math.sqrt(bestDist) };
    });
    check(
      "hovering the stop's circle marker shows the count tooltip",
      !("error" in hoverTooltip) &&
        new RegExp(
          `^${hoveredStopPlace.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} · \\d+`,
        ).test(hoverTooltip.text ?? ""),
      JSON.stringify(hoverTooltip),
    );

    // Toggle off: the stop labels must vanish with the marker labels.
    await page
      .getByRole("button", { name: "Show names", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll(".leaflet-tooltip-pane .map-name-label")
          .length === 0,
      undefined,
      { timeout: 10000 },
    );
    const journeyNamesOff = await page.evaluate(
      () =>
        document.querySelectorAll(".leaflet-tooltip-pane .map-name-label")
          .length,
    );
    check(
      "toggling names off clears the stop labels too",
      journeyNamesOff === 0,
      `labels=${journeyNamesOff}`,
    );

    // Names back on, then Clear journey: the 8 stop labels must go
    // with the layer (no orphaned permanent tooltips), leaving exactly
    // one label per place marker.
    await page
      .getByRole("button", { name: "Show names", exact: true })
      .click();
    await page.waitForFunction(
      (n) =>
        document.querySelectorAll(".leaflet-tooltip-pane .map-name-label")
          .length === n,
      journeyLabelCount,
      { timeout: 10000 },
    );
    await page
      .getByRole("button", { name: "Clear journey", exact: true })
      .click();
    await page.waitForFunction(
      (n) =>
        document.querySelectorAll(".leaflet-tooltip-pane .map-name-label")
          .length === n,
      totalPlaces,
      { timeout: 10000 },
    );
    const clearedLabels = await readLabelState();
    check(
      "clearing the journey leaves no orphaned stop labels",
      clearedLabels.labels === totalPlaces &&
        clearedLabels.markers === totalPlaces,
      `labels=${clearedLabels.labels} markers=${clearedLabels.markers}`,
    );
    // The hovered stop place must be back to a permanent name label
    // (its circle marker owns the label again once no journey is drawn).
    const restoredLabelNames = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll(".leaflet-tooltip-pane .map-name-label"),
      ).map((el) => (el.textContent ?? "").trim()),
    );
    check(
      "the hovered stop place regains its permanent name label after Clear journey",
      restoredLabelNames.includes(hoveredStopPlace),
      `place=${hoveredStopPlace}`,
    );

    console.log(
      "Scenario 14: ?p=Plato highlights that philosopher's places",
    );
    // The expected focus set comes from the same API the page reads:
    // every place whose events name Plato.
    const focusLabels = apiPlaces
      .filter((p) => p.events.some((e) => e.philosopher === "Plato"))
      .map((p) => p.label);
    check(
      "the API cites located life events for Plato",
      focusLabels.length > 0,
      `focus=${focusLabels.length}`,
    );
    await page.goto(`${BASE}/map?p=Plato`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        (n) =>
          Array.from(
            document.querySelectorAll(".leaflet-overlay-pane svg path"),
          ).filter((p) => p.getAttribute("fill") !== "none").length === n,
        totalPlaces,
        { timeout: 20000 },
      ),
    );
    // Focused circle markers carry the dark ring (stroke #1e293b, weight
    // 3); every other marker is dimmed to stroke-opacity 0.3. Give the
    // focus styling pass a moment to apply after the markers mount.
    await page.waitForFunction(
      (n) =>
        Array.from(
          document.querySelectorAll(".leaflet-overlay-pane svg path"),
        ).filter(
          (p) =>
            p.getAttribute("fill") !== "none" &&
            (p.getAttribute("stroke") ?? "").toLowerCase() === "#1e293b",
        ).length === n,
      focusLabels.length,
      { timeout: 10000 },
    );
    const focusState = await page.evaluate((focusCount) => {
      const markers = Array.from(
        document.querySelectorAll(".leaflet-overlay-pane svg path"),
      ).filter((p) => p.getAttribute("fill") !== "none");
      const focused = markers.filter(
        (p) => (p.getAttribute("stroke") ?? "").toLowerCase() === "#1e293b",
      );
      const heavyRinged = focused.filter(
        (p) => p.getAttribute("stroke-width") === "3",
      );
      const dimmed = markers.filter(
        (p) => p.getAttribute("stroke-opacity") === "0.3",
      );
      const banner = (document.body.textContent ?? "").match(
        /Highlighting the (\d+) places? associated with Plato/,
      );
      const sidebarLabels = Array.from(
        document.querySelectorAll("aside ul li button .truncate"),
      ).map((el) => (el.textContent ?? "").trim());
      const sidebarHeading = (
        document.querySelector("aside h2")?.textContent ?? ""
      ).trim();
      return {
        markerCount: markers.length,
        focusedCount: focused.length,
        heavyRinged: heavyRinged.length,
        dimmedCount: dimmed.length,
        bannerCount: banner ? Number(banner[1]) : null,
        sidebarHeading,
        sidebarFirst: sidebarLabels.slice(0, focusCount),
        sidebarTotal: sidebarLabels.length,
        pParam: new URLSearchParams(window.location.search).get("p"),
      };
    }, focusLabels.length);
    check(
      "banner count matches the API's Plato place count",
      focusState.bannerCount === focusLabels.length,
      `banner=${focusState.bannerCount} api=${focusLabels.length}`,
    );
    check(
      "exactly the focused markers carry the dark focus ring",
      focusState.focusedCount === focusLabels.length &&
        focusState.heavyRinged === focusLabels.length,
      `focused=${focusState.focusedCount} weight3=${focusState.heavyRinged} expected=${focusLabels.length}`,
    );
    check(
      "every other marker is dimmed",
      focusState.dimmedCount === totalPlaces - focusLabels.length,
      `dimmed=${focusState.dimmedCount} expected=${totalPlaces - focusLabels.length}`,
    );
    check(
      "sidebar heading switches to Plato's places",
      focusState.sidebarHeading === "Plato's places",
      `heading=${focusState.sidebarHeading}`,
    );
    check(
      "sidebar floats the focused places to the top",
      focusState.sidebarTotal === totalPlaces &&
        focusState.sidebarFirst.length === focusLabels.length &&
        focusState.sidebarFirst.every((l) => focusLabels.includes(l)),
      `first=${JSON.stringify(focusState.sidebarFirst)}`,
    );
    check(
      "?p=Plato stays in the URL",
      focusState.pParam === "Plato",
      `p=${focusState.pParam}`,
    );

    console.log(
      "Scenario 15: the banner's buttons switch modes and clear the focus",
    );
    // "Draw life journey" switches into journey mode: numbered stops
    // appear and ?journey= is set.
    await page.getByRole("button", { name: "Draw life journey" }).click();
    await page.waitForFunction(
      () =>
        Array.from(
          document.querySelectorAll(
            ".leaflet-marker-pane .leaflet-marker-icon div",
          ),
        ).filter((el) => /^\d+$/.test((el.textContent ?? "").trim()))
          .length === 8,
      undefined,
      { timeout: 10000 },
    );
    const afterDraw = await page.evaluate(() => ({
      journeyParam: new URLSearchParams(window.location.search).get(
        "journey",
      ),
      selectValue:
        (document.querySelector("#journey-select") as HTMLSelectElement | null)
          ?.value ?? null,
    }));
    check(
      "Draw life journey sets ?journey=Plato",
      afterDraw.journeyParam === "Plato",
      `journey=${afterDraw.journeyParam}`,
    );
    check(
      "the journey dropdown follows the banner button",
      afterDraw.selectValue === "Plato",
      `value=${afterDraw.selectValue}`,
    );

    // Back on a fresh focused view, "Show all places" must clear the
    // focus: banner gone, ?p= dropped, no dimmed or ringed markers left.
    await page.goto(`${BASE}/map?p=Plato`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        (n) =>
          Array.from(
            document.querySelectorAll(".leaflet-overlay-pane svg path"),
          ).filter(
            (p) =>
              p.getAttribute("fill") !== "none" &&
              (p.getAttribute("stroke") ?? "").toLowerCase() === "#1e293b",
          ).length === n,
        focusLabels.length,
        { timeout: 20000 },
      ),
    );
    await page.getByRole("button", { name: "Show all places" }).click();
    await page.waitForFunction(
      () =>
        Array.from(
          document.querySelectorAll(".leaflet-overlay-pane svg path"),
        ).filter((p) => p.getAttribute("stroke-opacity") === "0.3")
          .length === 0,
      undefined,
      { timeout: 10000 },
    );
    const afterClear = await page.evaluate(() => ({
      pParam: new URLSearchParams(window.location.search).get("p"),
      ringed: Array.from(
        document.querySelectorAll(".leaflet-overlay-pane svg path"),
      ).filter(
        (p) => (p.getAttribute("stroke") ?? "").toLowerCase() === "#1e293b",
      ).length,
      bannerGone: !(document.body.textContent ?? "").includes(
        "associated with Plato",
      ),
      sidebarHeading: (
        document.querySelector("aside h2")?.textContent ?? ""
      ).trim(),
    }));
    check(
      "Show all places drops ?p= from the URL",
      afterClear.pParam === null,
      `p=${afterClear.pParam}`,
    );
    check(
      "no focus rings or dimming remain after clearing",
      afterClear.ringed === 0,
      `ringed=${afterClear.ringed}`,
    );
    check("the focus banner disappears", afterClear.bannerGone);
    check(
      "sidebar heading returns to Places",
      afterClear.sidebarHeading === "Places",
      `heading=${afterClear.sidebarHeading}`,
    );

    console.log(
      "Scenario 16: unknown ?p= shows the no-mapped-places notice",
    );
    await page.goto(`${BASE}/map?p=Nobody`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        (n) =>
          Array.from(
            document.querySelectorAll(".leaflet-overlay-pane svg path"),
          ).filter((p) => p.getAttribute("fill") !== "none").length === n,
        totalPlaces,
        { timeout: 20000 },
      ),
    );
    const unknownFocus = await page.evaluate(() => {
      const body = document.body.textContent ?? "";
      return {
        hasNotice: body.includes("No mapped places for"),
        namesNobody: body.includes("Nobody"),
        markers: Array.from(
          document.querySelectorAll(".leaflet-overlay-pane svg path"),
        ).filter((p) => p.getAttribute("fill") !== "none").length,
        sidebarItems: document.querySelectorAll("aside ul li button").length,
      };
    });
    check(
      "the 'No mapped places' notice names the unknown philosopher",
      unknownFocus.hasNotice && unknownFocus.namesNobody,
    );
    check(
      "the map still draws every place marker",
      unknownFocus.markers === totalPlaces,
      `markers=${unknownFocus.markers}`,
    );
    check(
      "the sidebar place list still renders",
      unknownFocus.sidebarItems === totalPlaces,
      `items=${unknownFocus.sidebarItems}`,
    );

    console.log(
      "Scenario 17: clicking a floated place while focused opens its panel and keeps the focus",
    );
    // With ?p=Plato active, clicking the first floated sidebar place must
    // open that place's panel (heading matches, events name Plato) without
    // dropping the focus; closing the panel must return to the floated
    // list with the "Plato's places" heading and ?p= still in the URL.
    await page.goto(`${BASE}/map?p=Plato`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        (n) =>
          Array.from(
            document.querySelectorAll(".leaflet-overlay-pane svg path"),
          ).filter(
            (p) =>
              p.getAttribute("fill") !== "none" &&
              (p.getAttribute("stroke") ?? "").toLowerCase() === "#1e293b",
          ).length === n,
        focusLabels.length,
        { timeout: 20000 },
      ),
    );
    const firstFloated = await page.evaluate(
      () =>
        (
          document.querySelector("aside ul li button .truncate")
            ?.textContent ?? ""
        ).trim(),
    );
    check(
      "the first floated sidebar place is one of Plato's places",
      focusLabels.includes(firstFloated),
      `first=${firstFloated}`,
    );
    await page.locator("aside ul li button").first().click();
    await page.waitForFunction(
      (label) =>
        (document.querySelector("aside h2")?.textContent ?? "").trim() ===
        label,
      firstFloated,
      { timeout: 10000 },
    );
    const focusedPanel = await page.evaluate(() => ({
      heading: (document.querySelector("aside h2")?.textContent ?? "").trim(),
      namesPlato:
        document.querySelectorAll(
          `aside a[href="/graph?p=${encodeURIComponent("Plato")}"]`,
        ).length > 0,
      pParam: new URLSearchParams(window.location.search).get("p"),
      bannerShown: (document.body.textContent ?? "").includes(
        "associated with Plato",
      ),
    }));
    check(
      "the place panel heading matches the clicked floated place",
      focusedPanel.heading === firstFloated,
      `heading=${focusedPanel.heading} expected=${firstFloated}`,
    );
    check(
      "the panel's events list names Plato",
      focusedPanel.namesPlato,
      `place=${firstFloated}`,
    );
    check(
      "?p=Plato survives opening the panel",
      focusedPanel.pParam === "Plato" && focusedPanel.bannerShown,
      `p=${focusedPanel.pParam} banner=${focusedPanel.bannerShown}`,
    );
    await page
      .locator("aside button", { hasText: "Close" })
      .first()
      .click();
    await page.waitForFunction(
      () =>
        (document.querySelector("aside h2")?.textContent ?? "").trim() ===
        "Plato's places",
      undefined,
      { timeout: 10000 },
    );
    const afterPanelClose = await page.evaluate((focusCount) => {
      const sidebarLabels = Array.from(
        document.querySelectorAll("aside ul li button .truncate"),
      ).map((el) => (el.textContent ?? "").trim());
      return {
        heading: (
          document.querySelector("aside h2")?.textContent ?? ""
        ).trim(),
        sidebarFirst: sidebarLabels.slice(0, focusCount),
        sidebarTotal: sidebarLabels.length,
        pParam: new URLSearchParams(window.location.search).get("p"),
        bannerShown: (document.body.textContent ?? "").includes(
          "associated with Plato",
        ),
      };
    }, focusLabels.length);
    check(
      "closing the panel restores the Plato's places sidebar heading",
      afterPanelClose.heading === "Plato's places",
      `heading=${afterPanelClose.heading}`,
    );
    check(
      "the floated order returns after closing the panel",
      afterPanelClose.sidebarTotal === totalPlaces &&
        afterPanelClose.sidebarFirst.length === focusLabels.length &&
        afterPanelClose.sidebarFirst.every((l) => focusLabels.includes(l)),
      `first=${JSON.stringify(afterPanelClose.sidebarFirst)}`,
    );
    check(
      "?p=Plato and the banner survive closing the panel",
      afterPanelClose.pParam === "Plato" && afterPanelClose.bannerShown,
      `p=${afterPanelClose.pParam} banner=${afterPanelClose.bannerShown}`,
    );

    console.log(
      "Scenario 17b: clicking a focused circle marker on the map opens its panel and keeps the focus styling",
    );
    // Readers mostly click the map, not the sidebar list. With ?p=Plato
    // still active (scenario 17 closed its panel and kept the focus),
    // hover a dark-ringed circle marker to read its tooltip label (the
    // tooltip and the click both go to the topmost marker under the
    // pointer, so the label and the opened panel are guaranteed to
    // agree), click it, and assert the panel heading matches, the
    // events name Plato, and ?p=Plato survives. After closing, the
    // marker set must keep its focus styling: the same number of dark
    // rings at weight 3 and the same number of dimmed markers.
    await page.waitForFunction(
      (n) =>
        Array.from(
          document.querySelectorAll(".leaflet-overlay-pane svg path"),
        ).filter(
          (p) =>
            p.getAttribute("fill") !== "none" &&
            (p.getAttribute("stroke") ?? "").toLowerCase() === "#1e293b",
        ).length === n,
      focusLabels.length,
      { timeout: 20000 },
    );
    const focusedMarker = page
      .locator(
        '.leaflet-overlay-pane svg path[stroke="#1e293b"]:not([fill="none"])',
      )
      .first();
    await focusedMarker.hover();
    await page.waitForSelector(".leaflet-tooltip", { timeout: 10000 });
    const hoveredLabel = await page.evaluate(() => {
      const tip = document.querySelector(".leaflet-tooltip");
      // Non-permanent tooltips read "Label · N"; strip the count.
      return (tip?.textContent ?? "").split("·")[0].trim();
    });
    check(
      "the hovered dark-ringed marker is one of Plato's places",
      focusLabels.includes(hoveredLabel),
      `hovered=${hoveredLabel}`,
    );
    await focusedMarker.click();
    await page.waitForFunction(
      (label) =>
        (document.querySelector("aside h2")?.textContent ?? "").trim() ===
        label,
      hoveredLabel,
      { timeout: 10000 },
    );
    const markerPanel = await page.evaluate(() => ({
      heading: (document.querySelector("aside h2")?.textContent ?? "").trim(),
      namesPlato:
        document.querySelectorAll(
          `aside a[href="/graph?p=${encodeURIComponent("Plato")}"]`,
        ).length > 0,
      pParam: new URLSearchParams(window.location.search).get("p"),
      bannerShown: (document.body.textContent ?? "").includes(
        "associated with Plato",
      ),
    }));
    check(
      "the panel heading matches the clicked marker's place",
      markerPanel.heading === hoveredLabel,
      `heading=${markerPanel.heading} expected=${hoveredLabel}`,
    );
    check(
      "the marker panel's events list names Plato",
      markerPanel.namesPlato,
      `place=${hoveredLabel}`,
    );
    check(
      "?p=Plato survives the marker click",
      markerPanel.pParam === "Plato" && markerPanel.bannerShown,
      `p=${markerPanel.pParam} banner=${markerPanel.bannerShown}`,
    );
    await page
      .locator("aside button", { hasText: "Close" })
      .first()
      .click();
    await page.waitForFunction(
      () =>
        (document.querySelector("aside h2")?.textContent ?? "").trim() ===
        "Plato's places",
      undefined,
      { timeout: 10000 },
    );
    const afterMarkerClose = await page.evaluate(() => {
      const markers = Array.from(
        document.querySelectorAll(".leaflet-overlay-pane svg path"),
      ).filter((p) => p.getAttribute("fill") !== "none");
      const ringed = markers.filter(
        (p) =>
          (p.getAttribute("stroke") ?? "").toLowerCase() === "#1e293b" &&
          p.getAttribute("stroke-width") === "3",
      );
      const dimmed = markers.filter(
        (p) => p.getAttribute("stroke-opacity") === "0.3",
      );
      return {
        ringed: ringed.length,
        dimmed: dimmed.length,
        pParam: new URLSearchParams(window.location.search).get("p"),
      };
    });
    check(
      "the focus rings survive closing the marker panel",
      afterMarkerClose.ringed === focusLabels.length,
      `ringed=${afterMarkerClose.ringed} expected=${focusLabels.length}`,
    );
    check(
      "the dimmed markers stay dimmed after closing",
      afterMarkerClose.dimmed === totalPlaces - focusLabels.length,
      `dimmed=${afterMarkerClose.dimmed} expected=${totalPlaces - focusLabels.length}`,
    );
    check(
      "?p=Plato survives closing the marker panel",
      afterMarkerClose.pParam === "Plato",
      `p=${afterMarkerClose.pParam}`,
    );

    console.log(
      "Scenario 17c: a legend chip keeps the remaining focused places floated first",
    );
    // Still on /map?p=Plato with the focus active and no panel open.
    // The legend filter and the focus float interact (sortedPlaces sorts
    // visiblePlaces by focusLabels); pin the combination against the live
    // API: under the Births chip the sidebar must list exactly the
    // birthplace places with the focused subset floated to the top, while
    // the banner keeps the FULL focus count (it reads the unfiltered set).
    const birthVisibleLabels = apiPlaces
      .filter((p) => p.events.some((e) => e.property === "birthPlace"))
      .map((p) => p.label);
    const birthFocusedLabels = birthVisibleLabels.filter((l) =>
      focusLabels.includes(l),
    );
    check(
      "the Births filter keeps some but not all of Plato's places",
      birthFocusedLabels.length > 0 &&
        birthFocusedLabels.length < focusLabels.length,
      `underFilter=${birthFocusedLabels.length} focus=${focusLabels.length}`,
    );
    // Reads the focused-sidebar state: heading, the sidebar list order,
    // the banner's count, the ?p= param, and the focus-ring marker count.
    const readFocusSidebar = () =>
      page.evaluate(() => {
        const markers = Array.from(
          document.querySelectorAll(".leaflet-overlay-pane svg path"),
        ).filter((p) => p.getAttribute("fill") !== "none");
        const banner = (document.body.textContent ?? "").match(
          /Highlighting the (\d+) places? associated with Plato/,
        );
        return {
          heading: (
            document.querySelector("aside h2")?.textContent ?? ""
          ).trim(),
          labels: Array.from(
            document.querySelectorAll("aside ul li button .truncate"),
          ).map((el) => (el.textContent ?? "").trim()),
          bannerCount: banner ? Number(banner[1]) : null,
          pParam: new URLSearchParams(window.location.search).get("p"),
          markerCount: markers.length,
          ringed: markers.filter(
            (p) =>
              (p.getAttribute("stroke") ?? "").toLowerCase() === "#1e293b" &&
              p.getAttribute("stroke-width") === "3",
          ).length,
        };
      });
    await page.getByRole("button", { name: "Births", exact: true }).click();
    await page.waitForFunction(
      (n) =>
        Array.from(
          document.querySelectorAll(".leaflet-overlay-pane svg path"),
        ).filter((p) => p.getAttribute("fill") !== "none").length === n,
      birthVisibleLabels.length,
      { timeout: 10000 },
    );
    const underFilter = await readFocusSidebar();
    check(
      "the filtered sidebar lists exactly the birthplace places",
      underFilter.labels.length === birthVisibleLabels.length &&
        underFilter.labels.every((l) => birthVisibleLabels.includes(l)),
      `sidebar=${underFilter.labels.length} expected=${birthVisibleLabels.length}`,
    );
    check(
      "the remaining visible focused places still float first",
      underFilter.labels
        .slice(0, birthFocusedLabels.length)
        .every((l) => birthFocusedLabels.includes(l)) &&
        underFilter.labels
          .slice(birthFocusedLabels.length)
          .every((l) => !birthFocusedLabels.includes(l)),
      `first=${JSON.stringify(underFilter.labels.slice(0, birthFocusedLabels.length))}`,
    );
    check(
      "only the visible focused markers keep the dark ring",
      underFilter.ringed === birthFocusedLabels.length,
      `ringed=${underFilter.ringed} expected=${birthFocusedLabels.length}`,
    );
    check(
      "the banner keeps the full focus count under the filter",
      underFilter.bannerCount === focusLabels.length &&
        underFilter.pParam === "Plato",
      `banner=${underFilter.bannerCount} expected=${focusLabels.length} p=${underFilter.pParam}`,
    );
    check(
      "the sidebar heading stays \u201CPlato's places\u201D under the filter",
      underFilter.heading === "Plato's places",
      `heading=${underFilter.heading}`,
    );

    // A filter that hides EVERY focused place: the Mentioned chip alone
    // shows only mention-only places (zero events), so none of Plato's
    // event places survive. The sidebar must still render sanely.
    await page.getByRole("button", { name: "Show all", exact: true }).click();
    await page.waitForFunction(
      (n) =>
        Array.from(
          document.querySelectorAll(".leaflet-overlay-pane svg path"),
        ).filter((p) => p.getAttribute("fill") !== "none").length === n,
      totalPlaces,
      { timeout: 10000 },
    );
    const mentionOnlyLabels = apiPlaces
      .filter((p) => p.events.length === 0)
      .map((p) => p.label);
    check(
      "mention-only places exist to isolate with the Mentioned chip",
      mentionOnlyLabels.length > 0,
      `mentionOnly=${mentionOnlyLabels.length}`,
    );
    await page.getByRole("button", { name: "Mentioned", exact: true }).click();
    await page.waitForFunction(
      (n) =>
        Array.from(
          document.querySelectorAll(".leaflet-overlay-pane svg path"),
        ).filter((p) => p.getAttribute("fill") !== "none").length === n,
      mentionOnlyLabels.length,
      { timeout: 10000 },
    );
    const noneFocused = await readFocusSidebar();
    check(
      "the sidebar survives a filter that hides every focused place",
      noneFocused.heading === "Plato's places" &&
        noneFocused.labels.length === mentionOnlyLabels.length &&
        noneFocused.labels.every((l) => !focusLabels.includes(l)),
      `heading=${noneFocused.heading} sidebar=${noneFocused.labels.length} expected=${mentionOnlyLabels.length}`,
    );
    check(
      "the banner and ?p= survive with zero focused places visible",
      noneFocused.bannerCount === focusLabels.length &&
        noneFocused.pParam === "Plato" &&
        noneFocused.ringed === 0,
      `banner=${noneFocused.bannerCount} p=${noneFocused.pParam} ringed=${noneFocused.ringed}`,
    );

    // Clearing the filter must restore the full floated order.
    await page.getByRole("button", { name: "Show all", exact: true }).click();
    await page.waitForFunction(
      (n) =>
        Array.from(
          document.querySelectorAll(".leaflet-overlay-pane svg path"),
        ).filter((p) => p.getAttribute("fill") !== "none").length === n,
      totalPlaces,
      { timeout: 10000 },
    );
    const restoredFocus = await readFocusSidebar();
    check(
      "clearing the filter restores the full floated order",
      restoredFocus.labels.length === totalPlaces &&
        restoredFocus.labels
          .slice(0, focusLabels.length)
          .every((l) => focusLabels.includes(l)),
      `sidebar=${restoredFocus.labels.length} first=${JSON.stringify(restoredFocus.labels.slice(0, focusLabels.length))}`,
    );
    check(
      "the focus rings, banner, and ?p= return after clearing",
      restoredFocus.ringed === focusLabels.length &&
        restoredFocus.bannerCount === focusLabels.length &&
        restoredFocus.pParam === "Plato",
      `ringed=${restoredFocus.ringed} banner=${restoredFocus.bannerCount} p=${restoredFocus.pParam}`,
    );

    console.log(
      "Scenario 18: a place panel's passage link opens the cited section page",
    );
    // Pick the target deterministically from the live API: the busiest
    // place's first event that carries a sectionId. The expected section
    // id therefore cannot drift from what the panel actually links.
    const citedEvent = busiest.events.find((e) => e.sectionId);
    check(
      "the busiest place has an event with a resolvable sectionId",
      citedEvent !== undefined,
      `place=${busiest.label}`,
    );
    if (citedEvent && citedEvent.sectionId) {
      const expectedId = citedEvent.sectionId;
      // Fetch the passage the section page must render, so the assertion
      // checks real Greek and English text, not just a non-empty page.
      const expectedSection = (await (
        await fetch(`${BASE}/api/sections/${expectedId}`)
      ).json()) as { philosopher: string; text: string; textEn?: string };

      await page.goto(`${BASE}/map`, { waitUntil: "networkidle" });
      guard.assertPageLoaded();
      await guard.guarded(
        page.waitForFunction(
          (n) =>
            Array.from(
              document.querySelectorAll(".leaflet-overlay-pane svg path"),
            ).filter((p) => p.getAttribute("fill") !== "none").length === n,
          totalPlaces,
          { timeout: 20000 },
        ),
      );
      // Open the place panel from the sidebar list (same setSelected path
      // as the marker click, already exercised in scenario 10).
      await page
        .locator("aside ul li button", { hasText: busiest.label })
        .first()
        .click();
      await page.waitForFunction(
        (label) =>
          (document.querySelector("aside h2")?.textContent ?? "").trim() ===
          label,
        busiest.label,
        { timeout: 10000 },
      );
      // The event's passage link must exist with the "D.L. <ref>" text
      // and point at exactly the sectionId the API served.
      const passageHref = await page.evaluate(
        ({ id, ref }) => {
          const link = Array.from(
            document.querySelectorAll<HTMLAnchorElement>(
              `aside a[href="/section/${id}"]`,
            ),
          ).find((a) => (a.textContent ?? "").trim() === `D.L. ${ref}`);
          return link?.getAttribute("href") ?? null;
        },
        { id: expectedId, ref: citedEvent.ref },
      );
      check(
        "the event's 'D.L. <ref>' link targets the API's sectionId",
        passageHref === `/section/${expectedId}`,
        `href=${passageHref} expected=/section/${expectedId}`,
      );
      await page
        .locator(`aside a[href="/section/${expectedId}"]`, {
          hasText: `D.L. ${citedEvent.ref}`,
        })
        .first()
        .click();
      // The section page shows the passage in a two-column card; wait for
      // the Greek text to appear so the passage query has resolved.
      const grcSnippet = expectedSection.text.slice(0, 40);
      await page.waitForFunction(
        (snippet) => (document.body.textContent ?? "").includes(snippet),
        grcSnippet,
        { timeout: 20000 },
      );
      const sectionPage = await page.evaluate(
        ({ enSnippet }) => {
          const body = document.body.textContent ?? "";
          return {
            pathname: window.location.pathname,
            h1: (document.querySelector("h1")?.textContent ?? "").trim(),
            hasEnglish: enSnippet.length === 0 || body.includes(enSnippet),
          };
        },
        { enSnippet: (expectedSection.textEn ?? "").slice(0, 40) },
      );
      check(
        "the link lands on the cited /section/:id page",
        sectionPage.pathname === `/section/${expectedId}`,
        `pathname=${sectionPage.pathname} expected=/section/${expectedId}`,
      );
      check(
        "the section page heads with the passage's philosopher",
        sectionPage.h1 === expectedSection.philosopher,
        `h1=${sectionPage.h1} expected=${expectedSection.philosopher}`,
      );
      check(
        "the rendered page shows the aligned English translation",
        sectionPage.hasEnglish,
        `id=${expectedId}`,
      );
    }

    console.log(
      "Scenario 19: same-page Map nav click turns the Show names labels off",
    );
    // Start from a plain map with names on, then click the active "Map"
    // nav link: it must reset the page like the other filters, so the
    // toggle reads unpressed and every permanent label is removed.
    await page.goto(`${BASE}/map`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        (n) =>
          Array.from(
            document.querySelectorAll(".leaflet-overlay-pane svg path"),
          ).filter((p) => p.getAttribute("fill") !== "none").length === n,
        totalPlaces,
        { timeout: 20000 },
      ),
    );
    await page
      .getByRole("button", { name: "Show names", exact: true })
      .click();
    await page.waitForFunction(
      (n) =>
        document.querySelectorAll(".leaflet-tooltip-pane .map-name-label")
          .length === n,
      totalPlaces,
      { timeout: 10000 },
    );
    await page.evaluate(() => {
      const el = document.querySelector('nav a[href="/map"]');
      if (!el) throw new Error('no element matches nav a[href="/map"]');
      el.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
    // Leaflet fades removed tooltips out; wait for the count to settle.
    await page.waitForFunction(
      () =>
        document.querySelectorAll(".leaflet-tooltip-pane .map-name-label")
          .length === 0,
      undefined,
      { timeout: 10000 },
    );
    const afterNavReset = await readLabelState();
    const togglePressed = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const b = btns.find((el) => el.textContent?.trim() === "Show names");
      return b?.getAttribute("aria-pressed") ?? null;
    });
    check(
      "nav reset removes every permanent name label",
      afterNavReset.labels === 0 && afterNavReset.markers === totalPlaces,
      `labels=${afterNavReset.labels} markers=${afterNavReset.markers}`,
    );
    check(
      "Show names toggle reads unpressed after the nav reset",
      togglePressed === "false",
      `aria-pressed=${togglePressed}`,
    );

    console.log(
      "Scenario 20: a fresh cross-page Map visit never starts with the name labels stuck on",
    );
    // Turn "Show names" on, leave the Map for another page via the nav
    // (a real cross-page navigation that unmounts the page), then return
    // to /map via the nav: the remounted page must start with the toggle
    // off and zero permanent labels. Guards against showNames ever being
    // lifted into a shared store, URL param, or persisted state.
    await page.goto(`${BASE}/map`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        (n) =>
          Array.from(
            document.querySelectorAll(".leaflet-overlay-pane svg path"),
          ).filter((p) => p.getAttribute("fill") !== "none").length === n,
        totalPlaces,
        { timeout: 20000 },
      ),
    );
    await page
      .getByRole("button", { name: "Show names", exact: true })
      .click();
    await page.waitForFunction(
      (n) =>
        document.querySelectorAll(".leaflet-tooltip-pane .map-name-label")
          .length === n,
      totalPlaces,
      { timeout: 10000 },
    );
    // Leave the Map for the Graph page through the nav (client-side
    // routing, so any in-memory or store-held state would survive).
    await page.evaluate(() => {
      const el = document.querySelector('nav a[href="/graph"]');
      if (!el) throw new Error('no element matches nav a[href="/graph"]');
      el.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
    await page.waitForFunction(
      () => window.location.pathname.endsWith("/graph"),
      undefined,
      { timeout: 10000 },
    );
    // Return to the Map through the nav; wait for the remounted map to
    // draw every marker before reading the label state.
    await page.evaluate(() => {
      const el = document.querySelector('nav a[href="/map"]');
      if (!el) throw new Error('no element matches nav a[href="/map"]');
      el.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
    await page.waitForFunction(
      (n) =>
        Array.from(
          document.querySelectorAll(".leaflet-overlay-pane svg path"),
        ).filter((p) => p.getAttribute("fill") !== "none").length === n,
      totalPlaces,
      { timeout: 20000 },
    );
    // Removed tooltips linger while fading; wait for the count to settle.
    await page.waitForFunction(
      () =>
        document.querySelectorAll(".leaflet-tooltip-pane .map-name-label")
          .length === 0,
      undefined,
      { timeout: 10000 },
    );
    const afterReturn = await readLabelState();
    const togglePressedAfterReturn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const b = btns.find((el) => el.textContent?.trim() === "Show names");
      return b?.getAttribute("aria-pressed") ?? null;
    });
    check(
      "a fresh Map visit after leaving and returning shows zero permanent name labels",
      afterReturn.labels === 0 && afterReturn.markers === totalPlaces,
      `labels=${afterReturn.labels} markers=${afterReturn.markers}`,
    );
    check(
      "Show names toggle reads unpressed on the fresh visit",
      togglePressedAfterReturn === "false",
      `aria-pressed=${togglePressedAfterReturn}`,
    );

    console.log(
      "Scenario 21: a fresh cross-page Map visit never starts with a legend filter left over",
    );
    // Apply the Births legend chip (markers drop to the birthplace
    // count), leave the Map for the Graph page via the nav, then return
    // to /map via the nav: the remounted page must draw every marker
    // again and the legend must read unfiltered - every chip unpressed
    // and no "Show all" reset button (it only renders while a filter is
    // active). Guards against activeKinds (or the sidebar selection it
    // feeds) ever being lifted into a shared store or persisted state.
    await page.goto(`${BASE}/map`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        (n) =>
          Array.from(
            document.querySelectorAll(".leaflet-overlay-pane svg path"),
          ).filter((p) => p.getAttribute("fill") !== "none").length === n,
        totalPlaces,
        { timeout: 20000 },
      ),
    );
    await page.getByRole("button", { name: "Births" }).click();
    await page.waitForFunction(
      (n) =>
        Array.from(
          document.querySelectorAll(".leaflet-overlay-pane svg path"),
        ).filter((p) => p.getAttribute("fill") !== "none").length === n,
      birthPlaces,
      { timeout: 10000 },
    );
    check(
      "the Births filter really thins the drawn markers first",
      birthPlaces < totalPlaces,
      `birthPlaces=${birthPlaces} totalPlaces=${totalPlaces}`,
    );
    // Leave via the nav (client-side routing, so any in-memory or
    // store-held filter state would survive the round trip).
    await page.evaluate(() => {
      const el = document.querySelector('nav a[href="/graph"]');
      if (!el) throw new Error('no element matches nav a[href="/graph"]');
      el.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
    await page.waitForFunction(
      () => window.location.pathname.endsWith("/graph"),
      undefined,
      { timeout: 10000 },
    );
    await page.evaluate(() => {
      const el = document.querySelector('nav a[href="/map"]');
      if (!el) throw new Error('no element matches nav a[href="/map"]');
      el.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
    await page.waitForFunction(
      (n) =>
        Array.from(
          document.querySelectorAll(".leaflet-overlay-pane svg path"),
        ).filter((p) => p.getAttribute("fill") !== "none").length === n,
      totalPlaces,
      { timeout: 20000 },
    );
    const legendAfterReturn = await page.evaluate((n) => {
      // Scope the pressed-chip sweep to the legend chip group instead of
      // sweeping every button on the page: persistent toggles (the Map/List
      // view switch, or any future default-on toggle) always keep one button
      // pressed and would otherwise need one-off exclusions here.
      const legend = document.querySelector(
        '[data-testid="map-legend-chips"]',
      );
      if (!legend) throw new Error("map-legend-chips container not found");
      const buttons = Array.from(legend.querySelectorAll("button"));
      const pressedChips = buttons.filter(
        (b) => b.getAttribute("aria-pressed") === "true",
      );
      const showAll = buttons.find(
        (b) => (b.textContent ?? "").trim() === "Show all",
      );
      return {
        markers: Array.from(
          document.querySelectorAll(".leaflet-overlay-pane svg path"),
        ).filter((p) => p.getAttribute("fill") !== "none").length,
        pressedChips: pressedChips.map((b) => (b.textContent ?? "").trim()),
        hasShowAll: showAll !== undefined,
        placesLine: (document.body.textContent ?? "").includes(
          `${n} places`,
        ),
      };
    }, totalPlaces);
    check(
      "a fresh Map visit after leaving and returning draws every marker again",
      legendAfterReturn.markers === totalPlaces,
      `markers=${legendAfterReturn.markers} expected=${totalPlaces}`,
    );
    check(
      "the legend reads unfiltered on the fresh visit (no pressed chips, no Show all)",
      legendAfterReturn.pressedChips.length === 0 &&
        !legendAfterReturn.hasShowAll,
      `pressed=${JSON.stringify(legendAfterReturn.pressedChips)} showAll=${legendAfterReturn.hasShowAll}`,
    );
    check(
      "the summary line counts the full place set again",
      legendAfterReturn.placesLine,
      `expected "${totalPlaces} places" in the page text`,
    );

    // Positive control: press a real filter chip and prove the scoped sweep
    // still detects it (i.e. the "no pressed chips" check above would fail).
    // Guards against the scope selector drifting to a container that no
    // longer holds the chips, which would make the check pass vacuously.
    await page.evaluate(() => {
      const legend = document.querySelector(
        '[data-testid="map-legend-chips"]',
      );
      if (!legend) throw new Error("map-legend-chips container not found");
      const chip = legend.querySelector("button");
      if (!chip) throw new Error("no filter chip found in legend group");
      chip.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
    const legendPositiveControl = await page.evaluate(() => {
      const legend = document.querySelector(
        '[data-testid="map-legend-chips"]',
      );
      if (!legend) throw new Error("map-legend-chips container not found");
      const buttons = Array.from(legend.querySelectorAll("button"));
      return {
        pressedChips: buttons
          .filter((b) => b.getAttribute("aria-pressed") === "true")
          .map((b) => (b.textContent ?? "").trim()),
        hasShowAll: buttons.some(
          (b) => (b.textContent ?? "").trim() === "Show all",
        ),
      };
    });
    check(
      "positive control: the scoped sweep detects a genuinely pressed filter chip",
      legendPositiveControl.pressedChips.length > 0 &&
        legendPositiveControl.hasShowAll,
      `pressed=${JSON.stringify(legendPositiveControl.pressedChips)} showAll=${legendPositiveControl.hasShowAll}`,
    );
    // Reset the legend so later scenarios start from an unfiltered map.
    await page.evaluate(() => {
      const legend = document.querySelector(
        '[data-testid="map-legend-chips"]',
      );
      const showAll = Array.from(
        legend?.querySelectorAll("button") ?? [],
      ).find((b) => (b.textContent ?? "").trim() === "Show all");
      if (!showAll) throw new Error("Show all button not found for reset");
      showAll.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
    await page.waitForFunction(
      (n) =>
        Array.from(
          document.querySelectorAll(".leaflet-overlay-pane svg path"),
        ).filter((p) => p.getAttribute("fill") !== "none").length === n,
      totalPlaces,
      { timeout: 20000 },
    );

    console.log(
      "Scenario 22: a fresh cross-page Map visit never starts with a place panel left open",
    );
    // Open a place panel from the sidebar (the selected state lives only
    // in map.tsx today), leave the Map for the Graph page via the nav,
    // then return to /map via the nav: the remounted page must show the
    // full "Places" list heading with no panel open. Guards against
    // `selected` ever being lifted into a shared store or persisted
    // state, which would greet a returning visitor with a panel for a
    // place they never clicked this visit.
    await page.goto(`${BASE}/map`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        (n) =>
          Array.from(
            document.querySelectorAll(".leaflet-overlay-pane svg path"),
          ).filter((p) => p.getAttribute("fill") !== "none").length === n,
        totalPlaces,
        { timeout: 20000 },
      ),
    );
    const panelPlaceLabel = apiPlaces[0].label;
    await page
      .locator("aside ul li button", { hasText: panelPlaceLabel })
      .first()
      .click();
    // The panel replaces the list: its h2 carries the place label and a
    // Close button appears.
    await page.waitForFunction(
      (label) =>
        (document.querySelector("aside h2")?.textContent ?? "").trim() ===
        label,
      panelPlaceLabel,
      { timeout: 10000 },
    );
    const panelOpen = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("aside button"));
      return {
        hasClose: buttons.some(
          (b) => (b.textContent ?? "").trim() === "Close",
        ),
        listItems: document.querySelectorAll("aside ul li button").length,
      };
    });
    check(
      "clicking a sidebar place really opens its panel first (Close shown, list gone)",
      panelOpen.hasClose,
      `hasClose=${panelOpen.hasClose} listItems=${panelOpen.listItems}`,
    );
    // Leave via the nav (client-side routing, so any in-memory or
    // store-held selection would survive the round trip).
    await page.evaluate(() => {
      const el = document.querySelector('nav a[href="/graph"]');
      if (!el) throw new Error('no element matches nav a[href="/graph"]');
      el.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
    await page.waitForFunction(
      () => window.location.pathname.endsWith("/graph"),
      undefined,
      { timeout: 10000 },
    );
    await page.evaluate(() => {
      const el = document.querySelector('nav a[href="/map"]');
      if (!el) throw new Error('no element matches nav a[href="/map"]');
      el.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
    await page.waitForFunction(
      (n) =>
        Array.from(
          document.querySelectorAll(".leaflet-overlay-pane svg path"),
        ).filter((p) => p.getAttribute("fill") !== "none").length === n,
      totalPlaces,
      { timeout: 20000 },
    );
    const panelAfterReturn = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("aside button"));
      return {
        heading: (document.querySelector("aside h2")?.textContent ?? "").trim(),
        hasClose: buttons.some(
          (b) => (b.textContent ?? "").trim() === "Close",
        ),
        listItems: document.querySelectorAll("aside ul li button").length,
      };
    });
    check(
      "a cross-page return shows the full 'Places' list heading with no panel open",
      panelAfterReturn.heading === "Places" && !panelAfterReturn.hasClose,
      `heading=${JSON.stringify(panelAfterReturn.heading)} hasClose=${panelAfterReturn.hasClose}`,
    );
    check(
      "the sidebar lists every place again after the return",
      panelAfterReturn.listItems === totalPlaces,
      `listItems=${panelAfterReturn.listItems} expected=${totalPlaces}`,
    );

    console.log(
      "Scenario 23: a cross-page Map return starts with no journey left over",
    );
    // Start on /map?journey=Plato (journey drawn: numbered stops + legs),
    // leave for the Graph page via the nav, then return to /map via the
    // nav link. The nav link carries no query string, so the remounted
    // page must draw the plain map: no ?journey= param, no numbered stop
    // markers, no fill="none" leg paths, and the journey select back on
    // its empty placeholder.
    await page.goto(`${BASE}/map?journey=Plato`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        () =>
          document.querySelectorAll(
            ".leaflet-marker-pane .leaflet-marker-icon div",
          ).length >= 2,
        undefined,
        { timeout: 20000 },
      ),
    );
    await page.evaluate(() => {
      const el = document.querySelector('nav a[href="/graph"]');
      if (!el) throw new Error('no element matches nav a[href="/graph"]');
      el.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
    await page.waitForFunction(
      () => window.location.pathname.endsWith("/graph"),
      undefined,
      { timeout: 10000 },
    );
    await page.evaluate(() => {
      const el = document.querySelector('nav a[href="/map"]');
      if (!el) throw new Error('no element matches nav a[href="/map"]');
      el.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
    await page.waitForFunction(
      (n) =>
        Array.from(
          document.querySelectorAll(".leaflet-overlay-pane svg path"),
        ).filter((p) => p.getAttribute("fill") !== "none").length === n,
      totalPlaces,
      { timeout: 20000 },
    );
    const journeyAfterReturn = await page.evaluate(() => {
      const select = document.querySelector(
        "#journey-select",
      ) as HTMLSelectElement | null;
      return {
        journeyParam: new URLSearchParams(window.location.search).get(
          "journey",
        ),
        stopMarkers: Array.from(
          document.querySelectorAll(
            ".leaflet-marker-pane .leaflet-marker-icon div",
          ),
        ).filter((el) => /^\d+$/.test((el.textContent ?? "").trim())).length,
        legs: Array.from(
          document.querySelectorAll(".leaflet-overlay-pane svg path"),
        ).filter((p) => p.getAttribute("fill") === "none").length,
        selectValue: select?.value ?? null,
      };
    });
    check(
      "a cross-page return carries no ?journey= param",
      journeyAfterReturn.journeyParam === null,
      `journey=${journeyAfterReturn.journeyParam}`,
    );
    check(
      "no numbered journey stops or route legs survive the return",
      journeyAfterReturn.stopMarkers === 0 && journeyAfterReturn.legs === 0,
      `stops=${journeyAfterReturn.stopMarkers} legs=${journeyAfterReturn.legs}`,
    );
    check(
      "the journey select is back on its empty placeholder",
      journeyAfterReturn.selectValue === "",
      `selectValue=${JSON.stringify(journeyAfterReturn.selectValue)}`,
    );

    console.log(
      "Scenario 24: a cross-page Map return starts with no philosopher focus left over",
    );
    // Start on /map?p=Plato (banner up, focused markers ringed dark),
    // leave via the nav, return via the nav: the remounted page must
    // show no ?p= param, no highlight banner, zero dark-ringed markers,
    // and the default busiest-first sidebar order (no floated group).
    await page.goto(`${BASE}/map?p=Plato`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        () =>
          /Highlighting the \d+ places? associated with Plato/.test(
            document.body.textContent ?? "",
          ),
        undefined,
        { timeout: 20000 },
      ),
    );
    await page.evaluate(() => {
      const el = document.querySelector('nav a[href="/graph"]');
      if (!el) throw new Error('no element matches nav a[href="/graph"]');
      el.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
    await page.waitForFunction(
      () => window.location.pathname.endsWith("/graph"),
      undefined,
      { timeout: 10000 },
    );
    await page.evaluate(() => {
      const el = document.querySelector('nav a[href="/map"]');
      if (!el) throw new Error('no element matches nav a[href="/map"]');
      el.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
    await page.waitForFunction(
      (n) =>
        Array.from(
          document.querySelectorAll(".leaflet-overlay-pane svg path"),
        ).filter((p) => p.getAttribute("fill") !== "none").length === n,
      totalPlaces,
      { timeout: 20000 },
    );
    const focusAfterReturn = await page.evaluate(() => {
      const markers = Array.from(
        document.querySelectorAll(".leaflet-overlay-pane svg path"),
      ).filter((p) => p.getAttribute("fill") !== "none");
      return {
        pParam: new URLSearchParams(window.location.search).get("p"),
        bannerShown: /Highlighting the \d+ places? associated with/.test(
          document.body.textContent ?? "",
        ),
        ringed: markers.filter(
          (p) =>
            (p.getAttribute("stroke") ?? "").toLowerCase() === "#1e293b" &&
            p.getAttribute("stroke-width") === "3",
        ).length,
        heading: (document.querySelector("aside h2")?.textContent ?? "").trim(),
        firstLabels: Array.from(
          document.querySelectorAll("aside ul li button .truncate"),
        )
          .slice(0, 5)
          .map((el) => (el.textContent ?? "").trim()),
      };
    });
    // With no focus, the sidebar renders the API's own (busiest-first)
    // order; a leftover focus would float Plato's places to the top.
    const defaultFirst = apiPlaces.slice(0, 5).map((p) => p.label);
    check(
      "a cross-page return carries no ?p= param and no highlight banner",
      focusAfterReturn.pParam === null && !focusAfterReturn.bannerShown,
      `p=${focusAfterReturn.pParam} banner=${focusAfterReturn.bannerShown}`,
    );
    check(
      "no dark focus rings survive the return",
      focusAfterReturn.ringed === 0,
      `ringed=${focusAfterReturn.ringed}`,
    );
    check(
      "the sidebar heads 'Places' in the default (unfloated) order",
      focusAfterReturn.heading === "Places" &&
        focusAfterReturn.firstLabels.join("|") === defaultFirst.join("|"),
      `heading=${focusAfterReturn.heading} first=${JSON.stringify(focusAfterReturn.firstLabels)} expected=${JSON.stringify(defaultFirst)}`,
    );
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll map-journey checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
