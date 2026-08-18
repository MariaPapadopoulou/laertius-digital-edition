/**
 * Runs the published SHACL shapes (api-server src/lib/shapes.ts, served at
 * /api/lod/shapes.ttl) over a fresh graphAsTurtle() dump with pySHACL, so a
 * curation change can never silently break conformance of the LOD graph.
 *
 * Three checks:
 * 1. Positive control (audit-positive-controls rule): a deliberately broken
 *    copy of the graph (a lo:Claim with an invalid certainty) must be
 *    reported non-conformant — proving the shapes actually target the data
 *    instead of passing vacuously.
 * 2. Conformance: the real graph must validate with zero violations.
 * 3. Export snapshot: exports/laertius-shapes.ttl must equal exactly what
 *    the /api/lod/shapes.ttl route serves (attribution header + shapes),
 *    so the checked-in file cannot drift from the shipped one.
 * 4. RDF/XML snapshot: exports/laertius-shapes.rdf must be graph-isomorphic
 *    to the same shapes (RDF/XML blank-node ids are not byte-stable, so we
 *    compare graphs, not bytes). A deliberately perturbed copy must be
 *    reported non-isomorphic first, proving the comparison can fail.
 * 5. Annotated graph: annotatedGraphAsTurtle() (served at
 *    /api/lod/graph-annotated.ttl, published right next to the shapes) must
 *    also conform, with its own positive control run against the annotated
 *    document itself. The stand-off annotation layer adds classes the shapes
 *    deliberately do NOT target — lo:Passage, oa:Annotation,
 *    oa:SpecificResource, oa:TextQuoteSelector, oa:TextPositionSelector —
 *    because the Web Annotation vocabulary carries its own W3C data model
 *    and the shapes only govern the lo:/otv: knowledge-graph classes. Those
 *    annotation-only classes therefore pass vacuously by design; what this
 *    check guards is that the copies of the shaped nodes (claims, sayings,
 *    philosophers, …) inside the annotated export, plus anything the
 *    annotation layer attaches to them, never break conformance of the
 *    downloaded file. A sanity guard asserts the annotated dump really
 *    contains oa:Annotation and lo:Passage nodes, so the conformance run
 *    can never pass vacuously on a graph that silently lost its layer.
 * 6. Composed Legomena store: the companion app composes SEPARATE Turtle
 *    documents (base graph + TBox from ontologyAsTurtle() + passage layer
 *    from passageLayerAsTurtle(), see scripts/src/materialize-legomena.ts)
 *    in one triple store. Validated alone, the passage layer passes
 *    vacuously — the shapes target classes it does not declare — so a
 *    regression there would only surface in the composed store. This check
 *    parses all three layers into ONE data graph and validates the union,
 *    with its own positive control on the composed graph, plus a sanity
 *    guard that the passage layer really contributes oa:Annotation and
 *    lo:Passage nodes.
 * 7. Annotated JSON-LD and RDF/XML downloads: void.ttl/dcat.ttl advertise
 *    dcterms:conformsTo on the annotated DATASET, whose distributions also
 *    include graph-annotated.jsonld and graph-annotated.rdf. A bug confined
 *    to the JSON-LD or RDF/XML writers could make those two downloads
 *    non-conformant while the Turtle check stays green, so each is parsed
 *    from its own serialization (rdflib json-ld / xml parsers) and run
 *    through pySHACL independently, with the same in-driver positive
 *    control (an invalid certainty must be flagged) and a sanity guard
 *    that the parsed graph really contains oa:Annotation and lo:Passage
 *    nodes — proving the parser didn't silently drop the layer.
 *    (Graph isomorphism to the Turtle would be an alternative proof, but
 *    rdflib canonicalization is intractable here: the annotated graph
 *    carries ~56k blank nodes.)
 * 8. Speed-pattern guard: this validator was once four serial pyshacl CLI
 *    invocations that each re-parsed the large graphs from scratch (tens of
 *    minutes under load). It now uses a single in-process Python driver per
 *    data graph, launched in parallel. A future edit could quietly
 *    reintroduce the slow pattern without any check failing, so the
 *    validator inspects its OWN source and fails if (a) a pyshacl CLI
 *    invocation reappears, (b) the driver no longer runs the positive
 *    control and the real conformance check in one process, or (c) the
 *    drivers are serialized (awaited at their creation sites instead of
 *    being collected after all have launched). The guard has its own
 *    positive controls: deliberately mutated copies of the source
 *    (a serialized driver launch, an injected module-mode pyshacl CLI
 *    call, a driver stripped of its in-process control) must each be flagged,
 *    or the guard itself fails as vacuous. A wall-clock budget was
 *    deliberately NOT used: validators here run under heavy parallel load
 *    after task merges, where elapsed time is dominated by contention and
 *    a timing assertion would flap. Elapsed time is printed for eyeballs.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-shapes
 */
