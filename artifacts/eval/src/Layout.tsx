import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const nav = [
    { href: "/", label: "Overview" },
    { href: "/snapshots", label: "Snapshots" },
    { href: "/topics", label: "Topics Sets" },
    { href: "/runs", label: "Runs" },
    { href: "/pools", label: "Pools" },
    { href: "/judge", label: "Judge", target: "_blank" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex-none border-b bg-paper px-6 py-4 flex items-center justify-between">
        <div className="flex items-baseline gap-4">
          <Link href="/" className="font-grc text-xl tracking-widest uppercase text-primary font-semibold flex flex-col">
            Laertius
            <span className="font-sans text-[10px] tracking-[0.18em] text-muted-foreground mt-0.5 font-medium">Evaluation</span>
          </Link>
        </div>
        <nav className="flex items-center gap-6">
          {nav.map((item) => (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
                location === item.href || (item.href !== "/" && location.startsWith(item.href))
                  ? "text-primary border-b-2 border-primary -mb-[17px] pb-[15px]" 
                  : "text-muted-foreground"
              )}
              {...(item.target ? { target: item.target } : {})}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
