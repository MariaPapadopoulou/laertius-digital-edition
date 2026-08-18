/**
 * One-time (re-runnable) converter: DL Sources Index xlsx -> dl_sources.jsonl
 *
 * Input: the user-supplied verified sources workbook (529 rows, one row per
 * (person, D.L. citation[, work]) — an index of the authorities Diogenes
 * Laertius cites). Output: artifacts/api-server/data/dl_sources.jsonl,
 * one normalized JSON record per row.
 *
 * Curation-time network use (Wikipedia API only): the workbook's "ID Wikidata"
 * column is unreliable (152 of 326 rows carried unrelated QIDs, e.g. Menander
 * -> "Breaking Bad"), while its Wikipedia URLs are sound. QIDs are therefore
 * re-derived from the enwiki page title via the Wikipedia pageprops API
 * (redirect-resolving). Runtime stays fully offline: this script only writes
 * the JSONL, which is committed.
 *
 * ROW_OVERRIDES repairs verified row-shift corruption in the workbook (the
 * EN/GRC name columns were sorted independently of the FR/QID/work/ref
 * columns in two clusters) and one wrong identification — each with the
 * evidence that justified it. Never add an override without checking the
 * cited passage in the corpus.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const XLSX_PATH = resolve(
  process.argv[2] ??
    join(
      import.meta.dirname,
      "../../attached_assets/5_dl_sources_v10_cleaned_1784033178164.xlsx",
    ),
);
const OUT_PATH = join(
  import.meta.dirname,
  "../../artifacts/api-server/data/dl_sources.jsonl",
);

// ---------------------------------------------------------------------------
// Curated repairs (see module header). Fields listed here replace the row's.
// ---------------------------------------------------------------------------
const ROW_OVERRIDES: Record<
  string,
  { nameEn?: string; nameGrc?: string; wikipedia?: string | null; note: string }
> = {
  "DL-SRC-0009": {
    nameEn: "Alexander Polyhistor",
    note: "EN column shifted: row carries Polyhistor's FR name, QID, Successions refs; EN said 'Alexander of Myndus'.",
  },
  "DL-SRC-0010": {
    nameEn: "Alexis",
    nameGrc: "Ἄλεξις",
    note: "EN/GRC columns shifted: row carries Alexis' FR name, QID, work (Ankylion) and ref III 27; EN/GRC said Alexander Polyhistor.",
  },
  "DL-SRC-0023": {
    nameEn: "Anaxilaus",
    nameGrc: "Ἀναξίλαος",
    note: "EN/GRC columns shifted: FR 'Anaxilaos', ref I 107 — D.L. 1.107 says 'Anaxilaus makes him an Arcadian'; EN/GRC said the comic poet Anaxilas.",
  },
  "DL-SRC-0026": {
    nameEn: "Anaxilas (comic poet)",
    nameGrc: "Ἀναξίλας",
    note: "EN/GRC columns shifted: row carries Anaxilas' QID, work (Rich Women) and ref III 28 — D.L. 3.28 names Botrylion, Circe and Rich Women; EN/GRC said Anaxilaus.",
  },
  "DL-SRC-0041": {
    wikipedia: "https://en.wikipedia.org/wiki/Antisthenes_of_Rhodes",
    note: "FR says 'Antisthenes de Rhodes' (the Successions historian, per entity-links curation) but the row linked the Cynic's Wikipedia page (and a QID that is a Spanish actor).",
  },
};

// enwiki pages that moved/never existed under the workbook's title.
const TITLE_FIXES: Record<string, string | null> = {
  "Euphorion (poet)": "Euphorion of Chalcis",
  Mnesimachus: null, // comic poet, no enwiki article — leave unidentified
};

// ---------------------------------------------------------------------------
// xlsx parsing (zip -> sharedStrings + sheet1, no dependencies)
// ---------------------------------------------------------------------------
function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

interface RawRow {
  [col: string]: string;
}

/**
 * Locate the worksheet part holding the sources table. Newer workbook
 * revisions (v10+) put it on a sheet named "Sources" behind a README sheet;
 * the original workbook had it on the first (only data) sheet. Resolve the
 * sheet name through workbook.xml + its rels; fall back to sheet1.xml.
 */
