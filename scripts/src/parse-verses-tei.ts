/**
 * Extracts the verse / epigram layer from the Perseus TEI of Diogenes
 * Laertius' Lives. Every block quotation (`<quote rend="blockquote">`) is a
 * verse block — death-epigrams (the Pammetros), oracles, epitaphs, and lines
 * quoted from other poets. Verse lines inside a quote are separated by a
 * self-closing `<l/>`.
 *
 * Quotes nested inside editorial `<note>` elements are NOT real quotations
 * (they are apparatus criticus, sometimes tagged `<quote xml:lang="lat">`) and
 * are excluded. Greek quote bodies embed Latin apparatus `<note>`s which are
 * stripped. The source origin of a quote (e.g. "Anth. Pal. vii. 616.") is an
 * editorial `<note resp="editor">` immediately preceding the English quote;
 * Greek-side notes are Latin apparatus and are ignored for sourcing.
 *
 * Greek is the primary text: verses are anchored on the Greek quotes and
 * aligned to the English translation by position within a section. When a
 * section's Greek and English blockquote counts differ, the English side is
 * left null rather than mis-aligned.
 *
 * Run from the workspace root (or the scripts dir):
 *   pnpm --filter @workspace/scripts run parse-verses-tei
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const workspaceRoot = process.cwd().endsWith("scripts")
  ? path.resolve(process.cwd(), "..")
  : process.cwd();

const dataDir = path.resolve(workspaceRoot, "artifacts/api-server/data");
const grcPath = path.resolve(dataDir, "tlg0004.tlg001.perseus-grc2.xml");
const engPath = path.resolve(dataDir, "tlg0004.tlg001.perseus-eng2.xml");
const sectionsPath = path.resolve(dataDir, "laertius_sections.jsonl");
const outPath = path.resolve(dataDir, "laertius_verses.jsonl");

// --- shared TEI helpers ----------------------------------------------------

function stripElement(text: string, name: string): string {
  const open = new RegExp(`<${name}\\b[^>]*(?<!/)>`, "g");
  let result = text;
  let match: RegExpExecArray | null;
  while ((match = open.exec(result)) !== null) {
    let depth = 1;
    const scanner = new RegExp(`<${name}\\b[^>]*(?<!/)>|</${name}>`, "g");
    scanner.lastIndex = match.index + match[0].length;
    let end = result.length;
    let s: RegExpExecArray | null;
    while ((s = scanner.exec(result)) !== null) {
      depth += s[0].startsWith("</") ? -1 : 1;
      if (depth === 0) {
        end = s.index + s[0].length;
        break;
      }
    }
    result = result.slice(0, match.index) + " " + result.slice(end);
    open.lastIndex = match.index;
  }
  return result;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(parseInt(dec, 10)),
    )
    .replace(/&amp;/g, "&");
}

/** Strip remaining inline markup from a fragment and normalize whitespace. */
function cleanInline(raw: string): string {
  let text = raw.replace(/<[^>]+>/g, " ");
  text = decodeEntities(text);
  text = text.normalize("NFC");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

// --- section iteration -----------------------------------------------------

interface Section {
  book: string;
  chapter: string;
  section: string;
  start: number;
  end: number;
}

function sectionsOf(xml: string, edition: string): Section[] {
  const open = new RegExp(
    `<div type="textpart" subtype="section" xml:base="urn:cts:greekLit:tlg0004\\.tlg001\\.${edition}:(\\d+)\\.(\\w+)" n="(\\w+)">`,
    "g",
  );
  const out: Section[] = [];
  let m: RegExpExecArray | null;
  while ((m = open.exec(xml)) !== null) {
    const start = m.index + m[0].length;
    out.push({
      book: m[1]!,
      chapter: m[2]!,
      section: m[3]!,
      start,
      end: findSectionEnd(xml, start),
    });
  }
  return out;
}

function findSectionEnd(xml: string, start: number): number {
  let depth = 1;
  const tag = /<\/?div\b[^>]*>/g;
  tag.lastIndex = start;
  let t: RegExpExecArray | null;
  while ((t = tag.exec(xml)) !== null) {
    if (t[0].startsWith("</")) {
      depth -= 1;
      if (depth === 0) return t.index;
    } else if (!t[0].endsWith("/>")) {
      depth += 1;
    }
  }
  return xml.length;
}

// --- quote extraction ------------------------------------------------------

interface RawQuote {
  lines: string[];
  source: string | null;
  continued: boolean;
}

function noteSpans(secXml: string): [number, number][] {
  const spans: [number, number][] = [];
  const re = /<note\b[^>]*>[\s\S]*?<\/note>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(secXml)) !== null) {
    spans.push([m.index, m.index + m[0].length]);
  }
  return spans;
}

function splitVerseLines(body: string): string[] {
  let b = stripElement(body, "note");
  b = b.replace(/<pb\b[^>]*\/?>/g, " ");
  return b
    .split(/<\/?l\b[^>]*>/)
    .map(cleanInline)
    .filter((s) => s.length > 0);
}

/**
 * A handful of editor notes wrap the citation in scholarly prose rather than
 * giving it bare. Only touch clearly-overlong ones (>80 chars) so the many
 * legitimate compound citations ("Fr. 49 Bergk; cf. Schol. Pindar…") are left
 * untouched; short/normal citations are returned as-is.
 */
