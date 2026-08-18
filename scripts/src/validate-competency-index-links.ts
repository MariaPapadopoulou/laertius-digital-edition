/**
 * Guards the competency panel's "Open in Index" deep link
 * (pages/competency.tsx -> /entities?entity=<uri>).
 *
 * The panel resolves a subgraph node's KG name to a tagged-entity URI by
 * label match against /api/annotations/entities (philosopher kind first,
 * then any label), and the Index page opens the entry whose entityUri
 * equals the ?entity= value from that same list. If the LOD URI scheme or
 * the entities index drifts for any node kind, a shared link opens the
 * Index with nothing selected while a single-philosopher e2e stays green.
 *
 * This validator pins, source-level and without live servers:
 *  1. every competency question's seed labels are real KG node names
 *     (the route silently drops unknown seeds from the subgraph);
 *  2. every KG node name (the superset of all possible subgraph nodes:
 *     the route only admits SPARQL row values that are KG nodes) resolves
 *     to an entity in getIndexEntries() using the exact frontend logic;
 *  3. each resolved entityUri is non-empty and unique in the index, so
 *     the Index page's entityUri-equality lookup selects exactly one entry;
 *  4. the wiring: competency.tsx resolves philosopher-kind first and
 *     builds the link from entity.entityUri; entities.tsx reads ?entity=
 *     and selects by entityUri equality over the same endpoint.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-competency-index-links
 */
import { readFileSync } from "node:fs";
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getIndexEntries } = await import(
  "../../artifacts/api-server/src/lib/annotate"
);
const { getKnowledgeGraph } = await import(
  "../../artifacts/api-server/src/lib/kg"
);
const { COMPETENCY_QUESTIONS, KNOWN_DROPPED_SEEDS } = await import(
  "../../artifacts/api-server/src/lib/competency"
);

