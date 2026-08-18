import { usePageTitle } from "@/lib/use-page-title";
import { AboutLink } from "@/components/about-link";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { useGetTimeline } from "@workspace/api-client-react";
import type { TimelinePhilosopher } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
import { MOVEMENT_COLORS } from "@/components/movement-colors";
import { useResetOnSamePageNav } from "@/hooks/use-reset-on-same-page-nav";
import { SortableTh, sortRows, useTableSort } from "@/components/sortable-table";

const CERTAINTY_BADGE: Record<string, string> = {
  asserted: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
  reported: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
  disputed: "bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200",
  conjectured: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
};

const KIND_LABEL: Record<string, string> = {
  born: "Born",
  died: "Died",
  flourished: "Floruit",
};

/** Parse the ?school= list (comma-separated movement ids) from a search string. */
function parseSchools(search: string): Set<string> {
  const raw = new URLSearchParams(search).get("school");
  return new Set(
    raw
      ? raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  );
}

function fmtYear(y: number): string {
  return y < 0 ? `${-y} BCE` : `${y} CE`;
}

/**
 * Spell out, in words, the certainty a year carries in the list view,
 * replacing the timeline's shape and color cues.
 * - birth/death: hollow markers are derived from a stated age (approximate),
 *   solid markers are attested years.
 * - floruit: D.L. dates the acme directly.
 */
function yearCertaintyWords(
  kind: "birth" | "death" | "floruit",
  approx?: boolean,
): string {
  if (kind === "floruit") return "attested (floruit)";
  if (approx) return "derived from stated age (approximate)";
  return "attested";
}

/** "c. 665-585 BCE", "640-548 BCE", "fl. 596 BCE" */
function lifeSummary(p: TimelinePhilosopher): string {
  const approx = p.approxBirth || p.approxDeath;
  if (p.birthYear !== undefined && p.deathYear !== undefined) {
    return `${approx ? "c. " : ""}${-p.birthYear}-${fmtYear(p.deathYear)}`;
  }
  if (p.birthYear !== undefined) {
    return `${p.approxBirth ? "c. " : "b. "}${fmtYear(p.birthYear)}`;
  }
  if (p.deathYear !== undefined) {
    return `d. ${p.approxDeath ? "c. " : ""}${fmtYear(p.deathYear)}`;
  }
  if (p.floruitYear !== undefined) return `fl. ${fmtYear(p.floruitYear)}`;
  return "";
}

