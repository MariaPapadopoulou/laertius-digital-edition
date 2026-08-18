/// <reference lib="dom" />
// Real-browser check of the Competency page's Source Passages card (Zone D
// in pages/competency.tsx). The validate-competency-passages validator
// proves the API serves the right snippet text for each passage id, but a
// frontend regression (wrong field mapped, a snippet dropped, the section
// link mismatched with the quoted text) would ship with all API-level
// validators green. This script pins the rendered card against the live
// API payload:
//
// For each of two questions (stoa-members and homonymy-proper-names):
// 1. Fetch /api/competency/questions/:id and take its passages array
//    (id, en, grc snippets).
// 2. Load /competency?q=<id> and locate the Source Passages card.
// 3. Assert the card renders exactly the payload's passages, in order:
//    each block's header link text is the passage id, its href is
//    /section/<that same id>, and the English and Greek paragraphs equal
//    the API's en/grc for that id (whitespace-normalized). At least the
//    first two passages per question are asserted individually; the whole
//    roster is also checked for count and order.
// 4. Positive control: each question must serve at least 2 passages with
//    both en and grc non-empty, so the comparison can never pass vacuously.
// 5. Click-through: click the first passage's header link and assert the
//    rendered /section/:id page shows the matching Book/Chapter/Section
//    heading line and contains the snippet's text (truncation ellipsis
//    stripped) in the passage body, in both languages. Correct hrefs with
//    a broken route match, a redirect, or a blank page would otherwise
//    pass steps 1-4.
//
// Requirements: the API server and web workflows must be running (the
// script talks to the shared proxy, default http://localhost:80), and a
// Chromium headless shell must be installed for playwright-core, e.g.:
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
//     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell

import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");
import type { Page } from "playwright-core";
import type { PageGuard } from "./lib/e2e-page-guard";

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

// Whitespace-normalize so browser text rendering (collapsed spaces,
// leading/trailing trim) cannot cause false mismatches while any real
// content drift still fails.
function norm(s: string | undefined | null): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

interface ApiPassage {
  id: string;
  en?: string;
  grc?: string;
}

async function fetchPassages(questionId: string): Promise<ApiPassage[]> {
  const res = await fetch(`${BASE_URL}/api/competency/questions/${questionId}`);
  if (!res.ok)
    throw new Error(`competency/questions/${questionId}: ${res.status}`);
  const data = (await res.json()) as { passages: ApiPassage[] };
  return data.passages ?? [];
}

