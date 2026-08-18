/// <reference lib="dom" />
/* Real-browser check: overlapping relations between the same philosopher
 * pair render as separate, individually clickable arcs on the
 * Legomena Assertion Graph (/legomena/graph).
 *
 * The live dataset currently contains zero duplicate pairs, so the
 * parallel-edge arc behavior of graph-view.tsx (edgePath /
 * assignEdgePaths) is otherwise only covered by a math-level check.
 * This script intercepts the /legomena/api/graph response and injects
 * TWO extra relations between an existing pair, producing THREE
 * parallel edges — the hard case: edgePath offsets are -1/0/+1, so the
 * middle edge is a near-straight curve that could be visually shadowed
 * or lose clicks to its siblings' wide (12px) transparent hit paths.
 * It then asserts in headless Chromium:
 *
 * 1. The served dataset really has no duplicate pair (so the injection
 *    is what creates the overlap — keeps the check honest about intent).
 * 2. Exactly three curved (Q) arc paths render, all with distinct path
 *    data, sharing endpoints: one bowing each side plus one straight-ish
 *    middle; every other edge stays a straight line.
 * 3. Each arc OWNS its own midpoint under real hit-testing
 *    (document.elementFromPoint returns that arc's own hit path — the
 *    middle edge isn't shadowed by its siblings' 12px hit areas).
 * 4. Clicking each arc (via the hit-tested element) opens the edge
 *    detail card with that edge's own relation type and citation; the
 *    three cards show three different type+citation combos (no card
 *    reuse/mixup).
 * 5. Each card's citation links to the edge's own reader section.
 *
 * Requirements: laertius web + legomena api workflows running behind the
 * shared proxy (default http://localhost:80), and a Chromium headless
 * shell installed for playwright-core:
 *   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
 *     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell
 */
import { mkdirSync } from "node:fs";

import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";
const SHOT_DIR =
  process.env.E2E_SHOT_DIR ?? "../docs/verification/graph-duplicate-arcs";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

interface GraphEdge {
  from: string;
  to: string;
  fromUri: string;
  toUri: string;
  type: string;
  predicateUri: string;
  ref: string;
  citation: string;
  certainty: string;
  attribution: string;
  sectionId?: string;
}

