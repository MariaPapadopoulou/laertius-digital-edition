/**
 * fetch-depictions: curation-time lookup of Wikimedia Commons images
 * (Wikidata P18) for the OTB objects that carry curated QIDs, written
 * into the generated static module
 * `artifacts/api-server/src/lib/otb/depictions.ts`.
 *
 * Scope: philosophers/sages (PHILOSOPHER_META), curated mention persons
 * (ENTITY_QIDS and person-mentions.ts), places (PLACE_QIDS and
 * place-mentions.ts) and sources-index authorities (the workbook's
 * verified QIDs). Works and document nodes are skipped: lost ancient
 * works have no depictions.
 *
 * Every image comes from Wikimedia Commons, which hosts only public
 * domain and freely licensed media; the generated record keeps the
 * license short name and artist so the exports can credit the file, and
 * links the Commons file page. Runtime stays key-less: the exports
 * hotlink the Commons thumbnail redirect (Special:FilePath), no API.
 *
 * Etiquette: 45 ids per wbgetentities call, 1.5s delay between calls,
 * descriptive User-Agent, one retry with backoff on 429/5xx.
 *
 * Run: pnpm --filter @workspace/scripts run fetch-depictions
 */
import { writeFileSync } from "node:fs";
import path, { join } from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getOtbModel } = await import(
  "../../artifacts/api-server/src/lib/otb/build"
);
const { PHILOSOPHER_META } = await import(
  "../../artifacts/api-server/src/lib/kg"
);
const { ENTITY_QIDS, PLACE_QIDS } = await import(
  "../../artifacts/api-server/src/lib/entity-links"
);
const { getSourcesIndex } = await import(
  "../../artifacts/api-server/src/lib/sources-index"
);
const { MENTION_PERSONS } = await import(
  "../../artifacts/api-server/src/lib/person-mentions"
);
const { MENTION_PLACES } = await import(
  "../../artifacts/api-server/src/lib/place-mentions"
);

const UA =
  "LaertiusRAG/1.0 (https://humanisticadigitalia.eu/Laertius; scholarly corpus tool) node-fetch";
const OUT = join(
  import.meta.dirname,
  "../../artifacts/api-server/src/lib/otb/depictions.ts",
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson(url: string): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) return res.json();
    if (attempt >= 1 || (res.status !== 429 && res.status < 500)) {
      throw new Error(`GET ${url} -> ${res.status}`);
    }
    console.log(`  retrying after ${res.status}...`);
    await sleep(5000);
  }
}