function sourcesSheetPath(dir: string): string {
  const wb = readFileSync(join(dir, "xl/workbook.xml"), "utf8");
  const sheetTag = [...wb.matchAll(/<sheet\s[^>]*>/g)]
    .map((m) => m[0])
    .find((tag) => /name="Sources"/.test(tag));
  const rid = sheetTag && /r:id="([^"]+)"/.exec(sheetTag)?.[1];
  if (!rid) return join(dir, "xl/worksheets/sheet1.xml");
  const rels = readFileSync(join(dir, "xl/_rels/workbook.xml.rels"), "utf8");
  const relTag = [...rels.matchAll(/<Relationship\s[^>]*>/g)]
    .map((m) => m[0])
    .find((tag) => tag.includes(`Id="${rid}"`));
  const target = relTag && /Target="([^"]+)"/.exec(relTag)?.[1];
  if (!target) {
    throw new Error(`workbook rels missing target for ${rid}`);
  }
  return join(dir, "xl", target);
}

function parseXlsx(path: string): RawRow[] {
  const dir = mkdtempSync(join(tmpdir(), "dl-sources-xlsx-"));
  try {
    execFileSync("unzip", ["-o", "-q", path, "-d", dir]);
    const ss = readFileSync(join(dir, "xl/sharedStrings.xml"), "utf8");
    const strings = [...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
      [...(m[1] ?? "").matchAll(/<t[^>]*>([^<]*)<\/t>/g)]
        .map((x) => x[1] ?? "")
        .join(""),
    );
    const sheet = readFileSync(sourcesSheetPath(dir), "utf8");
    const rows: RawRow[] = [];
    for (const rm of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const out: RawRow = {};
      for (const c of (rm[1] ?? "").matchAll(
        /<c ([^>]*)>(?:<v>([^<]*)<\/v>)?(?:<\/c>)?/g,
      )) {
        const attrs = c[1] ?? "";
        const col = /r="([A-Z]+)\d+"/.exec(attrs)?.[1];
        const type = /t="(\w+)"/.exec(attrs)?.[1];
        let v = c[2];
        if (type === "s" && v !== undefined) v = strings[Number(v)];
        if (col && v !== undefined && v.trim() !== "")
          out[col] = decodeXml(v.trim());
      }
      rows.push(out);
    }
    return rows;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// D.L. reference parsing: "VI 99", "VII, 39", "I 31, 81", "I 116; II 19, 106"
// -> ["6.99"], ["7.39"], ["1.31","1.81"], ["1.116","2.19","2.106"]. Book-only
// tokens and anything malformed are skipped (raw string is always kept).
// ---------------------------------------------------------------------------
const ROMAN: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
};

function parseRefs(raw: string): { refs: string[]; clean: boolean } {
  const refs: string[] = [];
  let book: number | undefined;
  let clean = true;
  for (const tok of raw
    .replace(/;/g, ",")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)) {
    const m = /^([IVX]+)(?:\s+(\d+))?$/.exec(tok);
    if (m && m[1] && ROMAN[m[1]]) {
      book = ROMAN[m[1]];
      if (m[2]) refs.push(`${book}.${m[2]}`);
      else clean = false; // book without section — unciteable at section level
    } else if (/^\d+$/.test(tok) && book) {
      refs.push(`${book}.${tok}`);
    } else {
      clean = false;
    }
  }
  return { refs: [...new Set(refs)], clean };
}

