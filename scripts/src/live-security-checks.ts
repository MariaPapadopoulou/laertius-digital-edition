/**
 * Security-header and rate-limit-identity probes shared by the live IONOS
 * check (check-live-ionos.ts). Kept in its own module so the probes can be
 * exercised against a locally booted bundle behind a simulated
 * X-Forwarded-For-appending proxy (the way IONOS's nginx front end behaves)
 * when the live host is unreachable from the workspace.
 *
 * The probes run once per API SURFACE. The deployment has two independent
 * Node processes behind the front end — the main api-server (/api) and the
 * Legomena companion (/legomena/api), each behind its own nginx location
 * whose proxy_set_header lines could independently be missing — so a green
 * main-site result proves nothing about the Legomena location. Both
 * surfaces are probed with the same checks:
 *
 *   1. The four security headers (CSP, HSTS, nosniff, Referrer-Policy)
 *      arrive on the surface's paths — i.e. the front-end proxy does not
 *      strip or override them. (The frontend shell "/" is probed on the
 *      main surface only; the Legomena frontend is merged into the main
 *      SPA, so only its API responses are Legomena's own.)
 *   2. The general API rate limiter is active (X-RateLimit-Limit on API
 *      responses).
 *   3. Each strict per-IP limiter — Ask AND the SPARQL endpoint on both
 *      servers, plus Search on the main server, each running its own
 *      bucket — enforces 429 + Retry-After
 *      after its per-minute window (cheap invalid-body 400s consume the
 *      window — both servers run the limiters before validation, so no
 *      RAG/query work happens).
 *   4. Spoof resistance THROUGH the real proxy, per strict endpoint: once
 *      this client's bucket is exhausted, a request carrying a forged
 *      X-Forwarded-For entry must STILL be 429. The servers run
 *      "trust proxy = 1", so only the rightmost entry — the one the proxy
 *      appends — identifies the client. If the front end passed the
 *      client-supplied header through untouched (missing proxy_set_header
 *      X-Forwarded-For $proxy_add_x_forwarded_for), the forged entry
 *      would mint a fresh bucket and this probe fails — exactly the
 *      misconfiguration the live check exists to catch. A proxy location
 *      could mishandle headers for /sparql alone, so proving Ask is not
 *      enough.
 *   5. Exhausting the strict buckets does not bleed into the general API
 *      bucket (the surface's healthz still 200).
 *
 * What it CANNOT verify from one client, by construction: that two
 * DIFFERENT real client IPs get independent windows. That needs a second
 * network (e.g. a phone hotspot) and is documented as a manual step in
 * docs/verification/live-security-headers.md; runLiveSecurityChecks
 * prints the reminder so the operator cannot miss it.
 */

export const REQUIRED_SECURITY_HEADERS: ReadonlyArray<
  readonly [name: string, expect: RegExp]
> = [
  ["content-security-policy", /default-src 'self'/],
  ["strict-transport-security", /max-age=\d+/],
  ["x-content-type-options", /^nosniff$/],
  ["referrer-policy", /strict-origin-when-cross-origin/],
];

export interface LiveSecurityCheckIO {
  ok(msg: string): void;
  fail(msg: string): void;
  log(msg: string): void;
}

/** One independently proxied API surface behind the front end. */
export interface SecuritySurface {
  /** Human label used in section logs ("main site", "Legomena companion"). */
  label: string;
  /** Paths whose responses must carry the four security headers. */
  headerPaths: readonly string[];
  /** Cheap GET used for the general-limiter and no-bleed probes. */
  healthPath: string;
  /** Strict-limited POST endpoint (invalid body → 400 before any RAG work). */
  askPath: string;
  /** Strict-limited SPARQL POST endpoint (own bucket; invalid body → 400
   * before any query evaluation). */
  sparqlPath: string;
  /** Optional additional strict-limited POST endpoint (own bucket; invalid
   * body → 400 before any embedding work). The main api-server runs one on
   * /api/search; the Legomena companion has no equivalent. */
  searchPath?: string;
}