/** Strip tags, collapse whitespace, drop em dashes, cap length. */
function cleanText(html: string): string {
  let s = html
    .replace(/<[^>]*>/g, "")
    .replace(/\u2014/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  // Nested language spans duplicate the visible text once the tags are
  // stripped ("Unknown authorUnknown author"): keep one copy.
  if (s.length % 2 === 0 && s.slice(0, s.length / 2) === s.slice(s.length / 2)) {
    s = s.slice(0, s.length / 2);
  }
  return s.length > 80 ? `${s.slice(0, 77)}...` : s;
}

async function main(): Promise<void> {
  const m = getOtbModel();

  // label -> qid for person-like objects, merged across the curated
  // layers (philosopher meta wins, then curated mentions, then the
  // workbook's verified authority QIDs).
  const personQid = new Map<string, string>();
  for (const g of getSourcesIndex().groups) {
    if (g.qid) personQid.set(g.label, g.qid);
  }
  for (const p of MENTION_PERSONS) {
    if (p.qid) personQid.set(p.label, p.qid);
  }
  for (const [label, qid] of Object.entries(ENTITY_QIDS)) {
    personQid.set(label, qid);
  }
  for (const [label, meta] of Object.entries(PHILOSOPHER_META)) {
    if (meta.qid) personQid.set(label, meta.qid);
  }

  // Mention places carry their own verified QIDs; PLACE_QIDS wins on
  // overlap, mirroring lod.ts.
  const mentionPlaceQid = new Map<string, string>();
  for (const p of MENTION_PLACES) {
    if (p.qid) mentionPlaceQid.set(p.label, p.qid);
  }

  const qidByObject = new Map<string, string>();
  for (const o of m.objects) {
    if (
      o.concept === "Philosopher" ||
      o.concept === "Sage" ||
      o.concept === "Person"
    ) {
      const qid = personQid.get(o.label);
      if (qid) qidByObject.set(o.id, qid);
    } else if (o.concept === "Place") {
      const qid = PLACE_QIDS[o.label] ?? mentionPlaceQid.get(o.label);
      if (qid) qidByObject.set(o.id, qid);
    }
  }
  const qids = [...new Set(qidByObject.values())].sort();
  console.log(
    `${qidByObject.size} objects with QIDs (${qids.length} unique); fetching P18...`,
  );

  // Wikidata P18 (preferred rank first, deprecated skipped).
  const fileByQid = new Map<string, string>();
  for (let i = 0; i < qids.length; i += 45) {
    const batch = qids.slice(i, i + 45);
    const url =
      "https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=" +
      batch.join("|");
    const data = (await getJson(url)) as {
      entities?: Record<
        string,
        {
          claims?: {
            P18?: Array<{
              rank: string;
              mainsnak: { datavalue?: { value?: unknown } };
            }>;
          };
        }
      >;
    };
    for (const [qid, ent] of Object.entries(data.entities ?? {})) {
      const stmts = (ent.claims?.P18 ?? []).filter(
        (s) => s.rank !== "deprecated",
      );
      const pick =
        stmts.find((s) => s.rank === "preferred") ?? stmts[0];
      const v = pick?.mainsnak.datavalue?.value;
      if (typeof v === "string" && v.length > 0) fileByQid.set(qid, v);
    }
    console.log(
      `  wbgetentities ${i + batch.length}/${qids.length} (images so far: ${fileByQid.size})`,
    );
    await sleep(1500);
  }

  // Commons license metadata per file.
  const files = [...new Set(fileByQid.values())].sort();
  const metaByFile = new Map<string, { license: string; artist?: string }>();
  for (let i = 0; i < files.length; i += 40) {
    const batch = files.slice(i, i + 40);
    const url =
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata&titles=" +
      encodeURIComponent(batch.map((f) => `File:${f}`).join("|"));
    const data = (await getJson(url)) as {
      query?: {
        normalized?: Array<{ from: string; to: string }>;
        pages?: Record<
          string,
          {
            title?: string;
            imageinfo?: Array<{
              extmetadata?: Record<string, { value?: string }>;
            }>;
          }
        >;
      };
    };
    const denorm = new Map<string, string>();
    for (const n of data.query?.normalized ?? []) denorm.set(n.to, n.from);
    for (const page of Object.values(data.query?.pages ?? {})) {
      const title = page.title;
      if (!title) continue;
      const orig = denorm.get(title) ?? title;
      const file = orig.replace(/^File:/, "");
      const md = page.imageinfo?.[0]?.extmetadata;
      if (!md) continue;
      const license = md.LicenseShortName?.value;
      if (!license) continue;
      const artistRaw = md.Artist?.value;
      const artist = artistRaw ? cleanText(artistRaw) : undefined;
      metaByFile.set(file, {
        license: cleanText(license),
        ...(artist ? { artist } : {}),
      });
    }
    console.log(`  commons extmetadata ${i + batch.length}/${files.length}`);
    await sleep(1500);
  }

  // Assemble object id -> record; objects sharing a QID share the image.
  const records: Array<[string, Record<string, string>]> = [];
  for (const [objectId, qid] of [...qidByObject.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], "en"),
  )) {
    const file = fileByQid.get(qid);
    if (!file) continue;
    const meta = metaByFile.get(file);
    if (!meta) {
      console.log(`  skipping ${objectId}: no license metadata for ${file}`);
      continue;
    }
    const underscored = file.replace(/ /g, "_");
    records.push([
      objectId,
      {
        url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(underscored)}?width=260`,
        page: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(underscored)}`,
        license: meta.license,
        ...(meta.artist ? { artist: meta.artist } : {}),
      },
    ]);
  }

  const lines: string[] = [];
  lines.push("/**");
  lines.push(
    " * GENERATED by scripts/src/fetch-depictions.ts, do not hand-edit.",
  );
  lines.push(
    " * Wikimedia Commons depictions (Wikidata P18) for OTB objects with",
  );
  lines.push(
    " * curated QIDs; url is the Commons thumbnail redirect, page the file",
  );
  lines.push(
    " * page (attribution), license/artist from Commons extmetadata.",
  );
  lines.push(
    " * Regenerate: pnpm --filter @workspace/scripts run fetch-depictions",
  );
  lines.push(" */");
  lines.push("export interface OtbDepiction {");
  lines.push("  url: string;");
  lines.push("  page: string;");
  lines.push("  license: string;");
  lines.push("  artist?: string;");
  lines.push("}");
  lines.push("");
  lines.push(
    "export const OTB_DEPICTIONS: Record<string, OtbDepiction> = {",
  );
  for (const [id, rec] of records) {
    const fields = Object.entries(rec)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join(", ");
    lines.push(`  ${JSON.stringify(id)}: { ${fields} },`);
  }
  lines.push("};");
  lines.push("");
  writeFileSync(OUT, lines.join("\n"));
  console.log(`Wrote ${records.length} depictions to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
