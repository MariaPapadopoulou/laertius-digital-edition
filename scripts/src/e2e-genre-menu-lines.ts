/// <reference lib="dom" />
// Companion to validate-genre-menu-labels.ts: that static check proves NO
// nav item in layout.tsx carries a `note:` (label-only menus, 2026-08), but
// the rendering code (renderDesktopGroup in layout.tsx) could change to
// mint a second descriptive line from somewhere else — a default note, a
// tooltip span, etc. — while the config stays clean.
//
// This check drives a real browser: it hovers EVERY header dropdown and
// asserts every entry renders exactly ONE line:
//   - no `font-serif` note span inside any entry (the note-line marker)
//   - exactly one child element per entry link (the label span)
//   - the rendered box is single-line tall (height < 2 label line-heights)
//
// Positive control: a synthetic font-serif note span is injected into the
// first "The Text" entry and must be detected by the same probe — proving
// the sweep cannot pass vacuously.
//
// Requirements: API server + laertius web workflows running (shared proxy,
// default http://localhost:80) and a Chromium headless shell installed for
// playwright-core — same setup as validate-home-dropdowns.ts.
import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

// Pinned group -> minimum entry count so an empty/unopened dropdown can't pass.
const GROUPS: { label: string; minEntries: number }[] = [
  { label: "The Text", minEntries: 3 },
  { label: "Textual genres", minEntries: 6 },
  { label: "Explorations", minEntries: 3 },
  { label: "Ask Laertius", minEntries: 4 },
  { label: "About", minEntries: 3 },
];

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

type EntryInfo = {
  label: string;
  serifSpans: number;
  childElements: number;
  linkHeight: number;
  labelLineHeight: number;
};

function groupTrigger(
  page: import("playwright-core").Page,
  groupLabel: string,
) {
  return page
    .locator("header nav > div")
    .filter({ has: page.locator(":scope > a, :scope > button") })
    .filter({ hasText: groupLabel })
    .first();
}

async function openAndInspect(
  page: import("playwright-core").Page,
  groupLabel: string,
  minEntries: number,
): Promise<EntryInfo[]> {
  const trigger = groupTrigger(page, groupLabel);

  await page.mouse.move(10, 400); // park away from the nav
  await page.waitForTimeout(150);
  await trigger.locator(":scope > a, :scope > button").first().hover();

  // Poll until the dropdown has mounted with at least minEntries links.
  const deadline = Date.now() + 5000;
  let entries: EntryInfo[] = [];
  while (entries.length < minEntries && Date.now() < deadline) {
    await page.waitForTimeout(150);
    entries = await trigger
      .locator("div a[href]")
      .evaluateAll((els) =>
        els.map((a) => {
          const firstSpan = a.querySelector("span");
          const lh = firstSpan
            ? parseFloat(getComputedStyle(firstSpan).lineHeight)
            : NaN;
          return {
            label: (firstSpan?.textContent ?? a.textContent ?? "").trim(),
            serifSpans: a.querySelectorAll("span.font-serif").length,
            childElements: a.children.length,
            linkHeight: a.getBoundingClientRect().height,
            labelLineHeight: Number.isFinite(lh) ? lh : 16,
          };
        }),
      )
      .catch(() => []);
  }
  return entries;
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 },
  });
  // The home page renders its own nav OUTSIDE the shared Layout chrome, so
  // the dropdowns under test (layout.tsx renderDesktopGroup) only exist on
  // interior pages — use /browse.
  await page.goto(`${BASE_URL}/browse`, { waitUntil: "networkidle" });
  await page.waitForSelector("header nav", { timeout: 15000 });

  // ——— Positive control: inject a synthetic note span, probe must see it ———
  console.log("Runtime: positive control (injected font-serif note span)");
  const control0 = await openAndInspect(page, GROUPS[0]!.label, GROUPS[0]!.minEntries);
  check(
    `"${GROUPS[0]!.label}" dropdown opened for the positive control`,
    control0.length >= GROUPS[0]!.minEntries,
    `rendered ${control0.length}`,
  );
  await groupTrigger(page, GROUPS[0]!.label)
    .locator("div a[href]")
    .first()
    .evaluate((a) => {
      const span = document.createElement("span");
      span.className = "block font-serif text-sm";
      span.textContent = "synthetic note line";
      span.setAttribute("data-e2e-synthetic-note", "1");
      a.appendChild(span);
    });
  const controlInjected = await openAndInspect(
    page,
    GROUPS[0]!.label,
    GROUPS[0]!.minEntries,
  );
  check(
    "positive control: the probe detects the injected note span",
    controlInjected.some((e) => e.serifSpans > 0),
    `entries with note spans: ${controlInjected.filter((e) => e.serifSpans > 0).length}`,
  );
  await page.evaluate(() => {
    document.querySelector("[data-e2e-synthetic-note]")?.remove();
  });

  // ——— Under test: EVERY dropdown entry renders a single line ———
  for (const group of GROUPS) {
    console.log(`Runtime: hovering "${group.label}"`);
    const entries = await openAndInspect(page, group.label, group.minEntries);
    check(
      `"${group.label}" dropdown opened with at least ${group.minEntries} entries`,
      entries.length >= group.minEntries,
      `rendered ${entries.length}: ${entries.map((e) => e.label).join(", ") || "(none)"}`,
    );
    for (const entry of entries) {
      check(
        `"${group.label}" / "${entry.label}" has no font-serif note span`,
        entry.serifSpans === 0,
        `found ${entry.serifSpans}`,
      );
      check(
        `"${group.label}" / "${entry.label}" renders exactly one child element (label only)`,
        entry.childElements === 1,
        `found ${entry.childElements}`,
      );
      // Belt-and-braces: a second line minted WITHOUT font-serif or an extra
      // element (e.g. a <br> or text node) would still grow the link's height.
      check(
        `"${group.label}" / "${entry.label}" renders single-line tall`,
        entry.linkHeight > 0 && entry.linkHeight < entry.labelLineHeight * 2 + 20,
        `link height ${entry.linkHeight}px vs line-height ${entry.labelLineHeight}px`,
      );
    }
  }

  await page.close();
} finally {
  await browser.close();
}

if (failures > 0) {
  console.error(`\ne2e-genre-menu-lines: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\ne2e-genre-menu-lines: all checks passed");
