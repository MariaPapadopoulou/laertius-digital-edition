import { useEffect, useRef, useCallback, useState } from "react";
import { EditorView, keymap, lineNumbers, drawSelection, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { StreamLanguage, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { autocompletion, completionKeymap, type CompletionContext, type CompletionResult, type Completion } from "@codemirror/autocomplete";
import { sparql } from "@codemirror/legacy-modes/mode/sparql";
import { SPARQL_PREFIXES } from "../lib/sparql-prefixes";
import { isGraphQuery } from "../lib/sparql-query-form";
import { friendlyErrorMessage } from "../lib/sparql-error-message";

type SparqlBinding = Record<string, { type: string; value: string; "xml:lang"?: string }>;

type SparqlResult =
  | { kind: "select"; vars: string[]; rows: SparqlBinding[] }
  | { kind: "ask"; value: boolean }
  | { kind: "turtle"; text: string };

const SPARQL_KEYWORDS = [
  "SELECT", "DISTINCT", "REDUCED", "WHERE", "FILTER", "OPTIONAL", "UNION",
  "GRAPH", "MINUS", "EXISTS", "NOT", "ASK", "CONSTRUCT", "DESCRIBE",
  "PREFIX", "BASE", "LIMIT", "OFFSET", "ORDER", "BY", "GROUP", "HAVING",
  "BIND", "VALUES", "SERVICE", "FROM", "NAMED", "AS", "IN",
  "REGEX", "STR", "LANG", "DATATYPE", "BOUND", "SAMETERM", "ISIRI",
  "ISURI", "ISBLANK", "ISLITERAL", "ISNUMERIC", "COALESCE", "IF", "NOW",
  "YEAR", "MONTH", "DAY", "HOURS", "MINUTES", "SECONDS", "TIMEZONE", "TZ",
  "RAND", "ABS", "CEIL", "FLOOR", "ROUND", "STRLEN", "SUBSTRING", "UCASE",
  "LCASE", "ENCODE_FOR_URI", "CONTAINS", "STRSTARTS", "STRENDS", "STRBEFORE",
  "STRAFTER", "CONCAT", "LANGMATCHES", "MD5", "SHA1", "SHA256", "SHA384",
  "SHA512", "IRI", "URI", "BNODE", "STRDT", "STRLANG",
  "COUNT", "SUM", "MIN", "MAX", "AVG", "SAMPLE", "GROUP_CONCAT", "SEPARATOR",
  "true", "false", "a",
];

function sparqlCompletion(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/[\w]+/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  const typed = word.text.toLowerCase();
  const docText = context.state.doc.toString();
  const options: Completion[] = [];

  for (const [prefix, uri] of Object.entries(SPARQL_PREFIXES)) {
    if (prefix.toLowerCase().startsWith(typed)) {
      const alreadyDeclared = new RegExp(`PREFIX\\s+${prefix}:`, "i").test(docText);
      options.push({
        label: prefix,
        detail: `PREFIX ${prefix}: <${uri}>`,
        apply(view: EditorView, _completion: Completion, from: number, to: number) {
          if (alreadyDeclared) {
            view.dispatch({ changes: { from, to, insert: prefix + ":" } });
          } else {
            view.dispatch({ changes: { from, to, insert: `PREFIX ${prefix}: <${uri}>` } });
          }
        },
        type: "namespace",
        boost: 10,
      });
    }
  }

  for (const kw of SPARQL_KEYWORDS) {
    if (kw.toLowerCase().startsWith(typed) && kw.toLowerCase() !== typed) {
      options.push({ label: kw, type: "keyword" });
    }
  }

  if (options.length === 0) return null;
  return { from: word.from, options };
}

const appTheme = EditorView.theme({
  "&": {
    fontSize: "12px",
    lineHeight: "1.625",
    fontFamily: "var(--app-font-mono)",
    backgroundColor: "hsl(var(--background))",
    color: "hsl(var(--foreground))",
    borderRadius: "6px",
  },
  ".cm-scroller": {
    overflow: "auto",
    maxHeight: "320px",
  },
  ".cm-content": {
    padding: "8px 12px",
    caretColor: "hsl(var(--foreground))",
  },
  ".cm-gutters": {
    backgroundColor: "hsl(var(--muted) / 0.5)",
    color: "hsl(var(--muted-foreground))",
    border: "none",
    borderRight: "1px solid hsl(var(--border))",
    borderRadius: "6px 0 0 6px",
    minWidth: "36px",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 8px 0 4px",
    fontSize: "11px",
  },
  ".cm-activeLine": { backgroundColor: "hsl(var(--muted) / 0.25)" },
  ".cm-activeLineGutter": { backgroundColor: "hsl(var(--muted) / 0.4)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "hsl(var(--muted)) !important",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-tooltip": {
    backgroundColor: "hsl(var(--background))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "6px",
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
  },
  ".cm-tooltip-autocomplete ul": {
    fontFamily: "var(--app-font-mono)",
    fontSize: "12px",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "hsl(var(--muted))",
    color: "hsl(var(--foreground))",
  },
  ".cm-completionLabel": { color: "hsl(var(--foreground))" },
  ".cm-completionDetail": {
    color: "hsl(var(--muted-foreground))",
    fontSize: "11px",
    marginLeft: "8px",
  },
  ".cm-cursor": { borderLeftColor: "hsl(var(--foreground))" },
});

interface SparqlEditorProps {
  initialQuery: string;
  doc?: { text: string };
  onChange: (query: string) => void;
  onRun: () => void;
}

function SparqlEditor({ initialQuery, doc, onChange, onRun }: SparqlEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onRunRef = useRef(onRun);
  const onChangeRef = useRef(onChange);
  onRunRef.current = onRun;
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: initialQuery,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        drawSelection(),
        syntaxHighlighting(defaultHighlightStyle),
        StreamLanguage.define(sparql),
        autocompletion({ override: [sparqlCompletion] }),
        EditorView.contentAttributes.of({
          "aria-label": "SPARQL query editor",
          "aria-multiline": "true",
        }),
        keymap.of([
          // The run binding MUST precede defaultKeymap: defaultKeymap binds
          // Mod-Enter to insertBlankLine, which would swallow the chord and
          // insert a newline instead of running the query.
          {
            key: "Mod-Enter",
            run() {
              onRunRef.current();
              return true;
            },
          },
          ...completionKeymap,
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        appTheme,
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    const el = containerRef.current as HTMLDivElement & { __cmView?: EditorView };
    el.__cmView = view;

    return () => {
      view.destroy();
      viewRef.current = null;
      const c = containerRef.current as (HTMLDivElement & { __cmView?: EditorView }) | null;
      if (c) delete c.__cmView;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const target = doc ? doc.text : initialQuery;
    const current = view.state.doc.toString();
    if (current !== target) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: target },
      });
    }
  }, [initialQuery, doc]);

  return (
    <div
      ref={containerRef}
      data-testid="sparql-query-editor"
      aria-label="SPARQL query"
      className="border border-border rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-ring"
    />
  );
}

