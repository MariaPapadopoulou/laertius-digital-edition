/// <reference lib="dom" />
/* Real-browser check: browser Back/Forward on the Graph page moves the
 * selection with the URL. e2e-graph-shared-link covers a fresh direct
 * load of /graph?p=<name> and e2e-succession-tree the ?view=tree&p=
 * side; the remaining uncovered path of the same useSearch adoption
 * effect in graph.tsx is history navigation. The page itself only ever
 * history.replaceState()s (in-page clicks never mint entries), so the
 * history entries that exist come from wouter link navigations
 * (pushState, which wouter patches to emit its location events) and
 * are then walked with Back/Forward (popstate). This script drives
 * headless Chromium against the running dev servers, in ONE SPA
 * session with no reloads, and asserts:
 *
 * 1. Pushing /graph?p=A then /graph?p=B (exactly what an in-app
 *    <Link href="/graph?p=..."> does) moves the selection ring, the
 *    neighborhood dimming and the side-panel heading to each name.
 * 2. page.goBack() returns URL and selection to A: ring on exactly A,
 *    B carries no ring (and dims when outside A's neighborhood), the
 *    panel heading reads A, a non-neighbor of A is dimmed to 0.18.
 * 3. page.goForward() restores B the same way.
 * 4. Back twice more lands on plain /graph: no ring anywhere, nothing
 *    dimmed, and the empty-state panel replaces the philosopher panel.
 * 5. All of it happens without a page reload (a window marker set at
 *    the start must survive every step) — this pins the popstate →
 *    useSearch → adoption-effect path, not the fresh-load path the
 *    shared-link script already covers.
 * 6. Back/Forward also restores the Network/Tree/List view choice, not
 *    just the selection: pushing entries mixing ?view=tree / ?view=list
 *    with ?p= and walking them with goBack()/goForward() must flip the
 *    active view tab (aria-pressed), swap the rendered view (tree SVG /
 *    list tables / network SVG) and keep the selection tracking the URL
 *    at every step, still with no reload.
 * 7. The replaceState semantics of in-page clicks stay intact: after
 *    Forward to /graph?p=B, clicking node A in the SVG rewrites the
 *    URL to ?p=A WITHOUT adding a history entry, so Back from there
 *    jumps straight to /graph?p=A's predecessor (/graph?p=A itself,
 *    the entry under the rewritten one).
 *
 * Philosophers A and B are derived live from /api/graph: both must
 * have edges (non-empty panel), B outside A's neighborhood and vice
 * versa (so the dim flip is observable in both directions).
 *
 * Requirements: the api-server and web workflows must be running and
 * the headless Chromium shell installed (same setup as
 * e2e-graph-shared-link):
 *   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
 *     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell
 */

import "./lib/playwright-browsers-path";

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

interface ApiGraph {
  nodes: { name: string; movement: string; movementLabel: string }[];
  edges: { from: string; to: string; type: string }[];
  associates: {
    name: string;
    movement: string;
    anchor: string;
    teacher?: string;
  }[];
}