const laertiusSrc = path.resolve(
  import.meta.dirname,
  "../../artifacts/laertius/src",
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

const entries = getIndexEntries();
const graph = getKnowledgeGraph();
const kgNames = graph.nodes.map((n) => n.name);
const kgNameSet = new Set(kgNames);

// Positive controls: an empty index or graph would make every per-item
// loop below vacuously green.
console.log(
  `Inputs: ${entries.length} index entries, ${kgNames.length} KG nodes, ` +
    `${COMPETENCY_QUESTIONS.length} competency questions`,
);
check("entities index is non-empty", entries.length > 0);
check("knowledge graph has nodes", kgNames.length > 0);
check("competency catalogue is non-empty", COMPETENCY_QUESTIONS.length > 0);

// 1. Every seed label is a real KG node name. The competency route builds
// the subgraph from seedLabels plus SPARQL row values, keeping only names
// found in the KG, so a renamed node would silently vanish from the panel.
// The homonymy question deliberately seeds two homonym bearers who have no
// Life chapter and thus no KG node (they never reach the subgraph); that
// reviewed exception is pinned via KNOWN_DROPPED_SEEDS, single-sourced from
// lib/competency.ts, which the answer route also ships as droppedSeeds so
// the /competency panel shows the curation instead of a silent omission.
console.log("Seed labels:");
for (const q of COMPETENCY_QUESTIONS) {
  const allowed = KNOWN_DROPPED_SEEDS.get(q.id) ?? [];
  const missing = q.seedLabels.filter((s) => !kgNameSet.has(s));
  const unexpected = missing.filter((s) => !allowed.includes(s));
  const staleAllow = allowed.filter((s) => !missing.includes(s));
  check(
    `${q.id}: seed labels are KG nodes` +
      (allowed.length ? ` (pinned exceptions: ${allowed.join(", ")})` : "") +
      (unexpected.length ? ` (unexpected drops: ${unexpected.join(", ")})` : "") +
      (staleAllow.length ? ` (stale exceptions: ${staleAllow.join(", ")})` : ""),
    unexpected.length === 0 && staleAllow.length === 0,
  );
}

// 2 + 3. Every KG node name resolves to an Index entry the way the panel
// does, and the resolved URI is unique so ?entity= selects one entry.
function resolveLikePanel(name: string) {
  return (
    entries.find((e) => e.label === name && e.kind === "philosopher") ??
    entries.find((e) => e.label === name)
  );
}

const uriCounts = new Map<string, number>();
for (const e of entries) {
  uriCounts.set(e.entityUri, (uriCounts.get(e.entityUri) ?? 0) + 1);
}

console.log("Index resolution for every possible subgraph node:");
const unresolved: string[] = [];
const badUris: string[] = [];
for (const name of kgNames) {
  const entity = resolveLikePanel(name);
  if (!entity) {
    unresolved.push(name);
    continue;
  }
  if (!entity.entityUri || uriCounts.get(entity.entityUri) !== 1) {
    badUris.push(`${name} -> ${entity.entityUri || "(empty)"}`);
  }
}
check(
  `every KG node name resolves to an entities-index entry` +
    (unresolved.length ? ` (unresolved: ${unresolved.join(", ")})` : ""),
  unresolved.length === 0,
);
check(
  `every resolved entityUri is non-empty and unique in the index` +
    (badUris.length ? ` (bad: ${badUris.join("; ")})` : ""),
  badUris.length === 0,
);

// Negative control: the resolver must not fabricate matches.
check(
  "resolver returns nothing for a name absent from the index",
  resolveLikePanel("Nobody of Nowhere \u2014 not a real entity") === undefined,
);

// 4. Wiring pins: the frontend must keep resolving and linking this way,
// otherwise the invariant checked above no longer covers the real code path.
console.log("Wiring:");
const competencySource = readFileSync(
  path.join(laertiusSrc, "pages/competency.tsx"),
  "utf8",
);
check(
  "competency.tsx resolves by label, philosopher kind first, then any label",
  /entities\.find\(\(e\) => e\.label === name && e\.kind === "philosopher"\)\s*\?\?\s*entities\.find\(\(e\) => e\.label === name\)/.test(
    competencySource,
  ),
);
check(
  "competency.tsx builds the Index link from the resolved entityUri",
  competencySource.includes(
    "`/entities?entity=${encodeURIComponent(entity.entityUri)}`",
  ),
);
check(
  "the Index link only renders once an entity resolved",
  /\{entity && \(\s*<Link\s*\n?\s*href=\{`\/entities\?entity=/.test(
    competencySource,
  ),
);

const entitiesSource = readFileSync(
  path.join(laertiusSrc, "pages/entities.tsx"),
  "utf8",
);
check(
  'entities.tsx reads the ?entity= query parameter',
  entitiesSource.includes('.get("entity")'),
);
check(
  "entities.tsx selects the entry by entityUri equality",
  /\.find\(\(e\) => e\.entityUri === selected\)/.test(entitiesSource),
);

// 5. Dropped-seeds note wiring: the reviewed exceptions pinned above are
// only visible to readers because (a) the answer route ships them as
// droppedSeeds built from getDroppedSeeds(), and (b) competency.tsx
// renders result.droppedSeeds as the "also discussed without a Life"
// note. If either side drifts, readers silently see fewer anchors than
// curated again — exactly the omission the note fixes.
console.log("Dropped-seeds note wiring:");
const routeSource = readFileSync(
  path.resolve(
    import.meta.dirname,
    "../../artifacts/api-server/src/routes/competency.ts",
  ),
  "utf8",
);
check(
  "route imports getDroppedSeeds from lib/competency",
  /import\s*\{[^}]*\bgetDroppedSeeds\b[^}]*\}\s*from\s*"\.\.\/lib\/competency"/.test(
    routeSource,
  ),
);
check(
  "route builds droppedSeeds from getDroppedSeeds(question.id)",
  /const droppedSeeds = getDroppedSeeds\(question\.id\)\.map\(/.test(
    routeSource,
  ),
);
check(
  "route ships droppedSeeds in the answer payload",
  /\.\.\.\(droppedSeeds\.length > 0 \? \{ droppedSeeds \} : \{\}\)/.test(
    routeSource,
  ),
);
check(
  "competency.tsx reads result.droppedSeeds",
  /const droppedSeeds = result\?\.droppedSeeds \?\? \[\]/.test(
    competencySource,
  ),
);
check(
  "competency.tsx renders the note when droppedSeeds is non-empty",
  /\{droppedSeeds\.length > 0 && \(/.test(competencySource),
);
check(
  'competency.tsx note carries the "without a Life" wording',
  competencySource.includes("without a Life of their own"),
);
check(
  "the note lists each dropped seed (mapped from droppedSeeds)",
  /droppedSeeds\.map\(\(d, i\) => \(/.test(competencySource),
);
// Positive control for the note itself: at least one question currently
// has pinned dropped seeds, so the note branch is actually exercisable —
// an emptied KNOWN_DROPPED_SEEDS would make the wiring pins vacuous.
const totalDropped = [...KNOWN_DROPPED_SEEDS.values()].reduce(
  (n, arr) => n + arr.length,
  0,
);
check(
  `KNOWN_DROPPED_SEEDS pins at least one dropped seed (found ${totalDropped})`,
  totalDropped > 0,
);

if (failures > 0) {
  console.error(
    `\nvalidate-competency-index-links: ${failures} check(s) failed`,
  );
  process.exit(1);
}
console.log("\nvalidate-competency-index-links: all checks passed");
