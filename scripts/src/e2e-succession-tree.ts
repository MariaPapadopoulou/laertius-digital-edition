/// <reference lib="dom" />
/* Real-browser check: the Graph page's second view mode ("Tree", the
 * SuccessionTree component) still works. The constellation-view checks
 * (e2e-legend-filter, e2e-graph-associates) never touch it, so a
 * regression in the view toggle or the d3-hierarchy layout would ship
 * unnoticed. This script drives headless Chromium against the running
 * dev servers and asserts:
 *
 * 1. The view toggle works: /graph opens in the network view, clicking
 *    the "Tree" tab flips aria-pressed, renders the succession-tree
 *    SVG, and writes ?view=tree into the URL; clicking "Network" goes
 *    back and drops the param. Loading /graph?view=tree directly must
 *    open straight into the tree.
 * 2. The tree lists every teacher chain: the expected layout is
 *    re-derived from the live /api/graph payload with the same rules
 *    the component uses (first teacher named wins as tree parent,
 *    teacherless philosophers anchor under their first influencer,
 *    everyone else becomes an "Outside the successions" pill), and
 *    every expected node must be drawn exactly once, every expected
 *    pill rendered, with none missing or extra.
 * 3. A known deep chain appears in order: Xenophanes -> Parmenides ->
 *    Zeno of Elea -> Leucippus -> Democritus -> Anaxarchus -> Pyrrho
 *    -> Timon must be drawn left-to-right, each link one column (190px)
 *    deeper than its parent, with a link path drawn for every
 *    consecutive pair in the class the API dictates (solid teacher
 *    link, or dotted influence anchor for the Democritus -> Anaxarchus
 *    step, where no teacher is named). (Sextus Empiricus is a satellite
 *    associate, not a KG node, so the Sceptic chain inside the tree
 *    ends at Timon; the satellite tail is covered by
 *    e2e-graph-associates in the network view.)
 * 4. Link classes are complete: the counts of solid primary links,
 *    dashed additional-teacher links ("4 3"), and dotted influence
 *    links ("1.5 3.5") match the API-derived expectations, and the
 *    influence-anchored placement works (Epicurus is placed one column
 *    right of Democritus with a dotted link, not stranded outside).
 * 5. Selection works in the tree: clicking a node's label puts the
 *    selection ring (currentColor stroke, width 2.5) on it and writes
 *    ?p= into the URL; clicking empty canvas clears both.
 * 6. The reverse direction: a shared link /graph?view=tree&p=<name>
 *    opened in a fresh page must restore both the tree view and the
 *    selection ring on the named node (exactly one ring), and a name
 *    that only exists as an "Outside the successions" pill (e.g.
 *    Heraclitus) must render its pill in the selected style.
 *
 * Requirements: the API server and web workflows must be running (the
 * script talks to the shared proxy, default http://localhost:80), and
 * a Chromium headless shell must be installed for playwright-core:
 *   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
 *     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell
 */

import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

// The known deep teacher chain checked in order (the Eleatic-to-Sceptic
// succession, the longest pure-teacherOf chain in the curated graph).
const DEEP_CHAIN = [
  "Xenophanes",
  "Parmenides",
  "Zeno of Elea",
  "Leucippus",
  "Democritus",
  "Anaxarchus",
  "Pyrrho",
  "Timon",
];

const COL = 190; // must match SuccessionTree's column width

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
  nodes: { name: string }[];
  edges: { from: string; to: string; type: string }[];
}

/** Re-derive the tree membership with the component's own rules. */
function deriveExpectations(api: ApiGraph) {
  const teacherEdges = api.edges.filter((e) => e.type === "teacherOf");
  const influenceEdges = api.edges.filter((e) => e.type === "influenced");
  const primaryParent = new Map<string, string>();
  let secondaryCount = 0;
  for (const e of teacherEdges) {
    if (!primaryParent.has(e.to) && e.from !== e.to) {
      primaryParent.set(e.to, e.from);
    } else {
      secondaryCount++;
    }
  }
  const influenceParent = new Map<string, string>();
  for (const e of influenceEdges) {
    if (
      !primaryParent.has(e.to) &&
      !influenceParent.has(e.to) &&
      e.from !== e.to
    ) {
      influenceParent.set(e.to, e.from);
    }
  }
  const involved = new Set<string>();
  for (const e of teacherEdges) {
    involved.add(e.from);
    involved.add(e.to);
  }
  for (const [child, parent] of influenceParent) {
    involved.add(child);
    involved.add(parent);
  }
  const outside = api.nodes.map((n) => n.name).filter((n) => !involved.has(n));
  // All influence edges between placed nodes render dotted.
  const influenceLinkCount = influenceEdges.filter(
    (e) => involved.has(e.from) && involved.has(e.to),
  ).length;
  return {
    placed: involved,
    primaryCount: primaryParent.size,
    secondaryCount,
    influenceLinkCount,
    influenceParent,
    outside,
  };
}

