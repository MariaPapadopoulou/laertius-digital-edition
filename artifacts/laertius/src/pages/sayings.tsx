import { usePageTitle } from "@/lib/use-page-title";
import { AboutLink } from "@/components/about-link";
import { useState, useEffect, useMemo } from "react";
import { useSearch } from "wouter";
import {
  useListSayings,
  getListSayingsQueryKey,
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
import { SayingCard } from "@/components/saying-card";
import { useScrollMemory } from "@/hooks/use-scroll-memory";
import { useResetOnSamePageNav } from "@/hooks/use-reset-on-same-page-nav";
import { EntityIndexBanner } from "@/components/entity-index-banner";
import { Search, Loader2 } from "lucide-react";

export default function SayingsPage() {
  usePageTitle("Sayings");
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
  const [spokenTo, setSpokenTo] = useState(() => initial.get("to") ?? "all");

  // A topic badge on a card links to /sayings?topic=X. When that
  // same-page navigation happens, the component stays mounted; pick the
  // topic up from the search string so the filter updates in place. The
  // badge link carries ONLY ?topic=, so any other active filter must be
  // dropped too — otherwise stale q/philosopher/book/to state would be
  // re-written into the URL by the sync effect and silently intersect
  // with the new topic, which can show a misleading or empty list.
  const search = useSearch();
  useEffect(() => {
    const params = new URLSearchParams(search);
    const t = params.get("topic");
    if (t) {
      if (t !== topic) setTopic(t);
      // Missing params on a badge URL mean "no filter". Our own URL-sync
      // effect always writes active filters back into the URL, so this
      // never fights the controls.
      const p = params.get("philosopher") ?? "all";
      if (p !== philosopher) setPhilosopher(p);
      const nq = (params.get("q") ?? "").trim();
      if (nq !== q) {
        setQ(nq);
        setQInput(params.get("q") ?? "");
      }
      const rawBook = params.get("book");
      const nb = rawBook && /^\d+$/.test(rawBook) ? rawBook : "all";
      if (nb !== book) setBook(nb);
      const to = params.get("to") ?? "all";
      if (to !== spokenTo) setSpokenTo(to);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

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
    set("to", spokenTo, "all");
    window.history.replaceState(null, "", url);
  }, [q, philosopher, topic, book, spokenTo]);

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 250);
    return () => clearTimeout(t);
  }, [qInput]);

  const { data: allSayings } = useListSayings(
    {},
    { query: { queryKey: getListSayingsQueryKey({}) } },
  );

  const params = {
    ...(q ? { q } : {}),
    ...(philosopher !== "all" ? { philosopher } : {}),
    ...(topic !== "all" ? { topic } : {}),
    ...(book !== "all" ? { book: Number(book) } : {}),
  };
  const { data: fetchedSayings, isFetching } = useListSayings(params, {
    query: { queryKey: getListSayingsQueryKey(params) },
  });

  const sayings = useMemo(() => {
    if (!fetchedSayings) return fetchedSayings;
    if (spokenTo === "all") return fetchedSayings;
    return fetchedSayings.filter((s) => s.to === spokenTo);
  }, [fetchedSayings, spokenTo]);

  useScrollMemory(
    `sayings-scroll:${q}|${philosopher}|${topic}|${book}|${spokenTo}`,
    !isFetching && sayings !== undefined,
  );

  useResetOnSamePageNav(() => {
    setQInput("");
    setQ("");
    setPhilosopher("all");
    setTopic("all");
    setBook("all");
    setSpokenTo("all");
  });

  const philosopherGroups = useMemo(() => {
    const byName = new Map<string, number>();
    for (const s of allSayings ?? []) {
      if (!byName.has(s.philosopher)) byName.set(s.philosopher, s.book);
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
  }, [allSayings]);

  useEffect(() => {
    if (
      allSayings &&
      philosopher !== "all" &&
      !allSayings.some((s) => s.philosopher === philosopher)
    ) {
      setPhilosopher("all");
    }
  }, [allSayings, philosopher]);

  const books = useMemo(
    () =>
      Array.from(new Set((allSayings ?? []).map((s) => s.book))).sort(
        (a, b) => a - b,
      ),
    [allSayings],
  );

  const topics = useMemo(
    () =>
      Array.from(new Set((allSayings ?? []).map((s) => s.topic))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [allSayings],
  );

  const addressees = useMemo(
    () =>
      Array.from(
        new Set(
          (allSayings ?? [])
            .map((s) => s.to)
            .filter((t): t is string => !!t),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [allSayings],
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-serif font-bold text-foreground">
          Sayings &amp; Apophthegms
        </h1>
        <AboutLink anchor="layer-sayings" label="About the curated layers" />
      </div>

      <div className="space-y-6 border-b border-border pb-8">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search the sayings (Greek or English)..."
            aria-label="Search the sayings"
            className="pl-10 h-11 text-base bg-background"
          />
        </div>

        <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-border">
          <div className="flex items-center gap-3">
            <Label htmlFor="phil" className="text-sm text-muted-foreground font-normal">
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
            <Label htmlFor="topic" className="text-sm text-muted-foreground font-normal">
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
            <Label htmlFor="book" className="text-sm text-muted-foreground font-normal">
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
            <Label htmlFor="spoken-to" className="text-sm text-muted-foreground font-normal">
              Spoken to
            </Label>
            <Select value={spokenTo} onValueChange={setSpokenTo}>
              <SelectTrigger id="spoken-to" className="w-[180px] h-9 bg-background">
                <SelectValue placeholder="Anyone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Anyone</SelectItem>
                {addressees.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
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
          spokenTo !== "all" ? spokenTo : null,
        ]}
      />

      <div className="space-y-6">
        <div className="text-sm text-muted-foreground flex items-center justify-between px-1">
          <span className="flex items-center gap-2">
            {sayings ? `${sayings.length} sayings` : "Loading sayings..."}
          </span>
          {isFetching && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {sayings && sayings.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border border-dashed rounded-xl text-muted-foreground">
            No sayings match these filters.
          </div>
        ) : (
          <div className="space-y-6">
            {(sayings ?? []).map((saying) => (
              <SayingCard key={saying.id} saying={saying} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
