/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check of the claims panel's Greek source text toggle
// (claims-panel.tsx): the panel auto-shows the verbatim Greek excerpts when
// a philosopher has few of them (GREEK_AUTO_HIDE = 7 or fewer) and hides
// them behind a "Show Greek source text (N)" toggle when there are many.
// A refactor of claims-panel.tsx or a change to the claims API shape could
// break the default, the count label, or the toggle itself while the
// source-level validators stay green. This script drives headless Chromium
// against the running dev servers:
//
// 1. On the first section of Plato's Life (a many-excerpt philosopher,
//    grc count > 7), opening the collapsible "From the text" panel must
//    show NO Greek source text blocks by default, and the toggle must read
//    "Show Greek source text (N)" with N equal to the API's count of
//    claims carrying a grc excerpt.
// 2. Clicking the toggle must reveal the Greek blocks (at least one
//    span[lang="grc"] source block inside the panel) and flip the label to
//    "Hide Greek source text" with aria-pressed="true".
// 3. Clicking it again must hide the blocks and restore the counted
//    "Show" label with aria-pressed="false".
// 4. On the first section of a few-excerpt philosopher (picked dynamically
//    from the API as the one with the fewest grc claims, still > 0), the
//    panel must default to SHOWN: the Greek blocks are visible on open,
//    the label reads "Hide Greek source text", and toggling hides them
//    and shows the counted label.
// 5-6. Two visible panels stay in step, and the change propagates to a
//    second tab via the storage event.
// 7. The stored preference survives navigation: after flipping Plato's
//    panel to shown, a client-side route change (Plato -> Graph -> a
//    second many-excerpt philosopher's section, verified SPA-only via a
//    window marker) must open that default-hidden panel already shown,
//    and a full page reload must come back with the preference applied.
// 8. A panel that mounts LATER on the same page honours a preference
//    changed earlier by another panel: flip the toggle in the section's
//    "From the text" panel, only then click the tagged Plato entity and
//    expand the entity panel's claims panel for the first time; its
//    toggle must come up already shown. A refactor reading the pref only
//    at store-init time would pass 1-7 but fail this.
// 9. The mirror direction of 8: open the entity panel FIRST, flip its
//    toggle, and only then expand the section's own "From the text"
//    panel for the first time; the section panel must open already
//    shown. A subscription bug that only registers listeners in the
//    entity-panel variant would pass 1-8 but fail this.
//
// The philosopher section ids and expected counts are read live from the
// API (/api/philosophers and /api/claims/{name}) so the check follows the
// data instead of hard-coding section ids; only the two behavioural
// regimes (many vs few) and Plato as the many-excerpt anchor are pinned.
//
// Requirements: the API server and web workflows must be running (the
// script talks to the shared proxy, default http://localhost:80), and a
// Chromium headless shell must be installed for playwright-core, e.g.:
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
//     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell

// playwright-core resolves its browser registry at module import time from
// PLAYWRIGHT_BROWSERS_PATH (default: $XDG_CACHE_HOME/ms-playwright, which in
// this environment points inside the workspace and holds no browsers). Set
// the env var BEFORE importing playwright-core, picking whichever candidate
// actually contains a chromium install.
import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

// Must match GREEK_AUTO_HIDE in claims-panel.tsx: at most this many Greek
// excerpts and the panel shows them by default.
const GREEK_AUTO_HIDE = 7;

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

type PanelState = {
  toggleLabel: string | null;
  ariaPressed: string | null;
  greekBlocks: number;
};

