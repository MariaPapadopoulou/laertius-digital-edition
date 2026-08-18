import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const workspaceRoot = process.cwd().endsWith("scripts")
  ? path.resolve(process.cwd(), "..")
  : process.cwd();

const xmlPath = path.resolve(
  workspaceRoot,
  "artifacts/api-server/data/tlg0004.tlg001.perseus-eng2.xml",
);
const outPath = path.resolve(
  workspaceRoot,
  "artifacts/api-server/data/laertius_sections_en.jsonl",
);

const xml = readFileSync(xmlPath, "utf-8");

const sectionOpen =
  /<div type="textpart" subtype="section" xml:base="urn:cts:greekLit:tlg0004\.tlg001\.perseus-eng2:(\d+)\.(\w+)" n="(\w+)">/g;

interface Match {
  book: string;
  chapter: string;
  section: string;
  start: number;
}

const matches: Match[] = [];
let m: RegExpExecArray | null;
while ((m = sectionOpen.exec(xml)) !== null) {
  matches.push({
    book: m[1]!,
    chapter: m[2]!,
    section: m[3]!,
    start: m.index + m[0].length,
  });
}

function findSectionEnd(start: number): number {
  // Sections are leaf divs, but scan with depth tracking to be safe.
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

function stripElement(text: string, name: string): string {
  // Remove <name ...>...</name> including nested same-name elements.
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

function cleanText(raw: string): string {
  let text = raw;
  text = stripElement(text, "note");
  text = stripElement(text, "bibl");
  text = text.replace(/<[^>]+>/g, " ");
  text = decodeEntities(text);
  text = text.normalize("NFC");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

const lines: string[] = [];
for (const sec of matches) {
  const end = findSectionEnd(sec.start);
  const text = cleanText(xml.slice(sec.start, end));
  if (!text) continue;
  const id = `${sec.book}.${sec.chapter}.${sec.section}`;
  lines.push(JSON.stringify({ id, textEn: text }));
}

// NFC-normalize on write as well as in cleanText: English sections still
// embed Greek terms, and a re-ingest of the upstream TEI must not be able to
// reintroduce decomposed Greek into the committed JSONL (validate-corpus-nfc
// is the backstop, not the fix). NFC never touches ASCII/JSON structure.
writeFileSync(outPath, (lines.join("\n") + "\n").normalize("NFC"), "utf-8");
console.log(`Wrote ${lines.length} English sections to ${outPath}`);
const sample = JSON.parse(lines[0]!);
console.log(`Sample ${sample.id}: ${sample.textEn.slice(0, 200)}`);
const leftovers = lines.filter((l) => l.includes("<") || l.includes("&lt;"));
console.log(`Lines with leftover markup: ${leftovers.length}`);
