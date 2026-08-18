/**
 * Materialize the Legomena dataset: the assertion ontology of the laertius
 * exporter (base graph + TBox) plus the full passage/annotation layer are
 * written as committed Turtle files under artifacts/legomena-api/data,
 * with a manifest of content hashes. This is the ONLY place where curated
 * TypeScript flows into the companion app; everything Legomena serves is
 * derived from these files.
 *
 * Run: pnpm --filter @workspace/scripts run materialize-legomena
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Parser as N3Parser } from "n3";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../../artifacts/legomena-api/data");

// The corpus module resolves its JSONL files relative to cwd unless this is
// set; scripts run with cwd = scripts/, so pin it (same as validate-lod).
process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  here,
  "../../artifacts/api-server/data",
);

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

async function main(): Promise<void> {
  const lod = await import("../../artifacts/api-server/src/lib/lod");
  const { corpus } = await import("../../artifacts/api-server/src/lib/corpus");
  const { annotateSection } = await import(
    "../../artifacts/api-server/src/lib/annotate"
  );

  const files = [
    { name: "base.ttl", content: lod.graphAsTurtle() },
    { name: "tbox.ttl", content: lod.ontologyAsTurtle() },
    { name: "passages.ttl", content: lod.passageLayerAsTurtle() },
  ];

  mkdirSync(outDir, { recursive: true });
  const fileEntries = files.map((f) => {
    const quads = new N3Parser().parse(f.content).length;
    writeFileSync(path.join(outDir, f.name), f.content);
    return {
      name: f.name,
      sha256: sha256(f.content),
      bytes: Buffer.byteLength(f.content, "utf-8"),
      quads,
    };
  });

  let annotatedSections = 0;
  let annotations = 0;
  for (const section of corpus) {
    const anns = annotateSection(section);
    if (anns.length > 0) annotatedSections += 1;
    annotations += anns.length;
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    files: fileEntries,
    counts: {
      sections: corpus.length,
      annotatedSections,
      annotations,
    },
  };
  writeFileSync(
    path.join(outDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  let failed = false;
  for (const f of fileEntries) {
    console.log(
      `  ${f.name}: ${f.quads} quads, ${(f.bytes / 1024).toFixed(0)} KiB, sha256 ${f.sha256.slice(0, 12)}…`,
    );
    if (f.quads === 0) {
      console.error(`  ✗ ${f.name} contains zero quads`);
      failed = true;
    }
  }
  console.log(
    `  passage layer: ${manifest.counts.sections} sections (${manifest.counts.annotatedSections} annotated, ${manifest.counts.annotations} annotations)`,
  );
  if (manifest.counts.sections === 0 || manifest.counts.annotations === 0) {
    console.error("  ✗ empty corpus or annotation layer");
    failed = true;
  }
  if (failed) process.exit(1);
  console.log(`✓ Legomena dataset materialized into ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
