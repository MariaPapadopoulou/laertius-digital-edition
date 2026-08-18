import { usePageTitle } from "@/lib/use-page-title";
import { AboutLink } from "@/components/about-link";
import { useState, useEffect, useMemo } from "react";
import { useSearch } from "wouter";
import {
  useListEpistles,
  getListEpistlesQueryKey,
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
import { EpistleCard } from "@/components/epistle-card";
import { useScrollMemory } from "@/hooks/use-scroll-memory";
import { useResetOnSamePageNav } from "@/hooks/use-reset-on-same-page-nav";
import { EntityIndexBanner } from "@/components/entity-index-banner";
import { Search, Loader2 } from "lucide-react";

const AUTHENTICITY_VALUES = ["authentic", "disputed", "spurious"] as const;

const AUTHENTICITY_CHIP: Record<string, string> = {
  authentic:
    "border-emerald-500/40 text-emerald-700 dark:text-emerald-400 data-[active=true]:bg-emerald-500/15",
  disputed:
    "border-amber-500/40 text-amber-700 dark:text-amber-400 data-[active=true]:bg-amber-500/15",
  spurious:
    "border-red-500/40 text-red-700 dark:text-red-400 data-[active=true]:bg-red-500/15",
};

export default function EpistlesPage() {
  usePageTitle("Letters");
  const initial = useMemo(
    () => new URLSearchParams(window.location.search),
    [],
  );
  const [qInput, setQInput] = useState(() => initial.get("q") ?? "");
  const [q, setQ] = useState(() => (initial.get("q") ?? "").trim());
  const [sender, setSender] = useState(() => initial.get("sender") ?? "all");
  const [topic, setTopic] = useState(() => initial.get("topic") ?? "all");
  const [book, setBook] = useState(() => {
    const b = initial.get("book");
    return b && /^\d+$/.test(b) ? b : "all";
  });
  const [authenticity, setAuthenticity] = useState(() => {
    const v = initial.get("authenticity");
    return v && (AUTHENTICITY_VALUES as readonly string[]).includes(v)
      ? v
      : "all";
  });
  const [addressee, setAddressee] = useState(() => initial.get("to") ?? "all");

  // Card badges link back to this page with a query param: the verdict
  // badge as /letters?verdict=X, the sender badge as ?from=X, the
  // addressee badge as ?to=X, and the topic badge as ?topic=X. When that
  // same-page navigation happens, the component stays mounted; pick the
  // values up from the search string so the filters update in place.
  // Unknown sender/addressee/topic values fall back to "all" via the
  // facet-validation effects below.
  // Each badge link carries ONLY its own param, so on a badge navigation
  // every other active filter must be dropped too — otherwise stale
  // q/sender/topic/book/authenticity/addressee state would be re-written
  // into the URL by the sync effect and silently intersect with the
  // newly clicked badge value.
  const search = useSearch();
  useEffect(() => {
    const params = new URLSearchParams(search);
    const v = params.get("verdict");
    const from = params.get("from");
    const to = params.get("to");
    const t = params.get("topic");
    if (v || from || to || t) {
      // The transient badge param (?verdict=/?from=) wins; otherwise fall
      // back to the persistent param our own URL-sync effect writes, so a
      // sync rewrite never fights the controls. Missing params mean "all".
      const rawAuth = v ?? params.get("authenticity");
      const na =
        rawAuth && (AUTHENTICITY_VALUES as readonly string[]).includes(rawAuth)
          ? rawAuth
          : "all";
      if (na !== authenticity) setAuthenticity(na);
      const ns = from ?? params.get("sender") ?? "all";
      if (ns !== sender) setSender(ns);
      const nto = to ?? "all";
      if (nto !== addressee) setAddressee(nto);
      const nt = t ?? "all";
      if (nt !== topic) setTopic(nt);
      const nq = (params.get("q") ?? "").trim();
      if (nq !== q) {
        setQ(nq);
        setQInput(params.get("q") ?? "");
      }
      const rawBook = params.get("book");
      const nb = rawBook && /^\d+$/.test(rawBook) ? rawBook : "all";
      if (nb !== book) setBook(nb);
    }
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the URL in sync so filtered views can be bookmarked and shared.
  useEffect(() => {
    const url = new URL(window.location.href);
    const set = (key: string, value: string, empty: string) => {
      if (value && value !== empty) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    };
    set("q", q, "");
    set("sender", sender, "all");
    set("topic", topic, "all");
    set("book", book, "all");
    set("authenticity", authenticity, "all");
    set("to", addressee, "all");
    // The badges' transient ?verdict= and ?from= params have been absorbed
    // into the authenticity and sender state above; drop them so they can't
    // fight the controls. (?to= and ?topic= share the persistent param
    // names, so the sync above already rewrites them.)
    url.searchParams.delete("verdict");
    url.searchParams.delete("from");
    window.history.replaceState(null, "", url);
  }, [q, sender, topic, book, authenticity, addressee]);

  // Debounce the keyword box so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 250);
    return () => clearTimeout(t);
  }, [qInput]);

  // Full list for building the filter facets.
  const { data: allEpistles } = useListEpistles(
    {},
    { query: { queryKey: getListEpistlesQueryKey({}) } },
  );

  const params = {
    ...(q ? { q } : {}),
    ...(sender !== "all" ? { sender } : {}),
    ...(topic !== "all" ? { topic } : {}),
    ...(book !== "all" ? { book: Number(book) } : {}),
    ...(authenticity !== "all" ? { authenticity } : {}),
  };
  const { data: fetchedEpistles, isFetching } = useListEpistles(params, {
    query: { queryKey: getListEpistlesQueryKey(params) },
  });

  // The addressee facet is small, so it filters client-side on top of the
  // server-side filters (mirrors the sayings page's "spoken to").
  const epistles = useMemo(() => {
    if (!fetchedEpistles) return fetchedEpistles;
    if (addressee === "all") return fetchedEpistles;
    return fetchedEpistles.filter((e) => e.to === addressee);
  }, [fetchedEpistles, addressee]);

  // Restore the reader's place in the list on back navigation.
  useScrollMemory(
    `epistles-scroll:${q}|${sender}|${topic}|${book}|${authenticity}|${addressee}`,
    !isFetching && epistles !== undefined,
  );

  // Clicking the "Letters" nav link while already here starts fresh:
  // clear the search box and all filters back to their defaults.
  useResetOnSamePageNav(() => {
    setQInput("");
    setQ("");
    setSender("all");
    setTopic("all");
    setBook("all");
    setAuthenticity("all");
    setAddressee("all");
  });

  // If the URL named a sender we don't know, fall back to "all".
  useEffect(() => {
    if (
      allEpistles &&
      sender !== "all" &&
      !allEpistles.some((e) => e.sender === sender)
    ) {
      setSender("all");
    }
  }, [allEpistles, sender]);

  // Likewise for an unknown topic or addressee from the URL.
  useEffect(() => {
    if (
      allEpistles &&
      topic !== "all" &&
      !allEpistles.some((e) => e.topic === topic)
    ) {
      setTopic("all");
    }
  }, [allEpistles, topic]);

  useEffect(() => {
    if (
      allEpistles &&
      addressee !== "all" &&
      !allEpistles.some((e) => e.to === addressee)
    ) {
      setAddressee("all");
    }
  }, [allEpistles, addressee]);

  const senderGroups = useMemo(() => {
    const byName = new Map<string, number>();
    for (const e of allEpistles ?? []) {
      if (!byName.has(e.sender)) byName.set(e.sender, e.book);
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
  }, [allEpistles]);

  const addressees = useMemo(
    () =>
      Array.from(new Set((allEpistles ?? []).map((e) => e.to))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [allEpistles],
  );

  const topics = useMemo(
    () =>
      Array.from(new Set((allEpistles ?? []).map((e) => e.topic))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [allEpistles],
  );

  const books = useMemo(
    () =>
      Array.from(new Set((allEpistles ?? []).map((e) => e.book))).sort(
        (a, b) => a - b,
      ),
    [allEpistles],
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-serif font-bold text-foreground">
          Letters
        </h1>
        <AboutLink anchor="layer-letters" label="About the curated layers" />
      </div>

      <div className="space-y-6 border-b border-border pb-8">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search the letters (Greek or English)..."
            aria-label="Search the letters"
            className="pl-10 h-11 text-base bg-background"
          />
        </div>

        <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-border">
          <div className="flex items-center gap-3">
            <Label
              htmlFor="sender"
              className="text-sm text-muted-foreground font-normal"
            >
              From
            </Label>
            <Select value={sender} onValueChange={setSender}>
              <SelectTrigger id="sender" className="w-[190px] h-9 bg-background">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent className="max-h-[320px]">
                <SelectItem value="all">All senders</SelectItem>
                {senderGroups.map((group) => (
                  <SelectGroup key={group.book}>
                    <SelectLabel>Book {group.book}</SelectLabel>
                    {group.names.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Label
              htmlFor="addressee"
              className="text-sm text-muted-foreground font-normal"
            >
              To
            </Label>
            <Select value={addressee} onValueChange={setAddressee}>
              <SelectTrigger
                id="addressee"
                className="w-[190px] h-9 bg-background"
              >
                <SelectValue placeholder="Anyone" />
              </SelectTrigger>
              <SelectContent className="max-h-[320px]">
                <SelectItem value="all">Anyone</SelectItem>
                {addressees.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
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
              <SelectTrigger id="topic" className="w-[160px] h-9 bg-background">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
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

          <div className="flex flex-wrap items-center gap-3">
            <Label className="text-sm text-muted-foreground font-normal">
              Authenticity
            </Label>
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Filter by authenticity"
            >
              <button
                type="button"
                data-active={authenticity === "all"}
                onClick={() => setAuthenticity("all")}
                className="px-3 h-8 rounded-full border text-sm border-border text-muted-foreground data-[active=true]:bg-muted data-[active=true]:text-foreground hover:bg-muted/60 transition-colors"
              >
                All
              </button>
              {AUTHENTICITY_VALUES.map((v) => (
                <button
                  key={v}
                  type="button"
                  data-active={authenticity === v}
                  onClick={() =>
                    setAuthenticity(authenticity === v ? "all" : v)
                  }
                  className={`px-3 h-8 rounded-full border text-sm capitalize hover:bg-muted/60 transition-colors ${AUTHENTICITY_CHIP[v]}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <EntityIndexBanner
        names={[
          sender !== "all" ? sender : null,
          addressee !== "all" ? addressee : null,
        ]}
      />

      <div className="space-y-6">
        <div className="text-sm text-muted-foreground flex items-center justify-between px-1">
          <span className="flex items-center gap-2">
            {epistles ? `${epistles.length} letters` : "Loading letters..."}
          </span>
          {isFetching && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {epistles && epistles.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border border-dashed rounded-xl text-muted-foreground">
            No letters match these filters.
          </div>
        ) : (
          <div className="space-y-6">
            {(epistles ?? []).map((epistle) => (
              <EpistleCard key={epistle.id} epistle={epistle} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
