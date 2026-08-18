/**
 * Guards the competency panel's "View in graph" deep link
 * (pages/competency.tsx -> /graph?p=<name>).
 *
 * The panel links every focused subgraph node to the Graph page with
 * ?p=<KG node name>. The Graph page adopts ?p= into its selection state
 * and resolves the side panel by exact name equality over /api/graph
 * nodes, which are the KG nodes with their names preserved verbatim.
 * The live e2e verifies this destination for a single philosopher only,
 * so a KG rename or a change in the Graph page's param handling could
 * silently break shared links for every other philosopher.
 *
 * This validator pins, source-level and without live servers:
 *  1. every KG node name (the superset of all possible competency
 *     subgraph nodes: the route only admits SPARQL row values that are
 *     KG nodes) is non-empty, survives the exact URL round trip the two
 *     pages perform (encodeURIComponent on write, URLSearchParams.get
 *     on read), and selects exactly one node under the Graph page's
 *     name-equality lookup;
 *  2. the API route serves the KG nodes with names untouched (spread),
 *     so the in-memory KG walked here is the same node-name set the
 *     Graph page resolves against;
 *  3. the wiring: competency.tsx builds the link as
 *     /graph?p=${encodeURIComponent(name)}; graph.tsx seeds and syncs
 *     its selection from the ?p= parameter, resolves the panel with
 *     nodes.find by name equality, and gives the node panel precedence
 *     over the associate panel.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-competency-graph-links
 */
import { readFileSync } from "node:fs";
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getKnowledgeGraph } = await import(
  "../../artifacts/api-server/src/lib/kg"
);

const laertiusSrc = path.resolve(
  import.meta.dirname,
  "../../artifacts/laertius/src",
);
const apiServerSrc = path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/src",
);

