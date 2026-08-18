/**
 * validate-security-header-drift — keeps the two servers' security headers
 * from silently drifting apart.
 *
 * The Legomena API server ships its own copy of the security-headers helper
 * (artifacts/legomena-api/src/security.ts) that deliberately mirrors
 * artifacts/api-server/src/lib/security.ts, because the two esbuild bundles
 * cannot cross-import. Nothing else compares them, so a hardening change
 * applied to one copy and not the other would drift silently.
 *
 * This validator instantiates both securityHeaders() middlewares (the main
 * server with production-shaped options: an inline-script hash and the OSM
 * tile origin), captures the headers each sets, and asserts:
 *
 *  1. The non-CSP security headers (Strict-Transport-Security,
 *     X-Content-Type-Options, Referrer-Policy) are byte-identical.
 *  2. Both CSPs define exactly the same set of directives.
 *  3. Every directive's sources match, EXCEPT the intentional differences,
 *     which are explicitly listed below:
 *       - script-src: the main server appends inline-script sha256 hashes
 *         (theme bootstrap in the built index.html).
 *       - img-src: the main server appends the OpenStreetMap tile origin
 *         for the Map page.
 *       - font-src: the main server adds `data:` because Vite inlines small
 *         @fontsource files into the built CSS; the Legomena server serves
 *         only JSON/Turtle and needs no fonts.
 *     For those directives only the documented extra sources may differ;
 *     any other divergence still fails.
 *  4. The intentional differences actually exist (so the allowlist cannot
 *     rot into covering directives that are in fact identical), and each
 *     CSP has a sane number of directives (anti-vacuity guard).
 *  5. Positive control: the comparison logic is re-run against a seeded
 *     drifted copy and must flag it, so the check cannot pass vacuously.
 *
 * On failure it names the drifted directive/header and both values.
 *
 * Run: pnpm --filter @workspace/scripts run validate-security-header-drift
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const mainSecurity = await import(
  "../../artifacts/api-server/src/lib/security"
);
const legomenaSecurity = await import(
  "../../artifacts/legomena-api/src/security"
);

type Handler = (
  req: unknown,
  res: {
    setHeader: (name: string, value: string) => void;
    status?: unknown;
  },
  next: () => void,
) => void;

/** Run a middleware once and capture every header it sets. */
function captureHeaders(handler: Handler): Map<string, string> {
  const headers = new Map<string, string>();
  let nextCalled = false;
  handler(
    {},
    {
      setHeader: (name: string, value: string) => {
        headers.set(name.toLowerCase(), String(value));
      },
    },
    () => {
      nextCalled = true;
    },
  );
  if (!nextCalled) {
    throw new Error("security middleware did not call next()");
  }
  return headers;
}

interface ParsedCsp {
  /** directive -> sorted sources of the FIRST occurrence (what browsers honor). */
  directives: Map<string, string[]>;
  /** Directive names that appeared more than once (a policy smell in itself). */
  duplicates: string[];
}

/**
 * Parse a CSP header value into directive -> sorted source list. Browsers
 * honor the FIRST occurrence of a duplicated directive and ignore the rest,
 * so we keep the first and report duplicates — a later injected duplicate
 * must never mask the effective (first) policy from the comparison.
 */
function parseCsp(csp: string): ParsedCsp {
  const directives = new Map<string, string[]>();
  const duplicates: string[] = [];
  for (const part of csp.split(";")) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const name = tokens[0]!.toLowerCase();
    if (directives.has(name)) {
      duplicates.push(name);
      continue; // keep the first occurrence — that is what browsers enforce
    }
    directives.set(name, tokens.slice(1).sort());
  }
  return { directives, duplicates };
}

// Production-shaped options for the main server (app.ts passes inline-script
// hashes and the OSM tile origin). A representative hash stands in for the
// real index.html hashes; its exact value is irrelevant to the comparison
// because script-src hashes are a documented intentional difference.
const SAMPLE_HASH = "'sha256-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQ='";
const OSM_ORIGIN = "https://tile.openstreetmap.org";

/**
 * Intentional CSP differences: directive -> extra sources the MAIN server
 * may add on top of the Legomena server's sources. Anything else must match
 * exactly. A predicate handles open-ended extras (script-src hashes).
 */
const INTENTIONAL_MAIN_EXTRAS: Record<
  string,
  (source: string) => boolean
