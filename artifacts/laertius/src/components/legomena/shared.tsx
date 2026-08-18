import { Link } from "wouter";
import { cn } from "@/lib/utils";

export function LoadingScreen({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-muted-foreground animate-in fade-in duration-500">
      <span className="font-mono text-sm">{message}</span>
    </div>
  );
}

export function ErrorScreen({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <div className="font-mono text-sm text-destructive bg-destructive/10 px-3 py-1 rounded">
        Error Encountered
      </div>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {retry && (
        <button
          onClick={retry}
          className="mt-4 border border-border px-4 py-2 font-mono text-sm hover:bg-muted transition-colors"
        >
          RETRY
        </button>
      )}
    </div>
  );
}

export function CertaintyBadge({ certainty }: { certainty: string }) {
  const norm = certainty.toLowerCase();
  
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider border rounded-[2px]",
        norm === "asserted" && "border-certainty-asserted/20 text-certainty-asserted bg-certainty-asserted/5",
        norm === "reported" && "border-certainty-reported/30 text-certainty-reported bg-certainty-reported/5",
        norm === "disputed" && "border-certainty-disputed/30 text-certainty-disputed bg-certainty-disputed/5",
        norm === "conjectured" && "border-certainty-conjectured/30 text-certainty-conjectured bg-certainty-conjectured/5 border-dashed"
      )}
    >
      {norm}
    </span>
  );
}

export function EntityLink({ uri, label, kind }: { uri: string; label?: string; kind?: string }) {
  return (
    <Link 
      href={`/legomena/entity?uri=${encodeURIComponent(uri)}`} 
      className="inline-flex items-baseline gap-1.5 group"
    >
      <span className="font-medium hover:underline underline-offset-4 decoration-primary/30 transition-all">
        {label || uri.split(/[/#]/).pop()}
      </span>
      {kind && (
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest group-hover:text-primary/70">
          {kind}
        </span>
      )}
    </Link>
  );
}

export function GreekText({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("font-serif tracking-wide text-[1.05em]", className)} lang="grc">
      {children}
    </span>
  );
}