function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform ?? nav.platform ?? "";
  return /mac/i.test(platform);
}

function shortenIri(iri: string): string {
  const hash = iri.lastIndexOf("#");
  const slash = iri.lastIndexOf("/");
  const cut = Math.max(hash, slash);
  return cut >= 0 && cut < iri.length - 1 ? iri.slice(cut + 1) : iri;
}

function CellValue({ b }: { b: SparqlBinding[string] | undefined }) {
  if (!b) return <span className="text-muted-foreground">-</span>;
  if (b.type === "uri") {
    return (
      <span title={b.value} className="font-mono text-[11px]">
        {shortenIri(b.value)}
      </span>
    );
  }
  return (
    <span>
      {b.value}
      {b["xml:lang"] ? (
        <span className="text-muted-foreground text-[10px] ml-1">@{b["xml:lang"]}</span>
      ) : null}
    </span>
  );
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadCsv(vars: string[], rows: SparqlBinding[]) {
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const header = vars.join(",");
  const csvRows = rows.map((row) =>
    vars
      .map((v) => {
        const b = row[v];
        if (!b) return "";
        return escape(b.value);
      })
      .join(","),
  );
  // Prefix a UTF-8 BOM so Excel decodes Greek text correctly: without it,
  // Excel assumes the local ANSI codepage and Greek columns render as
  // mojibake even though the file itself is valid UTF-8.
  downloadFile("\uFEFF" + [header, ...csvRows].join("\r\n"), "sparql-results.csv", "text/csv;charset=utf-8");
}

function downloadTurtle(text: string) {
  downloadFile(text, "sparql-construct.ttl", "text/turtle;charset=utf-8");
}

// isGraphQuery lives in ../lib/sparql-query-form.ts (a plain .ts module) so
// the validate-sparql-form-drift validator can import it alongside the
// server's queryForm; re-exported here for existing consumers.
export { isGraphQuery };

// friendlyErrorMessage lives in ../lib/sparql-error-message.ts (a plain .ts
// module) so the validate-sparql-413-message validator can import it without
// React/CodeMirror; re-exported here for consumers.
export { friendlyErrorMessage };

async function fetchTurtle(query: string): Promise<string> {
  const res = await fetch(`${import.meta.env.BASE_URL}api/lod/sparql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/sparql-query",
      Accept: "text/turtle",
    },
    body: query,
  });
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    throw new Error(await friendlyErrorMessage(res));
  }
  if (!contentType.includes("turtle")) {
    throw new Error(
      "The query did not return Turtle - only CONSTRUCT/DESCRIBE queries can be downloaded as .ttl",
    );
  }
  return await res.text();
}

function downloadSparqlJson(vars: string[], rows: SparqlBinding[]) {
  const body = JSON.stringify({ head: { vars }, results: { bindings: rows } }, null, 2);
  downloadFile(body, "sparql-results.json", "application/sparql-results+json");
}

interface SparqlPlaygroundProps {
  initialQuery: string;
}

export function SparqlPlayground({ initialQuery }: SparqlPlaygroundProps) {
  const [query, setQuery] = useState(initialQuery);
  const [editorDoc, setEditorDoc] = useState({ text: initialQuery });
  const [running, setRunning] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SparqlResult | null>(null);

  const queryRef = useRef(query);
  queryRef.current = query;

  const handleChange = useCallback((q: string) => {
    setQuery(q);
  }, []);

  const example = initialQuery;

  const resetToExample = useCallback(() => {
    setQuery(example);
    setEditorDoc({ text: example });
    setResult(null);
    setError(null);
  }, [example]);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/lod/sparql`, {
        method: "POST",
        headers: { "Content-Type": "application/sparql-query" },
        body: queryRef.current,
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok) {
        setError(await friendlyErrorMessage(res));
        return;
      }
      if (contentType.includes("turtle")) {
        setResult({ kind: "turtle", text: await res.text() });
        return;
      }
      const data = (await res.json()) as {
        head?: { vars?: string[] };
        results?: { bindings?: SparqlBinding[] };
        boolean?: boolean;
      };
      if (typeof data.boolean === "boolean") {
        setResult({ kind: "ask", value: data.boolean });
        return;
      }
      setResult({
        kind: "select",
        vars: data.head?.vars ?? [],
        rows: data.results?.bindings ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, []);

  // One-click "Run & download .ttl" for graph (CONSTRUCT/DESCRIBE) queries:
  // runs the current query with Accept: text/turtle and saves the result
  // straight to a .ttl file, without rendering it first.
  const runAndDownload = useCallback(async () => {
    setDownloading(true);
    setError(null);
    try {
      downloadTurtle(await fetchTurtle(queryRef.current));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(false);
    }
  }, []);

  useEffect(() => {
    setQuery(initialQuery);
    setEditorDoc({ text: initialQuery });
    setResult(null);
    setError(null);
  }, [initialQuery]);

  return (
    <div className="mt-2 space-y-2" data-testid="sparql-playground">
      <SparqlEditor
        initialQuery={editorDoc.text}
        doc={editorDoc}
        onChange={handleChange}
        onRun={run}
      />
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => void run()}
          disabled={running || !query.trim()}
          className="text-xs font-medium px-3 py-1.5 rounded-md border border-border bg-muted/50 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? "Running..." : "Run query"}
        </button>
        <span className="text-xs text-muted-foreground">
          {isMacPlatform() ? "\u2318+Enter to run" : "Ctrl+Enter to run"}
        </span>
        {isGraphQuery(query) ? (
          <button
            type="button"
            onClick={() => void runAndDownload()}
            disabled={downloading || !query.trim()}
            className="text-xs font-medium px-3 py-1.5 rounded-md border border-border bg-muted/50 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            title="Run the query against the SPARQL endpoint and save the result as a Turtle (.ttl) file"
            data-testid="sparql-run-download-ttl"
          >
            {downloading ? "Running..." : "Run & download .ttl"}
          </button>
        ) : null}
        {query !== example ? (
          <button
            type="button"
            onClick={resetToExample}
            className="text-xs font-medium px-2.5 py-1 rounded-md border border-border bg-muted/50 hover:bg-muted"
            title="Discard edits and restore the example query"
            data-testid="sparql-reset-to-example"
          >
            Reset to example
          </button>
        ) : null}
        {result?.kind === "select" ? (
          <>
            <span className="text-xs text-muted-foreground">
              {result.rows.length.toLocaleString("en-US")}{" "}
              {result.rows.length === 1 ? "row" : "rows"}
            </span>
            {result.rows.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => downloadCsv(result.vars, result.rows)}
                  className="text-xs font-medium px-2.5 py-1 rounded-md border border-border bg-muted/50 hover:bg-muted"
                  title="Download results as CSV"
                >
                  Download CSV
                </button>
                <button
                  type="button"
                  onClick={() => downloadSparqlJson(result.vars, result.rows)}
                  className="text-xs font-medium px-2.5 py-1 rounded-md border border-border bg-muted/50 hover:bg-muted"
                  title="Download results as SPARQL JSON"
                >
                  Download JSON
                </button>
              </>
            ) : null}
          </>
        ) : null}
      </div>
      {error ? (
        <p className="text-xs text-red-700 dark:text-red-400 border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/30 rounded-md p-2 whitespace-pre-wrap">
          {error}
        </p>
      ) : null}
      {result?.kind === "ask" ? (
        <p className="text-xs text-foreground border border-border rounded-md p-2">
          Result: <span className="font-mono">{String(result.value)}</span>
        </p>
      ) : null}
      {result?.kind === "turtle" ? (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => downloadTurtle(result.text)}
            className="text-xs font-medium px-2.5 py-1 rounded-md border border-border bg-muted/50 hover:bg-muted"
            title="Save the returned triples as a Turtle (.ttl) file"
            data-testid="sparql-download-ttl"
          >
            Download .ttl
          </button>
        </div>
      ) : null}
      {result?.kind === "turtle" ? (
        <pre className="text-xs leading-relaxed bg-muted/50 border border-border rounded-md p-3 overflow-x-auto max-h-96 overflow-y-auto">
          <code>{result.text}</code>
        </pre>
      ) : null}
      {result?.kind === "select" ? (
        result.rows.length === 0 ? (
          <p className="text-xs text-muted-foreground border border-border rounded-md p-2">
            The query ran but returned no rows.
          </p>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  {result.vars.map((v) => (
                    <th
                      key={v}
                      className="text-left font-medium px-2 py-1.5 border-b border-border font-mono"
                    >
                      ?{v}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i} className="odd:bg-background even:bg-muted/20 align-top">
                    {result.vars.map((v) => (
                      <td key={v} className="px-2 py-1.5 border-b border-border/50">
                        <CellValue b={row[v]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </div>
  );
}