import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const {
  graphAsTurtle,
  annotatedGraphAsTurtle,
  annotatedGraphAsJsonLd,
  annotatedGraphAsRdfXml,
  ontologyAsTurtle,
  passageLayerAsTurtle,
} = await import("../../artifacts/api-server/src/lib/lod");
const { shapesAsTurtle } = await import(
  "../../artifacts/api-server/src/lib/shapes"
);
const { ttlWithAttribution } = await import(
  "../../artifacts/api-server/src/routes/graph"
);

const shapes = shapesAsTurtle();
const graph = graphAsTurtle();

const tmp = mkdtempSync(path.join(os.tmpdir(), "laertius-shacl-"));
const shapesPath = path.join(tmp, "shapes.ttl");
const graphPath = path.join(tmp, "graph.ttl");
writeFileSync(shapesPath, shapes);
writeFileSync(graphPath, graph);

// One pySHACL driver per data graph: it parses shapes+data exactly once,
// runs the positive control (a bogus certainty added in-memory to the first
// lo:Claim) AND the real conformance check in the same process, and prints
// one JSON result. This replaces four CLI invocations that each re-parsed
// the (large) graphs from scratch, which made the validator too slow to run
// on every change. The broken-control run goes FIRST, on a defensive copy,
// so nothing pySHACL might do to the data graph can leak into the real
// check.
const driverPath = path.join(tmp, "shacl-driver.py");
writeFileSync(
  driverPath,
  [
    "import json, sys",
    "from rdflib import Graph, URIRef",
    "from rdflib.namespace import RDF",
    "from pyshacl import validate",
    "shapes = Graph().parse(sys.argv[1], format='turtle')",
    "# Format is sniffed from the file extension so the same driver also",
    "# validates the JSON-LD and RDF/XML downloads (check 7).",
    "fmt = {'ttl': 'turtle', 'jsonld': 'json-ld', 'rdf': 'xml'}",
    "data = Graph()",
    "for p in sys.argv[2:]:",
    "    data.parse(p, format=fmt[p.rsplit('.', 1)[-1]])",
    "lo = dict(data.namespaces()).get('lo') or dict(shapes.namespaces()).get('lo')",
    "claim = next(data.subjects(RDF.type, URIRef(str(lo) + 'Claim')), None) if lo is not None else None",
    "if claim is None:",
    "    print(json.dumps({'error': 'no lo:Claim node found'}))",
    "    sys.exit(0)",
    "annotations = len(set(data.subjects(RDF.type, URIRef('http://www.w3.org/ns/oa#Annotation'))))",
    "passages = len(set(data.subjects(RDF.type, URIRef(str(lo) + 'Passage'))))",
    "broken = Graph()",
    "for t in data:",
    "    broken.add(t)",
    "broken.add((claim, URIRef(str(lo) + 'certainty'), URIRef(str(lo) + 'Bogus')))",
    "broken_conforms, _, _ = validate(broken, shacl_graph=shapes)",
    "conforms, _, report = validate(data, shacl_graph=shapes)",
    "print(json.dumps({'claim': claim.n3(), 'brokenConforms': broken_conforms, 'conforms': conforms, 'annotations': annotations, 'passages': passages, 'report': '' if conforms else report}))",
  ].join("\n"),
);