export const SECURITY_SURFACES: readonly SecuritySurface[] = [
  {
    label: "main site",
    headerPaths: ["/", "/api/healthz"],
    healthPath: "/api/healthz",
    askPath: "/api/ask",
    sparqlPath: "/api/lod/sparql",
    searchPath: "/api/search",
  },
  {
    label: "Legomena companion",
    headerPaths: ["/legomena/api/healthz"],
    healthPath: "/legomena/api/healthz",
    askPath: "/legomena/api/ask",
    sparqlPath: "/legomena/api/sparql",
  },
];

async function tryFetch(
  url: string,
  io: LiveSecurityCheckIO,
  init?: RequestInit,
): Promise<Response | null> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    io.fail(`${url}: request failed (${String(err)})`);
    return null;
  }
}

/** Runs the full probe set for one surface. */
async function runSurfaceSecurityChecks(
  base: string,
  surface: SecuritySurface,
  io: LiveSecurityCheckIO,
): Promise<void> {
  const { label, headerPaths, healthPath, askPath, sparqlPath, searchPath } =
    surface;

  // 1. Security headers on every surface path. A front-end proxy can
  // treat locations (and static vs proxied responses) differently, so
  // each surface must be probed on its own.
  for (const pathname of headerPaths) {
    const res = await tryFetch(`${base}${pathname}`, io, {
      headers: { "cache-control": "no-cache", pragma: "no-cache" },
    });
    if (!res) continue;
    const missing: string[] = [];
    for (const [name, expect] of REQUIRED_SECURITY_HEADERS) {
      const value = res.headers.get(name) ?? "";
      if (!expect.test(value)) {
        missing.push(`${name} (got "${value}")`);
      }
    }
    if (missing.length > 0) {
      io.fail(
        `GET ${pathname}: security header(s) missing or overridden by the ` +
          `front-end proxy: ${missing.join("; ")}`,
      );
    } else {
      io.ok(
        `GET ${pathname}: CSP, HSTS, nosniff and Referrer-Policy all ` +
          `arrive at the client`,
      );
    }
  }

  // 2. General API limiter active.
  const health = await tryFetch(`${base}${healthPath}`, io);
  if (health) {
    const apiLimit = Number(health.headers.get("x-ratelimit-limit"));
    if (apiLimit > 0) {
      io.ok(
        `${label} general API rate limiter active (X-RateLimit-Limit: ` +
          `${apiLimit}/min)`,
      );
    } else {
      io.fail(
        `GET ${healthPath} carries no X-RateLimit-Limit header — the ` +
          `${label} general API rate limiter is not active ` +
          `(RATE_LIMIT_API_MAX=0 on the server, or a proxy stripping ` +
          `X-RateLimit-* headers)`,
      );
    }
  }

  // 3+4. Each strict per-IP limiter (Ask, then the SPARQL endpoint —
  // separate buckets on both servers) is burst-probed to a 429 and then
  // spoof-probed. A proxy location could strip or mishandle headers for
  // /sparql alone, so a green Ask result proves nothing about it.
  await runStrictLimiterProbes(base, askPath, "Ask", label, io);
  await runStrictLimiterProbes(base, sparqlPath, "SPARQL", label, io);
  // The main api-server also runs a strict bucket on /api/search; a proxy
  // location could mishandle headers for that path alone, so it gets the
  // same burst + spoof treatment.
  if (searchPath) {
    await runStrictLimiterProbes(base, searchPath, "Search", label, io);
  }

  // 5. Separate buckets: the exhausted strict windows must not starve the
  // rest of the surface's API.
  const healthAfter = await tryFetch(`${base}${healthPath}`, io);
  if (healthAfter) {
    if (healthAfter.status === 200) {
      io.ok(
        `GET ${healthPath} still 200 after the strict-limiter bursts — the ` +
          `${label} strict limiters do not bleed into the general API bucket`,
      );
    } else {
      io.fail(
        `GET ${healthPath} returned ${healthAfter.status} after the ` +
          `strict-limiter bursts — a ${label} strict limiter is bleeding into ` +
          `the general API bucket`,
      );
    }
  }
}

