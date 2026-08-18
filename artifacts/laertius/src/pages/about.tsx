import { usePageTitle } from "@/lib/use-page-title";
import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useGetCorpusStats } from "@workspace/api-client-react";
import { OtvDiagram } from "@/components/otv-diagram";
import { KgModelDiagram } from "@/components/kg-model-diagram";
import { KgOntologyDiagram } from "@/components/kg-ontology-diagram";
import { AssertionModelDiagram } from "@/components/assertion-model-diagram";

function num(n: number | undefined): string {
  return n === undefined ? "…" : n.toLocaleString("en-US");
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-serif text-2xl font-semibold text-foreground mt-12 mb-4">
      {children}
    </h2>
  );
}

export default function AboutPage() {
  usePageTitle("About");
  const { data: stats } = useGetCorpusStats();
  const [location] = useLocation();

  // Support deep links like /about#linked-open-data (the Legomena SPARQL
  // console links here): wouter navigation does not scroll to hashes.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) el.scrollIntoView();
  }, [location]);

  const layers: {
    href: string;
    title: string;
    count: string;
    body: React.ReactNode;
  }[] = [
    {
      href: "/graph",
      title: "Claims",
      count: num(stats?.totalClaims),
      body: (
        <>
          Biographical statements (parentage, teachers, travels, doctrines,
          deaths), each cited to the exact section that supports it. Every
          claim carries a certainty grade:{" "}
          <em>asserted</em> (Diogenes states it as fact), <em>reported</em>{" "}
          (&ldquo;some say&rdquo;), <em>disputed</em> (rival accounts, recorded
          as mutually conflicting pairs), or <em>conjectured</em>. Hedged
          reports are preserved as hedged; they are never flattened into
          facts.
        </>
      ),
    },
    {
      href: "/verses",
      title: "Verses",
      count: num(stats?.totalVerses),
      body: (
        <>
          The poems and epigrams quoted in the text, many of them Diogenes'
          own, extracted from the block quotations of the Greek edition, with
          poet attributions curated only where the text itself names the poet.
        </>
      ),
    },
    {
      href: "/sayings",
      title: "Sayings",
      count: num(stats?.totalSayings),
      body: (
        <>
          Apophthegms and memorable one-liners, curated by hand rather than
          auto-detected, because automatic extraction cannot reliably tell the
          speaker from the subject. Each saying is a verbatim excerpt in both
          English and Greek, verified against its cited section, with
          addressees and reporting authorities recorded where the text gives
          them.
        </>
      ),
    },
    {
      href: "/doxography",
      title: "Doxai",
      count: num(stats?.totalDoxai),
      body: (
        <>
          The doctrinal tenets Diogenes reports: what each philosopher
          actually held about first principles, the soul, the gods, pleasure,
          and fate, organized under a fixed set of twelve philosophical domains.
          Distinct from sayings: a doxa is a position, not a quip.
        </>
      ),
    },
    {
      href: "/anecdotes",
      title: "Anecdotes",
      count: num(stats?.totalAnecdotes),
      body: (
        <>
          The narrated incidents (Diogenes the Cynic and the lamp, Thales and
          the well), classified under a fixed set of narrative topics, with
          participants linked into the knowledge graph and cross-references to
          the sayings they frame.
        </>
      ),
    },
    {
      href: "/letters",
      title: "Letters",
      count: num(stats?.totalEpistles),
      body: (
        <>
          Every letter quoted verbatim in the <em>Lives</em>, each with a
          scholarly authenticity verdict (<em>authentic</em>,{" "}
          <em>disputed</em>, or <em>spurious</em>). Most of the corpus'
          letters are ancient forgeries, which is itself part of the story.
        </>
      ),
    },
    {
      href: "/testaments",
      title: "Testaments",
      count: num(stats?.totalTestaments),
      body: (
        <>
          The wills of Plato, Aristotle, Theophrastus, Strato, Lyco, and
          Epicurus, quoted in full. Diogenes Laertius is the sole surviving
          source for all six. Presented with cast lists (heirs, executors,
          witnesses) and key provisions.
        </>
      ),
    },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="font-serif text-4xl font-bold tracking-tight text-foreground mb-3">
          About this edition
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          A free, open scholarly companion to Diogenes Laertius'{" "}
          <em>Lives of Eminent Philosophers</em>, the single most important
          surviving source for the history of ancient Greek philosophy.
        </p>
      </header>

      <div id="the-text" className="scroll-mt-24">
        <SectionHeading>The text</SectionHeading>
      </div>
      <div className="prose-like text-foreground/90 leading-relaxed space-y-4">
        <p>
          Written in the first half of the third century CE, the{" "}
          <em>Lives</em> gathers the biographies, doctrines, wills, letters,
          verses, and table talk of {num(stats?.totalPhilosophers)} Greek
          philosophers into ten books, from Thales and the Seven Sages to
          Epicurus. For dozens of thinkers whose own works are lost, Diogenes
          is all we have. This site makes his compilation searchable,
          navigable, and machine-readable: the full Greek text with its
          English translation, a <span className="kw">hand-curated knowledge
          layer</span> over every kind of content the work contains, and a
          complete <span className="kw">Linked Open Data</span> export of the
          underlying graph.
        </p>
      </div>

      <div className="space-y-4 text-foreground/90 leading-relaxed">
        <p>
          The Greek text is the Perseus Digital Library's digitization of the{" "}
          <em>Lives</em>, divided into {num(stats?.totalSections)} sections
          across {num(stats?.totalBooks)} books. Alongside it runs R. D.
          Hicks' English translation (Loeb Classical Library, 1925), aligned
          section by section, so every passage can be read bilingually on its{" "}
          <Link href="/browse" className="underline hover:text-foreground">
            Browse
          </Link>{" "}
          and section pages. Section numbers follow the conventional{" "}
          book-and-section citation scheme used in scholarship, so references
          here can be checked against any printed edition.
        </p>
      </div>

      <div id="asking-searching" className="scroll-mt-24">
        <SectionHeading>Asking and searching</SectionHeading>
      </div>
      <div className="space-y-4 text-foreground/90 leading-relaxed">
        <p>
          <Link href="/ask" className="underline hover:text-foreground">
            Ask
          </Link>{" "}
          answers questions with ranked, cited passages and an extractive
          summary of key findings drawn word-for-word from the text.
          Biographical questions (where was Zeno born, how did Heraclitus
          die) additionally surface answer cards built from the curated
          claims, verses, and sayings. No text is generated: everything shown
          is a quotation with a citation.
        </p>
        <p>
          <Link href="/search" className="underline hover:text-foreground">
            Search
          </Link>{" "}
          is hybrid retrieval: a classical keyword index tuned for polytonic
          Greek (accent-insensitive, case-insensitive, final-sigma folding)
          is fused with a multilingual semantic index built from local
          neural embeddings, so that English queries find Greek passages and
          conceptual queries find passages that never use the query's words.
          Both channels index the Greek and English together; you can also
          switch to keyword-only or semantic-only mode.
        </p>
      </div>

      <div id="curated-layers" className="scroll-mt-24">
        <SectionHeading>The curated layers</SectionHeading>
      </div>
      <div className="space-y-4 text-foreground/90 leading-relaxed">
        <p>
          Full-text search finds passages; it cannot tell you who said what,
          which reports conflict, or what a philosopher actually taught. That
          requires structured data, and structured data over an ancient
          compiler requires judgment. The heart of this project is a set of
          hand-curated, fully cited layers over the text:
        </p>
      </div>
      <div className="mt-6 space-y-5">
        {layers.map((layer) => (
          <div
            key={layer.href}
            id={`layer-${layer.href.replace("/", "")}`}
            className="scroll-mt-24"
          >
            <h3 className="font-medium text-foreground">
              <Link href={layer.href} className="hover:underline">
                {layer.title}
              </Link>{" "}
              <span className="text-muted-foreground font-normal text-sm">
                · {layer.count}
              </span>
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mt-1">
              {layer.body}
            </p>
          </div>
        ))}
      </div>

      <div id="assertion-model" className="scroll-mt-24">
        <SectionHeading>Assertions</SectionHeading>
      </div>
      <div className="space-y-4 text-foreground/90 leading-relaxed">
        <p>
          The curated layers share one conceptual shape.
          Every unit of curated knowledge is an <em>assertion</em>: someone
          asserts something, in some document, about some topic, with some
          confidence. The reference model behind the dataset spells this out
          as a small system of concepts:
        </p>
      </div>
      <AssertionModelDiagram />

      <div id="knowledge-graph" className="scroll-mt-24">
        <SectionHeading>The Knowledge Graph of Successions</SectionHeading>
      </div>
      <div className="space-y-4 text-foreground/90 leading-relaxed">
        <p>
          The{" "}
          <Link href="/graph" className="underline hover:text-foreground">
            Graph
          </Link>{" "}
          page draws the network of teachers, students, schools, and
          influences recorded in the text, including the succession trees
          (<span lang="grc">διαδοχαί</span>) that organize the whole work: Ionian and Italian lines
          descending from Thales and Pythagoras. Every edge is cited; every
          node corresponds to a name that actually occurs in the corpus, so
          the graph can never drift from the text it describes.
        </p>
        <p>
          The graph is not a separate dataset: it is derived, node by node and
          edge by edge, from the assertion store — the two derivation queries
          are published as examples in the{" "}
          <Link href="/legomena/sparql" className="underline hover:text-foreground">
            SPARQL console
          </Link>
          , so the whole picture can be reproduced from the cited claims. The
          philosophers, schools, and names it draws are the same entities
          published in the Linked Open Data dataset, where they carry their
          Greek name forms and alignments to external vocabularies.
        </p>
        <p>
          Around the graph sit further curated reference layers: a{" "}
          <Link href="/timeline" className="underline hover:text-foreground">
            Timeline
          </Link>{" "}
          of dateable lives built strictly from the dates the claims
          themselves record; a{" "}
          <Link href="/map" className="underline hover:text-foreground">
            Map
          </Link>{" "}
          of every locatable place in the work, with cited biographical
          events and reconstructed life journeys (birth to residences to
          death, drawn only from located claims and never across rival
          accounts of the same event); and an{" "}
          <Link href="/entities" className="underline hover:text-foreground">
            Index
          </Link>{" "}
          of all {num(stats?.taggedEntities)} tagged names and terms.
        </p>
      </div>

      <div id="names-in-the-text" className="scroll-mt-24">
        <SectionHeading>Proper Names</SectionHeading>
      </div>
      <div className="space-y-4 text-foreground/90 leading-relaxed">
        <p>
          Every occurrence of a philosopher, person, place, work, school, or
          Greek philosophical term is tagged in both languages and highlighted on the
          section pages, where clicking a name opens its entity panel. The
          tagging runs on curated
          name lists, including roughly 1,400 hand-checked inflected forms of
          Greek names, with explicit per-section rules for the corpus' many
          homonyms. Where a bare name like &ldquo;Zeno&rdquo; or
          &ldquo;Diogenes&rdquo; genuinely cannot be resolved, it is left
          untagged rather than guessed.
        </p>
      </div>

      <div id="linked-open-data" className="scroll-mt-24">
        <SectionHeading>FAIR Data and Linked Open Data</SectionHeading>
      </div>
      <div className="space-y-4 text-foreground/90 leading-relaxed">
        <p>
          The dataset follows the FAIR principles (Findable, Accessible,
          Interoperable, and Reusable) and is published as Linked Open
          Data through the project ontology. Every entity, claim, and passage
          has a stable URI, while the text is identified through Perseus CTS
          URNs. The knowledge layer represents philosophers, places, schools,
          works, claims, verses, sayings, anecdotes, letters, testaments, and
          doxai, with hedged, disputed, or attributed statements modelled as
          claims with explicit provenance rather than as unsupported facts.
          The complete graph is freely downloadable in JSON-LD, Turtle, and
          RDF/XML and can be queried through a public, read-only SPARQL
          endpoint. An annotated distribution additionally provides the
          complete bilingual text and all entity-name annotations as
          stand-off W3C Web Annotations, while each section page offers a
          one-hop subgraph. The graph uses established vocabularies,
          including CIDOC CRM and SKOS, and links to Wikidata, DBpedia,
          VIAF, InPhO, and Pleiades. A{" "}
          <a
            href={`${import.meta.env.BASE_URL}api/lod/void.ttl`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            VoID dataset description
          </a>{" "}
          documents the data dumps, SPARQL endpoint, vocabularies, CIDOC CRM
          alignments, and external linksets; every LOD download also points
          to it through a <code className="text-sm">describedby</code> HTTP
          link header. Reuse is governed by the CC BY-NC-SA 4.0 licence,
          stated both on the website and within the data itself, and every
          claim includes a citation to the relevant book and section of the{" "}
          <em>Lives</em>.
        </p>
        <KgModelDiagram />
        <KgOntologyDiagram />
        <p>
          Nodes are linked to the wider web of scholarly data: Wikidata,
          VIAF, the Encyclopaedia Britannica, DBpedia, the Internet
          Encyclopedia of Philosophy's InPhO, Philosophy Pages, and, for all
          places, Pleiades gazetteer identifiers. A terminological layer
          following the ontoterminology model records the proper names and
          Greek terms themselves as linguistic objects, distinct from the
          concepts and persons they denote. Read this way, the domain of the
          work unfolds as a tree of concepts built by specific differences,
          each designated by the terms Diogenes actually uses:
        </p>
        <OtvDiagram />
        <p>
          The ontology is also linked to external standards. Its classes
          are declared as subclasses of CIDOC CRM terms where the local
          meaning is narrower. The closed vocabularies (roles, place
          types, work facets) are mapped to Wikidata with SKOS: exactMatch
          when the concepts are identical, closeMatch when they are close
          but not the same, and no mapping when a match would be a guess.
          These links apply only to concepts; names and terms stay local.
        </p>
        <p>
          Cited authorities get their own bibliographic index: the sources
          Diogenes names (Apollodorus' <em>Chronology</em>, Sotion's{" "}
          <em>Successions</em>, Pamphila's <em>Memorabilia</em>), with{" "}
          {num(stats?.sourceCitations)} individual citations carrying
          canonical text references, a window onto the lost library he
          compiled from.
        </p>
        <p>
          Where Diogenes names not just the authority but the specific work
          the assertion comes from, the claim carries an{" "}
          <code className="text-sm">lo:assertedInWork</code> link to that
          work's node; where he reports an assertion at second hand
          (&ldquo;Sosicrates quotes Hermippus&rdquo;), the intermediary is
          modelled as an ordered{" "}
          <code className="text-sm">lo:transmissionChain</code> of links,
          each naming the authority (and, when given, the work) through
          which the report passed.
        </p>
        <p>
          The curated LOD graph is served at{" "}
          <code className="text-sm">/api/lod/sparql</code> (GET with a
          url-encoded <code className="text-sm">query</code> parameter, or
          POST as <code className="text-sm">application/sparql-query</code>).
          Runnable example queries against it live in the{" "}
          <Link
            href="/legomena/sparql"
            className="underline hover:text-foreground"
          >
            SPARQL console
          </Link>
          , which also queries the assertion store — the graph of who asserts
          what, in which passage, with what confidence. The two graphs use
          different vocabularies, so the console lets you pick the store a
          query is written for.
        </p>
      </div>

      <SectionHeading>Sources and acknowledgements</SectionHeading>
      <div className="space-y-4 text-foreground/90 leading-relaxed">
        <p>
          The Greek text is from the{" "}
          <a
            href="https://scaife.perseus.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Perseus Digital Library
          </a>
          ; the English translation is R. D. Hicks (1925), in the public
          domain. Place locations draw on the{" "}
          <a
            href="https://pleiades.stoa.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Pleiades
          </a>{" "}
          gazetteer of ancient places; external identifiers come from{" "}
          <a
            href="https://www.wikidata.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Wikidata
          </a>{" "}
          and{" "}
          <a
            href="https://viaf.org/viaf/about"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            VIAF
          </a>
          ; map tiles are © OpenStreetMap contributors. The curated layers,
          ontology, and all editorial judgments are original work of this
          project.
        </p>
        <p>
          This site is a project of{" "}
          <a
            href="https://humanisticadigitalia.eu"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            <em>Humanistica Digitalia</em>
          </a>
          , a curated digital library of tools and scholarly resources for
          the study of Ancient Greek and Latin, developed by Dr Maria
          Papadopoulou at the Department of Philology and the TALOS AI4SSH
          Lab, University of Crete. Its
          contents are released under the{" "}
          <a
            href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Creative Commons Attribution–NonCommercial–ShareAlike 4.0 license
            (CC BY-NC-SA 4.0)
          </a>
          .
          Questions, corrections, and scholarly collaboration are welcome:{" "}
          <a
            href="mailto:maria.papadopoulou@uoc.gr"
            className="underline hover:text-foreground"
          >
            maria.papadopoulou@uoc.gr
          </a>
          .
        </p>
      </div>

      <div className="mt-12 pt-6 border-t border-border text-sm text-muted-foreground leading-relaxed font-serif">
        Start exploring with{" "}
        <Link href="/ask" className="underline hover:text-foreground">
          a question
        </Link>
        , a{" "}
        <Link href="/browse" className="underline hover:text-foreground">
          book
        </Link>
        , or the{" "}
        <Link href="/graph" className="underline hover:text-foreground">
          graph
        </Link>
        .
      </div>
    </div>
  );
}
