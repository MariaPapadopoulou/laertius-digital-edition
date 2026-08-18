import { usePageTitle } from "@/lib/use-page-title";
import { AboutLink } from "@/components/about-link";
import { useState, useEffect, useMemo } from "react";
import { useSearch } from "wouter";
import {
  useListAnecdotes,
  getListAnecdotesQueryKey,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AnecdoteCard } from "@/components/anecdote-card";
import { useScrollMemory } from "@/hooks/use-scroll-memory";
import { useResetOnSamePageNav } from "@/hooks/use-reset-on-same-page-nav";
import { EntityIndexBanner } from "@/components/entity-index-banner";
import { Search, Loader2 } from "lucide-react";

export default function AnecdotesPage() {
  usePageTitle("Anecdotes");
  const initial = useMemo(
    () => new URLSearchParams(window.location.search),
    [],
  );
  const [qInput, setQInput] = useState(() => initial.get("q") ?? "");
  const [q, setQ] = useState(() => (initial.get("q") ?? "").trim());
  const [philosopher, setPhilosopher] = useState(
    () => initial.get("philosopher") ?? "all",
  );
  const [topic, setTopic] = useState(() => initial.get("topic") ?? "all");
  const [book, setBook] = useState(() => {
    const b = initial.get("book");
    return b && /^\d+$/.test(b) ? b : "all";
  });
  const [involving, setInvolving] = useState(
    () => initial.get("involves") ?? "all",
  );

  // A "with X" badge on a card links to /anecdotes?involves=X. When that
  // navigation happens while this page is already mounted, pick the new
  // participant up from the search string so the filter updates in place.
  // The badge link carries ONLY ?involves=, so any other active filter
  // must be dropped too — otherwise stale q/philosopher/topic/book state
  // would be re-written into the URL by the sync effect and silently
  // intersect with the new participant.
  const search = useSearch();
  useEffect(() => {
    const params = new URLSearchParams(search);
    const inv = params.get("involves");
    if (inv) {
      if (inv !== involving) setInvolving(inv);
      // Missing params on a badge URL mean "no filter". Our own URL-sync
      // effect always writes active filters back into the URL, so this
      // never fights the controls.
      const p = params.get("philosopher") ?? "all";
      if (p !== philosopher) setPhilosopher(p);
      const t = params.get("topic") ?? "all";
      if (t !== topic) setTopic(t);
      const nq = (params.get("q") ?? "").trim();
      if (nq !== q) {
        setQ(nq);
        setQInput(params.get("q") ?? "");
      }
      const rawBook = params.get("book");
      const nb = rawBook && /^\d+$/.test(rawBook) ? rawBook : "all";
      if (nb !== book) setBook(nb);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Keep the URL in sync so filtered views can be bookmarked and shared.
  useEffect(() => {
    const url = new URL(window.location.href);
    const set = (key: string, value: string, empty: string) => {
      if (value && value !== empty) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    };
    set("q", q, "");
    set("philosopher", philosopher, "all");
    set("topic", topic, "all");
    set("book", book, "all");
    set("involves", involving, "all");
    window.history.replaceState(null, "", url);
  }, [q, philosopher, topic, book, involving]);

  // Debounce the keyword box so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 250);
    return () => clearTimeout(t);
  }, [qInput]);

  // Full list for building the philosopher/topic filter facets.
  const { data: allAnecdotes } = useListAnecdotes(
    {},
    { query: { queryKey: getListAnecdotesQueryKey({}) } },
  );

  const params = {
    ...(q ? { q } : {}),
    ...(philosopher !== "all" ? { philosopher } : {}),
    ...(topic !== "all" ? { topic } : {}),
    ...(book !== "all" ? { book: Number(book) } : {}),
  };
  const { data: fetchedAnecdotes, isFetching } = useListAnecdotes(params, {
    query: { queryKey: getListAnecdotesQueryKey(params) },
  });

  // The participant facet is small, so it filters client-side on top of
  // the server-side filters (same pattern as the sayings addressee facet).
  const anecdotes = useMemo(() => {
    if (!fetchedAnecdotes) return fetchedAnecdotes;
    if (involving === "all") return fetchedAnecdotes;
    return fetchedAnecdotes.filter((a) => a.involves === involving);
  }, [fetchedAnecdotes, involving]);

  // Restore the reader's place in the list on back navigation.
  useScrollMemory(
    `anecdotes-scroll:${q}|${philosopher}|${topic}|${book}|${involving}`,
    !isFetching && anecdotes !== undefined,
  );

  // Clicking the "Anecdotes" nav link while already here starts fresh:
  // clear the search box and all filters back to their defaults. ("with X"
  // badge links carry a query string and are not affected.)
  useResetOnSamePageNav(() => {
    setQInput("");
    setQ("");
    setPhilosopher("all");
    setTopic("all");
    setBook("all");
    setInvolving("all");
  });

  // Philosophers grouped by book so the list stays scannable; each
  // philosopher is listed under the book of their first anecdote.
  const philosopherGroups = useMemo(() => {
    const byName = new Map<string, number>();
    for (const a of allAnecdotes ?? []) {
      if (!byName.has(a.philosopher)) byName.set(a.philosopher, a.book);
    }
    const byBook = new Map<number, string[]>();
    for (const [name, b] of byName) {
      if (!byBook.has(b)) byBook.set(b, []);
      byBook.get(b)!.push(name);
    }
    return Array.from(byBook.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([b, names]) => ({
        book: b,
        names: names.sort((a, c) => a.localeCompare(c)),
      }));
  }, [allAnecdotes]);

  // If the URL named a philosopher we don't know, fall back to "all".
  useEffect(() => {
    if (
      allAnecdotes &&
      philosopher !== "all" &&
      !allAnecdotes.some((a) => a.philosopher === philosopher)
    ) {
      setPhilosopher("all");
    }
  }, [allAnecdotes, philosopher]);

  // Likewise for an unknown topic from the URL.
  useEffect(() => {
    if (
      allAnecdotes &&
      topic !== "all" &&
      !allAnecdotes.some((a) => a.topic === topic)
    ) {
      setTopic("all");
    }
  }, [allAnecdotes, topic]);

  // Likewise for an unknown participant from the URL.
  useEffect(() => {
    if (
      allAnecdotes &&
      involving !== "all" &&
      !allAnecdotes.some((a) => a.involves === involving)
    ) {
      setInvolving("all");
    }
  }, [allAnecdotes, involving]);

  const books = useMemo(
    () =>
      Array.from(new Set((allAnecdotes ?? []).map((a) => a.book))).sort(
        (a, b) => a - b,
      ),
    [allAnecdotes],
  );

  const topics = useMemo(
    () =>
      Array.from(new Set((allAnecdotes ?? []).map((a) => a.topic))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [allAnecdotes],
  );

  const participants = useMemo(
    () =>
      Array.from(
        new Set(
          (allAnecdotes ?? [])
            .map((a) => a.involves)
            .filter((n): n is string => !!n),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [allAnecdotes],
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-serif font-bold text-foreground">
          Anecdotes
        </h1>
        <AboutLink anchor="layer-anecdotes" label="About the curated layers" />
      </div>

      <div className="space-y-6 border-b border-border pb-8">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search the anecdotes (Greek or English)..."
            aria-label="Search the anecdotes"
            className="pl-10 h-11 text-base bg-background"
          />
        </div>

        <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-border">
          <div className="flex items-center gap-3">
            <Label
              htmlFor="phil"
              className="text-sm text-muted-foreground font-normal"
            >
              Philosopher
            </Label>
            <Select value={philosopher} onValueChange={setPhilosopher}>
              <SelectTrigger id="phil" className="w-[200px] h-9 bg-background">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent className="max-h-[320px]">
                <SelectItem value="all">All philosophers</SelectItem>
                {philosopherGroups.map((group) => (
                  <SelectGroup key={group.book}>
                    <SelectLabel>Book {group.book}</SelectLabel>
                    {group.names.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Label
              htmlFor="topic"
              className="text-sm text-muted-foreground font-normal"
            >
              Topic
            </Label>
            <Select value={topic} onValueChange={setTopic}>
              <SelectTrigger id="topic" className="w-[180px] h-9 bg-background">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent className="max-h-[320px]">
                <SelectItem value="all">All topics</SelectItem>
                {topics.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Label
              htmlFor="book"
              className="text-sm text-muted-foreground font-normal"
            >
              Book
            </Label>
            <Select value={book} onValueChange={setBook}>
              <SelectTrigger id="book" className="w-[110px] h-9 bg-background">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {books.map((b) => (
                  <SelectItem key={b} value={String(b)}>
                    Book {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Label
              htmlFor="involving"
              className="text-sm text-muted-foreground font-normal"
            >
              Involving
            </Label>
            <Select value={involving} onValueChange={setInvolving}>
              <SelectTrigger
                id="involving"
                className="w-[180px] h-9 bg-background"
              >
                <SelectValue placeholder="Anyone" />
              </SelectTrigger>
              <SelectContent className="max-h-[320px]">
                <SelectItem value="all">Anyone</SelectItem>
                {participants.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <EntityIndexBanner
        names={[
          philosopher !== "all" ? philosopher : null,
          involving !== "all" ? involving : null,
        ]}
      />

      <div className="space-y-6">
        <div className="text-sm text-muted-foreground flex items-center justify-between px-1">
          <span className="flex items-center gap-2">
            {anecdotes
              ? `${anecdotes.length} anecdotes`
              : "Loading anecdotes..."}
          </span>
          {isFetching && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {anecdotes && anecdotes.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border border-dashed rounded-xl text-muted-foreground">
            No anecdotes match these filters.
          </div>
        ) : (
          <div className="space-y-6">
            {(anecdotes ?? []).map((anecdote) => (
              <AnecdoteCard key={anecdote.id} anecdote={anecdote} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
