/**
 * Build the dense embedding index for the Laertius corpus using a local
 * open-source model (no API key required).
 * Writes artifacts/api-server/data/embedding-index.json.
 * Usage: pnpm --filter @workspace/scripts run build-embeddings
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { pipeline, env } from "@huggingface/transformers";

const workspaceRoot = process.cwd().endsWith("scripts")
  ? path.resolve(process.cwd(), "..")
  : process.cwd();
const dataDir = path.resolve(workspaceRoot, "artifacts/api-server/data");

const MODEL = process.env["EMBEDDING_MODEL"] ?? "Xenova/multilingual-e5-small";
const BATCH_SIZE = 16;
const MAX_CHARS = 4000;

env.cacheDir = path.resolve(dataDir, "models");

interface GreekRecord {
  id: string;
  philosopher: string;
  school: string;
  text: string;
}

interface EnglishRecord {
  id: string;
  textEn: string;
}

function loadJsonl<T>(filePath: string): T[] {
  return readFileSync(filePath, "utf-8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as T);
}

async function main() {
  const greek = loadJsonl<GreekRecord>(
    path.resolve(dataDir, "laertius_sections.jsonl"),
  );
  const english = new Map(
    loadJsonl<EnglishRecord>(
      path.resolve(dataDir, "laertius_sections_en.jsonl"),
    ).map((r) => [r.id, r.textEn]),
  );

  const inputs = greek.map((g) => {
    const en = english.get(g.id);
    const header = `${g.philosopher} (${g.school}) — D.L. ${g.id}`;
    const body = en ? `${g.text}\n${en}` : g.text;
    return `passage: ${header}\n${body}`.slice(0, MAX_CHARS);
  });

  const start = Number(process.env["EMBED_START"] ?? 0);
  const end = Math.min(
    Number(process.env["EMBED_END"] ?? inputs.length),
    inputs.length,
  );

  console.log(`Loading model ${MODEL}...`);
  const extractor = await pipeline("feature-extraction", MODEL, {
    dtype: "q8",
  });

  console.log(`Embedding sections ${start}..${end} of ${inputs.length}...`);
  const started = Date.now();
  const allVectors: Float32Array[] = [];
  for (let i = start; i < end; i += BATCH_SIZE) {
    const batch = inputs.slice(i, Math.min(i + BATCH_SIZE, end));
    const output = await extractor(batch, {
      pooling: "mean",
      normalize: true,
    });
    const data = output.data as Float32Array;
    const dim = output.dims[output.dims.length - 1]!;
    for (let b = 0; b < batch.length; b++) {
      allVectors.push(new Float32Array(data.subarray(b * dim, (b + 1) * dim)));
    }
    const done = Math.min(i + BATCH_SIZE, inputs.length);
    const elapsed = ((Date.now() - started) / 1000).toFixed(0);
    console.log(`  ${done}/${inputs.length} (${elapsed}s)`);
  }

  const dim = allVectors[0]!.length;
  const flat = new Float32Array(allVectors.length * dim);
  allVectors.forEach((vec, d) => flat.set(vec, d * dim));

  const isPartial = start > 0 || end < inputs.length;
  const outPath = isPartial
    ? path.resolve(dataDir, `embedding-part-${start}-${end}.json`)
    : path.resolve(dataDir, "embedding-index.json");
  writeFileSync(
    outPath,
    JSON.stringify({
      model: MODEL,
      dim,
      ids: greek.slice(start, end).map((g) => g.id),
      vectorsBase64: Buffer.from(
        flat.buffer,
        flat.byteOffset,
        flat.byteLength,
      ).toString("base64"),
    }),
  );
  console.log(`Wrote ${allVectors.length}x${dim} vectors to ${outPath}`);
}

function merge() {
  const parts = readdirSync(dataDir)
    .filter((f) => f.startsWith("embedding-part-") && f.endsWith(".json"))
    .map((f) => {
      const m = f.match(/embedding-part-(\d+)-(\d+)\.json/);
      return { file: f, start: Number(m?.[1] ?? 0), end: Number(m?.[2] ?? 0) };
    })
    .sort((a, b) => a.start - b.start);
  if (parts.length === 0) {
    console.error("No part files found to merge");
    process.exit(1);
  }
  let expectedStart = 0;
  for (const p of parts) {
    if (p.start !== expectedStart) {
      console.error(
        `Part files are not contiguous: expected a part starting at ${expectedStart}, found ${p.file}`,
      );
      process.exit(1);
    }
    expectedStart = p.end;
  }
  const loaded = parts.map(
    (p) =>
      JSON.parse(
        readFileSync(path.resolve(dataDir, p.file), "utf-8"),
      ) as { model: string; dim: number; ids: string[]; vectorsBase64: string },
  );
  const dim = loaded[0]!.dim;
  const model = loaded[0]!.model;
  for (let i = 0; i < loaded.length; i++) {
    const l = loaded[i]!;
    if (l.dim !== dim || l.model !== model) {
      console.error(
        `Part ${parts[i]!.file} has model/dim (${l.model}, ${l.dim}) inconsistent with first part (${model}, ${dim})`,
      );
      process.exit(1);
    }
    const expectedCount = parts[i]!.end - parts[i]!.start;
    const byteLen = Buffer.from(l.vectorsBase64, "base64").byteLength;
    if (l.ids.length !== expectedCount || byteLen !== expectedCount * dim * 4) {
      console.error(
        `Part ${parts[i]!.file} is malformed: ${l.ids.length} ids, ${byteLen} bytes, expected ${expectedCount} vectors of dim ${dim}`,
      );
      process.exit(1);
    }
  }
  const ids = loaded.flatMap((l) => l.ids);
  const buffers = loaded.map((l) => Buffer.from(l.vectorsBase64, "base64"));
  const total = Buffer.concat(buffers);
  writeFileSync(
    path.resolve(dataDir, "embedding-index.json"),
    JSON.stringify({
      model: loaded[0]!.model,
      dim,
      ids,
      vectorsBase64: total.toString("base64"),
    }),
  );
  console.log(
    `Merged ${parts.length} parts: ${ids.length} vectors (dim ${dim}) -> embedding-index.json`,
  );
}

if (process.env["EMBED_MERGE"] === "1") {
  merge();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
