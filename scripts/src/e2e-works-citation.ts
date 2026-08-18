/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check that a Works entry's citation link actually lands on
// a rendered section page. The works-expander check (e2e-works-expander.ts)
// only counts entries behind the "Show all N entries" button; it never
// clicks one. A routing or link-building regression (CitationLink in
// claims-panel.tsx, wouter base handling, or the claims API dropping
// sectionId) could leave entries visible but their citations dead —
// especially for entries only reachable after expanding past the 8-entry
// preview. This script drives headless Chromium against the running dev
// servers:
//
// 1. Pick the philosopher with the most writings/wrote claims live from
//    the API, and choose the first works entry BEYOND the 8-entry preview
//    that carries a sectionId (replicating the panel's ordering:
//    "writings" claims first, then "wrote", each in API order).
// 2. Open the philosopher's first section page, expand the collapsible
//    "From the text" panel, click "Show all N entries", and verify the
//    chosen entry's citation link "(D.L. <ref>)" is rendered with an
//    href pointing at /section/<sectionId>.
// 3. Click that link and assert the browser lands on the target
//    /section/:id page with the passage text present: the URL path ends
//    with the section id, the page shows the section id heading, and a
//    verbatim snippet of the passage (from /api/sections/{id}) is
//    rendered.
//
// Every failure message names the works entry (its value) and the target
// section id.
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

// Must match WORKS_PREVIEW in claims-panel.tsx: the entry we click must sit
// beyond this preview size, i.e. only visible after "Show all N entries".
const WORKS_PREVIEW = 8;

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
  property: string;
  value: string;
  ref?: string;
  sectionId?: string;
  altTitle?: string;
  altTitleRef?: string;
  altTitleSectionId?: string;
};