async function checkQuestion(page: Page, guard: PageGuard, questionId: string) {
  console.log(`Question: ${questionId}`);
  const apiPassages = await fetchPassages(questionId);

  // Positive control: the comparison must have real material to bite on.
  check(
    "API serves at least 2 passages",
    apiPassages.length >= 2,
    `count=${apiPassages.length}`,
  );
  const bilingual = apiPassages.filter(
    (p) => norm(p.en).length > 0 && norm(p.grc).length > 0,
  );
  check(
    "at least 2 passages carry both English and Greek snippets",
    bilingual.length >= 2,
    `bilingual=${bilingual.length}`,
  );

  await page.goto(`${BASE_URL}/competency?q=${questionId}`, {
    waitUntil: "networkidle",
  });
  guard.assertPageLoaded();
  const card = page.locator('div:has(> h3:has-text("Source Passages"))');
  await guard.guarded(card.first().waitFor({ timeout: 30000 }));

  // The card renders one bordered block per passage; each block's header
  // holds the /section/:id link. Read the whole roster in order.
  const rendered = await card.first().evaluate((el) => {
    const blocks = Array.from(
      el.querySelectorAll(":scope > div > div"),
    ) as HTMLElement[];
    return blocks.map((b) => {
      const link = b.querySelector("a") as HTMLAnchorElement | null;
      const paras = Array.from(b.querySelectorAll("p")) as HTMLElement[];
      return {
        linkText: link?.textContent ?? "",
        href: link?.getAttribute("href") ?? "",
        paras: paras.map((p) => p.textContent ?? ""),
      };
    });
  });

  check(
    `card renders all ${apiPassages.length} passages`,
    rendered.length === apiPassages.length,
    `rendered=${rendered.length} expected=${apiPassages.length}`,
  );

  apiPassages.forEach((p, i) => {
    const r = rendered[i];
    if (!r) {
      check(`passage ${p.id} is rendered at position ${i}`, false, "missing");
      return;
    }
    check(
      `passage ${i}: header link text is the section id ${p.id}`,
      norm(r.linkText) === p.id,
      `text=${JSON.stringify(r.linkText)}`,
    );
    check(
      `passage ${i}: link href carries the same section id (/section/${p.id})`,
      r.href === `/section/${p.id}`,
      `href=${JSON.stringify(r.href)}`,
    );
    const expectedParas = [p.en, p.grc]
      .filter((t) => norm(t).length > 0)
      .map(norm);
    const gotParas = r.paras.map(norm);
    check(
      `passage ${i} (${p.id}): renders ${expectedParas.length} snippet paragraph(s)`,
      gotParas.length === expectedParas.length,
      `got=${gotParas.length} expected=${expectedParas.length}`,
    );
    if (norm(p.en).length > 0) {
      check(
        `passage ${i} (${p.id}): displayed English equals the API snippet`,
        gotParas[0] === norm(p.en),
        `got=${JSON.stringify((gotParas[0] ?? "").slice(0, 60))} expected=${JSON.stringify(norm(p.en).slice(0, 60))}`,
      );
    }
    if (norm(p.grc).length > 0) {
      const grcIndex = norm(p.en).length > 0 ? 1 : 0;
      check(
        `passage ${i} (${p.id}): displayed Greek equals the API snippet`,
        gotParas[grcIndex] === norm(p.grc),
        `got=${JSON.stringify((gotParas[grcIndex] ?? "").slice(0, 60))} expected=${JSON.stringify(norm(p.grc).slice(0, 60))}`,
      );
    }
  });

  // Click-through: follow the first passage's header link and prove the
  // section page actually renders that passage. The hrefs above can be
  // correct while a route regression (broken /section/:id match, a
  // redirect, or a blank render) breaks the actual navigation.
  const first = apiPassages[0];
  const firstBlockLink = card
    .first()
    .locator(":scope > div > div")
    .first()
    .locator("a")
    .first();
  await firstBlockLink.click();
  await page.waitForURL(`**/section/${first.id}`, { timeout: 15000 });
  check(
    `click-through: URL is /section/${first.id}`,
    page.url().includes(`/section/${first.id}`),
    `url=${page.url()}`,
  );

  const [book, chapter, sectionNo] = first.id.split(".");
  const headingLine = `Book ${book}, Chapter ${chapter}, Section ${sectionNo}`;
  await page
    .locator(`p:has-text("${headingLine}")`)
    .first()
    .waitFor({ timeout: 15000 });
  const bodyText = norm(
    await page.evaluate(() => document.body.innerText ?? ""),
  );
  check(
    `click-through: section page shows the heading "${headingLine}"`,
    bodyText.includes(headingLine),
  );

  // The competency snippets are truncated with a trailing ellipsis; the
  // section page carries the full text, so the ellipsis-stripped snippet
  // must appear verbatim in the page body (whitespace-normalized).
  const stripEllipsis = (s: string) => norm(s).replace(/\u2026$/, "").trim();
  if (norm(first.en).length > 0) {
    const enBody = stripEllipsis(first.en!);
    check(
      `click-through: page body contains the English snippet text`,
      enBody.length > 20 && bodyText.includes(enBody),
      `snippet=${JSON.stringify(enBody.slice(0, 60))}`,
    );
  }
  if (norm(first.grc).length > 0) {
    const grcBody = stripEllipsis(first.grc!);
    check(
      `click-through: page body contains the Greek snippet text`,
      grcBody.length > 20 && bodyText.includes(grcBody),
      `snippet=${JSON.stringify(grcBody.slice(0, 60))}`,
    );
  }

  // Back-navigation: pressing the browser Back button after following a
  // passage must land back on /competency with the SAME question still
  // selected (the ?q= param intact) and the Source Passages card rendered
  // again with the same first passage. A state-restore regression in
  // competency.tsx (e.g. deriving the active question from component state
  // instead of the URL) would pass all forward checks yet reset readers to
  // a blank page on Back.
  await page.goBack();
  await page.waitForURL(`**/competency?q=${questionId}*`, { timeout: 15000 });
  const backUrl = new URL(page.url());
  check(
    `back: URL returns to /competency with q=${questionId}`,
    backUrl.pathname.endsWith("/competency") &&
      backUrl.searchParams.get("q") === questionId,
    `url=${page.url()}`,
  );

  const backCard = page.locator('div:has(> h3:has-text("Source Passages"))');
  await backCard.first().waitFor({ timeout: 30000 });
  const backFirst = await backCard
    .first()
    .locator(":scope > div > div")
    .first()
    .evaluate((b) => {
      const link = b.querySelector("a") as HTMLAnchorElement | null;
      const paras = Array.from(b.querySelectorAll("p")) as HTMLElement[];
      return {
        linkText: link?.textContent ?? "",
        href: link?.getAttribute("href") ?? "",
        paras: paras.map((p) => p.textContent ?? ""),
      };
    });
  check(
    `back: Source Passages card shows the first passage id ${first.id} again`,
    norm(backFirst.linkText) === first.id &&
      backFirst.href === `/section/${first.id}`,
    `text=${JSON.stringify(backFirst.linkText)} href=${JSON.stringify(backFirst.href)}`,
  );
  if (norm(first.en).length > 0) {
    check(
      `back: first passage English snippet matches the API again`,
      norm(backFirst.paras[0]) === norm(first.en),
      `got=${JSON.stringify(norm(backFirst.paras[0] ?? "").slice(0, 60))}`,
    );
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    // Fail fast with the failing URL/status instead of an opaque selector
    // timeout when the site itself fails to boot.
    const guard = attachPageGuard(page);
    await checkQuestion(page, guard, "stoa-members");
    await checkQuestion(page, guard, "homonymy-proper-names");
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\ne2e-competency-passages: ${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\ne2e-competency-passages: all checks passed");
}

main().catch((err) => {
  console.error("e2e-competency-passages crashed:", err);
  process.exit(1);
});
