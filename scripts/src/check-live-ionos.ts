/**
 * Remote check of the LIVE IONOS deployment at https://humanisticadigitalia.eu.
 *
 * Run this AFTER the user has uploaded the freshly built bundle
 * (exports/laertius-ionos.zip) and restarted the service on IONOS. It never
 * asks for SSH credentials and never touches the server — it only probes the
 * public URL and compares the responses against the current source-derived
 * expectations, so it answers one question with certainty: is the live site
 * really serving the NEW bundle, or a stale extract / cached frontend /
 * not-restarted process?
 *
 * Probes:
 *   - GET /api/healthz          → 200 (main API is up and answering)
 *   - GET /                     → 200 HTML frontend shell whose hashed asset
 *     references actually resolve (a stale extract can serve an old
 *     index.html pointing at assets deleted by the new upload — or a CDN /
 *     browser-cache layer can serve an old shell after a good upload)
 *   - GET /api/graph            → the served movements' [id, label, grc]
 *     rows exact-match the current kg.ts MOVEMENTS + greek-names.ts
 *     GREEK_SCHOOL_NAMES derivation (a content-bearing endpoint whose rows
 *     change with curation — e.g. the Greek school names — so a stale
 *     server bundle fails loudly instead of looking fine at a glance)
 *   - GET /legomena/api/healthz → 200 (the Legomena companion service was
 *     restarted too), storeReady=true, denseIndexReady=true (the semantic
 *     search index and embedding model loaded — a missing model cache
 *     otherwise silently degrades Ask/search to sparse-only), and the
 *     served triple count / per-file dataset fingerprints match the local
 *     dataset manifest
 *
 * The freshness of the LOCAL zip is checked first (via the shared
 * ionos-bundle-contract): if the local bundle itself is stale, the remote
 * comparison would be meaningless (comparing the live site against
 * expectations the bundle was never built from), so the script says so and
 * fails before probing.
 *
 * Run on request:
 *   pnpm --filter @workspace/scripts run check-live-ionos
 *
 * Optional: LIVE_BASE_URL overrides the probed origin (for testing the
 * checker itself against a locally served bundle).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkBundleFreshness } from "./ionos-bundle-contract";
import { LAERTIUS_LIVE_ORIGIN, LAERTIUS_LOD_BASE } from "./laertius-live-site";
import { runLiveSecurityChecks } from "./live-security-checks";

const scriptsDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(scriptsDir);
const apiServerDir = path.join(repoRoot, "artifacts", "api-server");

// The site deploys at the subdomain root (frontend built with BASE_PATH=/;
// see scripts/src/laertius-live-site.ts). Asset URLs in the served HTML are
// root-absolute (/assets/…), so they are fetched from the ORIGIN, not
// appended to BASE.
const BASE = (process.env["LIVE_BASE_URL"] ?? LAERTIUS_LIVE_ORIGIN).replace(
  /\/+$/,
  "",
);
const ORIGIN = new URL(BASE).origin;

const FETCH_TIMEOUT_MS = 30_000;

let failures = 0;

function ok(msg: string): void {
  console.log(`  ✓ ${msg}`);
}

function fail(msg: string): void {
  failures += 1;
  console.error(`  ✗ ${msg}`);
}

async function probe(
  pathname: string,
  init?: RequestInit,
): Promise<Response | null> {
  return probeUrl(`${BASE}${pathname}`, init);
}

/** Like probe(), but takes a fully-qualified URL (no BASE prefixing). */
async function probeUrl(
  url: string,
  init?: RequestInit,
): Promise<Response | null> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      // Defeat any intermediate cache so we see what the origin serves NOW.
      headers: { "cache-control": "no-cache", pragma: "no-cache" },
    });
  } catch (err) {
    fail(`${url}: request failed (${String(err)})`);
    return null;
  }
}
function movementRowKey(
  id: string | undefined,
  label: string | undefined,
  grc: string | undefined,
): string {
  return JSON.stringify([id ?? null, label ?? null, grc ?? null]);
}

