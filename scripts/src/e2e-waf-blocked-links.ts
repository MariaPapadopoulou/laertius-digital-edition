/// <reference lib="dom" />
// e2e-waf-blocked-links — real-browser verification of the external hosts
// that the HTTP-level link validators can never check.
//
// validate-external-links.ts and validate-dynamic-external-links.ts allowlist
// viaf.org and www.britannica.com because their WAFs 403 Node fetch (and, for
// Britannica, even curl with a browser User-Agent) from this workspace. Those
// hosts are therefore permanently SKIPPED there — they could die and both
// validators would stay green. This script closes that blind spot by loading
// one sample link per allowlisted host in headless Chromium and asserting
// evidence that the target is alive.
//
// Verification tiers (per host, strongest evidence available from this
// network, established 2026-08-05):
//  - viaf.org: full content verification. With a real Chrome User-Agent the
//    record page hydrates and renders "Socrates"; the stock HeadlessChrome
//    UA gets its JS chunks 403'd, so the UA override is load-bearing.
//  - www.britannica.com: Cloudflare interposes a bot challenge that no
//    headless browser (headless shell OR full Chromium new-headless, with
//    UA override and AutomationControlled disabled) can pass from this
//    datacenter IP. The challenge page itself is accepted as the liveness
//    signal: producing it requires DNS, TLS, and an active Cloudflare zone
//    for www.britannica.com. A dead, parked, or lapsed domain cannot serve
//    it. If Britannica ever renders real content here, the marker check
//    upgrades automatically.
//
// Checks:
//  1. Every host in either validator's HOST_ALLOWLIST has a probe entry here
//     (drift guard: a newly allowlisted host cannot silently escape the
//     browser check), and every probe host is still allowlisted somewhere
//     (no stale probes).
//  2. Each sample URL, loaded in headless Chromium, either renders its
//     subject marker ("Socrates" — both sample links are Socrates records)
//     or, where allowed, presents a genuine WAF challenge page naming the
//     host.
//  3. Positive control: a deliberately dead URL must FAIL to load, or the
//     probe logic is vacuously green.
//
// Requirements: a Chromium headless shell installed for playwright-core:
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
//     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// playwright-core resolves its browser registry at module import time; set
// PLAYWRIGHT_BROWSERS_PATH first via the shared bootstrap.
import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
import type { Page } from "playwright-core";

const here = path.dirname(fileURLToPath(import.meta.url));

// VIAF's WAF 403s subresource requests carrying the HeadlessChrome UA (the
// document itself loads, but the record never hydrates); a real Chrome UA
// makes the full record render.
const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

interface Probe {
  url: string;
  /** String that must appear in the rendered page body. */
  marker: string;
  /**
   * Accept a WAF bot-challenge page naming this host as proof of liveness
   * (used when the challenge cannot be passed from this network at all).
   */
  challengeCountsAsAlive: boolean;
}

/**
 * One representative link per WAF-allowlisted host. The marker is a string
 * that must appear in the rendered page body — both samples are records
 * about Socrates, so an error page or parked domain cannot satisfy it.
 */
const PROBES: Record<string, Probe> = {
  "viaf.org": {
    url: "https://viaf.org/viaf/88039167",
    marker: "Socrates",
    challengeCountsAsAlive: false,
  },
  "www.britannica.com": {
    url: "https://www.britannica.com/biography/Socrates",
    marker: "Socrates",
    challengeCountsAsAlive: true,
  },
};

/** Deliberately dead URL: the probe must flag this or it is broken. */
const POSITIVE_CONTROL_DEAD_URL =
  "https://this-domain-does-not-exist.laertius-link-check.invalid/";

/** Source files whose HOST_ALLOWLIST this script must stay in sync with. */
const ALLOWLIST_SOURCES = [
  "validate-external-links.ts",
  "validate-dynamic-external-links.ts",
];

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

/** Extract the quoted host keys from a HOST_ALLOWLIST object literal. */
function allowlistedHosts(file: string): string[] {
  const src = readFileSync(path.join(here, file), "utf8");
  const m = src.match(/const HOST_ALLOWLIST[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!m) {
    throw new Error(`${file}: could not locate HOST_ALLOWLIST literal`);
  }
  const hosts: string[] = [];
  for (const line of m[1].split("\n")) {
    const key = line.match(/^\s*"([^"]+)"\s*:/);
    if (key) hosts.push(key[1]);
  }
  return hosts;
}

