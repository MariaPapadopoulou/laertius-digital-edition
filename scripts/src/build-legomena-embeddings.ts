/**
 * Build the dense retrieval index for Legomena FROM THE DATASET ITSELF:
 * passages.ttl is parsed and each passage's label + Greek + English text
 * literals are embedded with the same local model the service uses for
 * queries. Output: artifacts/legomena-api/data/embedding-index.json.
 *
 * Chunk-resumable: progress is appended to a JSONL file in /tmp so an
 * interrupted run continues where it stopped instead of starting over.
 *
 * Run: pnpm --filter @workspace/scripts run build-legomena-embeddings
 */
import {
  appendFileSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Parser as N3Parser } from "n3";
import { pipeline, env } from "@huggingface/transformers";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, "../../artifacts/legomena-api/data");
const outPath = path.join(dataDir, "embedding-index.json");
const progressPath = "/tmp/legomena-embeddings-progress.jsonl";

// Same constant the service uses for query embedding; drift here would
// silently degrade retrieval, so it is imported rather than duplicated.
import { EMBEDDING_MODEL as MODEL } from "../../artifacts/legomena-api/src/embedding-config";

const RDFS = "http://www.w3.org/2000/01/rdf-schema#";

function sectionKey(id: string): [number, number, number, string] {
  const parts = id.split(".");
  const book = Number(parts[0] ?? 0) || 0;
  const chapterRaw = parts[1] ?? "";
  const chapter = /^\d+$/.test(chapterRaw) ? Number(chapterRaw) : -1;
  const m = (parts.slice(2).join(".") ?? "").match(/^(\d+)([a-z]*)$/i);
  return [book, chapter, m ? Number(m[1]) : 0, m ? (m[2] ?? "") : ""];
}

async function main(): Promise<void> {
  const ttl = readFileSync(path.join(dataDir, "passages.ttl"), "utf-8");
  const quads = new N3Parser().parse(ttl);
  const prefixes = Object.fromEntries(
    [...ttl.matchAll(/^@prefix\s+([\w-]*):\s*<([^>]+)>\s*\.\s*$/gm)].map(
      (m) => [m[1] as string, m[2] as string],
    ),
  );
  const LO = prefixes["lo"];
  if (!LO) throw new Error("passages.ttl declares no lo: prefix");

  interface Doc {
    id: string;
    label: string;
    grc: string;
    en?: string;
  }
  const byUri = new Map<string, Doc>();
  const docOf = (uri: string): Doc => {
    let d = byUri.get(uri);
    if (!d) {
      const marker = "/passage/";
      d = {
        id: uri.slice(uri.lastIndexOf(marker) + marker.length),
        label: "",
        grc: "",
      };
      byUri.set(uri, d);
    }
    return d;
  };
  for (const q of quads) {
    if (q.subject.termType !== "NamedNode") continue;
    if (q.predicate.value === `${LO}greekText`)
      docOf(q.subject.value).grc = q.object.value;
    else if (q.predicate.value === `${LO}englishText`)
      docOf(q.subject.value).en = q.object.value;
    else if (
      q.predicate.value === `${RDFS}label` &&
      q.subject.value.includes("/passage/")
    )
      docOf(q.subject.value).label = q.object.value;
  }
  const docs = [...byUri.values()]
    .filter((d) => d.grc.length > 0)
    .sort((a, b) => {
      const ka = sectionKey(a.id);
      const kb = sectionKey(b.id);
      for (let i = 0; i < 3; i++) {
        if ((ka[i] as number) !== (kb[i] as number))
          return (ka[i] as number) - (kb[i] as number);
      }
      return ka[3].localeCompare(kb[3]);
    });
  if (docs.length === 0) throw new Error("No passages found in passages.ttl");
  console.log(`Embedding ${docs.length} passages from passages.ttl…`);

  // Resume support with provenance: cached vectors are only valid for the
  // exact passages.ttl content + model they were computed from. The first
  // line of the progress file is a fingerprint header; any mismatch (or a
  // legacy header-less file) discards the cache so stale text can never be
  // silently baked into the index.
  const fingerprint = {
    fingerprint: true,
    passagesSha256: createHash("sha256").update(ttl).digest("hex"),
    model: MODEL,
  };
  const done = new Map<string, string>();
  if (existsSync(progressPath)) {
    const lines = readFileSync(progressPath, "utf-8").split("\n");
    let header: { fingerprint?: boolean; passagesSha256?: string; model?: string } | null =
      null;
    try {
      header = lines[0]?.trim() ? JSON.parse(lines[0]) : null;
    } catch {
      header = null;
    }
    if (
      header?.fingerprint === true &&
      header.passagesSha256 === fingerprint.passagesSha256 &&
      header.model === fingerprint.model
    ) {
      for (const line of lines.slice(1)) {
        if (!line.trim()) continue;
        const rec = JSON.parse(line) as { id: string; vec: string };
        done.set(rec.id, rec.vec);
      }
      console.log(`Resuming: ${done.size} passages already embedded.`);
    } else {
      rmSync(progressPath);
      console.log(
        "Discarding stale embedding progress cache (dataset/model fingerprint mismatch).",
      );
    }
  }
  if (!existsSync(progressPath)) {
    writeFileSync(progressPath, `${JSON.stringify(fingerprint)}\n`);
  }

  const sharedCache = path.resolve(
    here,
    "../../artifacts/api-server/data/models",
  );
  if (existsSync(sharedCache)) env.cacheDir = sharedCache;
  const extractor = await pipeline("feature-extraction", MODEL, {
    dtype: "q8",
  });

  let dim = 0;
  let embedded = 0;
  const t0 = Date.now();
  for (const d of docs) {
    if (done.has(d.id)) continue;
    const text = `passage: ${d.label}\n${d.grc}${d.en ? `\n${d.en}` : ""}`.slice(
      0,
      4000,
    );
    const output = await extractor(text, { pooling: "mean", normalize: true });
    const vec = new Float32Array(output.data as Float32Array);
    dim = vec.length;
    appendFileSync(
      progressPath,
      `${JSON.stringify({ id: d.id, vec: Buffer.from(vec.buffer).toString("base64") })}\n`,
    );
    done.set(d.id, Buffer.from(vec.buffer).toString("base64"));
    embedded += 1;
    if (embedded % 200 === 0) {
      console.log(
        `  ${embedded} embedded (${((Date.now() - t0) / 1000).toFixed(0)}s)…`,
      );
    }
  }

  const ids = docs.map((d) => d.id);
  const first = done.get(ids[0] as string);
  if (!first) throw new Error("No vectors produced");
  if (dim === 0) dim = Buffer.from(first, "base64").length / 4;
  const all = Buffer.concat(
    ids.map((id) => {
      const b64 = done.get(id);
      if (!b64) throw new Error(`Missing vector for ${id}`);
      return Buffer.from(b64, "base64");
    }),
  );
  writeFileSync(
    outPath,
    JSON.stringify({
      model: MODEL,
      passagesSha256: fingerprint.passagesSha256,
      dim,
      ids,
      vectorsBase64: all.toString("base64"),
    }),
  );
  console.log(
    `✓ Wrote ${ids.length} vectors (dim ${dim}, ${(all.length / 1024 / 1024).toFixed(1)} MiB raw) to ${outPath}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