export default function TimelinePage() {
  usePageTitle("Chronology of the Lives");
  const { data, isLoading, isError } = useGetTimeline();
  // Initialized from the URL (?p=, ?school=, ?view=) so a shared link
  // restores the expanded philosopher, the school filter, and the view.
  const [expanded, setExpanded] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("p") || null,
  );
  const [movementFilter, setMovementFilter] = useState<Set<string>>(
    () => parseSchools(window.location.search),
  );
  const [view, setView] = useState<"timeline" | "list">(() =>
    new URLSearchParams(window.location.search).get("view") === "list"
      ? "list"
      : "timeline",
  );

  // Clicking the "Timeline" nav link while already here starts fresh:
  // collapse any expanded philosopher, clear the movement filter, and
  // return to the interactive timeline view.
  useResetOnSamePageNav(() => {
    setExpanded(null);
    setMovementFilter(new Set());
    setView("timeline");
  });

  // When the search string changes from outside this page's own sync
  // effect (browser back/forward, a shared link), adopt the URL's view,
  // school filter, and expanded philosopher so the page always matches
  // what the URL says.
  const search = useSearch();
  useEffect(() => {
    const params = new URLSearchParams(search);
    const v = params.get("view") === "list" ? "list" : "timeline";
    setView((cur) => (cur === v ? cur : v));
    const p = params.get("p") || null;
    setExpanded((cur) => (cur === p ? cur : p));
    const schools = parseSchools(search);
    setMovementFilter((cur) => {
      if (
        cur.size === schools.size &&
        [...schools].every((s) => cur.has(s))
      ) {
        return cur;
      }
      return schools;
    });
  }, [search]);

  // Keep ?view=, ?school= and ?p= in sync (replaceState) so the view,
  // the school filter, and the expanded philosopher are shareable /
  // reloadable, consistent with the graph page's ?view= / ?p= sync.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (view === "list") url.searchParams.set("view", "list");
    else url.searchParams.delete("view");
    if (movementFilter.size > 0) {
      url.searchParams.set("school", [...movementFilter].sort().join(","));
    } else {
      url.searchParams.delete("school");
    }
    if (expanded) url.searchParams.set("p", expanded);
    else url.searchParams.delete("p");
    if (url.href !== window.location.href) {
      window.history.replaceState(null, "", url);
    }
  }, [view, movementFilter, expanded]);

  const philosophers = useMemo(() => data ?? [], [data]);

  const movements = useMemo(() => {
    const seen = new Map<
      string,
      { id: string; label: string; grc?: string; count: number }
    >();
    for (const p of philosophers) {
      const m = seen.get(p.movement);
      if (m) m.count += 1;
      else
        seen.set(p.movement, {
          id: p.movement,
          label: p.movementLabel,
          grc: p.movementGrc,
          count: 1,
        });
    }
    return [...seen.values()];
  }, [philosophers]);

  const visible = useMemo(
    () =>
      movementFilter.size === 0
        ? philosophers
        : philosophers.filter((p) => movementFilter.has(p.movement)),
    [philosophers, movementFilter],
  );

  const { minD, maxD, ticks } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const p of visible) {
      for (const y of [p.birthYear, p.deathYear, p.floruitYear]) {
        if (y === undefined) continue;
        if (y < min) min = y;
        if (y > max) max = y;
      }
    }
    if (!isFinite(min)) {
      min = -700;
      max = -100;
    }
    const lo = Math.floor((min - 20) / 50) * 50;
    const hi = Math.ceil((max + 20) / 50) * 50;
    const t: number[] = [];
    for (let y = lo; y <= hi; y += 50) t.push(y);
    return { minD: lo, maxD: hi, ticks: t };
  }, [visible]);

  const pct = (y: number) => ((y - minD) / (maxD - minD)) * 100;

  // Earliest dated point for a philosopher, used to order the list view
  // chronologically the same way the timeline reads left to right.
  const sortKey = (p: TimelinePhilosopher): number => {
    const known = [p.birthYear, p.deathYear, p.floruitYear].filter(
      (y): y is number => y !== undefined,
    );
    return known.length ? Math.min(...known) : Infinity;
  };

  const rowSort = useTableSort<
    "name" | "school" | "born" | "died" | "floruit" | "life"
  >();
  const listRows = useMemo(
    () =>
      [...visible].sort((a, b) => {
        const d = sortKey(a) - sortKey(b);
        return d !== 0 ? d : a.name.localeCompare(b.name);
      }),
    [visible],
  );

  const toggleMovement = (id: string) => {
    setMovementFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Assembling the chronology...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-2xl mx-auto py-24 text-center text-muted-foreground">
        The chronology could not be loaded.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold">
          Timeline of the Philosophers
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
          Every date is drawn from Diogenes Laertius&apos;s own chronological
          references: the Olympiads and archon years recorded in his dated
          claims, together with their modern-year equivalents. These
          references allow {philosophers.length} philosophers to be dated;
          Metrodorus can be dated only relatively, in relation to Epicurus.
          Select a name to view the relevant dated claims, citations,
          certainty levels, and sources named by Diogenes Laertius.
        </p>
        <AboutLink anchor="knowledge-graph" label="About the knowledge graph" />
      </div>

      <div
        className="inline-flex rounded-full border border-border/70 p-0.5 text-sm"
        role="group"
        aria-label="Choose how to view the chronology"
        data-testid="timeline-view-toggle"
      >
        <button
          type="button"
          onClick={() => setView("timeline")}
          aria-pressed={view === "timeline"}
          data-testid="timeline-view-timeline"
          className={`px-3.5 py-1 rounded-full transition-colors ${
            view === "timeline"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Timeline
        </button>
        <button
          type="button"
          onClick={() => setView("list")}
          aria-pressed={view === "list"}
          data-testid="timeline-view-list"
          className={`px-3.5 py-1 rounded-full transition-colors ${
            view === "list"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          List
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {movements.map((m) => {
          const active = movementFilter.size === 0 || movementFilter.has(m.id);
          return (
            <button
              key={m.id}
              onClick={() => toggleMovement(m.id)}
              data-testid={`timeline-school-${m.id}`}
              aria-pressed={movementFilter.has(m.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                active
                  ? "border-border/70 bg-transparent text-foreground"
                  : "border-border/40 text-muted-foreground opacity-45"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full opacity-80"
                style={{ backgroundColor: MOVEMENT_COLORS[m.id] ?? "#71717a" }}
              />
              {m.label}
              <span className="text-muted-foreground/70">{m.count}</span>
            </button>
          );
        })}
      </div>

      {view === "timeline" && (
      <div className="overflow-x-auto rounded-xl border border-border/60 bg-card">
        <div className="min-w-[640px] relative py-2">
          <div className="absolute inset-y-0 left-[10.5rem] right-3 pointer-events-none">
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute inset-y-0 border-l border-border/30"
                style={{ left: `${pct(t)}%` }}
              />
            ))}
          </div>

          <div className="grid grid-cols-[10.5rem_1fr] pr-3 pb-1">
            <div />
            <div className="relative h-5">
              {ticks
                .filter((t) => t % 100 === 0)
                .map((t) => (
                  <span
                    key={t}
                    className="absolute -translate-x-1/2 text-[10px] text-muted-foreground whitespace-nowrap"
                    style={{ left: `${pct(t)}%` }}
                  >
                    {fmtYear(t)}
                  </span>
                ))}
            </div>
          </div>

          {visible.map((p) => {
            const color = MOVEMENT_COLORS[p.movement] ?? "#71717a";
            const isOpen = expanded === p.name;
            const known = [p.birthYear, p.deathYear, p.floruitYear].filter(
              (y): y is number => y !== undefined,
            );
            const spanLo = Math.min(...known);
            const spanHi = Math.max(...known);
            const hasBar = p.birthYear !== undefined && p.deathYear !== undefined;
            return (
              <div key={p.name}>
                <button
                  onClick={() => setExpanded(isOpen ? null : p.name)}
                  data-testid={`timeline-phil-${p.name}`}
                  aria-expanded={isOpen}
                  className={`w-full grid grid-cols-[10.5rem_1fr] items-center pr-3 text-left transition-colors hover:bg-muted/50 ${
                    isOpen ? "bg-muted/50" : ""
                  }`}
                >
                  <span className="px-3 py-1 min-w-0">
                    <span className="block text-sm truncate">{p.name}</span>
                    <span className="block text-[10px] text-muted-foreground truncate">
                      {lifeSummary(p)}
                    </span>
                  </span>
                  <span className="relative h-7 block">
                    {!hasBar && known.length > 1 && (
                      <span
                        className="absolute top-1/2 border-t border-dashed"
                        style={{
                          left: `${pct(spanLo)}%`,
                          width: `${pct(spanHi) - pct(spanLo)}%`,
                          borderColor: color,
                        }}
                      />
                    )}
                    {hasBar && (
                      <span
                        className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full"
                        style={{
                          left: `${pct(p.birthYear!)}%`,
                          width: `${Math.max(pct(p.deathYear!) - pct(p.birthYear!), 0.5)}%`,
                          backgroundColor: color,
                          opacity: 0.55,
                        }}
                      />
                    )}
                    {p.birthYear !== undefined && (
                      <span
                        title={`${p.approxBirth ? "c. " : ""}${fmtYear(p.birthYear)}`}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full"
                        style={{ left: `${pct(p.birthYear)}%`, backgroundColor: color }}
                      />
                    )}
                    {p.deathYear !== undefined && (
                      <span
                        title={`${p.approxDeath ? "c. " : ""}${fmtYear(p.deathYear)}`}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full"
                        style={{ left: `${pct(p.deathYear)}%`, backgroundColor: color }}
                      />
                    )}
                    {p.floruitYear !== undefined && (
                      <span
                        title={`fl. ${fmtYear(p.floruitYear)}`}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full"
                        style={{ left: `${pct(p.floruitYear)}%`, backgroundColor: color }}
                      />
                    )}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-y border-border/60 bg-muted/20 px-4 py-3 space-y-3">
                    {p.events.map((e, i) => (
                      <div key={i} className="text-sm">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded border border-border/70 text-[10px] font-medium text-muted-foreground">
                            {KIND_LABEL[e.kind] ?? e.kind}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${CERTAINTY_BADGE[e.certainty] ?? ""}`}
                          >
                            {e.certainty}
                          </span>
                          {e.accordingTo && (
                            <span className="text-[10px] text-muted-foreground">
                              per {e.accordingTo}
                            </span>
                          )}
                        </div>
                        <p className="mt-1">{e.value}</p>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {e.sectionId ? (
                            <Link
                              href={`/section/${e.sectionId}`}
                              className="underline underline-offset-2 hover:text-foreground"
                            >
                              D.L. {e.ref} - read the passage
                            </Link>
                          ) : (
                            <span>D.L. {e.ref}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      )}

      {view === "list" && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table
            className="w-full text-sm border-collapse"
            data-testid="timeline-list-table"
          >
            <caption className="sr-only">
              Chronology of the philosophers, ordered from earliest to
              latest dated point. Birth, death, and floruit years each note
              whether the year is attested by Diogenes Laertius or derived
              from a stated age.
            </caption>
            <thead>
              <tr className="border-b bg-muted/40 text-left align-bottom">
                <SortableTh
                  label="Philosopher"
                  sortKey="name"
                  sort={rowSort.sort}
                  onToggle={rowSort.toggle}
                  className="px-3 py-2"
                  testId="sort-timeline-name"
                />
                <SortableTh
                  label="School"
                  sortKey="school"
                  sort={rowSort.sort}
                  onToggle={rowSort.toggle}
                  className="px-3 py-2"
                  testId="sort-timeline-school"
                />
                <SortableTh
                  label="Born"
                  sortKey="born"
                  sort={rowSort.sort}
                  onToggle={rowSort.toggle}
                  className="px-3 py-2"
                  testId="sort-timeline-born"
                />
                <SortableTh
                  label="Died"
                  sortKey="died"
                  sort={rowSort.sort}
                  onToggle={rowSort.toggle}
                  className="px-3 py-2"
                  testId="sort-timeline-died"
                />
                <SortableTh
                  label="Floruit"
                  sortKey="floruit"
                  sort={rowSort.sort}
                  onToggle={rowSort.toggle}
                  className="px-3 py-2"
                  testId="sort-timeline-floruit"
                />
                <SortableTh
                  label="Life"
                  sortKey="life"
                  sort={rowSort.sort}
                  onToggle={rowSort.toggle}
                  className="px-3 py-2"
                  testId="sort-timeline-life"
                />
              </tr>
            </thead>
            <tbody>
              {sortRows(listRows, rowSort.sort, {
                name: (p) => p.name,
                school: (p) => p.movementLabel,
                born: (p) => p.birthYear,
                died: (p) => p.deathYear,
                floruit: (p) => p.floruitYear,
                life: (p) => lifeSummary(p) || undefined,
              }).map((p) => {
                const summary = lifeSummary(p);
                return (
                  <tr
                    key={p.name}
                    className="border-b last:border-b-0 align-top"
                  >
                    <th scope="row" className="px-3 py-2 font-normal">
                      <Link
                        href={`/graph?p=${encodeURIComponent(p.name)}`}
                        className="underline underline-offset-2 hover:text-foreground"
                        data-testid={`timeline-list-name-${p.name}`}
                      >
                        {p.name}
                      </Link>
                    </th>
                    <td className="px-3 py-2 text-muted-foreground">
                      {p.movementLabel}
                    </td>
                    <td className="px-3 py-2">
                      {p.birthYear !== undefined ? (
                        <>
                          {fmtYear(p.birthYear)}
                          <span className="block text-xs text-muted-foreground">
                            {yearCertaintyWords("birth", p.approxBirth)}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          not dated
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {p.deathYear !== undefined ? (
                        <>
                          {fmtYear(p.deathYear)}
                          <span className="block text-xs text-muted-foreground">
                            {yearCertaintyWords("death", p.approxDeath)}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          not dated
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {p.floruitYear !== undefined ? (
                        <>
                          {fmtYear(p.floruitYear)}
                          <span className="block text-xs text-muted-foreground">
                            {yearCertaintyWords("floruit")}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          not dated
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {summary || (
                        <span className="text-muted-foreground">
                          no summary
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {view === "timeline" && (
      <p className="text-xs text-muted-foreground max-w-3xl">
        Years marked "c." are derived arithmetically from an age D.L. states
        (birth + age at death, or the age he gives at a dated moment) and are
        approximate. Rival accounts (two death ages for Pythagoras, legendary
        lifespans for Epimenides) are kept side by side in the claim list
        rather than averaged away.
      </p>
      )}

    </div>
  );
}
