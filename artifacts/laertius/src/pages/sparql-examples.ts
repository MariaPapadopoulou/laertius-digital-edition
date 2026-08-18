/**
 * The About page's example SPARQL queries, kept in their own module so the
 * validate-sparql-examples validator (scripts/src/validate-sparql-examples.ts)
 * can import and execute the exact same queries against the in-process
 * oxigraph store. Editing a query here changes both the page and the
 * validator, so they cannot drift apart.
 */
export const sparqlExamples: { title: string; body: string; query: string }[] =
  [
    {
      title: "Concepts aligned to Wikidata",
      body: "Only the LOD dataset carries the edition's concept vocabulary and its alignments to external standards: each row is a concept with the Wikidata entity it maps to via skos:exactMatch.",
      query: `PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?concept ?wikidata WHERE {
  ?c skos:exactMatch ?wikidata ;
     rdfs:label ?concept .
  FILTER(LANG(?concept) = "en")
}
ORDER BY ?concept
LIMIT 25`,
    },
    {
      title: "Greek proper names and their bearers",
      body: "Another LOD-only layer: proper names as linguistic nodes (otv:ProperName). Each row pairs a Greek name form with the entity it denotes.",
      query: `PREFIX otv: <http://www.ontologia.fr/OTB/otv#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?greekName ?entity WHERE {
  ?pn a otv:ProperName ;
      otv:properName ?greekName ;
      otv:language "grc" ;
      otv:denotedObject ?e .
  ?e rdfs:label ?entity .
  FILTER(LANG(?entity) = "en")
}
ORDER BY ?greekName
LIMIT 25`,
    },
    {
      title: "Claims asserted in a named work",
      body: "Everything Diogenes cites specifically from Apollodorus' Chronology: the philosopher, the statement, and the passage where he says so.",
      query: `PREFIX lo: <https://humanisticadigitalia.eu/Laertius/ontology#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dcterms: <http://purl.org/dc/terms/>
SELECT ?philosopher ?statement ?cite WHERE {
  ?claim lo:assertedInWork ?work ;
         rdf:subject/rdfs:label ?philosopher ;
         rdf:object ?statement ;
         dcterms:bibliographicCitation ?cite .
  ?work rdfs:label "Chronology"@en .
  FILTER(LANG(?philosopher) = "en")
}
ORDER BY ?cite`,
    },
    {
      title: "Claims transmitted at second hand",
      body: "All claims that reached Diogenes through an intermediary, with the authority the report passed through.",
      query: `PREFIX lo: <https://humanisticadigitalia.eu/Laertius/ontology#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?claim ?statement ?viaAuthority WHERE {
  ?claim lo:transmissionChain ?link ;
         rdf:object ?statement .
  ?link lo:chainAuthority/rdfs:label ?viaAuthority .
  FILTER(LANG(?viaAuthority) = "en")
}`,
    },
    {
      title: "The full provenance path",
      body: "For each chained claim, the whole line of transmission in one row: who the claim is about, the authority Diogenes names, the intermediary it passed through, and the citation.",
      query: `PREFIX lo: <https://humanisticadigitalia.eu/Laertius/ontology#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dcterms: <http://purl.org/dc/terms/>
SELECT ?philosopher ?statement ?authority ?viaAuthority ?cite WHERE {
  ?claim lo:transmissionChain ?link ;
         rdf:subject/rdfs:label ?philosopher ;
         rdf:object ?statement ;
         lo:accordingTo/rdfs:label ?authority ;
         dcterms:bibliographicCitation ?cite .
  ?link lo:chainAuthority/rdfs:label ?viaAuthority .
  FILTER(LANG(?philosopher) = "en")
  FILTER(LANG(?authority) = "en")
  FILTER(LANG(?viaAuthority) = "en")
}`,
    },
    {
      title: "Export a philosopher's claims as RDF",
      body: "A CONSTRUCT query returns triples instead of rows: this one extracts every claim about Pythagoras — statement, authority, and citation, with human-readable labels — as a small self-contained graph you can save as Turtle and reuse in your own tools.",
      query: `PREFIX lo: <https://humanisticadigitalia.eu/Laertius/ontology#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dcterms: <http://purl.org/dc/terms/>
CONSTRUCT {
  ?claim rdf:subject ?philosopher ;
         rdf:object ?statement ;
         lo:accordingTo ?authority ;
         dcterms:bibliographicCitation ?cite .
  ?philosopher rdfs:label ?philosopherLabel .
  ?authority rdfs:label ?authorityLabel .
} WHERE {
  ?claim rdf:subject ?philosopher ;
         rdf:object ?statement ;
         dcterms:bibliographicCitation ?cite .
  ?philosopher rdfs:label ?philosopherLabel .
  FILTER(LANG(?philosopherLabel) = "en")
  FILTER(STR(?philosopherLabel) = "Pythagoras")
  OPTIONAL {
    ?claim lo:accordingTo ?authority .
    ?authority rdfs:label ?authorityLabel .
    FILTER(LANG(?authorityLabel) = "en")
  }
}`,
    },
  ];