function tidySource(s: string): string {
  if (s.length <= 80) return s;
  // Parenthetical citation embedded in a comment: "… (Fr. 6 D.), which …".
  const paren = s.match(/\(([^)]*\b(?:Fr|Frag|Anth|Ib)\.[^)]*)\)/);
  if (paren) return paren[1]!.trim();
  // Leading citation followed by a fresh prose sentence: "Meineke … 437. According …".
  const lead = s.match(/^(.*?\.)\s+[A-Z]/);
  if (lead && lead[1]!.length <= 80) return lead[1]!.trim();
  return s;
}

/** Editorial source note ending immediately before a quote (English side). */
function sourceBefore(secXml: string, quoteStart: number): string | null {
  const pre = secXml.slice(0, quoteStart);
  // Match ONLY the single note immediately before the quote. A tempered greedy
  // token keeps the captured body from crossing an earlier </note>, so we never
  // swallow a previous verse's citation + its quoted text + prose in between.
  const m = pre.match(
    /<note\b([^>]*)>((?:(?!<\/note>)[\s\S])*)<\/note>\s*:?\s*$/,
  );
  if (!m || !/resp="editor"/.test(m[1]!)) return null;
  const src = cleanInline(m[2]!);
  return src.length > 0 ? tidySource(src) : null;
}

function quotesOf(
  secXml: string,
  withSource: boolean,
): RawQuote[] {
  const spans = noteSpans(secXml);
  const insideNote = (idx: number): boolean =>
    spans.some(([a, b]) => idx >= a && idx < b);
  const out: RawQuote[] = [];
  const re = /<quote\b([^>]*)>([\s\S]*?)<\/quote>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(secXml)) !== null) {
    const attrs = m[1]!;
    if (!/rend="[^"]*blockquote/.test(attrs)) continue;
    if (insideNote(m.index)) continue;
    const lines = splitVerseLines(m[2]!);
    if (lines.length === 0) continue;
    out.push({
      lines,
      source: withSource ? sourceBefore(secXml, m.index) : null,
      continued: /merge/.test(attrs),
    });
  }
  return out;
}

// --- corpus metadata (philosopher / school per section) --------------------

interface GreekRecord {
  id: string;
  book: number;
  philosopher: string;
  school: string;
}

const meta = new Map<string, { book: number; philosopher: string; school: string }>();
for (const line of readFileSync(sectionsPath, "utf-8").split("\n")) {
  if (!line.trim()) continue;
  const r = JSON.parse(line) as GreekRecord;
  meta.set(r.id, { book: r.book, philosopher: r.philosopher, school: r.school });
}

// --- build the verse layer -------------------------------------------------

const grcXml = readFileSync(grcPath, "utf-8");
const engXml = readFileSync(engPath, "utf-8");

const engBySection = new Map<string, RawQuote[]>();
for (const sec of sectionsOf(engXml, "perseus-eng2")) {
  const id = `${sec.book}.${sec.chapter}.${sec.section}`;
  const qs = quotesOf(engXml.slice(sec.start, sec.end), true);
  if (qs.length > 0) engBySection.set(id, qs);
}

interface VerseRecord {
  id: string;
  sectionId: string;
  book: number;
  philosopher: string;
  school: string;
  linesGrc: string[];
  linesEn: string[] | null;
  source: string | null;
  continued: boolean;
}

const verses: VerseRecord[] = [];
const mismatches: string[] = [];
let unknownSections = 0;

for (const sec of sectionsOf(grcXml, "perseus-grc2")) {
  const id = `${sec.book}.${sec.chapter}.${sec.section}`;
  const grcQuotes = quotesOf(grcXml.slice(sec.start, sec.end), false);
  if (grcQuotes.length === 0) continue;
  const info = meta.get(id);
  if (!info) {
    unknownSections += 1;
    continue;
  }
  const engQuotes = engBySection.get(id) ?? [];
  const aligned = grcQuotes.length === engQuotes.length;
  if (!aligned) mismatches.push(`${id} (grc=${grcQuotes.length}/eng=${engQuotes.length})`);
  grcQuotes.forEach((q, i) => {
    const en = aligned ? engQuotes[i]! : null;
    verses.push({
      id: `${id}#${i}`,
      sectionId: id,
      book: info.book,
      philosopher: info.philosopher,
      school: info.school,
      linesGrc: q.lines,
      linesEn: en ? en.lines : null,
      source: en ? en.source : null,
      continued: q.continued,
    });
  });
}

// NFC-normalize the whole serialized output on write (belt-and-braces beyond
// cleanInline): a future upstream Perseus TEI re-ingest could reintroduce
// decomposed Greek through a path that skips cleanInline, and the committed
// JSONL must stay NFC at the source. validate-corpus-nfc is the backstop.
// (NFC never touches ASCII, so JSON structure is unaffected.)
writeFileSync(
  outPath,
  (verses.map((v) => JSON.stringify(v)).join("\n") + "\n").normalize("NFC"),
  "utf-8",
);

const withEn = verses.filter((v) => v.linesEn !== null).length;
const withSrc = verses.filter((v) => v.source).length;
console.log(`Wrote ${verses.length} verses to ${outPath}`);
console.log(`  with English: ${withEn}; with source label: ${withSrc}`);
console.log(`  mismatched sections (${mismatches.length}): ${mismatches.join(", ")}`);
if (unknownSections > 0) {
  console.log(`  WARNING: ${unknownSections} quote-bearing sections not found in corpus`);
}
const sample = verses.find((v) => v.linesEn && v.source);
if (sample) {
  console.log(`  sample ${sample.id} [${sample.source}]:`);
  console.log(`    grc: ${sample.linesGrc.join(" / ")}`);
  console.log(`    en : ${sample.linesEn!.join(" / ")}`);
}