async function main(): Promise<void> {
  console.log(`Checking live site: ${BASE}\n`);

  // 0. Local bundle freshness gate. If the local zip is itself stale, the
  // source-derived expectations below describe a bundle that has not been
  // built yet — the remote comparison would then "fail" (or worse, pass)
  // for the wrong reason. Say so explicitly and stop.
  console.log("Local bundle freshness (precondition):");
  const zipPath = path.join(repoRoot, "exports", "laertius-ionos.zip");
  const freshness = checkBundleFreshness(repoRoot, zipPath);
  if (freshness.error) {
    console.error(
      `  ✗ The LOCAL bundle is stale — rebuild and re-upload before checking the live site:\n` +
        freshness.error
          .split("\n")
          .map((l) => `    ${l}`)
          .join("\n"),
    );
    process.exit(1);
  }
  ok("local exports/laertius-ionos.zip is fresh against all content sources");

  // Source-derived expectation: current movements legend rows, from the
  // exact modules the bundle was compiled from.
  process.env["LAERTIUS_DATA_DIR"] ??= path.join(apiServerDir, "data");
  const [{ MOVEMENTS }, { greekSchoolGrc }] = await Promise.all([
    import("../../artifacts/api-server/src/lib/kg"),
    import("../../artifacts/api-server/src/lib/greek-names"),
  ]);
  const expectedMovementRows = new Set<string>();
  for (const m of MOVEMENTS) {
    expectedMovementRows.add(
      movementRowKey(m.id, m.label, greekSchoolGrc(m.label)),
    );
  }
  if (expectedMovementRows.size === 0) {
    throw new Error(
      "kg.ts MOVEMENTS is empty — the movement-row positive control is broken",
    );
  }

  // 1. Main API health. Besides a bare 200, the health JSON reports
  // denseIndexReady (embedding index loaded AND the local embedding model
  // warmed up) — a deployment where the model cache is missing serves a
  // silently degraded Ask/search (sparse-only) while a plain 200 stays
  // green. The embedder warms up in the BACKGROUND after a restart, so
  // give a freshly restarted service the same grace window the Legomena
  // check uses before failing.
  console.log("\nMain API:");
  const health = await probe("/api/healthz");
  if (health) {
    if (health.status !== 200) {
      fail(`GET /api/healthz → ${health.status} (expected 200)`);
    } else {
      let healthBody: { status?: unknown; denseIndexReady?: unknown } | null =
        null;
      try {
        healthBody = (await health.json()) as {
          status?: unknown;
          denseIndexReady?: unknown;
        };
      } catch {
        healthBody = null;
      }
      if (!healthBody || healthBody.status !== "ok") {
        fail(
          `GET /api/healthz → 200 but the body is not the main API's health ` +
            `JSON (status=${String(healthBody?.status)})`,
        );
      } else {
        ok("GET /api/healthz → 200 with status=ok");
        let dense = healthBody.denseIndexReady;
        const MAIN_DENSE_RETRIES = 5;
        const MAIN_DENSE_RETRY_DELAY_MS = 10_000;
        for (let i = 0; dense !== true && i < MAIN_DENSE_RETRIES; i++) {
          console.log(
            `    … denseIndexReady=${String(dense)} — the embedding model may ` +
              `still be warming up after the restart; retrying in ` +
              `${MAIN_DENSE_RETRY_DELAY_MS / 1000}s (${i + 1}/${MAIN_DENSE_RETRIES})`,
          );
          await new Promise((r) => setTimeout(r, MAIN_DENSE_RETRY_DELAY_MS));
          const retry = await probe("/api/healthz");
          if (retry && retry.status === 200) {
            try {
              dense = (
                (await retry.json()) as { denseIndexReady?: unknown }
              ).denseIndexReady;
            } catch {
              // keep the last value; the loop retries or falls through
            }
          }
        }
        if (dense === true) {
          ok(
            "GET /api/healthz → denseIndexReady=true (dense embedding index " +
              "and local embedding model are loaded)",
          );
        } else {
          fail(
            `GET /api/healthz → denseIndexReady=${String(dense)} even after ` +
              `${(MAIN_DENSE_RETRIES * MAIN_DENSE_RETRY_DELAY_MS) / 1000}s — the main ` +
              `site's Ask/search retrieval is degraded to sparse-only for ` +
              `readers. The embedding model likely failed to load: check the ` +
              `main service log and verify the model cache exists in the ` +
              `bundle's data/models dir — a first boot without network ` +
              `access cannot download it`,
          );
        }
      }
    }
  }

  // 2. Frontend shell: 200 HTML, and every hashed asset it references
  // resolves. A stale extract (or a cache serving an old index.html after a
  // good upload) points at content-hashed assets the new upload deleted —
  // the site would white-screen for visitors while healthz stays green.
  console.log("\nFrontend:");
  const home = await probe("/");
  if (home) {
    const html = await home.text();
    if (home.status !== 200) {
      fail(`GET / → ${home.status} (expected 200)`);
    } else if (!/<div id="root">/.test(html) && !/<html/i.test(html)) {
      fail("GET / → 200 but the body does not look like the app's HTML shell");
    } else {
      ok("GET / → 200 HTML shell");
      const assetRefs = [
        ...html.matchAll(/(?:src|href)="(\/[^"]*?assets\/[^"]+)"/g),
      ].map((m) => m[1] as string);
      if (assetRefs.length === 0) {
        fail(
          "GET /: the HTML shell references no /assets/ files — cannot " +
            "verify the frontend build is intact",
        );
      } else {
        let assetsOk = 0;
        for (const ref of assetRefs) {
          // Asset refs in the served HTML are root-absolute (e.g.
          // /laertius/assets/…), so resolve them against the ORIGIN —
          // probing them would double-prefix BASE.
          const res = await probeUrl(`${ORIGIN}${ref}`);
          if (res && res.status === 200) assetsOk += 1;
          else if (res) {
            fail(
              `frontend asset ${ref} → ${res.status} — the served ` +
                `index.html references an asset the deployment does not ` +
                `have (stale extract or cached old shell)`,
            );
          }
        }
        if (assetsOk === assetRefs.length) {
          ok(
            `all ${assetRefs.length} hashed asset reference(s) in the ` +
              `served shell resolve (frontend shell and assets are from ` +
              `the same build)`,
          );
        }
      }
    }
  }

  // 3. Content-bearing endpoint: /api/graph movements exact-match the
  // current source derivation (incl. the Greek school names). A stale
  // server bundle built before a curation edit fails here with the exact
  // differing rows.
  console.log("\nContent (stale-bundle probe):");
  const graph = await probe("/api/graph");
  if (graph) {
    if (graph.status !== 200) {
      fail(`GET /api/graph → ${graph.status} (expected 200)`);
    } else {
      const payload = (await graph.json()) as {
        movements?: Array<Record<string, unknown>>;
      };
      const served = payload.movements ?? [];
      if (served.length === 0) {
        fail("GET /api/graph → 200 but served no movements");
      } else {
        const servedRows = new Set<string>();
        for (const raw of served) {
          servedRows.add(
            movementRowKey(
              typeof raw["id"] === "string" ? raw["id"] : undefined,
              typeof raw["label"] === "string" ? raw["label"] : undefined,
              typeof raw["grc"] === "string" ? raw["grc"] : undefined,
            ),
          );
        }
        const missing = [...expectedMovementRows].filter(
          (r) => !servedRows.has(r),
        );
        const extra = [...servedRows].filter(
          (r) => !expectedMovementRows.has(r),
        );
        if (missing.length === 0 && extra.length === 0) {
          ok(
            `GET /api/graph movements: all ${expectedMovementRows.size} ` +
              `[id, label, grc] rows match the current kg.ts MOVEMENTS + ` +
              `GREEK_SCHOOL_NAMES derivation — the live server bundle is ` +
              `current`,
          );
        } else {
          const detail = [
            ...missing.map((r) => `live site is missing (expected): ${r}`),
            ...extra.map((r) => `live site serves (not in source): ${r}`),
          ];
          fail(
            `GET /api/graph movements differ from the current source ` +
              `derivation — the live site is running a STALE bundle ` +
              `(upload not extracted / service not restarted?):\n` +
              detail.map((d) => `      ${d}`).join("\n"),
          );
        }
      }
    }
  }

  // 3b. Legacy LOD identifier dereference. The RDF exports deliberately
  // keep minting entity identifiers under the OLD path-based base
  // (LAERTIUS_LOD_BASE — see the documented decision in
  // laertius-live-site.ts), so the live host must keep answering those
  // URIs: a direct 200, or a redirect chain (e.g. /Laertius/* → the
  // subdomain) ending in 200. One URI per entity KIND minted in the graph
  // is probed — a single philosopher probe would stay green while a kind
  // whose SPA route differs (or does not exist) is a dead link.
  // Only meaningful against the real live host —
  // a LIVE_BASE_URL override (local checker testing) cannot serve the
  // legacy origin, so the probe is skipped there with a notice.
  console.log("\nLegacy LOD identifier dereference:");
  if (BASE !== LAERTIUS_LIVE_ORIGIN) {
    console.log(
      `  … skipped: LIVE_BASE_URL override (${BASE}) cannot answer for the ` +
        `legacy identifier host ${LAERTIUS_LOD_BASE}`,
    );
  } else {
    // Derive the entity KINDS actually minted in the published LOD graph
    // (philosopher, work, place, school, chapter, name, …) from the graph
    // itself — a hardcoded list would silently miss a newly minted kind
    // whose SPA route is broken while the philosopher probe stays green.
    // LAERTIUS_DATA_DIR is already pinned above, so the api-server lod
    // module resolves its corpus files correctly from this cwd.
    const { LOD_BASE, graphAsTurtle } = await import(
      "../../artifacts/api-server/src/lib/lod"
    );
    if (LOD_BASE !== LAERTIUS_LOD_BASE) {
      fail(
        `lod.ts LOD_BASE (${LOD_BASE}) !== laertius-live-site.ts ` +
          `LAERTIUS_LOD_BASE (${LAERTIUS_LOD_BASE}) — the identifier bases ` +
          `drifted; fix that before trusting this dereference probe`,
      );
    }
    // One representative URI per kind: every IRI in the graph of the form
    // <LOD_BASE/<kind>/<rest>>. The ontology namespace (…/ontology#…) has
    // no second path segment and is deliberately not an entity kind.
    const turtle = graphAsTurtle();
    const kindSamples = new Map<string, string>();
    const uriRe = new RegExp(
      `<${LOD_BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/([^/#>\\s]+)/([^>\\s]+)>`,
      "g",
    );
    for (const m of turtle.matchAll(uriRe)) {
      const kind = m[1] as string;
      const uri = m[0].slice(1, -1);
      const prev = kindSamples.get(kind);
      if (prev === undefined || uri < prev) kindSamples.set(kind, uri);
    }
    // Positive control on the derivation itself: the graph mints thousands
    // of entity IRIs — an empty/near-empty kind map means the regex no
    // longer matches the Turtle serialization, and every probe below would
    // pass vacuously.
    if (kindSamples.size < 4 || !kindSamples.has("philosopher")) {
      fail(
        `derived only ${kindSamples.size} entity kind(s) ` +
          `[${[...kindSamples.keys()].join(", ")}] from the LOD graph ` +
          `(and "philosopher" ${kindSamples.has("philosopher") ? "is" : "is NOT"} ` +
          `among them) — the kind-derivation regex no longer matches the ` +
          `Turtle output; fix it, do not trust the probes below`,
      );
    }
    console.log(
      `  sampling one identifier per minted kind: ` +
        `${[...kindSamples.keys()].sort().join(", ")}`,
    );
    for (const kind of [...kindSamples.keys()].sort()) {
      const legacyUri = kindSamples.get(kind) as string;
      const deref = await probeUrl(legacyUri, { redirect: "follow" });
      if (!deref) continue;
      if (deref.status !== 200) {
        fail(
          `[kind=${kind}] GET ${legacyUri} → ${deref.status} after following ` +
            `redirects — published RDF identifiers of this kind are DEAD ` +
            `LINKS for linked-data consumers. Restore the old path (or a ` +
            `/Laertius/* redirect to the subdomain) on the IONOS host — see ` +
            `docs/verification/ionos-legacy-lod-redirect.md — or consciously ` +
            `migrate the identifier base (laertius-live-site.ts ` +
            `LAERTIUS_LOD_BASE)`,
        );
      } else {
        ok(
          `[kind=${kind}] GET ${legacyUri} → 200${
            deref.redirected ? ` (via redirect to ${deref.url})` : ""
          }`,
        );
      }
    }
    // Positive control: a bogus kind/slug must NOT dereference to 200. If
    // it does, the redirect + SPA catch-all is absorbing EVERY path with a
    // 200 shell, and this probe can no longer distinguish a live identifier
    // from a dead one — say so instead of staying vacuously green.
    const bogusUri = `${LAERTIUS_LOD_BASE}/no-such-kind/no-such-entity-positive-control`;
    const bogus = await probeUrl(bogusUri, { redirect: "follow" });
    if (bogus) {
      if (bogus.status === 200) {
        fail(
          `positive control GET ${bogusUri} → 200 after redirects — a bogus ` +
            `identifier dereferences "successfully", so this probe cannot ` +
            `detect dead identifiers (the redirect + SPA catch-all serves a ` +
            `200 shell for any path). Tighten the redirect rule or add a ` +
            `server-side 404 for unknown entity paths`,
        );
      } else {
        ok(
          `positive control: bogus ${bogusUri} → ${bogus.status} (not 200) — ` +
            `the dereference probe can genuinely fail`,
        );
      }
    }
  }

  // 4. Legomena companion service health.
  console.log("\nLegomena companion:");
  const legomena = await probe("/legomena/api/healthz");
  if (legomena) {
    if (legomena.status !== 200) {
      fail(
        `GET /legomena/api/healthz → ${legomena.status} (expected 200 — ` +
          `was the Legomena service restarted too?)`,
      );
    } else {
      // A 200 alone is NOT proof the Legomena API answered: if the web
      // server's /legomena/api routing is missing, the main site's SPA
      // catch-all serves index.html with a 200 for this path. Require the
      // service's actual health JSON (status/storeReady/quadCount).
      const body = await legomena.text();
      let parsed: { status?: unknown; storeReady?: unknown } | null = null;
      try {
        parsed = JSON.parse(body) as { status?: unknown; storeReady?: unknown };
      } catch {
        parsed = null;
      }
      if (!parsed || parsed.status !== "ok") {
        fail(
          `GET /legomena/api/healthz → 200 but the body is not the Legomena ` +
            `health JSON (got ${body.slice(0, 80).replace(/\s+/g, " ")}…) — ` +
            `the web server is likely serving the main site's SPA catch-all ` +
            `instead of routing /legomena/api to the Legomena service`,
        );
      } else if (parsed.storeReady !== true) {
        fail(
          `GET /legomena/api/healthz → 200 but storeReady=${String(parsed.storeReady)} ` +
            `(the Legomena RDF store did not load — check the service log)`,
        );
      } else {
        ok("GET /legomena/api/healthz → 200 with storeReady=true");

        // Semantic-search readiness: the health payload also reports
        // denseIndexReady (committed embedding index loaded AND the local
        // embedding model warmed up). A deployment where the model failed
        // to download (first boot without network, wrong
        // LEGOMENA_MODEL_CACHE) serves readers a silently degraded
        // Ask/search — storeReady alone would still look green. The
        // embedder warms up in the BACKGROUND after a restart, so give a
        // freshly restarted service a short grace window before failing.
        let dense = (parsed as { denseIndexReady?: unknown }).denseIndexReady;
        const DENSE_RETRIES = 5;
        const DENSE_RETRY_DELAY_MS = 10_000;
        for (let i = 0; dense !== true && i < DENSE_RETRIES; i++) {
          console.log(
            `    … denseIndexReady=${String(dense)} — the embedding model may ` +
              `still be warming up after the restart; retrying in ` +
              `${DENSE_RETRY_DELAY_MS / 1000}s (${i + 1}/${DENSE_RETRIES})`,
          );
          await new Promise((r) => setTimeout(r, DENSE_RETRY_DELAY_MS));
          const retry = await probe("/legomena/api/healthz");
          if (retry && retry.status === 200) {
            try {
              dense = (
                (await retry.json()) as { denseIndexReady?: unknown }
              ).denseIndexReady;
            } catch {
              // keep the last value; the loop retries or falls through
            }
          }
        }
        if (dense === true) {
          ok(
            "GET /legomena/api/healthz → denseIndexReady=true (semantic " +
              "search index and embedding model are loaded)",
          );
        } else {
          fail(
            `GET /legomena/api/healthz → denseIndexReady=${String(dense)} even ` +
              `after ${(DENSE_RETRIES * DENSE_RETRY_DELAY_MS) / 1000}s — Ask/semantic ` +
              `search is degraded to sparse-only for readers. The embedding ` +
              `model likely failed to load: check the Legomena service log, ` +
              `and verify the model cache exists where LEGOMENA_MODEL_CACHE ` +
              `points (or in the bundle's default legomena/data/models dir) — ` +
              `a first boot without network access cannot download it`,
          );
        }

        // Stale-data probe: a working service can still be loading an OLD
        // legomena/data upload. Compare the served triple count and the
        // dataset manifest rows against the local dataset the fresh bundle
        // ships (artifacts/legomena-api/data/manifest.json — the freshness
        // gate above already proved the local zip was built from it).
        const manifestPath = path.join(
          repoRoot,
          "artifacts",
          "legomena-api",
          "data",
          "manifest.json",
        );
        const localManifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
          generatedAt?: string;
          files?: Array<{
            name?: string;
            sha256?: string;
            bytes?: number;
            quads?: number;
          }>;
        };
        const localFiles = localManifest.files ?? [];
        const expectedQuads = localFiles.reduce(
          (sum, f) => sum + (typeof f.quads === "number" ? f.quads : 0),
          0,
        );
        if (localFiles.length === 0 || expectedQuads === 0) {
          fail(
            `local ${path.relative(repoRoot, manifestPath)} lists no dataset ` +
              `files/quads — the Legomena stale-data positive control is broken`,
          );
        } else {
          // The store deduplicates quads shared between the .ttl files, so
          // the served tripleCount is slightly BELOW the manifest sum; an
          // exact-sum equality would false-fail on a perfectly fresh
          // deployment. Sanity-bound it instead (positive, no larger than
          // the sum, at least the largest single file) — the exact stale
          // detection is the per-file sha256 row comparison below.
          const servedCount = (parsed as { tripleCount?: unknown }).tripleCount;
          const largestFile = Math.max(
            ...localFiles.map((f) => (typeof f.quads === "number" ? f.quads : 0)),
          );
          if (
            typeof servedCount !== "number" ||
            servedCount < largestFile ||
            servedCount > expectedQuads
          ) {
            fail(
              `GET /legomena/api/healthz → tripleCount=${String(servedCount)} is outside ` +
                `the plausible range [${largestFile}, ${expectedQuads}] implied by the ` +
                `local dataset manifest — the live Legomena service is loading a ` +
                `STALE or partial legomena/data upload`,
            );
          } else {
            ok(
              `GET /legomena/api/healthz → tripleCount=${servedCount} is consistent ` +
                `with the local dataset manifest (sum ${expectedQuads} minus ` +
                `cross-file duplicates)`,
            );
          }

          // Exact per-file fingerprint via /dataset/stats: name, sha256,
          // bytes, triples. Catches a partial upload (one .ttl replaced,
          // another stale) even if the total quad count happens to match.
          const stats = await probe("/legomena/api/dataset/stats");
          if (stats) {
            if (stats.status !== 200) {
              fail(
                `GET /legomena/api/dataset/stats → ${stats.status} (expected 200)`,
              );
            } else {
              const body = (await stats.json()) as {
                generatedAt?: unknown;
                files?: Array<Record<string, unknown>>;
              };
              const rowOf = (
                name: unknown,
                sha256: unknown,
                bytes: unknown,
                triples: unknown,
              ) => JSON.stringify([name ?? null, sha256 ?? null, bytes ?? null, triples ?? null]);
              const expectedRows = new Set(
                localFiles.map((f) => rowOf(f.name, f.sha256, f.bytes, f.quads)),
              );
              const servedRows = new Set(
                (body.files ?? []).map((f) =>
                  rowOf(f["name"], f["sha256"], f["bytes"], f["triples"]),
                ),
              );
              const missing = [...expectedRows].filter((r) => !servedRows.has(r));
              const extra = [...servedRows].filter((r) => !expectedRows.has(r));
              if (missing.length === 0 && extra.length === 0) {
                ok(
                  `GET /legomena/api/dataset/stats: all ${expectedRows.size} dataset ` +
                    `file rows [name, sha256, bytes, triples] match the local manifest`,
                );
              } else {
                fail(
                  `GET /legomena/api/dataset/stats: dataset file rows differ from the ` +
                    `local manifest — a stale (or partial) legomena/data upload:\n` +
                    [
                      ...missing.map((r) => `live site is missing (expected): ${r}`),
                      ...extra.map((r) => `live site serves (not in source): ${r}`),
                    ]
                      .map((d) => `      ${d}`)
                      .join("\n"),
                );
              }
            }
          }
        }
      }
    }
  }

  // 5. Security headers & rate-limit identity, as seen by a real external
  // client THROUGH the IONOS front end (which could strip or override the
  // app's own headers, or mishandle X-Forwarded-For and break per-IP rate
  // limiting). Probes BOTH surfaces — /api and the Legomena companion's
  // /legomena/api, each behind its own nginx location whose
  // proxy_set_header lines could independently be missing. Runs LAST: it
  // deliberately exhausts this client's /api/ask and /legomena/api/ask
  // windows, so any later Ask probe in this process would see 429s.
  console.log("\nSecurity headers & rate limits (through the front-end proxy):");
  await runLiveSecurityChecks(BASE, {
    ok,
    fail,
    log: (msg) => console.log(msg),
  });

  console.log("");
  if (failures > 0) {
    console.error(
      `LIVE CHECK FAILED: ${failures} problem(s) — the live site does NOT ` +
        `look like it is serving the freshly built bundle. See above.`,
    );
    process.exit(1);
  }
  console.log(
    "LIVE CHECK PASSED: the live site is serving the freshly built bundle.",
  );
}

main().catch((err) => {
  console.error(String(err instanceof Error ? (err.stack ?? err.message) : err));
  process.exit(1);
});
