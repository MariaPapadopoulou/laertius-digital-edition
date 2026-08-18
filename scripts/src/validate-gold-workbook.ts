/**
 * validate-gold-workbook — repeatable validation of the v0.5 gold annotation
 * workbook (200 bilingual questions + qrels + deposit sheets) against the
 * corpus and the knowledge graph, BEFORE ingestion (which is a separate task).
 *
 * Checks (each reports a positive match count so a green run is never vacuous):
 *  1. CTS resolution — every gold_passages / full_cts_urn token in
 *     Gold_Questions, Qrels and CTS_Map resolves to a real corpus section
 *     (artifacts/api-server/data/laertius_sections.jsonl via corpus.ts), and
 *     each passage token ("1.99", "2.103-104") agrees with its paired URN.
 *  2. Qrels ↔ Gold_Questions — every qrel row points at an existing question,
 *     repeats its must_abstain / expected_action verbatim, and its passage is
 *     one of the question's gold passages; every passage-bearing question is
 *     covered by at least one qrel.
 *  3. CTS_Map coverage — every (question, passage) pair appears in CTS_Map and
 *     vice versa; start/end section ids exist in the corpus.
 *  4. gold_assertions — every claim URL resolves to a real claim page
 *     (kg-claims.ts ids under /claim/<id>).
 *  5. gold_entities / gold_authorities — every label exists in the KG /
 *     gazetteer universe (KG nodes, corpus chapter subjects, places, schools,
 *     cited sources, D.L. himself).
 *  6. Splits and taxonomy pins — split sizes 140/30/30 and expected_action
 *     counts 175/10/8/7 (answer / abstain_out_of_corpus / correct_false_premise
 *     / request_clarification), per the workbook's own Summary sheet.
 *  7. Abstention internal consistency — must_abstain=1 ⇔ non-answer action,
 *     abstain_type matches the action, out-of-corpus rows carry no passage,
 *     false-premise rows carry passage + claim URL.
 *  8. Philosopher_QIDs / KG_Nodes / KG_Edges — exact-name rows must agree with
 *     PHILOSOPHER_META QIDs and movements; the node roster must equal the KG's
 *     82 philosophers; edges must exist in KG_EDGES.
 *  9. Place_IDs — on exact label match against the curated place tables,
 *     Wikidata QID, Pleiades id and coordinates must agree.
 *
 * Discrepancies that are REAL, verified defects of the workbook itself are
 * frozen in KNOWN_DISCREPANCIES (they are the deliverable of the validation
 * report and are fixed at ingestion time, tracked separately). The gate fails
 * on any NEW discrepancy and on any frozen one that silently disappears.
 *
 * A human-readable report is (re)written deterministically to
 * artifacts/api-server/data/eval/gold/gold-workbook-v0.5-validation-report.md.
 *
 * Positive controls: the checker re-runs against deliberately corrupted
 * in-memory copies of the workbook (bogus URN, mismatched qrel, fake claim
 * URL, flipped split, altered QID, flipped must_abstain) and must flag each.
 *
 * Run: pnpm --filter @workspace/scripts run validate-gold-workbook
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseWorkbook,
  splitList,
  type Row,
  type Workbook,
} from "./lib/gold-workbook-xlsx";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

// api-server modules resolve data paths against LAERTIUS_DATA_DIR — pin it
// before importing them (scripts run with a different cwd).
process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  repoRoot,
  "artifacts",
  "api-server",
  "data",
);

const { sectionById } = await import(
  "../../artifacts/api-server/src/lib/corpus"
);
const { getClaims } = await import(
  "../../artifacts/api-server/src/lib/kg-claims"
);
const { getKnowledgeGraph, PHILOSOPHER_META, MOVEMENTS, KG_EDGES } =
  await import("../../artifacts/api-server/src/lib/kg");
const { PLACE_COORDS } = await import(
  "../../artifacts/api-server/src/lib/place-coords"
);
const { PLACE_QIDS, ENTITY_QIDS } = await import(
  "../../artifacts/api-server/src/lib/entity-links"
);
const { PLACE_PLEIADES } = await import(
  "../../artifacts/api-server/src/lib/place-pleiades"
);

const XLSX_PATH = path.join(
  repoRoot,
  "attached_assets",
  "Laertius_Gold_Annotation_200_CTS_Validated_v0.5_(1)_1785993098335.xlsx",
);
const REPORT_PATH = path.join(
  repoRoot,
  "artifacts",
  "api-server",
  "data",
  "eval",
  "gold",
  "gold-workbook-v0.5-validation-report.md",
);
const DL_SOURCES = path.join(
  repoRoot,
  "artifacts",
  "api-server",
  "data",
  "dl_sources.jsonl",
);

const URN_PREFIX = "urn:cts:greekLit:tlg0004.tlg001.perseus-grc2:";
const CLAIM_URL_PREFIX = "https://laertius.humanisticadigitalia.eu/claim/";

/** Expected pins from the workbook's Summary sheet / task brief. */
const EXPECTED_SPLITS: Record<string, number> = { train: 140, dev: 30, test: 30 };
const EXPECTED_ACTIONS: Record<string, number> = {
  answer: 175,
  abstain_out_of_corpus: 10,
  correct_false_premise: 8,
  request_clarification: 7,
};
const ABSTAIN_TYPE_FOR_ACTION: Record<string, string> = {
  abstain_out_of_corpus: "out_of_corpus",
  correct_false_premise: "false_premise",
  request_clarification: "underspecified_homonym",
};

