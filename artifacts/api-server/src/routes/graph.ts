import path from "node:path";
import { existsSync } from "node:fs";
import { Router, type IRouter } from "express";
import {
  GetKnowledgeGraphResponse,
  GetPhilosopherClaimsResponse,
  ListMapPlacesResponse,
  ListMapItinerariesResponse,
} from "@workspace/api-zod";
import { getKnowledgeGraph } from "../lib/kg";
import { philosophers } from "../lib/corpus";
import { buildGraphAssociates } from "../lib/graph-associates";
import { getClaims } from "../lib/kg-claims";
import { getOntologyExtras } from "../lib/kg-ontology";
import { sectionIdForRef } from "../lib/claims-answer";
import { getMapPlaces, getItineraries } from "../lib/map";
import { getIndexEntries } from "../lib/annotate";
import {
  LOD_BASE,
  graphAsJsonLd,
  graphAsTurtle,
  graphAsRdfXml,
  annotatedGraphAsJsonLd,
  annotatedGraphAsTurtle,
  annotatedGraphAsRdfXml,
  ontologyAsJsonLd,
  ontologyAsTurtle,
  ontologyAsRdfXml,
} from "../lib/lod";
import { ontologyAsHtml } from "../lib/lod-vocab-html";
import {
  sectionAsJsonLd,
  sectionAsRdfXml,
  voidAsTurtle,
  dcatAsTurtle,
  greekHomonymsForLabels,
  workUri,
  sourceUri,
} from "../lib/lod";
import { greekSchoolGrc, displaySchoolLabel } from "../lib/greek-names";
import { shapesAsTurtle } from "../lib/shapes";

const router: IRouter = Router();

// Entity URIs that resolve in the reader-facing Index, cached on first use
// (getIndexEntries is itself memoized, but the Set avoids rebuilding it per
// chain link on every claims request).
let indexUriSet: Set<string> | undefined;
function indexUris(): Set<string> {
  if (!indexUriSet) {
    indexUriSet = new Set(getIndexEntries().map((e) => e.entityUri));
  }
  return indexUriSet;
}

/**
 * The knowledge graph merged with the ontology extras (kg-ontology.ts) so
 * the UI can show founder citations, per-philosopher year bounds, and each
 * school's principal doctrine without parsing RDF. Merging happens here
 * (not in kg.ts) because kg-ontology imports kg and would otherwise cycle.
 */
export function graphWithOntology() {
  const g = getKnowledgeGraph();
  const extras = getOntologyExtras();
  // Owner-aware ref resolution (Hicks numbering restarts across chapters,
  // so a bare book.section can be ambiguous): founder refs resolve against
  // the founder philosopher, doctrine refs against the school's founder.
  const founderRef = new Map(
    extras.founderLinks
      .filter((f) => f.ref)
      .map((f) => [f.philosopher, f.ref as string]),
  );
  const founderByMovement = new Map<string, string>();
  for (const f of extras.founderLinks) {
    founderByMovement.set(f.school, f.philosopher);
  }
  const chrono = new Map(extras.chronology.map((c) => [c.philosopher, c]));
  const doctrine = new Map(extras.schoolDoctrines.map((d) => [d.school, d]));
  // Cited school members beyond the 82 chapter subjects: satellite nodes
  // for the network view, anchored to the school's founder. These are
  // deliberately NOT KG nodes - minting them there would collide with
  // their existing LOD person/source URIs and pollute query detection.
  // Built in lib/graph-associates.ts (shared with validate-graph-associates,
  // which pins per-school counts and teacher legs).
  const associates = buildGraphAssociates();
  // Greek-name homonyms among the graph's philosophers: the same pairs that
  // carry owl:differentFrom axioms in the LOD serializations.
  const homonyms = greekHomonymsForLabels(g.nodes.map((n) => n.name));
  return {
    nodes: g.nodes.map((n) => {
      const ref = founderRef.get(n.name);
      const c = chrono.get(n.name);
      const h = homonyms.get(n.name);
      return {
        ...n,
        ...(h
          ? { grcHomonymForm: h.grc, sharesGreekNameWith: h.others }
          : {}),
        ...(ref
          ? { founderRef: ref, founderSectionId: sectionIdForRef(ref, n.name) }
          : {}),
        ...(c
          ? {
              earliestYear: c.earliestYear,
              latestYear: c.latestYear,
              approximateDates: c.approximate,
              dateRefs: c.refs,
            }
          : {}),
      };
    }),
    edges: g.edges,
    associates,
    movements: g.movements.map((mv) => {
      // Greek school form from the single curated map (greek-names.ts);
      // "Unaffiliated" is deliberately absent there and stays English-only.
      const grc = greekSchoolGrc(mv.label);
      const m = grc ? { ...mv, grc } : mv;
      const d = doctrine.get(m.id);
      return d
        ? {
            ...m,
            doctrine: d.doctrine,
            doctrineRef: d.ref,
            doctrineSectionId: sectionIdForRef(
              d.ref,
              founderByMovement.get(m.id),
            ),
            ...(d.note ? { doctrineNote: d.note } : {}),
          }
        : m;
    }),
  };
}

