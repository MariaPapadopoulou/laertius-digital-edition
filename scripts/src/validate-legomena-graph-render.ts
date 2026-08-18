/**
 * Legomena network view render-count guard: the SVG the GraphView
 * component actually renders must contain exactly one node circle per
 * payload node and one visible edge line per payload edge served by
 * GET /legomena/api/graph.
 *
 * Why: graph-view.tsx joins edges to nodes by URI (byUri.get(e.fromUri))
 * and silently skips any edge whose endpoint URI does not match a node -
 * a renamed slug or a new entity kind would keep the edge in the Edge
 * Registry tables while the line quietly disappears from the picture.
 *
 * How: the real derived payload (same code path routes.ts serves) is fed
 * through the real component via Vite SSR + renderToStaticMarkup, and the
 * data-testid="graph-node" / data-testid="graph-edge" occurrences in the
 * markup are compared against nodes.length / edges.length. A negative
 * control re-renders with one edge endpoint URI deliberately mangled and
 * requires the check to detect the dropped line, so the guard can never
 * pass vacuously.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-legomena-graph-render
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const laertiusDir = path.resolve(import.meta.dirname, "../../artifacts/laertius");
const laertiusRequire = createRequire(path.join(laertiusDir, "package.json"));

let failures = 0;
function fail(msg: string): void {
  failures += 1;
  console.error(`  ✗ ${msg}`);
}

function countTestId(html: string, id: string): number {
  return html.split(`data-testid="${id}"`).length - 1;
}

async function main(): Promise<void> {
  // ---- real payload, same derivation routes.ts serves ---------------------
  const { initStore, getStore } = await import(
    "../../artifacts/legomena-api/src/store"
  );
  const { buildModel } = await import("../../artifacts/legomena-api/src/model");
  const { deriveGraph } = await import("../../artifacts/legomena-api/src/derive");
  initStore();
  const model = buildModel(getStore());
  const { nodes, edges } = deriveGraph(getStore(), model);

  // ---- load the real component through Vite SSR (resolves "@/" alias) -----
  // The laertius vite config demands PORT/BASE_PATH in serve mode and its
  // node_modules/.vite-temp is a symlink into /tmp that must exist.
  mkdirSync("/tmp/vite-laertius-temp", { recursive: true });
  process.env["PORT"] ??= "5199";
  process.env["BASE_PATH"] ??= "/";

  const viteUrl = pathToFileURL(laertiusRequire.resolve("vite")).href;
  const { createServer } = (await import(viteUrl)) as {
    createServer: (opts: object) => Promise<{
      ssrLoadModule: (id: string) => Promise<Record<string, unknown>>;
      close: () => Promise<void>;
    }>;
  };
  const server = await createServer({
    configFile: path.join(laertiusDir, "vite.config.ts"),
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });

  try {
    const reactUrl = pathToFileURL(laertiusRequire.resolve("react")).href;
    const domUrl = pathToFileURL(
      laertiusRequire.resolve("react-dom/server"),
    ).href;
    const React = ((await import(reactUrl)) as any).default ??
      ((await import(reactUrl)) as any);
    const { renderToStaticMarkup } = (await import(domUrl)) as any;
    const wouterMod = (await server.ssrLoadModule("wouter")) as any;
    const Router = wouterMod.Router;
    const { GraphView } = (await server.ssrLoadModule(
      "/src/components/legomena/graph-view.tsx",
    )) as any;

    const render = (ns: unknown[], es: unknown[]): string =>
      renderToStaticMarkup(
        React.createElement(
          Router,
          { ssrPath: "/legomena/graph" },
          React.createElement(GraphView, { nodes: ns, edges: es }),
        ),
      );

    // ---- positive check: rendered counts == payload counts ----------------
    const html = render(nodes, edges);
    const circleCount = countTestId(html, "graph-node");
    const lineCount = countTestId(html, "graph-edge");
    if (circleCount !== nodes.length)
      fail(
        `rendered ${circleCount} node circles but the /legomena/api/graph payload has ${nodes.length} nodes - a philosopher was silently dropped from the SVG`,
      );
    if (lineCount !== edges.length)
      fail(
        `rendered ${lineCount} edge lines but the /legomena/api/graph payload has ${edges.length} edges - a relation was silently dropped from the SVG (edge endpoint URI no longer matches any node URI)`,
      );
    for (const e of edges) {
      const nodeUris = new Set(nodes.map((n: any) => n.uri));
      if (!nodeUris.has(e.fromUri))
        fail(`edge ${e.from} -> ${e.to}: fromUri ${e.fromUri} matches no node`);
      if (!nodeUris.has(e.toUri))
        fail(`edge ${e.from} -> ${e.to}: toUri ${e.toUri} matches no node`);
    }

    // ---- vacuity guards ----------------------------------------------------
    if (nodes.length < 50)
      fail(`payload has only ${nodes.length} nodes - wrong source?`);
    if (edges.length < 50)
      fail(`payload has only ${edges.length} edges - wrong source?`);

    // ---- negative control: a deliberate URI mismatch must be caught -------
    const broken = edges.map((e, i) =>
      i === 0 ? { ...e, fromUri: `${e.fromUri}-DELIBERATE-MISMATCH` } : e,
    );
    const brokenHtml = render(nodes, broken);
    const brokenLines = countTestId(brokenHtml, "graph-edge");
    if (brokenLines !== edges.length - 1)
      fail(
        `negative control: mangling one edge endpoint URI should drop exactly one rendered line (expected ${edges.length - 1}, got ${brokenLines}) - the render-count comparison has lost its teeth`,
      );
    else if (brokenLines === countTestId(html, "graph-edge"))
      fail(
        "negative control: mangled payload rendered the same line count as the real payload",
      );

    if (failures > 0) {
      console.error(
        `validate-legomena-graph-render: FAILED (${failures} failures)`,
      );
      process.exitCode = 1;
      return;
    }
    console.log(
      `✓ Network view renders every payload element: ${circleCount}/${nodes.length} node circles, ${lineCount}/${edges.length} edge lines; negative control (mangled endpoint URI) correctly dropped to ${brokenLines} lines and would fail the check`,
    );
  } finally {
    await server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
