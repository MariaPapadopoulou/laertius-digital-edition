import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { getHealthCheckQueryKey, useHealthCheck } from "@workspace/api-client-react/legomena";
import { SiteFooter, NAV_GROUPS, ASK_GROUP, ABOUT_GROUP } from "@/components/site-footer";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex items-center justify-center w-8 h-8 text-muted-foreground hover:text-primary transition-colors"
      data-testid="theme-toggle"
    >
      {dark ? (
        <Sun className="w-4 h-4" aria-hidden="true" />
      ) : (
        <Moon className="w-4 h-4" aria-hidden="true" />
      )}
    </button>
  );
}

function LegomenaStoreStatus({ compact = false }: { compact?: boolean }) {
  const { data: health, isError } = useHealthCheck({
    query: {
      queryKey: getHealthCheckQueryKey(),
      // Poll fast while the store is unreachable or not yet ready, so the pill
      // recovers on its own once the Legomena API comes back. Once ready, keep
      // a slow background poll so an outage that starts AFTER "Ready" is still
      // noticed within about a minute instead of never.
      refetchInterval: (query) =>
        query.state.status === "error" || !query.state.data?.storeReady ? 20_000 : 60_000,
      refetchIntervalInBackground: false,
    },
  });
  // Check isError first: react-query keeps the last successful data around
  // after a refetch fails, so a stale `storeReady: true` must not mask an
  // outage that begins after the pill has already shown Ready.
  const state: "ready" | "unreachable" | "loading" = isError
    ? "unreachable"
    : health?.storeReady
      ? "ready"
      : "loading";
  const label = state === "ready" ? "Ready" : state === "unreachable" ? "Unavailable" : "Loading";
  // The pill is only shown while something is wrong or still starting up;
  // a healthy store needs no badge.
  if (state === "ready") return null;
  return (
    <span
      className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap"
      data-testid={compact ? "legomena-store-status-compact" : "legomena-store-status"}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${
          state === "unreachable" ? "bg-destructive" : "bg-amber-500 animate-pulse"
        }`}
        aria-hidden="true"
      />
      {compact ? (
        <span className={state === "unreachable" ? "text-destructive" : undefined}>{label}</span>
      ) : (
        <span className={state === "unreachable" ? "text-destructive" : undefined}>
          Assertion store: {label}
          {state !== "unreachable" && health?.tripleCount
            ? ` · ${health.tripleCount.toLocaleString()} triples`
            : ""}
        </span>
      )}
    </span>
  );
}

// hint: Logic changed on both sides. Requires understanding intent of each change.
export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Tracks which desktop dropdown group is visually open (hover/focus) so
  // its trigger can expose aria-expanded; visibility itself stays CSS-driven.
  const [openDesktopGroup, setOpenDesktopGroup] = useState<string | null>(null);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  const navGroups = NAV_GROUPS;
  const askGroup = ASK_GROUP;
  const aboutGroup = ABOUT_GROUP;

  const renderDesktopGroup = (group: typeof aboutGroup) => {
    const active = group.items.some(
      (item) => location === item.href || location.startsWith(item.href + "/")
    );
    const open = openDesktopGroup === group.label;
    return (
      <div
        key={group.label}
        className="relative group"
        onMouseEnter={() => setOpenDesktopGroup(group.label)}
        onMouseLeave={() =>
          setOpenDesktopGroup((cur) => (cur === group.label ? null : cur))
        }
        onFocus={() => setOpenDesktopGroup(group.label)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setOpenDesktopGroup((cur) => (cur === group.label ? null : cur));
          }
        }}
      >
        <button
          type="button"
          className={`font-sans font-medium text-[13.5px] tracking-[0.06em] whitespace-nowrap transition-colors border-b py-1 flex items-center gap-1.5 ${
            active
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-primary group-focus-within:text-primary"
          }`}
          aria-haspopup="true"
          aria-expanded={open}
        >
          {group.label}
        </button>
        <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 hidden group-hover:block group-focus-within:block z-50">
          <div className="bg-background border border-border shadow-lg rounded-sm min-w-[16rem] py-2">
            {group.items.map((item) => {
              const itemActive =
                location === item.href || location.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-5 py-2.5 hover:bg-card transition-colors ${
                    itemActive ? "bg-card" : ""
                  }`}
                >
                  <span
                    className={`block font-sans text-[13px] ${
                      itemActive ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderMobileGroup = (group: typeof aboutGroup) => (
    <div key={group.label} className="border-t border-border pt-2 mt-1">
      <span className="block py-1 font-sans font-medium text-[13.5px] tracking-[0.06em] text-muted-foreground">
        {group.label}
      </span>
      {group.items.map((item) => {
        const itemActive =
          location === item.href || location.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`block py-2 pl-3 ${itemActive ? "bg-card" : ""}`}
          >
            <span
              className={`block font-sans text-[13px] ${
                itemActive ? "text-primary" : "text-foreground"
              }`}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );

  const inLegomena = location === "/legomena" || location.startsWith("/legomena/");

  return (
    <div className="min-h-[100dvh] flex flex-col font-sans">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-background focus:text-primary focus:border focus:border-primary focus:px-4 focus:py-2 focus:rounded-sm font-mono text-[12px] uppercase tracking-wider"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8 min-w-0">
            <Link href="/" className="flex flex-col shrink-0 transition-opacity hover:opacity-80">
              <img
                src={`${import.meta.env.BASE_URL}laertius-marquetry.png`}
                alt="Laertius"
                className="h-14 w-auto max-w-[48vw] object-contain object-left"
              />
              <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.32em] text-foreground/80 whitespace-nowrap">
                Digital Scholarly Edition
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-7">
              {navGroups.map(renderDesktopGroup)}
              {renderDesktopGroup(askGroup)}
              {renderDesktopGroup(aboutGroup)}
            </nav>
          </div>
          <div className="flex items-center gap-3 shrink-0 pl-4">
            {inLegomena && (
              <div className="hidden lg:block" data-testid="legomena-store-status">
                <LegomenaStoreStatus compact />
              </div>
            )}
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>
      
      {/* Mobile nav */}
      <div className="md:hidden border-b border-border bg-background">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-menu"
            className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-foreground"
            data-testid="mobile-menu-toggle"
          >
            <span className="flex flex-col gap-[3px]" aria-hidden="true">
              <span className="block w-4 h-px bg-current"></span>
              <span className="block w-4 h-px bg-current"></span>
              <span className="block w-4 h-px bg-current"></span>
            </span>
            Menu
            <span className="text-[8px] opacity-60" aria-hidden="true">
              {mobileMenuOpen ? "▴" : "▾"}
            </span>
          </button>
          <div className="flex items-center gap-3">
            {inLegomena && <LegomenaStoreStatus compact />}
            <ThemeToggle />
          </div>
        </div>
        {mobileMenuOpen && (
          <nav id="mobile-nav-menu" className="border-t border-border px-4 pb-4" data-testid="mobile-nav-menu">
            {navGroups.map(renderMobileGroup)}
            {renderMobileGroup(askGroup)}
            {renderMobileGroup(aboutGroup)}
          </nav>
        )}
      </div>

      <main
        id="main-content"
        tabIndex={-1}
        className={
          location === "/"
            ? "flex-1"
            : "flex-1 container mx-auto px-4 md:px-8 py-8 md:py-12"
        }
      >
        {children}
      </main>
      
      <SiteFooter />
    </div>
  );
}
