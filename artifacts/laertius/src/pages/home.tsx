import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { SiteFooter } from "@/components/site-footer";
import { usePageTitle } from "@/lib/use-page-title";
import { useResetOnSamePageNav } from "@/hooks/use-reset-on-same-page-nav";
import { useGetCorpusStats, useListPhilosophers } from "@workspace/api-client-react";
import schoolOfAthens from "../assets/school-of-athens.jpg";

const CRIMSON = "var(--home-crimson)";
const CRIMSON_LIGHT = "var(--home-crimson-light)";

const NAV_ITEMS: { label: string; href?: string; sub: { label: string; href: string }[] }[] = [
  {
    label: "The Text",
    sub: [
      { label: "Browse", href: "/browse" },
      { label: "Search", href: "/search" },
      { label: "Index", href: "/entities" },
    ],
  },
  {
    label: "Textual Genres",
    sub: [
      { label: "Verses", href: "/verses" },
      { label: "Sayings", href: "/sayings" },
      { label: "Doxai", href: "/doxography" },
      { label: "Anecdotes", href: "/anecdotes" },
      { label: "Letters", href: "/letters" },
      { label: "Testaments", href: "/testaments" },
    ],
  },
  {
    label: "Explorations",
    sub: [
      { label: "Graph", href: "/graph" },
      { label: "Timeline", href: "/timeline" },
      { label: "Map", href: "/map" },
    ],
  },
  {
    label: "Ask Laertius",
    sub: [
      { label: "Ask Laertius", href: "/ask" },
      { label: "Competency Questions", href: "/competency" },
      { label: "Ontoterminology", href: "/terminology" },
      { label: "Assertions", href: "/legomena" },
      { label: "SPARQL console", href: "/legomena/sparql" },
    ],
  },
  {
    label: "About",
    sub: [
      { label: "About this edition", href: "/about" },
      { label: "Why this approach", href: "/approach" },
      { label: "Statistics & LOD", href: "/stats" },
    ],
  },
];

const BOOKS = [
  { num: "I",    title: "Introduction & Presocratics",   names: "Thales, Solon, Pittacus, Bias, Cleobulus, Myson, Chilon, Anacharsis, Periander" },
  { num: "II",   title: "Socrates & the Socratics",      names: "Anaximander, Anaximenes, Anaxagoras, Archelaus, Socrates, Xenophon, Aristippus" },
  { num: "III",  title: "Plato",                         names: "The life and works of Plato of Athens" },
  { num: "IV",   title: "The Academy",                   names: "Speusippus, Xenocrates, Polemon, Crates, Crantor, Arcesilaus, Bion, Lacydes" },
  { num: "V",    title: "Aristotle & the Peripatetics",  names: "Aristotle, Theophrastus, Strato, Lyco, Demetrius, Heraclides" },
  { num: "VI",   title: "The Cynics",                    names: "Antisthenes, Diogenes, Monimus, Onesicritus, Crates, Metrocles, Hipparchia" },
  { num: "VII",  title: "The Stoics",                    names: "Zeno, Aristo, Herillus, Dionysus, Cleanthes, Sphaerus, Chrysippus" },
  { num: "VIII", title: "The Pythagoreans",              names: "Pythagoras, Empedocles, Epicharmus, Archytas, Alcmaeon, Hippasus, Philolaus" },
  { num: "IX",   title: "Various Philosophers",          names: "Heraclitus, Xenophanes, Parmenides, Melissus, Zeno of Elea, Leucippus, Democritus" },
  { num: "X",    title: "Epicurus",                      names: "The life, letters, and doctrines of Epicurus of Athens" },
];

// One column per book, one dot per Life (corpus chapters, excluding the
// Book I prologue); highlighted dots mark the Life (or Lives, on a tie)
// with the most text sections in each book. Validated against the
// api-server corpus by scripts/src/validate-lives-dots.ts — if the
// curated corpus changes, that validator prints the fresh table to
// paste here.
const ROMAN_BOOKS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

