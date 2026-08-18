/**
 * Live-link check for static external links across the Laertius site:
 * the About page acknowledgements, the site footer, home page, privacy
 * and accessibility pages, and map attribution. The Perseus link (www.perseus.tufts.edu) once went dead
 * silently and a reader had to report it before it was repointed to
 * https://scaife.perseus.org/. This validator extracts every external
 * href from the About page source and verifies each one still responds
 * over HTTP with a browser-like User-Agent (2xx/3xx = alive).
 *
 * - Some hosts refuse non-browser clients (403) or are unreachable from
 *   this workspace network entirely (connection error). Those must get an
 *   explicit, commented allowlist entry below — never a silent pass.
 * - Positive control: a deliberately dead URL is probed on every run and
 *   MUST be flagged dead, proving the checker is not vacuously green.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-external-links
 */
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Source files carrying static external hrefs (literal href="https://…"
 * strings; template-literal hrefs built from data are out of scope —
 * those are covered by the LOD/data validators). Add any new page or
 * component with static external links here.
 */
const CREDIT_SOURCES = [
  "pages/about.tsx",
  // Site footer (Humanistica Digitalia + CC license links).
  "components/layout.tsx",
  // Home page hero + footer copy (Humanistica Digitalia, CC license).
  "pages/home.tsx",
  // Privacy page (contact mailto; external links may be absent).
  "pages/privacy.tsx",
  // Accessibility statement links the canonical public site URL.
  "pages/accessibility.tsx",
  // Map attribution links the OpenStreetMap copyright page.
  "pages/map.tsx",
];

/**
 * Per-host allowlist for hosts that cannot be verified over plain HTTP
 * from this workspace. Every entry MUST carry a reason. An allowlisted
 * host is reported as SKIPPED (visible in output), never silently passed.
 */
const HOST_ALLOWLIST: Record<string, string> = {
  // VIAF's WAF fingerprints the TLS client and returns 403 to Node's
  // fetch even with a browser User-Agent (curl with the same UA gets
  // HTTP 200 from this workspace, verified 2026-08-02). The link works
  // in real browsers; it cannot be verified from Node here. Allowlisted
  // hosts are NOT unchecked: e2e-waf-blocked-links.ts probes each of them
  // in headless Chromium and fails if a host here lacks a probe entry.
  "viaf.org": "WAF 403s Node fetch by TLS fingerprint; curl/browsers get 200",
};

/** Deliberately dead URL: the checker must flag this or it is broken. */
const POSITIVE_CONTROL_DEAD_URL =
  "https://this-domain-does-not-exist.laertius-link-check.invalid/";

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const srcDir = path.resolve(
  import.meta.dirname,
  "../../artifacts/laertius/src",
);

function extractExternalHrefs(source: string): string[] {
  const hrefs = new Set<string>();
  for (const m of source.matchAll(/href=["'](https?:\/\/[^"']+)["']/g)) {
    hrefs.add(m[1]);
  }
  return [...hrefs];
}

async function probe(
  url: string,
): Promise<{ alive: boolean; detail: string }> {
  // GET (not HEAD): several hosts reject or misroute HEAD requests.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: { "User-Agent": BROWSER_UA, Accept: "text/html,*/*" },
        signal: AbortSignal.timeout(20_000),
      });
      // Any response the fetch redirect-follower settled on counts by
      // final status; 2xx/3xx = alive.
      if (res.status >= 200 && res.status < 400) {
        return { alive: true, detail: `HTTP ${res.status}` };
      }
      return { alive: false, detail: `HTTP ${res.status}` };
    } catch (err) {
      if (attempt === 2) {
        return {
          alive: false,
          detail: `network error (${err instanceof Error ? err.message : String(err)})`,
        };
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return { alive: false, detail: "unreachable" };
}

async function main() {
  const urlToPages = new Map<string, string[]>();
  for (const page of CREDIT_SOURCES) {
    const source = readFileSync(path.join(srcDir, page), "utf8");
    for (const href of extractExternalHrefs(source)) {
      const list = urlToPages.get(href) ?? [];
      list.push(page);
      urlToPages.set(href, list);
    }
  }

  if (urlToPages.size === 0) {
    console.error(
      "validate-external-links FAILED: extracted zero external hrefs from " +
        CREDIT_SOURCES.join(", ") +
        " — extraction regex or page path is broken (vacuous check)",
    );
    process.exit(1);
  }

  const errors: string[] = [];
  let aliveCount = 0;
  let skippedCount = 0;

  const urls = [...urlToPages.keys()];
  const results = await Promise.all(
    urls.map(async (url) => ({ url, result: await probe(url) })),
  );

  for (const { url, result } of results) {
    const host = new URL(url).hostname;
    const pages = urlToPages.get(url)!.join(", ");
    if (result.alive) {
      aliveCount++;
      console.log(`  ✓ ${url} (${result.detail})`);
    } else if (host in HOST_ALLOWLIST) {
      skippedCount++;
      console.log(
        `  ~ SKIPPED ${url} (${result.detail}) — allowlisted host ${host}: ${HOST_ALLOWLIST[host]}`,
      );
    } else {
      errors.push(`${url} in ${pages} is dead: ${result.detail}`);
    }
  }

  // Positive control: the dead URL must be flagged, or the probe logic is
  // vacuously green.
  const control = await probe(POSITIVE_CONTROL_DEAD_URL);
  if (control.alive) {
    console.error(
      `validate-external-links FAILED: positive control ${POSITIVE_CONTROL_DEAD_URL} was reported ALIVE (${control.detail}) — the dead-link detection is broken`,
    );
    process.exit(1);
  }
  console.log(
    `  ✓ positive control correctly flagged dead (${control.detail})`,
  );

  if (errors.length > 0) {
    console.error(
      `validate-external-links FAILED (${errors.length} dead link${errors.length === 1 ? "" : "s"}) — repoint or allowlist (with a reason) in scripts/src/validate-external-links.ts:`,
    );
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }

  console.log(
    `✓ all ${urls.length} static external links checked across ${CREDIT_SOURCES.length} page source(s): ${aliveCount} alive, ${skippedCount} allowlist-skipped, positive control verified`,
  );
}

main().catch((err) => {
  console.error("validate-external-links crashed:", err);
  process.exit(1);
});