async function main() {
  const apiRes = await fetch(`${BASE_URL}/api/graph`);
  if (!apiRes.ok) throw new Error(`/api/graph returned ${apiRes.status}`);
  const api = (await apiRes.json()) as ApiGraph;
  const kgNames = new Set(api.nodes.map((n) => n.name));
  const associates = (api.associates ?? []).filter(
    (a) => !kgNames.has(a.name),
  );

  // Neighborhood exactly as graph.tsx computes it for a KG node: the
  // node, its edge partners, and satellites hanging off it.
  const neighborhoodOf = (name: string) => {
    const set = new Set<string>([name]);
    for (const e of api.edges) {
      if (e.from === name || e.to === name) {
        set.add(e.from);
        set.add(e.to);
      }
    }
    for (const a of associates) {
      if (a.anchor === name || a.teacher === name) set.add(a.name);
    }
    return set;
  };

  const edgeCount = new Map<string, number>();
  for (const e of api.edges) {
    edgeCount.set(e.from, (edgeCount.get(e.from) ?? 0) + 1);
    edgeCount.set(e.to, (edgeCount.get(e.to) ?? 0) + 1);
  }
  const withEdges = [...api.nodes]
    .filter((n) => (edgeCount.get(n.name) ?? 0) > 0)
    .sort(
      (a, b) => (edgeCount.get(b.name) ?? 0) - (edgeCount.get(a.name) ?? 0),
    );
  const A = withEdges[0];
  if (!A) throw new Error("no KG node with edges found");
  const nA = neighborhoodOf(A.name);
  const B = withEdges.find(
    (n) => !nA.has(n.name) && !neighborhoodOf(n.name).has(A.name),
  );
  if (!B) throw new Error("no second edge-bearing node disjoint from A found");
  const nB = neighborhoodOf(B.name);
  // A non-neighbor of BOTH, for a stable dim probe on every step.
  const outsider = api.nodes.find(
    (n) => !nA.has(n.name) && !nB.has(n.name),
  );
  if (!outsider) throw new Error("no shared non-neighbor found for dim check");

  console.log(
    `A=${A.name} (${edgeCount.get(A.name)} edges), B=${B.name} (${edgeCount.get(B.name)} edges), outsider=${outsider.name}`,
  );

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    const guard = attachPageGuard(page);
    await page.goto(`${BASE_URL}/graph`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForSelector("svg[role='img'] g.cursor-pointer"),
    );
    // Marker to prove every later step is SPA navigation, not a reload.
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__e2eNoReload = true;
    });
    const markerAlive = () =>
      page.evaluate(
        () =>
          (window as unknown as Record<string, unknown>).__e2eNoReload === true,
      );

    const readNode = (name: string) =>
      page.evaluate((n) => {
        const t = Array.from(
          document.querySelectorAll("svg[role='img'] g.cursor-pointer text"),
        ).find((el) => el.textContent === n);
        const g = t?.parentElement as SVGGElement | null | undefined;
        const c = g?.querySelector("circle");
        if (!g || !c) return null;
        return {
          opacity: g.getAttribute("opacity"),
          stroke: c.getAttribute("stroke"),
          strokeWidth: parseFloat(c.getAttribute("stroke-width") ?? "0"),
        };
      }, name);
    const ringCount = () =>
      page.evaluate(
        () =>
          Array.from(
            document.querySelectorAll(
              "svg[role='img'] g.cursor-pointer circle",
            ),
          ).filter((c) => c.getAttribute("stroke") === "currentColor").length,
      );
    const panelHeading = () =>
      page.evaluate(
        () =>
          document.querySelector("div.lg\\:col-span-3 h2")?.textContent ??
          null,
      );
    // wouter patches history.pushState to emit its location event; calling
    // it is exactly what an in-app <Link href="/graph?p=..."> click does.
    const pushP = (name: string) =>
      page.evaluate((n) => {
        window.history.pushState(
          null,
          "",
          `${window.location.pathname}?p=${encodeURIComponent(n)}`,
        );
      }, name);
    const urlP = () => {
      const u = new URL(page.url());
      return u.searchParams.get("p");
    };

    const assertSelected = async (
      label: string,
      name: string,
      unselected: string,
    ) => {
      await page.waitForFunction(
        (n) =>
          Array.from(
            document.querySelectorAll("svg[role='img'] g.cursor-pointer text"),
          ).some(
            (el) =>
              el.textContent === n &&
              el.parentElement
                ?.querySelector("circle")
                ?.getAttribute("stroke") === "currentColor",
          ),
        name,
        { timeout: 5000 },
      );
      const sel = await readNode(name);
      check(
        `${label}: ring on ${name}`,
        !!sel && sel.stroke === "currentColor" && sel.strokeWidth >= 2,
        JSON.stringify(sel),
      );
      check(
        `${label}: ${name} undimmed`,
        !!sel && sel.opacity === "1",
        `opacity=${sel?.opacity}`,
      );
      const other = await readNode(unselected);
      check(
        `${label}: ${unselected} carries no ring and dims`,
        !!other && other.stroke !== "currentColor" && other.opacity === "0.18",
        JSON.stringify(other),
      );
      const out = await readNode(outsider.name);
      check(
        `${label}: non-neighbor ${outsider.name} dimmed to 0.18`,
        !!out && out.opacity === "0.18",
        `opacity=${out?.opacity}`,
      );
      check(`${label}: exactly one ring`, (await ringCount()) === 1);
      check(
        `${label}: panel heading is ${name}`,
        (await panelHeading()) === name,
        `heading=${await panelHeading()}`,
      );
      check(`${label}: URL says p=${name}`, urlP() === name, page.url());
      check(`${label}: no page reload`, await markerAlive());
    };

    // ---- Step 1: in-app navigation pushes ?p=A then ?p=B ----
    console.log(`Step 1: push /graph?p=${A.name}, then /graph?p=${B.name}`);
    await pushP(A.name);
    await assertSelected("push A", A.name, B.name);
    await pushP(B.name);
    await assertSelected("push B", B.name, A.name);

    // ---- Step 2: Back returns to A ----
    console.log("Step 2: Back -> selection returns to A with the URL");
    await page.goBack();
    await assertSelected("back to A", A.name, B.name);

    // ---- Step 3: Forward restores B ----
    console.log("Step 3: Forward -> selection returns to B with the URL");
    await page.goForward();
    await assertSelected("forward to B", B.name, A.name);

    // ---- Step 3b: history entries mixing ?view= with ?p= ----
    console.log(
      "Step 3b: Back/Forward restores the Network/Tree/List view choice",
    );
    const pushQuery = (q: string) =>
      page.evaluate((query) => {
        window.history.pushState(
          null,
          "",
          `${window.location.pathname}${query}`,
        );
      }, q);
    const urlView = () => {
      const u = new URL(page.url());
      return u.searchParams.get("view");
    };
    const tabPressed = (label: string) =>
      page.evaluate((l) => {
        const btn = Array.from(
          document.querySelectorAll(
            "div[role='group'][aria-label='Graph view'] button",
          ),
        ).find((b) => b.textContent?.trim() === l);
        return btn?.getAttribute("aria-pressed") ?? null;
      }, label);
    const renderedView = () =>
      page.evaluate(() => {
        if (document.querySelector("[data-testid='graph-list-view']"))
          return "list";
        if (
          document.querySelector(
            "svg[aria-label='Succession tree of philosophers']",
          )
        )
          return "tree";
        if (
          document.querySelector(
            "svg[aria-label='Knowledge graph of philosophers']",
          )
        )
          return "network";
        return null;
      });
    const treeRingOn = (name: string) =>
      page.evaluate((n) => {
        const svg = document.querySelector(
          "svg[aria-label='Succession tree of philosophers']",
        );
        if (!svg) return false;
        return Array.from(svg.querySelectorAll("g.cursor-pointer text")).some(
          (el) =>
            el.textContent === n &&
            el.parentElement
              ?.querySelector("circle")
              ?.getAttribute("stroke") === "currentColor",
        );
      }, name);
    const assertView = async (
      label: string,
      expectedView: "network" | "tree" | "list",
      expectedP: string | null,
    ) => {
      const tabLabel =
        expectedView === "network"
          ? "Network"
          : expectedView === "tree"
            ? "Tree"
            : "List";
      await page.waitForFunction(
        (l) =>
          Array.from(
            document.querySelectorAll(
              "div[role='group'][aria-label='Graph view'] button",
            ),
          ).find((b) => b.textContent?.trim() === l)?.getAttribute(
            "aria-pressed",
          ) === "true",
        tabLabel,
        { timeout: 5000 },
      );
      check(
        `${label}: ${tabLabel} tab aria-pressed`,
        (await tabPressed(tabLabel)) === "true",
      );
      for (const other of ["Network", "Tree", "List"].filter(
        (t) => t !== tabLabel,
      )) {
        check(
          `${label}: ${other} tab not pressed`,
          (await tabPressed(other)) === "false",
        );
      }
      const rv = await renderedView();
      check(
        `${label}: rendered view is ${expectedView}`,
        rv === expectedView,
        `rendered=${rv}`,
      );
      check(
        `${label}: URL view param matches`,
        urlView() === (expectedView === "network" ? null : expectedView),
        page.url(),
      );
      check(`${label}: URL says p=${expectedP}`, urlP() === expectedP, page.url());
      if (expectedP !== null) {
        if (expectedView === "tree") {
          await page.waitForFunction(
            (n) => {
              const svg = document.querySelector(
                "svg[aria-label='Succession tree of philosophers']",
              );
              if (!svg) return false;
              return Array.from(
                svg.querySelectorAll("g.cursor-pointer text"),
              ).some(
                (el) =>
                  el.textContent === n &&
                  el.parentElement
                    ?.querySelector("circle")
                    ?.getAttribute("stroke") === "currentColor",
              );
            },
            expectedP,
            { timeout: 5000 },
          );
          check(
            `${label}: tree ring on ${expectedP}`,
            await treeRingOn(expectedP),
          );
        }
        // The side panel tracks the selection in every view.
        check(
          `${label}: panel heading is ${expectedP}`,
          (await panelHeading()) === expectedP,
          `heading=${await panelHeading()}`,
        );
      }
      check(`${label}: no page reload`, await markerAlive());
    };

    // Push a mixed sequence: tree+A -> network+B -> list+A.
    await pushQuery(`?view=tree&p=${encodeURIComponent(A.name)}`);
    await assertView("push view=tree&p=A", "tree", A.name);
    await pushQuery(`?p=${encodeURIComponent(B.name)}`);
    await assertView("push p=B (network)", "network", B.name);
    await assertSelected("push p=B selection", B.name, A.name);
    await pushQuery(`?view=list&p=${encodeURIComponent(A.name)}`);
    await assertView("push view=list&p=A", "list", A.name);

    // Walk back through the mixed entries.
    await page.goBack();
    await assertView("back to network p=B", "network", B.name);
    await assertSelected("back to network p=B selection", B.name, A.name);
    await page.goBack();
    await assertView("back to tree p=A", "tree", A.name);
    // Forward walks the views the other way.
    await page.goForward();
    await assertView("forward to network p=B", "network", B.name);
    await page.goForward();
    await assertView("forward to list p=A", "list", A.name);
    // Return to the network ?p=B entry so the later steps (which assume
    // the pre-3b history stack) continue from where Step 3 left off.
    // Assert between each Back so SPA popstate handling never races.
    await page.goBack();
    await assertView("unwind 1: network p=B", "network", B.name);
    await page.goBack();
    await assertView("unwind 2: tree p=A", "tree", A.name);
    await page.goBack();
    await assertView("back to pre-3b entry p=B", "network", B.name);
    await assertSelected("back to pre-3b entry", B.name, A.name);
    // Drop the forward entries from this scenario by re-pushing nothing:
    // Step 4's click uses replaceState, so stale forward entries are fine —
    // Step 5's goBack still walks the entries below this one.

    // ---- Step 4: in-page click replaces, not pushes ----
    console.log(
      "Step 4: clicking a node rewrites the URL in place (no new entry)",
    );
    await page.evaluate((n) => {
      const t = Array.from(
        document.querySelectorAll("svg[role='img'] g.cursor-pointer text"),
      ).find((el) => el.textContent === n);
      (t?.parentElement as unknown as SVGGElement | null)?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    }, A.name);
    await assertSelected("click A", A.name, B.name);
    // Back must now skip the rewritten ?p=B entry and land on ?p=A (the
    // entry below it) — proving the click replaced instead of pushing.
    await page.goBack();
    check(
      "Back after click lands on the ?p=A entry (click did not push)",
      urlP() === A.name,
      page.url(),
    );
    await assertSelected("back after click", A.name, B.name);

    // ---- Step 5: Back to plain /graph clears the selection ----
    console.log("Step 5: Back to plain /graph clears ring, dim and panel");
    await page.goBack();
    await page.waitForFunction(
      () => new URL(window.location.href).searchParams.get("p") === null,
      undefined,
      { timeout: 5000 },
    );
    check("URL has no ?p=", urlP() === null, page.url());
    await page.waitForFunction(
      () =>
        Array.from(
          document.querySelectorAll("svg[role='img'] g.cursor-pointer circle"),
        ).every((c) => c.getAttribute("stroke") !== "currentColor"),
      undefined,
      { timeout: 5000 },
    );
    check("no selection ring anywhere", (await ringCount()) === 0);
    const aClear = await readNode(A.name);
    const outClear = await readNode(outsider.name);
    check(
      "nothing dimmed with no selection",
      aClear?.opacity === "1" && outClear?.opacity === "1",
      JSON.stringify({ a: aClear, outsider: outClear }),
    );
    check(
      "philosopher panel gone",
      (await panelHeading()) === null,
      `heading=${await panelHeading()}`,
    );
    check("still no page reload", await markerAlive());

    await page.close();
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll graph Back/Forward checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