/**
 * Verified, frozen defects of the v0.5 workbook (the validation report's
 * findings, to be repaired at ingestion). Every entry must still be produced
 * by the checks; anything new fails the gate. Populated after the first
 * validated run — see the report for row-level detail.
 */
const KNOWN_DISCREPANCIES: string[] = [
  // false-premise-12 is the one correction row shipped without a gold
  // passage (Summary sheet: "passage assignment for 38 negative/aggregate
  // records remain required" — this is the only correction among them).
  "Gold_Questions false-premise-12: false-premise correction lacks a gold passage",
  // Editorial citations pasted into the entity/authority columns instead of
  // names (quotation-014 cites Meineke's fragment number, quotation-019 the
  // Iliad line for a Homer quote).
  'Gold_Questions quotation-014: unknown authority "Meineke. C.G.F. iv. 618."',
  'Gold_Questions quotation-014: unknown entity "Meineke. C.G.F. iv. 618."',
  'Gold_Questions quotation-019: unknown authority "Il. i. 81, 82."',
  'Gold_Questions quotation-019: unknown entity "Il. i. 81, 82."',
  // teacher-student-016 lists 5 passages but 6 URNs; from the second token on
  // the passage column is shifted one URN to the right (7.166 has no passage,
  // 7.179 has no URN) — the classic off-by-one alignment defect.
  "Gold_Questions teacher-student-016: 5 gold_passages vs 6 full_cts_urn tokens",
  'Gold_Questions teacher-student-016: passage "7.168" ≠ URN public ref "7.166"',
  'Gold_Questions teacher-student-016: passage "7.177" ≠ URN public ref "7.168"',
  'Gold_Questions teacher-student-016: passage "7.179" ≠ URN public ref "7.177"',
];

// ---------------------------------------------------------------------------
// Reference universe (corpus + KG + gazetteer + sources index)
// ---------------------------------------------------------------------------
interface Refs {
  sectionIds: Set<string>;
  /** section id → public passage ref ("1.7.99" → "1.99") */
  publicRefOf: Map<string, string>;
  claimIds: Set<string>;
  entityLabels: Set<string>;
  philosopherMeta: Record<string, { qid?: string; movement: string }>;
  kgNodeNames: Set<string>;
  kgEdgeKeys: Set<string>;
  placeQids: Record<string, string>;
  placePleiades: Record<string, string>;
  placeCoords: Record<string, { lat: number; lon: number }>;
}

