/**
 * Catches the /competency Source Passages card quoting the wrong section's
 * text.
 *
 * The competency route builds bilingual passage snippets from the first
 * five subgraph nodes' firstIds (routes/competency.ts, the passages
 * array): for each id it looks the section up in sectionById and serves
 * snippet(textEn)/snippet(text). validate-competency-terms already pins
 * that each firstId is a section really tagged for the entity, but
 * nothing checked that the snippet text served for that id actually comes
 * from that section: a corpus re-parse or sectionById drift could pair
 * the right id with the wrong text, and readers would quote a mismatched
 * passage under a correct citation.
 *
 * This validator recomputes, for every competency question, exactly the
 * passages the route would serve (same oxigraph store, same subgraph
 * rules, same firstId ordering, same slice(0, 5) and snippet() logic),
 * then independently re-reads the corpus JSONL files from disk and
 * asserts each served snippet is a prefix of that section's own trimmed
 * text/textEn as stored on disk (with the route's ellipsis stripped for
 * truncated snippets). Because the reference text comes straight from
 * the JSONL rather than through sectionById, a drifted or shuffled
 * sectionById map fails here even though the route would still serve
 * plausible-looking text. Positive counts are printed so a vacuous pass
 * is impossible.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-competency-passages
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { Store } from "oxigraph";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { COMPETENCY_QUESTIONS } = await import(
  "../../artifacts/api-server/src/lib/competency"
);
const { getKnowledgeGraph } = await import(
  "../../artifacts/api-server/src/lib/kg"
);
const { graphAsTurtle, ontologyAsTurtle, LOD_BASE, ONT } = await import(
  "../../artifacts/api-server/src/lib/lod"
);
const { sectionById } = await import(
  "../../artifacts/api-server/src/lib/corpus"
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

interface SparqlResultsJson {
  head?: { vars?: string[] };
  results?: {
    bindings?: Array<Record<string, { value: string }>>;
  };
}

// Same snippet logic as the route (routes/competency.ts): trim, and cut
// at SNIP characters with a trailing ellipsis when longer.
const SNIP = 220;
const ELLIPSIS = "\u2026";
function snippet(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  const t = text.trim();
  return t.length <= SNIP ? t : t.slice(0, SNIP).trimEnd() + ELLIPSIS;
}

// Independent reference corpus: re-read the JSONL files from disk rather
// than trusting sectionById, so a drifted id->text pairing in corpus.ts
// cannot satisfy its own check.
const dataDir = process.env["LAERTIUS_DATA_DIR"]!;
const rawGreek = new Map<string, string>();
for (const line of readFileSync(
  path.resolve(dataDir, "laertius_sections.jsonl"),
  "utf-8",
).split("\n")) {
  if (!line.trim()) continue;
  const rec = JSON.parse(line) as { id: string; text: string };
  rawGreek.set(rec.id, rec.text);
}
const rawEnglish = new Map<string, string>();
const englishPath = path.resolve(dataDir, "laertius_sections_en.jsonl");
if (existsSync(englishPath)) {
  for (const line of readFileSync(englishPath, "utf-8").split("\n")) {
    if (!line.trim()) continue;
    const rec = JSON.parse(line) as { id: string; textEn: string };
    rawEnglish.set(rec.id, rec.textEn);
  }
}

const graph = getKnowledgeGraph();
const nodesByName = new Map(graph.nodes.map((n) => [n.name, n]));

console.log(
  `Inputs: ${COMPETENCY_QUESTIONS.length} competency questions, ` +
    `${graph.nodes.length} KG nodes, ${rawGreek.size} Greek JSONL sections, ` +
    `${rawEnglish.size} English JSONL sections`,
);
check("competency catalogue is non-empty", COMPETENCY_QUESTIONS.length > 0);
check("knowledge graph has nodes", graph.nodes.length > 0);
check("Greek JSONL is non-empty", rawGreek.size > 0);
check("English JSONL is non-empty", rawEnglish.size > 0);

const store = new Store();
store.load(graphAsTurtle(), { format: "text/turtle" });
store.load(ontologyAsTurtle(), { format: "text/turtle" });

// A snippet must be a prefix of the section's own trimmed disk text.
// Truncated snippets drop the ellipsis and the trimEnd() the route
// applies before appending it, so we compare against the raw prefix.
function isSnippetOf(snip: string, diskText: string | undefined): boolean {
  if (diskText === undefined) return false;
  const t = diskText.trim();
  if (snip.endsWith(ELLIPSIS)) {
    const body = snip.slice(0, -ELLIPSIS.length);
    return t.slice(0, SNIP).trimEnd() === body && t.length > SNIP;
  }
  return t === snip;
}

let passagesChecked = 0;
let snippetsChecked = 0;
let truncatedSnippets = 0;

console.log("Passage snippets per question:");
for (const q of COMPETENCY_QUESTIONS) {
  // Same rows extraction as the route.
  let rows: string[][];
  try {
    const rawJson = String(
      store.query(q.sparqlFn(LOD_BASE, ONT), { results_format: "json" }),
    );
    const parsed: SparqlResultsJson = JSON.parse(rawJson);
    const variables = parsed.head?.vars ?? [];
    rows = (parsed.results?.bindings ?? []).map((b) =>
      variables.map((v) => b[v]?.value ?? ""),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    check(`${q.id}: SPARQL query executes (${message})`, false);
    continue;
  }

  // Same subgraph rule as the route: seed labels plus SPARQL row values
  // that are KG node names, in insertion order (seeds first).
  const relevantNames = new Set<string>(q.seedLabels);
  for (const row of rows) {
    for (const val of row) {
      if (nodesByName.has(val)) relevantNames.add(val);
    }
  }
  const subNodes = [...relevantNames]
    .map((name) => nodesByName.get(name))
    .filter((n): n is NonNullable<typeof n> => n !== undefined);

  // Same passages construction as the route: firstIds, slice(0, 5),
  // snippet(sectionById text).
  const sectionIds = subNodes.map((n) => n.firstId).filter(Boolean);
  const passages = sectionIds.slice(0, 5).map((sid) => {
    const sec = sectionById.get(sid);
    return { id: sid, en: snippet(sec?.textEn), grc: snippet(sec?.text) };
  });

  const problems: string[] = [];
  for (const p of passages) {
    passagesChecked++;
    if (p.en === undefined && p.grc === undefined) {
      problems.push(`${p.id}: route would serve no text at all for this id`);
      continue;
    }
    if (p.grc === undefined) {
      problems.push(`${p.id}: no Greek snippet served`);
    } else {
      snippetsChecked++;
      if (p.grc.endsWith(ELLIPSIS)) truncatedSnippets++;
      if (!isSnippetOf(p.grc, rawGreek.get(p.id)))
        problems.push(
          `${p.id}: served Greek snippet is not a prefix of the section's own JSONL text ("${p.grc.slice(0, 60)}...")`,
        );
    }
    if (p.en === undefined) {
      problems.push(`${p.id}: no English snippet served`);
    } else {
      snippetsChecked++;
      if (p.en.endsWith(ELLIPSIS)) truncatedSnippets++;
      if (!isSnippetOf(p.en, rawEnglish.get(p.id)))
        problems.push(
          `${p.id}: served English snippet is not a prefix of the section's own JSONL textEn ("${p.en.slice(0, 60)}...")`,
        );
    }
  }
  check(
    `${q.id}: all ${passages.length} served passages quote their own section's text` +
      (problems.length ? ` (${problems.join("; ")})` : ""),
    problems.length === 0 && passages.length > 0,
  );
}

// Positive controls: the loop must have checked real passages, real
// snippets, and at least one truncated snippet, so the ellipsis branch of
// the prefix comparison is exercised by real data.
check(
  `checked ${passagesChecked} served passages in total (must be > 0)`,
  passagesChecked > 0,
);
check(
  `checked ${snippetsChecked} bilingual snippets in total (must be > 0)`,
  snippetsChecked > 0,
);
check(
  `${truncatedSnippets} of them were truncated with an ellipsis (must be > 0)`,
  truncatedSnippets > 0,
);

// Negative control: the prefix check must be able to fail. A snippet
// paired with a DIFFERENT section's text (the classic sectionById drift)
// must be rejected, in both the short and the truncated shape.
const anyId = [...rawGreek.keys()][0]!;
const otherId = [...rawGreek.keys()].find(
  (id) => id !== anyId && rawGreek.get(id) !== rawGreek.get(anyId),
)!;
check(
  "negative control: a snippet from one section is rejected against another section's text",
  isSnippetOf(snippet(rawGreek.get(anyId))!, rawGreek.get(anyId)) &&
    !isSnippetOf(snippet(rawGreek.get(anyId))!, rawGreek.get(otherId)),
);

// Wiring pins: the invariant only covers the real code path while the
// route keeps building passages from sectionById with this snippet shape.
console.log("Wiring:");
const routeSource = readFileSync(
  path.resolve(
    import.meta.dirname,
    "../../artifacts/api-server/src/routes/competency.ts",
  ),
  "utf8",
);
check(
  "competency route caps passages at five sections (sectionIds.slice(0, 5))",
  routeSource.includes("sectionIds.slice(0, 5)"),
);
check(
  "competency route resolves passage text via sectionById.get(sid)",
  routeSource.includes("sectionById.get(sid)"),
);
check(
  "competency route serves en: snippet(sec?.textEn) and grc: snippet(sec?.text)",
  routeSource.includes("en: snippet(sec?.textEn)") &&
    routeSource.includes("grc: snippet(sec?.text)"),
);
check(
  "competency route's snippet cap is 220 with an ellipsis",
  routeSource.includes("const SNIP = 220") &&
    routeSource.includes('.trimEnd() + "\\u2026"'),
);

if (failures > 0) {
  console.error(`\nvalidate-competency-passages: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nvalidate-competency-passages: all checks passed");
