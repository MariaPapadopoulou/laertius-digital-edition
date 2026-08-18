import { Link } from "wouter";

interface ExternalLinksRowProps {
  links?: { qid?: string; enwiki?: string } | null;
  philosopher?: string;
  className?: string;
}

export function ExternalLinksRow({ links, philosopher, className = "" }: ExternalLinksRowProps) {
  const hasExternal = !!links && (!!links.qid || !!links.enwiki);
  if (!hasExternal && !philosopher) return null;

  return (
    <div className={`flex flex-wrap items-center gap-3 text-sm ${className}`}>
      {philosopher && (
        <Link
          href={`/graph?p=${encodeURIComponent(philosopher)}`}
          className="text-primary hover:underline"
        >
          Knowledge graph
        </Link>
      )}
      {philosopher && (
        <Link
          href={`/map?p=${encodeURIComponent(philosopher)}`}
          className="text-primary hover:underline"
        >
          Map
        </Link>
      )}
      {links?.qid && (
        <a
          href={`https://www.wikidata.org/wiki/${links.qid}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Wikidata ↗
        </a>
      )}
      {links?.enwiki && (
        <a
          href={`https://en.wikipedia.org/wiki/${links.enwiki.replace(/ /g, "_")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Wikipedia ↗
        </a>
      )}
    </div>
  );
}