router.get("/graph", (req, res) => {
  try {
    const data = GetKnowledgeGraphResponse.parse(graphWithOntology());
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to build knowledge graph");
    res.status(500).json({ error: "Failed to build knowledge graph" });
  }
});

/**
 * The exact claims payload /claims/:philosopher serves for one philosopher,
 * exported so validate-page-contracts can compare the live shape against
 * the OpenAPI Claim/ChainLink schemas.
 */
export function buildPhilosopherClaims(name: string) {
  const extras = getOntologyExtras();
  const transmission = new Map(
    extras.workTransmission.map((t) => [`${t.work}\u0001${t.ref}`, t.status]),
  );
  const altTitles = new Map(extras.altTitles.map((a) => [a.work, a]));
  return getClaims()
    .filter((c) => c.subject === name)
    .map((c) => {
      // Only attach the alt title when this claim's subject is the
      // alt-title record's owner: a same-titled work by another
      // philosopher must not inherit Plato's catalogue note.
      const altCandidate =
        c.property === "wrote" ? altTitles.get(c.value) : undefined;
      const alt =
        altCandidate && altCandidate.owner === c.subject
          ? altCandidate
          : undefined;
      return {
        transmission:
          c.property === "wrote"
            ? transmission.get(`${c.value}\u0001${c.ref}`)
            : undefined,
        ...(alt
          ? {
              altTitle: alt.altTitle,
              altTitleRef: alt.ref,
              // Resolve owner-aware against the alt-title record's own
              // owner (today always Plato's Book 3 catalogue), like
              // annotate.ts does.
              altTitleSectionId: sectionIdForRef(alt.ref, alt.owner),
            }
          : {}),
        id: c.id,
        property: c.property,
        // School labels render their display form (e.g. "Garden" for
        // "Garden (Epicurus)"); the canonical value stays in the data/LOD.
        value: c.valueType === "school" ? displaySchoolLabel(c.value) : c.value,
        valueType: c.valueType,
        ref: c.ref,
        sectionId: sectionIdForRef(c.ref, c.subject),
        certainty: c.certainty,
        accordingTo: c.accordingTo,
        // Like chain links below: link the "according to" authority only
        // when its lo:Source URI resolves to a tagged Index entry.
        accordingToUri: (() => {
          if (c.accordingTo === undefined) return undefined;
          const uri = sourceUri(c.accordingTo);
          return indexUris().has(uri) ? uri : undefined;
        })(),
        sourceWork: c.sourceWork,
        sourceWorkUri: c.sourceWork ? workUri(c.sourceWork) : undefined,
        // Chain URIs only when they resolve to an Index entry: a chain
        // authority's lo:Source node always exists in the LOD graph, but
        // the Index lists tagged entities only, and a homonym-suppressed
        // label (e.g. Ariston) has no source entry to link to.
        chain: c.chain?.map((link) => {
          const aUri = sourceUri(link.authority);
          const wUri = link.work ? workUri(link.work) : undefined;
          return {
            authority: link.authority,
            authorityUri: indexUris().has(aUri) ? aUri : undefined,
            work: link.work,
            workUri: wUri && indexUris().has(wUri) ? wUri : undefined,
          };
        }),
        conflictsWith: c.conflictsWith,
        greek: c.greek,
        grc: c.grc,
        note: c.note,
      };
    });
}

