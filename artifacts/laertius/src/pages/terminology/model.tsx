import { TerminologyNav } from "@/components/terminology-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Download, Network } from "lucide-react";
import { usePageTitle } from "@/lib/use-page-title";

export default function TerminologyModel() {
  usePageTitle("Ontoterminology");
  return (
    <div>
      <TerminologyNav />
      <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in pb-16">

        <header className="space-y-4 border-b pb-8">
          <h1 className="text-4xl font-bold tracking-tight text-primary font-serif">
            Overview
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed font-sans">
            A formal ontology of domain concepts linked directly to a linguistic terminology of denoting terms.
          </p>
        </header>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold font-serif text-primary">The OTV Model</h2>
          <div className="prose prose-slate max-w-none font-serif leading-relaxed text-foreground/90 space-y-4">
            <p>
              This reference instrument is built following the Ontoterminology model (OTV) pioneered by Christophe Roche. The core principle of an ontoterminology is the rigorous separation of the conceptual level (the formal ontology) from the linguistic level (the terminology), connected by formal designation relations.
            </p>
            <p>
              By decoupling ideas from words, an ontoterminology avoids the ambiguities of natural language while maintaining direct traceability to the source texts. It answers both "What is the structure of this domain?" and "How is it expressed in language?" simultaneously.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-8 font-sans">
            <Card className="bg-primary/5 border-primary/10">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-lg mb-2">Conceptual Level</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><strong className="text-foreground">Concepts:</strong> The formal, abstract categories that define the domain logic. They have attributes and relations but no language.</li>
                  <li><strong className="text-foreground">Objects:</strong> Specific instances of those concepts catalogued from the real world or text.</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-secondary/30 border-border">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-lg mb-2">Linguistic Level</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><strong className="text-foreground">Terms:</strong> The linguistic expressions (in any number of languages) that denote a Concept.</li>
                  <li><strong className="text-foreground">Proper Names:</strong> The specific linguistic labels attached to instances (Objects).</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold font-serif text-primary">Coverage: Diogenes Laertius</h2>
          <div className="prose prose-slate max-w-none font-serif leading-relaxed text-foreground/90 space-y-4">
            <p>
              This ontoterminology covers the whole of Diogenes Laertius' <em>Lives of Eminent Philosophers</em>: its philosophers and schools, doctrines and sayings, places and journeys, written works, and the assertions the text cites — the full web of reference that runs through the ten books.
            </p>
            <p>
              Each of these — every philosopher, saying, place, and assertion — is catalogued as an Object instantiating a precise Concept, and each keeps the polytonic Greek term Laertius himself uses alongside its English rendering. The result is a bridge between classical philology and the semantic web: the ancient vocabulary remains intact while becoming formally queryable.
            </p>
          </div>
        </section>

        <section className="bg-muted/40 border rounded-lg p-8 text-center space-y-6">
          <h2 className="text-xl font-semibold font-sans">Open Data Export</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto font-sans">
            The complete ontoterminology is available as a formal knowledge graph in standard RDF/XML format, and as HTML term dictionaries, one per language: every term with its definition, denoted concept, and the full roster of objects instantiating it, browsable offline in any browser.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="font-sans shadow-sm">
              <a href="/api/otb/ontoterminology.rdf" download>
                <Download className="mr-2 h-4 w-4" />
                Download RDF/XML (Graph)
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="font-sans shadow-sm">
              <a href="/api/otb/dictionary.en.html" target="_blank" rel="noopener">
                <BookOpen className="mr-2 h-4 w-4" />
                Term Dictionary (English)
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="font-sans shadow-sm">
              <a href="/api/otb/dictionary.grc.html" target="_blank" rel="noopener">
                <BookOpen className="mr-2 h-4 w-4" />
                Term Dictionary (Greek)
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="font-sans shadow-sm">
              <a href="/api/otb/proper-names.en.html" target="_blank" rel="noopener">
                <BookOpen className="mr-2 h-4 w-4" />
                Proper Name Dictionary (English)
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="font-sans shadow-sm">
              <a href="/api/otb/proper-names.grc.html" target="_blank" rel="noopener">
                <BookOpen className="mr-2 h-4 w-4" />
                Proper Name Dictionary (Greek)
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="font-sans shadow-sm">
              <a href="/api/otb/viewer.html" target="_blank" rel="noopener">
                <Network className="mr-2 h-4 w-4" />
                Ontology Viewer (HTML)
              </a>
            </Button>
          </div>
        </section>

      </div>
    </div>
  );
}
