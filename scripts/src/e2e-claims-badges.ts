/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check that the certainty badges actually render on a Life
// page: validate-claims-grc unit-tests the badge selectors
// (claims-badges.ts) and pins the claims-panel wiring, but a CSS or data
// regression (e.g. the API dropping the certainty field, or a class
// change hiding the pill) could pass all source pins while readers see no
// "some say" or "disputed" badges. This script drives headless Chromium
// against the running dev servers:
//
// 1. Pick, from the live API (/api/philosophers + /api/claims/{name}), a
//    philosopher whose claims include a reported claim, a disputed claim,
//    and an asserted claim (each without a transmission status, so the
//    certainty badge is the only pill expected on the line).
// 2. Open the first section of that philosopher's Life, expand the
//    collapsible "From the text" panel, and locate each chosen claim line
//    by its exact value text (clicking "Show all N entries" if the line
//    is hidden behind the Works preview).
// 3. Assert the reported line shows a visible "some say" pill and the
//    disputed line a visible "disputed" pill (visible = non-zero client
//    rect, so a display:none/CSS regression fails too).
// 4. Assert the asserted line shows NO badge pill at all.
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

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

type ApiClaim = {
  value: string;
  certainty: string;
  transmission?: string;
};

// Expected pill labels, mirroring claims-badges.ts. Kept inline so the e2e
// check is an independent witness: if the component's labels drift, this
// script fails instead of silently following the drift.
const CERTAINTY_LABEL: Record<string, string | undefined> = {
  reported: "some say",
  disputed: "disputed",
  conjectured: "conjectured",
};
const TRANSMISSION_LABEL: Record<string, string | undefined> = {
  spurious: "spurious",
  "disputed-authorship": "disputed authorship",
  extant: "extant",
  lost: "lost",
};

type TransmissionPick = {
  name: string;
  firstId: string;
  value: string;
  certainty: string;
  transmission: string;
};

// In-page snapshot of one claim line, located by its exact value text.
type LineState = {
  found: boolean;
  pills: string[];
  visiblePills: string[];
};

