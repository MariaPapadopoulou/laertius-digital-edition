/**
 * Read-only SPARQL execution against the service store.
 *
 * queryForm() is copied from the api-server sparql route: it tokenizes in
 * a single pass so a '#' inside an IRI (<...#>) or a string literal is
 * never mistaken for a comment start - stripping comments naively mangles
 * hash-namespace PREFIX IRIs and misroutes the form sniffing.
 */
import { Writer as N3Writer, DataFactory } from "n3";
import type { Store } from "oxigraph";
import { getPrefixes } from "./store";

export const MAX_QUERY_LENGTH = 20_000;

export type QueryForm =
  | "select"
  | "ask"
  | "construct"
  | "describe"
  | "update"
  | "unknown";

const UPDATE_KEYWORDS = new Set([
  "insert",
  "delete",
  "load",
  "clear",
  "create",
  "drop",
  "copy",
  "move",
  "add",
  "with",
]);

export function queryForm(query: string): QueryForm {
  const tokens = (
    query.match(
      /<[^>]*>|#[^\n\r]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[A-Za-z]+|\S/g,
    ) ?? ([] as string[])
  ).filter((t) => !t.startsWith("#"));
  let i = 0;
  while (i < tokens.length) {
    const t = (tokens[i] as string).toLowerCase();
    if (t === "prefix" || t === "base") {
      i += 1;
      while (i < tokens.length && !(tokens[i] as string).startsWith("<"))
        i += 1;
      i += 1;
      continue;
    }
    if (t === "select") return "select";
    if (t === "ask") return "ask";
    if (t === "construct") return "construct";
    if (t === "describe") return "describe";
    if (UPDATE_KEYWORDS.has(t)) return "update";
    return "unknown";
  }
  return "unknown";
}

interface OxTerm {
  termType: string;
  value: string;
  language?: string;
  datatype?: { value: string };
}

export interface SparqlCellOut {
  bound: boolean;
  termType?: "uri" | "literal" | "bnode";
  value?: string;
  lang?: string;
  datatype?: string;
}

export interface SparqlOutcome {
  form: "select" | "ask" | "construct" | "describe";
  columns?: string[];
  rows?: { cells: SparqlCellOut[] }[];
  boolean?: boolean;
  turtle?: string;
  rowCount: number;
  elapsedMs: number;
}

const MAX_ROWS = 1000;

function cellOf(term: OxTerm | undefined): SparqlCellOut {
  if (!term) return { bound: false };
  const termType =
    term.termType === "NamedNode"
      ? "uri"
      : term.termType === "BlankNode"
        ? "bnode"
        : "literal";
  const cell: SparqlCellOut = { bound: true, termType, value: term.value };
  if (termType === "literal") {
    if (term.language) cell.lang = term.language;
    else if (
      term.datatype &&
      term.datatype.value !== "http://www.w3.org/2001/XMLSchema#string"
    ) {
      cell.datatype = term.datatype.value;
    }
  }
  return cell;
}

export function executeSparql(store: Store, query: string): SparqlOutcome {
  const form = queryForm(query);
  if (form === "update") {
    throw new SparqlRejection(
      "This endpoint is read-only: SPARQL updates are not accepted",
    );
  }
  if (form === "unknown") {
    throw new SparqlRejection(
      "Could not recognise the query form (SELECT, ASK, CONSTRUCT or DESCRIBE)",
    );
  }
  const t0 = performance.now();
  let results: unknown;
  try {
    results = store.query(query);
  } catch (err) {
    throw new SparqlRejection(
      err instanceof Error ? err.message : "Query evaluation failed",
    );
  }
  const elapsedMs = Math.round((performance.now() - t0) * 100) / 100;

  if (form === "ask") {
    return { form, boolean: results as boolean, rowCount: 1, elapsedMs };
  }
  if (form === "construct" || form === "describe") {
    const quads = results as Parameters<InstanceType<typeof N3Writer>["addQuad"]>[0][];
    const writer = new N3Writer({ prefixes: getPrefixes() });
    for (const quadish of quads as Iterable<never>) {
      writer.addQuad(quadish);
    }
    let turtle = "";
    writer.end((err, out) => {
      if (err) throw err;
      turtle = out;
    });
    return {
      form,
      turtle,
      rowCount: (quads as unknown[]).length,
      elapsedMs,
    };
  }
  // SELECT
  const bindingRows = results as Map<string, OxTerm>[];
  const columns: string[] = [];
  for (const row of bindingRows) {
    for (const key of row.keys()) {
      if (!columns.includes(key)) columns.push(key);
    }
  }
  const rows = bindingRows.slice(0, MAX_ROWS).map((row) => ({
    cells: columns.map((c) => cellOf(row.get(c))),
  }));
  return {
    form: "select",
    columns,
    rows,
    rowCount: bindingRows.length,
    elapsedMs,
  };
}

export class SparqlRejection extends Error {}
