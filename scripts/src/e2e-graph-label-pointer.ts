/// <reference lib="dom" />
/* Real-browser check: philosopher name <text> labels on the Legomena
 * Assertion Graph (/legomena/graph) no longer swallow clicks meant for
 * edges passing beneath them.
 *
 * Labels are rendered after edges inside each node <g>; with default
 * pointer events a label sitting over an edge made elementFromPoint
 * return the <text>, so a click navigated to the node's entity page
 * instead of opening the edge card. The fix sets pointer-events: none
 * on the label.
 *
 * Asserts in headless Chromium:
 * 1. Every node label really has pointer-events disabled.
 * 2. Positive control: at least one sampled edge point lies inside some
 *    label's bounding box (so the check can't pass vacuously), and NO
 *    sampled edge point anywhere hit-tests to a <text> element.
 * 3. At an edge point inside a label's bbox, elementFromPoint returns
 *    that edge's own transparent hit path, and clicking it opens the
 *    edge detail card (not the entity page).
 * 4. Node circles still work: elementFromPoint at a node center is the
 *    circle, and clicking it navigates to the entity page.
 *
 * Requirements: laertius web + legomena api workflows behind the shared
 * proxy (default http://localhost:80) and a Chromium headless shell for
 * playwright-core.
 */
import { mkdirSync } from "node:fs";

import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";
const SHOT_DIR =
  process.env.E2E_SHOT_DIR ?? "../docs/verification/graph-label-pointer";

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
    const guard = attachPageGuard(page);
    await page.goto(`${BASE_URL}/legomena/graph`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForSelector("path[data-testid='graph-edge']", {
        timeout: 15000,
      }),
    );
    mkdirSync(SHOT_DIR, { recursive: true });

    console.log("Check 1: every node label has pointer-events disabled");
    const labelPe = await page.evaluate(() => {
      const texts = Array.from(
        document.querySelectorAll("svg[role='img'] g > text"),
      );
      return {
        total: texts.length,
        bad: texts.filter(
          (t) => getComputedStyle(t).pointerEvents !== "none",
        ).length,
      };
    });
    check(
      `all ${labelPe.total} labels have pointer-events: none`,
      labelPe.total > 0 && labelPe.bad === 0,
      `total=${labelPe.total} without=${labelPe.bad}`,
    );

    console.log(
      "Check 2/3: edge points under labels hit-test to the edge's own hit path",
    );
    const probe = await page.evaluate(() => {
      const svg = document.querySelector("svg[role='img']")!;
      const edges = Array.from(
        svg.querySelectorAll("path[data-testid='graph-edge']"),
      ) as SVGPathElement[];
      const labels = Array.from(svg.querySelectorAll("g > text")).map((t) =>
        (t as SVGTextElement).getBoundingClientRect(),
      );
      // No named helper functions inside evaluate: tsx's esbuild transform
      // wraps named locals with a __name helper that doesn't exist in the
      // page — so the label-bbox test is inlined per use.
      let sampled = 0;
      let underLabel = 0;
      let textTop = 0;
      const textTops: string[] = [];
      let coveredOwnHit: {
        edgeIndex: number;
        x: number;
        y: number;
      } | null = null;
      edges.forEach((edge, edgeIndex) => {
        const hit = edge.parentElement?.querySelector(
          "path[stroke='transparent']",
        );
        const ctm = edge.getScreenCTM();
        if (!hit || !ctm) return;
        const len = edge.getTotalLength();
        for (let t = 0.05; t <= 0.951; t += 0.05) {
          const p = edge.getPointAtLength(len * t);
          const sx = ctm.a * p.x + ctm.c * p.y + ctm.e;
          const sy = ctm.b * p.x + ctm.d * p.y + ctm.f;
          sampled++;
          const covered = labels.some(
            (r) =>
              sx >= r.left && sx <= r.right && sy >= r.top && sy <= r.bottom,
          );
          if (covered) underLabel++;
          const top = document.elementFromPoint(sx, sy);
          if (top && top.tagName.toLowerCase() === "text") {
            textTop++;
            if (textTops.length < 5)
              textTops.push(`${top.textContent} @${sx.toFixed(0)},${sy.toFixed(0)}`);
          }
          if (covered && top === hit && !coveredOwnHit)
            coveredOwnHit = { edgeIndex, x: sx, y: sy };
        }
      });
      return { sampled, underLabel, textTop, textTops, coveredOwnHit };
    });
    check(
      "positive control: some sampled edge point lies inside a label bbox",
      probe.underLabel > 0,
      `sampled=${probe.sampled} underLabel=${probe.underLabel}`,
    );
    check(
      "no sampled edge point hit-tests to a <text> label",
      probe.textTop === 0,
      `${probe.textTop} text-topped points, e.g. ${probe.textTops.join("; ")}`,
    );
    check(
      "an edge point covered by a label hit-tests to that edge's own hit path",
      !!probe.coveredOwnHit,
    );

    if (probe.coveredOwnHit) {
      const { x, y } = probe.coveredOwnHit;
      await page.mouse.click(x, y);
      const card = await page
        .waitForSelector("button[aria-label='Close edge detail']", {
          timeout: 5000,
        })
        .catch(() => null);
      check(
        "clicking that covered edge point opens the edge detail card",
        !!card,
      );
      check(
        "the click did not navigate away from /legomena/graph",
        page.url().includes("/legomena/graph"),
        page.url(),
      );
      await page.screenshot({ path: `${SHOT_DIR}/edge-card-under-label.png` });
      if (card) {
        await page.click("button[aria-label='Close edge detail']");
        await page.waitForSelector("button[aria-label='Close edge detail']", {
          state: "detached",
          timeout: 5000,
        });
      }
    }

    console.log("Check 4: node circles still hover and click as before");
    const nodeInfo = await page.evaluate(() => {
      const circles = Array.from(
        document.querySelectorAll("circle[data-testid='graph-node']"),
      ) as SVGCircleElement[];
      for (const c of circles) {
        const r = c.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const top = document.elementFromPoint(cx, cy);
        if (top === c) return { x: cx, y: cy, ok: true };
      }
      return { x: 0, y: 0, ok: false };
    });
    check(
      "a node circle is topmost at its own center",
      nodeInfo.ok,
    );
    if (nodeInfo.ok) {
      await page.mouse.click(nodeInfo.x, nodeInfo.y);
      await page.waitForURL(/\/legomena\/entity\?uri=/, { timeout: 5000 });
      check(
        "clicking the node circle navigates to the entity page",
        page.url().includes("/legomena/entity?uri="),
        page.url(),
      );
      await page.screenshot({ path: `${SHOT_DIR}/node-click-entity.png` });
    }
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll label-pointer checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
