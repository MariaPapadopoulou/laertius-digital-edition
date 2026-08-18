/// <reference lib="dom" />
/* Real-browser check: the Graph page actually renders the satellite
 * associates layer. validate-graph-associates and the bundle smoke test
 * pin the served /api/graph associates payload, but a frontend
 * regression in graph.tsx (a renamed field read, a broken join by
 * teacher or anchor) would pass those while the page silently loses
 * its satellites. This script drives headless Chromium against the
 * running dev servers and asserts, in the live SVG:
 *
 * 1. All pinned satellite dots (the small r=4 circles) are drawn,
 *    one per pinned associate, with the pinned per-school counts.
 * 2. The four hedged roster members get the hedged dot styling
 *    (dashed ring, lighter fill); asserted members do not.
 * 3. Every satellite has exactly one leg line, and each leg's two
 *    endpoints geometrically match the dot and its expected parent:
 *    the cited teacher when the succession names one (the 30 pinned
 *    teacher legs), else the school's founder anchor.
 * 4. Hedged teacher legs (and hedged anchor legs) use the sparser
 *    dash pattern; asserted legs use the normal one.
 * 5. Clicking a satellite dot opens the associate side panel: the
 *    heading shows the name, the "hedged" badge appears only for
 *    hedged roster members, and clicking the "pupil of" teacher link
 *    re-selects the teacher (the panel heading switches to the
 *    teacher and the selection ring moves to the teacher's node).
 *    Exercised with one asserted associate (Sextus Empiricus, whose
 *    teacher is another satellite) and one hedged associate
 *    (Nicolochus of Rhodes, whose reported teacher Timon is a KG
 *    node).
 * 6. The movement legend filter dims the right satellites: toggling
 *    one school's legend chip must keep that school's dots fully
 *    visible (opacity 1) and dim every other school's dot (0.18),
 *    with the same split checked per pinned school count; each
 *    satellite's leg line must dim in lockstep (0.3 when both
 *    endpoints pass the filter, else 0.05); clicking "show all"
 *    must restore every satellite to full opacity.
 * 7. Following a satellite panel's "(D.L. <ref>)" passage link
 *    actually opens the cited section: clicking Sextus Empiricus and
 *    then his "(D.L. 9.116)" link must navigate to
 *    /section/9.12.116 and render the section page (heading, Book/
 *    Chapter/Section line, and the associate's name in the passage).
 * 8. The founder and doctrine passage links join the same way:
 *    clicking the KG node Zeno of Citium must show the "Founder of
 *    the Stoa school. (D.L. 6.105)" link and the Stoa "School
 *    doctrine ... (D.L. 7.87)" link, each backed by the served
 *    founderSectionId/doctrineSectionId; following them must land on
 *    /section/6.9.105 (Menedemus the Cynic's chapter) and
 *    /section/7.1.87 (Zeno's own chapter) with the rendered heading
 *    and Book/Chapter/Section line checked on each.
 *
 * Requirements: the API server and web workflows must be running (the
 * script talks to the shared proxy, default http://localhost:80), and
 * a Chromium headless shell must be installed for playwright-core:
 *   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
 *     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell
 */
import {
  PINNED_COUNTS,
  PINNED_TOTAL,
  PINNED_ANCHORS,
  PINNED_HEDGED,
  PINNED_LEGS,
} from "./graph-associate-pins.js";

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

interface ApiAssociate {
  name: string;
  movement: string;
  anchor: string;
  asserted: boolean;
  teacher?: string;
  teacherAsserted?: boolean;
}

