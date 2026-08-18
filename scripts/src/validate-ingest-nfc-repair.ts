// Prove the ingest scripts really REPAIR decomposed Greek, not just pass
// clean input through.
//
// The corpus generators (parse-verses-tei, parse-english-tei,
// parse-sources-xlsx) NFC-normalize their serialized JSONL on write, so a
// Perseus re-ingest can't reintroduce decomposed Greek. But the committed
// inputs are already NFC, so that repair path never fires in normal runs —
// if a refactor dropped a .normalize("NFC") call, nothing would notice until
// upstream data goes bad AND validate-corpus-nfc turns red.
//
// This check:
//  1. builds a tiny TEI fixture whose Greek is deliberately decomposed (NFD)
//     — with a positive control asserting the fixture really is NOT NFC —
//  2. runs the REAL parse-verses-tei.ts and parse-english-tei.ts against it
//     (they resolve all paths from cwd, so a fixture workspace root works),
//  3. asserts the emitted JSONL is byte-identical to its NFC form and
//     contains the composed Greek,
//  4. negative control: runs mutated copies of both parsers with every
//     .normalize("NFC") stripped and asserts the output is then NOT NFC —
//     proving the fixture genuinely exercises the repair, not clean input,
//  5. does the same functional proof for parse-sources-xlsx: builds a tiny
//     xlsx workbook (zip + sharedStrings, matching the parser's dependency-
//     free reader) whose Greek name/work cells are decomposed and which has
//     NO Wikipedia URL column — so the QID re-derivation collects zero titles
//     and never touches the network — runs a copy of the REAL parser placed
//     under <fixtureRoot>/scripts/src (its OUT_PATH is import.meta.dirname-
//     relative, so output lands inside the fixture root), asserts the emitted
//     JSONL is NFC, then repeats with the .normalize("NFC") stripped and
//     asserts the output is NOT NFC,
//  6. statically asserts all three generators still pass their serialized
//     output through .normalize("NFC") at the writeFileSync site.
//
// Exit-code structure per repo convention: count failures, evaluate at the
// end of the linear flow, exit 1 on any failure.
import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPTS_DIR = resolve(import.meta.dirname, "..");
const TSX_BIN = join(SCRIPTS_DIR, "node_modules/.bin/tsx");
const PARSERS = {
  verses: join(SCRIPTS_DIR, "src/parse-verses-tei.ts"),
  english: join(SCRIPTS_DIR, "src/parse-english-tei.ts"),
  sources: join(SCRIPTS_DIR, "src/parse-sources-xlsx.ts"),
};

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

// ---------------------------------------------------------------------------
// Fixture: a minimal Perseus-shaped TEI pair + sections corpus whose Greek is
// decomposed. All Greek below is written composed here and decomposed at
// runtime, so this source file itself stays NFC (validate-corpus-nfc-adjacent
// sweeps scan source for decomposed Greek).
// ---------------------------------------------------------------------------
const COMPOSED_LINE_1 = "ἀρχὴ σοφίης ᾠδή";
const COMPOSED_LINE_2 = "γνῶθι σεαυτόν";
const COMPOSED_PHILOSOPHER = "Θαλῆς";
const NFD_LINE_1 = COMPOSED_LINE_1.normalize("NFD");
const NFD_LINE_2 = COMPOSED_LINE_2.normalize("NFD");
const NFD_PHILOSOPHER = COMPOSED_PHILOSOPHER.normalize("NFD");

check(
  "positive control: fixture Greek is genuinely decomposed (not NFC)",
  NFD_LINE_1 !== COMPOSED_LINE_1 &&
    NFD_LINE_2 !== COMPOSED_LINE_2 &&
    NFD_PHILOSOPHER !== COMPOSED_PHILOSOPHER,
);

function sectionDiv(edition: string, body: string): string {
  return (
    `<div type="textpart" subtype="section" ` +
    `xml:base="urn:cts:greekLit:tlg0004.tlg001.${edition}:1.1" n="1">` +
    body +
    `</div>`
  );
}

function makeFixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "nfc-ingest-fixture-"));
  const dataDir = join(root, "artifacts/api-server/data");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(
    join(dataDir, "tlg0004.tlg001.perseus-grc2.xml"),
    sectionDiv(
      "perseus-grc2",
      `<p>${NFD_LINE_2}</p>` +
        `<quote rend="blockquote">${NFD_LINE_1}<l/>${NFD_LINE_2}</quote>`,
    ),
    "utf-8",
  );
  writeFileSync(
    join(dataDir, "tlg0004.tlg001.perseus-eng2.xml"),
    sectionDiv(
      "perseus-eng2",
      `<p>The beginning of wisdom (${NFD_LINE_1}) is a song.</p>` +
        `<note resp="editor">Anth. Pal. vii. 1.</note>` +
        `<quote rend="blockquote">first line<l/>second line</quote>`,
    ),
    "utf-8",
  );
  // Philosopher name deliberately NFD: it flows through JSON.stringify to the
  // verses JSONL untouched by cleanInline, so only the write-level
  // .normalize("NFC") — the exact belt-and-braces this task guards — fixes it.
  writeFileSync(
    join(dataDir, "laertius_sections.jsonl"),
    JSON.stringify({
      id: "1.1.1",
      book: 1,
      philosopher: NFD_PHILOSOPHER,
      school: "Ionian",
    }) + "\n",
    "utf-8",
  );
  return root;
}

