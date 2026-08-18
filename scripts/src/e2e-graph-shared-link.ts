/// <reference lib="dom" />
/* Real-browser check: a shared NETWORK-view link /graph?p=<name> opened
 * in a fresh page restores the same philosopher highlighted. The
 * e2e-succession-tree script pins the tree-view side of URL adoption
 * (?view=tree&p=), but the default network view rides the same
 * useSearch effect in graph.tsx with no live coverage: a regression
 * there would break every shared network link while current checks
 * stay green. This script drives headless Chromium against the running
 * dev servers and asserts, for a direct load (no prior interaction):
 *
 * 1. /graph?p=<KG node> renders the constellation with the named
 *    node selected: selection ring (currentColor stroke, thick width)
 *    on exactly that node, its neighborhood (edge partners + hanging
 *    satellites) at full opacity, and non-neighborhood nodes dimmed
 *    to 0.18.
 * 2. The relations side panel is populated for that philosopher:
 *    heading shows the name, the movement badge is present, and the
 *    Relations list carries the node's API edge count.
 * 3. The same holds for a satellite associate name that is not a KG
 *    node: /graph?p=<associate> selects the small dot (ring on),
 *    keeps its parent (teacher or founder anchor) undimmed, and opens
 *    the associate panel with its name as heading.
 * 4. The URL keeps ?p= after load (the sync effect must not strip it).
 *
 * The target KG node and associate are derived live from /api/graph
 * (the KG node: one that has edges AND at least one non-neighbor to
 * verify dimming; the associate: any served satellite whose name is
 * not a KG node name).
 *
 * Requirements: the api-server and web workflows must be running and
 * the headless Chromium shell installed (same setup as
 * e2e-graph-associates):
 *   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
 *     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell
 */