async function main() {
  const apiRes = await fetch(`${BASE_URL}/legomena/api/graph`);
  if (!apiRes.ok)
    throw new Error(`/legomena/api/graph returned ${apiRes.status}`);
  const graph = (await apiRes.json()) as {
    nodes: unknown[];
    edges: GraphEdge[];
  };

  console.log("Check 1: the live dataset has no duplicate pair yet");
  const pairKey = (e: GraphEdge) =>
    e.fromUri < e.toUri ? `${e.fromUri}|${e.toUri}` : `${e.toUri}|${e.fromUri}`;
  const byPair = new Map<string, GraphEdge[]>();
  for (const e of graph.edges) {
    const k = pairKey(e);
    byPair.set(k, [...(byPair.get(k) ?? []), e]);
  }
  const liveDups = [...byPair.values()].filter((v) => v.length > 1);
  check(
    "served /legomena/api/graph has zero duplicate pairs",
    liveDups.length === 0,
    `found ${liveDups.length}`,
  );

  // Base edge to triplicate: prefer one that has a sectionId so all
  // three cards exercise the reader link.
  const base = graph.edges.find((e) => e.sectionId);
  if (!base) throw new Error("no suitable base edge with sectionId found");
  // Two injected duplicates: different relation types between the SAME
  // pair, each with its own distinct citation and section, so the three
  // parallel edges are fully distinguishable in the detail card.
  const allTypes = [...new Set(graph.edges.map((e) => e.type))];
  const otherTypes = allTypes.filter((t) => t !== base.type);
  // Fabricated fallbacks keep the check working even if the dataset ever
  // shrinks to fewer than three relation types.
  while (otherTypes.length < 2)
    otherTypes.push(`injectedRelation${otherTypes.length}`);
  const donors: GraphEdge[] = [];
  for (const e of graph.edges) {
    if (!e.sectionId) continue;
    if (e.sectionId === base.sectionId) continue;
    if (donors.some((d) => d.sectionId === e.sectionId)) continue;
    if (e.citation === base.citation) continue;
    if (donors.some((d) => d.citation === e.citation)) continue;
    donors.push(e);
    if (donors.length === 2) break;
  }
  if (donors.length < 2)
    throw new Error("not enough distinct sectionIds available for injection");
  const injected: GraphEdge[] = donors.map((donor, i) => ({
    ...base,
    type: otherTypes[i],
    predicateUri: base.predicateUri.replace(/#.*$/, `#injectedTest${i + 1}`),
    ref: donor.ref,
    citation: donor.citation,
    sectionId: donor.sectionId,
    certainty: i === 0 ? "reported" : base.certainty,
  }));
  console.log(
    `  injecting 2 duplicates: ${base.from} → ${base.to} (${[
      base.type,
      ...injected.map((e) => e.type),
    ].join(" + ")})`,
  );

  const expected = [base, ...injected].map((e) => ({
    type: e.type,
    citation: e.citation,
    sectionId: e.sectionId!,
  }));
  // The detail card renders the type camelCase-split and uppercased via
  // CSS; compare against the un-cased split form.
  const splitType = (t: string) => t.replace(/([A-Z])/g, " $1").trim();

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    const guard = attachPageGuard(page);
    // Serve the real payload plus the injected duplicate edges.
    await page.route("**/legomena/api/graph", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ...graph,
          edges: [...graph.edges, ...injected],
        }),
      });
    });
    await page.goto(`${BASE_URL}/legomena/graph`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForSelector("path[data-testid='graph-edge']", {
        timeout: 15000,
      }),
    );

    console.log("Check 2: exactly three distinct curved arcs render");
    const arcs = await page.evaluate(() => {
      const paths = Array.from(
        document.querySelectorAll("path[data-testid='graph-edge']"),
      );
      return {
        total: paths.length,
        curved: paths
          .map((p, i) => ({ i, d: p.getAttribute("d") ?? "" }))
          .filter((p) => p.d.includes(" Q ")),
      };
    });
    const total = graph.edges.length + injected.length;
    check(`all ${total} edges render`, arcs.total === total, `got ${arcs.total}`);
    check(
      "exactly 3 curved (Q) arc paths",
      arcs.curved.length === 3,
      `got ${arcs.curved.length}`,
    );
    check(
      "the three arcs have pairwise-distinct path data",
      arcs.curved.length === 3 &&
        new Set(arcs.curved.map((c) => c.d)).size === 3,
      arcs.curved.map((c) => c.d).join(" vs "),
    );
    // All three arcs share the same endpoints (canonical orientation);
    // offsets -1/0/+1 mean one bows each side and the middle control
    // point sits ON the straight line (cross product ~0).
    if (arcs.curved.length === 3) {
      const parse = (d: string) => {
        const m =
          /^M ([-\d.]+) ([-\d.]+) Q ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)$/.exec(
            d,
          );
        if (!m) return null;
        const [ax, ay, mx, my, bx, by] = m.slice(1).map(Number);
        return { ax, ay, mx, my, bx, by };
      };
      const ps = arcs.curved.map((c) => parse(c.d));
      const cross = (p: NonNullable<ReturnType<typeof parse>>) =>
        (p.bx - p.ax) * (p.my - p.ay) - (p.by - p.ay) * (p.mx - p.ax);
      const sameEndpoints =
        ps.every((p) => !!p) &&
        ps.every(
          (p) =>
            p!.ax === ps[0]!.ax &&
            p!.ay === ps[0]!.ay &&
            p!.bx === ps[0]!.bx &&
            p!.by === ps[0]!.by,
        );
      check("all three arcs share endpoints", sameEndpoints);
      if (sameEndpoints) {
        const crosses = ps.map((p) => cross(p!)).sort((a, b) => a - b);
        // Normalize by chord length² so the tolerance is geometric.
        const p0 = ps[0]!;
        const len2 =
          (p0.bx - p0.ax) ** 2 + (p0.by - p0.ay) ** 2 || 1;
        const norm = crosses.map((c) => c / len2);
        check(
          "offsets are one each side plus a straight middle (-,0,+)",
          norm[0] < -1e-6 && Math.abs(norm[1]) < 1e-6 && norm[2] > 1e-6,
          `normalized crosses: ${norm.join(", ")}`,
        );
      }
    }

    console.log(
      "Check 3: each arc owns its midpoint under real hit-testing and opens its own detail card",
    );
    mkdirSync(SHOT_DIR, { recursive: true });
    // Real hit-test: sample points along the arc (in screen coordinates)
    // and ask document.elementFromPoint what's on top at each.
    //  - The arc must OWN at least one sampled point (its own transparent
    //    hit path topmost) — a user can genuinely click it.
    //  - No SIBLING parallel edge's hit path may be topmost anywhere
    //    along it — the middle (near-straight) edge isn't shadowed by
    //    its siblings' 12px hit areas. (Node labels/circles overlapping
    //    a point are fine; they are a different, pre-existing layer.)
    // The click is then dispatched on the element really on top at an
    // owned point — the honest simulation of a user clicking there — so
    // a shadowed edge would open the wrong card and fail the
    // type+citation match below.
    const hitTestAndClick = (idx: number) =>
      page.evaluate((i) => {
        const arcs = Array.from(
          document.querySelectorAll("path[data-testid='graph-edge']"),
        ).filter((p) => (p.getAttribute("d") ?? "").includes(" Q "));
        const arc = arcs[i] as SVGPathElement | undefined;
        if (!arc) throw new Error(`curved arc #${i} not found`);
        const hit = arc.parentElement?.querySelector(
          "path[stroke='transparent']",
        ) as SVGPathElement | null;
        if (!hit) throw new Error(`hit path for arc #${i} not found`);
        const siblingHits = new Set(
          arcs
            .filter((a) => a !== arc)
            .map((a) =>
              a.parentElement?.querySelector("path[stroke='transparent']"),
            )
            .filter((h): h is Element => !!h),
        );
        const ctm = arc.getScreenCTM();
        if (!ctm) throw new Error("no screen CTM");
        const len = arc.getTotalLength();
        let owned: Element | null = null;
        let shadowedBySibling = 0;
        const tops: string[] = [];
        for (let t = 0.15; t <= 0.851; t += 0.05) {
          const p = arc.getPointAtLength(len * t);
          const sx = ctm.a * p.x + ctm.c * p.y + ctm.e;
          const sy = ctm.b * p.x + ctm.d * p.y + ctm.f;
          const top = document.elementFromPoint(sx, sy);
          if (top === hit && !owned) owned = top;
          if (top && siblingHits.has(top)) shadowedBySibling++;
          tops.push(top ? top.tagName : "null");
        }
        // Click the element really on top at an owned point.
        (owned ?? hit).dispatchEvent(
          new MouseEvent("click", { bubbles: true }),
        );
        return {
          ownsAPoint: !!owned,
          shadowedBySibling,
          topDesc: tops.join(","),
        };
      }, idx);
    const readCard = () =>
      page.evaluate(() => {
        const btn = document.querySelector(
          "button[aria-label='Close edge detail']",
        );
        const card = btn?.closest("div.absolute") as HTMLElement | null;
        if (!card) return null;
        const typeEl = card.querySelector("span.uppercase");
        const link = card.querySelector("a") as HTMLAnchorElement | null;
        return {
          type: typeEl?.textContent?.trim() ?? null,
          text: card.innerText,
          citation: link?.textContent?.replace(/→\s*$/, "").trim() ?? null,
          href: link?.getAttribute("href") ?? null,
        };
      });

    const seen: string[] = [];
    for (const idx of [0, 1, 2]) {
      const hitInfo = await hitTestAndClick(idx);
      check(
        `arc #${idx + 1}: its own hit path is topmost somewhere along the arc`,
        hitInfo.ownsAPoint,
        `elementFromPoint tops → ${hitInfo.topDesc}`,
      );
      check(
        `arc #${idx + 1}: no sibling parallel edge shadows it at any sampled point`,
        hitInfo.shadowedBySibling === 0,
        `${hitInfo.shadowedBySibling} sampled point(s) owned by a sibling hit path`,
      );
      await page.waitForSelector("button[aria-label='Close edge detail']", {
        timeout: 5000,
      });
      const card = await readCard();
      check(`arc #${idx + 1}: detail card opens`, !!card);
      if (!card) continue;
      const match = expected.find(
        (e) => splitType(e.type) === card.type && e.citation === card.citation,
      );
      check(
        `arc #${idx + 1}: card shows a matching relation type + citation pair`,
        !!match,
        `type=${card.type} citation=${card.citation}`,
      );
      check(
        `arc #${idx + 1}: card names ${base.from} → ${base.to}`,
        card.text.includes(base.from) && card.text.includes(base.to),
      );
      if (match) {
        check(
          `arc #${idx + 1}: citation links to /legomena/reader/${match.sectionId}`,
          card.href === `/legomena/reader/${match.sectionId}`,
          `href=${card.href}`,
        );
        seen.push(`${match.type}|${match.citation}`);
      }
      await page.screenshot({
        path: `${SHOT_DIR}/arc-${idx + 1}-card.png`,
      });
      // Close the card before the next click.
      await page.click("button[aria-label='Close edge detail']");
      await page.waitForSelector("button[aria-label='Close edge detail']", {
        state: "detached",
        timeout: 5000,
      });
    }
    check(
      "the three arcs opened three DIFFERENT cards (all relations reachable)",
      new Set(seen).size === 3,
      `saw: ${seen.join(" ; ")}`,
    );
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll duplicate-arc checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
