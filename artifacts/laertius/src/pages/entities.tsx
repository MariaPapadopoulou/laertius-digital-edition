import { usePageTitle } from "@/lib/use-page-title";
import { AboutLink } from "@/components/about-link";
import { grcSpans } from "@/lib/grc";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useListAnnotatedEntities,
  useListEntitySections,
  getListAnnotatedEntitiesQueryKey,
  getListEntitySectionsQueryKey,
} from "@workspace/api-client-react";
import { KIND_STYLES } from "@/components/annotated-text";
import { Loader2, Search } from "lucide-react";
import { useScrollMemory } from "@/hooks/use-scroll-memory";
import { useResetOnSamePageNav } from "@/hooks/use-reset-on-same-page-nav";

const KIND_ORDER = [
  "philosopher",
  "person",
  "school",
  "place",
  "source",
  "work",
  "term",
] as const;

// Lowercase and strip diacritics (NFD, then drop combining marks) so
// "Ζήνων" and "Zenon"-style near-misses compare on plain letters.
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function sharedPrefixLength(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

// Levenshtein distance, bailing out early once every path exceeds `max`.
function boundedEditDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      curr.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
}

export default function EntitiesPage() {
  const [selected, setSelected] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("entity"),
  );
  usePageTitle(
    selected ? `${selected} - Index of Names & Terms` : "Index of Names & Terms",
  );
  const [kind, setKind] = useState<string>(() => {
    const k = new URLSearchParams(window.location.search).get("kind");
    return k && (KIND_ORDER as readonly string[]).includes(k) ? k : "all";
  });
  // Seeded from ?q= so pages that cannot resolve a name (e.g. the Graph
  // page's unknown-?p= notice) can hand the reader a pre-filtered index.
  const [q, setQ] = useState(
    () => new URLSearchParams(window.location.search).get("q") ?? "",
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selected) url.searchParams.set("entity", selected);
    else url.searchParams.delete("entity");
    if (kind !== "all") url.searchParams.set("kind", kind);
    else url.searchParams.delete("kind");
    window.history.replaceState(null, "", url);
  }, [selected, kind]);

  const { data: entities, isLoading } = useListAnnotatedEntities({
    query: { queryKey: getListAnnotatedEntitiesQueryKey() },
  });

  const sectionParams = { entity: selected ?? "" };
  const { data: detail, isLoading: detailLoading } = useListEntitySections(
    sectionParams,
    {
      query: {
        enabled: !!selected,
        queryKey: getListEntitySectionsQueryKey(sectionParams),
      },
    },
  );

  // Restore the reader's place on back navigation, both in the full index
  // (keyed by kind + filter text) and in a selected entity's passage list.
  useScrollMemory(
    `entities-scroll:${selected ?? ""}|${kind}|${q.trim().toLowerCase()}`,
    selected ? !detailLoading && !!detail : !isLoading && !!entities,
  );

  // Clicking the "Index" nav link while already here starts fresh: back to
  // the full unfiltered index. (Deep links like ?entity=X carry a query
  // string and are not affected.)
  useResetOnSamePageNav(() => {
    setSelected(null);
    setKind("all");
    setQ("");
  });

  const kindCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entities ?? []) {
      counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
    }
    return counts;
  }, [entities]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (entities ?? []).filter(
      (e) =>
        (kind === "all" || e.kind === kind) &&
        (needle === "" ||
          e.label.toLowerCase().includes(needle) ||
          (e.altTitle !== undefined &&
            e.altTitle.toLowerCase().includes(needle)) ||
          // A reader pasting a Greek nominative from the text (e.g.
          // "Ζήνων") should find its bearers even though labels are
          // English: match the curated shared Greek form too.
          (e.grcHomonymForm !== undefined &&
            e.grcHomonymForm.toLowerCase().includes(needle)) ||
          // Non-homonym entries (philosophers, and places, persons and
          // sources with an unambiguous curated form) carry their own
          // Greek nominative (grc), so "Σωκράτης" or "Ἀθῆναι" also match.
          (e.grc !== undefined && e.grc.toLowerCase().includes(needle))),
    );
  }, [entities, kind, q]);

  // Near-miss fallback: when the exact substring filter matches nothing
  // (a reader typed "Zenon" for Zeno, or copied a Greek genitive), offer
  // the closest names instead of a dead end. A name is "close" when any
  // word of its label or alt title is within edit distance 2 of the
  // typed text, or shares a prefix of at least 4 letters with it
  // (diacritics stripped on both sides so Greek forms compare fairly).
  // Namesakes (five Zenos, several Aristons) would otherwise interleave
  // by raw mention count, silently steering a reader hunting the
  // lesser-known bearer toward the most-famous one. So each suggestion
  // remembers the word that matched; ties on the same word are kept
  // together as one visible group and badged with how many bearers of
  // that name matched, so the choice between namesakes is explicit.
  const suggestions = useMemo(() => {
    const needle = normalizeForMatch(q.trim());
    if (needle.length < 3 || filtered.length > 0) return [];
    const scored: {
      e: (typeof filtered)[number];
      score: number;
      word: string;
    }[] = [];
    for (const e of entities ?? []) {
      if (kind !== "all" && e.kind !== kind) continue;
      // Include the curated Greek nominatives (the shared homonym form
      // and the entry's own grc) so a pasted Greek inflection
      // ("Ζήνωνος" for Ζήνων, "Μιλήτου" for Μίλητος) still gets a
      // near-miss lead; diacritics are stripped by normalizeForMatch.
      const words = `${e.label} ${e.altTitle ?? ""} ${e.grcHomonymForm ?? ""} ${e.grc ?? ""}`
        .split(/[\s,()·]+/)
        .map(normalizeForMatch)
        .filter((w) => w.length >= 3);
      let best = Infinity;
      let bestWord = "";
      for (const w of words) {
        const prefix = sharedPrefixLength(w, needle);
        const dist = boundedEditDistance(w, needle, 2);
        let s = Infinity;
        if (dist <= 2) s = dist;
        else if (prefix >= 4) s = 3 + (needle.length - prefix);
        if (s < best) {
          best = s;
          bestWord = w;
        }
      }
      if (best !== Infinity) scored.push({ e, score: best, word: bestWord });
    }
    scored.sort(
      (a, b) => a.score - b.score || b.e.occurrences - a.e.occurrences,
    );
    // Count bearers per matched word over the full scored list (not the
    // sliced one) so the badge never understates the ambiguity, then
    // order groups by their strongest member while keeping closer
    // spellings first and each group's members adjacent.
    const wordCounts = new Map<string, number>();
    const groupOrder = new Map<string, number>();
    for (const s of scored) {
      wordCounts.set(s.word, (wordCounts.get(s.word) ?? 0) + 1);
      if (!groupOrder.has(s.word)) groupOrder.set(s.word, groupOrder.size);
    }
    scored.sort(
      (a, b) =>
        a.score - b.score ||
        (groupOrder.get(a.word) ?? 0) - (groupOrder.get(b.word) ?? 0) ||
        b.e.occurrences - a.e.occurrences,
    );
    return scored.slice(0, 9).map((s) => ({
      ...s.e,
      namesakeCount: wordCounts.get(s.word) ?? 1,
    }));
  }, [entities, kind, q, filtered]);

  const selectedEntity = selected
    ? (entities ?? []).find((e) => e.entityUri === selected)
    : null;

  const groupedSections = useMemo(() => {
    if (!detail) return [];
    const groups = new Map<
      string,
      { philosopher: string; sections: typeof detail.sections }
    >();
    for (const s of detail.sections) {
      const g = groups.get(s.philosopher);
      if (g) g.sections.push(s);
      else groups.set(s.philosopher, { philosopher: s.philosopher, sections: [s] });
    }
    return [...groups.values()];
  }, [detail]);

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-serif font-bold text-foreground">
          Index of Names &amp; Terms
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          All philosophers, persons, schools, places, cited sources, works,
          and Greek terms identified in the <em>Lives</em>, with links to the
          passages in which they appear.
        </p>
        <AboutLink anchor="names-in-the-text" label="About names in the text" />
      </div>

      {selected ? (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            All entities
          </button>

          {detailLoading || !detail ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="text-2xl font-serif font-bold">
                  {detail.label}
                </h2>
                {selectedEntity?.grc &&
                  selectedEntity.grc !== selectedEntity.grcHomonymForm && (
                    <span lang="grc" className="text-lg font-serif text-muted-foreground">
                      {selectedEntity.grc}
                    </span>
                  )}
                {detail.altTitle && (
                  <span className="text-sm text-muted-foreground italic">
                    also known as <em>{detail.altTitle}</em>
                  </span>
                )}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${KIND_STYLES[detail.kind]?.chip ?? ""}`}
                >
                  {KIND_STYLES[detail.kind]?.label ?? detail.kind}
                </span>
                <span className="text-sm text-muted-foreground">
                  {selectedEntity
                    ? `${selectedEntity.occurrences} occurrence${selectedEntity.occurrences === 1 ? "" : "s"} in ${detail.sections.length} section${detail.sections.length === 1 ? "" : "s"}`
                    : `${detail.sections.length} section${detail.sections.length === 1 ? "" : "s"}`}
                </span>
                {selectedEntity?.philosophyPages && (
                  <a
                    href={`https://www.philosophypages.com/${selectedEntity.philosophyPages}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    Philosophy Pages ↗
                  </a>
                )}
                {selectedEntity?.otbObjectId && (
                  <Link
                    href={`/terminology/objects/${selectedEntity.otbObjectId}`}
                    className="text-sm text-primary hover:underline"
                  >
                    Ontoterminology entry
                  </Link>
                )}
                {selectedEntity?.pleiades && (
                  <a
                    href={`https://pleiades.stoa.org/places/${selectedEntity.pleiades}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    Pleiades ↗
                  </a>
                )}
              </div>
              {selectedEntity?.altTitleRef && (
                <p className="text-sm text-muted-foreground">
                  Double title recorded in Plato's catalogue at{" "}
                  {selectedEntity.altTitleSectionId ? (
                    <Link
                      href={`/section/${selectedEntity.altTitleSectionId}`}
                      className="font-mono text-primary hover:underline"
                    >
                      {selectedEntity.altTitleRef}
                    </Link>
                  ) : (
                    <span className="font-mono">
                      {selectedEntity.altTitleRef}
                    </span>
                  )}
                  .
                </p>
              )}
              {selectedEntity?.grcHomonymForm &&
                selectedEntity.sharesGreekNameWith &&
                selectedEntity.sharesGreekNameWith.length > 0 && (
                  <div className="text-sm text-muted-foreground border border-border rounded-lg bg-secondary/40 px-4 py-3 space-y-1">
                    <p>
                      {selectedEntity.grcHomonymUncertified
                        ? "Bears the same Greek name "
                        : "Shares the Greek name "}
                      <span lang="grc" className="font-serif text-foreground">
                        {selectedEntity.grcHomonymForm}
                      </span>{" "}
                      {selectedEntity.grcHomonymUncertified ? "as" : "with"}{" "}
                      {selectedEntity.sharesGreekNameWith.map((other, i) => (
                        <span key={other.label}>
                          {i > 0 && " and "}
                          {other.entityUri ? (
                            <button
                              type="button"
                              onClick={() => setSelected(other.entityUri!)}
                              className="text-primary hover:underline font-medium"
                            >
                              {other.label}
                            </button>
                          ) : (
                            <span className="font-medium">{other.label}</span>
                          )}
                        </span>
                      ))}
                      .
                    </p>
                    {selectedEntity.grcHomonymUncertified ? (
                      <p
                        className="text-[11px] italic"
                        title="No owl:differentFrom axiom is asserted in the linked-data graph: certification is a curatorial claim these bearers do not carry"
                      >
                        Possibly distinct individuals: these bearers are not
                        curator-certified, so they may or may not be the same
                        person.
                      </p>
                    ) : (
                      <p
                        className="text-[11px] italic"
                        title="Each pair carries an owl:differentFrom axiom in the linked-data graph"
                      >
                        Distinct individuals: the linked-data graph asserts
                        owl:differentFrom for each pair.
                      </p>
                    )}
                  </div>
                )}
              {selectedEntity?.homonyms &&
                selectedEntity.homonyms.length > 0 && (
                  <div className="text-sm text-muted-foreground border border-border rounded-lg bg-secondary/40 px-4 py-3 space-y-1">
                    {selectedEntity.homonyms.map((h) => (
                      <p key={h.entityUri}>
                        Not to be confused with{" "}
                        <button
                          type="button"
                          onClick={() => setSelected(h.entityUri)}
                          className="text-primary hover:underline font-medium"
                        >
                          {h.label}
                        </button>
                        {h.author && (
                          <>
                            {" "}
                            by{" "}
                            {h.authorEntityUri ? (
                              <button
                                type="button"
                                onClick={() => setSelected(h.authorEntityUri!)}
                                className="text-primary hover:underline font-medium"
                              >
                                {h.author}
                              </button>
                            ) : (
                              h.author
                            )}
                          </>
                        )}
                        {h.label === h.sharedTitle ? (
                          <>, a different work bearing the same title.</>
                        ) : (
                          <>
                            , a different work also titled{" "}
                            <em>{h.sharedTitle}</em>.
                          </>
                        )}
                      </p>
                    ))}
                  </div>
                )}
              <div className="space-y-3">
                {groupedSections.map((g) => (
                  <div
                    key={g.philosopher}
                    className="border border-border rounded-lg bg-card px-4 py-3"
                  >
                    <div className="flex items-baseline gap-2 mb-2">
                      <p className="font-medium text-foreground">
                        {g.philosopher}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {g.sections.length} passage
                        {g.sections.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-1.5">
                      {g.sections.map((s) => (
                        <Link
                          key={s.id}
                          href={`/section/${s.id}`}
                          className="flex items-start justify-between gap-2 px-2 py-1.5 rounded-md border border-border bg-background hover:border-primary/50 transition-colors"
                        >
                          <span className="min-w-0">
                            <span className="block text-xs font-mono text-primary">
                              {s.id}
                            </span>
                            {s.snippet && (
                              <span className="block text-[11px] leading-snug text-muted-foreground/90 mt-1 line-clamp-2">
                                {s.snippetStart !== undefined &&
                                s.snippetEnd !== undefined ? (
                                  <>
                                    {grcSpans(s.snippet.slice(0, s.snippetStart))}
                                    <mark className="bg-primary/15 text-foreground rounded-sm px-0.5">
                                      {grcSpans(
                                        s.snippet.slice(
                                          s.snippetStart,
                                          s.snippetEnd,
                                        ),
                                      )}
                                    </mark>
                                    {grcSpans(s.snippet.slice(s.snippetEnd))}
                                  </>
                                ) : (
                                  grcSpans(s.snippet)
                                )}
                              </span>
                            )}
                          </span>
                          {s.occurrences > 1 && (
                            <span className="text-[10px] px-1 rounded-full bg-secondary text-secondary-foreground font-sans font-medium shrink-0">
                              ×{s.occurrences}
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filter by name…"
                aria-label="Filter index entries by name"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setKind("all")}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                  kind === "all"
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({entities?.length ?? 0})
              </button>
              {KIND_ORDER.filter((k) => (kindCounts.get(k) ?? 0) > 0).map(
                (k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k === kind ? "all" : k)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${KIND_STYLES[k].chip} ${
                      kind === k
                        ? "ring-2 ring-primary/50"
                        : "opacity-80 hover:opacity-100"
                    }`}
                  >
                    {KIND_STYLES[k].label} ({kindCounts.get(k)})
                  </button>
                ),
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="text-sm text-muted-foreground flex items-center gap-2 px-1">
                {`${filtered.length} tagged name${filtered.length === 1 ? "" : "s"} & terms`}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {filtered.map((e) => (
                  <EntityCard
                    key={e.entityUri}
                    e={e}
                    onSelect={() => setSelected(e.entityUri)}
                  />
                ))}
              </div>
              {filtered.length === 0 && suggestions.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground px-1">
                    No exact match for &ldquo;{q.trim()}&rdquo;. Closest
                    names:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {suggestions.map((e) => (
                      <EntityCard
                        key={e.entityUri}
                        e={e}
                        namesakeCount={e.namesakeCount}
                        onSelect={() => setSelected(e.entityUri)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {filtered.length === 0 && suggestions.length === 0 && (
                <p className="text-center text-muted-foreground py-10">
                  No tagged entity matches this filter.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// One card shape for both the main grid and the near-miss suggestions:
// name, optional Greek/homonym lines, and a compact meta line.
function EntityCard({
  e,
  namesakeCount,
  onSelect,
}: {
  e: {
    label: string;
    kind: string;
    altTitle?: string;
    grc?: string;
    grcHomonymForm?: string;
    grcHomonymUncertified?: boolean;
    occurrences: number;
    sectionCount: number;
  };
  namesakeCount?: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="text-left border border-border rounded-lg px-4 py-2.5 bg-card hover:border-primary/50 hover:shadow-sm transition-all"
    >
      <div className="min-w-0">
        <p
          className={`font-medium text-foreground truncate ${e.kind === "term" ? "font-serif" : ""}`}
          lang={e.kind === "term" ? "grc" : undefined}
        >
          {e.label}
          {namesakeCount !== undefined && namesakeCount > 1 && (
            <span className="ml-2 inline-block align-middle text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 rounded px-1.5 py-0.5">
              one of {namesakeCount} namesakes
            </span>
          )}
        </p>
        {e.altTitle && (
          <p className="text-xs text-muted-foreground italic truncate">
            also <em>{e.altTitle}</em>
          </p>
        )}
        {e.grc && e.grc !== e.grcHomonymForm && (
          <p lang="grc" className="text-xs text-muted-foreground truncate font-serif">
            {e.grc}
          </p>
        )}
        {e.grcHomonymForm && (
          <p className="text-xs text-muted-foreground truncate">
            {e.grcHomonymUncertified ? "same name " : "shares the name "}
            <span lang="grc" className="font-serif">
              {e.grcHomonymForm}
            </span>
            {e.grcHomonymUncertified && " (uncertified)"}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {KIND_STYLES[e.kind]?.label ?? e.kind} · {e.occurrences} occ. ·{" "}
          {e.sectionCount} sect.
        </p>
      </div>
    </button>
  );
}
