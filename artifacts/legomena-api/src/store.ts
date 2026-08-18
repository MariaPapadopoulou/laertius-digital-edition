/**
 * The single source of truth of the Legomena service: an in-memory oxigraph
 * store loaded once at startup from the committed Turtle dataset
 * (base graph, ontology TBox, passage + annotation layer). Every endpoint
 * of this service is answered from queries against this store - there is
 * no other data path.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Store } from "oxigraph";
import { logger } from "./logger";

export const dataDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
);

export interface DatasetFileEntry {
  name: string;
  sha256: string;
  bytes: number;
  quads: number;
}

export interface DatasetManifest {
  generatedAt: string;
  files: DatasetFileEntry[];
  counts: Record<string, number>;
}

export const DATASET_FILES = ["base.ttl", "tbox.ttl", "passages.ttl"] as const;

let store: Store | null = null;
let manifest: DatasetManifest | null = null;
let prefixes: Record<string, string> = {};
let tripleCountCache = 0;

function parsePrefixes(ttl: string, into: Record<string, string>): void {
  // Only the prefix header is scanned; a Turtle document's own @prefix
  // block is the authoritative namespace table of the dataset, so the
  // service never hardcodes the LOD base URI.
  for (const m of ttl.matchAll(/^@prefix\s+([\w-]*):\s*<([^>]+)>\s*\.\s*$/gm)) {
    into[m[1] as string] = m[2] as string;
  }
}

export function initStore(): { tripleCount: number; loadMs: number } {
  const t0 = performance.now();
  const s = new Store();
  const px: Record<string, string> = {};
  for (const name of DATASET_FILES) {
    const ttl = readFileSync(path.resolve(dataDir, name), "utf-8");
    parsePrefixes(ttl, px);
    s.load(ttl, { format: "text/turtle" });
  }
  manifest = JSON.parse(
    readFileSync(path.resolve(dataDir, "manifest.json"), "utf-8"),
  ) as DatasetManifest;
  prefixes = px;
  store = s;
  const res = s.query("SELECT (COUNT(*) AS ?n) WHERE { ?s ?p ?o }") as Map<
    string,
    { value: string }
  >[];
  tripleCountCache = Number(res[0]?.get("n")?.value ?? 0);
  const loadMs = Math.round(performance.now() - t0);
  logger.info(
    { tripleCount: tripleCountCache, loadMs, files: DATASET_FILES },
    "Dataset loaded into in-memory store",
  );
  return { tripleCount: tripleCountCache, loadMs };
}

export function getStore(): Store {
  if (!store) throw new Error("Triple store not initialised");
  return store;
}

export function storeReady(): boolean {
  return store !== null;
}

export function getManifest(): DatasetManifest {
  if (!manifest) throw new Error("Dataset manifest not loaded");
  return manifest;
}

export function getPrefixes(): Record<string, string> {
  return prefixes;
}

export function tripleCount(): number {
  return tripleCountCache;
}

/** Namespace URI for a prefix declared by the dataset itself. */
export function ns(prefix: string): string {
  const uri = prefixes[prefix];
  if (!uri) throw new Error(`Unknown prefix in dataset: ${prefix}`);
  return uri;
}

/** PREFIX prologue (from the dataset's own @prefix block) for service queries. */
export function prologue(): string {
  return Object.entries(prefixes)
    .map(([p, u]) => `PREFIX ${p}: <${u}>`)
    .join("\n");
}