async function main() {
  // Pick the subject live from the API: the philosopher with the most
  // writings/wrote claims, so the expanded tail is as deep as possible.
  const philosophers = (await (
    await fetch(`${BASE_URL}/api/philosophers`)
  ).json()) as { name: string; firstId: string }[];

  let subject: { name: string; firstId: string; works: ApiClaim[] } | null =
    null;
  // Alt-title target: the first works claim (across philosophers) whose
  // "also titled ..." line carries its own live citation link
  // (altTitle + altTitleRef + altTitleSectionId).
  let altSubject: {
    name: string;
    firstId: string;
    works: ApiClaim[];
    index: number;
  } | null = null;
  for (const p of philosophers) {
    const res = await fetch(
      `${BASE_URL}/api/claims/${encodeURIComponent(p.name)}`,
    );
    if (!res.ok) continue;
    const body = (await res.json()) as { claims: ApiClaim[] };
    // Replicate the panel's Works ordering: the group lists the
    // "writings" property's claims first, then "wrote", each in API
    // order (claims-panel.tsx maps GROUPS properties in order and
    // flatMaps the per-property lists).
    const works = [
      ...body.claims.filter((c) => c.property === "writings"),
      ...body.claims.filter((c) => c.property === "wrote"),
    ];
    if (!subject || works.length > subject.works.length) {
      subject = { name: p.name, firstId: p.firstId, works };
    }
    if (!altSubject) {
      const idx = works.findIndex(
        (c) => !!c.altTitle && !!c.altTitleRef && !!c.altTitleSectionId,
      );
      if (idx >= 0) {
        altSubject = { name: p.name, firstId: p.firstId, works, index: idx };
      }
    }
  }
  if (!subject) throw new Error("no philosophers returned by the API");
  if (subject.works.length <= WORKS_PREVIEW) {
    throw new Error(
      `no philosopher with more works than the preview size (${WORKS_PREVIEW})`,
    );
  }

  // The entry under test: the first works claim beyond the preview that
  // carries a sectionId (a live CitationLink rather than a plain span).
  const targetIndex = subject.works.findIndex(
    (c, i) => i >= WORKS_PREVIEW && !!c.sectionId && !!c.ref,
  );
  if (targetIndex < 0) {
    throw new Error(
      `${subject.name}: no works entry beyond the first ${WORKS_PREVIEW} carries a citation (sectionId)`,
    );
  }
  const target = subject.works[targetIndex];
  const targetSection = target.sectionId!;
  const who = `entry "${target.value}" (#${targetIndex + 1} of ${subject.works.length}) -> section ${targetSection}`;
  console.log(
    `subject: ${subject.name} (${subject.works.length} works claims, panel on section ${subject.firstId})`,
  );
  console.log(`target: ${who}, citation label (D.L. ${target.ref})`);

  // The proof the landing page really rendered the passage: a verbatim
  // snippet of the section's own text from the API.
  const sectionRes = await fetch(
    `${BASE_URL}/api/sections/${encodeURIComponent(targetSection)}`,
  );
  if (!sectionRes.ok) {
    throw new Error(
      `${who}: /api/sections/${targetSection} returned ${sectionRes.status}`,
    );
  }
  const sectionBody = (await sectionRes.json()) as {
    id: string;
    text?: string;
    textEn?: string;
  };
  const passage = (sectionBody.textEn || sectionBody.text || "").trim();
  if (!passage) {
    throw new Error(`${who}: section ${targetSection} has no passage text`);
  }
  const snippet = passage.slice(0, 80);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    // Fail fast with the failing URL/status instead of an opaque selector
    // timeout when the site itself fails to boot.
    const guard = attachPageGuard(page);

    console.log(
      `\nScenario 1: expand the Works list on /section/${subject.firstId}`,
    );
    await page.goto(`${BASE_URL}/section/${subject.firstId}`, {
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
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("h4")).some(
          (h) => h.textContent === "Works",
        ),
      undefined,
      { timeout: 15000 },
    );
    // Expand past the preview.
    await page.evaluate(() => {
      const heading = Array.from(document.querySelectorAll("h4")).find(
        (h) => h.textContent === "Works",
      );
      const btn = heading?.parentElement?.querySelector("button");
      if (!btn) throw new Error("Works expander button not found");
      btn.click();
    });
    await page.waitForTimeout(200);

    // Locate the target entry's citation link inside the Works list.
    // No helper functions inside evaluate: tsx's esbuild transform wraps
    // named locals with a __name helper that doesn't exist in the page.
    const linkState = await page.evaluate(
      ({ idx, label }: { idx: number; label: string }) => {
        const heading = Array.from(document.querySelectorAll("h4")).find(
          (h) => h.textContent === "Works",
        );
        const list = heading?.parentElement?.querySelector("ul");
        const items = list ? Array.from(list.querySelectorAll(":scope > li")) : [];
        const li = items[idx];
        if (!li) {
          return { found: false, count: items.length, href: null as string | null };
        }
        const anchor = Array.from(li.querySelectorAll("a")).find(
          (a) => a.textContent === label,
        );
        return {
          found: !!anchor,
          count: items.length,
          href: anchor?.getAttribute("href") ?? null,
        };
      },
      { idx: targetIndex, label: `(D.L. ${target.ref})` },
    );
    check(
      `expanded list renders all ${subject.works.length} entries`,
      linkState.count === subject.works.length,
      `${who}: entries=${linkState.count}`,
    );
    check(
      `citation link (D.L. ${target.ref}) is rendered on the entry`,
      linkState.found,
      who,
    );
    check(
      `citation href targets /section/${targetSection}`,
      (linkState.href ?? "").endsWith(`/section/${targetSection}`),
      `${who}: href=${JSON.stringify(linkState.href)}`,
    );
    if (!linkState.found) {
      throw new Error(`${who}: citation link not found, cannot click`);
    }

    console.log(
      `\nScenario 2: click the citation and land on /section/${targetSection}`,
    );
    await page.evaluate(
      ({ idx, label }: { idx: number; label: string }) => {
        const heading = Array.from(document.querySelectorAll("h4")).find(
          (h) => h.textContent === "Works",
        );
        const list = heading?.parentElement?.querySelector("ul");
        const li = list
          ? Array.from(list.querySelectorAll(":scope > li"))[idx]
          : undefined;
        const anchor = li
          ? Array.from(li.querySelectorAll("a")).find(
              (a) => a.textContent === label,
            )
          : undefined;
        if (!anchor) throw new Error("citation link vanished before click");
        anchor.click();
      },
      { idx: targetIndex, label: `(D.L. ${target.ref})` },
    );

    // The SPA navigates client-side; wait for the target section page to
    // render its passage.
    await page
      .waitForFunction(
        (sec: string) => window.location.pathname.endsWith(`/section/${sec}`),
        targetSection,
        { timeout: 15000 },
      )
      .catch(() => {});
    const path = new URL(page.url()).pathname;
    check(
      `browser URL is the target section page`,
      path.endsWith(`/section/${targetSection}`),
      `${who}: path=${path}`,
    );

    const rendered = await page
      .waitForFunction(
        (frag: string) => document.body.innerText.includes(frag),
        snippet,
        { timeout: 15000 },
      )
      .then(() => true)
      .catch(() => false);
    check(`passage text of section ${targetSection} is rendered`, rendered, who);

    const headingShown = await page.evaluate(
      (sec: string) => document.body.innerText.includes(sec),
      targetSection,
    );
    check(
      `section id ${targetSection} appears on the rendered page`,
      headingShown,
      who,
    );
    const notFound = await page.evaluate(() =>
      document.body.innerText.includes("Section Not Found"),
    );
    check(`page is not the Section Not Found fallback`, !notFound, who);

    // ---- Alt-title citation: the secondary "also titled ..." line's own
    // link must land on its (possibly different) section page too.
    if (!altSubject) {
      throw new Error(
        "no works claim with altTitle/altTitleRef/altTitleSectionId found via /api/claims",
      );
    }
    const altClaim = altSubject.works[altSubject.index];
    const altSection = altClaim.altTitleSectionId!;
    const altWho = `entry "${altClaim.value}" (also titled "${altClaim.altTitle}", #${altSubject.index + 1} of ${altSubject.works.length}) -> section ${altSection}`;
    console.log(
      `\nScenario 3: alt-title citation of ${altSubject.name}'s ${altWho}, label (D.L. ${altClaim.altTitleRef})`,
    );

    // Fetch the alt section's passage as proof of rendering.
    const altSectionRes = await fetch(
      `${BASE_URL}/api/sections/${encodeURIComponent(altSection)}`,
    );
    if (!altSectionRes.ok) {
      throw new Error(
        `${altWho}: /api/sections/${altSection} returned ${altSectionRes.status}`,
      );
    }
    const altSectionBody = (await altSectionRes.json()) as {
      id: string;
      text?: string;
      textEn?: string;
    };
    const altPassage = (
      altSectionBody.textEn ||
      altSectionBody.text ||
      ""
    ).trim();
    if (!altPassage) {
      throw new Error(`${altWho}: section ${altSection} has no passage text`);
    }
    const altSnippet = altPassage.slice(0, 80);

    await page.goto(`${BASE_URL}/section/${altSubject.firstId}`, {
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
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        /Show \d+ facts/.test(b.textContent ?? ""),
      );
      if (!btn) throw new Error("claims panel header button not found");
      btn.click();
    });
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("h4")).some(
          (h) => h.textContent === "Works",
        ),
      undefined,
      { timeout: 15000 },
    );
    // Expand past the preview if the entry sits beyond it.
    if (altSubject.index >= WORKS_PREVIEW) {
      await page.evaluate(() => {
        const heading = Array.from(document.querySelectorAll("h4")).find(
          (h) => h.textContent === "Works",
        );
        const btn = heading?.parentElement?.querySelector("button");
        if (!btn) throw new Error("Works expander button not found");
        btn.click();
      });
      await page.waitForTimeout(200);
    }

    // Locate the alt-title link: inside the entry's li, the anchor within
    // the "also titled ..." block (NOT the entry's main citation link,
    // which can carry the same "(D.L. <ref>)" label text).
    const altLinkState = await page.evaluate(
      ({ idx, label }: { idx: number; label: string }) => {
        const heading = Array.from(document.querySelectorAll("h4")).find(
          (h) => h.textContent === "Works",
        );
        const list = heading?.parentElement?.querySelector("ul");
        const items = list
          ? Array.from(list.querySelectorAll(":scope > li"))
          : [];
        const li = items[idx];
        if (!li) {
          return { found: false, count: items.length, href: null as string | null };
        }
        const anchor = Array.from(li.querySelectorAll("a")).find(
          (a) =>
            a.textContent === label &&
            (a.parentElement?.textContent ?? "").includes("also titled"),
        );
        return {
          found: !!anchor,
          count: items.length,
          href: anchor?.getAttribute("href") ?? null,
        };
      },
      { idx: altSubject.index, label: `(D.L. ${altClaim.altTitleRef})` },
    );
    check(
      `alt-title link (D.L. ${altClaim.altTitleRef}) is rendered on the "also titled" line`,
      altLinkState.found,
      altWho,
    );
    check(
      `alt-title href targets /section/${altSection}`,
      (altLinkState.href ?? "").endsWith(`/section/${altSection}`),
      `${altWho}: href=${JSON.stringify(altLinkState.href)}`,
    );
    if (!altLinkState.found) {
      throw new Error(`${altWho}: alt-title link not found, cannot click`);
    }

    await page.evaluate(
      ({ idx, label }: { idx: number; label: string }) => {
        const heading = Array.from(document.querySelectorAll("h4")).find(
          (h) => h.textContent === "Works",
        );
        const list = heading?.parentElement?.querySelector("ul");
        const li = list
          ? Array.from(list.querySelectorAll(":scope > li"))[idx]
          : undefined;
        const anchor = li
          ? Array.from(li.querySelectorAll("a")).find(
              (a) =>
                a.textContent === label &&
                (a.parentElement?.textContent ?? "").includes("also titled"),
            )
          : undefined;
        if (!anchor) throw new Error("alt-title link vanished before click");
        anchor.click();
      },
      { idx: altSubject.index, label: `(D.L. ${altClaim.altTitleRef})` },
    );

    await page
      .waitForFunction(
        (sec: string) => window.location.pathname.endsWith(`/section/${sec}`),
        altSection,
        { timeout: 15000 },
      )
      .catch(() => {});
    const altPath = new URL(page.url()).pathname;
    check(
      `browser URL is the alt-title target section page`,
      altPath.endsWith(`/section/${altSection}`),
      `${altWho}: path=${altPath}`,
    );

    const altRendered = await page
      .waitForFunction(
        (frag: string) => document.body.innerText.includes(frag),
        altSnippet,
        { timeout: 15000 },
      )
      .then(() => true)
      .catch(() => false);
    check(
      `passage text of section ${altSection} is rendered`,
      altRendered,
      altWho,
    );
    const altHeadingShown = await page.evaluate(
      (sec: string) => document.body.innerText.includes(sec),
      altSection,
    );
    check(
      `section id ${altSection} appears on the rendered page`,
      altHeadingShown,
      altWho,
    );
    const altNotFound = await page.evaluate(() =>
      document.body.innerText.includes("Section Not Found"),
    );
    check(`page is not the Section Not Found fallback`, !altNotFound, altWho);
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\ne2e-works-citation: ${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\ne2e-works-citation: all checks passed");
}

await main();
