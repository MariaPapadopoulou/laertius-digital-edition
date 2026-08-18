import { usePageTitle } from "@/lib/use-page-title";
import { grcSpans } from "@/lib/grc";
import { Link } from "wouter";
import { useGetDetailedStats, useGetOtbOverview } from "@workspace/api-client-react";
import { CountUp } from "@/components/count-up";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const CERTAINTY_COLOR: Record<string, string> = {
  asserted: "bg-emerald-500/80",
  reported: "bg-amber-500/80",
  disputed: "bg-red-500/80",
  conjectured: "bg-slate-400/80",
};

const CERTAINTY_GLOSS: Record<string, string> = {
  asserted: "stated as fact",
  reported: "“some say”, hedged report",
  disputed: "rival accounts recorded",
  conjectured: "explicit conjecture",
};

const AUTHENTICITY_COLOR: Record<string, string> = {
  authentic: "bg-emerald-500/80",
  disputed: "bg-amber-500/80",
  spurious: "bg-red-500/70",
};

const SURVIVAL_COLOR: Record<string, string> = {
  lost: "bg-slate-400/70",
  excerpts: "bg-amber-500/80",
  extant: "bg-emerald-500/80",
  unasserted: "bg-slate-300/70",
};

const SURVIVAL_GLOSS: Record<string, string> = {
  lost: "only the title survives",
  excerpts: "survives in quoted fragments",
  extant: "preserved entire or substantially",
  unasserted: "divergent transmission (conflated titles)",
};

const KIND_LABEL: Record<string, string> = {
  philosopher: "Philosophers",
  person: "Other persons",
  place: "Places",
  work: "Works",
  source: "Cited sources",
  school: "Schools",
  term: "Greek terms",
};

const PROPERTY_LABEL: Record<string, string> = {
  parentage: "Family",
  birthPlace: "Birthplace",
  birthDate: "Birth date",
  education: "Education",
  studiedUnder: "Teachers",
  affiliatedWith: "School",
  livedIn: "Residences",
  traveledTo: "Travels",
  oldAge: "Old age",
  deme: "Deme",
  deathDate: "Death date",
  deathPlace: "Place of death",
  mannerOfDeath: "Manner of death",
  writings: "Writings (summary)",
  wrote: "Works written",
  heldDoctrine: "Doctrines held",
  praised: "Praise",
  criticized: "Criticism",
  succession: "Succession",
};

function centuryLabel(c: number): string {
  const n = Math.abs(c);
  const suffix =
    n % 10 === 1 && n % 100 !== 11
      ? "st"
      : n % 10 === 2 && n % 100 !== 12
        ? "nd"
        : n % 10 === 3 && n % 100 !== 13
          ? "rd"
          : "th";
  return `${n}${suffix} c. ${c < 0 ? "BCE" : "CE"}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function SectionCard({
  title,
  subtitle,
  href,
  id,
  children,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id}>
      <div className="pb-3 mb-6 border-b border-border/60 flex items-baseline gap-2">
        <h2 className="font-serif text-2xl text-foreground">
          {href ? (
            <Link href={href} className="hover:text-primary hover:underline">
              {title}
            </Link>
          ) : (
            title
          )}
        </h2>
        {subtitle && (
          <span className="text-xs text-muted-foreground ml-1">{subtitle}</span>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function BarRow({
  label,
  count,
  max,
  color = "bg-primary/70",
  gloss,
  href,
}: {
  label: string;
  count: number;
  max: number;
  color?: string;
  gloss?: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="w-36 shrink-0 truncate text-foreground" title={gloss ?? label}>
        {label}
      </span>
      <div className="flex-1 h-4 rounded-full bg-muted/60 overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.max((count / max) * 100, 1.5)}%` }}
        />
      </div>
      <span className="w-12 shrink-0 text-right tabular-nums font-medium text-foreground">
        {count.toLocaleString("en-US")}
      </span>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="flex items-center gap-3 text-sm rounded-md -mx-1 px-1 hover:bg-muted/40 transition-colors"
      >
        {body}
      </Link>
    );
  }
  return <div className="flex items-center gap-3 text-sm">{body}</div>;
}

