import { useState, useEffect } from "react";
import { useRunSparql, useListSparqlExamples } from "@workspace/api-client-react/legomena";
import { sparqlExamples as lodExamples } from "@/pages/sparql-examples";
import { isGraphQuery } from "@/lib/sparql-query-form";
import { friendlyApiErrorMessage, friendlyErrorMessage } from "@/lib/sparql-error-message";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

type Store = "assertions" | "lod";

interface ResultCell {
  bound: boolean;
  termType?: string;
  value?: string;
  lang?: string;
  datatype?: string;
}

interface ResultData {
  form: "select" | "ask" | "construct" | "describe";
  columns?: string[];
  rows?: { cells: ResultCell[] }[];
  boolean?: boolean;
  turtle?: string;
  elapsedMs: number;
  rowCount: number;
}

interface SparqlJsonBinding {
  [variable: string]:
    | { type: string; value: string; "xml:lang"?: string; datatype?: string }
    | undefined;
}

async function runLodQuery(query: string): Promise<ResultData> {
  const started = performance.now();
  if (isGraphQuery(query)) {
    const res = await fetch(`${import.meta.env.BASE_URL}api/lod/sparql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/sparql-query",
        Accept: "text/turtle",
      },
      body: query,
    });
    if (!res.ok) throw new Error(await friendlyErrorMessage(res));
    const turtle = await res.text();
    const tripleLines = turtle
      .split("\n")
      .filter((l) => l.trim() && !l.trimStart().startsWith("@prefix")).length;
    return {
      form: "construct",
      turtle,
      elapsedMs: Math.round(performance.now() - started),
      rowCount: tripleLines,
    };
  }
  const res = await fetch(`${import.meta.env.BASE_URL}api/lod/sparql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/sparql-query",
      Accept: "application/sparql-results+json",
    },
    body: query,
  });
  if (!res.ok) throw new Error(await friendlyErrorMessage(res));
  const json = (await res.json()) as {
    boolean?: boolean;
    head?: { vars?: string[] };
    results?: { bindings?: SparqlJsonBinding[] };
  };
  const elapsedMs = Math.round(performance.now() - started);
  if (typeof json.boolean === "boolean") {
    return { form: "ask", boolean: json.boolean, elapsedMs, rowCount: 1 };
  }
  const columns = json.head?.vars ?? [];
  const bindings = json.results?.bindings ?? [];
  const rows = bindings.map((b) => ({
    cells: columns.map((v): ResultCell => {
      const cell = b[v];
      if (!cell) return { bound: false };
      return {
        bound: true,
        termType: cell.type === "typed-literal" ? "literal" : cell.type,
        value: cell.value,
        lang: cell["xml:lang"],
        datatype: cell.datatype,
      };
    }),
  }));
  return { form: "select", columns, rows, elapsedMs, rowCount: rows.length };
}