interface DriverResult {
  error?: string;
  claim?: string;
  brokenConforms?: boolean;
  conforms?: boolean;
  annotations?: number;
  passages?: number;
  report?: string;
}

async function runDriver(...dataPaths: string[]): Promise<DriverResult> {
  const { stdout } = await execFileAsync(
    "python3",
    [driverPath, shapesPath, ...dataPaths],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return JSON.parse(stdout.trim().split("\n").at(-1) ?? "{}") as DriverResult;
}

let failed = false;

// 1 & 2 (and 5's SHACL half): the positive control (an invalid certainty on
// the FIRST lo:Claim node must produce a violation, or the shapes are
// matching nothing) plus real conformance, reported from one driver run.
function reportPair(
  label: string,
  result: DriverResult,
  requireLayer = false,
): void {
  if (requireLayer && !result.error) {
    // Sanity guard for the annotated downloads: the PARSED graph must still
    // carry the annotation layer, or the format's parser silently dropped
    // triples and the conformance run is vacuous.
    if (!result.annotations || !result.passages) {
      console.error(
        `validate-shapes: sanity guard FAILED — parsed ${label} carries ${result.annotations ?? 0} oa:Annotation and ${result.passages ?? 0} lo:Passage nodes; the annotation layer was lost in serialization or parsing`,
      );
      failed = true;
    } else {
      console.log(
        `✓ parsed ${label} carries the annotation layer (${result.annotations} oa:Annotation, ${result.passages} lo:Passage nodes)`,
      );
    }
  }
  if (result.error) {
    console.error(
      `validate-shapes: positive control FAILED — ${result.error} in ${label}`,
    );
    failed = true;
    return;
  }
  if (result.brokenConforms) {
    console.error(
      `validate-shapes: positive control FAILED — a deliberately invalid certainty was NOT flagged in ${label}; the shapes are passing vacuously`,
    );
    failed = true;
  } else {
    console.log(
      `✓ positive control (${label}): invalid certainty on ${result.claim} correctly reported non-conformant`,
    );
  }
  if (!result.conforms) {
    console.error(
      `validate-shapes: ${label} does NOT conform to the published shapes:`,
    );
    console.error(result.report ?? "");
    failed = true;
  } else {
    console.log(`✓ ${label} conforms to the SHACL shapes`);
  }
}

// Kick off both SHACL drivers NOW so they run in parallel with each other
// and with the (cheap, synchronous) snapshot checks below. The annotated
// driver only launches once the sanity guard has confirmed the annotation
// layer is actually present (see check 5 below).
const basePromise = runDriver(graphPath);

const annotated = annotatedGraphAsTurtle();
const annotatedPath = path.join(tmp, "graph-annotated.ttl");
writeFileSync(annotatedPath, annotated);
// Sanity guard: the annotation layer must really be in the dump, or the
// whole check degenerates into re-validating the base graph.
const hasAnnotations = /\boa:Annotation\b/.test(annotated);
const hasPassages = /\blo:Passage\b/.test(annotated);
const annotatedLayerPresent = hasAnnotations && hasPassages;
const annotatedPromise = annotatedLayerPresent
  ? runDriver(annotatedPath)
  : null;

// 7. The annotated JSON-LD and RDF/XML downloads (graph-annotated.jsonld /
// graph-annotated.rdf) are distributions of the same dataset that
// dcterms:conformsTo advertises, but they go through DIFFERENT writers
// (quadsToJsonLdDoc / quadsToRdfXml). Each is parsed from its own
// serialization and validated independently, with the in-driver positive
// control and a parsed-layer sanity guard (see reportPair's requireLayer).
const annotatedJsonLdPath = path.join(tmp, "graph-annotated.jsonld");
const annotatedRdfXmlPath = path.join(tmp, "graph-annotated.rdf");
writeFileSync(annotatedJsonLdPath, JSON.stringify(annotatedGraphAsJsonLd()));
writeFileSync(annotatedRdfXmlPath, annotatedGraphAsRdfXml());
const annotatedJsonLdPromise = runDriver(annotatedJsonLdPath);
const annotatedRdfXmlPromise = runDriver(annotatedRdfXmlPath);

// 6. Composed Legomena store: base graph + TBox + passage layer, exactly
// the three documents materialize-legomena.ts writes, parsed into ONE data
// graph. The passage layer alone passes vacuously, so validate the union.
const tbox = ontologyAsTurtle();
const passages = passageLayerAsTurtle();
const tboxPath = path.join(tmp, "tbox.ttl");
const passagesPath = path.join(tmp, "passages.ttl");
writeFileSync(tboxPath, tbox);
writeFileSync(passagesPath, passages);
// Sanity guard: the passage layer file must really carry its layer, or the
// composed check degenerates into re-validating base graph + TBox.
const passagesHaveAnnotations = /\boa:Annotation\b/.test(passages);
const passagesHavePassages = /\blo:Passage\b/.test(passages);
const passageLayerPresent = passagesHaveAnnotations && passagesHavePassages;
const composedPromise = passageLayerPresent
  ? runDriver(graphPath, tboxPath, passagesPath)
  : null;

// 3. The checked-in exports snapshot must equal the served serialization.
{
  const exportPath = path.resolve(
    import.meta.dirname,
    "../../exports/laertius-shapes.ttl",
  );
  // Exactly one trailing newline (a trailing blank line trips git diff --check).
  const expected = `${ttlWithAttribution(shapes).trimEnd()}\n`;
  let actual: string | undefined;
  try {
    actual = readFileSync(exportPath, "utf8");
  } catch {
    // Snapshot missing entirely counts as drift.
  }
  if (actual !== expected) {
    console.error(
      "validate-shapes: exports/laertius-shapes.ttl has drifted from the shapes served at /api/lod/shapes.ttl.",
    );
    console.error(
      "  Regenerate it: pnpm --filter @workspace/scripts run validate-shapes -- --write-export",
    );
    if (process.argv.includes("--write-export")) {
      writeFileSync(exportPath, expected);
      console.error("  (--write-export given: snapshot regenerated — re-run to confirm)");
    }
    failed = true;
  } else {
    console.log("✓ exports/laertius-shapes.ttl matches the served shapes exactly");
  }
}

// 4. The checked-in RDF/XML snapshot must stay graph-isomorphic to the
// shapes. Byte comparison is impossible (rdflib blank-node ids differ per
// run), so parse both and compare graphs with rdflib's isomorphism check.
{
  const rdfExportPath = path.resolve(
    import.meta.dirname,
    "../../exports/laertius-shapes.rdf",
  );
  const compareScript = path.join(tmp, "compare-shapes-rdf.py");
  writeFileSync(
    compareScript,
    [
      "import sys",
      "from rdflib import Graph, URIRef",
      "from rdflib.compare import to_isomorphic",
      "ttl = Graph().parse(sys.argv[1], format='turtle')",
      "if sys.argv[3] == 'write':",
      "    ttl.serialize(destination=sys.argv[2], format='xml')",
      "    sys.exit(0)",
      "rdf = Graph().parse(sys.argv[2], format='xml')",
      "# Positive control: a perturbed copy must be detected as different.",
      "broken = Graph().parse(sys.argv[2], format='xml')",
      "b = URIRef('https://humanisticadigitalia.eu/Laertius/shapes#Bogus')",
      "broken.add((b, b, b))",
      "if to_isomorphic(ttl) == to_isomorphic(broken):",
      "    print('CONTROL_FAILED')",
      "    sys.exit(2)",
      "iso = to_isomorphic(ttl) == to_isomorphic(rdf)",
      "print(f'triples ttl={len(ttl)} rdf={len(rdf)}')",
      "print('ISO' if iso else 'DIFF')",
    ].join("\n"),
  );
  const runCompare = (mode: "check" | "write"): string => {
    try {
      return execFileSync(
        "python3",
        [compareScript, shapesPath, rdfExportPath, mode],
        { encoding: "utf8" },
      );
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string };
      return `ERROR\n${e.stdout ?? ""}${e.stderr ?? ""}`;
    }
  };
  const out = runCompare("check");
  if (out.includes("CONTROL_FAILED")) {
    console.error(
      "validate-shapes: RDF/XML positive control FAILED — a deliberately perturbed graph compared as isomorphic; the check is vacuous",
    );
    failed = true;
  } else if (!out.includes("\nISO")) {
    console.error(
      "validate-shapes: exports/laertius-shapes.rdf has drifted from src/lib/shapes.ts (not graph-isomorphic, or unparseable).",
    );
    console.error(out.trim());
    console.error(
      "  Regenerate it: pnpm --filter @workspace/scripts run validate-shapes -- --write-export",
    );
    if (process.argv.includes("--write-export")) {
      runCompare("write");
      console.error("  (--write-export given: RDF/XML snapshot regenerated — re-run to confirm)");
    }
    failed = true;
  } else {
    console.log(
      "✓ exports/laertius-shapes.rdf is graph-isomorphic to the published shapes",
    );
  }
}

