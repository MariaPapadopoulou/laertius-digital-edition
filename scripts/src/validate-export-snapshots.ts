/**
 * validate-export-snapshots — catches the checked-in alternate-format RDF
 * download copies going silently stale after a curation or ontology change.
 *
 * exports/zenodo-deposit/ is the published Zenodo deposition package:
 * the knowledge graph, annotated graph and ontology in Turtle, JSON-LD and
 * RDF/XML, plus void.ttl, README.md and .zenodo.json. All contents come
 * from lib/zenodo-deposit-files.ts (the same builder the build script
 * uses), and the generators are deterministic, so drift is a byte-level
 * comparison — no isomorphism dance needed.
 *
 * Checks:
 * 1. Positive control: the freshly built expected files must really carry
 *    graph content (an lo:Claim in graph.ttl, oa:Annotation in the
 *    annotated dump), and a deliberately perturbed copy must compare as
 *    different — so the comparison can never pass vacuously.
 * 2. Every deposit file on disk is byte-identical to the live generator
 *    output, no extras, none missing.
 * 3. exports/laertius-zenodo-deposit.zip holds exactly the same files with
 *    identical bytes (compared via `unzip -p`), so the shipped zip cannot
 *    drift from the directory either.
 * 4. Orphan sweep: no OTHER git-tracked RDF-format snapshot may exist under
 *    exports/ unless it is on the explicit allowlist of drift-checked
 *    files. A new .rdf/.ttl/.jsonld snapshot must either get a drift check
 *    or not be committed — it can never rot silently again.
 *
 * Regenerate a drifted snapshot:
 *   pnpm --filter @workspace/scripts run validate-export-snapshots -- --write-export
 * (equivalent to running build-zenodo-deposit).
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-export-snapshots
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { buildDepositFiles } from "./lib/zenodo-deposit-files";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const depositDir = path.join(repoRoot, "exports", "zenodo-deposit");
const zipPath = path.join(repoRoot, "exports", "laertius-zenodo-deposit.zip");

let failed = false;
const fail = (msg: string): void => {
  console.error(`validate-export-snapshots: ${msg}`);
  failed = true;
};

const { files: expected } = await buildDepositFiles();
const expectedNames = Object.keys(expected).sort();

// 1. Positive controls: the expected content must be substantive, and the
// byte comparison must be able to fail.
{
  const graphTtl = expected["graph.ttl"] ?? "";
  const annotatedTtl = expected["graph-annotated.ttl"] ?? "";
  if (!/\blo:Claim\b/.test(graphTtl)) {
    fail(
      "positive control FAILED — no lo:Claim in generated graph.ttl; the generators returned empty/degenerate output",
    );
  } else if (!/\boa:Annotation\b/.test(annotatedTtl)) {
    fail(
      "positive control FAILED — no oa:Annotation in generated graph-annotated.ttl; the annotation layer is missing",
    );
  } else if (`${graphTtl}\n# perturbed` === graphTtl) {
    fail("positive control FAILED — perturbed content compared equal");
  } else {
    console.log(
      "✓ positive controls: generated deposit content is substantive and the comparison can fail",
    );
  }
}

// 2. Directory drift check: byte-identical, no extras, none missing.
{
  const onDisk = fs.existsSync(depositDir)
    ? fs.readdirSync(depositDir).sort()
    : [];
  const missing = expectedNames.filter((n) => !onDisk.includes(n));
  const extra = onDisk.filter((n) => !expectedNames.includes(n));
  const drifted: string[] = [];
  for (const name of expectedNames) {
    if (missing.includes(name)) continue;
    const actual = fs.readFileSync(path.join(depositDir, name), "utf8");
    if (actual !== expected[name]) drifted.push(name);
  }
  if (missing.length || extra.length || drifted.length) {
    if (missing.length) fail(`deposit files missing: ${missing.join(", ")}`);
    if (extra.length)
      fail(`unexpected files in exports/zenodo-deposit: ${extra.join(", ")}`);
    if (drifted.length)
      fail(
        `deposit files have drifted from the live generators: ${drifted.join(", ")}`,
      );
    console.error(
      "  Regenerate: pnpm --filter @workspace/scripts run validate-export-snapshots -- --write-export",
    );
  } else {
    console.log(
      `✓ exports/zenodo-deposit/ (${expectedNames.length} files) is byte-identical to the live generators`,
    );
  }
}

// 3. Zip cross-check: same entries, same bytes.
{
  if (!fs.existsSync(zipPath)) {
    fail("exports/laertius-zenodo-deposit.zip is missing");
  } else {
    const listing = execFileSync("zipinfo", ["-1", zipPath], {
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .map((l) => l.replace(/^\.\//, ""))
      .filter((l) => l.length > 0 && !l.endsWith("/"))
      .sort();
    const missing = expectedNames.filter((n) => !listing.includes(n));
    const extra = listing.filter((n) => !expectedNames.includes(n));
    const drifted: string[] = [];
    for (const name of expectedNames) {
      if (missing.includes(name)) continue;
      const entry = listing.find(
        (l) => l === name || l === `./${name}`,
      ) as string;
      const content = execFileSync("unzip", ["-p", zipPath, entry], {
        maxBuffer: 128 * 1024 * 1024,
      }).toString("utf8");
      if (content !== expected[name]) drifted.push(name);
    }
    if (missing.length || extra.length || drifted.length) {
      if (missing.length) fail(`zip is missing entries: ${missing.join(", ")}`);
      if (extra.length) fail(`zip has unexpected entries: ${extra.join(", ")}`);
      if (drifted.length)
        fail(`zip entries have drifted: ${drifted.join(", ")}`);
      console.error(
        "  Regenerate: pnpm --filter @workspace/scripts run validate-export-snapshots -- --write-export",
      );
    } else {
      console.log(
        "✓ exports/laertius-zenodo-deposit.zip matches the deposit directory byte-for-byte",
      );
    }
  }
}

// 4. Orphan sweep: every git-tracked RDF-format file under exports/ must be
// drift-checked somewhere. New snapshots may not be committed unchecked.
{
  // Files whose drift IS checked, and by what.
  const allowlist = new Set<string>([
    // validate-shapes checks 3 & 4:
    "exports/laertius-shapes.ttl",
    "exports/laertius-shapes.rdf",
    // this validator, checks 2 & 3:
    ...expectedNames.map((n) => `exports/zenodo-deposit/${n}`),
  ]);
  const rdfLike = /\.(ttl|rdf|jsonld|nt|nq|owl|rdf\.xml|rdf\.xml\.gz)$/i;
  const tracked = execFileSync("git", ["ls-files", "exports"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter((f) => rdfLike.test(f));
  const orphans = tracked.filter((f) => !allowlist.has(f));
  if (orphans.length) {
    fail(
      `git-tracked RDF snapshots under exports/ with NO drift check:\n    ${orphans.join("\n    ")}\n  Either add them to a drift validator or remove them — unchecked copies rot silently.`,
    );
  } else {
    console.log(
      `✓ orphan sweep: all ${tracked.length} git-tracked RDF snapshots under exports/ are drift-checked`,
    );
  }
  // Sweep self-control: the allowlist must actually match tracked files, or
  // the sweep is checking against a phantom list.
  const phantom = [...allowlist].filter(
    (f) => rdfLike.test(f) && !tracked.includes(f),
  );
  if (phantom.length) {
    fail(
      `orphan-sweep allowlist entries that are not git-tracked (stale allowlist?): ${phantom.join(", ")}`,
    );
  }
}

if (failed && process.argv.includes("--write-export")) {
  console.error(
    "--write-export given: rebuilding exports/zenodo-deposit and the zip via build-zenodo-deposit — re-run to confirm",
  );
  execFileSync(
    "pnpm",
    ["--filter", "@workspace/scripts", "run", "build-zenodo-deposit"],
    { cwd: repoRoot, stdio: "inherit" },
  );
}

if (failed) {
  console.error("validate-export-snapshots FAILED");
  process.exit(1);
}
console.log("validate-export-snapshots: all checks passed");
