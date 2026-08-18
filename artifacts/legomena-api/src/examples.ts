/**
 * Curated SPARQL console examples. Every query is complete (prologue from
 * the dataset's own prefix table) and runnable against the service store;
 * the two derivation queries are the exact ones behind the /graph endpoint.
 */
import { NODE_QUERY, EDGE_QUERY } from "./derive";
import { prologue } from "./store";

export interface SparqlExampleRec {
  id: string;
  title: string;
  description: string;
  query: string;
}

export function sparqlExamples(): SparqlExampleRec[] {
  const P = prologue();
  const full = (body: string): string => `${P}\n\n${body}`;
  return [
    {
      id: "certainty-tally",
      title: "Claims by certainty",
      description:
        "How much of what Diogenes transmits does he assert outright, and how much is reported, disputed or conjectured?",
      query: full(
        `SELECT ?certainty (COUNT(?claim) AS ?claims) WHERE {
  ?claim a lo:Claim ;
         lo:certainty ?certainty .
}
GROUP BY ?certainty
ORDER BY DESC(?claims)`,
      ),
    },
    {
      id: "derived-nodes",
      title: "Graph derivation: nodes",
      description:
        "The exact query the Graph page uses to reconstruct philosopher nodes from chapter assertions.",
      query: full(NODE_QUERY),
    },
    {
      id: "derived-edges",
      title: "Graph derivation: edges",
      description:
        "The exact query the Graph page uses to pull cited relation statements between chapter subjects.",
      query: full(EDGE_QUERY),
    },
    {
      id: "disputed-reports",
      title: "Disputed claims and their authorities",
      description:
        "Claims marked lo:Disputed, with the named authority each version rests on.",
      query: full(
        `SELECT ?subject ?predicate ?object ?authority ?citation WHERE {
  ?claim a lo:Claim ;
         lo:certainty lo:Disputed ;
         rdf:subject ?s ;
         rdf:predicate ?predicate ;
         rdf:object ?object ;
         dcterms:bibliographicCitation ?citation .
  ?s rdfs:label ?subject .
  OPTIONAL {
    ?claim lo:accordingTo ?src .
    ?src rdfs:label ?authority .
  }
}
ORDER BY ?citation
LIMIT 25`,
      ),
    },
    {
      id: "transmission-chains",
      title: "Transmission chains",
      description:
        "Claims that reach Diogenes through a chain of authorities (X says that Y says that ...).",
      query: full(
        `SELECT ?claim ?authority ?citation WHERE {
  ?claim lo:transmissionChain ?link ;
         dcterms:bibliographicCitation ?citation .
  ?link lo:chainAuthority ?auth .
  ?auth rdfs:label ?authority .
}
ORDER BY ?claim ?link
LIMIT 30`,
      ),
    },
    {
      id: "annotations-of-socrates",
      title: "Where Socrates is named in the text",
      description:
        "Stand-off annotations whose body is Socrates: each row is a literal span in a passage, in Greek or English.",
      query: full(
        `SELECT ?passage ?lang ?exact WHERE {
  ?ann a oa:Annotation ;
       oa:hasBody ?entity ;
       oa:hasTarget ?target .
  ?entity rdfs:label ?l .
  FILTER(STR(?l) = "Socrates")
  ?target oa:hasSource ?passage ;
          dcterms:language ?lang ;
          oa:hasSelector ?sel .
  ?sel a oa:TextQuoteSelector ;
       oa:exact ?exact .
}
ORDER BY ?passage
LIMIT 30`,
      ),
    },
    {
      id: "conflicting-reports",
      title: "Conflicting reports",
      description:
        "Pairs of claims the dataset marks as mutually conflicting, with their citations.",
      query: full(
        `SELECT ?aCit ?bCit ?predicate WHERE {
  ?a lo:conflictsWith ?b .
  ?a dcterms:bibliographicCitation ?aCit ;
     rdf:predicate ?predicate .
  ?b dcterms:bibliographicCitation ?bCit .
}
ORDER BY ?aCit
LIMIT 25`,
      ),
    },
    {
      id: "bilingual-passages",
      title: "Bilingual passages",
      description:
        "Passage nodes carry the section text itself as literals: Greek always, English where the translation layer covers it.",
      query: full(
        `SELECT ?passage ?citation ?grc ?en WHERE {
  ?passage a lo:Passage ;
           dcterms:bibliographicCitation ?citation ;
           lo:greekText ?grc .
  OPTIONAL { ?passage lo:englishText ?en }
}
ORDER BY ?passage
LIMIT 5`,
      ),
    },
    {
      id: "school-rosters",
      title: "School membership",
      description:
        "Every cited membership assertion, including disciples who have no Life of their own.",
      query: full(
        `SELECT ?person ?school (COUNT(?stmt) AS ?statements) WHERE {
  ?stmt a rdf:Statement ;
        rdf:subject ?p ;
        rdf:predicate lo:memberOf ;
        rdf:object ?s .
  ?p rdfs:label ?person .
  ?s rdfs:label ?school .
}
GROUP BY ?person ?school
ORDER BY ?school ?person
LIMIT 50`,
      ),
    },
  ];
}
