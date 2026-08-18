/// <reference lib="dom" />
/* Real-browser check: the curated doctrine hedge notes (doctrineNote on
 * SCHOOL_DOCTRINES, served by /api/graph) actually render on the Graph
 * page when a school's node is selected. The page-contracts validator
 * proves the API serves the notes, but nothing confirmed a reader can
 * SEE them: graph.tsx could drop the <p> or a style change could hide
 * it while API checks stay green.
 *
 * For EVERY movement that carries a doctrineNote (positive control:
 * fails if the API serves none), the script picks a KG node of that
 * movement, opens /graph?p=<node> in headless Chromium, and asserts:
 *
 * 1. The side panel shows the "School doctrine" block with the
 *    doctrine text.
 * 2. The hedge note's full text is rendered in the SAME block,
 *    AFTER the doctrine line, in the italic muted style.
 * 3. The note is actually visible (non-zero client rect), not merely
 *    present in the DOM.
 *
 * As a contrast check, one movement WITHOUT a doctrineNote (if any)
 * must render its doctrine block with no italic hedge line.
 *
 * Requirements: api-server and laertius web workflows running, and the
 * headless Chromium shell installed (same setup as e2e-graph-associates):
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
  nodes: { name: string; movement: string }[];
  movements: {
    id: string;
    label: string;
    doctrine?: string;
    doctrineNote?: string;
  }[];
}

interface DoctrineBlock {
  found: boolean;
  doctrineText: string;
  noteText: string | null;
  noteItalic: boolean;
  noteMuted: boolean;
  noteVisible: boolean;
  noteAfterDoctrine: boolean;
}

async function main() {
  const apiRes = await fetch(`${BASE_URL}/api/graph`);
  if (!apiRes.ok) throw new Error(`/api/graph returned ${apiRes.status}`);
  const api = (await apiRes.json()) as ApiGraph;

  const withNote = api.movements.filter(
    (m) => m.doctrine && m.doctrineNote,
  );
  check(
    "positive control: API serves at least one doctrineNote",
    withNote.length > 0,
    `movements with notes: ${withNote.length}`,
  );
  if (withNote.length === 0) process.exit(1);
  console.log(
    `movements with hedge notes: ${withNote.map((m) => m.label).join(", ")}`,
  );

  const withoutNote = api.movements.find(
    (m) =>
      m.doctrine &&
      !m.doctrineNote &&
      api.nodes.some((n) => n.movement === m.id),
  );

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    const guard = attachPageGuard(page);

    const readDoctrineBlock = () =>
      page.evaluate((): DoctrineBlock => {
        const label = Array.from(document.querySelectorAll("span")).find(
          (el) => el.textContent?.trim() === "School doctrine",
        );
        const block = label?.parentElement;
        if (!block)
          return {
            found: false,
            doctrineText: "",
            noteText: null,
            noteItalic: false,
            noteMuted: false,
            noteVisible: false,
            noteAfterDoctrine: false,
          };
        const paras = Array.from(block.querySelectorAll("p"));
        const doctrineP = paras[0] ?? null;
        const noteP =
          paras.find((p) => p.classList.contains("italic")) ?? null;
        let visible = false;
        if (noteP) {
          const r = noteP.getBoundingClientRect();
          const style = getComputedStyle(noteP);
          visible =
            r.width > 0 &&
            r.height > 0 &&
            style.visibility !== "hidden" &&
            style.display !== "none" &&
            parseFloat(style.opacity || "1") > 0.1;
        }
        return {
          found: true,
          doctrineText: doctrineP?.textContent?.trim() ?? "",
          noteText: noteP?.textContent?.trim() ?? null,
          noteItalic: !!noteP?.classList.contains("italic"),
          noteMuted: !!noteP?.classList.contains("text-muted-foreground"),
          noteVisible: visible,
          noteAfterDoctrine:
            !!noteP &&
            !!doctrineP &&
            !!(
              doctrineP.compareDocumentPosition(noteP) &
              Node.DOCUMENT_POSITION_FOLLOWING
            ),
        };
      });

    for (const movement of withNote) {
      const node = api.nodes.find((n) => n.movement === movement.id);
      if (!node) {
        check(
          `${movement.label}: has a selectable KG node`,
          false,
          "no node in this movement",
        );
        continue;
      }
      console.log(
        `Scenario: select ${node.name} (${movement.label}) -> hedge note visible`,
      );
      await page.goto(
        `${BASE_URL}/graph?p=${encodeURIComponent(node.name)}`,
        { waitUntil: "networkidle" },
      );
      guard.assertPageLoaded();
      await guard.guarded(
        page.waitForSelector("svg[role='img'] g.cursor-pointer"),
      );
      const block = await readDoctrineBlock();
      check(`${movement.label}: School doctrine block rendered`, block.found);
      check(
        `${movement.label}: doctrine line shows the doctrine text`,
        block.doctrineText.includes(movement.doctrine!),
        `got "${block.doctrineText.slice(0, 80)}"`,
      );
      check(
        `${movement.label}: hedge note text rendered verbatim`,
        block.noteText === movement.doctrineNote,
        `got ${JSON.stringify(block.noteText?.slice(0, 80) ?? null)}`,
      );
      check(
        `${movement.label}: note styled as italic muted aside`,
        block.noteItalic && block.noteMuted,
      );
      check(
        `${movement.label}: note appears AFTER the doctrine line`,
        block.noteAfterDoctrine,
      );
      check(
        `${movement.label}: note is visible (non-zero rect, not hidden)`,
        block.noteVisible,
      );
    }

    if (withoutNote) {
      const node = api.nodes.find((n) => n.movement === withoutNote.id)!;
      console.log(
        `Contrast: select ${node.name} (${withoutNote.label}, no note) -> no italic hedge line`,
      );
      await page.goto(
        `${BASE_URL}/graph?p=${encodeURIComponent(node.name)}`,
        { waitUntil: "networkidle" },
      );
      guard.assertPageLoaded();
      await guard.guarded(
        page.waitForSelector("svg[role='img'] g.cursor-pointer"),
      );
      const block = await readDoctrineBlock();
      check(
        `${withoutNote.label}: doctrine block rendered`,
        block.found,
      );
      check(
        `${withoutNote.label}: no italic hedge line for a note-less school`,
        block.noteText === null,
        `got ${JSON.stringify(block.noteText)}`,
      );
    }

    await page.close();
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll doctrine hedge note checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