function MiniStat({ n, label, href }: { n: number; label: string; href?: string }) {
  const body = (
    <>
      <div className="text-2xl font-serif font-bold text-foreground tabular-nums">
        <CountUp value={n} />
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </>
  );
  const base = "rounded-lg bg-muted/30 px-4 py-3 text-center";
  if (!href) return <div className={base}>{body}</div>;
  const linked = `${base} block hover:border-primary/40 hover:bg-muted/40 transition-colors`;
  if (href.startsWith("#")) {
    return (
      <a href={href} className={linked}>
        {body}
      </a>
    );
  }
  return (
    <Link href={href} className={linked}>
      {body}
    </Link>
  );
}

export default function StatsPage() {
  usePageTitle("Statistics & LOD");
  const { data: stats, isLoading, isError } = useGetDetailedStats();
  const { data: otb } = useGetOtbOverview();

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center gap-4 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
        <p className="font-serif">Counting the corpus…</p>
      </div>
    );
  }
  if (isError || !stats) {
    return (
      <div className="py-24 text-center text-muted-foreground font-serif">
        Statistics could not be loaded.
      </div>
    );
  }

  const maxSections = Math.max(...stats.books.map((b) => b.sections));
  const maxCentury = Math.max(...stats.works.byCentury.map((c) => c.count), 1);
  const totalCerts = stats.claims.total;
  const maxProp = Math.max(...stats.claims.byProperty.map((p) => p.count), 1);
  const maxSayTopic = Math.max(...stats.sayings.byTopic.map((t) => t.count), 1);
  const maxAnecTopic = Math.max(
    ...stats.anecdotes.byTopic.map((t) => t.count),
    1,
  );
  const maxKind = Math.max(
    ...stats.entities.byKind.map((k) => k.occurrences),
    1,
  );
  const maxWorkTopic = Math.max(...stats.works.byTopic.map((t) => t.count), 1);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-4 pt-4 pb-2">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground tracking-tight">
          The Lives in Numbers
        </h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat n={stats.books.reduce((n, b) => n + b.sections, 0)} label="passages, Greek with aligned English" href="/browse" />
        <MiniStat n={stats.books.reduce((n, b) => n + b.lives, 0)} label="lives across ten books" href="/browse" />
        <MiniStat n={stats.entities.annotations} label="tags" href="/entities" />
        <MiniStat n={stats.lod.triples} label="RDF triples in the annotated graph" href="#lod" />
      </div>

      <SectionCard
        title="The ten books"
        href="/browse"
      >
        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Scrollable statistics table"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left py-2 pr-2 font-medium">Book</th>
                <th className="text-left py-2 pr-2 font-medium min-w-[220px]">Sections</th>
                <th className="text-right py-2 px-2 font-medium">Lives</th>
                <th className="text-right py-2 px-2 font-medium">Claims</th>
                <th className="text-right py-2 px-2 font-medium">Verses</th>
                <th className="text-right py-2 px-2 font-medium">Sayings</th>
                <th className="text-right py-2 px-2 font-medium">Doxai</th>
                <th className="text-right py-2 pl-2 font-medium">Anecdotes</th>
              </tr>
            </thead>
            <tbody>
              {stats.books.map((b) => (
                <tr key={b.book} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-2 whitespace-nowrap">
                    <span className="font-serif font-semibold text-foreground">
                      {b.book}.
                    </span>{" "}
                    <span className="text-muted-foreground">{b.label}</span>
                  </td>
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-3 rounded-full bg-muted/60 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{ width: `${(b.sections / maxSections) * 100}%` }}
                        />
                      </div>
                      <span className="w-9 text-right tabular-nums text-foreground">
                        {b.sections}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">{b.lives}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{b.claims}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{b.verses}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{b.sayings}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{b.doxai}</td>
                  <td className="py-2 pl-2 text-right tabular-nums">{b.anecdotes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Cited claims"
        href="/graph"
      >
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <MiniStat n={stats.claims.total} label="cited claims" />
              <MiniStat n={stats.claims.withGreekExcerpt} label="verbatim Greek excerpts" />
              <MiniStat n={stats.claims.conflictPairs} label="pairs of rival accounts" />
            </div>
            <div className="space-y-2">
              {stats.claims.byCertainty.map((c) => (
                <div key={c.name} className="space-y-0.5">
                  <BarRow
                    label={capitalize(c.name)}
                    count={c.count}
                    max={totalCerts}
                    color={CERTAINTY_COLOR[c.name] ?? "bg-primary/70"}
                    gloss={CERTAINTY_GLOSS[c.name]}
                  />
                  <p className="text-[11px] text-muted-foreground pl-[9.75rem]">
                    {CERTAINTY_GLOSS[c.name]}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Where Diogenes Laertius records rival reports of the same fact,
              both claims are kept and linked; explore them on the{" "}
              <Link href="/graph" className="text-primary underline underline-offset-2">
                graph
              </Link>{" "}
              and in each life's claims panel.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              What the claims record
            </h3>
            {stats.claims.byProperty.slice(0, 12).map((p) => (
              <BarRow
                key={p.name}
                label={PROPERTY_LABEL[p.name] ?? p.name}
                count={p.count}
                max={maxProp}
              />
            ))}
          </div>
        </div>
      </SectionCard>

      <div className="grid md:grid-cols-2 gap-8">
        <SectionCard
          title="Sayings"
          href="/sayings"
          subtitle={`${stats.sayings.total} apophthegms from ${stats.sayings.speakers} philosophers`}
        >
          <div className="space-y-2">
            {stats.sayings.byTopic.map((t) => (
              <BarRow
                key={t.name}
                label={capitalize(t.name)}
                count={t.count}
                max={maxSayTopic}
              />
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border/60">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">
              Most quoted
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {stats.sayings.topSpeakers.map((s) => (
                <Link
                  key={s.name}
                  href={`/sayings?philosopher=${encodeURIComponent(s.name)}`}
                  className="px-2.5 py-1 rounded-full border border-border bg-muted/30 text-xs hover:border-primary/40 transition-colors"
                >
                  {s.name}{" "}
                  <span className="font-semibold tabular-nums">{s.count}</span>
                </Link>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Anecdotes"
          href="/anecdotes"
          subtitle={`${stats.anecdotes.total} incidents about ${stats.anecdotes.protagonists} philosophers`}
        >
          <div className="space-y-2">
            {stats.anecdotes.byTopic.map((t) => (
              <BarRow
                key={t.name}
                label={capitalize(t.name)}
                count={t.count}
                max={maxAnecTopic}
              />
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border/60">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">
              Most storied
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {stats.anecdotes.topProtagonists.map((s) => (
                <Link
                  key={s.name}
                  href={`/anecdotes?philosopher=${encodeURIComponent(s.name)}`}
                  className="px-2.5 py-1 rounded-full border border-border bg-muted/30 text-xs hover:border-primary/40 transition-colors"
                >
                  {s.name}{" "}
                  <span className="font-semibold tabular-nums">{s.count}</span>
                </Link>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <SectionCard
          title="Verses & epigrams"
          href="/verses"
        >
          <div className="grid grid-cols-2 gap-3">
            <MiniStat n={stats.verses.total} label="verse quotations" href="/verses" />
            <MiniStat n={stats.verses.epigrams} label="epigrams (many by D.L. himself)" href="/verses" />
            <MiniStat n={stats.verses.attributed} label="with a named poet" href="/verses" />
            <MiniStat n={stats.verses.poets} label="distinct poets quoted" href="/verses" />
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            A poet is credited only where the text itself names one; browse
            the{" "}
            <Link href="/verses" className="text-primary underline underline-offset-2">
              verses
            </Link>{" "}
            and their poets index.
          </p>
        </SectionCard>

        <SectionCard
          title="Letters & wills"
          href="/letters"
        >
          <div className="space-y-2 mb-4">
            {stats.epistles.byAuthenticity.map((a) => (
              <BarRow
                key={a.name}
                label={capitalize(a.name)}
                count={a.count}
                max={stats.epistles.total}
                color={AUTHENTICITY_COLOR[a.name] ?? "bg-primary/70"}
                href={`/letters?authenticity=${encodeURIComponent(a.name)}`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.epistles.total} letters carry a modern authenticity verdict;
            most are ancient forgeries, preserved as such. Alongside them
            stand{" "}
            <Link href="/testaments" className="text-primary underline underline-offset-2">
              {stats.testaments.total} wills
            </Link>
            , for all of which Diogenes Laertius is the sole surviving source.
          </p>
        </SectionCard>
      </div>

      <SectionCard
        title="The catalogue of works"
        subtitle={`${stats.works.total} book titles recorded in the Lives`}
      >
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="space-y-2">
              {stats.works.bySurvival.map((s) => (
                <BarRow
                  key={s.name}
                  label={capitalize(s.name)}
                  count={s.count}
                  max={stats.works.total}
                  color={SURVIVAL_COLOR[s.name] ?? "bg-primary/70"}
                  gloss={SURVIVAL_GLOSS[s.name]}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round(
                ((stats.works.bySurvival.find((s) => s.name === "lost")
                  ?.count ?? 0) /
                  stats.works.total) *
                  100,
              )}
              % of the recorded titles are lost; the catalogues of the Lives
              are often the only trace these books left.{" "}
              {stats.works.philosophical.toLocaleString("en-US")} titles are
              philosophical works.
            </p>
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">
                Composition century
                {stats.works.unknownCentury > 0 && (
                  <span className="normal-case font-normal">
                    {" "}
                    · {stats.works.unknownCentury} undatable
                  </span>
                )}
              </h3>
              <div className="flex items-end gap-2 h-28">
                {stats.works.byCentury.map((c) => (
                  <div
                    key={c.century}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <span className="text-xs tabular-nums text-foreground">
                      {c.count}
                    </span>
                    <div
                      className="w-full rounded-t-md bg-primary/70"
                      style={{
                        height: `${Math.max((c.count / maxCentury) * 80, 3)}px`,
                      }}
                    />
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {centuryLabel(c.century)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Subjects of the recorded titles
            </h3>
            {stats.works.byTopic.slice(0, 12).map((t) => (
              <BarRow
                key={t.name}
                label={capitalize(t.name)}
                count={t.count}
                max={maxWorkTopic}
              />
            ))}
            <p className="text-xs text-muted-foreground pt-2">
              Form: {stats.works.byForm
                .map((f) => `${f.count.toLocaleString("en-US")} ${f.name}`)
                .join(" · ")}
              . Every title also carries a curated survival status and, where
              the author's dates allow, a composition century.
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Names & terms in the text"
        href="/entities"
        subtitle={`${stats.entities.annotations.toLocaleString("en-US")} tags across ${stats.entities.total} entities, in both languages`}
      >
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-2">
            {stats.entities.byKind.map((k) => (
              <BarRow
                key={k.kind}
                label={`${KIND_LABEL[k.kind] ?? capitalize(k.kind)} (${k.entities})`}
                count={k.occurrences}
                max={maxKind}
                href={`/entities?kind=${encodeURIComponent(k.kind)}`}
              />
            ))}
            <p className="text-xs text-muted-foreground pt-2">
              Ambiguous bare names (Zeno, Diogenes, …) are tagged only where
              the section's subject settles who is meant.
            </p>
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">
              Most tagged
            </h3>
            <div className="space-y-1">
              {stats.entities.topEntities.map((e) => (
                <Link
                  key={e.uri}
                  href={`/entities?entity=${encodeURIComponent(e.uri)}`}
                  className="flex items-baseline justify-between gap-2 px-2 py-1 -mx-2 rounded-md hover:bg-muted/50 transition-colors text-sm"
                >
                  <span className="text-foreground">
                    {grcSpans(e.label)}{" "}
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {e.kind}
                    </span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {e.occurrences.toLocaleString("en-US")} in {e.sections}{" "}
                    sections
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid md:grid-cols-2 gap-8">
        <SectionCard
          title="The mapped world"
          subtitle="every place located and linked to its passages"
          href="/map"
        >
          <div className="grid grid-cols-2 gap-3">
            <MiniStat n={stats.places.total} label="located places" href="/map" />
            <MiniStat n={stats.places.events} label="cited life events" href="/map" />
            <MiniStat n={stats.places.mentionSections} label="sections mentioning a mapped place" href="/map" />
            <MiniStat n={stats.places.itineraries} label="reconstructed life journeys" href="/map" />
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Births, travels, and deaths plotted from located claims; follow
            them on the{" "}
            <Link href="/map" className="text-primary underline underline-offset-2">
              map
            </Link>
            .
          </p>
        </SectionCard>

        <SectionCard
          title="The sources Diogenes cites"
        >
          <div className="grid grid-cols-2 gap-3">
            <MiniStat n={stats.sources.citations} label="source citations" />
            <MiniStat n={stats.sources.authorities} label="distinct cited authorities" />
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Diogenes Laertius built the Lives out of earlier books, most now
            lost; each row of the index records one citation of an authority,
            with its passage reference.
          </p>
        </SectionCard>
      </div>

      {otb && (
        <SectionCard
          title="Ontoterminology"
          href="/terminology"
          subtitle="the concept–term model behind the vocabulary"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat n={otb.counts.categories} label="categories" href="/terminology" />
            <MiniStat n={otb.counts.concepts} label="concepts" href="/terminology" />
            <MiniStat n={otb.counts.relations} label="relations" href="/terminology" />
            <MiniStat n={otb.counts.attributes} label="attributes" href="/terminology" />
            <MiniStat n={otb.counts.terms} label="terms" href="/terminology" />
            <MiniStat n={otb.counts.objects} label="objects" href="/terminology" />
            <MiniStat n={otb.counts.properNames} label="proper names" href="/terminology" />
            <MiniStat n={otb.counts.assertions} label="assertions" href="/terminology" />
          </div>
          <div className="mt-6">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">
              Concepts by category
            </h3>
            <div className="space-y-1.5">
              {otb.conceptCounts.map((c) => (
                <BarRow
                  key={c.id}
                  label={c.id}
                  gloss={`Category: ${c.category}`}
                  count={c.count}
                  max={Math.max(...otb.conceptCounts.map((x) => x.count))}
                  href="/terminology"
                />
              ))}
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard
        id="lod"
        title="Linked Open Data"
      >
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <MiniStat n={stats.lod.triples} label="RDF triples (annotated graph)" />
              <MiniStat n={stats.lod.annotationBodies} label="stand-off text annotations" />
              <MiniStat n={stats.lod.properNames} label="proper-name linguistic nodes" />
              <MiniStat n={stats.lod.concepts} label="concepts (doctrines & vocabularies)" />
            </div>
            <div className="space-y-3 text-xs">
              {/* The href paths are deliberately full literal strings (not
                  interpolated) so that the bundle smoke test can pin them as
                  fragments in the built JS; keep them literal. */}
              {[
                {
                  label: "Core graph (without text annotations)",
                  links: [
                    {
                      name: "JSON-LD",
                      path: "api/lod/graph.jsonld?download",
                      file: "laertius-graph.jsonld",
                    },
                    {
                      name: "Turtle",
                      path: "api/lod/graph.ttl?download",
                      file: "laertius-graph.ttl",
                    },
                    {
                      name: "RDF/XML",
                      path: "api/lod/graph.rdf?download",
                      file: "laertius-graph.rdf",
                    },
                  ],
                },
                {
                  label: "With text annotations",
                  links: [
                    {
                      name: "JSON-LD",
                      path: "api/lod/graph-annotated.jsonld?download",
                      file: "laertius-graph-annotated.jsonld",
                    },
                    {
                      name: "Turtle",
                      path: "api/lod/graph-annotated.ttl?download",
                      file: "laertius-graph-annotated.ttl",
                    },
                    {
                      name: "RDF/XML",
                      path: "api/lod/graph-annotated.rdf?download",
                      file: "laertius-graph-annotated.rdf",
                    },
                  ],
                },
                {
                  label: "Ontology",
                  links: [
                    {
                      name: "HTML",
                      path: "api/lod/ontology.html",
                      file: "",
                    },
                    {
                      name: "JSON-LD",
                      path: "api/lod/ontology.jsonld?download",
                      file: "laertius-ontology.jsonld",
                    },
                    {
                      name: "Turtle",
                      path: "api/lod/ontology.ttl?download",
                      file: "laertius-ontology.ttl",
                    },
                    {
                      name: "RDF/XML",
                      path: "api/lod/ontology.rdf?download",
                      file: "laertius-ontology.rdf",
                    },
                  ],
                },
                {
                  label: "SHACL shapes",
                  links: [
                    {
                      name: "Turtle",
                      path: "api/lod/shapes.ttl?download",
                      file: "laertius-shapes.ttl",
                    },
                  ],
                },
              ].map((g) => (
                <div key={g.label} className="space-y-1.5">
                  <span className="block font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.label}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {g.links.map((l) => (
                      <Button
                        key={l.name}
                        asChild
                        size="sm"
                        variant="outline"
                        className="font-sans shadow-sm"
                      >
                        <a
                          href={`${import.meta.env.BASE_URL}${l.path}`}
                          download={l.file}
                        >
                          <Download className="mr-1.5 h-3.5 w-3.5" />
                          {l.name}
                        </a>
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">
              Nodes in the graph
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {stats.lod.nodesByClass.map((c) => (
                <div
                  key={c.name}
                  className="flex items-baseline justify-between text-sm border-b border-border/40 pb-1"
                >
                  <span className="text-muted-foreground">{c.name}</span>
                  <span className="tabular-nums font-medium text-foreground">
                    {c.count.toLocaleString("en-US")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