import "./lib/playwright-browsers-path";
import { CARD_HEADING_SELECTOR } from "./lib/card-headings";

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

  // Pick a KG node with edges (so the relations list is non-empty) and
  // at least one non-neighbor (so dimming is observable). Prefer the
  // node with the most edges for a robust relations-list assertion.
  const edgeCount = new Map<string, number>();
  for (const e of api.edges) {
    edgeCount.set(e.from, (edgeCount.get(e.from) ?? 0) + 1);
    edgeCount.set(e.to, (edgeCount.get(e.to) ?? 0) + 1);
  }
  const target = [...api.nodes]
    .sort((a, b) => (edgeCount.get(b.name) ?? 0) - (edgeCount.get(a.name) ?? 0))
    .find((n) => (edgeCount.get(n.name) ?? 0) > 0);
  if (!target) throw new Error("no KG node with edges found");
  const targetEdges = api.edges.filter(
    (e) => e.from === target.name || e.to === target.name,
  );
  // Expected neighborhood exactly as graph.tsx computes it: the node,
  // its edge partners, and satellites hanging off it (anchor/teacher),
  // plus (not applicable for a KG node) associate parents.
  const neighborhood = new Set<string>([target.name]);
  for (const e of targetEdges) {
    neighborhood.add(e.from);
    neighborhood.add(e.to);
  }
  for (const a of associates) {
    if (a.anchor === target.name || a.teacher === target.name)
      neighborhood.add(a.name);
  }
  const outsider = api.nodes.find((n) => !neighborhood.has(n.name));
  if (!outsider) throw new Error("no non-neighbor KG node found for dim check");

  // Satellite scenario: any associate name that is not a KG node.
  const assoc = associates[0];
  if (!assoc) throw new Error("no satellite associate served");
  const assocParent =
    assoc.teacher &&
    (kgNames.has(assoc.teacher) ||
      associates.some((x) => x.name === assoc.teacher))
      ? assoc.teacher
      : assoc.anchor;

  const browser = await chromium.launch({ headless: true });
  try {
    // ---- Scenario A: shared link to a KG node ----
    console.log(
      `Scenario A: fresh page opens /graph?p=${target.name} (KG node, ${targetEdges.length} edges; outsider ${outsider.name})`,
    );
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    const guard = attachPageGuard(page);
    await page.goto(
      `${BASE_URL}/graph?p=${encodeURIComponent(target.name)}`,
      { waitUntil: "networkidle" },
    );
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForSelector("svg[role='img'] g.cursor-pointer"),
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

    const sel = await readNode(target.name);
    check(
      `${target.name}: selection ring on directly from the URL`,
      !!sel && sel.stroke === "currentColor" && sel.strokeWidth >= 2,
      JSON.stringify(sel),
    );
    check(
      `${target.name}: selected node undimmed`,
      !!sel && sel.opacity === "1",
      `opacity=${sel?.opacity}`,
    );
    // Every neighbor drawn stays at full opacity; the outsider dims.
    for (const e of targetEdges) {
      const other = e.from === target.name ? e.to : e.from;
      const n = await readNode(other);
      check(
        `neighbor ${other}: undimmed (opacity 1)`,
        !!n && n.opacity === "1" && n.stroke !== "currentColor",
        JSON.stringify(n),
      );
    }
    const out = await readNode(outsider.name);
    check(
      `non-neighbor ${outsider.name}: dimmed to 0.18`,
      !!out && out.opacity === "0.18",
      `opacity=${out?.opacity}`,
    );
    // Only one selection ring in the whole SVG.
    const ringCount = await page.evaluate(
      () =>
        Array.from(
          document.querySelectorAll(
            "svg[role='img'] g.cursor-pointer circle",
          ),
        ).filter((c) => c.getAttribute("stroke") === "currentColor").length,
    );
    check(`exactly one selection ring`, ringCount === 1, `got ${ringCount}`);

    // Side panel: heading, movement badge, relations list.
    const panel = await page.evaluate((cardHeadingSel) => {
      const h2 = document.querySelector(
        "div.lg\\:col-span-3 h2",
      ) as HTMLElement | null;
      const card = h2?.closest("div.bg-card") as HTMLElement | null;
      const relHeader = card
        ? Array.from(card.querySelectorAll(cardHeadingSel)).find((h) =>
            /relations/i.test(h.textContent ?? ""),
          )
        : undefined;
      const relList = relHeader?.nextElementSibling;
      return {
        heading: h2?.textContent ?? null,
        // The movement badge is a text span wrapping a colored dot span:
        // the dot carries the inline background-color, the label text
        // lives on its parent.
        badge:
          card
            ?.querySelector("span[style*='background-color']")
            ?.parentElement?.textContent?.trim() ?? null,
        relationCount: relList ? relList.querySelectorAll("li").length : null,
        cardText: card?.textContent ?? "",
      };
    }, CARD_HEADING_SELECTOR);
    check(
      `panel heading shows ${target.name}`,
      panel.heading === target.name,
      `heading=${panel.heading}`,
    );
    check(
      `panel shows the ${target.movementLabel} movement badge`,
      panel.badge === target.movementLabel,
      `badge=${panel.badge}`,
    );
    check(
      `panel lists all ${targetEdges.length} relations`,
      panel.relationCount === targetEdges.length,
      `got ${panel.relationCount}`,
    );
    // Every edge partner is named somewhere in the panel.
    for (const e of targetEdges) {
      const other = e.from === target.name ? e.to : e.from;
      check(
        `panel names relation partner ${other}`,
        panel.cardText.includes(other),
      );
    }
    check(
      "URL keeps ?p= after load",
      page
        .url()
        .includes(`p=${encodeURIComponent(target.name).replace(/%20/g, "+")}`) ||
        decodeURIComponent(page.url()).includes(`p=${target.name}`),
      page.url(),
    );
    await page.close();

    // ---- Scenario B: shared link to a satellite associate ----
    console.log(
      `Scenario B: fresh page opens /graph?p=${assoc.name} (satellite, parent ${assocParent})`,
    );
    const page2 = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    const guard2 = attachPageGuard(page2);
    await page2.goto(
      `${BASE_URL}/graph?p=${encodeURIComponent(assoc.name)}`,
      { waitUntil: "networkidle" },
    );
    guard2.assertPageLoaded();
    await guard2.guarded(
      page2.waitForSelector("svg[role='img'] g.cursor-pointer"),
    );
    await guard2.guarded(
      page2.waitForFunction(
        () =>
          Array.from(
            document.querySelectorAll(
              "svg[role='img'] g.cursor-pointer circle",
            ),
          ).some((c) => c.getAttribute("r") === "4"),
        undefined,
        { timeout: 10000 },
      ),
    );

    const readNode2 = (name: string) =>
      page2.evaluate((n) => {
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

    const dot = await readNode2(assoc.name);
    check(
      `${assoc.name}: satellite selection ring on directly from the URL`,
      !!dot && dot.stroke === "currentColor" && dot.strokeWidth >= 2,
      JSON.stringify(dot),
    );
    check(
      `${assoc.name}: selected satellite undimmed`,
      !!dot && dot.opacity === "1",
      `opacity=${dot?.opacity}`,
    );
    const parentNode = await readNode2(assocParent);
    check(
      `parent ${assocParent}: undimmed alongside the selected satellite`,
      !!parentNode && parentNode.opacity === "1",
      JSON.stringify(parentNode),
    );
    const outsider2 = await readNode2(outsider.name);
    // The dim outsider from scenario A is only valid here if it is not
    // in the associate's neighborhood (anchor/teacher/edge partner);
    // check against the associate's own neighborhood instead.
    const assocNeighborhood = new Set<string>([
      assoc.name,
      assoc.anchor,
      ...(assoc.teacher ? [assoc.teacher] : []),
    ]);
    if (!assocNeighborhood.has(outsider.name)) {
      check(
        `non-neighbor ${outsider.name}: dimmed while the satellite is selected`,
        !!outsider2 && outsider2.opacity === "0.18",
        `opacity=${outsider2?.opacity}`,
      );
    }
    const heading2 = await page2.evaluate(
      () =>
        document.querySelector("div.lg\\:col-span-3 h2")?.textContent ?? null,
    );
    check(
      `associate panel heading shows ${assoc.name}`,
      heading2 === assoc.name,
      `heading=${heading2}`,
    );
    await page2.close();
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll shared-network-link checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