export default function SparqlConsole() {
  const [query, setQuery] = useState("SELECT * WHERE {\n  ?s ?p ?o .\n}\nLIMIT 10");
  const [store, setStore] = useState<Store>("assertions");
  // Where the results panel renders: under the editor for free-form runs, or
  // under the example card that was clicked (About-page style).
  const [activeExample, setActiveExample] = useState<string | null>(null);
  const { data: examplesData, isLoading: examplesLoading } = useListSparqlExamples();
  const runMutation = useRunSparql();

  const [lodStatus, setLodStatus] = useState<"idle" | "pending" | "error" | "success">("idle");
  const [lodData, setLodData] = useState<ResultData | null>(null);
  const [lodError, setLodError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // The Legomena API caps POST bodies at 1 MB (express.json); an oversized
  // paste is refused upstream with a 413 whose body is Express's HTML error
  // page. Convert that (and any other non-JSON error body) into a readable
  // message instead of dumping the raw ApiError text.
  useEffect(() => {
    if (!runMutation.isError) {
      setErrorMessage(null);
      return;
    }
    let cancelled = false;
    void friendlyApiErrorMessage(runMutation.error, {
      limitNote: "the endpoint accepts queries up to 1 MB",
    }).then((msg) => {
      if (!cancelled) setErrorMessage(msg);
    });
    return () => {
      cancelled = true;
    };
  }, [runMutation.isError, runMutation.error]);

  const runQuery = (q: string, target: Store) => {
    if (!q.trim()) return;
    if (target === "lod") {
      setLodStatus("pending");
      setLodError(null);
      runLodQuery(q)
        .then((data) => {
          setLodData(data);
          setLodStatus("success");
        })
        .catch((err: unknown) => {
          setLodError(err instanceof Error ? err.message : String(err));
          setLodStatus("error");
        });
    } else {
      runMutation.mutate({ data: { query: q } });
    }
  };

  const handleRun = () => {
    setActiveExample(null);
    runQuery(query, store);
  };

  const loadExample = (key: string, q: string, target: Store) => {
    setQuery(q);
    setStore(target);
    setActiveExample(key);
    runQuery(q, target);
  };

  const isPending = store === "lod" ? lodStatus === "pending" : runMutation.isPending;
  const isError = store === "lod" ? lodStatus === "error" : runMutation.isError;
  const isSuccess = store === "lod" ? lodStatus === "success" : runMutation.isSuccess;
  const isIdle = store === "lod" ? lodStatus === "idle" : runMutation.isIdle;
  const data: ResultData | null | undefined = store === "lod" ? lodData : runMutation.data;
  const displayError = store === "lod" ? lodError : errorMessage;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resultsPanel = (
    <div className="border border-border/60 rounded-[2px] bg-card">
      <div className="p-3 border-b border-border/60 flex items-center justify-between bg-muted/10">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Results</h2>
        {isSuccess && data && (
          <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <span>{data.elapsedMs}ms</span>
            <span>{data.rowCount} rows</span>
          </div>
        )}
      </div>

      <div className="p-3">
        {isIdle && (
          <div className="py-6 text-center text-muted-foreground font-mono text-sm">
            Enter a query and run to see results
          </div>
        )}

        {isPending && (
          <div className="py-6 text-center font-mono text-sm text-muted-foreground">
            Running query…
          </div>
        )}

        {isError && (
          <div className="border border-destructive/30 bg-destructive/5 text-destructive font-mono text-sm p-4 rounded-[2px] animate-in fade-in">
            <div className="font-bold mb-2">Query Error</div>
            <div className="whitespace-pre-wrap">{displayError || "Failed to execute query."}</div>
          </div>
        )}

        {isSuccess && data && (
          <div className="animate-in fade-in duration-300">
            {data.form === 'select' && data.columns && data.rows && (
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto rounded-[2px] border border-border/40">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border/40 font-mono text-xs text-muted-foreground">
                      <th className="py-2 px-3 font-normal">#</th>
                      {data.columns.map(col => (
                        <th key={col} className="py-2 px-3 font-normal">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20 font-mono text-xs">
                    {data.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-muted/20">
                        <td className="py-2 px-3 text-muted-foreground/50">{rIdx + 1}</td>
                        {row.cells.map((cell, cIdx) => (
                          <td key={cIdx} className="py-2 px-3 max-w-[300px] truncate" title={cell.value}>
                            {!cell.bound ? (
                              <span className="text-muted-foreground/50 italic">unbound</span>
                            ) : cell.termType === 'uri' ? (
                              <a href={cell.value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline decoration-primary/30">
                                &lt;{cell.value?.replace('http://legomena.org/', 'lo:')}&gt;
                              </a>
                            ) : cell.termType === 'literal' ? (
                              <span className="text-foreground">
                                "{cell.value}"
                                {cell.lang && <span className="text-muted-foreground ml-1">@{cell.lang}</span>}
                                {cell.datatype && <span className="text-muted-foreground ml-1">^^{cell.datatype.split('#').pop()}</span>}
                              </span>
                            ) : (
                              <span>_:{cell.value}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data.form === 'ask' && (
              <div className="flex items-center justify-center py-10">
                <div className={cn(
                  "text-5xl font-mono uppercase tracking-widest",
                  data.boolean ? "text-green-600" : "text-destructive"
                )}>
                  {data.boolean ? "True" : "False"}
                </div>
              </div>
            )}

            {(data.form === 'construct' || data.form === 'describe') && data.turtle && (
              <div className="relative group">
                <button
                  onClick={() => copyToClipboard(data.turtle!)}
                  className="absolute top-2 right-2 px-2 py-1 bg-card border border-border/40 rounded-[2px] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted font-mono text-xs"
                >
                  {copied ? <span className="text-green-600">Copied</span> : <span className="text-muted-foreground">Copy</span>}
                </button>
                <pre className="bg-muted/10 border border-border/40 p-4 rounded-[2px] overflow-x-auto max-h-[420px] overflow-y-auto text-xs font-mono leading-relaxed text-foreground/80">
                  {data.turtle}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const exampleCard = (
    key: string,
    title: string,
    description: string,
    exQuery: string,
    target: Store,
  ) => (
    <li key={key} className="border border-border/60 rounded-[2px] bg-background">
      <button
        onClick={() => loadExample(key, exQuery, target)}
        className="w-full text-left p-4 hover:bg-muted/40 transition-colors group"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="font-medium text-sm group-hover:text-primary transition-colors">{title}</div>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground border border-border/60 rounded-[2px] px-2 py-0.5">
            {activeExample === key && isPending ? "Running…" : "Run"}
          </span>
        </div>
        <div className="text-xs text-muted-foreground leading-relaxed mt-1">{description}</div>
      </button>
      {activeExample === key && (
        <div className="p-3 pt-0 space-y-3">
          <pre className="bg-muted/10 border border-border/40 p-3 rounded-[2px] overflow-x-auto text-xs font-mono leading-relaxed text-foreground/80">
            {exQuery}
          </pre>
          {resultsPanel}
        </div>
      )}
    </li>
  );

  return (
    <div className="w-full">
      <h1 className="font-serif text-2xl text-foreground mb-4">SPARQL Console</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        This console queries two different RDF datasets: the edition's
        assertion store (who asserts what, in which passage, with what
        confidence) and the curated LOD dataset described on the{" "}
        <Link
          href="/about#linked-open-data"
          className="underline hover:text-foreground"
        >
          About this edition page
        </Link>
        . Pick the store next to the Run button; clicking an example runs it
        against the store it is written for and shows the answer right below
        it, since the two datasets use different vocabularies.
      </p>

      {/* Editor */}
      <div className="border border-border/60 rounded-[2px] bg-background">
        <header className="p-4 border-b border-border/60 flex flex-wrap items-center justify-between gap-3 bg-card">
          <h2 className="text-lg font-medium">
            SPARQL
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="flex rounded-[2px] border border-border/60 overflow-hidden"
              role="group"
              aria-label="Query target store"
              data-testid="sparql-store-toggle"
            >
              <button
                onClick={() => setStore("assertions")}
                aria-pressed={store === "assertions"}
                className={cn(
                  "px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors",
                  store === "assertions"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                Assertion store
              </button>
              <button
                onClick={() => setStore("lod")}
                aria-pressed={store === "lod"}
                className={cn(
                  "px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors border-l border-border/60",
                  store === "lod"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                LOD graph
              </button>
            </div>
            <button
              onClick={handleRun}
              disabled={isPending || !query.trim()}
              className="px-4 py-1.5 bg-primary text-primary-foreground font-mono text-sm uppercase tracking-wider rounded-[2px] hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isPending ? "Running…" : "Run Query"}
            </button>
          </div>
        </header>
        <textarea aria-label="SPARQL query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={8}
          className="block w-full p-4 bg-transparent font-mono text-sm leading-relaxed resize-y focus:outline-none focus:ring-inset focus:ring-1 focus:ring-primary/20"
          spellCheck={false}
        />
      </div>

      {/* Results for free-form runs (example results render under their card) */}
      {activeExample === null && <div className="mt-4">{resultsPanel}</div>}

      {/* Examples */}
      <div className="mt-10">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
          Examples · Assertion store
        </h2>
        {examplesLoading ? (
          <div className="p-4 text-center font-mono text-xs text-muted-foreground">Loading…</div>
        ) : (
          <ul className="space-y-3">
            {examplesData?.examples.map(ex =>
              exampleCard(`assertions:${ex.id}`, ex.title, ex.description, ex.query, "assertions"),
            )}
          </ul>
        )}

        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3 mt-10">
          Examples · LOD graph
        </h2>
        <ul className="space-y-3">
          {lodExamples.map(ex =>
            exampleCard(`lod:${ex.title}`, ex.title, ex.body, ex.query, "lod"),
          )}
        </ul>
      </div>
    </div>
  );
}
