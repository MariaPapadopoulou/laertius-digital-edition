import { usePageTitle } from "@/lib/use-page-title";
import { AboutLink } from "@/components/about-link";
import { useListTestaments } from "@workspace/api-client-react";
import { TestamentCard } from "@/components/testament-card";
import { Loader2 } from "lucide-react";

export default function TestamentsPage() {
  usePageTitle("Testaments");
  const { data: testaments, isLoading } = useListTestaments();

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-serif font-bold text-foreground">
          Testaments
        </h1>
        <p className="text-muted-foreground">
          The <span className="italic">Lives</span> preserve six wills: those
          of Plato, Aristotle, Theophrastus, Strato, Lyco, and Epicurus.
          Diogenes Laertius is the only surviving source for all six. The
          wills record estates, libraries, freed slaves, funeral instructions,
          beneficiaries, executors, witnesses, and the future of the
          philosophers&rsquo; schools.
        </p>
        <AboutLink anchor="layer-testaments" label="About the curated layers" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading testaments...
        </div>
      ) : (
        <div className="space-y-6">
          <div className="text-sm text-muted-foreground px-1 flex items-center gap-2">
            {testaments ? `${testaments.length} wills` : null}
          </div>
          <div className="space-y-6">
            {(testaments ?? []).map((testament) => (
              <TestamentCard key={testament.id} testament={testament} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
