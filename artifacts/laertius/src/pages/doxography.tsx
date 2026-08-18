import { usePageTitle } from "@/lib/use-page-title";
import { AboutLink } from "@/components/about-link";
import { useState, useEffect, useMemo } from "react";
import { useSearch } from "wouter";
import {
  useListDoxai,
  getListDoxaiQueryKey,
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
import { DoxaCard } from "@/components/doxa-card";
import { useScrollMemory } from "@/hooks/use-scroll-memory";
import { useResetOnSamePageNav } from "@/hooks/use-reset-on-same-page-nav";
import { EntityIndexBanner } from "@/components/entity-index-banner";
import { Search, Loader2 } from "lucide-react";

export default function DoxographyPage() {
  usePageTitle("Doxai");
  const initial = useMemo(
    () => new URLSearchParams(window.location.search),
    [],
  );
  const [qInput, setQInput] = useState(() => initial.get("q") ?? "");
  const [q, setQ] = useState(() => (initial.get("q") ?? "").trim());
  const [philosopher, setPhilosopher] = useState(
    () => initial.get("philosopher") ?? "all",
  );
  const [domain, setDomain] = useState(() => initial.get("domain") ?? "all");
  const [book, setBook] = useState(() => {
    const b = initial.get("book");
    return b && /^\d+$/.test(b) ? b : "all";
  });

  // A domain badge on a card links to /doxography?domain=X. When that
  // navigation happens while this page is already mounted, pick the new
  // domain up from the search string so the filter updates in place. The
  // badge link carries NO philosopher param, so an active philosopher
  // filter must be dropped too — otherwise it would silently intersect
  // with the new domain and could show an empty or misleading list.
  const search = useSearch();
  useEffect(() => {
    const params = new URLSearchParams(search);
    const d = params.get("domain");
    if (d) {
      if (d !== domain) setDomain(d);
      // Reconcile the philosopher even when the domain is unchanged (e.g.
      // clicking a badge for the already-selected domain): the badge URL
      // omits ?philosopher=, so a missing param means "all". Our own
      // URL-sync effect always writes ?philosopher= back while a
      // philosopher is selected, so this never fights the dropdown.
      const p = params.get("philosopher") ?? "all";
      if (p !== philosopher) setPhilosopher(p);
      // The same reasoning applies to the keyword search and book filter:
      // the badge URL omits ?q= and ?book=, so missing params mean "no
      // search" and "all books". Without this reset, stale q/book state
      // would be re-written into the URL by the sync effect and silently
      // intersect with the newly clicked domain.
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
    set("domain", domain, "all");
    set("book", book, "all");
    window.history.replaceState(null, "", url);
  }, [q, philosopher, domain, book]);

  // Debounce the keyword box so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 250);
    return () => clearTimeout(t);
  }, [qInput]);

  // Full list for building the philosopher/domain filter facets.
  const { data: allDoxai } = useListDoxai(
    {},
    { query: { queryKey: getListDoxaiQueryKey({}) } },
  );

  const params = {
    ...(q ? { q } : {}),
    ...(philosopher !== "all" ? { philosopher } : {}),
    ...(domain !== "all" ? { domain } : {}),
    ...(book !== "all" ? { book: Number(book) } : {}),
  };
  const { data: doxai, isFetching } = useListDoxai(params, {
    query: { queryKey: getListDoxaiQueryKey(params) },
  });

  // Restore the reader's place in the list on back navigation.
  useScrollMemory(
    `doxai-scroll:${q}|${philosopher}|${domain}|${book}`,
    !isFetching && doxai !== undefined,
  );

  // Clicking the "Doxai" nav link while already here starts fresh: clear
  // the search box and all filters back to their defaults.
  useResetOnSamePageNav(() => {
    setQInput("");
    setQ("");
    setPhilosopher("all");
    setDomain("all");
    setBook("all");
  });

  // Philosophers grouped by book so the list stays scannable; each
  // philosopher is listed under the book of their first doxa.
  const philosopherGroups = useMemo(() => {
    const byName = new Map<string, number>();
    for (const d of allDoxai ?? []) {
      if (!byName.has(d.philosopher)) byName.set(d.philosopher, d.book);
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
  }, [allDoxai]);

  // If the URL named a philosopher we don't know, fall back to "all".
  useEffect(() => {
    if (
      allDoxai &&
      philosopher !== "all" &&
      !allDoxai.some((d) => d.philosopher === philosopher)
    ) {
      setPhilosopher("all");
    }
  }, [allDoxai, philosopher]);

  // Likewise for an unknown domain from the URL.
  useEffect(() => {
    if (
      allDoxai &&
      domain !== "all" &&
      !allDoxai.some((d) => d.domain === domain)
    ) {
      setDomain("all");
    }
  }, [allDoxai, domain]);

  const books = useMemo(
    () =>
      Array.from(new Set((allDoxai ?? []).map((d) => d.book))).sort(
        (a, b) => a - b,
      ),
    [allDoxai],
  );

  const domains = useMemo(
    () =>
      Array.from(new Set((allDoxai ?? []).map((d) => d.domain))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [allDoxai],
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-serif font-bold text-foreground">
          Doxai: Recorded Opinions
        </h1>
        <AboutLink anchor="layer-doxography" label="About the curated layers" />
      </div>

      <div className="space-y-6 border-b border-border pb-8">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search the doctrines (Greek or English)..."
            aria-label="Search the doxai"
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
              htmlFor="domain"
              className="text-sm text-muted-foreground font-normal"
            >
              Domain
            </Label>
            <Select value={domain} onValueChange={setDomain}>
              <SelectTrigger id="domain" className="w-[190px] h-9 bg-background">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent className="max-h-[320px]">
                <SelectItem value="all">All domains</SelectItem>
                {domains.map((d) => (
                  <SelectItem key={d} value={d} className="capitalize">
                    {d}
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
        </div>
      </div>

      <EntityIndexBanner names={[philosopher !== "all" ? philosopher : null]} />

      <div className="space-y-6">
        <div className="text-sm text-muted-foreground flex items-center justify-between px-1">
          <span className="flex items-center gap-2">
            {doxai ? `${doxai.length} doxai` : "Loading doxai..."}
          </span>
          {isFetching && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {doxai && doxai.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border border-dashed rounded-xl text-muted-foreground">
            No doxai match these filters.
          </div>
        ) : (
          <div className="space-y-6">
            {(doxai ?? []).map((doxa) => (
              <DoxaCard key={doxa.id} doxa={doxa} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
