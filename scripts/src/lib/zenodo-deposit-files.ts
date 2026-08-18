/**
 * Single source of truth for the contents of exports/zenodo-deposit/:
 * every file of the Zenodo deposition package (all LOD serializations,
 * README.md, .zenodo.json) is produced here, so the build script
 * (build-zenodo-deposit.ts) and the drift validator
 * (validate-export-snapshots.ts) can never disagree about what the
 * checked-in snapshot should contain.
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../../artifacts/api-server/data",
);

export interface DepositBundle {
  /** file name (relative to exports/zenodo-deposit) -> exact content */
  files: Record<string, string>;
  stats: { triples: number; annotatedTriples: number };
}

export async function buildDepositFiles(): Promise<DepositBundle> {
  const {
    graphAsTurtle,
    graphAsJsonLd,
    graphAsRdfXml,
    annotatedGraphAsTurtle,
    annotatedGraphAsJsonLd,
    annotatedGraphAsRdfXml,
    ontologyAsTurtle,
    ontologyAsJsonLd,
    ontologyAsRdfXml,
    voidAsTurtle,
    voidStats,
  } = await import("../../../artifacts/api-server/src/lib/lod");

  const description =
    "Linked open data of the Laertius digital scholarly edition " +
    "(https://humanisticadigitalia.eu/Laertius): a hand-curated knowledge " +
    "graph of Diogenes Laertius' Lives of Eminent Philosophers, with a " +
    "documented OWL ontology, an ontoterminological layer (OTV), a " +
    "stand-off annotation layer over the Greek text (W3C Web Annotation), " +
    "and alignments to Wikidata, VIAF and Pleiades. Every claim carries a " +
    "citation to book and section of the Lives (Perseus CTS URNs).";

  const readme = `# Laertius: Linked Open Data of the Lives of Eminent Philosophers

${description}

## Contents

| File | Description |
| --- | --- |
| graph.ttl / graph.jsonld / graph.rdf | The curated knowledge graph (Turtle, JSON-LD, RDF/XML) |
| graph-annotated.ttl / .jsonld / .rdf | The graph plus passage nodes and the stand-off annotation layer |
| ontology.ttl / .jsonld / .rdf | The project ontology with external alignments (CIDOC CRM, SKOS/Wikidata) and the mirrored OTV core |
| void.ttl | VoID description of the dataset |

## Provenance and citation

Curated by Dr Maria Papadopoulou (Department of Philology and TALOS
AI4SSH Lab, University of Crete) as part of Humanistica Digitalia
(https://humanisticadigitalia.eu). The Greek text and English translation
derive from the Perseus Digital Library edition of Diogenes Laertius
(R.D. Hicks, 1925); the curated layers, ontology and all editorial
judgments are original work of this project.

## License

Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
(CC BY-NC-SA 4.0), https://creativecommons.org/licenses/by-nc-sa/4.0/.
The license is also asserted inside the data (dcterms:license).

## Live version

The edition, its SPARQL endpoint and per-passage exports are published at
https://humanisticadigitalia.eu/Laertius.
`;

  const zenodoJson =
    JSON.stringify(
      {
        title:
          "Laertius: Linked Open Data of Diogenes Laertius' Lives of Eminent Philosophers",
        description,
        creators: [
          {
            name: "Papadopoulou, Maria",
            affiliation:
              "Department of Philology and TALOS AI4SSH Lab, University of Crete",
          },
        ],
        license: "CC-BY-NC-SA-4.0",
        upload_type: "dataset",
        access_right: "open",
        keywords: [
          "Diogenes Laertius",
          "ancient Greek philosophy",
          "linked open data",
          "knowledge graph",
          "digital scholarly edition",
          "ontology",
          "ontoterminology",
          "Web Annotation",
          "digital humanities",
        ],
        related_identifiers: [
          {
            identifier: "https://humanisticadigitalia.eu/Laertius",
            relation: "isSupplementTo",
            scheme: "url",
          },
        ],
      },
      null,
      2,
    ) + "\n";

  const files: Record<string, string> = {
    "graph.ttl": graphAsTurtle(),
    "graph.jsonld": JSON.stringify(graphAsJsonLd(), null, 2),
    "graph.rdf": graphAsRdfXml(),
    "graph-annotated.ttl": annotatedGraphAsTurtle(),
    "graph-annotated.jsonld": JSON.stringify(
      annotatedGraphAsJsonLd(),
      null,
      2,
    ),
    "graph-annotated.rdf": annotatedGraphAsRdfXml(),
    "ontology.ttl": ontologyAsTurtle(),
    "ontology.jsonld": JSON.stringify(ontologyAsJsonLd(), null, 2),
    "ontology.rdf": ontologyAsRdfXml(),
    "void.ttl": voidAsTurtle(),
    "README.md": readme,
    ".zenodo.json": zenodoJson,
  };

  const stats = voidStats();
  return {
    files,
    stats: {
      triples: stats.triples,
      annotatedTriples: stats.annotatedTriples,
    },
  };
}