function buildRefs(): Refs {
  const sectionIds = new Set<string>();
  const publicRefOf = new Map<string, string>();
  for (const [id, sec] of sectionById) {
    sectionIds.add(id);
    publicRefOf.set(id, `${sec.book}.${sec.section}`);
  }
  const kg = getKnowledgeGraph();
  const kgNodeNames = new Set<string>(kg.nodes.map((n) => n.name));
  const kgEdgeKeys = new Set<string>(
    KG_EDGES.map((e) => `${e.from}|${e.type}|${e.to}`),
  );
  const entityLabels = new Set<string>([
    ...kgNodeNames,
    ...Object.keys(PHILOSOPHER_META),
    ...Object.keys(PLACE_COORDS),
    ...Object.keys(ENTITY_QIDS),
    ...MOVEMENTS.map((m) => m.label),
    "Diogenes Laertius",
  ]);
  // Cited authorities (dl_sources.jsonl English names).
  for (const line of readFileSync(DL_SOURCES, "utf8").trim().split("\n")) {
    const rec = JSON.parse(line) as { nameEn: string | null };
    if (rec.nameEn) entityLabels.add(rec.nameEn);
  }
  // Bare heads of qualified reference names ("Zeno of Citium" → "Zeno": the
  // homonym questions cite the ambiguous bare name on purpose).
  for (const n of [...entityLabels]) {
    const bare = bareHead(n);
    if (bare) entityLabels.add(bare);
  }
  const meta: Refs["philosopherMeta"] = {};
  for (const [name, m] of Object.entries(PHILOSOPHER_META)) {
    meta[name] = { ...(m.qid ? { qid: m.qid } : {}), movement: m.movement };
  }
  return {
    sectionIds,
    publicRefOf,
    claimIds: new Set(getClaims().map((c) => c.id)),
    entityLabels,
    philosopherMeta: meta,
    kgNodeNames,
    kgEdgeKeys,
    placeQids: PLACE_QIDS,
    placePleiades: PLACE_PLEIADES,
    placeCoords: Object.fromEntries(
      Object.entries(PLACE_COORDS).map(([k, v]) => [
        k,
        { lat: v.lat, lon: v.lon },
      ]),
    ),
  };
}

// ---------------------------------------------------------------------------
// Checking
// ---------------------------------------------------------------------------
interface CheckResult {
  discrepancies: string[];
  counts: Record<string, number>;
}