function runParser(scriptPath: string, cwd: string): string {
  return execFileSync(TSX_BIN, [scriptPath], {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

const GREEK_RE = /[\u0370-\u03e1\u03f0-\u03ff\u1f00-\u1fff]/;

function assertOutput(
  label: string,
  root: string,
  outFile: string,
  expectNfc: boolean,
) {
  const raw = readFileSync(
    join(root, "artifacts/api-server/data", outFile),
    "utf-8",
  );
  check(`${label}: output contains Greek`, GREEK_RE.test(raw));
  const isNfc = raw.normalize("NFC") === raw;
  if (expectNfc) {
    check(`${label}: emitted JSONL is NFC despite decomposed input`, isNfc);
    check(
      `${label}: composed Greek forms present in output`,
      raw.includes(COMPOSED_LINE_1) || raw.includes(COMPOSED_PHILOSOPHER),
    );
  } else {
    check(
      `${label} [negative control]: with .normalize("NFC") stripped, output is NOT NFC`,
      !isNfc,
      "output stayed NFC — the fixture no longer exercises the repair path",
    );
  }
}

// ---------------------------------------------------------------------------
// 1) Real parsers against the decomposed fixture: output must be NFC.
// ---------------------------------------------------------------------------
const realRoot = makeFixtureRoot();
// Negative-control copies with every .normalize("NFC") removed. They import
// only node builtins and use no top-level await, so tmpdir copies run fine.
const mutRoot = makeFixtureRoot();
const mutDir = mkdtempSync(join(tmpdir(), "nfc-ingest-negctl-"));

try {
  console.log("Running real parsers against decomposed TEI fixture");
  runParser(PARSERS.verses, realRoot);
  runParser(PARSERS.english, realRoot);
  assertOutput("parse-verses-tei", realRoot, "laertius_verses.jsonl", true);
  assertOutput(
    "parse-english-tei",
    realRoot,
    "laertius_sections_en.jsonl",
    true,
  );

  // -------------------------------------------------------------------------
  // 2) Negative control: strip normalization, expect non-NFC output.
  // -------------------------------------------------------------------------
  console.log("Running normalization-stripped parser copies (negative control)");
  for (const key of ["verses", "english"] as const) {
    const src = readFileSync(PARSERS[key], "utf-8");
    const stripped = src.replaceAll('.normalize("NFC")', "");
    check(
      `${key}: mutation removed at least 2 normalize calls`,
      src.length - stripped.length >= 2 * '.normalize("NFC")'.length,
      "parser no longer contains the expected .normalize(\"NFC\") calls",
    );
    const mutPath = join(mutDir, `${key}.ts`);
    writeFileSync(mutPath, stripped, "utf-8");
    runParser(mutPath, mutRoot);
  }
  assertOutput("parse-verses-tei", mutRoot, "laertius_verses.jsonl", false);
  assertOutput(
    "parse-english-tei",
    mutRoot,
    "laertius_sections_en.jsonl",
    false,
  );
} finally {
  rmSync(realRoot, { recursive: true, force: true });
  rmSync(mutRoot, { recursive: true, force: true });
  rmSync(mutDir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// 3) parse-sources-xlsx: functional proof against a decomposed xlsx fixture.
//
// The parser's OUT_PATH is import.meta.dirname-relative
// (../../artifacts/api-server/data/dl_sources.jsonl), so we run a copy placed
// at <fixtureRoot>/scripts/src/ — output then lands inside the fixture root,
// never in the real repo. The fixture workbook has no Wikipedia URL cells
// (column P) so resolveTitles() gets zero titles and performs no fetches.
// ---------------------------------------------------------------------------
const COMPOSED_WORK = "Περὶ φύσεως ᾠδῆς";
const NFD_WORK = COMPOSED_WORK.normalize("NFD");
check(
  "positive control: xlsx fixture Greek is genuinely decomposed (not NFC)",
  NFD_WORK !== COMPOSED_WORK,
);

function xmlHeader(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${body}`;
}

/** Build a minimal xlsx (zip of workbook.xml + sharedStrings + sheet1). */
function makeXlsxFixture(dir: string): string {
  const pkg = join(dir, "xlsx-src");
  mkdirSync(join(pkg, "xl/worksheets"), { recursive: true });
  // Shared strings: header labels the parser asserts on, then the data row.
  // Greek entries are written decomposed (NFD) at runtime.
  const strings = [
    "ID",
    "ID Wikidata",
    "DL-SRC-0001",
    NFD_PHILOSOPHER,
    "Thales",
    NFD_WORK,
    "I 22",
  ];
  writeFileSync(
    join(pkg, "xl/sharedStrings.xml"),
    xmlHeader(
      `<sst count="${strings.length}" uniqueCount="${strings.length}">` +
        strings.map((s) => `<si><t>${s}</t></si>`).join("") +
        `</sst>`,
    ),
    "utf-8",
  );
  // No sheet named "Sources" -> sourcesSheetPath falls back to sheet1.xml.
  writeFileSync(
    join(pkg, "xl/workbook.xml"),
    xmlHeader(
      `<workbook><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    "utf-8",
  );
  writeFileSync(
    join(pkg, "xl/worksheets/sheet1.xml"),
    xmlHeader(
      `<worksheet><sheetData>` +
        `<row r="1"><c r="A1" t="s"><v>0</v></c><c r="O1" t="s"><v>1</v></c></row>` +
        `<row r="2">` +
        `<c r="A2" t="s"><v>2</v></c>` +
        `<c r="C2" t="s"><v>3</v></c>` +
        `<c r="D2" t="s"><v>4</v></c>` +
        `<c r="G2" t="s"><v>5</v></c>` +
        `<c r="J2" t="s"><v>6</v></c>` +
        `</row>` +
        `</sheetData></worksheet>`,
    ),
    "utf-8",
  );
  const xlsxPath = join(dir, "fixture.xlsx");
  execFileSync("zip", ["-r", "-q", xlsxPath, "."], { cwd: pkg });
  return xlsxPath;
}

/**
 * Run a copy of parse-sources-xlsx (optionally with .normalize("NFC")
 * stripped) inside a fresh fixture root; return the emitted JSONL.
 */
function runSourcesParser(stripNormalize: boolean): string {
  const root = mkdtempSync(join(tmpdir(), "nfc-sources-fixture-"));
  try {
    const xlsxPath = makeXlsxFixture(root);
    mkdirSync(join(root, "scripts/src"), { recursive: true });
    mkdirSync(join(root, "artifacts/api-server/data"), { recursive: true });
    let src = readFileSync(PARSERS.sources, "utf-8");
    if (stripNormalize) {
      const stripped = src.replaceAll('.normalize("NFC")', "");
      check(
        "sources: mutation removed at least 1 normalize call",
        src.length > stripped.length,
        'parser no longer contains a .normalize("NFC") call',
      );
      src = stripped;
    }
    // .mts: tsx treats bare .ts outside the workspace as CJS in some setups;
    // .mts forces ESM so import.meta.dirname resolves.
    const parserCopy = join(root, "scripts/src/parse-sources-xlsx.mts");
    writeFileSync(parserCopy, src, "utf-8");
    execFileSync(TSX_BIN, [parserCopy, xlsxPath], {
      cwd: root,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return readFileSync(
      join(root, "artifacts/api-server/data/dl_sources.jsonl"),
      "utf-8",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

console.log("Running real parse-sources-xlsx against decomposed xlsx fixture");
{
  const out = runSourcesParser(false);
  check("parse-sources-xlsx: output contains Greek", GREEK_RE.test(out));
  check(
    "parse-sources-xlsx: emitted JSONL is NFC despite decomposed input",
    out.normalize("NFC") === out,
  );
  check(
    "parse-sources-xlsx: composed Greek forms present in output",
    out.includes(COMPOSED_PHILOSOPHER) && out.includes(COMPOSED_WORK),
  );
  check(
    "parse-sources-xlsx: fixture row survived (id + parsed ref)",
    out.includes("DL-SRC-0001") && out.includes('"1.22"'),
  );
}

console.log(
  "Running normalization-stripped parse-sources-xlsx (negative control)",
);
{
  const out = runSourcesParser(true);
  check(
    'parse-sources-xlsx [negative control]: with .normalize("NFC") stripped, output is NOT NFC',
    out.normalize("NFC") !== out,
    "output stayed NFC — the fixture no longer exercises the repair path",
  );
}

// ---------------------------------------------------------------------------
// 4) Static guard on all three generators: serialized output must still flow
// through .normalize("NFC") at the write site (belt and braces on top of the
// functional proofs above).
// ---------------------------------------------------------------------------
console.log("Static write-site guard on all three generators");
for (const [key, file] of Object.entries(PARSERS)) {
  const src = readFileSync(file, "utf-8");
  const writeSite = /writeFileSync\([\s\S]{0,300}?\.normalize\("NFC"\)/;
  check(
    `${key}: writeFileSync payload passes through .normalize("NFC")`,
    writeSite.test(src),
  );
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll ingest NFC-repair checks passed");

export {};
