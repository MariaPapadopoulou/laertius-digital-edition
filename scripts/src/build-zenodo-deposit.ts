/**
 * Builds a Zenodo deposition package for the Laertius linked open data:
 * all LOD serializations (knowledge graph, annotated graph, ontology,
 * VoID description), a README, and a .zenodo.json metadata record, zipped
 * to exports/laertius-zenodo-deposit.zip.
 *
 * File contents come from the shared builder in lib/zenodo-deposit-files.ts,
 * which validate-export-snapshots.ts also uses to drift-check the checked-in
 * snapshot against the live generators.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run build-zenodo-deposit
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { buildDepositFiles } from "./lib/zenodo-deposit-files";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const outDir = path.join(repoRoot, "exports", "zenodo-deposit");
const zipPath = path.join(repoRoot, "exports", "laertius-zenodo-deposit.zip");

const { files, stats } = await buildDepositFiles();

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
for (const [name, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(outDir, name), content);
  console.log(`wrote ${name} (${(content.length / 1024).toFixed(0)} KB)`);
}

fs.rmSync(zipPath, { force: true });
execFileSync("zip", ["-r", "-q", zipPath, "."], { cwd: outDir });
const zipSize = fs.statSync(zipPath).size;
console.log(
  `\nDeposit ready: exports/laertius-zenodo-deposit.zip ` +
    `(${(zipSize / 1024 / 1024).toFixed(1)} MB), ` +
    `${stats.triples} graph triples, ${stats.annotatedTriples} annotated triples`,
);