/**
 * Bursts one strict-limited POST endpoint with cheap invalid-body requests
 * (400s — both servers run the limiter before validation, so no RAG or
 * query work happens) until it answers 429 + Retry-After, then verifies a
 * forged X-Forwarded-For cannot escape the exhausted bucket.
 *
 * Spoof resistance through the real proxy: with this client's bucket
 * exhausted, a forged X-Forwarded-For must NOT mint a fresh bucket. A
 * correctly configured front end appends the real client address as the
 * rightmost entry (proxy_add_x_forwarded_for), which is the only one
 * "trust proxy = 1" honors. Each nginx location carries its OWN
 * proxy_set_header lines, so this must be proven per surface AND per
 * strict endpoint.
 */
async function runStrictLimiterProbes(
  base: string,
  endpointPath: string,
  limiterName: string,
  label: string,
  io: LiveSecurityCheckIO,
): Promise<void> {
  const probe = await tryFetch(`${base}${endpointPath}`, io, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  if (!probe) return;
  const strictMax = Number(probe.headers.get("x-ratelimit-limit"));
  if (!(strictMax > 0) || strictMax > 120) {
    io.fail(
      `POST ${endpointPath} X-RateLimit-Limit is ` +
        `"${probe.headers.get("x-ratelimit-limit")}" — expected a strict ` +
        `per-minute cap (1..120); the ${label} ${limiterName} limiter is ` +
        `disabled or the proxy strips its headers, so the burst/spoof ` +
        `probes cannot run`,
    );
    return;
  }
  let got429: Response | null = null;
  for (let i = 0; i <= strictMax + 2; i += 1) {
    const res = await tryFetch(`${base}${endpointPath}`, io, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    if (!res) return;
    if (res.status === 429) {
      got429 = res;
      break;
    }
    if (res.status !== 400) {
      io.fail(
        `POST ${endpointPath} burst request ${i} returned ${res.status}, ` +
          `expected 400 (invalid body) or 429 (rate limited)`,
      );
      return;
    }
  }
  if (!got429) {
    io.fail(
      `POST ${endpointPath} never answered 429 after ${strictMax + 3} rapid ` +
        `requests — the ${label} ${limiterName} rate limit is not enforced ` +
        `on the live site`,
    );
    return;
  }
  const retryAfter = Number(got429.headers.get("retry-after"));
  if (retryAfter > 0) {
    io.ok(
      `POST ${endpointPath} rate-limited: 429 with Retry-After ` +
        `${retryAfter}s after at most ${strictMax} requests/min`,
    );
  } else {
    io.fail(
      `429 from ${endpointPath} carries no positive Retry-After header ` +
        `(got "${got429.headers.get("retry-after")}")`,
    );
  }

  const spoofed = await tryFetch(`${base}${endpointPath}`, io, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.77",
    },
    body: "{}",
  });
  if (spoofed) {
    if (spoofed.status === 429) {
      io.ok(
        `a forged X-Forwarded-For header cannot escape the ` +
          `${endpointPath} 429 — the proxy appends the real client address ` +
          `and rate limits key on it`,
      );
    } else {
      io.fail(
        `POST ${endpointPath} with a forged X-Forwarded-For returned ` +
          `${spoofed.status}, expected 429 — the front-end proxy's ` +
          `${label} location is passing client-supplied X-Forwarded-For ` +
          `through instead of appending the real address (missing ` +
          `"proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;"), ` +
          `so visitors can spoof their rate-limit identity`,
      );
    }
  }
}

/**
 * Runs all single-client security probes against `base` (origin + optional
 * subpath, no trailing slash) for BOTH API surfaces (main site and the
 * Legomena companion). Failures are reported through io.fail — the caller
 * owns the exit code.
 */
export async function runLiveSecurityChecks(
  base: string,
  io: LiveSecurityCheckIO,
): Promise<void> {
  for (const surface of SECURITY_SURFACES) {
    io.log(`  — ${surface.label} (${surface.askPath}):`);
    await runSurfaceSecurityChecks(base, surface, io);
  }

  // What a single client cannot prove: independent windows for two real
  // client IPs. Point the operator at the manual step.
  io.log(
    "    ⚠ manual step remains: confirm two DIFFERENT client IPs get " +
      "independent rate-limit windows (e.g. exhaust /api/ask from one " +
      "network, then a single request from a phone hotspot must answer " +
      "400, not 429). Procedure: docs/verification/live-security-headers.md",
  );
}
