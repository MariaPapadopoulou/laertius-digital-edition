import { usePageTitle } from "@/lib/use-page-title";
import { AboutLink } from "@/components/about-link";
import { useState, useEffect, useMemo } from "react";
import { useSearch } from "wouter";
import {
  useListVerses,
  getListVersesQueryKey,
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
import { VerseCard } from "@/components/verse-card";
import { TextLayoutToggle } from "@/components/passage-card";
import { useScrollMemory } from "@/hooks/use-scroll-memory";
import { useResetOnSamePageNav } from "@/hooks/use-reset-on-same-page-nav";
import { Search, Loader2 } from "lucide-react";
import { EntityIndexBanner } from "@/components/entity-index-banner";

export default function VersesPage() {
  usePageTitle("Verses");
  const initial = useMemo(
    () => new URLSearchParams(window.location.search),
    [],
  );
  const [qInput, setQInput] = useState(() => initial.get("q") ?? "");
  const [q, setQ] = useState(() => (initial.get("q") ?? "").trim());
  const [philosopher, setPhilosopher] = useState(
    () => initial.get("philosopher") ?? "all",
  );
  const [book, setBook] = useState(() => {
    const b = initial.get("book");
    return b && /^\d+$/.test(b) ? b : "all";
  });
  const [genre, setGenre] = useState(() =>
    initial.get("genre") === "epigram" ? "epigram" : "all",
  );
  const [author, setAuthor] = useState(() => initial.get("author") ?? "all");

  // A "by <poet>" badge on a verse card links to /verses?author=X. When that
  // navigation happens while this page is already mounted, pick the new
  // poet up from the search string so the filter updates in place.
  const search = useSearch();
  useEffect(() => {
    const a = new URLSearchParams(search).get("author");
    if (a && a !== author) setAuthor(a);
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
    set("book", book, "all");
    set("genre", genre, "all");
    set("author", author, "all");
    window.history.replaceState(null, "", url);
  }, [q, philosopher, book, genre, author]);

  // Debounce the keyword box so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 250);
    return () => clearTimeout(t);
  }, [qInput]);

  // Full list for building the philosopher/book filter facets.
  const { data: allVerses } = useListVerses(
    {},
    { query: { queryKey: getListVersesQueryKey({}) } },
  );

  const params = {
    ...(q ? { q } : {}),
    ...(philosopher !== "all" ? { philosopher } : {}),
    ...(book !== "all" ? { book: Number(book) } : {}),
    ...(genre !== "all" ? { genre: "epigram" as const } : {}),
    ...(author !== "all" ? { author } : {}),
  };
  const { data: verses, isFetching } = useListVerses(params, {
    query: { queryKey: getListVersesQueryKey(params) },
  });

  // Restore the reader's place in the list on back navigation.
  useScrollMemory(
    `verses-scroll:${q}|${philosopher}|${book}|${genre}|${author}`,
    !isFetching && verses !== undefined,
  );

  // Clicking the "Verses" nav link while already here starts fresh: clear
  // the search box and all filters back to their defaults. ("by <poet>"
  // badge links carry a query string and are not affected.)
  useResetOnSamePageNav(() => {
    setQInput("");
    setQ("");
    setPhilosopher("all");
    setBook("all");
    setGenre("all");
    setAuthor("all");
  });

  const books = useMemo(
    () =>
      Array.from(new Set((allVerses ?? []).map((v) => v.book))).sort(
        (a, b) => a - b,
      ),
    [allVerses],
  );

  const philosopherGroups = useMemo(() => {
    const byName = new Map<string, number>();
    for (const v of allVerses ?? []) {
      if (!byName.has(v.philosopher)) byName.set(v.philosopher, v.book);
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
  }, [allVerses]);

  // Poet index: curated attributions with verse counts, most-quoted first.
  const authors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of allVerses ?? []) {
      if (v.author) counts.set(v.author, (counts.get(v.author) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
  }, [allVerses]);

  const attributedCount = useMemo(
    () => (allVerses ?? []).filter((v) => v.author).length,
    [allVerses],
  );

  // If the URL named a philosopher we don't know, fall back to "all".
  useEffect(() => {
    if (
      allVerses &&
      philosopher !== "all" &&
      !allVerses.some((v) => v.philosopher === philosopher)
    ) {
      setPhilosopher("all");
    }
  }, [allVerses, philosopher]);

  // Same for an unknown ?author= in the URL - case-insensitive to match the
  // server filter, canonicalizing the label so the select/chips highlight.
  useEffect(() => {
    if (allVerses && author !== "all") {
      const match = authors.find(
        ([name]) => name.toLowerCase() === author.toLowerCase(),
      );
      if (!match) {
        setAuthor("all");
      } else if (match[0] !== author) {
        setAuthor(match[0]);
      }
    }
  }, [allVerses, authors, author]);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-serif font-bold text-foreground">
          Verses &amp; Epigrams
        </h1>
        <AboutLink anchor="layer-verses" label="About the curated layers" />
      </div>

      <div className="space-y-6 border-b border-border pb-8">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search the verses (Greek or English)..."
            aria-label="Search the verses"
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
              htmlFor="genre"
              className="text-sm text-muted-foreground font-normal"
            >
              Type
            </Label>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger id="genre" className="w-[150px] h-9 bg-background">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All verses</SelectItem>
                <SelectItem value="epigram">Epigrams</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Label
              htmlFor="author"
              className="text-sm text-muted-foreground font-normal"
            >
              Poet
            </Label>
            <Select value={author} onValueChange={setAuthor}>
              <SelectTrigger
                id="author"
                className="w-[200px] h-9 bg-background"
              >
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent className="max-h-[320px]">
                <SelectItem value="all">All poets</SelectItem>
                {authors.map(([name, count]) => (
                  <SelectItem key={name} value={name}>
                    {name} ({count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-4 border-b border-border pb-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-serif font-bold text-foreground">
            Index of poets
          </h2>
          <span className="text-xs text-muted-foreground">
            {allVerses
              ? `${attributedCount} of ${allVerses.length} verses carry a named attribution`
              : ""}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {authors.map(([name, count]) => (
            <button
              key={name}
              type="button"
              onClick={() => setAuthor(author === name ? "all" : name)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                author === name
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:border-primary/50 hover:text-primary"
              }`}
            >
              {name}
              <span
                className={`ml-1.5 ${
                  author === name
                    ? "text-primary-foreground/70"
                    : "text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <EntityIndexBanner names={[author !== "all" ? author : null]} />

      <div className="space-y-6">
        <div className="text-sm text-muted-foreground flex items-center justify-between px-1">
          <span className="flex items-center gap-2">
            {verses ? `${verses.length} verses` : "Loading verses..."}
          </span>
          <span className="flex items-center gap-3">
            {isFetching && (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
            <TextLayoutToggle />
          </span>
        </div>

        {verses && verses.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border border-dashed rounded-xl text-muted-foreground">
            No verses match these filters.
          </div>
        ) : (
          <div className="space-y-6">
            {(verses ?? []).map((verse) => (
              <VerseCard key={verse.id} verse={verse} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
