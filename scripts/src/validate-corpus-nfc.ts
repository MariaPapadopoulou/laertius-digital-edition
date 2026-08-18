// Data-level Greek normalization check.
//
// The e2e-grc-lang sweep verifies Greek *displayed* in the browser is NFC,
// and that hard-coded app source literals are NFC. But the bulk of Greek
// comes from the API server's corpus/curated data. If an upstream re-ingest
// introduces decomposed (NFD) Greek or spacing breathing/accent glyphs, only
// routes the e2e sweep happens to render would catch it. This validator
// walks the api-server data files AND the curated TypeScript data modules
// and fails on any line whose Greek is not NFC or contains spacing
// breathing/accent glyphs (U+1FBD..U+1FFE spacing marks).
//
// Positive controls: the sweep must scan a substantial number of
// Greek-bearing lines from each root, so a wrong path or regex can never
// pass vacuously.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const DATA_DIR = join(REPO_ROOT, "artifacts/api-server/data");
const CURATED_DIR = join(REPO_ROOT, "artifacts/api-server/src/lib");

// Greek & Coptic + Extended Greek (polytonic) ranges — same as e2e-grc-lang.
const GREEK_RE = /[\u0370-\u03e1\u03f0-\u03ff\u1f00-\u1fff]/;
// Spacing breathings/accents typed as standalone glyphs (e.g. U+1FBF)
// render wrong; polytonic text must use precomposed codepoints.
const SPACING_MARK_RE =
  /[\u1fbd\u1fbf\u1fc0\u1fc1\u1fcd-\u1fcf\u1fdd-\u1fdf\u1fed-\u1fef\u1ffd\u1ffe]/;

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

function* walk(dir: string, extRe: RegExp): Generator<string> {
  for (const entry of readdirSync(dir)) {
    // Skip the local embedding model weights — binary, huge, no corpus text.
    if (entry === "models" || entry === "node_modules") continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p, extRe);
    else if (extRe.test(entry)) yield p;
  }
}

function scanRoot(
  label: string,
  dir: string,
  extRe: RegExp,
  minGreekLines: number,
) {
  console.log(`Scanning ${label} (${relative(REPO_ROOT, dir)})`);
  let greekLines = 0;
  let files = 0;
  const violations: string[] = [];
  for (const file of walk(dir, extRe)) {
    files++;
    const rel = relative(REPO_ROOT, file);
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (!GREEK_RE.test(line)) return;
      greekLines++;
      if (line.normalize("NFC") !== line) {
        violations.push(`${rel}:${i + 1} (not NFC)`);
      }
      if (SPACING_MARK_RE.test(line)) {
        violations.push(`${rel}:${i + 1} (spacing breathing/accent glyph)`);
      }
    });
  }
  check(
    `${label}: scanned a real corpus of Greek-bearing lines (${greekLines} lines across ${files} files)`,
    greekLines >= minGreekLines,
    `only ${greekLines} Greek lines matched — is the path or regex wrong?`,
  );
  check(
    `${label}: all Greek is NFC with precomposed codepoints`,
    violations.length === 0,
    `${violations.length} violation(s): ${violations.slice(0, 10).join(", ")}${violations.length > 10 ? ", …" : ""}`,
  );
}

// Corpus data files: JSONL corpora, Perseus TEI XML, embedding metadata.
scanRoot("corpus data", DATA_DIR, /\.(jsonl?|json|xml)$/, 1000);
// Curated data modules (claims, work ontology, place names, …).
scanRoot("curated modules", CURATED_DIR, /\.(ts|json)$/, 100);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll corpus Greek NFC checks passed");