async function main() {
  // The served associates payload, used to derive each satellite's
  // expected parent and hedging (the API-level validators already pin
  // this payload against the same shared pins).
  const apiRes = await fetch(`${BASE_URL}/api/graph`);
  if (!apiRes.ok) throw new Error(`/api/graph returned ${apiRes.status}`);
  const api = (await apiRes.json()) as {
    nodes: { name: string; movement: string }[];
    edges: { from: string; to: string; type: string }[];
    associates: ApiAssociate[];
  };
  const associates = api.associates ?? [];
  check(
    `API serves the pinned ${PINNED_TOTAL} associates`,
    associates.length === PINNED_TOTAL,
    `got ${associates.length}`,
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
    // The satellite layer renders in the same pass as the KG nodes;
    // wait for at least one small dot to be present.
    await guard.guarded(
      page.waitForFunction(
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

    // Snapshot every drawn node group (name, position, dot styling)
    // and every line's endpoints + dash pattern.
    const snap = await page.evaluate(() => {
      const svg = document.querySelector("svg[role='img']");
      if (!svg) throw new Error("graph svg not found");
      const groups = Array.from(
        svg.querySelectorAll("g.cursor-pointer"),
      ).flatMap((g) => {
        const circle = g.querySelector("circle");
        const text = g.querySelector("text");
        const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(
          g.getAttribute("transform") ?? "",
        );
        if (!circle || !text || !m) return [];
        return [
          {
            name: text.textContent ?? "",
            x: parseFloat(m[1]),
            y: parseFloat(m[2]),
            r: parseFloat(circle.getAttribute("r") ?? "0"),
            dash: circle.getAttribute("stroke-dasharray"),
            fillOpacity: circle.getAttribute("fill-opacity"),
          },
        ];
      });
      const lines = Array.from(svg.querySelectorAll(":scope > line")).map(
        (l) => ({
          x1: parseFloat(l.getAttribute("x1") ?? "0"),
          y1: parseFloat(l.getAttribute("y1") ?? "0"),
          x2: parseFloat(l.getAttribute("x2") ?? "0"),
          y2: parseFloat(l.getAttribute("y2") ?? "0"),
          dash: l.getAttribute("stroke-dasharray"),
        }),
      );
      return { groups, lines };
    });

    const positions = new Map(
      snap.groups.map((g) => [g.name, { x: g.x, y: g.y }]),
    );
    const dots = snap.groups.filter((g) => g.r === 4);
    const dotByName = new Map(dots.map((d) => [d.name, d]));

    console.log("Check 1: satellite dot roster and per-school counts");
    check(
      `${PINNED_TOTAL} satellite dots drawn`,
      dots.length === PINNED_TOTAL,
      `got ${dots.length}`,
    );
    for (const a of associates) {
      check(`dot drawn for ${a.name}`, dotByName.has(a.name));
    }
    for (const [movement, count] of Object.entries(PINNED_COUNTS)) {
      const drawn = associates.filter(
        (a) => a.movement === movement && dotByName.has(a.name),
      ).length;
      check(
        `${movement}: ${count} dots drawn`,
        drawn === count,
        `got ${drawn}`,
      );
    }
    for (const anchor of Object.values(PINNED_ANCHORS)) {
      check(`founder anchor ${anchor} is drawn`, positions.has(anchor));
    }

    console.log("Check 2: hedged dot styling");
    const hedgedSet = new Set(PINNED_HEDGED);
    for (const a of associates) {
      const dot = dotByName.get(a.name);
      if (!dot) continue;
      if (hedgedSet.has(a.name)) {
        check(
          `${a.name}: hedged dot has dashed ring + lighter fill`,
          dot.dash === "2 2" && dot.fillOpacity === "0.45",
          `dash=${dot.dash} fillOpacity=${dot.fillOpacity}`,
        );
      } else {
        check(
          `${a.name}: asserted dot has solid ring + full fill`,
          dot.dash === null && dot.fillOpacity === "0.85",
          `dash=${dot.dash} fillOpacity=${dot.fillOpacity}`,
        );
      }
    }
    check(
      `exactly ${PINNED_HEDGED.length} hedged dots`,
      dots.filter((d) => d.dash === "2 2").length === PINNED_HEDGED.length,
      `got ${dots.filter((d) => d.dash === "2 2").length}`,
    );

    console.log("Check 3: leg lines join each dot to its teacher or anchor");
    const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
    // Associate legs are the only lines with these dash patterns.
    const legLines = snap.lines.filter(
      (l) => l.dash === "2 3" || l.dash === "1 3.5",
    );
    check(
      `${PINNED_TOTAL} leg lines drawn`,
      legLines.length === PINNED_TOTAL,
      `got ${legLines.length}`,
    );
    let teacherLegs = 0;
    for (const a of associates) {
      const dot = positions.get(a.name);
      if (!dot) continue;
      const usesTeacher = !!a.teacher && positions.has(a.teacher);
      const parentName = usesTeacher ? a.teacher! : a.anchor;
      const parent = positions.get(parentName);
      if (!parent) {
        check(`${a.name}: parent ${parentName} drawn`, false);
        continue;
      }
      if (usesTeacher) teacherLegs++;
      const hedgedLeg = a.teacher
        ? a.teacherAsserted === false
        : !a.asserted;
      const expectedDash = hedgedLeg ? "1 3.5" : "2 3";
      const leg = legLines.find(
        (l) =>
          near(l.x1, parent.x) &&
          near(l.y1, parent.y) &&
          near(l.x2, dot.x) &&
          near(l.y2, dot.y),
      );
      check(
        `${a.name}: leg from ${parentName}${hedgedLeg ? " (hedged dash)" : ""}`,
        !!leg && leg.dash === expectedDash,
        leg ? `dash=${leg.dash}, want ${expectedDash}` : "no matching line",
      );
    }
    check(
      `${PINNED_LEGS.length} teacher legs (rest fall back to founder anchors)`,
      teacherLegs === PINNED_LEGS.length,
      `got ${teacherLegs}`,
    );
    // Every pinned teacher leg is drawn from that exact teacher.
    for (const [pupil, teacher] of PINNED_LEGS) {
      const a = associates.find((x) => x.name === pupil);
      check(
        `pinned leg ${pupil} <- ${teacher} joins the drawn teacher`,
        !!a && a.teacher === teacher && positions.has(teacher),
        a ? `api teacher=${a.teacher}` : "pupil missing from API",
      );
    }

    console.log("Check 4: clicking a satellite opens its details panel");
    // Click a node by dispatching a bubbling click on its exact-name
    // <text> (a plain Playwright click would first auto-scroll and can
    // be intercepted by overlapping labels in the dense SVG).
    const clickNode = (name: string) =>
      page.evaluate((n) => {
        const t = Array.from(
          document.querySelectorAll("svg[role='img'] g.cursor-pointer text"),
        ).find((el) => el.textContent === n);
        if (!t) throw new Error(`node text not found: ${n}`);
        t.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }, name);
    // Snapshot the side panel: heading, badges, and the teacher link.
    const readPanel = () =>
      page.evaluate(() => {
        const h2 = document.querySelector(
          "div.lg\\:col-span-3 h2",
        ) as HTMLElement | null;
        const panel = h2?.closest("div.bg-card") as HTMLElement | null;
        const badges = panel
          ? Array.from(panel.querySelectorAll("span")).map((s) =>
              (s.textContent ?? "").trim(),
            )
          : [];
        const pupilP = panel
          ? Array.from(panel.querySelectorAll("p")).find((p) =>
              /pupil of/i.test(p.textContent ?? ""),
            )
          : undefined;
        const pupilBtn = pupilP?.querySelector("button");
        return {
          heading: h2?.textContent ?? null,
          hasHedgedBadge: badges.includes("hedged"),
          hasReportedBadge: badges.includes("reported"),
          pupilText: pupilP?.textContent?.trim() ?? null,
          pupilTeacher: pupilBtn?.textContent ?? null,
        };
      });
    const clickPupilLink = () =>
      page.evaluate(() => {
        const panel = document
          .querySelector("div.lg\\:col-span-3 h2")
          ?.closest("div.bg-card");
        const p = panel
          ? Array.from(panel.querySelectorAll("p")).find((el) =>
              /pupil of/i.test(el.textContent ?? ""),
            )
          : undefined;
        const btn = p?.querySelector("button");
        if (!btn) throw new Error("pupil-of teacher link not found");
        btn.click();
      });
    // The selection ring: the selected node's circle switches its
    // stroke to currentColor with the thicker width (2 for satellite
    // dots, 2.5 for KG nodes).
    const ringOn = (name: string) =>
      page.evaluate((n) => {
        const t = Array.from(
          document.querySelectorAll("svg[role='img'] g.cursor-pointer text"),
        ).find((el) => el.textContent === n);
        const c = t?.parentElement?.querySelector("circle");
        if (!c) return null;
        return {
          stroke: c.getAttribute("stroke"),
          width: parseFloat(c.getAttribute("stroke-width") ?? "0"),
        };
      }, name);

    const scenarios: {
      name: string;
      hedged: boolean;
      teacher: string;
      reportedTeacher: boolean;
    }[] = [
      {
        name: "Sextus Empiricus",
        hedged: false,
        teacher: "Herodotus of Tarsus",
        reportedTeacher: false,
      },
      {
        name: "Nicolochus of Rhodes",
        hedged: true,
        teacher: "Timon",
        reportedTeacher: true,
      },
    ];
    for (const sc of scenarios) {
      await clickNode(sc.name);
      await page.waitForFunction(
        (n) =>
          document.querySelector("div.lg\\:col-span-3 h2")?.textContent === n,
        sc.name,
        { timeout: 5000 },
      );
      const panel = await readPanel();
      check(`${sc.name}: panel heading shows the name`, panel.heading === sc.name);
      check(
        `${sc.name}: hedged badge ${sc.hedged ? "shown" : "absent"}`,
        panel.hasHedgedBadge === sc.hedged,
        `hasHedgedBadge=${panel.hasHedgedBadge}`,
      );
      check(
        `${sc.name}: "${sc.reportedTeacher ? "Reported pupil of" : "Pupil of"} ${sc.teacher}" link shown`,
        panel.pupilTeacher === sc.teacher &&
          !!panel.pupilText &&
          panel.pupilText.startsWith(
            sc.reportedTeacher ? "Reported pupil of" : "Pupil of",
          ) &&
          panel.hasReportedBadge === sc.reportedTeacher,
        `pupilText=${panel.pupilText} reportedBadge=${panel.hasReportedBadge}`,
      );
      const ownRing = await ringOn(sc.name);
      check(
        `${sc.name}: selection ring on the clicked dot`,
        !!ownRing && ownRing.stroke === "currentColor" && ownRing.width >= 2,
        JSON.stringify(ownRing),
      );
      await clickPupilLink();
      await page.waitForFunction(
        (n) =>
          document.querySelector("div.lg\\:col-span-3 h2")?.textContent === n,
        sc.teacher,
        { timeout: 5000 },
      );
      const teacherPanel = await readPanel();
      check(
        `${sc.name}: teacher link switches the panel to ${sc.teacher}`,
        teacherPanel.heading === sc.teacher,
        `heading=${teacherPanel.heading}`,
      );
      const teacherRing = await ringOn(sc.teacher);
      const oldRing = await ringOn(sc.name);
      check(
        `${sc.name}: selection ring moved to ${sc.teacher}`,
        !!teacherRing &&
          teacherRing.stroke === "currentColor" &&
          teacherRing.width >= 2 &&
          !!oldRing &&
          oldRing.stroke !== "currentColor",
        `teacher=${JSON.stringify(teacherRing)} old=${JSON.stringify(oldRing)}`,
      );
      // Deselect so the next scenario starts clean.
      await clickNode(sc.teacher);
      await page.waitForFunction(
        () => !document.querySelector("div.lg\\:col-span-3 h2"),
        undefined,
        { timeout: 5000 },
      );
    }

    console.log("Check 5: legend school filter dims the right satellites");
    // Read every satellite dot's rendered group opacity (satellites
    // are the r=4 circles; the opacity lives on the parent <g>).
    const readSatelliteOpacities = () =>
      page.evaluate(() => {
        const out: Record<string, string> = {};
        for (const g of Array.from(
          document.querySelectorAll("svg[role='img'] g.cursor-pointer"),
        )) {
          const c = g.querySelector("circle");
          const t = g.querySelector("text");
          if (!c || !t || c.getAttribute("r") !== "4") continue;
          out[t.textContent ?? ""] = g.getAttribute("opacity") ?? "";
        }
        return out;
      });
    const legendButtons = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll("button[title^='Toggle ']"),
      ).map((b) => b.getAttribute("title") ?? ""),
    );
    // Pick the sceptic school (the largest pinned roster) via its
    // API movement id, mapped to the legend label through the served
    // movements list.
    const movementsRes = await page.evaluate(async () => {
      const r = await fetch("/api/graph");
      const j = (await r.json()) as {
        movements: { id: string; label: string }[];
      };
      return j.movements;
    });
    const FILTER_MOVEMENT = "sceptic";
    const filterLabel = movementsRes.find(
      (m) => m.id === FILTER_MOVEMENT,
    )?.label;
    check(
      `legend has a chip for the ${FILTER_MOVEMENT} movement`,
      !!filterLabel && legendButtons.includes(`Toggle ${filterLabel}`),
      `label=${filterLabel} buttons=${legendButtons.join(", ")}`,
    );
    if (filterLabel) {
      const clickLegend = () =>
        page.click(`button[title="Toggle ${filterLabel}"]`);
      await clickLegend();
      await page.waitForFunction(
        (label) =>
          document
            .querySelector(`button[title="Toggle ${label}"]`)
            ?.getAttribute("aria-pressed") === "true",
        filterLabel,
        { timeout: 5000 },
      );
      const filtered = await readSatelliteOpacities();
      let keptVisible = 0;
      let dimmed = 0;
      for (const a of associates) {
        const op = filtered[a.name];
        if (op === undefined) {
          check(`${a.name}: dot still drawn while filtered`, false);
          continue;
        }
        if (a.movement === FILTER_MOVEMENT) {
          if (op === "1") keptVisible++;
          check(
            `${a.name} (${a.movement}): fully visible under the ${FILTER_MOVEMENT} filter`,
            op === "1",
            `opacity=${op}`,
          );
        } else {
          if (op === "0.18") dimmed++;
          check(
            `${a.name} (${a.movement}): dimmed under the ${FILTER_MOVEMENT} filter`,
            op === "0.18",
            `opacity=${op}`,
          );
        }
      }
      check(
        `exactly ${PINNED_COUNTS[FILTER_MOVEMENT]} satellites stay visible`,
        keptVisible === PINNED_COUNTS[FILTER_MOVEMENT],
        `got ${keptVisible}`,
      );
      check(
        `exactly ${PINNED_TOTAL - PINNED_COUNTS[FILTER_MOVEMENT]} satellites dimmed`,
        dimmed === PINNED_TOTAL - PINNED_COUNTS[FILTER_MOVEMENT],
        `got ${dimmed}`,
      );
      // The leg lines must dim in lockstep with the dots: a leg stays
      // at 0.3 only when BOTH endpoints pass the filter, else 0.05
      // (graph.tsx's inFocus check). Match each associate's leg by
      // its endpoint coordinates (the layout is filter-independent).
      const movementOf = new Map<string, string>();
      for (const n of api.nodes ?? []) movementOf.set(n.name, n.movement);
      for (const a of associates) {
        if (!movementOf.has(a.name)) movementOf.set(a.name, a.movement);
      }
      const readLegOpacities = () =>
        page.evaluate(() => {
          const svg = document.querySelector("svg[role='img']");
          if (!svg) throw new Error("graph svg not found");
          return Array.from(svg.querySelectorAll(":scope > line"))
            .filter((l) => {
              const d = l.getAttribute("stroke-dasharray");
              return d === "2 3" || d === "1 3.5";
            })
            .map((l) => ({
              x1: parseFloat(l.getAttribute("x1") ?? "0"),
              y1: parseFloat(l.getAttribute("y1") ?? "0"),
              x2: parseFloat(l.getAttribute("x2") ?? "0"),
              y2: parseFloat(l.getAttribute("y2") ?? "0"),
              opacity: l.getAttribute("opacity") ?? "",
            }));
        });
      const legForAssociate = (
        a: ApiAssociate,
        legs: Awaited<ReturnType<typeof readLegOpacities>>,
      ) => {
        const dot = positions.get(a.name);
        const parentName =
          a.teacher && positions.has(a.teacher) ? a.teacher : a.anchor;
        const parent = positions.get(parentName);
        if (!dot || !parent) return { parentName, leg: undefined };
        const near = (u: number, v: number) => Math.abs(u - v) < 0.01;
        return {
          parentName,
          leg: legs.find(
            (l) =>
              near(l.x1, parent.x) &&
              near(l.y1, parent.y) &&
              near(l.x2, dot.x) &&
              near(l.y2, dot.y),
          ),
        };
      };
      const filteredLegs = await readLegOpacities();
      let brightLegs = 0;
      let dimLegs = 0;
      for (const a of associates) {
        const { parentName, leg } = legForAssociate(a, filteredLegs);
        if (!leg) {
          check(`${a.name}: leg line still drawn while filtered`, false);
          continue;
        }
        const bothPass =
          a.movement === FILTER_MOVEMENT &&
          movementOf.get(parentName) === FILTER_MOVEMENT;
        const want = bothPass ? "0.3" : "0.05";
        if (leg.opacity === "0.3") brightLegs++;
        if (leg.opacity === "0.05") dimLegs++;
        check(
          `${a.name}: leg ${bothPass ? "stays bright (0.3)" : "dims to 0.05"} under the ${FILTER_MOVEMENT} filter`,
          leg.opacity === want,
          `opacity=${leg.opacity}, want ${want}`,
        );
      }
      const expectedBright = associates.filter(
        (a) =>
          a.movement === FILTER_MOVEMENT &&
          movementOf.get(
            a.teacher && positions.has(a.teacher) ? a.teacher : a.anchor,
          ) === FILTER_MOVEMENT,
      ).length;
      check(
        `exactly ${expectedBright} legs stay bright, ${PINNED_TOTAL - expectedBright} dimmed`,
        brightLegs === expectedBright &&
          dimLegs === PINNED_TOTAL - expectedBright,
        `bright=${brightLegs} dim=${dimLegs}`,
      );
      check(
        "the filter leaves at least one bright and one dimmed leg (non-vacuous)",
        expectedBright > 0 && expectedBright < PINNED_TOTAL,
        `expectedBright=${expectedBright} of ${PINNED_TOTAL}`,
      );
      // The KG succession/influence/spouse edges between main nodes
      // must dim in lockstep too: graph.tsx renders them at 0.35 and
      // drops to 0.06 when either endpoint fails the filter. These
      // are the svg > line elements whose dash is absent (teacherOf),
      // "4 3" (influenced) or "1.5 2.5" (spouseOf) — distinct from
      // the satellite legs' "2 3"/"1 3.5". Match each served edge by
      // its endpoint coordinates.
      const kgLines = await page.evaluate(() => {
        const svg = document.querySelector("svg[role='img']");
        if (!svg) throw new Error("graph svg not found");
        return Array.from(svg.querySelectorAll(":scope > line"))
          .filter((l) => {
            const d = l.getAttribute("stroke-dasharray");
            return d === null || d === "4 3" || d === "1.5 2.5";
          })
          .map((l) => ({
            x1: parseFloat(l.getAttribute("x1") ?? "0"),
            y1: parseFloat(l.getAttribute("y1") ?? "0"),
            x2: parseFloat(l.getAttribute("x2") ?? "0"),
            y2: parseFloat(l.getAttribute("y2") ?? "0"),
            opacity: l.getAttribute("opacity") ?? "",
          }));
      });
      const kgEdges = (api.edges ?? []).filter(
        (e) => positions.has(e.from) && positions.has(e.to),
      );
      check(
        `all ${kgEdges.length} KG edges drawn as arrow/solid lines`,
        kgEdges.length > 0 && kgLines.length === kgEdges.length,
        `served=${kgEdges.length} drawn=${kgLines.length}`,
      );
      let brightEdges = 0;
      let dimEdges = 0;
      let expectedBrightEdges = 0;
      for (const e of kgEdges) {
        const a = positions.get(e.from)!;
        const b = positions.get(e.to)!;
        const near = (u: number, v: number) => Math.abs(u - v) < 0.01;
        const line = kgLines.find(
          (l) =>
            near(l.x1, a.x) &&
            near(l.y1, a.y) &&
            near(l.x2, b.x) &&
            near(l.y2, b.y),
        );
        if (!line) {
          check(
            `KG edge ${e.from} -> ${e.to}: line still drawn while filtered`,
            false,
          );
          continue;
        }
        const bothPass =
          movementOf.get(e.from) === FILTER_MOVEMENT &&
          movementOf.get(e.to) === FILTER_MOVEMENT;
        if (bothPass) expectedBrightEdges++;
        const want = bothPass ? "0.35" : "0.06";
        if (line.opacity === "0.35") brightEdges++;
        if (line.opacity === "0.06") dimEdges++;
        check(
          `KG edge ${e.from} -> ${e.to} (${e.type}): ${bothPass ? "stays bright (0.35)" : "dims to 0.06"} under the ${FILTER_MOVEMENT} filter`,
          line.opacity === want,
          `opacity=${line.opacity}, want ${want}`,
        );
      }
      check(
        `exactly ${expectedBrightEdges} KG edges stay bright, ${kgEdges.length - expectedBrightEdges} dimmed`,
        brightEdges === expectedBrightEdges &&
          dimEdges === kgEdges.length - expectedBrightEdges,
        `bright=${brightEdges} dim=${dimEdges}`,
      );
      check(
        "the filter leaves at least one bright and one dimmed KG edge (non-vacuous)",
        expectedBrightEdges > 0 && expectedBrightEdges < kgEdges.length,
        `expectedBright=${expectedBrightEdges} of ${kgEdges.length}`,
      );
      // Clearing the filter ("show all") restores every satellite.
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find(
          (b) => b.textContent?.trim() === "show all",
        );
        if (!btn) throw new Error("show all button not found");
        btn.click();
      });
      await page.waitForFunction(
        (label) =>
          document
            .querySelector(`button[title="Toggle ${label}"]`)
            ?.getAttribute("aria-pressed") === "false",
        filterLabel,
        { timeout: 5000 },
      );
      const restored = await readSatelliteOpacities();
      const stillDim = associates.filter((a) => restored[a.name] !== "1");
      check(
        `"show all" restores all ${PINNED_TOTAL} satellites to full opacity`,
        stillDim.length === 0,
        stillDim.map((a) => `${a.name}=${restored[a.name]}`).join(", "),
      );
    }
    console.log(
      "Check 6: the panel's (D.L. ref) passage link opens the cited section",
    );
    // Sextus Empiricus: ref 9.116 -> section 9.12.116 (Timon's chapter).
    const passage = {
      name: "Sextus Empiricus",
      ref: "9.116",
      sectionId: "9.12.116",
      chapterSubject: "Timon",
      book: "9",
      chapter: "12",
      section: "116",
    };
    const apiAssoc = associates.find((a) => a.name === passage.name) as
      | (ApiAssociate & { ref?: string; sectionId?: string })
      | undefined;
    check(
      `${passage.name}: API serves ref ${passage.ref} -> sectionId ${passage.sectionId}`,
      apiAssoc?.ref === passage.ref && apiAssoc?.sectionId === passage.sectionId,
      `ref=${apiAssoc?.ref} sectionId=${apiAssoc?.sectionId}`,
    );
    await clickNode(passage.name);
    await page.waitForFunction(
      (n) =>
        document.querySelector("div.lg\\:col-span-3 h2")?.textContent === n,
      passage.name,
      { timeout: 5000 },
    );
    // The passage link is the panel's "(D.L. <ref>)" anchor (title
    // "Read this passage"); assert its href before following it.
    const linkInfo = await page.evaluate(() => {
      const panel = document
        .querySelector("div.lg\\:col-span-3 h2")
        ?.closest("div.bg-card");
      const a = panel?.querySelector(
        "a[title='Read this passage']",
      ) as HTMLAnchorElement | null;
      return a
        ? { href: a.getAttribute("href"), text: (a.textContent ?? "").trim() }
        : null;
    });
    check(
      `${passage.name}: panel shows the (D.L. ${passage.ref}) passage link to /section/${passage.sectionId}`,
      !!linkInfo &&
        linkInfo.href === `/section/${passage.sectionId}` &&
        linkInfo.text === `(D.L. ${passage.ref})`,
      JSON.stringify(linkInfo),
    );
    await page.evaluate(() => {
      const panel = document
        .querySelector("div.lg\\:col-span-3 h2")
        ?.closest("div.bg-card");
      const a = panel?.querySelector(
        "a[title='Read this passage']",
      ) as HTMLAnchorElement | null;
      if (!a) throw new Error("passage link not found in the panel");
      a.click();
    });
    await page.waitForFunction(
      (id) => window.location.pathname.endsWith(`/section/${id}`),
      passage.sectionId,
      { timeout: 5000 },
    );
    check(
      `passage link navigates to /section/${passage.sectionId}`,
      true,
    );
    // The section page must actually render: the chapter subject in
    // the heading, the Book/Chapter/Section line, and the associate's
    // own name somewhere in the cited passage text.
    await page.waitForSelector("h1", { timeout: 10000 });
    const sectionPage = await page.evaluate(() => ({
      heading: document.querySelector("h1")?.textContent?.trim() ?? null,
      body: document.body.innerText,
    }));
    check(
      `section page heading shows the chapter subject ${passage.chapterSubject}`,
      sectionPage.heading === passage.chapterSubject,
      `heading=${sectionPage.heading}`,
    );
    check(
      `section page shows Book ${passage.book}, Chapter ${passage.chapter}, Section ${passage.section}`,
      sectionPage.body.includes(
        `Book ${passage.book}, Chapter ${passage.chapter}, Section ${passage.section}`,
      ),
    );
    check(
      `cited passage mentions ${passage.name}`,
      sectionPage.body.includes(passage.name),
    );

    console.log(
      "Check 7: founder and doctrine (D.L. ref) links open their cited sections",
    );
    // Zeno of Citium: founder line ref 6.105 -> section 6.9.105 (in
    // Menedemus the Cynic's chapter), and the Stoa doctrine line ref
    // 7.87 -> section 7.1.87 (Zeno's own chapter).
    const anchorScenarios = [
      {
        kind: "founder" as const,
        node: "Zeno of Citium",
        lineRe: /Founder of the\s+Stoa\s+school/,
        ref: "6.105",
        sectionId: "6.9.105",
        chapterSubject: "Menedemus the Cynic",
        book: "6",
        chapter: "9",
        section: "105",
      },
      {
        kind: "doctrine" as const,
        node: "Zeno of Citium",
        lineRe: /School doctrine/i,
        ref: "7.87",
        sectionId: "7.1.87",
        chapterSubject: "Zeno of Citium",
        book: "7",
        chapter: "1",
        section: "87",
      },
    ];
    // Pin the served join first: the KG node's founderSectionId and
    // the movement's doctrineSectionId back the panel links.
    const kgApi = await page.evaluate(async () => {
      const r = await fetch("/api/graph");
      const j = (await r.json()) as {
        nodes: {
          name: string;
          movement: string;
          founderRef?: string;
          founderSectionId?: string;
        }[];
        movements: {
          id: string;
          doctrineRef?: string;
          doctrineSectionId?: string;
        }[];
      };
      return j;
    });
    const zeno = kgApi.nodes.find((n) => n.name === "Zeno of Citium");
    check(
      `API: Zeno of Citium founderRef 6.105 -> founderSectionId 6.9.105`,
      zeno?.founderRef === "6.105" && zeno?.founderSectionId === "6.9.105",
      `founderRef=${zeno?.founderRef} founderSectionId=${zeno?.founderSectionId}`,
    );
    const stoa = kgApi.movements.find((m) => m.id === zeno?.movement);
    check(
      `API: Stoa doctrineRef 7.87 -> doctrineSectionId 7.1.87`,
      stoa?.doctrineRef === "7.87" && stoa?.doctrineSectionId === "7.1.87",
      `doctrineRef=${stoa?.doctrineRef} doctrineSectionId=${stoa?.doctrineSectionId}`,
    );
    for (const sc of anchorScenarios) {
      // Return to the graph fresh (the previous scenario left us on a
      // section page) and select the founder anchor's KG node.
      await page.goto(`${BASE_URL}/graph`, { waitUntil: "networkidle" });
      guard.assertPageLoaded();
      await guard.guarded(
        page.waitForSelector("svg[role='img'] g.cursor-pointer text"),
      );
      await clickNode(sc.node);
      await page.waitForFunction(
        (n) =>
          document.querySelector("div.lg\\:col-span-3 h2")?.textContent === n,
        sc.node,
        { timeout: 5000 },
      );
      // Find the passage link by its exact "(D.L. <ref>)" text (the
      // panel has several "Read this passage" links).
      const info = await page.evaluate((ref) => {
        const panel = document
          .querySelector("div.lg\\:col-span-3 h2")
          ?.closest("div.bg-card");
        const links = panel
          ? Array.from(
              panel.querySelectorAll("a[title='Read this passage']"),
            )
          : [];
        const a = links.find(
          (l) => (l.textContent ?? "").trim() === `(D.L. ${ref})`,
        ) as HTMLAnchorElement | undefined;
        return {
          panelText: (panel as HTMLElement | null)?.innerText ?? "",
          href: a?.getAttribute("href") ?? null,
        };
      }, sc.ref);
      check(
        `${sc.node}: panel shows the ${sc.kind} line`,
        sc.lineRe.test(info.panelText),
        `panel text missing ${sc.lineRe}`,
      );
      check(
        `${sc.node}: ${sc.kind} (D.L. ${sc.ref}) link points to /section/${sc.sectionId}`,
        info.href === `/section/${sc.sectionId}`,
        `href=${info.href}`,
      );
      await page.evaluate((ref) => {
        const panel = document
          .querySelector("div.lg\\:col-span-3 h2")
          ?.closest("div.bg-card");
        const a = panel
          ? (Array.from(
              panel.querySelectorAll("a[title='Read this passage']"),
            ).find(
              (l) => (l.textContent ?? "").trim() === `(D.L. ${ref})`,
            ) as HTMLAnchorElement | undefined)
          : undefined;
        if (!a) throw new Error(`(D.L. ${ref}) passage link not found`);
        a.click();
      }, sc.ref);
      await page.waitForFunction(
        (id) => window.location.pathname.endsWith(`/section/${id}`),
        sc.sectionId,
        { timeout: 5000 },
      );
      check(
        `${sc.kind} link navigates to /section/${sc.sectionId}`,
        true,
      );
      // Wait for the SECTION page's h1, not just any h1: right after the
      // SPA route change the graph page (with its own h1) can still be
      // mounted for a beat under load, so "any non-empty h1" races.
      await page.waitForFunction(
        () => {
          const t = document.querySelector("h1")?.textContent?.trim();
          return !!t && t !== "Knowledge Graph of the Successions";
        },
        undefined,
        { timeout: 15000 },
      );
      const rendered = await page.evaluate(() => ({
        heading: document.querySelector("h1")?.textContent?.trim() ?? null,
        body: document.body.innerText,
      }));
      check(
        `${sc.kind} section heading shows ${sc.chapterSubject}`,
        rendered.heading === sc.chapterSubject,
        `heading=${rendered.heading}`,
      );
      check(
        `${sc.kind} section shows Book ${sc.book}, Chapter ${sc.chapter}, Section ${sc.section}`,
        rendered.body.includes(
          `Book ${sc.book}, Chapter ${sc.chapter}, Section ${sc.section}`,
        ),
      );
    }
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll graph-associates checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