let failures = 0;
function check(label: string, ok: boolean) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}`);
  }
}

const graph = getKnowledgeGraph();
const kgNames = graph.nodes.map((n) => n.name);

// Positive control: an empty graph would make the per-name loop below
// vacuously green.
console.log(`Inputs: ${kgNames.length} KG nodes`);
check("knowledge graph has nodes", kgNames.length > 0);

// 1. Every KG node name survives the URL round trip and selects exactly
// one node the way the Graph page does. The panel writes the link with
// encodeURIComponent; the Graph page reads it back with
// URLSearchParams.get("p") and treats a falsy value as "nothing
// selected", then resolves nodes.find((n) => n.name === selected).
function roundTripLikePages(name: string): string | null {
  const p = new URLSearchParams(`p=${encodeURIComponent(name)}`).get("p");
  return p || null;
}

const nameCounts = new Map<string, number>();
for (const name of kgNames) {
  nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
}

console.log("Graph ?p= resolution for every possible subgraph node:");
const broken: string[] = [];
for (const name of kgNames) {
  const p = roundTripLikePages(name);
  if (p === null) {
    broken.push(`${name} (dropped as falsy ?p=)`);
    continue;
  }
  const matches = graph.nodes.filter((n) => n.name === p);
  if (matches.length !== 1) {
    broken.push(`${name} -> ${matches.length} node matches`);
  }
}
check(
  "every KG node name round-trips through ?p= and selects exactly one node" +
    (broken.length ? ` (broken: ${broken.join("; ")})` : ""),
  broken.length === 0,
);
check(
  "KG node names are unique" +
    (Math.max(...nameCounts.values()) > 1
      ? ` (duplicates: ${[...nameCounts]
          .filter(([, c]) => c > 1)
          .map(([n]) => n)
          .join(", ")})`
      : ""),
  Math.max(...nameCounts.values()) === 1,
);

// Negative control: the resolution must not fabricate matches.
check(
  "resolution finds nothing for a name absent from the graph",
  graph.nodes.find(
    (n) => n.name === "Nobody of Nowhere \u2014 not a real node",
  ) === undefined,
);

// 2. The API route must keep serving the KG nodes with names untouched,
// otherwise the in-memory names checked above are not what the Graph
// page compares against.
console.log("Wiring:");
const routeSource = readFileSync(
  path.join(apiServerSrc, "routes/graph.ts"),
  "utf8",
);
check(
  "routes/graph.ts serves getKnowledgeGraph() nodes with names preserved (spread)",
  /nodes: g\.nodes\.map\(\(n\) => \{[\s\S]*?return \{\s*\n\s*\.\.\.n,/.test(
    routeSource,
  ) && routeSource.includes('import { getKnowledgeGraph } from "../lib/kg"'),
);

// 3. Frontend wiring pins: the pages must keep building and resolving
// the link this way, otherwise the invariant above no longer covers the
// real code path.
const competencySource = readFileSync(
  path.join(laertiusSrc, "pages/competency.tsx"),
  "utf8",
);
check(
  "competency.tsx builds the graph link as /graph?p=${encodeURIComponent(name)}",
  competencySource.includes("`/graph?p=${encodeURIComponent(name)}`"),
);

// The smaller people chips (participants, teachers, etc.) also deep-link
// with /graph?p=<entity display name>, and those names are NOT guaranteed
// to be KG nodes or Graph associates. The chosen behavior: the Graph page
// must show a friendly unknown-?p= notice (with an Index escape hatch)
// instead of a silently empty page, and the Index must honour the ?q=
// seed that notice links to.
check(
  "competency.tsx people chips link with /graph?p=${encodeURIComponent(t.en)}",
  competencySource.includes("`/graph?p=${encodeURIComponent(t.en)}`"),
);

const graphSource = readFileSync(path.join(laertiusSrc, "pages/graph.tsx"), "utf8");
check(
  "graph.tsx shows the unknown-?p= notice when the name matches no node or associate (selected branch after selectedNode/selectedAssociate)",
  /\) : selectedAssociate \? \([\s\S]*?\) : selected \? \([\s\S]*?No one in the graph is named/.test(
    graphSource,
  ),
);
check(
  "graph.tsx unknown-?p= notice can be dismissed (setSelected(null), which also drops ?p= via the URL sync)",
  /No one in the graph is named[\s\S]{0,800}onClick=\{\(\) => setSelected\(null\)\}/.test(
    graphSource,
  ),
);
check(
  "graph.tsx unknown-?p= notice links to the Index pre-filtered by the name",
  /No one in the graph is named[\s\S]{0,1600}\/entities\?q=\$\{encodeURIComponent\(selected\)\}/.test(
    graphSource,
  ),
);
const entitiesSource = readFileSync(
  path.join(laertiusSrc, "pages/entities.tsx"),
  "utf8",
);
check(
  "entities.tsx seeds its filter box from the ?q= parameter",
  /useState\(\s*\n?\s*\(\) => new URLSearchParams\(window\.location\.search\)\.get\("q"\) \?\? "",?\s*\n?\s*\)/.test(
    entitiesSource,
  ),
);
check(
  "graph.tsx seeds its selection from the ?p= parameter on mount",
  /useState<string \| null>\(\(\) => \{\s*\n\s*const p = new URLSearchParams\(window\.location\.search\)\.get\("p"\);\s*\n\s*return p \|\| null;/.test(
    graphSource,
  ),
);
check(
  "graph.tsx adopts ?p= from later URL changes into the selection",
  /const p = params\.get\("p"\) \|\| null;[\s\S]*?setSelected\(\(cur\) => \(cur === p \? cur : p\)\)/.test(
    graphSource,
  ),
);
check(
  "graph.tsx resolves the side panel by exact node-name equality",
  /graph\?\.nodes\.find\(\(n\) => n\.name === selected\)/.test(graphSource),
);
check(
  "graph.tsx gives the node panel precedence over the associate panel",
  /\{selectedNode \? \(/.test(graphSource) &&
    /\) : selectedAssociate \? \(/.test(graphSource),
);

if (failures > 0) {
  console.error(
    `\nvalidate-competency-graph-links: ${failures} check(s) failed`,
  );
  process.exit(1);
}
console.log("\nvalidate-competency-graph-links: all checks passed");