async function main() {
  const apiRes = await fetch(`${BASE_URL}/api/graph`);
  if (!apiRes.ok) throw new Error(`/api/graph returned ${apiRes.status}`);
  const api = (await apiRes.json()) as ApiGraph;
  const expected = deriveExpectations(api);
  check(
    `API graph yields a non-trivial tree (${expected.placed.size} placed, ${expected.outside.length} outside)`,
    expected.placed.size > 40 && expected.outside.length > 0,
  );

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    // Fail fast with the failing URL/status instead of an opaque selector
    // timeout when the site itself fails to boot.
    const guard = attachPageGuard(page);

    console.log("Check 1: the view toggle switches to the tree and back");
    await page.goto(`${BASE_URL}/graph`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForSelector(
        "svg[aria-label='Knowledge graph of philosophers']",
      ),
    );
    const treeTab = page.locator("div[role='group'][aria-label='Graph view'] button", { hasText: "Tree" });
    const networkTab = page.locator("div[role='group'][aria-label='Graph view'] button", {
      hasText: "Network",
    });
    check(
      "network tab selected on load",
      (await networkTab.getAttribute("aria-pressed")) === "true",
    );
    check(
      "tree tab unselected on load",
      (await treeTab.getAttribute("aria-pressed")) === "false",
    );
    await treeTab.click();
    await guard.guarded(
      page.waitForSelector(
        "svg[aria-label='Succession tree of philosophers']",
      ),
    );
    check(
      "tree tab selected after click",
      (await treeTab.getAttribute("aria-pressed")) === "true",
    );
    check(
      "URL carries ?view=tree",
      await page.evaluate(
        () =>
          new URLSearchParams(window.location.search).get("view") === "tree",
      ),
    );
    check(
      "network svg replaced by the tree",
      (await page
        .locator("svg[aria-label='Knowledge graph of philosophers']")
        .count()) === 0,
    );
    await networkTab.click();
    await page.waitForSelector(
      "svg[aria-label='Knowledge graph of philosophers']",
    );
    check(
      "?view dropped after switching back to network",
      await page.evaluate(
        () => new URLSearchParams(window.location.search).get("view") === null,
      ),
    );
    await page.goto(`${BASE_URL}/graph?view=tree`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForSelector(
        "svg[aria-label='Succession tree of philosophers']",
      ),
    );
    check(
      "/graph?view=tree opens straight into the tree",
      (await treeTab.getAttribute("aria-pressed")) === "true",
    );

    // Snapshot the drawn tree: node positions, link path endpoints and
    // dash classes, and the outside pills.
    const snap = await page.evaluate(() => {
      const svg = document.querySelector(
        "svg[aria-label='Succession tree of philosophers']",
      );
      if (!svg) throw new Error("tree svg not found");
      const nodes = Array.from(svg.querySelectorAll("g.cursor-pointer")).flatMap(
        (g) => {
          const text = g.querySelector("text");
          const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(
            g.getAttribute("transform") ?? "",
          );
          if (!text || !m) return [];
          return [
            {
              name: text.textContent ?? "",
              x: parseFloat(m[1]),
              y: parseFloat(m[2]),
            },
          ];
        },
      );
      const links = Array.from(
        svg.querySelectorAll(":scope > path[d^='M']"),
      ).map(
        (p) => {
          const d = p.getAttribute("d") ?? "";
          const m = /^M([-\d.]+),([-\d.]+) C.* ([-\d.]+),([-\d.]+)$/.exec(d);
          return {
            x1: m ? parseFloat(m[1]) : NaN,
            y1: m ? parseFloat(m[2]) : NaN,
            x2: m ? parseFloat(m[3]) : NaN,
            y2: m ? parseFloat(m[4]) : NaN,
            dash: p.getAttribute("stroke-dasharray"),
          };
        },
      );
      const pills = Array.from(
        document.querySelectorAll("div.border-t button"),
      ).map((b) => (b.textContent ?? "").trim());
      return { nodes, links, pills };
    });
    const drawn = new Map(snap.nodes.map((n) => [n.name, n]));

    console.log("Check 2: every teacher chain member is drawn, others pilled");
    check(
      `${expected.placed.size} tree nodes drawn`,
      snap.nodes.length === expected.placed.size,
      `got ${snap.nodes.length}`,
    );
    for (const name of expected.placed) {
      check(`node drawn: ${name}`, drawn.has(name));
    }
    const dupes = snap.nodes.length - drawn.size;
    check("no duplicate node labels", dupes === 0, `${dupes} duplicates`);
    for (const name of expected.outside) {
      check(
        `outside pill: ${name}`,
        snap.pills.includes(name) && !drawn.has(name),
      );
    }
    check(
      `${expected.outside.length} outside pills`,
      snap.pills.length === expected.outside.length,
      `got ${snap.pills.length}: ${snap.pills.join(", ")}`,
    );

    console.log("Check 3: the deep chain appears in order");
    const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
    for (let i = 1; i < DEEP_CHAIN.length; i++) {
      const parent = drawn.get(DEEP_CHAIN[i - 1]);
      const child = drawn.get(DEEP_CHAIN[i]);
      const label = `${DEEP_CHAIN[i - 1]} -> ${DEEP_CHAIN[i]}`;
      if (!parent || !child) {
        check(`${label}: both nodes drawn`, false);
        continue;
      }
      check(
        `${label}: child one column deeper`,
        near(child.x - parent.x, COL),
        `dx=${child.x - parent.x}`,
      );
      // Links run from 6px right of the parent's center to 8px left of
      // the child's center. The expected class comes from the API: a
      // solid path when the parent is the first-named teacher, dotted
      // ("1.5 3.5") when the child is influence-anchored. Both classes
      // can overlay the same pair, so match the expected dash exactly.
      const viaInfluence = expected.influenceParent.get(DEEP_CHAIN[i]) ===
        DEEP_CHAIN[i - 1];
      const wantDash = viaInfluence ? "1.5 3.5" : null;
      const link = snap.links.find(
        (l) =>
          l.dash === wantDash &&
          near(l.x1, parent.x + 6) &&
          near(l.y1, parent.y) &&
          near(l.x2, child.x - 8) &&
          near(l.y2, child.y),
      );
      check(
        `${label}: ${viaInfluence ? "dotted influence-anchor" : "solid primary"} link drawn`,
        !!link,
        "no matching path",
      );
    }

    console.log("Check 4: link classes match the API-derived counts");
    const solid = snap.links.filter((l) => l.dash === null).length;
    const dashed = snap.links.filter((l) => l.dash === "4 3").length;
    const dotted = snap.links.filter((l) => l.dash === "1.5 3.5").length;
    check(
      `${expected.primaryCount} solid teacher links`,
      solid === expected.primaryCount,
      `got ${solid}`,
    );
    check(
      `${expected.secondaryCount} dashed additional-teacher links`,
      dashed === expected.secondaryCount,
      `got ${dashed}`,
    );
    check(
      `${expected.influenceLinkCount} dotted influence links`,
      dotted === expected.influenceLinkCount,
      `got ${dotted}`,
    );
    // Influence anchoring: a teacherless philosopher hangs one column
    // right of their first influencer with a dotted link.
    const [anchoredChild, anchoredParent] =
      [...expected.influenceParent.entries()][0] ?? [];
    if (anchoredChild && anchoredParent) {
      const c = drawn.get(anchoredChild);
      const p = drawn.get(anchoredParent);
      const dotLink =
        c && p
          ? snap.links.find(
              (l) =>
                near(l.x1, p.x + 6) &&
                near(l.y1, p.y) &&
                near(l.x2, c.x - 8) &&
                near(l.y2, c.y) &&
                l.dash === "1.5 3.5",
            )
          : undefined;
      check(
        `influence-anchored ${anchoredChild} placed under ${anchoredParent} with a dotted link`,
        !!c && !!p && near(c.x - p.x, COL) && !!dotLink,
      );
    } else {
      check("an influence-anchored philosopher exists", false);
    }

    console.log("Check 5: selecting a node in the tree");
    const TARGET = "Pyrrho";
    await page.evaluate((n) => {
      const t = Array.from(
        document.querySelectorAll(
          "svg[aria-label='Succession tree of philosophers'] g.cursor-pointer text",
        ),
      ).find((el) => el.textContent === n);
      if (!t) throw new Error(`tree node text not found: ${n}`);
      t.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }, TARGET);
    await page.waitForFunction(
      (n) => new URLSearchParams(window.location.search).get("p") === n,
      TARGET,
      { timeout: 5000 },
    );
    const ring = await page.evaluate((n) => {
      const t = Array.from(
        document.querySelectorAll(
          "svg[aria-label='Succession tree of philosophers'] g.cursor-pointer text",
        ),
      ).find((el) => el.textContent === n);
      const c = t?.parentElement?.querySelector("circle");
      return c
        ? {
            stroke: c.getAttribute("stroke"),
            width: parseFloat(c.getAttribute("stroke-width") ?? "0"),
          }
        : null;
    }, TARGET);
    check(
      `${TARGET}: selection ring after click (and ?p= set)`,
      !!ring && ring.stroke === "currentColor" && ring.width === 2.5,
      JSON.stringify(ring),
    );
    // Clicking empty canvas clears the selection and the ?p= param.
    await page.evaluate(() => {
      document
        .querySelector("svg[aria-label='Succession tree of philosophers']")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await page.waitForFunction(
      () => new URLSearchParams(window.location.search).get("p") === null,
      undefined,
      { timeout: 5000 },
    );
    check("canvas click clears the selection (?p= dropped)", true);

    console.log(
      "Check 6: a shared tree link restores the view AND the selection",
    );
    // The reverse direction of check 5: opening a copied link like
    // /graph?view=tree&p=Pyrrho in a fresh page must adopt the URL
    // (graph.tsx useSearch effect) and render the selection ring on the
    // named node - a regression here would break every shared tree link
    // while the click-driven checks above stay green.
    const shared = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    const guard2 = attachPageGuard(shared);
    try {
      await shared.goto(
        `${BASE_URL}/graph?view=tree&p=${encodeURIComponent(TARGET)}`,
        { waitUntil: "networkidle" },
      );
      guard2.assertPageLoaded();
      await guard2.guarded(
        shared.waitForSelector(
          "svg[aria-label='Succession tree of philosophers']",
        ),
      );
      check(
        "shared link opens straight into the tree view",
        (await shared
          .locator("div[role='group'][aria-label='Graph view'] button", { hasText: "Tree" })
          .getAttribute("aria-pressed")) === "true",
      );
      const sharedRing = await shared.evaluate((n) => {
        const t = Array.from(
          document.querySelectorAll(
            "svg[aria-label='Succession tree of philosophers'] g.cursor-pointer text",
          ),
        ).find((el) => el.textContent === n);
        const c = t?.parentElement?.querySelector("circle");
        return c
          ? {
              stroke: c.getAttribute("stroke"),
              width: parseFloat(c.getAttribute("stroke-width") ?? "0"),
            }
          : null;
      }, TARGET);
      check(
        `${TARGET}: selection ring restored from the shared URL`,
        !!sharedRing &&
          sharedRing.stroke === "currentColor" &&
          sharedRing.width === 2.5,
        JSON.stringify(sharedRing),
      );
      // Only the named node wears the ring: exactly one circle site-wide
      // carries the currentColor selection stroke.
      const ringCount = await shared.evaluate(
        () =>
          Array.from(
            document.querySelectorAll(
              "svg[aria-label='Succession tree of philosophers'] circle",
            ),
          ).filter((c) => c.getAttribute("stroke") === "currentColor").length,
      );
      check(
        "exactly one node wears the selection ring",
        ringCount === 1,
        `got ${ringCount}`,
      );

      // Same for a philosopher who only exists as an "Outside the
      // successions" pill: the pill must render in its selected style
      // (border-foreground, no inline movement color).
      const PILL_TARGET = expected.outside.includes("Heraclitus")
        ? "Heraclitus"
        : expected.outside[0];
      check(
        `an outside pill target exists (${PILL_TARGET ?? "none"})`,
        !!PILL_TARGET,
      );
      if (PILL_TARGET) {
        await shared.goto(
          `${BASE_URL}/graph?view=tree&p=${encodeURIComponent(PILL_TARGET)}`,
          { waitUntil: "networkidle" },
        );
        guard2.assertPageLoaded();
        await guard2.guarded(
          shared.waitForSelector(
            "svg[aria-label='Succession tree of philosophers']",
          ),
        );
        const pillState = await shared.evaluate((n) => {
          const b = Array.from(
            document.querySelectorAll("div.border-t button"),
          ).find((el) => (el.textContent ?? "").trim() === n);
          return b
            ? {
                selectedClass: b.className.includes("border-foreground"),
                inlineColor: (b as HTMLElement).style.color,
              }
            : null;
        }, PILL_TARGET);
        check(
          `${PILL_TARGET}: outside pill rendered in its selected style`,
          !!pillState && pillState.selectedClass && pillState.inlineColor === "",
          JSON.stringify(pillState),
        );
      }
    } finally {
      await shared.close();
    }
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\ne2e-succession-tree: ${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\ne2e-succession-tree: all checks passed");
}

main().catch((err) => {
  console.error("e2e-succession-tree crashed:", err);
  process.exit(1);
});
