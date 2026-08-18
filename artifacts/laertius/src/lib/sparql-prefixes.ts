/**
 * Canonical SPARQL prefix declarations for the Laertius LOD graph.
 *
 * These URIs mirror the authoritative sources in the API layer:
 *   - `artifacts/api-server/src/lib/lod.ts`  (LOD_BASE, ONT, OTV)
 *   - `artifacts/api-server/src/lib/ontology-alignments.ts`  (ALIGNMENT_PREFIXES)
 *
 * Keep them in sync whenever a namespace URI changes on the server side.
 * They are imported by both `sparql-playground.tsx` (autocomplete) and any
 * other frontend module that needs the prefix map; a single edit here reaches
 * all consumers and cannot drift between them.
 */

/** Ontology base URI, matching `ONT` in lod.ts. */
const LAERTIUS_ONT = "https://humanisticadigitalia.eu/Laertius/ontology#";

/** OTV term vocabulary, matching `OTV` in lod.ts. */
const OTV_NS = "http://www.ontologia.fr/OTB/otv#";

/**
 * Map of prefix short-name to full namespace URI, covering every namespace
 * in use across the LOD graph (core W3C, the lo: ontology, alignment
 * ontologies, and domain-specific vocabularies).
 */
export const SPARQL_PREFIXES: Record<string, string> = {
  lo: LAERTIUS_ONT,
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  owl: "http://www.w3.org/2002/07/owl#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  foaf: "http://xmlns.com/foaf/0.1/",
  dcterms: "http://purl.org/dc/terms/",
  skos: "http://www.w3.org/2004/02/skos/core#",
  void: "http://rdfs.org/ns/void#",
  otv: OTV_NS,
  wd: "http://www.wikidata.org/entity/",
  crm: "http://www.cidoc-crm.org/cidoc-crm/",
  lawd: "http://lawd.info/ontology/",
  fabio: "http://purl.org/spar/fabio/",
  schema: "http://schema.org/",
  geo: "http://www.w3.org/2003/01/geo/wgs84_pos#",
};
