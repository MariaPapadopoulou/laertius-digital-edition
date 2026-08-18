/**
 * Shared xlsx parsing for the gold annotation workbook (unzip + regex,
 * namespace-prefix-agnostic OOXML, no dependencies). Used by
 * validate-gold-workbook (pre-ingestion validation) and
 * ingest-gold-workbook (converting the workbook into the official gold
 * JSONL set).
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export type Row = Record<string, string>;

export interface Workbook {
  /** sheet name → rows as header-keyed records */
  sheets: Record<string, Row[]>;
}

export function parseWorkbook(xlsxPath: string): Workbook {
  const dir = mkdtempSync(path.join(tmpdir(), "gold-workbook-"));
  try {
    execFileSync("unzip", ["-o", "-q", xlsxPath, "-d", dir]);
    // Namespace-prefix-agnostic OOXML regexes: this workbook uses "x:"
    // prefixes, standard Excel output uses none.
    const ssPath = path.join(dir, "xl/sharedStrings.xml");
    const strings: string[] = [];
    if (existsSync(ssPath)) {
      const ss = readFileSync(ssPath, "utf8");
      for (const m of ss.matchAll(/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g)) {
        strings.push(
          [...(m[1] ?? "").matchAll(/<(?:\w+:)?t[^>]*>([^<]*)<\/(?:\w+:)?t>/g)]
            .map((x) => decodeXml(x[1] ?? ""))
            .join(""),
        );
      }
    }
    const wb = readFileSync(path.join(dir, "xl/workbook.xml"), "utf8");
    // Resolve each sheet's worksheet part through the workbook rels (the
    // sheetN.xml naming is a convention, not guaranteed OOXML behavior).
    const rels = readFileSync(path.join(dir, "xl/_rels/workbook.xml.rels"), "utf8");
    const relTarget = new Map<string, string>();
    for (const m of rels.matchAll(/<Relationship\s[^>]*\/>/g)) {
      const id = /Id="([^"]+)"/.exec(m[0])?.[1];
      const target = /Target="([^"]+)"/.exec(m[0])?.[1];
      if (id && target) relTarget.set(id, target);
    }
    const sheets: Record<string, Row[]> = {};
    for (const m of wb.matchAll(/<(?:\w+:)?sheet\s[^>]*\/?>/g)) {
      const tag = m[0];
      const name = /name="([^"]+)"/.exec(tag)?.[1];
      const rid = /r:id="([^"]+)"/.exec(tag)?.[1];
      const sheetId = /sheetId="(\d+)"/.exec(tag)?.[1];
      if (!name) continue;
      const target = (rid && relTarget.get(rid)) || `worksheets/sheet${sheetId}.xml`;
      // Rels targets may be workbook-relative ("worksheets/sheet1.xml") or
      // package-absolute ("/xl/worksheets/sheet1.xml").
      const file = target.startsWith("/")
        ? path.join(dir, target.slice(1))
        : path.join(dir, "xl", target);
      if (!existsSync(file)) continue;
      const xml = readFileSync(file, "utf8");
      const rawRows = [
        ...xml.matchAll(/<(?:\w+:)?row[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g),
      ].map((rm) => {
        const out: Record<string, string> = {};
        for (const c of (rm[1] ?? "").matchAll(
          /<(?:\w+:)?c ([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g,
        )) {
          const attrs = c[1] ?? "";
          const body = c[2] ?? "";
          const col = /r="([A-Z]+)\d+"/.exec(attrs)?.[1];
          const type = /t="(\w+)"/.exec(attrs)?.[1];
          let v: string | undefined;
          if (type === "inlineStr") {
            v = [
              ...body.matchAll(/<(?:\w+:)?t[^>]*>([^<]*)<\/(?:\w+:)?t>/g),
            ]
              .map((x) => decodeXml(x[1] ?? ""))
              .join("");
          } else {
            const raw = /<(?:\w+:)?v>([^<]*)<\/(?:\w+:)?v>/.exec(body)?.[1];
            if (raw !== undefined) {
              v = type === "s" ? strings[Number(raw)] : decodeXml(raw);
            }
          }
          if (col && v !== undefined && v !== "") out[col] = v.trim();
        }
        return out;
      });
      const header = rawRows[0] ?? {};
      const cols = Object.entries(header); // col letter → header name
      sheets[name] = rawRows.slice(1).map((r) => {
        const rec: Row = {};
        for (const [col, hname] of cols) rec[hname] = r[col] ?? "";
        return rec;
      });
    }
    return { sheets };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The workbook uses ";" (and occasionally "|") as list separators. */
export const splitList = (s: string): string[] =>
  s
    .split(/[;|]/)
    .map((t) => t.trim())
    .filter(Boolean);