/** Head of a qualified label: "Bias of Priene" → "Bias". */
const bareHead = (s: string): string =>
  s.split(/\s+of\s+|\s+the\s+|\s*\(/)[0]?.trim() ?? "";

/** URN ref part → list of section ids ("2.9.103-2.9.104" expands nothing —
 *  both endpoints are checked; interior ids share the chapter). */
function urnEndpoints(urn: string): { ok: boolean; ids: string[] } {
  if (!urn.startsWith(URN_PREFIX)) return { ok: false, ids: [] };
  const ref = urn.slice(URN_PREFIX.length);
  const parts = ref.split("-").map((p) => p.trim());
  if (parts.length > 2 || parts.some((p) => !p)) return { ok: false, ids: [] };
  return { ok: true, ids: parts };
}

/** Expected public passage token for a URN (single or range). */
function expectedPassage(
  urn: string,
  refs: Refs,
): string | undefined {
  const { ok, ids } = urnEndpoints(urn);
  if (!ok) return undefined;
  const pubs = ids.map((id) => refs.publicRefOf.get(id));
  if (pubs.some((p) => !p)) return undefined;
  if (pubs.length === 1) return pubs[0];
  const [a, b] = pubs as [string, string];
  const [bookA] = a.split(".");
  const [bookB, secB] = b.split(".");
  return bookA === bookB ? `${a}-${secB}` : `${a}-${b}`;
}

function checkWorkbook(wb: Workbook, refs: Refs): CheckResult {
  const d: string[] = [];
  const counts: Record<string, number> = {};
  const bump = (k: string, n = 1): void => {
    counts[k] = (counts[k] ?? 0) + n;
  };

  for (const name of [
    "Gold_Questions",
    "Qrels",
    "CTS_Map",
    "Philosopher_QIDs",
    "KG_Nodes",
    "KG_Edges",
    "Place_IDs",
  ]) {
    if ((wb.sheets[name] ?? []).length === 0) {
      d.push(`${name} sheet missing or empty`);
    }
  }
  const questions = wb.sheets["Gold_Questions"] ?? [];
  const qrels = wb.sheets["Qrels"] ?? [];
  const ctsMap = wb.sheets["CTS_Map"] ?? [];

  const byId = new Map<string, Row>();
  for (const q of questions) {
    const id = q["question_id"] ?? "";
    if (!id) {
      d.push("Gold_Questions: row with empty question_id");
      continue;
    }
    if (byId.has(id)) d.push(`Gold_Questions ${id}: duplicate question_id`);
    byId.set(id, q);
  }

  // -- 1. CTS resolution + passage/URN pairing on Gold_Questions ------------
  const passagePairs = new Map<string, Set<string>>(); // qid → passage tokens
  for (const q of questions) {
    const id = q["question_id"] ?? "?";
    const passages = splitList(q["gold_passages"] ?? "");
    const urns = splitList(q["full_cts_urn"] ?? "");
    passagePairs.set(id, new Set(passages));
    if (passages.length !== urns.length) {
      d.push(
        `Gold_Questions ${id}: ${passages.length} gold_passages vs ${urns.length} full_cts_urn tokens`,
      );
    }
    urns.forEach((urn, i) => {
      const { ok, ids } = urnEndpoints(urn);
      if (!ok) {
        d.push(`Gold_Questions ${id}: malformed URN "${urn}"`);
        return;
      }
      for (const sid of ids) {
        if (!refs.sectionIds.has(sid)) {
          d.push(`Gold_Questions ${id}: URN section "${sid}" not in corpus`);
          return;
        }
      }
      bump("urns resolved (Gold_Questions)");
      const expect = expectedPassage(urn, refs);
      const got = passages[i];
      if (expect && got && expect !== got) {
        d.push(
          `Gold_Questions ${id}: passage "${got}" ≠ URN public ref "${expect}"`,
        );
      } else if (expect && got) {
        bump("passage/URN pairs agreeing");
      }
    });
  }

  // -- 2. Qrels ↔ Gold_Questions --------------------------------------------
  const qrelQids = new Set<string>();
  const qrelPassages = new Map<string, Set<string>>();
  for (const r of qrels) {
    const id = r["question_id"] ?? "?";
    qrelQids.add(id);
    const q = byId.get(id);
    if (!q) {
      d.push(`Qrels ${id}: unknown question_id`);
      continue;
    }
    bump("qrels linked to questions");
    for (const f of ["must_abstain", "expected_action"] as const) {
      if ((r[f] ?? "") !== (q[f] ?? "")) {
        d.push(`Qrels ${id}: ${f} "${r[f]}" ≠ question's "${q[f]}"`);
      }
    }
    const rel = r["relevance"] ?? "";
    if (rel && !/^[0123]$/.test(rel)) {
      d.push(`Qrels ${id}: relevance "${rel}" not in 0..3`);
    }
    const gp = r["gold_passage"] ?? "";
    if (!gp && (byId.get(id)?.["gold_passages"] ?? "") !== "") {
      d.push(`Qrels ${id}: blank gold_passage although the question has gold passages`);
    }
    if (gp) {
      (qrelPassages.get(id) ?? qrelPassages.set(id, new Set()).get(id))?.add(gp);
      if (!passagePairs.get(id)?.has(gp)) {
        d.push(`Qrels ${id}: passage "${gp}" not among the question's gold_passages`);
      } else {
        bump("qrel passages matching question");
      }
      const urn = r["full_cts_urn"] ?? "";
      if (urn) {
        const expect = expectedPassage(urn, refs);
        if (!expect) d.push(`Qrels ${id}: URN "${urn}" does not resolve in corpus`);
        else if (expect !== gp) {
          d.push(`Qrels ${id}: passage "${gp}" ≠ URN public ref "${expect}"`);
        } else bump("urns resolved (Qrels)");
      }
    }
  }
  for (const [id, q] of byId) {
    if ((q["gold_passages"] ?? "") !== "" && !qrelQids.has(id)) {
      d.push(`Gold_Questions ${id}: has gold passages but no qrel row`);
      continue;
    }
    // Per-passage coverage: every gold passage must be judged by some qrel.
    for (const gp of passagePairs.get(id) ?? []) {
      if (qrelPassages.get(id)?.has(gp)) bump("question passages covered by qrels");
      else d.push(`Qrels missing row for ${id} passage "${gp}"`);
    }
  }

  // -- 3. CTS_Map coverage ----------------------------------------------------
  const mapPairs = new Set<string>();
  for (const m of ctsMap) {
    const id = m["question_id"] ?? "?";
    const gp = m["gold_passage"] ?? "";
    mapPairs.add(`${id}|${gp}`);
    if (!byId.has(id)) {
      d.push(`CTS_Map ${id}: unknown question_id`);
      continue;
    }
    if (!gp && (byId.get(id)?.["gold_passages"] ?? "") !== "") {
      d.push(`CTS_Map ${id}: blank gold_passage although the question has gold passages`);
    }
    for (const f of ["start_section_id", "end_section_id"] as const) {
      const sid = m[f] ?? "";
      if (sid && !refs.sectionIds.has(sid)) {
        d.push(`CTS_Map ${id}: ${f} "${sid}" not in corpus`);
      } else if (sid) bump("CTS_Map section ids resolved");
    }
    if (gp && !passagePairs.get(id)?.has(gp)) {
      d.push(`CTS_Map ${id}: passage "${gp}" not among the question's gold_passages`);
    }
  }
  for (const [id, set] of passagePairs) {
    for (const gp of set) {
      if (mapPairs.has(`${id}|${gp}`)) bump("question passages covered by CTS_Map");
      else d.push(`CTS_Map missing row for ${id} passage "${gp}"`);
    }
  }

  // -- 4. gold_assertions claim URLs ----------------------------------------
  for (const q of questions) {
    const id = q["question_id"] ?? "?";
    for (const url of splitList(q["gold_assertions"] ?? "")) {
      if (!url.startsWith(CLAIM_URL_PREFIX)) {
        d.push(`Gold_Questions ${id}: assertion URL "${url}" not a claim page URL`);
        continue;
      }
      const slug = url.slice(CLAIM_URL_PREFIX.length).replace(/\/+$/, "");
      if (refs.claimIds.has(slug)) bump("claim URLs resolved");
      else d.push(`Gold_Questions ${id}: unknown claim "${slug}"`);
    }
  }

  // -- 5. gold_entities / gold_authorities -----------------------------------
  for (const q of questions) {
    const id = q["question_id"] ?? "?";
    for (const [field, label] of [
      ["gold_entities", "entity"],
      ["gold_authorities", "authority"],
    ] as const) {
      for (const name of splitList(q[field] ?? "")) {
        // Full label first, then its bare head ("Bias of Priene" → "Bias",
        // "Epicurus (letter …)" → "Epicurus") against the same universe.
        if (refs.entityLabels.has(name) || refs.entityLabels.has(bareHead(name)))
          bump(`${label} labels resolved`);
        else d.push(`Gold_Questions ${id}: unknown ${label} "${name}"`);
      }
    }
  }

  // -- 6. splits + taxonomy pins ---------------------------------------------
  const splitCounts: Record<string, number> = {};
  const actionCounts: Record<string, number> = {};
  for (const q of questions) {
    splitCounts[q["split"] ?? ""] = (splitCounts[q["split"] ?? ""] ?? 0) + 1;
    const a = q["expected_action"] ?? "";
    actionCounts[a] = (actionCounts[a] ?? 0) + 1;
  }
  for (const [k, want] of Object.entries(EXPECTED_SPLITS)) {
    const got = splitCounts[k] ?? 0;
    if (got !== want) d.push(`split "${k}": ${got} questions, expected ${want}`);
    else bump("split pins matched");
  }
  for (const k of Object.keys(splitCounts)) {
    if (!(k in EXPECTED_SPLITS)) d.push(`unexpected split value "${k}"`);
  }
  for (const [k, want] of Object.entries(EXPECTED_ACTIONS)) {
    const got = actionCounts[k] ?? 0;
    if (got !== want) d.push(`expected_action "${k}": ${got} rows, expected ${want}`);
    else bump("expected_action pins matched");
  }
  for (const k of Object.keys(actionCounts)) {
    if (!(k in EXPECTED_ACTIONS)) d.push(`unexpected expected_action "${k}"`);
  }

  // -- 7. abstention internal consistency ------------------------------------
  for (const q of questions) {
    const id = q["question_id"] ?? "?";
    const act = q["expected_action"] ?? "";
    const ma = q["must_abstain"] ?? "";
    const at = q["abstain_type"] ?? "";
    const wantMa = act === "answer" ? "0" : "1";
    if (ma !== wantMa) {
      d.push(`Gold_Questions ${id}: must_abstain "${ma}" inconsistent with action "${act}"`);
    } else bump("must_abstain consistent");
    const wantAt = ABSTAIN_TYPE_FOR_ACTION[act] ?? "";
    if (at !== wantAt) {
      d.push(`Gold_Questions ${id}: abstain_type "${at}" inconsistent with action "${act}" (expected "${wantAt || "(empty)"}")`);
    } else if (act !== "answer") bump("abstain_type consistent");
    if (act === "abstain_out_of_corpus" && (q["gold_passages"] ?? "") !== "") {
      d.push(`Gold_Questions ${id}: out-of-corpus abstention carries gold passages`);
    }
    if (act === "correct_false_premise") {
      if ((q["gold_passages"] ?? "") === "")
        d.push(`Gold_Questions ${id}: false-premise correction lacks a gold passage`);
      if ((q["gold_assertions"] ?? "") === "")
        d.push(`Gold_Questions ${id}: false-premise correction lacks a claim URL`);
    }
  }

  // -- 8. Philosopher_QIDs / KG_Nodes / KG_Edges ------------------------------
  const qidRows = wb.sheets["Philosopher_QIDs"] ?? [];
  const nodeRows = wb.sheets["KG_Nodes"] ?? [];
  const edgeRows = wb.sheets["KG_Edges"] ?? [];
  const sheetNames = new Set<string>();
  for (const r of qidRows) {
    const name = r["name"] ?? "?";
    if (sheetNames.has(name)) d.push(`Philosopher_QIDs "${name}": duplicate row`);
    sheetNames.add(name);
    const meta = refs.philosopherMeta[name];
    if (!meta) {
      d.push(`Philosopher_QIDs "${name}": not a KG philosopher`);
      continue;
    }
    if (meta.qid && meta.qid !== (r["wikidata_qid"] ?? "")) {
      d.push(`Philosopher_QIDs "${name}": QID ${r["wikidata_qid"]} ≠ KG ${meta.qid}`);
    } else bump("philosopher QIDs matched");
    if ((r["movement"] ?? "") !== meta.movement) {
      d.push(`Philosopher_QIDs "${name}": movement "${r["movement"]}" ≠ KG "${meta.movement}"`);
    }
  }
  for (const name of refs.kgNodeNames) {
    if (!sheetNames.has(name)) d.push(`Philosopher_QIDs missing KG philosopher "${name}"`);
  }
  const nodeNames = new Set<string>();
  for (const r of nodeRows) {
    const name = r["name"] ?? "?";
    if (nodeNames.has(name)) d.push(`KG_Nodes "${name}": duplicate row`);
    nodeNames.add(name);
    if (!refs.kgNodeNames.has(name)) d.push(`KG_Nodes "${name}": not a KG philosopher`);
    else bump("KG_Nodes names matched");
  }
  for (const name of refs.kgNodeNames) {
    if (!nodeNames.has(name)) d.push(`KG_Nodes missing KG philosopher "${name}"`);
  }
  const edgeKeys = new Set<string>();
  for (const r of edgeRows) {
    const key = `${r["from"]}|${r["relation"]}|${r["to"]}`;
    if (edgeKeys.has(key)) d.push(`KG_Edges "${key}": duplicate row`);
    edgeKeys.add(key);
    if (refs.kgEdgeKeys.has(key)) bump("KG_Edges matched");
    else d.push(`KG_Edges "${key}": not in the KG edge set`);
  }
  for (const key of refs.kgEdgeKeys) {
    if (!edgeKeys.has(key)) d.push(`KG_Edges missing KG edge "${key}"`);
  }

  // -- 9. Place_IDs (exact label match) ---------------------------------------
  const placeNames = new Set<string>();
  for (const r of wb.sheets["Place_IDs"] ?? []) {
    const place = r["place"] ?? "?";
    if (placeNames.has(place)) d.push(`Place_IDs "${place}": duplicate row`);
    placeNames.add(place);
    const qid = refs.placeQids[place];
    const pleiades = refs.placePleiades[place];
    const coord = refs.placeCoords[place];
    if (qid === undefined && pleiades === undefined && coord === undefined) {
      bump("Place_IDs outside curated gazetteer (informational)");
      continue;
    }
    if (qid !== undefined) {
      if (qid === (r["wikidata_qid"] ?? "")) bump("place QIDs matched");
      else d.push(`Place_IDs "${place}": QID ${r["wikidata_qid"]} ≠ curated ${qid}`);
    }
    if (pleiades !== undefined) {
      if (pleiades === (r["pleiades_id"] ?? "")) bump("place Pleiades ids matched");
      else d.push(`Place_IDs "${place}": Pleiades ${r["pleiades_id"]} ≠ curated ${pleiades}`);
    }
    if (coord !== undefined && r["lat"] && r["lon"]) {
      const dLat = Math.abs(Number(r["lat"]) - coord.lat);
      const dLon = Math.abs(Number(r["lon"]) - coord.lon);
      if (dLat <= 0.25 && dLon <= 0.25) bump("place coordinates matched");
      else d.push(`Place_IDs "${place}": coords (${r["lat"]},${r["lon"]}) far from curated (${coord.lat},${coord.lon})`);
    }
  }

  return { discrepancies: d.sort(), counts };
}

// ---------------------------------------------------------------------------
// Positive controls: corrupt copies must be flagged
// ---------------------------------------------------------------------------
function cloneWb(wb: Workbook): Workbook {
  return structuredClone(wb);
}

function runControls(wb: Workbook, refs: Refs): string[] {
  const failures: string[] = [];
  const base = new Set(checkWorkbook(wb, refs).discrepancies);
  const expectNew = (label: string, mutate: (c: Workbook) => void, needle: RegExp): void => {
    const c = cloneWb(wb);
    mutate(c);
    const got = checkWorkbook(c, refs).discrepancies.filter((x) => !base.has(x));
    if (!got.some((x) => needle.test(x))) {
      failures.push(`control "${label}" not flagged (new discrepancies: ${got.join(" | ") || "none"})`);
    }
  };
  const q0 = (c: Workbook): Row => {
    const q = (c.sheets["Gold_Questions"] ?? []).find(
      (r) => (r["gold_passages"] ?? "") !== "" && (r["expected_action"] ?? "") === "answer",
    );
    if (!q) throw new Error("control setup: no answer row with passages");
    return q;
  };
  expectNew("bogus URN", (c) => {
    q0(c)["full_cts_urn"] = `${URN_PREFIX}99.99.99`;
  }, /not in corpus|gold_passages vs/);
  expectNew("qrel action mismatch", (c) => {
    const r = (c.sheets["Qrels"] ?? [])[0];
    if (r) r["expected_action"] = "abstain_out_of_corpus";
  }, /Qrels .*expected_action/);
  expectNew("fake claim URL", (c) => {
    q0(c)["gold_assertions"] = `${CLAIM_URL_PREFIX}no-such-claim-xyz`;
  }, /unknown claim "no-such-claim-xyz"/);
  expectNew("flipped split", (c) => {
    const r = (c.sheets["Gold_Questions"] ?? []).find((x) => x["split"] === "train");
    if (r) r["split"] = "test";
  }, /split "train"|split "test"/);
  expectNew("altered philosopher QID", (c) => {
    const r = (c.sheets["Philosopher_QIDs"] ?? []).find(
      (x) => refs.philosopherMeta[x["name"] ?? ""]?.qid,
    );
    if (r) r["wikidata_qid"] = "Q1";
  }, /Philosopher_QIDs .*QID Q1/);
  expectNew("flipped must_abstain", (c) => {
    q0(c)["must_abstain"] = "1";
  }, /must_abstain "1" inconsistent/);
  expectNew("unknown entity", (c) => {
    q0(c)["gold_entities"] = "Zorbatheus of Nowhere";
  }, /unknown entity "Zorbatheus of Nowhere"/);
  expectNew("deleted KG_Nodes sheet", (c) => {
    delete c.sheets["KG_Nodes"];
  }, /KG_Nodes sheet missing or empty|KG_Nodes missing KG philosopher/);
  expectNew("dropped philosopher row", (c) => {
    (c.sheets["Philosopher_QIDs"] ?? []).shift();
  }, /Philosopher_QIDs missing KG philosopher/);
  expectNew("dropped KG edge row", (c) => {
    (c.sheets["KG_Edges"] ?? []).shift();
  }, /KG_Edges missing KG edge/);
  expectNew("blanked qrel passage", (c) => {
    const r = (c.sheets["Qrels"] ?? []).find((x) => (x["gold_passage"] ?? "") !== "");
    if (r) r["gold_passage"] = "";
  }, /Qrels .*blank gold_passage|Qrels missing row/);
  expectNew("duplicated place row", (c) => {
    const rows = c.sheets["Place_IDs"] ?? [];
    if (rows[0]) rows.push({ ...rows[0] });
  }, /Place_IDs .*duplicate row/);
  return failures;
}

// ---------------------------------------------------------------------------
// Report + main
// ---------------------------------------------------------------------------
function writeReport(result: CheckResult, known: Set<string>): void {
  const lines: string[] = [
    "# Gold workbook v0.5 — corpus & KG validation report",
    "",
    "Source: `attached_assets/Laertius_Gold_Annotation_200_CTS_Validated_v0.5_(1)_1785993098335.xlsx`",
    "Generated deterministically by `scripts/src/validate-gold-workbook.ts` (re-run to refresh).",
    "",
    "## Check coverage (positive counts — a green run is never vacuous)",
    "",
    ...Object.entries(result.counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `- ${k}: **${v}**`),
    "",
    `## Discrepancies (${result.discrepancies.length})`,
    "",
  ];
  if (result.discrepancies.length === 0) {
    lines.push("None — the workbook is fully consistent with the corpus and KG.");
  } else {
    for (const x of result.discrepancies) {
      lines.push(`- ${known.has(x) ? "[known] " : "[NEW] "}${x}`);
    }
  }
  lines.push("");
  writeFileSync(REPORT_PATH, lines.join("\n"));
}

function main(): number {
  const wb = parseWorkbook(XLSX_PATH);
  const refs = buildRefs();
  const result = checkWorkbook(wb, refs);
  const known = new Set(KNOWN_DISCREPANCIES);
  writeReport(result, known);

  let failures = 0;
  const fresh = result.discrepancies.filter((x) => !known.has(x));
  const gone = KNOWN_DISCREPANCIES.filter(
    (x) => !result.discrepancies.includes(x),
  );
  for (const x of fresh) {
    console.error(`NEW discrepancy: ${x}`);
    failures++;
  }
  for (const x of gone) {
    console.error(`Frozen discrepancy no longer produced (update KNOWN_DISCREPANCIES): ${x}`);
    failures++;
  }

  // Non-vacuity: every check family must have matched something real.
  for (const key of [
    "urns resolved (Gold_Questions)",
    "urns resolved (Qrels)",
    "passage/URN pairs agreeing",
    "qrels linked to questions",
    "question passages covered by CTS_Map",
    "CTS_Map section ids resolved",
    "claim URLs resolved",
    "entity labels resolved",
    "authority labels resolved",
    "split pins matched",
    "expected_action pins matched",
    "must_abstain consistent",
    "abstain_type consistent",
    "philosopher QIDs matched",
    "KG_Nodes names matched",
    "KG_Edges matched",
    "place QIDs matched",
    "place Pleiades ids matched",
    "place coordinates matched",
  ]) {
    if (!(result.counts[key] ?? 0)) {
      console.error(`vacuous check: "${key}" matched nothing`);
      failures++;
    }
  }

  for (const f of runControls(wb, refs)) {
    console.error(`positive control failed: ${f}`);
    failures++;
  }

  console.log("--- validate-gold-workbook ---");
  for (const [k, v] of Object.entries(result.counts).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    console.log(`  ${k}: ${v}`);
  }
  console.log(
    `  discrepancies: ${result.discrepancies.length} (${fresh.length} new, ${known.size} frozen)`,
  );
  console.log(`  report: ${path.relative(repoRoot, REPORT_PATH)}`);
  if (failures > 0) {
    console.error(`validate-gold-workbook: FAIL (${failures} problem(s))`);
    return 1;
  }
  console.log("validate-gold-workbook: OK");
  return 0;
}

process.exit(main());