const LIVES_DOTS = [
  { num: "I", count: 11, highlight: [0, 1] },
  { num: "II", count: 17, highlight: [7] },
  { num: "III", count: 1, highlight: [0] },
  { num: "IV", count: 10, highlight: [5] },
  { num: "V", count: 6, highlight: [0] },
  { num: "VI", count: 9, highlight: [1] },
  { num: "VII", count: 7, highlight: [0] },
  { num: "VIII", count: 8, highlight: [0] },
  { num: "IX", count: 12, highlight: [10] },
  { num: "X", count: 1, highlight: [0] },
];

export default function LaertiusHome() {
  usePageTitle("Home");
  const [openNav, setOpenNav] = useState<string | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  // Hover-driven open/close is only wired up on devices that actually have a
  // hover-capable pointer. On touch devices the synthetic mouseenter fired
  // before a tap's click would otherwise open the menu and the click's toggle
  // would immediately close it again, making the submenus unreachable.
  const canHover = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover)").matches;

  // Close an open dropdown when tapping/clicking anywhere outside the nav,
  // and on Escape. Needed for touch devices, where there is no mouseleave.
  useEffect(() => {
    if (!openNav) return;
    const onPointerDown = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenNav(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenNav(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openNav]);
  // Touch devices have no hover: the first tap on a Lives dot shows its
  // tooltip (and prevents navigation); a second tap on the same dot follows
  // the link. Keyed by `${book}-${chapter}`. Hover-capable devices ignore
  // this entirely and keep the pure CSS hover/focus tooltip.
  const [activeDot, setActiveDot] = useState<string | null>(null);
  const dotGridRef = useRef<HTMLDivElement | null>(null);

  // Dismiss a tap-opened dot tooltip when tapping outside the grid or on
  // Escape, mirroring the nav dropdown behaviour.
  useEffect(() => {
    if (!activeDot) return;
    const onPointerDown = (e: PointerEvent) => {
      if (dotGridRef.current && !dotGridRef.current.contains(e.target as Node)) {
        setActiveDot(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveDot(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [activeDot]);

  const { data: philosophers } = useListPhilosophers();
  // One entry per book (index 0 = Book I): the ordered Lives of that book,
  // excluding the Book I prologue. Dot j (bottom-up) corresponds to livesByBook[b][j].
  const livesByBook = ROMAN_BOOKS.map((_, b) =>
    (philosophers ?? []).filter(p => p.book === b + 1 && p.chapter !== "prol"),
  );
  const [headerQuery, setHeaderQuery] = useState("");
  const [askQuery, setAskQuery] = useState("");
  const [, navigate] = useLocation();
  const { data: stats } = useGetCorpusStats();
  useResetOnSamePageNav(() => {
    setOpenNav(null);
    setHeaderQuery("");
    setAskQuery("");
  });

  const submitHeaderSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = headerQuery.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  const submitAsk = (e: React.FormEvent) => {
    e.preventDefault();
    const q = askQuery.trim();
    navigate(q ? `/ask?q=${encodeURIComponent(q)}` : "/ask");
  };

  return (
    <div
      className="laertius-root min-h-screen"
      style={{ background: "var(--home-bg)", color: "var(--home-text)", fontFamily: "var(--app-font-serif)" }}
    >

      {/* Skip link: first focusable element, visible only while focused. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-background focus:text-primary focus:border focus:border-primary focus:px-4 focus:py-2 focus:rounded-sm font-mono text-[12px] uppercase tracking-wider"
      >
        Skip to main content
      </a>

      {/* Thin crimson top rule */}
      <div style={{ background: CRIMSON, height: "4px" }} />

      {/* Header / nav */}
      <header style={{ borderBottom: "1px solid var(--home-border)", background: "var(--home-bg)" }}>
        <div className="max-w-[1180px] mx-auto px-4 md:px-8 py-4 flex flex-wrap items-center justify-between gap-x-8 gap-y-2">

          {/* Logo */}
          <div className="flex-shrink-0 flex flex-col">
            <img
              src={`${import.meta.env.BASE_URL}laertius-marquetry.png`}
              alt="Laertius"
              className="h-[52px] w-auto object-contain object-left"
            />
            <span className="mt-1 text-[8px] uppercase tracking-[0.32em] whitespace-nowrap" style={{ fontFamily: "var(--app-font-mono)", color: "var(--home-muted)" }}>
              Digital Scholarly Edition
            </span>
          </div>

          {/* Navigation */}
          <nav ref={navRef} className="flex flex-wrap items-center gap-0.5">
            {NAV_ITEMS.map((item) => (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => item.sub.length > 0 && canHover() && setOpenNav(item.label)}
                onMouseLeave={() => { if (canHover()) setOpenNav(null); }}
              >
                {item.href ? (
                  <Link
                    href={item.href}
                    className="inline-block px-3 py-2 text-[13.5px] tracking-[0.06em] transition-colors rounded-sm"
                    style={{
                      color: "var(--home-text)",
                      fontFamily: "var(--app-font-sans)",
                      fontWeight: 500,
                      outline: "none",
                    }}
                    onMouseOver={e => ((e.currentTarget as HTMLElement).style.color = CRIMSON)}
                    onMouseOut={e => ((e.currentTarget as HTMLElement).style.color = "var(--home-text)")}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <button
                    className="px-3 py-2 text-[13.5px] tracking-[0.06em] transition-colors rounded-sm"
                    style={{
                      color: openNav === item.label ? CRIMSON : "var(--home-text)",
                      fontFamily: "var(--app-font-sans)",
                      fontWeight: 500,
                      outline: "none",
                    }}
                    aria-haspopup="true"
                    aria-expanded={openNav === item.label}
                    // On hover-capable devices the menu is already open from
                    // mouseenter, so a click must keep it open (a toggle would
                    // close it, making every item unreachable by mouse). On
                    // touch devices there is no hover, so the click toggles.
                    onClick={() =>
                      canHover()
                        ? setOpenNav(item.label)
                        : setOpenNav(openNav === item.label ? null : item.label)
                    }
                    onMouseOver={e => (e.currentTarget.style.color = CRIMSON)}
                    onMouseOut={e => { if (openNav !== item.label) e.currentTarget.style.color = "var(--home-text)"; }}
                    onFocus={e => { if (canHover()) setOpenNav(item.label); e.currentTarget.style.boxShadow = `0 0 0 2px ${CRIMSON}`; }}
                    onBlur={e => (e.currentTarget.style.boxShadow = "")}
                  >
                    {item.label}
                  </button>
                )}
                {item.sub.length > 0 && openNav === item.label && (
                  <div
                    className="absolute top-full left-0 z-50 bg-[var(--home-bg)] border border-[var(--home-border)] shadow-lg py-1 min-w-[180px]"
                    style={{ border: "1px solid var(--home-border)", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
                  >
                    {item.sub.map((s) => (
                      <Link
                        key={s.label}
                        href={s.href}
                        className="block px-4 py-2 text-[13px] transition-colors"
                        style={{ color: "var(--home-text)", fontFamily: "var(--app-font-sans)" }}
                        onMouseOver={e => { (e.currentTarget as HTMLElement).style.color = CRIMSON; (e.currentTarget as HTMLElement).style.background = CRIMSON_LIGHT; }}
                        onMouseOut={e => { (e.currentTarget as HTMLElement).style.color = "var(--home-text)"; (e.currentTarget as HTMLElement).style.background = ""; }}
                        onFocus={e => { (e.currentTarget as HTMLElement).style.color = CRIMSON; (e.currentTarget as HTMLElement).style.background = CRIMSON_LIGHT; }}
                        onBlur={e => { (e.currentTarget as HTMLElement).style.color = "var(--home-text)"; (e.currentTarget as HTMLElement).style.background = ""; }}
                      >
                        {s.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Search */}
          <form className="relative flex-shrink-0" onSubmit={submitHeaderSearch}>
            <input
              type="text"
              value={headerQuery}
              onChange={e => setHeaderQuery(e.target.value)}
              placeholder="Search the Lives…"
              aria-label="Search the edition"
              className="pl-3 pr-8 py-1.5 text-[12.5px] w-48 focus:outline-none"
              style={{
                background: "var(--home-card)",
                border: "1px solid var(--home-border)",
                borderRadius: "2px",
                fontFamily: "var(--app-font-sans)",
                color: "var(--home-text)",
              }}
            />
          </form>
        </div>
      </header>

      {/* Page content landmark: skip-link target for keyboard users. */}
      <main id="main-content" tabIndex={-1}>

      {/* Cover: typographic incipit before the pictorial hero */}
      <section
        data-testid="home-cover"
        style={{ background: "var(--home-bg)", borderBottom: "1px solid var(--home-border)", position: "relative" }}
      >
        <div className="max-w-[1180px] mx-auto px-8 pt-20 pb-10 lg:pt-28 lg:pb-14">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-12">
          <div className="min-w-0">
          <h1
            lang="grc"
            style={{
              fontFamily: "var(--app-font-display)",
              fontWeight: 600,
              fontSize: "clamp(40px, 7vw, 84px)",
              lineHeight: 1.14,
              color: "var(--home-heading)",
              letterSpacing: "-0.01em",
              maxWidth: "900px",
              overflowWrap: "anywhere",
            }}
          >
            Βίοι καὶ γνῶμαι τῶν ἐν φιλοσοφίᾳ{" "}
            <span style={{ color: CRIMSON, fontStyle: "italic", whiteSpace: "nowrap", overflowWrap: "normal" }}>εὐδοκιμησάντων.</span>
          </h1>
          <p
            className="mt-8 text-[17px] lg:text-[20px]"
            style={{ color: "var(--home-muted)", lineHeight: 1.7, maxWidth: "620px", fontWeight: 300 }}
          >
            The Lives and Opinions of Eminent Philosophers. A digital scholarly
            edition of Diogenes Laertius: read the{" "}
            <Link href="/browse" style={{ color: "var(--home-text)", textDecoration: "underline", textDecorationColor: "color-mix(in srgb, var(--home-crimson) 35%, transparent)", textDecorationThickness: "1px", textUnderlineOffset: "4px" }}>Lives</Link> in Greek and
            English, search{" "}
            <Link href="/sayings" style={{ color: "var(--home-text)", textDecoration: "underline", textDecorationColor: "color-mix(in srgb, var(--home-crimson) 35%, transparent)", textDecorationThickness: "1px", textUnderlineOffset: "4px" }}>sayings</Link> and{" "}
            <Link href="/doxography" style={{ color: "var(--home-text)", textDecoration: "underline", textDecorationColor: "color-mix(in srgb, var(--home-crimson) 35%, transparent)", textDecorationThickness: "1px", textUnderlineOffset: "4px" }}>doctrines</Link>{" "}
            semantically, and explore a structured{" "}
            <Link href="/graph" style={{ color: "var(--home-text)", textDecoration: "underline", textDecorationColor: "color-mix(in srgb, var(--home-crimson) 35%, transparent)", textDecorationThickness: "1px", textUnderlineOffset: "4px" }}>knowledge graph</Link>. Results
            are cited by book and section.
          </p>
          <p
            className="mt-8"
            style={{ fontFamily: "var(--app-font-sans)", fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--home-faint)" }}
          >
            Diogenes Laertius <span style={{ opacity: 0.5, margin: "0 6px" }}>·</span> trans. R.D. Hicks (1925)
          </p>
          </div>

          <div className="shrink-0 lg:self-end lg:pb-1" data-testid="lives-dot-grid-panel">
            <div data-testid="lives-dot-grid" ref={dotGridRef}>
              <div className="flex items-end gap-3 mb-4">
                {LIVES_DOTS.map((b, bi) => (
                  <div key={b.num} className="flex flex-col items-center gap-3">
                    <div className="flex flex-col-reverse">
                      {Array.from({ length: b.count }).map((_, j) => {
                        const life = livesByBook[bi]?.[j];
                        const dot = (
                          <span
                            className="block w-[11px] h-[11px] rounded-full transition-transform group-hover:scale-[1.45] group-focus-visible:scale-[1.45]"
                            style={{ background: b.highlight.includes(j) ? CRIMSON : "var(--home-border)" }}
                          />
                        );
                        if (!life) {
                          return <span key={j} className="block py-[6.5px]">{dot}</span>;
                        }
                        const dotKey = `${bi + 1}-${life.chapter}`;
                        const isTapOpen = activeDot === dotKey;
                        return (
                          <Link
                            key={j}
                            href={`/section/${life.firstId}`}
                            aria-label={`${life.name}, Book ${b.num}, chapter ${life.chapter}`}
                            aria-describedby={`lives-tip-${bi + 1}-${life.chapter}`}
                            data-testid={`lives-dot-${bi + 1}-${life.chapter}`}
                            // px/py sized so the tap target is >= 24x24px
                            // (11px dot + 6.5px padding each side), per the
                            // WCAG 2.2 target-size rule in the a11y audit.
                            className="group relative block px-[6.5px] py-[6.5px] -mx-[5.5px] rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                            style={{ textDecoration: "none", ["--tw-ring-color" as string]: CRIMSON }}
                            // Touch devices have no hover, so tapping would
                            // navigate before the tooltip is ever seen. There,
                            // the first tap only reveals the tooltip; a second
                            // tap on the same dot follows the link.
                            onClick={(e) => {
                              if (canHover()) return;
                              if (!isTapOpen) {
                                e.preventDefault();
                                setActiveDot(dotKey);
                              }
                            }}
                          >
                            {dot}
                            <span
                              id={`lives-tip-${bi + 1}-${life.chapter}`}
                              role="tooltip"
                              className={`pointer-events-none absolute left-1/2 bottom-full z-20 mb-2 -translate-x-1/2 whitespace-nowrap px-3 py-2 text-left group-hover:block group-focus-visible:block ${isTapOpen ? "block" : "hidden"}`}
                              style={{
                                background: "var(--home-card)",
                                border: "1px solid var(--home-border)",
                                borderRadius: "2px",
                                boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
                                fontFamily: "var(--app-font-sans)",
                              }}
                            >
                              <span className="block text-[12.5px]" style={{ color: b.highlight.includes(j) ? CRIMSON : "var(--home-text)", fontWeight: 600 }}>
                                {life.name}
                              </span>
                              <span className="block text-[11px] mt-0.5" style={{ color: "var(--home-muted)" }}>
                                Book {b.num} · Chapter {life.chapter}
                              </span>
                              <span className="block text-[11px]" style={{ color: "var(--home-muted)" }}>
                                {life.school}
                              </span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                    <Link
                      href="/browse"
                      title={`Book ${b.num}`}
                      className="text-[11px] tracking-widest"
                      style={{ color: "var(--home-muted)", fontFamily: "var(--app-font-sans)", textDecoration: "none" }}
                    >
                      {b.num}
                    </Link>
                  </div>
                ))}
              </div>
              <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--home-muted)", fontFamily: "var(--app-font-sans)" }}>
                82 Lives
              </p>
            </div>
          </div>
          </div>
          <div className="flex justify-center mt-12">
            <Link
              href="/browse"
              data-testid="cover-scroll-cue"
              aria-label="Enter the edition"
              className="flex flex-col items-center gap-1 transition-colors"
              style={{ color: CRIMSON, fontFamily: "var(--app-font-sans)", fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase" }}
            >
              Enter the edition
              <span aria-hidden="true" style={{ fontSize: "14px", lineHeight: 1 }}>⌄</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Hero */}

      <section
        id="edition-hero"
        style={{
          position: "relative",
          backgroundColor: "#0a0503",
          backgroundImage: `url('${schoolOfAthens}')`,
          backgroundSize: "cover",
          backgroundPosition: "center 30%",
          borderBottom: `3px solid ${CRIMSON}`,
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(10,5,3,0.38) 0%, rgba(10,5,3,0.50) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 65% 80% at 50% 50%, rgba(10,5,3,0.30) 0%, rgba(10,5,3,0) 100%)" }} />

        <div className="relative max-w-[1180px] mx-auto px-8 text-center" style={{ paddingTop: "72px", paddingBottom: "72px" }}>

          <div
            className="text-[10.5px] tracking-[0.22em] uppercase mb-5"
            style={{ color: "rgba(255,255,255,0.85)", fontFamily: "var(--app-font-sans)", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
          >
            <a href="https://humanisticadigitalia.eu" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.4)" }}><em>Humanistica Digitalia</em></a> · TALOS LAB AI4SSH · Philographia
          </div>

          <h2
            className="text-[46px] leading-[1.2] font-semibold mb-4"
            style={{ fontFamily: "var(--app-font-display)", color: "#FFFFFF", textShadow: "0 2px 10px rgba(0,0,0,0.75)" }}
          >
            Lives and Opinions of Eminent Philosophers
          </h2>

          <div lang="grc" className="italic text-[20px] mb-5" style={{ fontFamily: "var(--app-font-serif)", color: "var(--home-crimson-border)", textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}>
            Βίοι καὶ γνῶμαι τῶν ἐν φιλοσοφίᾳ εὐδοκιμησάντων
          </div>

          <div className="flex justify-center mb-6">
            <div style={{ width: "60px", height: "2px", background: CRIMSON }} />
          </div>

          <div className="flex items-center justify-center gap-4">
            <Link
              href="/browse"
              className="px-7 py-2.5 text-[12.5px] tracking-[0.1em] uppercase text-white transition-colors"
              style={{ background: "var(--home-crimson-solid)", borderRadius: "2px", fontFamily: "var(--app-font-sans)", fontWeight: 600 }}
              onMouseOver={e => ((e.currentTarget as HTMLElement).style.background = "var(--home-crimson-dark)")}
              onMouseOut={e => ((e.currentTarget as HTMLElement).style.background = "var(--home-crimson-solid)")}
            >
              Read the Text
            </Link>
            <Link
              href="/about"
              className="px-7 py-2.5 text-[12.5px] tracking-[0.1em] uppercase transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.6)", color: "#FFFFFF", borderRadius: "2px", fontFamily: "var(--app-font-sans)" }}
              onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.12)"; }}
              onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = ""; }}
            >
              About this Edition
            </Link>
          </div>

          <div style={{ position: "absolute", bottom: "10px", right: "12px", fontSize: "9px", color: "rgba(255,255,255,0.35)", fontFamily: "var(--app-font-sans)", letterSpacing: "0.04em" }}>
            Raffaello Sanzio, <em>The School of Athens</em>, 1509–11 · Apostolic Palace, Vatican City
          </div>
        </div>
      </section>

      {/* Main content */}
      <div className="max-w-[1180px] mx-auto px-8 py-10 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-10">

        {/* Sidebar */}
        <aside className="space-y-8">

          <div>
            <h2 className="text-[11px] tracking-[0.16em] uppercase font-semibold mb-3 pb-2" style={{ color: "var(--home-muted)", borderBottom: "1px solid var(--home-border)", fontFamily: "var(--app-font-sans)" }}>
              Quick Access
            </h2>
            <nav className="space-y-0.5">
              <Link href="/browse" className="block py-1.5 text-[13.5px] transition-colors" style={{ color: "var(--home-text)" }}
                onMouseOver={e => ((e.currentTarget as HTMLElement).style.color = CRIMSON)}
                onMouseOut={e => ((e.currentTarget as HTMLElement).style.color = "var(--home-text)")}
              >
                Greek Text (Hicks, 1925)
              </Link>
            </nav>
          </div>

          <div style={{ background: "var(--home-card)", border: "1px solid var(--home-border)", padding: "18px" }}>
            <h2 className="font-semibold text-[15px] mb-1" style={{ fontFamily: "var(--app-font-display)", color: "var(--home-heading)" }}>
              Ask Laertius
            </h2>
            <p className="text-[12.5px] leading-snug mb-3" style={{ color: "var(--home-muted)" }}>
              Query the text in natural language. Ask about philosophers, doctrines, or textual features.
              An AI-assisted retrieval system: results are drawn from quotations and curated records, with citations. It does not generate scholarly prose.
            </p>
            <form onSubmit={submitAsk}>
              <input
                type="text"
                value={askQuery}
                onChange={e => setAskQuery(e.target.value)}
                placeholder="e.g. What did Diogenes say about…"
                aria-label="Ask Laertius a question"
                className="w-full px-3 py-2 text-[12px] mb-2 focus:outline-none"
                style={{ background: "var(--home-bg)", border: "1px solid var(--home-border)", fontFamily: "var(--app-font-sans)" }}
              />
              <button
                type="submit"
                className="w-full py-2 text-[11.5px] tracking-[0.08em] uppercase text-white transition-colors"
                style={{ background: "var(--home-crimson-solid)", fontFamily: "var(--app-font-sans)", fontWeight: 600, borderRadius: "2px" }}
                onMouseOver={e => ((e.currentTarget as HTMLElement).style.background = "var(--home-crimson-dark)")}
                onMouseOut={e => ((e.currentTarget as HTMLElement).style.background = "var(--home-crimson-solid)")}
              >
                Ask
              </button>
            </form>
          </div>

          <div style={{ background: "var(--home-card)", border: "1px solid var(--home-border)", padding: "16px" }}>
            <h2 className="text-[10.5px] tracking-[0.15em] uppercase mb-2" style={{ color: "var(--home-muted)", fontFamily: "var(--app-font-sans)" }}>
              Cite this edition
            </h2>
            <p className="text-[11.5px] leading-relaxed italic" style={{ color: "var(--home-body)" }}>
              Papadopoulou, Maria, ed. <em>Laertius: A Digital Scholarly Edition of the Lives and Opinions of Eminent Philosophers.</em> Humanistica Digitalia, 2026. CC BY-NC-SA 4.0.
            </p>
          </div>

        </aside>

        {/* Main column (the page-level <main> landmark lives in the shared layout) */}
        <div>

          <section className="mb-10">
            <h2 className="font-bold text-[22px] mb-1 pb-2" style={{ fontFamily: "var(--app-font-display)", color: "var(--home-heading)", borderBottom: `2px solid ${CRIMSON}`, display: "inline-block" }}>
              About the Edition
            </h2>
            <div className="mt-4 text-[14.5px] leading-[1.85]" style={{ color: "var(--home-text)" }}>
              <p>
                This digital scholarly edition brings together the Greek text of Diogenes Laertius, an English
                translation, structured annotations, and tools for scholarly exploration.
              </p>
            </div>
          </section>

          <section className="mb-10">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-bold text-[22px]" style={{ fontFamily: "var(--app-font-display)", color: "var(--home-heading)" }}>
                The Text
              </h2>
              <Link href="/browse" className="text-[12px] tracking-wide uppercase transition-colors" style={{ color: CRIMSON, fontFamily: "var(--app-font-sans)" }}
                onMouseOver={e => ((e.currentTarget as HTMLElement).style.textDecoration = "underline")}
                onMouseOut={e => ((e.currentTarget as HTMLElement).style.textDecoration = "none")}
              >
                Browse all
              </Link>
            </div>
            <div style={{ borderTop: "1px solid var(--home-border)" }}>
              {BOOKS.map((b, i) => (
                <Link
                  key={b.num}
                  href={`/browse?book=${i + 1}`}
                  className="flex items-start gap-4 py-3 transition-colors"
                  style={{ borderBottom: "1px solid var(--home-border)", background: "transparent", display: "flex", textDecoration: "none" }}
                  onMouseOver={e => ((e.currentTarget as HTMLElement).style.background = CRIMSON_LIGHT)}
                  onMouseOut={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                >
                  <span className="flex-shrink-0 w-7 text-center font-semibold text-[13px] mt-0.5" style={{ color: CRIMSON, fontFamily: "var(--app-font-display)" }}>
                    {b.num}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-[14px] leading-snug mb-0.5" style={{ fontFamily: "var(--app-font-serif)", color: "var(--home-heading)" }}>
                      {b.title}
                    </div>
                    <div className="text-[12px]" style={{ color: "var(--home-muted)" }}>
                      {b.names}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

          </section>

        </div>
      </div>

      </main>

      <SiteFooter />
    </div>
  );
}
