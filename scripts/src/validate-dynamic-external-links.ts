/**
 * Live-link check for the DYNAMIC external reference links across the
 * Laertius site — links built from template literals with data, e.g.
 * `https://www.wikidata.org/wiki/${qid}` in components/external-links.tsx,
 * `https://pleiades.stoa.org/places/${id}` in entity-panel.tsx/map.tsx,
 * `https://logeion.uchicago.edu/${word}` in annotated-text.tsx, plus
 * britannica.com, inphoproject.org, philosophypages.com, dbpedia.org and
 * en.wikipedia.org in pages/graph.tsx and pages/entities.tsx. The static
 * counterpart lives in validate-external-links.ts; if any of these
 * reference sites moves or dies, every generated link rots silently, so
 * this validator probes each base with a representative known-good
 * sample path.
 *
 * How it works:
 * - Scans every .ts/.tsx file under artifacts/laertius/src for
 *   `https://…${…}` template literals (inline href OR variable
 *   assignment) and extracts the static URL base (origin + literal
 *   path prefix before the first interpolation).
 * - Pins a floor on the number of distinct bases (MIN_DISTINCT_BASES)
 *   so a refactor that stops matching can't silently shrink the probe
 *   set.
 * - Every extracted base MUST have an entry in SAMPLE_PATHS below (a
 *   real QID, a real Pleiades id, …). An unknown base fails the run —
 *   new reference sites can't sneak in unprobed.
 * - Probes base+sample with a browser-like User-Agent; 2xx/3xx = alive.
 * - Hosts unverifiable from this workspace get an explicit, commented
 *   allowlist entry — reported SKIPPED, never silently passed.
 * - Positive control: a deliberately dead URL must be flagged dead on
 *   every run, proving the checker is not vacuously green.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-dynamic-external-links
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const srcDir = path.resolve(
  import.meta.dirname,
  "../../artifacts/laertius/src",
);

/**
 * Representative known-good sample path per extracted base. Each value
 * is a real identifier verified in the project's own curated data
 * (api-server kg-links.ts / place-pleiades.ts / philosophy-pages.ts),
 * so a 404 means the SITE changed, not that the sample was bogus.
 */
const SAMPLE_PATHS: Record<string, string> = {
  // Real QID from the curated KG data.
  "https://www.wikidata.org/wiki/": "Q718070",
  // enwiki sitelink present in kg-links.ts.
  "https://en.wikipedia.org/wiki/": "Socrates",
  // DBpedia resource derived from the same enwiki sitelink.
  "https://dbpedia.org/resource/": "Socrates",
  // Curated Pleiades id (Smyrna/Eurydikeia) from place-pleiades.ts.
  "https://pleiades.stoa.org/places/": "550893",
  // Any Greek headword; Logeion serves the SPA shell for every word.
  "https://logeion.uchicago.edu/": encodeURIComponent("λόγος"),
  // VIAF id for Socrates from kg-links.ts (host is allowlisted below).
  "https://viaf.org/viaf/": "88039167",
  // Britannica path from kg-links.ts.
  "https://www.britannica.com/": "biography/Socrates",
  // InPhO thinker path from kg-links.ts.
  "https://www.inphoproject.org/": "thinker/3919",
  // Philosophy Pages path from philosophy-pages.ts.
  "https://www.philosophypages.com/": "ph/plat.htm",
};

/**
 * Per-host allowlist for hosts that cannot be verified over plain HTTP
 * from this workspace. Every entry MUST carry a reason. An allowlisted
 * host is reported as SKIPPED (visible in output), never silently passed.
 */
const HOST_ALLOWLIST: Record<string, string> = {
  // VIAF's WAF fingerprints the TLS client and returns 403 to Node's
  // fetch even with a browser User-Agent (curl with the same UA gets
  // HTTP 200 from this workspace, verified 2026-08-02 in
  // validate-external-links.ts). Works in real browsers.
  "viaf.org": "WAF 403s Node fetch by TLS fingerprint; curl/browsers get 200",
  // Britannica's WAF 403s ALL clients from this workspace network (Node
  // fetch AND curl with browser User-Agents, verified 2026-08-05). The
  // link works in real browsers; it cannot be verified from here.
  // Allowlisted hosts are NOT unchecked: e2e-waf-blocked-links.ts probes
  // each of them in headless Chromium and fails if a host here lacks a
  // probe entry.
  "www.britannica.com":
    "WAF 403s both Node fetch and curl from this network; works in real browsers",
};

/** Deliberately dead URL: the checker must flag this or it is broken. */
const POSITIVE_CONTROL_DEAD_URL =
  "https://this-domain-does-not-exist.laertius-link-check.invalid/";

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.tsx?$/.test(name)) yield p;
  }
}

