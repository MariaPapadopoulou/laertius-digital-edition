import { Link } from "wouter";
import hdLogo from "../assets/humanistica-digitalia-logo.png";

/**
 * The single site-wide footer, rendered by the shared Layout AND by the
 * self-contained home page, so every page shows the identical footer.
 * The nav group data lives here (exported) and is imported by Layout for
 * its header menus, keeping header and footer navigation single-sourced.
 */
export const NAV_GROUPS: {
  label: string;
  items: { href: string; label: string }[];
}[] = [
  {
    label: "The Text",
    items: [
      { href: "/browse", label: "Browse" },
      { href: "/search", label: "Search" },
      { href: "/entities", label: "Index" },
    ],
  },
  {
    label: "Textual genres",
    items: [
      { href: "/verses", label: "Verses" },
      { href: "/sayings", label: "Sayings" },
      { href: "/doxography", label: "Doxai" },
      { href: "/anecdotes", label: "Anecdotes" },
      { href: "/letters", label: "Letters" },
      { href: "/testaments", label: "Testaments" },
    ],
  },
  {
    label: "Explorations",
    items: [
      { href: "/graph", label: "Graph" },
      { href: "/timeline", label: "Timeline" },
      { href: "/map", label: "Map" },
    ],
  },
];

export const ASK_GROUP: { label: string; items: { href: string; label: string }[] } = {
  label: "Ask Laertius",
  items: [
    { href: "/ask", label: "Ask Laertius" },
    { href: "/competency", label: "Competency Questions" },
    { href: "/terminology", label: "Ontoterminology" },
    { href: "/legomena", label: "Assertions" },
    { href: "/legomena/sparql", label: "SPARQL console" },
  ],
};

export const ABOUT_GROUP: { label: string; items: { href: string; label: string }[] } = {
  label: "About",
  items: [
    { href: "/about", label: "About this edition" },
    { href: "/approach", label: "Why this approach" },
    { href: "/stats", label: "Statistics & LOD" },
  ],
};

export function SiteFooter() {
  const renderGroup = (group: { label: string; items: { href: string; label: string }[] }, extra?: React.ReactNode) => (
    <div key={group.label}>
      <span className="block font-mono text-[10px] uppercase tracking-widest text-primary border-b border-primary/30 pb-2 mb-3">
        {group.label}
      </span>
      <ul className="space-y-2">
        {group.items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {item.label}
            </Link>
          </li>
        ))}
        {extra}
      </ul>
    </div>
  );

  return (
    <footer className="border-t border-border mt-auto border-b-8 border-b-primary bg-secondary/50">
      <div className="container mx-auto px-4 md:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-3 flex flex-col items-start gap-4">
            <a
              href="https://humanisticadigitalia.eu"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0"
            >
              <img
                src={hdLogo}
                alt="Humanistica Digitalia logo"
                className="w-[130px] h-auto opacity-80 dark:opacity-100 dark:bg-[#f3ecdd] dark:rounded-md dark:px-3 dark:py-2"
                data-testid="hd-logo"
              />
            </a>
            <p className="font-serif text-lg leading-snug text-foreground">
              Lives of Eminent Philosophers
              <span className="block text-sm text-muted-foreground mt-0.5">by Diogenes Laertius</span>
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-nowrap">
              <a href="https://humanisticadigitalia.eu" target="_blank" rel="noopener noreferrer" className="text-foreground font-mono uppercase tracking-widest text-[10px] underline underline-offset-2 hover:text-foreground/80"><em>Humanistica Digitalia</em></a>{" "}
              <span>2026–2030</span>
              <span className="mx-1 opacity-40">·</span>
              <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">Creative Commons BY-NC-SA 4.0</a>
            </p>
          </div>
          <nav
            aria-label="Footer navigation"
            className="lg:col-span-9 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8"
          >
            {NAV_GROUPS.map((group) => renderGroup(group))}
            {renderGroup(ASK_GROUP)}
            {renderGroup(ABOUT_GROUP)}
          </nav>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container mx-auto px-4 md:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <Link href="/" className="hover:text-primary transition-colors">
              Home
            </Link>
            <span className="opacity-40">·</span>
            <Link href="/about" className="hover:text-primary transition-colors">
              About this edition
            </Link>
            <span className="opacity-40">·</span>
            <Link href="/accessibility" className="hover:text-primary transition-colors">
              Accessibility
            </Link>
            <span className="opacity-40">·</span>
            <Link href="/privacy" className="hover:text-primary transition-colors">
              Privacy
            </Link>
          </div>
          <p>
            Contact:{" "}
            <a href="mailto:maria.papadopoulou@uoc.gr" className="underline underline-offset-2 hover:text-foreground">
              maria.papadopoulou@uoc.gr
            </a>
          </p>
        </div>
      </div>
      <div className="border-t border-border bg-muted/40">
        <div className="container mx-auto px-4 md:px-8 py-2 text-center text-xs text-muted-foreground">
          This site logs visitor IP addresses for security and
          access-monitoring purposes.
        </div>
      </div>
    </footer>
  );
}