router.get("/claims/:philosopher", (req, res) => {
  try {
    const name = req.params.philosopher;
    const known = getKnowledgeGraph().nodes.some((n) => n.name === name);
    if (!known) {
      // Corpus chapter owners without a knowledge-graph node (e.g. the
      // Book I "Prologue") legitimately have no claims: answer with an
      // empty list instead of a 404 so the section reader stays quiet.
      const corpusOwner = philosophers.some((p) => p.name === name);
      if (corpusOwner) {
        res.json(GetPhilosopherClaimsResponse.parse({ philosopher: name, claims: [] }));
        return;
      }
      res.status(404).json({ error: `Unknown philosopher: ${name}` });
      return;
    }
    res.json(
      GetPhilosopherClaimsResponse.parse({
        philosopher: name,
        claims: buildPhilosopherClaims(name),
      }),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to build philosopher claims");
    res.status(500).json({ error: "Failed to build philosopher claims" });
  }
});

router.get("/map/places", (req, res) => {
  try {
    res.json(ListMapPlacesResponse.parse(getMapPlaces()));
  } catch (err) {
    req.log.error({ err }, "Failed to build map places");
    res.status(500).json({ error: "Failed to build map places" });
  }
});

router.get("/map/itineraries", (req, res) => {
  try {
    res.json(ListMapItinerariesResponse.parse(getItineraries()));
  } catch (err) {
    req.log.error({ err }, "Failed to build map itineraries");
    res.status(500).json({ error: "Failed to build map itineraries" });
  }
});

/**
 * LOD exports default to inline delivery (correct for linked-data
 * dereferencing); `?download` adds a Content-Disposition attachment so
 * browsers save the serialization as a named file in every context,
 * including embedded frames where the HTML download attribute is ignored.
 */
function maybeAttachment(
  req: { query: Record<string, unknown> },
  res: { attachment: (filename: string) => unknown },
  filename: string,
): void {
  if (req.query.download !== undefined) res.attachment(filename);
}

/**
 * Every dataset-level LOD export advertises the VoID description via a
 * Link rel="describedby" header, so harvesters that land on any dump or
 * ontology serialization can discover the dataset description without
 * prior knowledge of the URL layout.
 */
function withVoidLink(res: { links: (l: Record<string, string>) => unknown }): void {
  res.links({ describedby: `${LOD_BASE}/api/lod/void.ttl` });
}

/**
 * Human-readable attribution stamped on every downloadable dataset.
 * Applied at the response layer only, so the underlying serializations,
 * their caches, and every pinned triple count remain untouched:
 * - Turtle gets "#" comment lines before the prefixes;
 * - RDF/XML gets an XML comment between the declaration and rdf:RDF;
 * - JSON-LD gets a leading "attribution" key that is deliberately NOT
 *   mapped in the @context, so JSON-LD processors drop it during
 *   expansion and the parsed triples stay identical to Turtle/RDF-XML.
 */
export const ATTRIBUTION_LINES = [
  "Humanistica Digitalia",
  "",
  "Curated and prepared by Dr. Maria Papadopoulou",
  "Assistant Professor in Digital Humanities and Classics",
  "University of Crete",
  "",
  "Licence: CC BY-NC-SA 4.0",
];

export function ttlWithAttribution(ttl: string): string {
  const header = ATTRIBUTION_LINES.map((l) => (l === "" ? "#" : `# ${l}`)).join("\n");
  return `${header}\n\n${ttl}`;
}

function rdfXmlWithAttribution(xml: string): string {
  const comment = `<!--\n${ATTRIBUTION_LINES.map((l) => `    ${l}`.trimEnd()).join("\n")}\n-->\n`;
  const declMatch = xml.match(/^<\?xml[^>]*\?>\r?\n?/);
  if (declMatch) {
    return xml.slice(0, declMatch[0].length) + comment + xml.slice(declMatch[0].length);
  }
  return comment + xml;
}

function jsonLdWithAttribution(doc: object): string {
  return JSON.stringify({ attribution: ATTRIBUTION_LINES.filter((l) => l !== ""), ...doc }, null, 2);
}

/**
 * IONOS deployment bundle download. The user fetches this with `wget` on
 * their VPS, so the zip is streamed from `exports/` at request time — a
 * freshly rebuilt bundle is served without restarting this server.
 */
function workspaceRoot(): string {
  return process.cwd().endsWith(path.join("artifacts", "api-server"))
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();
}

function streamExportZip(
  res: Parameters<Parameters<IRouter["get"]>[1]>[1],
  filename: string,
  rebuildHint: string,
): void {
  const zipPath = path.resolve(workspaceRoot(), "exports", filename);
  if (!existsSync(zipPath)) {
    res.status(404).json({
      error: `${filename} not found. Rebuild it first (${rebuildHint}).`,
    });
    return;
  }
  res.download(zipPath, filename, (err) => {
    if (err && !res.headersSent) {
      res.status(500).json({ error: `Failed to stream ${filename}.` });
    }
  });
}

router.get("/exports/laertius-ionos.zip", (_req, res) => {
  streamExportZip(
    res,
    "laertius-ionos.zip",
    "pnpm --filter @workspace/scripts run build-ionos-bundle",
  );
});

/**
 * Full project source archive: every artifact and shared package as a
 * single zip (git-tracked source only — no node_modules, build outputs,
 * caches or .env files). Built by scripts/src/build-source-archive.ts
 * and streamed from exports/ at request time like the IONOS bundle.
 */
router.get("/exports/laertius-full-source.zip", (_req, res) => {
  streamExportZip(
    res,
    "laertius-full-source.zip",
    "pnpm --filter @workspace/scripts run build-source-archive",
  );
});

/**
 * Clean source archive of the three public apps (Laertius site, Legomena
 * app + API, evaluation app) with platform tooling removed, streamed
 * from exports/ like the other bundles.
 */
router.get("/exports/laertius-legomena-eval.zip", (_req, res) => {
  streamExportZip(
    res,
    "laertius-legomena-eval.zip",
    "rebuild the clean three-app archive in exports/",
  );
});

router.get("/lod/graph.jsonld", (req, res) => {
  withVoidLink(res);
  maybeAttachment(req, res, "laertius-graph.jsonld");
  res.type("application/ld+json").send(jsonLdWithAttribution(graphAsJsonLd()));
});

router.get("/lod/graph.ttl", (req, res) => {
  withVoidLink(res);
  maybeAttachment(req, res, "laertius-graph.ttl");
  res.type("text/turtle").send(ttlWithAttribution(graphAsTurtle()));
});

router.get("/lod/graph.rdf", (req, res) => {
  withVoidLink(res);
  maybeAttachment(req, res, "laertius-graph.rdf");
  res.type("application/rdf+xml").send(rdfXmlWithAttribution(graphAsRdfXml()));
});

router.get("/lod/graph-annotated.jsonld", (req, res) => {
  withVoidLink(res);
  maybeAttachment(req, res, "laertius-graph-annotated.jsonld");
  res
    .type("application/ld+json")
    .send(jsonLdWithAttribution(annotatedGraphAsJsonLd()));
});

router.get("/lod/graph-annotated.ttl", (req, res) => {
  withVoidLink(res);
  maybeAttachment(req, res, "laertius-graph-annotated.ttl");
  res.type("text/turtle").send(ttlWithAttribution(annotatedGraphAsTurtle()));
});

router.get("/lod/graph-annotated.rdf", (req, res) => {
  withVoidLink(res);
  maybeAttachment(req, res, "laertius-graph-annotated.rdf");
  res.type("application/rdf+xml").send(rdfXmlWithAttribution(annotatedGraphAsRdfXml()));
});

router.get("/lod/section/:id.jsonld", (req, res) => {
  const doc = sectionAsJsonLd(req.params.id);
  if (!doc) {
    res.status(404).json({ error: `Unknown section: ${req.params.id}` });
    return;
  }
  maybeAttachment(req, res, `laertius-section-${req.params.id}.jsonld`);
  res.type("application/ld+json").send(jsonLdWithAttribution(doc));
});

router.get("/lod/section/:id.rdf", (req, res) => {
  const xml = sectionAsRdfXml(req.params.id);
  if (!xml) {
    res.status(404).json({ error: `Unknown section: ${req.params.id}` });
    return;
  }
  maybeAttachment(req, res, `laertius-section-${req.params.id}.rdf`);
  res.type("application/rdf+xml").send(rdfXmlWithAttribution(xml));
});

router.get("/lod/ontology.jsonld", (req, res) => {
  withVoidLink(res);
  maybeAttachment(req, res, "laertius-ontology.jsonld");
  res
    .type("application/ld+json")
    .send(jsonLdWithAttribution(ontologyAsJsonLd()));
});

router.get("/lod/ontology.ttl", (req, res) => {
  withVoidLink(res);
  maybeAttachment(req, res, "laertius-ontology.ttl");
  res.type("text/turtle").send(ttlWithAttribution(ontologyAsTurtle()));
});

router.get("/lod/ontology.rdf", (req, res) => {
  withVoidLink(res);
  maybeAttachment(req, res, "laertius-ontology.rdf");
  res.type("application/rdf+xml").send(rdfXmlWithAttribution(ontologyAsRdfXml()));
});

// FaBiO-style human-readable vocabulary documentation, generated from the
// same TBox as ontology.ttl so it can never drift from the published terms.
router.get("/lod/ontology.html", (req, res) => {
  withVoidLink(res);
  maybeAttachment(req, res, "laertius-ontology.html");
  res.type("text/html; charset=utf-8").send(ontologyAsHtml());
});

// SHACL shapes the published graph conforms to, so external consumers can
// validate the data themselves (e.g. `pyshacl -s shapes.ttl graph.ttl`).
// validate-shapes (scripts package) keeps graphAsTurtle() passing them.
router.get("/lod/shapes.ttl", (req, res) => {
  withVoidLink(res);
  maybeAttachment(req, res, "laertius-shapes.ttl");
  res.type("text/turtle").send(ttlWithAttribution(shapesAsTurtle()));
});

router.get("/lod/void.ttl", (req, res) => {
  maybeAttachment(req, res, "laertius-void.ttl");
  res.type("text/turtle").send(ttlWithAttribution(voidAsTurtle()));
});

// DCAT 3 catalog of the downloadable datasets (graphs, ontology, source
// zip), for data portals and scholarly aggregators. Complements void.ttl.
router.get("/lod/dcat.ttl", (req, res) => {
  maybeAttachment(req, res, "laertius-dcat.ttl");
  res.type("text/turtle").send(ttlWithAttribution(dcatAsTurtle()));
});

export default router;
