import { Router, text, type IRouter } from "express";
import { Store } from "oxigraph";
import { graphAsTurtle, ontologyAsTurtle } from "../lib/lod";
import { compactTurtle } from "../lib/turtle-compact";

export const MAX_QUERY_LENGTH = 20_000;

let store: Store | null = null;

// Built once per process today. If a rebuild/hot-reload path is ever
// added, it must either assign a NEW Store instance here (the competency
// row-count cache is keyed to the instance and will recompute) or, if it
// mutates this instance in place, also call resetRowCountCache() in
// routes/competency.ts, otherwise the sidebar badges go stale.
export function getStore(): Store {
  if (store) return store;
  const s = new Store();
  s.load(graphAsTurtle(), { format: "text/turtle" });
  s.load(ontologyAsTurtle(), { format: "text/turtle" });
  store = s;
  return s;
}

// Test-only hook: swaps the module's store for the given instance so the
// competency cache-invalidation validator can simulate a graph rebuild
// (getStore() returning a NEW Store). Never call from route code — the
// real rebuild path, if one is added, should assign a new Store itself.
export function __setStoreForTests(next: Store | null): void {
  store = next;
}

type QueryForm = "select" | "ask" | "construct" | "describe" | "update" | "unknown";

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
  // Tokenize in a single pass so a '#' inside an IRI (<…/ontology#>) or a
  // string literal is never mistaken for a comment start. Comment tokens
  // are dropped after matching.
  const tokens = (
    query.match(
      /<[^>]*>|#[^\n\r]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[A-Za-z]+|\S/g,
    ) ?? ([] as string[]) // typed fallback: the scripts tsc program otherwise infers never[] here
  ).filter((t) => !t.startsWith("#"));
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i].toLowerCase();
    if (t === "prefix" || t === "base") {
      // Skip the prologue declaration: PREFIX name: <iri> / BASE <iri>
      i += 1;
      while (i < tokens.length && !tokens[i].startsWith("<")) i += 1;
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

function extractQuery(req: {
  method: string;
  query: Record<string, unknown>;
  body: unknown;
  headers: Record<string, unknown>;
}): { query?: string; error?: string } {
  const contentType = String(req.headers["content-type"] ?? "");
  if (contentType.includes("application/sparql-update")) {
    return { error: "This endpoint is read-only: SPARQL updates are not accepted" };
  }
  if (req.method === "GET") {
    const q = req.query.query;
    if (typeof q === "string" && q.trim()) return { query: q };
    return {};
  }
  // POST
  if (typeof req.body === "string" && req.body.trim()) {
    return { query: req.body };
  }
  if (req.body && typeof req.body === "object") {
    const bodyRecord = req.body as Record<string, unknown>;
    if (typeof bodyRecord.update === "string") {
      return { error: "This endpoint is read-only: SPARQL updates are not accepted" };
    }
    const q = bodyRecord.query;
    if (typeof q === "string" && q.trim()) return { query: q };
  }
  const q = req.query.query;
  if (typeof q === "string" && q.trim()) return { query: q };
  return {};
}

const USAGE = {
  endpoint: "/api/lod/sparql",
  description:
    "Read-only SPARQL 1.1 query endpoint over the Laertius knowledge graph (data + ontology).",
  methods: {
    GET: "?query=<urlencoded SPARQL query>",
    POST: "body as application/sparql-query, or application/x-www-form-urlencoded with a 'query' field",
  },
  results: {
    "SELECT / ASK": "application/sparql-results+json",
    "CONSTRUCT / DESCRIBE": "text/turtle",
  },
  example:
    "SELECT ?s WHERE { ?s a <https://humanisticadigitalia.eu/Laertius/ontology#Philosopher> } LIMIT 5",
};

const router: IRouter = Router();

const sparqlTextParser = text({
  type: ["application/sparql-query", "text/plain"],
  limit: "64kb",
});

router.all("/lod/sparql", sparqlTextParser, (req, res) => {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Only GET and POST are supported" });
    return;
  }

  const { query, error } = extractQuery(req);
  if (error) {
    res.status(400).json({ error });
    return;
  }
  if (!query) {
    if (req.method === "GET") {
      res.json(USAGE);
      return;
    }
    res.status(400).json({ error: "Missing SPARQL query", usage: USAGE });
    return;
  }
  if (query.length > MAX_QUERY_LENGTH) {
    res.status(400).json({ error: `Query too long (max ${MAX_QUERY_LENGTH} characters)` });
    return;
  }

  const form = queryForm(query);
  if (form === "update") {
    res.status(400).json({ error: "This endpoint is read-only: SPARQL updates are not accepted" });
    return;
  }

  try {
    const s = getStore();
    if (form === "construct" || form === "describe") {
      const turtle = s.query(query, { results_format: "text/turtle" });
      res.type("text/turtle").send(compactTurtle(String(turtle)));
      return;
    }
    const json = s.query(query, { results_format: "json" });
    res.type("application/sparql-results+json").send(String(json));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: `SPARQL query failed: ${message}` });
  }
});

export default router;