async function main() {
  // Pick the two subjects from the live API so the check follows the data.
  const philosophers = (await (
    await fetch(`${BASE_URL}/api/philosophers`)
  ).json()) as { name: string; firstId: string }[];

  const grcCount = async (name: string) => {
    const res = await fetch(
      `${BASE_URL}/api/claims/${encodeURIComponent(name)}`,
    );
    if (!res.ok) return 0;
    const body = (await res.json()) as { claims: { grc?: string }[] };
    return body.claims.filter((c) => c.grc).length;
  };

  const plato = philosophers.find((p) => p.name === "Plato");
  if (!plato) throw new Error("Plato not found in /api/philosophers");
  const platoGrc = await grcCount("Plato");
  check(
    `Plato is a many-excerpt philosopher (grc count ${platoGrc} > ${GREEK_AUTO_HIDE})`,
    platoGrc > GREEK_AUTO_HIDE,
  );

  let small: { name: string; firstId: string; grc: number } | null = null;
  // A second many-excerpt philosopher (default hidden, like Plato) for the
  // cross-navigation scenario: only on a default-hidden page does a stored
  // "shown" preference produce a state distinguishable from the default.
  let big2: { name: string; firstId: string; grc: number } | null = null;
  for (const p of philosophers) {
    const n = await grcCount(p.name);
    if (n > 0 && n <= GREEK_AUTO_HIDE && (!small || n < small.grc)) {
      small = { name: p.name, firstId: p.firstId, grc: n };
    }
    if (p.name !== "Plato" && n > GREEK_AUTO_HIDE && (!big2 || n > big2.grc)) {
      big2 = { name: p.name, firstId: p.firstId, grc: n };
    }
  }
  check(
    "found a few-excerpt philosopher for the default-shown regime",
    !!small,
  );
  if (!small) throw new Error("no philosopher with 1..7 Greek excerpts");
  check(
    "found a second many-excerpt philosopher for the navigation scenario",
    !!big2,
  );
  if (!big2)
    throw new Error("no second philosopher with > 7 Greek excerpts");
  console.log(
    `  using ${big2.name} (${big2.grc} excerpts, section ${big2.firstId}) for the navigation check`,
  );
  console.log(
    `  using ${small.name} (${small.grc} excerpts, section ${small.firstId}) for the default-shown check`,
  );

  const browser = await chromium.launch({ headless: true });
  try {
    // An explicit context so scenario 6 can open a second same-context
    // page (a real second tab sharing localStorage; storage events only
    // fire between same-origin pages of the same context).
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();
    // Fail fast with the failing URL/status instead of an opaque selector
    // timeout when the site itself fails to boot.
    const guard = attachPageGuard(page);

    // Open a section page and expand the collapsible "From the text"
    // panel, then return a snapshot of the toggle + Greek block state.
    // No helper functions inside evaluate: tsx's esbuild transform wraps
    // named locals with a __name helper that doesn't exist in the page.
    const readPanelState = () =>
      page.evaluate((): PanelState => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const toggle = buttons.find(
          (b) =>
            b.textContent?.startsWith("Show Greek source text") ||
            b.textContent === "Hide Greek source text",
        );
        // Scope the Greek block count to the claims panel: the toggle's
        // enclosing card, so the passage's own Greek text never counts.
        const panel = toggle?.closest("div.bg-card") ?? null;
        return {
          toggleLabel: toggle?.textContent ?? null,
          ariaPressed: toggle?.getAttribute("aria-pressed") ?? null,
          // Count only toggled SOURCE-TEXT blocks (block-level spans):
          // inline Greek name glosses next to claim values are always
          // visible by design and must not count against the toggle.
          greekBlocks: panel
            ? panel.querySelectorAll('span[lang="grc"][class*="block"]')
                .length
            : 0,
        };
      });

    const openPanel = async (sectionId: string) => {
      await page.goto(`${BASE_URL}/section/${sectionId}`, {
        waitUntil: "networkidle",
      });
      guard.assertPageLoaded();
      // The collapsible header button's textContent concatenates the card
      // title and the count: "From the textShow N facts".
      await guard.guarded(
        page.waitForFunction(
          () =>
            Array.from(document.querySelectorAll("button")).some((b) =>
              /Show \d+ facts/.test(b.textContent ?? ""),
            ),
          undefined,
          { timeout: 15000 },
        ),
      );
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find(
          (b) => /Show \d+ facts/.test(b.textContent ?? ""),
        );
        if (!btn) throw new Error("claims panel header button not found");
        btn.click();
      });
      // Wait for the Greek toggle to be in the DOM.
      await page.waitForFunction(
        () =>
          Array.from(document.querySelectorAll("button")).some(
            (b) =>
              b.textContent?.startsWith("Show Greek source text") ||
              b.textContent === "Hide Greek source text",
          ),
        undefined,
        { timeout: 15000 },
      );
    };

    const clickToggle = async () => {
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find(
          (b) =>
            b.textContent?.startsWith("Show Greek source text") ||
            b.textContent === "Hide Greek source text",
        );
        if (!btn) throw new Error("Greek toggle not found");
        btn.click();
      });
      await page.waitForTimeout(200);
    };

    console.log(
      `Scenario 1: Plato section (${plato.firstId}) defaults to hidden with a counted label`,
    );
    await openPanel(plato.firstId);
    let state = await readPanelState();
    check(
      "Greek blocks are hidden by default",
      state.greekBlocks === 0,
      `blocks=${state.greekBlocks}`,
    );
    check(
      `label reads "Show Greek source text (${platoGrc})"`,
      state.toggleLabel === `Show Greek source text (${platoGrc})`,
      `label=${JSON.stringify(state.toggleLabel)}`,
    );
    check(
      "toggle reports aria-pressed=false",
      state.ariaPressed === "false",
      `aria-pressed=${state.ariaPressed}`,
    );

    console.log("Scenario 2: clicking the toggle reveals the Greek blocks");
    await clickToggle();
    state = await readPanelState();
    check(
      "Greek blocks appear after the click",
      state.greekBlocks > 0,
      `blocks=${state.greekBlocks}`,
    );
    check(
      'label flips to "Hide Greek source text"',
      state.toggleLabel === "Hide Greek source text",
      `label=${JSON.stringify(state.toggleLabel)}`,
    );
    check(
      "toggle reports aria-pressed=true",
      state.ariaPressed === "true",
      `aria-pressed=${state.ariaPressed}`,
    );

    console.log("Scenario 3: clicking again re-hides the Greek blocks");
    await clickToggle();
    state = await readPanelState();
    check(
      "Greek blocks are hidden again",
      state.greekBlocks === 0,
      `blocks=${state.greekBlocks}`,
    );
    check(
      "counted Show label is restored",
      state.toggleLabel === `Show Greek source text (${platoGrc})`,
      `label=${JSON.stringify(state.toggleLabel)}`,
    );
    check(
      "toggle reports aria-pressed=false again",
      state.ariaPressed === "false",
      `aria-pressed=${state.ariaPressed}`,
    );

    console.log(
      `Scenario 4: ${small.name} section (${small.firstId}) defaults to shown, toggle hides`,
    );
    // The toggle persists the preference in localStorage; scenarios 2-3
    // left it at "hidden", which would defeat the first-visit default
    // this scenario pins. Clear it to simulate a fresh visitor.
    await page.evaluate(() =>
      window.localStorage.removeItem("laertius:show-greek-source"),
    );
    await openPanel(small.firstId);
    state = await readPanelState();
    check(
      "Greek blocks are visible by default",
      state.greekBlocks > 0,
      `blocks=${state.greekBlocks}`,
    );
    check(
      `all ${small.grc} excerpts are rendered`,
      state.greekBlocks === small.grc,
      `blocks=${state.greekBlocks}`,
    );
    check(
      'label reads "Hide Greek source text"',
      state.toggleLabel === "Hide Greek source text",
      `label=${JSON.stringify(state.toggleLabel)}`,
    );
    check(
      "toggle reports aria-pressed=true",
      state.ariaPressed === "true",
      `aria-pressed=${state.ariaPressed}`,
    );

    await clickToggle();
    state = await readPanelState();
    check(
      "toggle hides the default-shown blocks",
      state.greekBlocks === 0,
      `blocks=${state.greekBlocks}`,
    );
    check(
      `label flips to "Show Greek source text (${small.grc})"`,
      state.toggleLabel === `Show Greek source text (${small.grc})`,
      `label=${JSON.stringify(state.toggleLabel)}`,
    );

    await clickToggle();
    state = await readPanelState();
    check(
      "toggling back re-shows the blocks",
      state.greekBlocks === small.grc,
      `blocks=${state.greekBlocks}`,
    );

    console.log(
      `Scenario 5: two visible panels stay in step (section ${plato.firstId} + entity panel)`,
    );
    // Reset the pref so the Plato panels start at the hidden default,
    // then open the section panel and the entity panel side by side:
    // clicking the tagged "Plato" in the passage opens the entity panel,
    // whose own collapsible "From the text" carries a second toggle.
    await page.evaluate(() =>
      window.localStorage.removeItem("laertius:show-greek-source"),
    );
    await openPanel(plato.firstId);
    await page.evaluate(() => {
      const mark = Array.from(
        document.querySelectorAll<HTMLButtonElement>("button"),
      ).find((b) => b.textContent === "Plato" && b.closest("article, .bg-card"));
      if (!mark) throw new Error("tagged Plato entity button not found");
      mark.click();
    });
    // Expand the entity panel's collapsible claims panel (the second
    // "Show N facts" header on the page).
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("button")).filter((b) =>
          /Show \d+ facts/.test(b.textContent ?? ""),
        ).length >= 1,
      undefined,
      { timeout: 15000 },
    );
    await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll("button")).filter(
        (b) => /Show \d+ facts/.test(b.textContent ?? ""),
      );
      const last = headers[headers.length - 1];
      if (!last) throw new Error("entity panel claims header not found");
      last.click();
    });
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("button")).filter(
          (b) =>
            b.textContent?.startsWith("Show Greek source text") ||
            b.textContent === "Hide Greek source text",
        ).length >= 2,
      undefined,
      { timeout: 15000 },
    );
    const readAllToggles = () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll("button"))
          .filter(
            (b) =>
              b.textContent?.startsWith("Show Greek source text") ||
              b.textContent === "Hide Greek source text",
          )
          .map((b) => ({
            label: b.textContent ?? "",
            pressed: b.getAttribute("aria-pressed"),
          })),
      );
    let toggles = await readAllToggles();
    check(
      "two Greek toggles are visible at once",
      toggles.length === 2,
      `toggles=${toggles.length}`,
    );
    check(
      "both panels start hidden",
      toggles.every((t) => t.pressed === "false"),
      JSON.stringify(toggles),
    );
    // Flip the FIRST panel's toggle; the second must follow immediately.
    await page.evaluate(() => {
      const first = Array.from(document.querySelectorAll("button")).find(
        (b) =>
          b.textContent?.startsWith("Show Greek source text") ||
          b.textContent === "Hide Greek source text",
      );
      if (!first) throw new Error("first Greek toggle not found");
      first.click();
    });
    await page.waitForTimeout(200);
    toggles = await readAllToggles();
    check(
      "flipping one panel updates BOTH panels to shown",
      toggles.length === 2 && toggles.every((t) => t.pressed === "true"),
      JSON.stringify(toggles),
    );
    // Flip the SECOND panel's toggle back; the first must follow.
    await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll("button")).filter(
        (b) =>
          b.textContent?.startsWith("Show Greek source text") ||
          b.textContent === "Hide Greek source text",
      );
      const second = all[1];
      if (!second) throw new Error("second Greek toggle not found");
      second.click();
    });
    await page.waitForTimeout(200);
    toggles = await readAllToggles();
    check(
      "flipping the other panel updates BOTH panels back to hidden",
      toggles.length === 2 && toggles.every((t) => t.pressed === "false"),
      JSON.stringify(toggles),
    );

    console.log(
      "Scenario 6: the change propagates to a second tab via the storage event",
    );
    const page2 = await context.newPage();
    const guard2 = attachPageGuard(page2);
    try {
      await page2.goto(`${BASE_URL}/section/${plato.firstId}`, {
        waitUntil: "networkidle",
      });
      guard2.assertPageLoaded();
      await guard2.guarded(
        page2.waitForFunction(
          () =>
            Array.from(document.querySelectorAll("button")).some((b) =>
              /Show \d+ facts/.test(b.textContent ?? ""),
            ),
          undefined,
          { timeout: 15000 },
        ),
      );
      await page2.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find((b) =>
          /Show \d+ facts/.test(b.textContent ?? ""),
        );
        if (!btn) throw new Error("claims panel header button not found");
        btn.click();
      });
      await page2.waitForFunction(
        () =>
          Array.from(document.querySelectorAll("button")).some(
            (b) =>
              b.textContent?.startsWith("Show Greek source text") ||
              b.textContent === "Hide Greek source text",
          ),
        undefined,
        { timeout: 15000 },
      );
      // Toggle in the FIRST tab; the second tab's panel must follow via
      // the storage event without any reload.
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find(
          (b) =>
            b.textContent?.startsWith("Show Greek source text") ||
            b.textContent === "Hide Greek source text",
        );
        if (!btn) throw new Error("Greek toggle not found");
        btn.click();
      });
      const crossTabOk = await page2
        .waitForFunction(
          () =>
            Array.from(document.querySelectorAll("button")).some(
              (b) =>
                b.textContent === "Hide Greek source text" &&
                b.getAttribute("aria-pressed") === "true",
            ),
          undefined,
          { timeout: 5000 },
        )
        .then(
          () => true,
          () => false,
        );
      check(
        "second tab's panel flips to shown without a reload",
        crossTabOk,
        "",
      );
    } finally {
      await page2.close();
    }

    console.log(
      `Scenario 7: the preference survives client-side navigation (Plato -> Graph -> ${big2!.name}) and a full reload`,
    );
    // Fresh start: clear the pref, open Plato's default-hidden panel and
    // flip it to shown so localStorage holds "1".
    await page.evaluate(() =>
      window.localStorage.removeItem("laertius:show-greek-source"),
    );
    await openPanel(plato.firstId);
    await clickToggle();
    state = await readPanelState();
    check(
      "preference set to shown on the first section",
      state.ariaPressed === "true" && state.greekBlocks > 0,
      JSON.stringify(state),
    );
    // Plant a marker that only survives if navigation stays client-side
    // (a full page load would wipe it and defeat the SPA-nav assertion).
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__laertiusE2eMarker = 1;
    });
    // Click the header nav "Graph" link (a real wouter Link, so this is a
    // client-side route change).
    await page.evaluate(() => {
      const link = Array.from(
        document.querySelectorAll<HTMLAnchorElement>("a"),
      ).find(
        (a) =>
          a.getAttribute("href") === "/graph" && a.textContent === "Graph",
      );
      if (!link) throw new Error("Graph nav link not found");
      link.click();
    });
    await page.waitForFunction(() => location.pathname === "/graph", undefined, {
      timeout: 15000,
    });
    // Navigate on to the second many-excerpt philosopher's section, still
    // client-side: wouter patches history.pushState, so calling it routes
    // within the SPA without a document load.
    await page.evaluate((sectionId: string) => {
      history.pushState(null, "", `/section/${sectionId}`);
    }, big2!.firstId);
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("button")).some((b) =>
          /Show \d+ facts/.test(b.textContent ?? ""),
        ),
      undefined,
      { timeout: 15000 },
    );
    const markerAlive = await page.evaluate(
      () =>
        (window as unknown as Record<string, unknown>).__laertiusE2eMarker ===
        1,
    );
    check(
      "navigation stayed client-side (window marker survived)",
      markerAlive,
    );
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        /Show \d+ facts/.test(b.textContent ?? ""),
      );
      if (!btn) throw new Error("claims panel header button not found");
      btn.click();
    });
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("button")).some(
          (b) =>
            b.textContent?.startsWith("Show Greek source text") ||
            b.textContent === "Hide Greek source text",
        ),
      undefined,
      { timeout: 15000 },
    );
    state = await readPanelState();
    check(
      `${big2!.name}'s default-hidden panel honours the stored shown preference after SPA navigation`,
      state.ariaPressed === "true" &&
        state.toggleLabel === "Hide Greek source text" &&
        state.greekBlocks > 0,
      JSON.stringify(state),
    );
    // A full page reload must come back with the stored preference too.
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("button")).some((b) =>
          /Show \d+ facts/.test(b.textContent ?? ""),
        ),
      undefined,
      { timeout: 15000 },
    );
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        /Show \d+ facts/.test(b.textContent ?? ""),
      );
      if (!btn) throw new Error("claims panel header button not found");
      btn.click();
    });
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("button")).some(
          (b) =>
            b.textContent?.startsWith("Show Greek source text") ||
            b.textContent === "Hide Greek source text",
        ),
      undefined,
      { timeout: 15000 },
    );
    state = await readPanelState();
    check(
      "the preference survives a full page reload",
      state.ariaPressed === "true" &&
        state.toggleLabel === "Hide Greek source text" &&
        state.greekBlocks > 0,
      JSON.stringify(state),
    );

    console.log(
      "Scenario 8: a panel that mounts LATER on the same page honours a preference changed earlier by another panel",
    );
    // The panels-in-step scenario (5) opens both panels BEFORE flipping,
    // and the navigation scenario (7) remounts the whole page. Neither
    // pins a panel whose toggle state is first read on a mount that
    // happens AFTER the preference changed on the same page: a refactor
    // that reads localStorage only at store-init time (module scope)
    // would pass 5 and 7 but serve this late-mounting panel a stale
    // default. Flip the section panel's toggle first, and only then open
    // the entity panel's claims panel for the first time.
    await page.evaluate(() =>
      window.localStorage.removeItem("laertius:show-greek-source"),
    );
    await openPanel(plato.firstId);
    state = await readPanelState();
    check(
      "section panel starts at the hidden default",
      state.ariaPressed === "false" && state.greekBlocks === 0,
      JSON.stringify(state),
    );
    // Flip the preference in the section's own panel while the entity
    // panel does not exist yet.
    await clickToggle();
    state = await readPanelState();
    check(
      "section panel flips to shown before the entity panel exists",
      state.ariaPressed === "true" && state.greekBlocks > 0,
      JSON.stringify(state),
    );
    const togglesBefore = await readAllToggles();
    check(
      "only one Greek toggle exists before the entity panel opens",
      togglesBefore.length === 1,
      `toggles=${togglesBefore.length}`,
    );
    // NOW open the entity panel by clicking the tagged Plato in the
    // passage, then expand its collapsible claims panel for the first
    // time. Its toggle must come up already honouring the stored "shown"
    // preference on first expand.
    await page.evaluate(() => {
      const mark = Array.from(
        document.querySelectorAll<HTMLButtonElement>("button"),
      ).find((b) => b.textContent === "Plato" && b.closest("article, .bg-card"));
      if (!mark) throw new Error("tagged Plato entity button not found");
      mark.click();
    });
    // The section's own panel is already expanded (its header reads
    // "Hide N facts"), so the only collapsed "Show N facts" header is
    // the entity panel's.
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("button")).filter((b) =>
          /Show \d+ facts/.test(b.textContent ?? ""),
        ).length >= 1,
      undefined,
      { timeout: 15000 },
    );
    await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll("button")).filter(
        (b) => /Show \d+ facts/.test(b.textContent ?? ""),
      );
      const last = headers[headers.length - 1];
      if (!last) throw new Error("entity panel claims header not found");
      last.click();
    });
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("button")).filter(
          (b) =>
            b.textContent?.startsWith("Show Greek source text") ||
            b.textContent === "Hide Greek source text",
        ).length >= 2,
      undefined,
      { timeout: 15000 },
    );
    const lateToggles = await readAllToggles();
    check(
      "two Greek toggles are visible after the late mount",
      lateToggles.length === 2,
      `toggles=${lateToggles.length}`,
    );
    const lateToggle = lateToggles[lateToggles.length - 1];
    check(
      "the late-mounted entity panel opens already SHOWN (stored preference, not the default)",
      lateToggle?.pressed === "true" &&
        lateToggle?.label === "Hide Greek source text",
      JSON.stringify(lateToggles),
    );
    // And its Greek blocks must actually be rendered, not just the label.
    const lateBlocks = await page.evaluate(() => {
      const toggles = Array.from(document.querySelectorAll("button")).filter(
        (b) =>
          b.textContent?.startsWith("Show Greek source text") ||
          b.textContent === "Hide Greek source text",
      );
      const last = toggles[toggles.length - 1];
      const panel = last?.closest("div.bg-card") ?? null;
      return panel ? panel.querySelectorAll('span[lang="grc"]').length : 0;
    });
    check(
      "the late-mounted panel renders its Greek blocks on first expand",
      lateBlocks > 0,
      `blocks=${lateBlocks}`,
    );

    console.log(
      "Scenario 9: the section panel mounting AFTER the entity panel changed the preference also honours it",
    );
    // The mirror of scenario 8: a subscription bug that only registers
    // listeners in the entity-panel variant of the claims panel would
    // pass 1-8. Here the ENTITY panel is opened and flipped first, and
    // only then is the section's own "From the text" panel expanded for
    // the first time; it must come up already shown.
    await page.evaluate(() =>
      window.localStorage.removeItem("laertius:show-greek-source"),
    );
    // Fresh load of the section page WITHOUT expanding the section panel.
    await page.goto(`${BASE_URL}/section/${plato.firstId}`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        () =>
          Array.from(document.querySelectorAll("button")).some((b) =>
            /Show \d+ facts/.test(b.textContent ?? ""),
          ),
        undefined,
        { timeout: 15000 },
      ),
    );
    // Open the entity panel by clicking the tagged Plato in the passage.
    await page.evaluate(() => {
      const mark = Array.from(
        document.querySelectorAll<HTMLButtonElement>("button"),
      ).find((b) => b.textContent === "Plato" && b.closest("article, .bg-card"));
      if (!mark) throw new Error("tagged Plato entity button not found");
      mark.click();
    });
    // Both claims panels are collapsed now; the entity panel's header is
    // the LAST "Show N facts" button (same DOM ordering scenarios 5 and 8
    // rely on).
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("button")).filter((b) =>
          /Show \d+ facts/.test(b.textContent ?? ""),
        ).length >= 2,
      undefined,
      { timeout: 15000 },
    );
    await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll("button")).filter(
        (b) => /Show \d+ facts/.test(b.textContent ?? ""),
      );
      const last = headers[headers.length - 1];
      if (!last) throw new Error("entity panel claims header not found");
      last.click();
    });
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("button")).filter(
          (b) =>
            b.textContent?.startsWith("Show Greek source text") ||
            b.textContent === "Hide Greek source text",
        ).length >= 1,
      undefined,
      { timeout: 15000 },
    );
    let entityFirstToggles = await readAllToggles();
    check(
      "only the entity panel's Greek toggle exists before the section panel opens",
      entityFirstToggles.length === 1,
      `toggles=${entityFirstToggles.length}`,
    );
    check(
      "the entity panel starts at the hidden default",
      entityFirstToggles[0]?.pressed === "false",
      JSON.stringify(entityFirstToggles),
    );
    // Flip the preference in the ENTITY panel while the section panel's
    // claims panel does not exist yet.
    await clickToggle();
    entityFirstToggles = await readAllToggles();
    check(
      "the entity panel flips to shown before the section panel exists",
      entityFirstToggles.length === 1 &&
        entityFirstToggles[0]?.pressed === "true",
      JSON.stringify(entityFirstToggles),
    );
    // NOW expand the section's own "From the text" panel for the first
    // time: the only remaining collapsed "Show N facts" header.
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        /Show \d+ facts/.test(b.textContent ?? ""),
      );
      if (!btn) throw new Error("section claims panel header not found");
      btn.click();
    });
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("button")).filter(
          (b) =>
            b.textContent?.startsWith("Show Greek source text") ||
            b.textContent === "Hide Greek source text",
        ).length >= 2,
      undefined,
      { timeout: 15000 },
    );
    const mirrorToggles = await readAllToggles();
    check(
      "two Greek toggles are visible after the section panel's late mount",
      mirrorToggles.length === 2,
      `toggles=${mirrorToggles.length}`,
    );
    // The section panel's toggle comes FIRST in the DOM (the entity
    // panel's is last, as scenarios 5 and 8 established).
    const sectionToggle = mirrorToggles[0];
    check(
      "the late-mounted section panel opens already SHOWN (stored preference, not the default)",
      sectionToggle?.pressed === "true" &&
        sectionToggle?.label === "Hide Greek source text",
      JSON.stringify(mirrorToggles),
    );
    // And its Greek blocks must actually be rendered, not just the label.
    const sectionBlocks = await page.evaluate(() => {
      const toggles = Array.from(document.querySelectorAll("button")).filter(
        (b) =>
          b.textContent?.startsWith("Show Greek source text") ||
          b.textContent === "Hide Greek source text",
      );
      const first = toggles[0];
      const panel = first?.closest("div.bg-card") ?? null;
      return panel ? panel.querySelectorAll('span[lang="grc"]').length : 0;
    });
    check(
      "the late-mounted section panel renders its Greek blocks on first expand",
      sectionBlocks > 0,
      `blocks=${sectionBlocks}`,
    );
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\ne2e-greek-toggle: ${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\ne2e-greek-toggle: all checks passed");
}

await main();