> = {
  // Inline theme-bootstrap script hashes computed from the built index.html.
  "script-src": (s) => /^'sha256-[A-Za-z0-9+/=]+'$/.test(s),
  // OpenStreetMap tiles for the Map page.
  "img-src": (s) => s === OSM_ORIGIN,
  // Vite inlines small fonts as data: URIs in the built CSS.
  "font-src": (s) => s === "data:",
};

interface Drift {
  where: string;
  message: string;
}

/** Compare the two header sets; returns the list of drifts (empty = in sync). */
function compareHeaders(
  main: Map<string, string>,
  legomena: Map<string, string>,
): Drift[] {
  const drifts: Drift[] = [];

  // 1. Non-CSP security headers must be byte-identical.
  for (const header of [
    "strict-transport-security",
    "x-content-type-options",
    "referrer-policy",
  ]) {
    const a = main.get(header);
    const b = legomena.get(header);
    if (a === undefined || b === undefined || a !== b) {
      drifts.push({
        where: header,
        message: `header "${header}" drifted: api-server=${JSON.stringify(a)} legomena-api=${JSON.stringify(b)}`,
      });
    }
  }

  // 2 & 3. CSP directive-by-directive comparison.
  const mainCspRaw = main.get("content-security-policy");
  const legoCspRaw = legomena.get("content-security-policy");
  if (!mainCspRaw || !legoCspRaw) {
    drifts.push({
      where: "content-security-policy",
      message: `a server is missing the Content-Security-Policy header entirely: api-server=${JSON.stringify(mainCspRaw)} legomena-api=${JSON.stringify(legoCspRaw)}`,
    });
    return drifts;
  }
  const mainParsed = parseCsp(mainCspRaw);
  const legoParsed = parseCsp(legoCspRaw);
  for (const [server, parsed] of [
    ["api-server", mainParsed],
    ["legomena-api", legoParsed],
  ] as const) {
    for (const dup of parsed.duplicates) {
      drifts.push({
        where: dup,
        message: `${server} CSP repeats directive "${dup}" — browsers honor only the first occurrence, so the duplicate is dead policy and likely an injection or merge mistake`,
      });
    }
  }
  const mainCsp = mainParsed.directives;
  const legoCsp = legoParsed.directives;

  const allDirectives = new Set([...mainCsp.keys(), ...legoCsp.keys()]);
  for (const directive of [...allDirectives].sort()) {
    const mainSources = mainCsp.get(directive);
    const legoSources = legoCsp.get(directive);
    if (!mainSources || !legoSources) {
      drifts.push({
        where: directive,
        message: `CSP directive "${directive}" exists on only one server: api-server=${mainSources ? mainSources.join(" ") : "(absent)"} legomena-api=${legoSources ? legoSources.join(" ") : "(absent)"}`,
      });
      continue;
    }
    const allowedExtra = INTENTIONAL_MAIN_EXTRAS[directive];
    const mainShared = allowedExtra
      ? mainSources.filter((s) => !allowedExtra(s))
      : mainSources;
    // Legomena must never have sources the main server lacks, and the shared
    // (non-intentional) parts must match exactly.
    if (mainShared.join(" ") !== legoSources.join(" ")) {
      drifts.push({
        where: directive,
        message: `CSP directive "${directive}" drifted beyond the documented intentional differences: api-server="${mainSources.join(" ")}" legomena-api="${legoSources.join(" ")}" (shared part expected to match: "${mainShared.join(" ")}" vs "${legoSources.join(" ")}")`,
      });
    }
  }
  return drifts;
}

