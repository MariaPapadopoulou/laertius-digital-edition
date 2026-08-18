/**
 * Real-browser check that the bundled Legomena app works end-to-end.
 *
 * The bundle smoke test (smoke-ionos-bundle.ts smokeLegomena) boots the
 * Legomena server and curls /legomena/api/healthz, /api/graph, /api/ask
 * and the SPA fallback, but it never executes the built frontend. A Vite
 * base-path or fetch-prefix regression (assets built without
 * BASE_PATH=/legomena/, or the generated api client calling /api instead
 * of /legomena/api) would pass every curl check while readers see a blank
 * page. This script closes that gap:
 *
 * 1. Extracts exports/laertius-ionos.zip to a scratch dir and boots
 *    legomena/server/index.mjs exactly the way IONOS would (PORT,
 *    SERVE_STATIC_DIR, LEGOMENA_MODEL_CACHE), with the same node_modules
 *    symlink the smoke test uses for the esbuild externals.
 * 2. Drives headless Chromium through the built SPA:
 *    - /legomena/ (Ask page): the h1 renders, the built JS/CSS assets
 *      load from under /legomena/, and the layout's health check hits
 *      /legomena/api/* successfully.
 *    - Submits a real question through the Ask form and waits for cited
 *      passages to render (POST /legomena/api/ask through the built
 *      frontend, exercising the embedder).
 *    - /legomena/graph as a DEEP LINK (fresh page load, exercising the
 *      SPA fallback + router base): the Assertion Graph header renders
 *      with a positive node/edge count from /legomena/api/graph.
 *    - /legomena/entities: the Index of Entities renders at least one
 *      entity link.
 *    - /legomena/reader: the Passage Index renders at least one passage
 *      link; clicking one opens the passage detail (/legomena/reader/:id),
 *      which fetches /legomena/api/sections/{id} and renders the citation
 *      heading, non-empty Greek text, stand-off annotation entity links,
 *      and the Cited Assertions pane.
 *    - /legomena/sparql: the SPARQL page renders; running the
 *      prefilled query returns results through /legomena/api/*.
 * 3. Throughout, any page error, failed request, or response with status
 *    >= 400 (a console 404 for a mis-prefixed asset or API call) fails
 *    the run.
 *
 * Requirements: exports/laertius-ionos.zip must exist (run
 * build-ionos-bundle first), and the playwright-core headless Chromium
 * shell must be installed once:
 *   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
 *     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell
 *
 * Run: pnpm --filter @workspace/scripts run e2e-ionos-legomena
 *
 * Registered in the validation gate (2026-08-05 triage); it needs the zip
 * (kept fresh by check-bundle-freshness) and a real browser. Also run it
 * manually after touching the legomena frontend, its vite config, the
 * generated legomena api client, or rebuilding the bundle.
 */
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { createServer } from "node:net";
import { createServer as createHttpServer, type Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkBundleFreshness } from "./ionos-bundle-contract";

// playwright-core resolves its browser registry at module import time from
// PLAYWRIGHT_BROWSERS_PATH; set it BEFORE importing playwright-core.
import "./lib/playwright-browsers-path";
import { PAGE_HEADING_SELECTOR } from "./lib/card-headings";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");
type Page = Awaited<
  ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>
>;

const scriptsDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(scriptsDir);
const apiServerDir = path.join(repoRoot, "artifacts", "api-server");
const zipPath =
  process.argv[2] ?? path.join(repoRoot, "exports", "laertius-ionos.zip");

const HEALTH_TIMEOUT_MS = 120_000;
const ASK_TIMEOUT_MS = 180_000;

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      if (address === null || typeof address === "string") {
        srv.close();
        reject(new Error("Could not determine a free port"));
        return;
      }
      const port = address.port;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

async function waitForHealth(base: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `Legomena server exited early with code ${child.exitCode}`,
      );
    }
    try {
      const res = await fetch(`${base}/legomena/api/healthz`);
      if (res.status === 200) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(
    `Legomena server did not answer /legomena/api/healthz within ${HEALTH_TIMEOUT_MS / 1000}s`,
  );
}

