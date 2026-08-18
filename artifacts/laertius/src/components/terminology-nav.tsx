import { Link, useLocation } from "wouter";

const items = [
  { href: "/terminology", label: "Overview" },
  { href: "/terminology/concepts", label: "Concepts" },
  { href: "/terminology/objects", label: "Objects" },
  { href: "/terminology/names", label: "Proper Names" },
];

export function TerminologyNav() {
  const [location] = useLocation();

  return (
    <nav
      aria-label="Ontoterminology sections"
      className="flex items-center gap-4 overflow-x-auto border-b border-border mb-8"
    >
      {items.map((item) => {
        const active =
          item.href === "/terminology"
            ? location === "/terminology"
            : location === item.href || location.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px py-2 ${
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