let failures = 0;
function fail(message: string): void {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

const mainHeaders = captureHeaders(
  mainSecurity.securityHeaders({
    scriptSrcExtra: [SAMPLE_HASH],
    imgSrcExtra: [OSM_ORIGIN],
  }) as unknown as Handler,
);
const legomenaHeaders = captureHeaders(
  legomenaSecurity.securityHeaders() as unknown as Handler,
);

// Anti-vacuity: both CSPs must parse into a sane number of directives.
const mainCsp = parseCsp(
  mainHeaders.get("content-security-policy") ?? "",
).directives;
const legoCsp = parseCsp(
  legomenaHeaders.get("content-security-policy") ?? "",
).directives;
if (mainCsp.size < 8) {
  fail(
    `api-server CSP parsed into only ${mainCsp.size} directives — parsing or the policy itself broke`,
  );
}
if (legoCsp.size < 8) {
  fail(
    `legomena-api CSP parsed into only ${legoCsp.size} directives — parsing or the policy itself broke`,
  );
}

// The documented intentional differences must actually exist, so the
// allowlist stays honest.
if (!(mainCsp.get("font-src") ?? []).includes("data:")) {
  fail(
    `expected intentional difference vanished: api-server font-src no longer includes "data:" — update INTENTIONAL_MAIN_EXTRAS if this is deliberate`,
  );
}
if ((legoCsp.get("font-src") ?? []).includes("data:")) {
  fail(
    `expected intentional difference vanished: legomena-api font-src now includes "data:" — update INTENTIONAL_MAIN_EXTRAS if this is deliberate`,
  );
}
if (!(mainCsp.get("script-src") ?? []).includes(SAMPLE_HASH)) {
  fail(
    `api-server script-src ignored the scriptSrcExtra option — the inline-script hash never reached the CSP`,
  );
}
if (!(mainCsp.get("img-src") ?? []).includes(OSM_ORIGIN)) {
  fail(
    `api-server img-src ignored the imgSrcExtra option — the OSM tile origin never reached the CSP`,
  );
}

// The real comparison.
const drifts = compareHeaders(mainHeaders, legomenaHeaders);
for (const drift of drifts) {
  fail(drift.message);
}

// Positive controls: the comparator must catch seeded drifts.
{
  // (a) A directive-value drift: weaken object-src on the seeded copy.
  const seeded = new Map(legomenaHeaders);
  seeded.set(
    "content-security-policy",
    (legomenaHeaders.get("content-security-policy") ?? "").replace(
      "object-src 'none'",
      "object-src 'self'",
    ),
  );
  const caught = compareHeaders(mainHeaders, seeded);
  if (!caught.some((d) => d.where === "object-src")) {
    fail(
      "positive control failed: a seeded object-src drift was NOT detected — the comparator is broken",
    );
  }
  // (b) A non-CSP header drift: shorten HSTS on the seeded copy.
  const seeded2 = new Map(legomenaHeaders);
  seeded2.set("strict-transport-security", "max-age=60");
  const caught2 = compareHeaders(mainHeaders, seeded2);
  if (!caught2.some((d) => d.where === "strict-transport-security")) {
    fail(
      "positive control failed: a seeded HSTS drift was NOT detected — the comparator is broken",
    );
  }
  // (c) A missing directive: drop base-uri from the seeded copy.
  const seeded3 = new Map(legomenaHeaders);
  seeded3.set(
    "content-security-policy",
    (legomenaHeaders.get("content-security-policy") ?? "")
      .split(";")
      .filter((p) => !p.trim().startsWith("base-uri"))
      .join(";"),
  );
  const caught3 = compareHeaders(mainHeaders, seeded3);
  if (!caught3.some((d) => d.where === "base-uri")) {
    fail(
      "positive control failed: a seeded missing base-uri directive was NOT detected — the comparator is broken",
    );
  }
  // (d) A duplicated directive prepended before the real one: browsers honor
  // the FIRST occurrence, so the weak duplicate is the effective policy. The
  // comparator must flag both the duplication and the weakened script-src.
  const seeded4 = new Map(legomenaHeaders);
  seeded4.set(
    "content-security-policy",
    `script-src 'unsafe-inline'; ${legomenaHeaders.get("content-security-policy") ?? ""}`,
  );
  const caught4 = compareHeaders(mainHeaders, seeded4);
  if (
    !caught4.some(
      (d) =>
        d.where === "script-src" && d.message.includes("repeats directive"),
    ) ||
    !caught4.some(
      (d) => d.where === "script-src" && d.message.includes("drifted"),
    )
  ) {
    fail(
      "positive control failed: a seeded duplicate script-src 'unsafe-inline' (prepended, thus browser-effective) was NOT fully detected — the comparator is broken",
    );
  }
}

if (failures > 0) {
  console.error(
    `validate-security-header-drift FAILED with ${failures} problem(s).`,
  );
  process.exit(1);
}
console.log(
  "validate-security-header-drift OK: the two servers' security headers agree on all shared directives; intentional differences (script-src hashes, img-src OSM tiles, font-src data:) verified present.",
);
