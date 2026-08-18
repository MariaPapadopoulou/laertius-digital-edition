import { Link } from "wouter";
import { useGetCorpusStats } from "@workspace/api-client-react";

function num(n: number | undefined): string {
  return n === undefined ? "…" : n.toLocaleString("en-US");
}

export function MethodPillars() {
  const { data: stats } = useGetCorpusStats();

  const pillars: {
    kicker: string;
    title: string;
    body: React.ReactNode;
    links: { href: string; label: string }[];
  }[] = [
    {
      kicker: "Semantic annotation",
      title: "A new way of reading",
      body: (
        <>
          Every occurrence of a philosopher, person, place, work, school, or
          Greek term is tagged against a{" "}
          <span className="kw">formal ontology</span>: {num(stats?.totalAnnotations)}{" "}
          annotations across {num(stats?.taggedEntities)} entities, in both
          languages. A name in the text stops being ink on a page: click it
          and the corpus answers with everything it records about that
          entity, from its inflected Greek forms to its place in the
          terminological system.
        </>
      ),
      links: [
        { href: "/browse", label: "Read the tagged text" },
        { href: "/entities", label: "Open the Index" },
        { href: "/terminology", label: "Ontoterminology" },
      ],
    },
    {
      kicker: "Knowledge representation",
      title: "The text as a knowledge graph",
      body: (
        <>
          What Diogenes reports is represented as structured, interconnected
          knowledge: {num(stats?.totalClaims)} source-linked claims with
          explicit levels of certainty, together with philosophical
          successions, chronologies, and itineraries. Published as{" "}
          <span className="kw">Linked Open Data</span>, aligned with an
          established ontology, and accessible through a SPARQL endpoint, the
          compilation becomes machine-actionable while preserving its
          epistemic nuance. When the text says &ldquo;some say,&rdquo; the
          knowledge graph records a <em>reported</em> claim, not an
          established fact.
        </>
      ),
      links: [
        { href: "/graph", label: "Explore the graph" },
        { href: "/about#knowledge-graph", label: "How the graph is built" },
        { href: "/competency", label: "Competency questions" },
        { href: "/stats", label: "Data & downloads" },
      ],
    },
    {
      kicker: "Hybrid AI",
      title: "Neural retrieval, symbolic knowledge",
      body: (
        <>
          Search combines a keyword index optimized for polytonic Greek with a
          multilingual neural embedding index that runs entirely locally,
          requiring neither API keys nor external services. The system
          retrieves evidence from the curated textual and knowledge layers,
          returning{" "}
          <span className="kw">verbatim quotations with precise citations</span>.
          Neural methods handle linguistic variation and semantic similarity;
          symbolic methods preserve factual precision and traceable
          relationships. No generative model fills the gaps or rewrites the
          sources.
        </>
      ),
      links: [
        { href: "/", label: "Ask a question" },
        { href: "/search", label: "Try hybrid search" },
      ],
    },
    {
      kicker: "Text reuse",
      title: "Making a compilation legible",
      body: (
        <>
          The <em>Lives</em> is fundamentally a work of{" "}
          <span className="kw">textual reuse</span>. Diogenes constructs his
          account by quoting, excerpting, and paraphrasing hundreds of earlier
          works, most of which have since been lost. The edition indexes every
          named authority ({num(stats?.sourceCitations)} citations linked to
          canonical references) and identifies each embedded text, including{" "}
          {num(stats?.totalVerses)} verses, {num(stats?.totalEpistles)}{" "}
          letters, and {num(stats?.totalTestaments)} wills preserved in full.
          This provides a new digital basis for <em>Quellenforschung</em>:
          scholars can trace attributions, examine patterns of quotation and
          reuse, and explore how Diogenes selected, reshaped, and transmitted
          his sources. Read through these layers, the <em>Lives</em> becomes
          more than a collection of philosophical biographies: it offers a
          partial reconstruction of the lost library from which it was
          assembled.
        </>
      ),
      links: [
        { href: "/stats", label: "Cited authorities" },
        { href: "/verses", label: "Quoted verses" },
        { href: "/testaments", label: "Wills quoted in full" },
      ],
    },
  ];

  return (
    <section className="max-w-5xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
          Why this approach
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
          The project is built around four interconnected ideas:
          ontology-based semantic annotation as a new mode of reading; formal
          knowledge representation; hybrid AI that combines neural retrieval
          with symbolic knowledge; and the explicit modelling of textual
          reuse.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {pillars.map((p) => (
          <div
            key={p.kicker}
            className="bg-card border border-border rounded-xl shadow-sm p-6 flex flex-col"
          >
            <div className="text-[11px] uppercase tracking-[0.2em] text-primary mb-2">
              {p.kicker}
            </div>
            <h2 className="font-serif text-lg font-semibold text-foreground mb-2">
              {p.title}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed flex-1">
              {p.body}
            </p>
            <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-x-4 gap-y-1">
              {p.links.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className="inline-block py-1 text-xs text-primary hover:underline"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