/**
 * Minimum number of DISTINCT dynamic URL bases the scan must find.
 * The scan covers file moves (it walks the whole src tree), but if a
 * component rewrites its link-building style in a way the extraction
 * regex no longer matches, a base could silently drop out of the probe
 * set and the check would shrink without failing. Pinning the floor
 * turns that shrinkage into a loud failure. If a reference site is
 * INTENTIONALLY removed from the app, lower this number in the same
 * change.
 */
const MIN_DISTINCT_BASES = 9;

/**
 * Extract template-literal external URL bases: the static prefix of any
 * `https://…${…}` template literal up to the first interpolation. This
 * deliberately matches MORE than href={`…`} — it also catches URLs
 * built in variables first (const url = `https://…${id}`) so a
 * refactor from inline href to a variable cannot drop a base from the
 * probe set.
 */
function extractDynamicBases(source: string): string[] {
  const bases = new Set<string>();
  for (const m of source.matchAll(/`(https?:\/\/[^`$]+)\$\{/g)) {
    bases.add(m[1]);
  }
  return [...bases];
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
  const baseToFiles = new Map<string, Set<string>>();
  for (const file of walk(srcDir)) {
    const source = readFileSync(file, "utf8");
    for (const base of extractDynamicBases(source)) {
      const rel = path.relative(srcDir, file);
      const set = baseToFiles.get(base) ?? new Set<string>();
      set.add(rel);
      baseToFiles.set(base, set);
    }
  }

  if (baseToFiles.size === 0) {
    console.error(
      "validate-dynamic-external-links FAILED: extracted zero template-literal external URL bases from " +
        srcDir +
        " — extraction regex or src path is broken (vacuous check)",
    );
    process.exit(1);
  }

  if (baseToFiles.size < MIN_DISTINCT_BASES) {
    console.error(
      `validate-dynamic-external-links FAILED: found only ${baseToFiles.size} distinct dynamic URL base${baseToFiles.size === 1 ? "" : "s"}, expected at least ${MIN_DISTINCT_BASES} — a link-building refactor likely dropped a base from the probe set (or a reference site was removed; if intentional, lower MIN_DISTINCT_BASES in scripts/src/validate-dynamic-external-links.ts). Found:\n` +
        [...baseToFiles.entries()]
          .map(([b, files]) => `  - ${b} [${[...files].join(", ")}]`)
          .join("\n"),
    );
    process.exit(1);
  }

  const errors: string[] = [];
  let aliveCount = 0;
  let skippedCount = 0;

  // Any base without a curated sample path fails loudly: a new dynamic
  // reference site must get a known-good sample before it passes.
  for (const [base, files] of baseToFiles) {
    if (!(base in SAMPLE_PATHS)) {
      errors.push(
        `${base} in ${[...files].join(", ")} has no sample path — add a real known-good identifier to SAMPLE_PATHS in scripts/src/validate-dynamic-external-links.ts`,
      );
    }
  }

  const probeTargets = [...baseToFiles.keys()].filter(
    (b) => b in SAMPLE_PATHS,
  );
  const results = await Promise.all(
    probeTargets.map(async (base) => ({
      base,
      url: base + SAMPLE_PATHS[base],
      result: await probe(base + SAMPLE_PATHS[base]),
    })),
  );

  for (const { base, url, result } of results) {
    const host = new URL(base).hostname;
    const files = [...baseToFiles.get(base)!].join(", ");
    if (result.alive) {
      aliveCount++;
      console.log(`  ✓ ${url} (${result.detail}) [${files}]`);
    } else if (host in HOST_ALLOWLIST) {
      skippedCount++;
      console.log(
        `  ~ SKIPPED ${url} (${result.detail}) — allowlisted host ${host}: ${HOST_ALLOWLIST[host]}`,
      );
    } else {
      errors.push(
        `reference site behind ${base}\${…} is dead: sample ${url} → ${result.detail} (linked from ${files})`,
      );
    }
  }

  // Positive control: the dead URL must be flagged, or the probe logic
  // is vacuously green.
  const control = await probe(POSITIVE_CONTROL_DEAD_URL);
  if (control.alive) {
    console.error(
      `validate-dynamic-external-links FAILED: positive control ${POSITIVE_CONTROL_DEAD_URL} was reported ALIVE (${control.detail}) — the dead-link detection is broken`,
    );
    process.exit(1);
  }
  console.log(
    `  ✓ positive control correctly flagged dead (${control.detail})`,
  );

  if (errors.length > 0) {
    console.error(
      `validate-dynamic-external-links FAILED (${errors.length} problem${errors.length === 1 ? "" : "s"}) — repoint the link, fix the sample, or allowlist the host (with a reason) in scripts/src/validate-dynamic-external-links.ts:`,
    );
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }

  console.log(
    `✓ all ${baseToFiles.size} dynamic external link bases probed with known-good samples: ${aliveCount} alive, ${skippedCount} allowlist-skipped, positive control verified`,
  );
}

main().catch((err) => {
  console.error("validate-dynamic-external-links crashed:", err);
  process.exit(1);
});