async function waitForMainHealth(
  base: string,
  child: ChildProcess,
): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Main server exited early with code ${child.exitCode}`);
    }
    try {
      const res = await fetch(`${base}/api/healthz`);
      if (res.status === 200) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(
    `Main server did not answer /api/healthz within ${HEALTH_TIMEOUT_MS / 1000}s`,
  );
}

function stopServer(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null) {
      resolve();
      return;
    }
    const killTimer = setTimeout(() => child.kill("SIGKILL"), 5000);
    child.once("exit", () => {
      clearTimeout(killTimer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

/**
 * Per-page network/error tracker. Failed requests and >=400 responses are
 * collected globally; successful /legomena/api and /legomena/assets
 * requests are counted so we can assert the built frontend really talks
 * to the API under the /legomena prefix.
 */
function trackPage(page: Page) {
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const okApiUrls: string[] = [];
  const okAssetUrls: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("requestfailed", (req) => {
    failedRequests.push(`${req.url()} (${req.failure()?.errorText ?? "?"})`);
  });
  page.on("response", (res) => {
    const url = res.url();
    if (res.status() >= 400) {
      failedRequests.push(`${url} (HTTP ${res.status()})`);
    } else if (url.includes("/legomena/api/")) {
      okApiUrls.push(url);
    } else if (/\.(js|css)(\?|$)/.test(url)) {
      okAssetUrls.push(url);
    }
  });
  return { pageErrors, failedRequests, okApiUrls, okAssetUrls };
}

async function main() {
  if (!existsSync(zipPath)) {
    throw new Error(
      `Bundle not found: ${zipPath} (run build-ionos-bundle first)`,
    );
  }

  // Fail fast on an outdated bundle BEFORE extracting the zip or launching
  // a browser: a stale zip produces confusing symptoms (404 instead of the
  // Ask page) that look like real regressions. Same content-hash check as
  // the check-bundle-freshness validator.
  {
    const { error, notes } = checkBundleFreshness(repoRoot, zipPath);
    for (const note of notes) console.log(note);
    if (error) {
      throw new Error(
        `Refusing to run the browser e2e against an outdated bundle.\n${error}`,
      );
    }
  }

  const scratchDir = path.join(repoRoot, "exports", ".ionos-e2e-legomena");
  rmSync(scratchDir, { recursive: true, force: true });
  mkdirSync(scratchDir, { recursive: true });

  let child: ChildProcess | undefined;
  let mainChild: ChildProcess | undefined;
  let proxy: Server | undefined;
  try {
    console.log(`Booting Legomena from bundle: ${zipPath}`);
    execFileSync("unzip", ["-q", zipPath, "-d", scratchDir]);

    // Same symlink the smoke test uses: the esbuild externals
    // (@huggingface/transformers, oxigraph) resolve by walking up from
    // legomena/server/ to the scratch root's node_modules.
    symlinkSync(
      path.join(apiServerDir, "node_modules"),
      path.join(scratchDir, "node_modules"),
      "dir",
    );

    // The Legomena frontend is merged into the laertius SPA (public/), so
    // production routing sends /legomena/api to the Legomena server and
    // every other path (including /legomena/* pages) to the main server.
    // Reproduce that here: boot both servers plus a tiny routing proxy.
    const legomenaDir = path.join(scratchDir, "legomena");
    const modelsDir = path.join(apiServerDir, "data", "models");
    if (existsSync(modelsDir)) {
      symlinkSync(modelsDir, path.join(scratchDir, "data", "models"), "dir");
    }

    const legomenaPort = await findFreePort();
    const legomenaBase = `http://127.0.0.1:${legomenaPort}`;
    child = spawn("node", ["server/index.mjs"], {
      cwd: legomenaDir,
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(legomenaPort),
        ...(existsSync(modelsDir) ? { LEGOMENA_MODEL_CACHE: modelsDir } : {}),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let serverOutput = "";
    child.stdout?.on("data", (c: Buffer) => (serverOutput += c.toString()));
    child.stderr?.on("data", (c: Buffer) => (serverOutput += c.toString()));

    const mainPort = await findFreePort();
    mainChild = spawn("node", ["server/index.mjs"], {
      cwd: scratchDir,
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(mainPort),
        LAERTIUS_DATA_DIR: path.join(scratchDir, "data"),
        SERVE_STATIC_DIR: path.join(scratchDir, "public"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let mainOutput = "";
    mainChild.stdout?.on("data", (c: Buffer) => (mainOutput += c.toString()));
    mainChild.stderr?.on("data", (c: Buffer) => (mainOutput += c.toString()));

    const proxyPort = await findFreePort();
    const base = `http://127.0.0.1:${proxyPort}`;
    proxy = createHttpServer(async (req, res) => {
      const target = req.url?.startsWith("/legomena/api")
        ? legomenaBase
        : `http://127.0.0.1:${mainPort}`;
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const upstream = await fetch(`${target}${req.url}`, {
          method: req.method,
          headers: Object.fromEntries(
            Object.entries(req.headers).filter(
              ([k, v]) => typeof v === "string" && k !== "host",
            ) as [string, string][],
          ),
          body: ["GET", "HEAD"].includes(req.method ?? "GET")
            ? undefined
            : Buffer.concat(chunks),
          redirect: "manual",
        });
        const headers: Record<string, string> = {};
        upstream.headers.forEach((v, k) => {
          if (!["content-encoding", "transfer-encoding"].includes(k)) {
            headers[k] = v;
          }
        });
        const body = Buffer.from(await upstream.arrayBuffer());
        res.writeHead(upstream.status, headers);
        res.end(body);
      } catch (err) {
        res.writeHead(502);
        res.end(String(err));
      }
    });
    await new Promise<void>((resolve) =>
      proxy!.listen(proxyPort, "127.0.0.1", resolve),
    );

    try {
      await waitForHealth(legomenaBase, child);
      console.log(`Legomena API server is up at ${legomenaBase}`);
      await waitForMainHealth(`http://127.0.0.1:${mainPort}`, mainChild);
      console.log(
        `Main server is up at http://127.0.0.1:${mainPort}; proxy at ${base}\n`,
      );
      await runBrowserChecks(base);
    } catch (err) {
      if (serverOutput.trim().length > 0) {
        console.error("\n--- legomena server output ---");
        console.error(serverOutput.slice(-4000));
        console.error("--- end legomena server output ---");
      }
      if (mainOutput.trim().length > 0) {
        console.error("\n--- main server output ---");
        console.error(mainOutput.slice(-4000));
        console.error("--- end main server output ---");
      }
      throw err;
    }
  } finally {
    if (proxy) await new Promise((r) => proxy!.close(r));
    if (child) await stopServer(child);
    if (mainChild) await stopServer(mainChild);
    rmSync(scratchDir, { recursive: true, force: true });
  }

  if (failures > 0) {
    throw new Error(`${failures} check(s) failed`);
  }
  console.log(
    "\nThe bundled Legomena app renders and talks to /legomena/api in a real browser.",
  );
}

async function runBrowserChecks(base: string): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    // Fail fast with the failing URL/status instead of an opaque selector
    // timeout when the bundled site itself fails to boot.
    const guard = attachPageGuard(page);
    const tracked = trackPage(page);

    console.log("Scenario 1: /legomena/ renders the Ask page");
    await page.goto(`${base}/legomena/`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    const askH1 = await page
      .locator('h1:has-text("Interrogate the Assertions")')
      .first()
      .isVisible()
      .catch(() => false);
    check("Ask page h1 renders", askH1);
    check(
      "built JS/CSS assets of the merged SPA load",
      tracked.okAssetUrls.length > 0,
      "no *.js|css responses seen — broken static serving?",
    );
    check(
      "frontend calls the API under /legomena/api",
      tracked.okApiUrls.length > 0,
      "no successful /legomena/api/* request observed",
    );

    console.log("Scenario 2: Ask form round-trips through /legomena/api/ask");
    const askBox = 'input[placeholder^="e.g. Who did Zeno"]';
    await guard.guarded(page.waitForSelector(askBox, { timeout: 10_000 }));
    await page.fill(askBox, "Who founded the Stoic school?");
    const askResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/legomena/api/ask") &&
        res.request().method() === "POST",
      { timeout: ASK_TIMEOUT_MS },
    );
    await page.click('form button[type="submit"]');
    const askRes = await askResponse;
    check(
      "POST /legomena/api/ask → 200",
      askRes.status() === 200,
      `status=${askRes.status()}`,
    );
    const askJson = (await askRes.json().catch(() => null)) as {
      passages?: unknown[];
    } | null;
    check(
      "ask returned ranked passages",
      Array.isArray(askJson?.passages) && askJson.passages.length > 0,
    );
    // The answer section renders after the mutation resolves.
    await page.waitForTimeout(1000);
    const answerVisible = await page
      .locator("text=Failed to interrogate the store")
      .first()
      .isVisible()
      .catch(() => false);
    check("no error banner after asking", !answerVisible);

    console.log("Scenario 3: deep link /legomena/graph renders the graph");
    await page.goto(`${base}/legomena/graph`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    const graphH1 = page.locator('h1:has-text("Assertion Graph")').first();
    await guard.guarded(
      graphH1.waitFor({ timeout: 30_000 }).catch(() => undefined),
    );
    check("Assertion Graph h1 renders on a fresh deep link", await graphH1.isVisible().catch(() => false));
    const countsText = await page
      .locator("text=derived edges")
      .first()
      .textContent()
      .catch(() => null);
    const counts = /(\d+)\s*nodes\s*·\s*(\d+)\s*derived edges/.exec(
      countsText ?? "",
    );
    check(
      "graph shows positive node and edge counts",
      !!counts && Number(counts[1]) > 0 && Number(counts[2]) > 0,
      `text=${JSON.stringify(countsText)}`,
    );
    // The server-side render validator (validate-legomena-graph-render)
    // proves GraphView emits one circle per node and one line per edge,
    // but only against a synthetic render. Count the hydrated SVG
    // elements in the real browser against the live /legomena/api/graph
    // payload to catch a hydration or client-only rendering difference.
    const graphPayload = (await fetch(`${base}/legomena/api/graph`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)) as {
      nodes?: unknown[];
      edges?: unknown[];
    } | null;
    const payloadNodes = graphPayload?.nodes?.length ?? -1;
    const payloadEdges = graphPayload?.edges?.length ?? -1;
    check(
      "/legomena/api/graph payload has nodes and edges",
      payloadNodes > 0 && payloadEdges > 0,
      `nodes=${payloadNodes} edges=${payloadEdges}`,
    );
    // Wait for the SVG to reach the expected counts (hydration timing),
    // then assert exact equality.
    await page
      .waitForFunction(
        ({ n, e }) =>
          document.querySelectorAll('[data-testid="graph-node"]').length ===
            n &&
          document.querySelectorAll('[data-testid="graph-edge"]').length === e,
        { n: payloadNodes, e: payloadEdges },
        { timeout: 30_000 },
      )
      .catch(() => null);
    const renderedNodes = await page
      .locator('[data-testid="graph-node"]')
      .count();
    const renderedEdges = await page
      .locator('[data-testid="graph-edge"]')
      .count();
    check(
      "rendered SVG has exactly one circle per payload node",
      payloadNodes > 0 && renderedNodes === payloadNodes,
      `rendered=${renderedNodes} payload=${payloadNodes}`,
    );
    check(
      "rendered SVG has exactly one line per payload edge",
      payloadEdges > 0 && renderedEdges === payloadEdges,
      `rendered=${renderedEdges} payload=${payloadEdges}`,
    );

    console.log("Scenario 4: /legomena/entities renders the entity index");
    await page.goto(`${base}/legomena/entities`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    const entH1 = page.locator('h1:has-text("Index of Entities")').first();
    await guard.guarded(
      entH1.waitFor({ timeout: 30_000 }).catch(() => undefined),
    );
    check("Index of Entities h1 renders", await entH1.isVisible().catch(() => false));
    // The rows are clickable spans (setLocation), not anchors; wait for
    // the list to render, then click the first row and assert the SPA
    // navigates to the entity detail under the /legomena base.
    const entityRow = "ul li span.cursor-pointer";
    await page
      .waitForSelector(entityRow, { timeout: 30_000 })
      .catch(() => null);
    const entityRowCount = await page.locator(entityRow).count();
    check(
      "at least one entity row renders",
      entityRowCount > 0,
      `count=${entityRowCount}`,
    );
    if (entityRowCount > 0) {
      const firstRow = page.locator(entityRow).first();
      const rowLabel = ((await firstRow.textContent()) ?? "").trim();
      const entityDetailResponse = page.waitForResponse(
        (res) =>
          res.url().includes("/legomena/api/entity") && res.status() === 200,
        { timeout: 30_000 },
      );
      await firstRow.click();
      await page
        .waitForFunction(
          () => window.location.pathname === "/legomena/entity",
          undefined,
          { timeout: 10_000 },
        )
        .catch(() => null);
      const entityPath = await page.evaluate(
        () => window.location.pathname + window.location.search,
      );
      check(
        "clicking an entity row opens /legomena/entity?uri=…",
        entityPath.startsWith("/legomena/entity?uri="),
        `location=${entityPath}`,
      );

      // The detail page parses ?uri= via useSearch() (wouter's useLocation
      // strips query strings) and fetches /legomena/api/entity. Verify the
      // page really renders: API 200, the label heading, and at least one
      // assertion/mention card or passage citation.
      const detailRes = await entityDetailResponse.catch(() => null);
      check(
        "entity detail fetches /legomena/api/entity → 200",
        detailRes !== null,
        "no successful /legomena/api/entity response observed",
      );
      // The layout renders a site-header h1 ("Legomena"); the entity's own
      // label heading is the h1 containing the clicked row's label.
      const detailH1 = page.locator(`h1:has-text(${JSON.stringify(rowLabel)})`).first();
      await detailH1.waitFor({ timeout: 30_000 }).catch(() => undefined);
      check(
        "entity label heading renders",
        rowLabel.length > 0 &&
          (await detailH1.isVisible().catch(() => false)),
        `no h1 containing row label ${JSON.stringify(rowLabel)}`,
      );
      const errorScreenVisible = await page
        .locator("text=Failed to load entity detail")
        .first()
        .isVisible()
        .catch(() => false);
      check("no entity detail error screen", !errorScreenVisible);
      // Assertion/mention cards render under "Assertions about"/"Mentions of"
      // sections; each card links its cited passage to /legomena/reader/…
      const assertionSectionCount = await page
        .locator('h2:has-text("Assertions about"), h2:has-text("Mentions of")')
        .count();
      const citationLinkCount = await page
        .locator('a[href*="/legomena/reader/"]')
        .count();
      check(
        "at least one assertion/mention with a passage citation renders",
        assertionSectionCount > 0 && citationLinkCount > 0,
        `sections=${assertionSectionCount} citationLinks=${citationLinkCount}`,
      );
    }

    console.log("Scenario 5: /legomena/reader renders the passage index");
    await page.goto(`${base}/legomena/reader`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    const readerH1 = page.locator('h1:has-text("Passage Index")').first();
    await guard.guarded(
      readerH1.waitFor({ timeout: 30_000 }).catch(() => undefined),
    );
    check("Passage Index h1 renders", await readerH1.isVisible().catch(() => false));
    const passageLinkCount = await page
      .locator('a[href*="/legomena/reader/"]')
      .count();
    check(
      "at least one passage link renders",
      passageLinkCount > 0,
      `count=${passageLinkCount}`,
    );

    if (passageLinkCount > 0) {
      console.log(
        "Scenario 5b: opening a passage renders its citation, text, and annotations",
      );
      // Prefer a passage card that advertises at least one annotation so we
      // can also assert the stand-off annotation layer renders as entity
      // links inside the text. Cards show "<n> Ann." in their footer.
      const passageLinks = page.locator('a[href*="/legomena/reader/"]');
      let targetIndex = 0;
      let expectAnnotations = false;
      const scanCount = Math.min(passageLinkCount, 30);
      for (let i = 0; i < scanCount; i++) {
        const annText = await passageLinks
          .nth(i)
          .locator('span[title="Annotations"]')
          .textContent()
          .catch(() => null);
        const annCount = Number(/(\d+)/.exec(annText ?? "")?.[1] ?? "0");
        if (annCount > 0) {
          targetIndex = i;
          expectAnnotations = true;
          break;
        }
      }
      const targetLink = passageLinks.nth(targetIndex);
      const targetCitation = (
        (await targetLink
          .locator("span.font-medium")
          .first()
          .textContent()
          .catch(() => null)) ?? ""
      ).trim();
      const passageResponse = page.waitForResponse(
        (res) =>
          res.url().includes("/legomena/api/sections/") &&
          res.request().method() === "GET",
        { timeout: 30_000 },
      );
      await targetLink.click();
      const passageRes = await passageResponse.catch(() => null);
      check(
        "passage detail fetches /legomena/api/sections/{id} → 200",
        passageRes !== null && passageRes.status() === 200,
        passageRes
          ? `${passageRes.url()} status=${passageRes.status()}`
          : "no /legomena/api/sections/ response observed",
      );
      // The detail header's h1 is the passage citation (e.g. "D.L. 7.1").
      const citationH1 = page
        .locator(`h1:has-text(${JSON.stringify(targetCitation)})`)
        .first();
      await citationH1.waitFor({ timeout: 30_000 }).catch(() => undefined);
      check(
        "passage citation heading renders",
        targetCitation.length > 0 &&
          (await citationH1.isVisible().catch(() => false)),
        `no h1 containing citation ${JSON.stringify(targetCitation)}`,
      );
      const passageErrorVisible = await page
        .locator("text=Failed to load passage")
        .first()
        .isVisible()
        .catch(() => false);
      check("no passage error screen", !passageErrorVisible);
      // The Greek Text section renders the stored text literal.
      const greekHeading = page.locator('h2:has-text("Greek Text")').first();
      check(
        "Greek Text section renders",
        await greekHeading.isVisible().catch(() => false),
      );
      const greekTextLen = await page
        .evaluate((sel) => {
          const h2s = Array.from(document.querySelectorAll(sel));
          const h2 = h2s.find((el) =>
            (el.textContent ?? "").includes("Greek Text"),
          );
          const section = h2?.closest("section");
          const body = section?.textContent ?? "";
          return body.replace("Greek Text", "").trim().length;
        }, PAGE_HEADING_SELECTOR)
        .catch(() => 0);
      check(
        "passage Greek text content is non-empty",
        greekTextLen > 20,
        `text length=${greekTextLen}`,
      );
      // Annotations render as entity links (/legomena/entity?uri=…) inside
      // the text panes when the passage has any.
      if (expectAnnotations) {
        // Scope strictly to the text sections (Greek Text / English
        // Translation), which render as <section> elements in the text
        // pane. The Cited Assertions apparatus (<aside>) also links
        // entities with the same URL shape, so an unscoped count would
        // pass even with broken in-text annotation links.
        const annotationLinkCount = await page
          .locator('section a[href*="/legomena/entity?uri="]')
          .count();
        const apparatusLinkCount = await page
          .locator('aside a[href*="/legomena/entity?uri="]')
          .count();
        check(
          "stand-off annotations render as entity links inside the text sections",
          annotationLinkCount > 0,
          `in-text annotation links=${annotationLinkCount} (apparatus links=${apparatusLinkCount}, which do not count)`,
        );
      } else {
        console.log(
          "  note: no passage with annotations found in the first cards; skipping annotation-link check",
        );
      }
      // The Cited Assertions apparatus pane renders.
      check(
        "Cited Assertions pane renders",
        await page
          .locator('h2:has-text("Cited Assertions")')
          .first()
          .isVisible()
          .catch(() => false),
      );

      console.log(
        "Scenario 5c: the next/prev chevron steps to the adjacent section",
      );
      // The passage header renders two chevron buttons (prev, next) that
      // navigate via setLocation to /legomena/reader/<prevId|nextId>. A
      // regression in prevId/nextId derivation or the setLocation base
      // path would leave readers stuck on one section while every other
      // check stays green. Click "next" (fall back to "prev" if the
      // opened passage is the last section) and assert: the URL changes
      // to a different /legomena/reader/<id>, a fresh
      // /legomena/api/sections/{id} 200 arrives, and a different citation
      // heading renders.
      const startPath = await page.evaluate(() => window.location.pathname);
      // Pin to the buttons' aria-labels: the passage header renders plain
      // text arrows (←/→) with aria-label="Previous/Next passage", and the
      // global site header also has svg-bearing buttons (theme toggle), so
      // neither an icon-class nor a bare "header button" selector is safe.
      const nextBtn = page
        .locator('header button[aria-label="Next passage"]')
        .first();
      const prevBtn = page
        .locator('header button[aria-label="Previous passage"]')
        .first();
      const nextEnabled = await nextBtn.isEnabled().catch(() => false);
      const prevEnabled = await prevBtn.isEnabled().catch(() => false);
      check(
        "a prev or next chevron is enabled on the opened passage",
        nextEnabled || prevEnabled,
        "both chevrons disabled — prevId/nextId both missing?",
      );
      if (nextEnabled || prevEnabled) {
        const stepBtn = nextEnabled ? nextBtn : prevBtn;
        const stepLabel = nextEnabled ? "next" : "prev";
        const adjacentResponse = page.waitForResponse(
          (res) =>
            res.url().includes("/legomena/api/sections/") &&
            res.request().method() === "GET" &&
            !res.url().endsWith(startPath.split("/").pop() ?? ""),
          { timeout: 30_000 },
        );
        await stepBtn.click();
        await page
          .waitForFunction(
            (prev) =>
              window.location.pathname.startsWith("/legomena/reader/") &&
              window.location.pathname !== prev,
            startPath,
            { timeout: 10_000 },
          )
          .catch(() => null);
        const steppedPath = await page.evaluate(
          () => window.location.pathname,
        );
        check(
          `clicking ${stepLabel} navigates to a different /legomena/reader/<id>`,
          steppedPath.startsWith("/legomena/reader/") &&
            steppedPath !== startPath,
          `before=${startPath} after=${steppedPath}`,
        );
        const adjacentRes = await adjacentResponse.catch(() => null);
        const steppedId = steppedPath.split("/").pop() ?? "";
        check(
          "adjacent section fetches /legomena/api/sections/{id} → 200",
          adjacentRes !== null &&
            adjacentRes.status() === 200 &&
            decodeURIComponent(adjacentRes.url()).includes(
              decodeURIComponent(steppedId),
            ),
          adjacentRes
            ? `${adjacentRes.url()} status=${adjacentRes.status()}`
            : "no fresh /legomena/api/sections/ response observed",
        );
        // A different citation heading renders (not the one we came from).
        await page
          .waitForFunction(
            (oldCitation) => {
              const h1 = Array.from(document.querySelectorAll("h1")).find(
                (el) => el.closest("header"),
              );
              const text = (h1?.textContent ?? "").trim();
              return text.length > 0 && text !== oldCitation;
            },
            targetCitation,
            { timeout: 30_000 },
          )
          .catch(() => null);
        const steppedCitation = await page
          .evaluate(() => {
            const h1 = Array.from(document.querySelectorAll("h1")).find(
              (el) => el.closest("header"),
            );
            return (h1?.textContent ?? "").trim();
          })
          .catch(() => "");
        check(
          "a different citation heading renders on the adjacent passage",
          steppedCitation.length > 0 && steppedCitation !== targetCitation,
          `before=${JSON.stringify(targetCitation)} after=${JSON.stringify(steppedCitation)}`,
        );
      }
    }

    console.log("Scenario 6: /legomena/sparql runs the prefilled query");
    await page.goto(`${base}/legomena/sparql`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    const sparqlH1 = page.locator('h1:has-text("SPARQL")').first();
    await guard.guarded(
      sparqlH1.waitFor({ timeout: 30_000 }).catch(() => undefined),
    );
    check("SPARQL Console h1 renders", await sparqlH1.isVisible().catch(() => false));
    const sparqlResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/legomena/api/") &&
        res.request().method() === "POST",
      { timeout: 60_000 },
    );
    await page.click('button:has-text("Run Query")');
    const sparqlRes = await sparqlResponse;
    check(
      "running the prefilled SPARQL query hits /legomena/api → 200",
      sparqlRes.status() === 200,
      `${sparqlRes.url()} status=${sparqlRes.status()}`,
    );

    check(
      "no page errors anywhere",
      tracked.pageErrors.length === 0,
      tracked.pageErrors.join("; "),
    );
    check(
      "no failed requests or 4xx/5xx responses (console 404s)",
      tracked.failedRequests.length === 0,
      tracked.failedRequests.join("; "),
    );
  } finally {
    await browser.close();
  }
}

await main().catch((err) => {
  console.error(
    `\nLegomena bundle e2e FAILED: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