// 5. The annotated graph download (/api/lod/graph-annotated.ttl) must also
// conform to the very shapes published next to it. Annotation-only classes
// (lo:Passage, oa:Annotation, oa:SpecificResource, oa:TextQuoteSelector,
// oa:TextPositionSelector) are intentionally untargeted by the shapes — see
// the header comment — so first assert the layer is actually present, then
// run a positive control against the annotated document itself, then check
// conformance.
// Both drivers were launched up top (in parallel); collect their results
// here.
reportPair("graphAsTurtle()", await basePromise);
if (!annotatedLayerPresent) {
  console.error(
    `validate-shapes: annotated graph sanity guard FAILED — expected oa:Annotation (${hasAnnotations}) and lo:Passage (${hasPassages}) nodes in annotatedGraphAsTurtle()`,
  );
  failed = true;
} else if (annotatedPromise) {
  reportPair("annotatedGraphAsTurtle()", await annotatedPromise);
}
reportPair(
  "annotatedGraphAsJsonLd() (graph-annotated.jsonld)",
  await annotatedJsonLdPromise,
  true,
);
reportPair(
  "annotatedGraphAsRdfXml() (graph-annotated.rdf)",
  await annotatedRdfXmlPromise,
  true,
);
if (!passageLayerPresent) {
  console.error(
    `validate-shapes: composed-store sanity guard FAILED — expected oa:Annotation (${passagesHaveAnnotations}) and lo:Passage (${passagesHavePassages}) nodes in passageLayerAsTurtle()`,
  );
  failed = true;
} else if (composedPromise) {
  reportPair(
    "composed Legomena store (base + TBox + passage layer)",
    await composedPromise,
  );
}