/** True when the body looks like a real WAF bot-challenge for this host. */
function isWafChallenge(bodyText: string, host: string): boolean {
  return (
    bodyText.includes(host) &&
    /security (verification|service)|verifies you are not a bot|checking your browser/i.test(
      bodyText,
    )
  );
}

interface ProbeResult {
  verdict: "content" | "challenge" | "dead";
  detail: string;
}

async function probeUrl(
  page: Page,
  host: string,
  probe: Probe,
): Promise<ProbeResult> {
  let status: number | undefined;
  try {
    const response = await page.goto(probe.url, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    status = response?.status();
  } catch (err) {
    return { verdict: "dead", detail: String(err) };
  }
  // The real content renders late (VIAF hydrates client-side; a challenge
  // could in principle auto-resolve and reload). Poll the rendered body.
  let bodyText = "";
  const deadline = Date.now() + 30_000;
  for (;;) {
    bodyText = await page.evaluate(() => document.body?.innerText ?? "");
    if (bodyText.includes(probe.marker)) {
      return {
        verdict: "content",
        detail: `HTTP ${status}, rendered ${JSON.stringify(probe.marker)}`,
      };
    }
    if (Date.now() > deadline) break;
    await page.waitForTimeout(1_000);
  }
  if (isWafChallenge(bodyText, host)) {
    return {
      verdict: "challenge",
      detail: `HTTP ${status}, WAF challenge page names ${host} (DNS+TLS+WAF zone alive)`,
    };
  }
  return {
    verdict: "dead",
    detail: `HTTP ${status}, no marker/challenge; first 200 chars: ${JSON.stringify(bodyText.slice(0, 200))}`,
  };
}

async function main() {
  // 1. Allowlist ↔ probe drift guard (no browser needed).
  const allAllowlisted = new Set<string>();
  for (const file of ALLOWLIST_SOURCES) {
    for (const host of allowlistedHosts(file)) allAllowlisted.add(host);
  }
  check(
    "allowlists are non-empty (parser found hosts)",
    allAllowlisted.size > 0,
    `found ${allAllowlisted.size}`,
  );
  for (const host of allAllowlisted) {
    check(
      `allowlisted host ${host} has a browser probe`,
      host in PROBES,
      host in PROBES
        ? undefined
        : `add a PROBES entry for ${host} in e2e-waf-blocked-links.ts`,
    );
  }
  for (const host of Object.keys(PROBES)) {
    check(
      `probe host ${host} is still allowlisted in a validator`,
      allAllowlisted.has(host),
      allAllowlisted.has(host) ? undefined : "remove the stale PROBES entry",
    );
  }

  // 2. Real-browser probes.
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      userAgent: BROWSER_UA,
      viewport: { width: 1280, height: 720 },
    });
    for (const [host, probe] of Object.entries(PROBES)) {
      console.log(`probing ${probe.url} ...`);
      const result = await probeUrl(page, host, probe);
      const alive =
        result.verdict === "content" ||
        (result.verdict === "challenge" && probe.challengeCountsAsAlive);
      check(`${host}: alive in a real browser`, alive, result.detail);
      if (result.verdict === "challenge" && probe.challengeCountsAsAlive) {
        console.log(
          `  note: ${host} content is unverifiable from this network (WAF challenge cannot be passed headlessly); challenge page accepted as liveness evidence`,
        );
      }
    }

    // 3. Positive control: dead URL must fail.
    const control = await probeUrl(page, "positive-control", {
      url: POSITIVE_CONTROL_DEAD_URL,
      marker: "this marker must never render",
      challengeCountsAsAlive: false,
    });
    check(
      "positive control: dead URL is reported dead",
      control.verdict === "dead",
      control.verdict === "dead"
        ? undefined
        : `unexpectedly ${control.verdict}: ${control.detail}`,
    );
  } finally {
    await browser.close();
  }
}

main().then(
  () => {
    if (failures > 0) {
      console.error(`\ne2e-waf-blocked-links: ${failures} check(s) failed`);
      process.exit(1);
    }
    console.log("\ne2e-waf-blocked-links: all checks passed");
  },
  (err) => {
    console.error("e2e-waf-blocked-links: error:", err);
    process.exit(1);
  },
);