async function main() {
  // Pick the subject from the live API so the check follows the data:
  // a philosopher carrying all three certainty regimes at once, each on
  // a claim without a transmission status (whose pill would otherwise be
  // a legitimate second badge on the line).
  const philosophers = (await (
    await fetch(`${BASE_URL}/api/philosophers`)
  ).json()) as { name: string; firstId: string }[];

  let subject: {
    name: string;
    firstId: string;
    reported: string;
    disputed: string;
    asserted: string;
  } | null = null;
  // One pick per transmission status found in the live data, plus (if any
  // exists) a claim whose certainty and transmission pills would carry the
  // SAME label — the duplicate-suppression case (one pill, not two).
  const transmissionPicks = new Map<string, TransmissionPick>();
  let dupPick: TransmissionPick | null = null;
  let transmissionClaimCount = 0;
  for (const p of philosophers) {
    const res = await fetch(
      `${BASE_URL}/api/claims/${encodeURIComponent(p.name)}`,
    );
    if (!res.ok) continue;
    const body = (await res.json()) as { claims: ApiClaim[] };
    for (const c of body.claims) {
      if (!c.transmission) continue;
      transmissionClaimCount++;
      const pick: TransmissionPick = {
        name: p.name,
        firstId: p.firstId,
        value: c.value,
        certainty: c.certainty,
        transmission: c.transmission,
      };
      if (!transmissionPicks.has(c.transmission)) {
        transmissionPicks.set(c.transmission, pick);
      }
      const cLabel = CERTAINTY_LABEL[c.certainty];
      const tLabel = TRANSMISSION_LABEL[c.transmission];
      if (!dupPick && cLabel && tLabel && cLabel === tLabel) {
        dupPick = pick;
      }
    }
    if (subject) continue;
    const clean = body.claims.filter((c) => !c.transmission);
    const reported = clean.find((c) => c.certainty === "reported");
    const disputed = clean.find((c) => c.certainty === "disputed");
    const asserted = clean.find((c) => c.certainty === "asserted");
    if (reported && disputed && asserted) {
      subject = {
        name: p.name,
        firstId: p.firstId,
        reported: reported.value,
        disputed: disputed.value,
        asserted: asserted.value,
      };
    }
  }
  // Positive control: an empty scan would make every transmission scenario
  // vacuously green, so fail loudly if the API carries none at all.
  check(
    "claims API carries work claims with a transmission status",
    transmissionClaimCount > 0,
    `statuses found: ${JSON.stringify([...transmissionPicks.keys()])}`,
  );
  console.log(
    `  transmission claims in API: ${transmissionClaimCount} ` +
      `(statuses: ${[...transmissionPicks.keys()].join(", ") || "none"})`,
  );
  check(
    "found a philosopher with reported + disputed + asserted claims (no transmission)",
    !!subject,
  );
  if (!subject) throw new Error("no suitable philosopher in the claims API");
  console.log(
    `  using ${subject.name} (section ${subject.firstId}):\n` +
      `    reported: ${JSON.stringify(subject.reported)}\n` +
      `    disputed: ${JSON.stringify(subject.disputed)}\n` +
      `    asserted: ${JSON.stringify(subject.asserted)}`,
  );

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    const guard = attachPageGuard(page);

    // Open a Life section and fully expand the claims panel (including the
    // Works preview, so every claim line is in the DOM).
    const openLife = async (sectionId: string) => {
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
        const btn = Array.from(document.querySelectorAll("button")).find((b) =>
          /Show \d+ facts/.test(b.textContent ?? ""),
        );
        if (!btn) throw new Error("claims panel header button not found");
        btn.click();
      });
      // Wait for the panel body: claim lines carry a (D.L. x.y) citation.
      await page.waitForFunction(
        () => /\(D\.L\. \d/.test(document.body.textContent ?? ""),
        undefined,
        { timeout: 15000 },
      );

      // If the Works preview hides some entries, expand it so every claim
      // line (including a works-group reported/disputed one) is in the DOM.
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find((b) =>
          /Show all \d+ entries/.test(b.textContent ?? ""),
        );
        if (btn) btn.click();
      });
      await page.waitForTimeout(200);
    };

    console.log(
      `Scenario 1: open ${subject.name}'s Life section and expand the claims panel`,
    );
    await openLife(subject.firstId);

    // Snapshot one claim line by its exact value text: the pills are the
    // rounded-full bordered spans inside the line's <li>, and a pill only
    // counts as visible with a non-zero client rect.
    // No helper functions inside evaluate: tsx's esbuild transform wraps
    // named locals with a __name helper that doesn't exist in the page.
    const readLine = (value: string) =>
      page.evaluate((v): LineState => {
        const spans = Array.from(
          document.querySelectorAll("li > span.text-foreground"),
        );
        const valueSpan = spans.find((s) => s.textContent === v);
        const li = valueSpan?.closest("li") ?? null;
        if (!li) return { found: false, pills: [], visiblePills: [] };
        const pills = Array.from(
          li.querySelectorAll('span[class*="rounded-full"]'),
        );
        return {
          found: true,
          pills: pills.map((p) => p.textContent ?? ""),
          visiblePills: pills
            .filter((p) => {
              const r = p.getBoundingClientRect();
              return r.width > 0 && r.height > 0;
            })
            .map((p) => p.textContent ?? ""),
        };
      }, value);

    console.log('Scenario 2: reported claim line shows a "some say" pill');
    const reportedLine = await readLine(subject.reported);
    check("reported claim line is rendered", reportedLine.found);
    check(
      'reported line carries a visible "some say" pill',
      reportedLine.visiblePills.includes("some say"),
      `pills=${JSON.stringify(reportedLine.pills)} visible=${JSON.stringify(reportedLine.visiblePills)}`,
    );

    console.log('Scenario 3: disputed claim line shows a "disputed" pill');
    const disputedLine = await readLine(subject.disputed);
    check("disputed claim line is rendered", disputedLine.found);
    check(
      'disputed line carries a visible "disputed" pill',
      disputedLine.visiblePills.includes("disputed"),
      `pills=${JSON.stringify(disputedLine.pills)} visible=${JSON.stringify(disputedLine.visiblePills)}`,
    );

    console.log("Scenario 4: asserted claim line shows NO badge pill");
    const assertedLine = await readLine(subject.asserted);
    check("asserted claim line is rendered", assertedLine.found);
    check(
      "asserted line has no badge pill at all",
      assertedLine.found && assertedLine.pills.length === 0,
      `pills=${JSON.stringify(assertedLine.pills)}`,
    );

    // Transmission badges: for each transmission status the live data
    // carries, open that work claim's Life page and assert its pill
    // renders visibly with the exact expected label. When the claim also
    // carries a badge-bearing certainty with a DIFFERENT label, both pills
    // must be visible (no over-suppression).
    let scenario = 5;
    for (const [status, pick] of transmissionPicks) {
      const expected = TRANSMISSION_LABEL[status];
      console.log(
        `Scenario ${scenario++}: "${status}" work claim shows a visible "${expected}" pill ` +
          `(${pick.name}: ${JSON.stringify(pick.value)})`,
      );
      if (!expected) {
        check(
          `transmission status "${status}" has a known expected label`,
          false,
          "claims-badges.ts and this script disagree on the status vocabulary",
        );
        continue;
      }
      await openLife(pick.firstId);
      const line = await readLine(pick.value);
      check(`${status} work claim line is rendered`, line.found);
      check(
        `${status} line carries a visible "${expected}" pill`,
        line.visiblePills.includes(expected),
        `pills=${JSON.stringify(line.pills)} visible=${JSON.stringify(line.visiblePills)}`,
      );
      const certaintyLabel = CERTAINTY_LABEL[pick.certainty];
      if (certaintyLabel && certaintyLabel !== expected) {
        check(
          `${status} line also keeps its visible "${certaintyLabel}" certainty pill`,
          line.visiblePills.includes(certaintyLabel),
          `pills=${JSON.stringify(line.pills)} visible=${JSON.stringify(line.visiblePills)}`,
        );
      }
    }

    // Duplicate-label suppression: a line whose certainty and transmission
    // badges would carry the SAME label must show ONE pill, not two.
    if (dupPick) {
      const label = TRANSMISSION_LABEL[dupPick.transmission]!;
      console.log(
        `Scenario ${scenario++}: duplicate-label line shows ONE "${label}" pill, not two ` +
          `(${dupPick.name}: ${JSON.stringify(dupPick.value)})`,
      );
      await openLife(dupPick.firstId);
      const line = await readLine(dupPick.value);
      check("duplicate-label claim line is rendered", line.found);
      check(
        `duplicate-label line shows exactly one visible "${label}" pill`,
        line.visiblePills.filter((p) => p === label).length === 1 &&
          line.visiblePills.length === 1,
        `pills=${JSON.stringify(line.pills)} visible=${JSON.stringify(line.visiblePills)}`,
      );
    } else {
      console.log(
        "Scenario (skipped): no claim in the data carries a certainty and " +
          "transmission status with the same badge label, so the " +
          "duplicate-suppression case has nothing to render.",
      );
    }
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll claims-badge e2e checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