// ---------------------------------------------------------------------------
// Wikipedia title -> QID (redirect-resolving, batched)
// ---------------------------------------------------------------------------
async function resolveTitles(
  titles: string[],
): Promise<Map<string, { qid: string | null; title: string }>> {
  const out = new Map<string, { qid: string | null; title: string }>();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const url =
      "https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&redirects=1&format=json&titles=" +
      encodeURIComponent(batch.join("|"));
    const res = await fetch(url, {
      headers: { "User-Agent": "laertius-curation/1.0" },
    });
    if (!res.ok) throw new Error(`Wikipedia API ${res.status} for batch ${i}`);
    const j = (await res.json()) as {
      query: {
        normalized?: { from: string; to: string }[];
        redirects?: { from: string; to: string }[];
        pages?: Record<
          string,
          { title: string; pageprops?: { wikibase_item?: string }; missing?: "" }
        >;
      };
    };
    const norm = new Map(
      (j.query.normalized ?? []).map((n) => [n.from, n.to]),
    );
    const redir = new Map(
      (j.query.redirects ?? []).map((r) => [r.from, r.to]),
    );
    const byTitle = new Map(
      Object.values(j.query.pages ?? {}).map((p) => [p.title, p]),
    );
    for (const t of batch) {
      let key = norm.get(t) ?? t;
      key = redir.get(key) ?? key;
      const page = byTitle.get(key);
      if (!page || page.missing !== undefined) {
        throw new Error(
          `enwiki page missing for "${t}" — add a TITLE_FIXES entry`,
        );
      }
      out.set(t, { qid: page.pageprops?.wikibase_item ?? null, title: key });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
export interface SourceRow {
  id: string;
  nameGrc: string | null;
  /** null only for anonymous-work / thematic rows (no cited person). */
  nameEn: string | null;
  nameFr: string | null;
  description: string | null;
  workGrc: string | null;
  workEn: string | null;
  workFr: string | null;
  refRaw: string | null;
  refs: string[];
  qid: string | null;
  enwiki: string | null; // canonical (redirect-resolved) enwiki page title
  externalLinks: string | null;
  certainty: "certain" | "probable" | "uncertain" | null;
  notes: string | null;
  corrected: string | null; // reason, when ROW_OVERRIDES touched this row
}

const CERTAINTY: Record<string, SourceRow["certainty"]> = {
  verified: "certain",
  certaine: "certain",
  probable: "probable",
  incertaine: "uncertain",
};

async function main(): Promise<void> {
  const raw = parseXlsx(XLSX_PATH);
  const header = raw[0];
  if (!header || header["A"] !== "ID" || header["O"] !== "ID Wikidata") {
    throw new Error("Unexpected xlsx layout — header row mismatch");
  }
  const dataRows = raw.slice(1).filter((r) => r["A"]);

  // Collect enwiki titles (post-override, post-fix) to resolve in one pass.
  const wantedTitles = new Set<string>();
  const titleOf = (url: string): string =>
    decodeURIComponent(url.split("/wiki/")[1] ?? "").replace(/_/g, " ");
  for (const r of dataRows) {
    const id = r["A"] ?? "";
    const ov = ROW_OVERRIDES[id];
    const url = ov && ov.wikipedia !== undefined ? ov.wikipedia : (r["P"] ?? null);
    if (!url) continue;
    let title: string | null = titleOf(url);
    if (title in TITLE_FIXES) title = TITLE_FIXES[title] ?? null;
    if (title) wantedTitles.add(title);
  }
  const resolved = await resolveTitles([...wantedTitles]);

  let qidCorrections = 0;
  let corrected = 0;
  let cleanRefs = 0;
  let partialRefs = 0;
  const records: SourceRow[] = [];
  for (const r of dataRows) {
    const id = r["A"] ?? "";
    const ov = ROW_OVERRIDES[id];
    const url = ov && ov.wikipedia !== undefined ? ov.wikipedia : (r["P"] ?? null);
    let title: string | null = url ? titleOf(url) : null;
    if (title && title in TITLE_FIXES) title = TITLE_FIXES[title] ?? null;
    const hit = title ? resolved.get(title) : undefined;
    const qid = hit?.qid ?? null;
    if (qid && r["O"] && qid !== r["O"]) qidCorrections++;
    const refRaw = r["J"] ?? null;
    const parsed = refRaw ? parseRefs(refRaw) : { refs: [], clean: true };
    if (refRaw && parsed.refs.length > 0 && parsed.clean) cleanRefs++;
    else if (refRaw && parsed.refs.length > 0) partialRefs++;
    if (ov) corrected++;
    records.push({
      id,
      nameGrc: ov?.nameGrc ?? r["C"] ?? null,
      nameEn: ov?.nameEn ?? r["D"] ?? null,
      nameFr: r["E"] ?? null,
      description: r["F"] ?? null,
      workGrc: r["G"] ?? null,
      workEn: r["H"] ?? null,
      workFr: r["I"] ?? null,
      refRaw,
      refs: parsed.refs,
      qid,
      enwiki: hit?.title ?? null,
      externalLinks: r["R"] ?? null,
      certainty: CERTAINTY[r["S"] ?? ""] ?? null,
      notes: r["T"] ?? null,
      corrected: ov?.note ?? null,
    });
  }

  // The v10 "cleaned" workbook blanks the QID/Wikipedia/GRC-name cells on
  // repeat rows of the same person (dedup: metadata kept on one row, blanked
  // on siblings). Downstream, sources-index groups rows by QID first, so a
  // blanked sibling would split off into a spurious name-keyed group.
  // Restore those cells from a same-nameEn sibling — but ONLY for the exact
  // rows the cleanup blanked (verified against the pre-v10 JSONL). Blanket
  // name-based propagation is unsafe here: the workbook's row-shift
  // corruption means an unlinked row's EN name may belong to a different
  // person than the rest of the row (e.g. DL-SRC-0046 "Apollodorus of
  // Athens" is really Apollodorus of Cyzicus, DL-SRC-0162 "Cratinus" carries
  // the comedy Cleoboulinai), and rows like DL-SRC-0516 (Xanthus) are
  // deliberately unlinked because the source marks the identification
  // uncertain.
  const DEDUP_BLANKED_QID_ROWS = new Set(
    [
      // Epicurus of Samos (his own works cited in book 10)
      242, 246, 247, 248, 250, 251, 252, 253, 254, 255, 256, 257, 258, 259,
      260, 261, 262, 263, 264, 265, 266,
      279, // Eudemus of Rhodes
      281, 282, // Eudoxus of Cnidus
      419, // Pittacus of Mytilene
      // Plato (dialogues cited as sources)
      422, 423, 424, 425, 426, 427, 428, 429, 430, 431, 432, 433, 434, 435,
      436, 437, 438, 439, 440, 441, 442, 443, 444,
      522, // Xenophon of Erchia
    ].map((n) => `DL-SRC-${String(n).padStart(4, "0")}`),
  );
  const DEDUP_BLANKED_GRC_ROWS = new Set(["DL-SRC-0103"]); // Chilon
  let propagated = 0;
  const byName = new Map<string, SourceRow[]>();
  for (const rec of records) {
    if (!rec.nameEn) continue;
    const group = byName.get(rec.nameEn);
    if (group) group.push(rec);
    else byName.set(rec.nameEn, [rec]);
  }
  for (const rec of records) {
    const group = rec.nameEn ? (byName.get(rec.nameEn) ?? []) : [];
    if (DEDUP_BLANKED_QID_ROWS.has(rec.id) && !rec.qid) {
      const donor = group.find((r) => r.qid);
      if (!donor) throw new Error(`No QID donor for dedup-blanked ${rec.id}`);
      rec.qid = donor.qid;
      rec.enwiki = donor.enwiki;
      propagated++;
    }
    if (DEDUP_BLANKED_GRC_ROWS.has(rec.id) && !rec.nameGrc) {
      const donor = group.find((r) => r.nameGrc);
      if (!donor) throw new Error(`No GRC donor for dedup-blanked ${rec.id}`);
      rec.nameGrc = donor.nameGrc;
      propagated++;
    }
  }

  for (const rec of records) {
    // Anonymous-work / thematic rows carry no person name; anything else must.
    if (!rec.nameEn && !(rec.workFr || rec.workEn || rec.workGrc)) {
      throw new Error(`Row ${rec.id} has neither an EN name nor a work title`);
    }
  }
  const ids = new Set(records.map((r) => r.id));
  if (ids.size !== records.length) throw new Error("Duplicate DL-SRC ids");

  // NFC-normalize the serialized output before writing: the workbook's Greek
  // name/work-title cells can carry decomposed (NFD) or spacing-breathing
  // glyphs, which render wrong and break exact-match lookups. Normalizing at
  // ingest keeps the committed JSONL clean at the source; the
  // validate-corpus-nfc check remains the backstop. (NFC never touches ASCII,
  // so JSON structure is unaffected.)
  writeFileSync(
    OUT_PATH,
    (records.map((r) => JSON.stringify(r)).join("\n") + "\n").normalize("NFC"),
  );
  const withQid = records.filter((r) => r.qid).length;
  console.log(
    `Wrote ${records.length} rows -> ${OUT_PATH}\n` +
      `  with QID (enwiki-derived): ${withQid} (workbook QID corrected on ${qidCorrections} rows)\n` +
      `  curated row repairs: ${corrected}, dedup-blanked cells re-propagated: ${propagated}\n` +
      `  refs: ${cleanRefs} fully parsed, ${partialRefs} partially, ` +
      `${records.filter((r) => r.refRaw && r.refs.length === 0).length} raw-only`,
  );
}

void main();