rmSync(tmp, { recursive: true, force: true });

// 8. Speed-pattern guard: inspect this validator's own source and fail if
// the fast single-parse, parallel-driver structure regressed (see header).
// Pure function over a source string so the positive controls below can run
// it on deliberately broken copies. Everything below the sentinel is the
// guard itself (whose mutant literals would otherwise self-trigger), so the
// scan covers the source only UP TO the sentinel — which is exactly the
// region where drivers are defined and launched.
// SPEED-GUARD-SCAN-END (do not move: the guard scans the source above this line)
function speedPatternProblems(src: string): string[] {
  const problems: string[] = [];
  // (a) No pyshacl CLI invocations: the slow pattern shelled out to
  // `pyshacl` (or `python3 -m pyshacl`) once per check, re-parsing the
  // graphs every time. The only permitted pyshacl reference is the driver's
  // in-process `from pyshacl import validate`.
  if (
    /(execFile\w*|spawn\w*|exec)\s*\(\s*["']pyshacl["']/.test(src) ||
    /["']-m["']\s*,\s*["']pyshacl["']/.test(src) ||
    /-m\s+pyshacl/.test(src)
  ) {
    problems.push(
      "a pyshacl CLI invocation reappeared (shapes+data would be re-parsed per check); keep all pySHACL runs inside the in-process Python driver",
    );
  }
  // (b) The driver must run the positive control AND the real conformance
  // check in ONE process (two validate() calls over graphs parsed once).
  if (
    !src.includes("validate(broken") ||
    !src.includes("validate(data")
  ) {
    problems.push(
      "the Python driver no longer runs both the broken-copy control and the real conformance check in one process (validate(broken…)/validate(data…) missing)",
    );
  }
  // (c) The drivers must launch in parallel: no `await runDriver(` at a
  // creation site, and every `…Promise = runDriver(` creation must appear
  // before the first `await …Promise` collection point.
  if (/=\s*await\s+runDriver\(/.test(src)) {
    problems.push(
      "a driver is awaited at its creation site — the SHACL runs are serialized instead of parallel",
    );
  }
  const creationSites = [...src.matchAll(/=\s*runDriver\(/g)].map(
    (m) => m.index ?? 0,
  );
  const firstCollect = src.search(/await\s+\w*[pP]romise\b/);
  if (creationSites.length < 2) {
    problems.push(
      `only ${creationSites.length} runDriver creation site(s) found — the multi-driver structure is gone`,
    );
  } else if (firstCollect !== -1 && Math.max(...creationSites) > firstCollect) {
    problems.push(
      "a driver is created after the first `await …Promise` collection point — later drivers no longer overlap with earlier ones",
    );
  }
  return problems;
}

{
  const fullSource = readFileSync(
    path.join(import.meta.dirname, "validate-shapes.ts"),
    "utf8",
  );
  const sentinel = fullSource.indexOf("// SPEED-GUARD-SCAN-END");
  if (sentinel === -1) {
    console.error(
      "validate-shapes: speed-pattern guard FAILED — the SPEED-GUARD-SCAN-END sentinel is missing; the guard cannot scope its scan",
    );
    failed = true;
  }
  const ownSource = sentinel === -1 ? fullSource : fullSource.slice(0, sentinel);
  // Positive controls FIRST: each mutant simulates one regression and must
  // be flagged, or the guard itself is vacuous.
  const mutants: { label: string; src: string }[] = [
    {
      label: "serialized driver launch",
      src: ownSource.replace("= runDriver(graphPath)", "= await runDriver(graphPath)"),
    },
    {
      label: "pyshacl CLI reintroduced",
      src: `${ownSource}\n// execFileSync("python3", ["-m", "pyshacl", shapesPath]) placeholder\nconst _cli = ["-m", "pyshacl"];\n`,
    },
    {
      label: "driver control stripped",
      src: ownSource.replaceAll("validate(broken", "validate(fixed"),
    },
  ];
  for (const m of mutants) {
    if (m.src === ownSource) {
      console.error(
        `validate-shapes: speed-guard positive control FAILED — mutant "${m.label}" is identical to the real source; the mutation no longer applies`,
      );
      failed = true;
    } else if (speedPatternProblems(m.src).length === 0) {
      console.error(
        `validate-shapes: speed-guard positive control FAILED — mutant "${m.label}" was NOT flagged; the guard is vacuous`,
      );
      failed = true;
    }
  }
  const problems = speedPatternProblems(ownSource);
  for (const p of problems) {
    console.error(`validate-shapes: speed-pattern guard FAILED — ${p}`);
    failed = true;
  }
  if (problems.length === 0) {
    console.log(
      "✓ speed-pattern guard: single-parse parallel driver structure intact (3 mutant controls flagged correctly)",
    );
  }
}

console.log(
  `validate-shapes: SHACL phase wall clock ${(performance.now() / 1000).toFixed(1)}s (informational — timing is load-sensitive, not asserted)`,
);

if (failed) {
  console.error("validate-shapes FAILED");
  process.exit(1);
}
console.log("validate-shapes: all checks passed");
