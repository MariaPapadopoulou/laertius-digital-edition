/**
 * ingest-gold-workbook — converts the validated v0.5 gold annotation workbook
 * into the OFFICIAL gold question set:
 *
 *   artifacts/api-server/data/eval/gold/gold-topics-v0.5.jsonl  (200 questions)
 *   artifacts/api-server/data/eval/gold/gold-qrels-v0.5.jsonl   (239 qrels)
 *   artifacts/api-server/data/eval/gold/CURRENT_VERSION          (→ 0.5)
 *
 * The 9 frozen workbook defects (KNOWN_DISCREPANCIES in
 * validate-gold-workbook.ts — the workbook itself is left untouched as the
 * archival source) are REPAIRED here during conversion:
 *   - teacher-student-016: the gold_passages column is off-by-one against
 *     full_cts_urn from the 2nd token on (5 passages vs 6 URNs). The URNs are
 *     CTS-validated, so passages are rebuilt from the URNs' public refs.
 *   - false-premise-12: the only correction row shipped without a gold
 *     passage. Its gold assertion (claim archelaus-teacher-anaxagoras) is
 *     asserted at D.L. 2.16; passage + URN are filled from the corpus and the
 *     blank qrel row is completed (relevance 3, like every other correction).
 *   - quotation-014 / quotation-019: editorial citations ("Meineke. C.G.F.
 *     iv. 618.", "Il. i. 81, 82.") were pasted into gold_entities /
 *     gold_authorities; they are citations, not entities, and are dropped.
 *
 * abstain_type mapping (expected_action → abstain_type):
 *   abstain_out_of_corpus → out_of_corpus
 *   correct_false_premise → false_premise
 *   request_clarification → underspecified_homonym
 *
 * Every output string is NFC-normalized. The script asserts the workbook
 * pins (200 questions, 239 qrels, splits 140/30/30, actions 175/10/8/7),
 * that every emitted passage token equals its URN's public corpus ref, and
 * that no repair target is left unrepaired — any violation aborts without
 * writing files.
 *
 * Run: pnpm --filter @workspace/scripts run ingest-gold-workbook
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseWorkbook, splitList, type Row } from "./lib/gold-workbook-xlsx";

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

const XLSX_PATH = path.join(
  repoRoot,
  "attached_assets",
  "Laertius_Gold_Annotation_200_CTS_Validated_v0.5_(1)_1785993098335.xlsx",
);
const GOLD_DIR = path.join(
  repoRoot,
  "artifacts",
  "api-server",
  "data",
  "eval",
  "gold",
);
const VERSION = "0.5";
const TOPICS_OUT = path.join(GOLD_DIR, `gold-topics-v${VERSION}.jsonl`);
const QRELS_OUT = path.join(GOLD_DIR, `gold-qrels-v${VERSION}.jsonl`);
const VERSION_OUT = path.join(GOLD_DIR, "CURRENT_VERSION");

const URN_PREFIX = "urn:cts:greekLit:tlg0004.tlg001.perseus-grc2:";

const ABSTAIN_TYPE_FOR_ACTION: Record<string, string> = {
  abstain_out_of_corpus: "out_of_corpus",
  correct_false_premise: "false_premise",
  request_clarification: "underspecified_homonym",
};

const EXPECTED_SPLITS: Record<string, number> = { train: 140, dev: 30, test: 30 };
const EXPECTED_ACTIONS: Record<string, number> = {
  answer: 175,
  abstain_out_of_corpus: 10,
  correct_false_premise: 8,
  request_clarification: 7,
};

/** Editorial citations wrongly pasted as entities/authorities (frozen defects). */
const EDITORIAL_CITATIONS: Record<string, string[]> = {
  "quotation-014": ["Meineke. C.G.F. iv. 618."],
  "quotation-019": ["Il. i. 81, 82."],
};

const nfc = (s: string): string => s.normalize("NFC");

const errors: string[] = [];
const fail = (msg: string): void => {
  errors.push(msg);
};

// public ref ("2.16") → section id ("2.4.16"); public ref of section id
const publicRefOf = new Map<string, string>();
const sectionOfPublicRef = new Map<string, string[]>();
for (const [id, sec] of sectionById) {
  const pub = `${sec.book}.${sec.section}`;
  publicRefOf.set(id, pub);
  const list = sectionOfPublicRef.get(pub) ?? [];
  list.push(id);
  sectionOfPublicRef.set(pub, list);
}

/** URN → public passage token (single or range), or undefined. */
function passageOfUrn(urn: string): string | undefined {
  if (!urn.startsWith(URN_PREFIX)) return undefined;
  const parts = urn.slice(URN_PREFIX.length).split("-").map((p) => p.trim());
  if (parts.length > 2 || parts.some((p) => !p)) return undefined;
  const pubs = parts.map((id) => publicRefOf.get(id));
  if (pubs.some((p) => !p)) return undefined;
  if (pubs.length === 1) return pubs[0];
  const [a, b] = pubs as [string, string];
  const [bookA] = a.split(".");
  const [bookB, secB] = b.split(".");
  return bookA === bookB ? `${a}-${secB}` : `${a}-${b}`;
}

const wb = parseWorkbook(XLSX_PATH);
const questions = wb.sheets["Gold_Questions"] ?? [];
const qrels = wb.sheets["Qrels"] ?? [];
if (questions.length !== 200) fail(`Gold_Questions has ${questions.length} rows (expected 200)`);
if (qrels.length !== 239) fail(`Qrels has ${qrels.length} rows (expected 239)`);

/* ------------------------------------------------------------------ */
/* Repairs (applied to in-memory copies; the workbook stays untouched) */
/* ------------------------------------------------------------------ */
const repaired: string[] = [];

const q = new Map<string, Row>();
for (const row of questions) q.set(row["question_id"] ?? "", row);

// 1. teacher-student-016 — rebuild passages from the CTS-validated URNs.
{
  const row = q.get("teacher-student-016");
  if (!row) fail("teacher-student-016 not found");
  else {
    const urns = splitList(row["full_cts_urn"] ?? "");
    const pass = urns.map((u) => passageOfUrn(u));
    if (urns.length !== 6 || pass.some((p) => !p)) {
      fail("teacher-student-016: URNs did not resolve as expected");
    } else {
      row["gold_passages"] = pass.join("; ");
      repaired.push("teacher-student-016 gold_passages realigned to its 6 URNs");
    }
  }
}

// 2. false-premise-12 — fill the missing gold passage from its claim (D.L. 2.16).
const FP12_REF = "2.16";
{
  const row = q.get("false-premise-12");
  const ids = sectionOfPublicRef.get(FP12_REF) ?? [];
  if (!row) fail("false-premise-12 not found");
  else if (ids.length !== 1) fail(`public ref ${FP12_REF} maps to ${ids.length} corpus sections`);
  else {
    row["gold_passages"] = FP12_REF;
    row["full_cts_urn"] = `${URN_PREFIX}${ids[0]}`;
    repaired.push(`false-premise-12 gold passage set to ${FP12_REF} (claim archelaus-teacher-anaxagoras)`);
    const qrel = qrels.find((r) => r["question_id"] === "false-premise-12");
    if (!qrel) fail("false-premise-12 qrel row not found");
    else {
      qrel["gold_passage"] = FP12_REF;
      qrel["full_cts_urn"] = `${URN_PREFIX}${ids[0]}`;
      qrel["relevance"] = "3";
      repaired.push("false-premise-12 qrel completed (passage + URN, relevance 3)");
    }
  }
}

// 3. quotation-014 / quotation-019 — drop editorial citations from
//    gold_entities / gold_authorities.
for (const [qid, citations] of Object.entries(EDITORIAL_CITATIONS)) {
  const row = q.get(qid);
  if (!row) {
    fail(`${qid} not found`);
    continue;
  }
  for (const col of ["gold_entities", "gold_authorities"] as const) {
    const before = splitList(row[col] ?? "");
    const after = before.filter((t) => !citations.includes(t));
    if (before.length === after.length) {
      fail(`${qid}: citation not found in ${col} — workbook changed?`);
    }
    row[col] = after.join("; ");
  }
  repaired.push(`${qid} editorial citation dropped from entities/authorities`);
}

/* ------------------------------------------------------------------ */
/* Conversion + assertions                                             */
/* ------------------------------------------------------------------ */
const splitCounts: Record<string, number> = {};
const actionCounts: Record<string, number> = {};
const topicLines: string[] = [];

for (const row of questions) {
  const id = row["question_id"] ?? "";
  if (!id) {
    fail("question row with empty question_id");
    continue;
  }
  const action = row["expected_action"] ?? "";
  const split = row["split"] ?? "";
  splitCounts[split] = (splitCounts[split] ?? 0) + 1;
  actionCounts[action] = (actionCounts[action] ?? 0) + 1;

  const mustAbstain = (row["must_abstain"] ?? "") === "1";
  const mappedType = ABSTAIN_TYPE_FOR_ACTION[action];
  if (mustAbstain !== (mappedType !== undefined)) {
    fail(`${id}: must_abstain=${row["must_abstain"]} inconsistent with action "${action}"`);
  }
  const wbType = row["abstain_type"] ?? "";
  if (mappedType && wbType && wbType !== mappedType) {
    fail(`${id}: workbook abstain_type "${wbType}" ≠ mapped "${mappedType}"`);
  }

  const passages = splitList(row["gold_passages"] ?? "");
  const urns = splitList(row["full_cts_urn"] ?? "");
  if (passages.length !== urns.length) {
    fail(`${id}: ${passages.length} passages vs ${urns.length} URNs after repair`);
  }
  urns.forEach((urn, i) => {
    const expect = passageOfUrn(urn);
    if (!expect) fail(`${id}: URN "${urn}" does not resolve in corpus`);
    else if (passages[i] !== expect) {
      fail(`${id}: passage "${passages[i]}" ≠ URN public ref "${expect}"`);
    }
  });
  if (action === "abstain_out_of_corpus" && passages.length > 0) {
    fail(`${id}: out-of-corpus row carries a passage`);
  }
  if (action === "correct_false_premise") {
    if (passages.length === 0) fail(`${id}: false-premise row lacks a gold passage`);
    if (!(row["gold_assertions"] ?? "").trim()) fail(`${id}: false-premise row lacks a claim URL`);
  }

  const obj: Record<string, unknown> = {
    topic_id: nfc(id),
    question: nfc(row["question_el"] ?? ""),
    question_lang: "el",
    split: nfc(split),
    question_type: nfc(row["question_type"] ?? ""),
    question_en: nfc(row["question_en"] ?? ""),
    expected_answer: nfc(row["expected_answer"] ?? ""),
    expected_action: nfc(action),
  };
  if (!obj["question"] || !obj["question_en"] || !obj["expected_answer"]) {
    fail(`${id}: blank question/question_en/expected_answer`);
  }
  if (passages.length > 0) {
    obj["gold_passages"] = passages.map(nfc);
    obj["full_cts_urn"] = urns.map(nfc);
  }
  for (const [key, col] of [
    ["gold_assertions", "gold_assertions"],
    ["gold_entities", "gold_entities"],
    ["gold_authorities", "gold_authorities"],
  ] as const) {
    const list = splitList(row[col] ?? "").map(nfc);
    if (list.length > 0) obj[key] = list;
  }
  if (mustAbstain) {
    obj["must_abstain"] = true;
    obj["abstain_type"] = mappedType;
  }
  topicLines.push(JSON.stringify(obj));
}

for (const [k, n] of Object.entries(EXPECTED_SPLITS)) {
  if (splitCounts[k] !== n) fail(`split "${k}": ${splitCounts[k] ?? 0} (expected ${n})`);
}
for (const [k, n] of Object.entries(EXPECTED_ACTIONS)) {
  if (actionCounts[k] !== n) fail(`action "${k}": ${actionCounts[k] ?? 0} (expected ${n})`);
}

const qrelLines: string[] = [];
for (const r of qrels) {
  const id = r["question_id"] ?? "";
  const question = q.get(id);
  if (!question) {
    fail(`qrel for unknown question "${id}"`);
    continue;
  }
  const gp = r["gold_passage"] ?? "";
  const urn = r["full_cts_urn"] ?? "";
  if (gp) {
    const expect = urn ? passageOfUrn(urn) : undefined;
    if (!expect) fail(`qrel ${id}: URN "${urn}" does not resolve`);
    else if (expect !== gp) fail(`qrel ${id}: passage "${gp}" ≠ URN ref "${expect}"`);
    if (!splitList(question["gold_passages"] ?? "").includes(gp)) {
      fail(`qrel ${id}: passage "${gp}" not among the question's gold passages`);
    }
  } else if ((question["gold_passages"] ?? "").trim()) {
    fail(`qrel ${id}: blank passage although the question has gold passages`);
  }
  const rel = r["relevance"] ?? "";
  if (!/^[0123]$/.test(rel)) fail(`qrel ${id}: relevance "${rel}" not in 0..3`);
  // Answerable dataset-aggregate topics (corpus statistics / synthesis)
  // legitimately have no gold passage: their answers are computed from the
  // dataset as a whole, not attested in any single CTS passage. Document
  // that reason on the qrel row so scoring can report them separately
  // instead of silently dropping them from the metric denominators.
  const isAnswer = (r["expected_action"] ?? "") === "answer";
  const isDatasetAggregate = /^(statistics|synthesis)-/.test(id);
  if (!gp && isAnswer && !isDatasetAggregate) {
    fail(`qrel ${id}: answerable topic without gold passage or documented reason`);
  }
  const obj: Record<string, unknown> = {
    topic_id: nfc(id),
    ...(gp ? { gold_passage: nfc(gp), full_cts_urn: nfc(urn) } : {}),
    relevance: Number(rel),
    must_abstain: (r["must_abstain"] ?? "") === "1",
    expected_action: nfc(r["expected_action"] ?? ""),
    ...(!gp && isAnswer && isDatasetAggregate
      ? { no_gold_passage_reason: "dataset_aggregate" }
      : {}),
  };
  qrelLines.push(JSON.stringify(obj));
}

// Every passage-bearing question must be covered by at least one qrel.
const qrelPassages = new Map<string, Set<string>>();
for (const r of qrels) {
  const id = r["question_id"] ?? "";
  const gp = r["gold_passage"] ?? "";
  if (!gp) continue;
  (qrelPassages.get(id) ?? qrelPassages.set(id, new Set()).get(id)!).add(gp);
}
for (const [id, row] of q) {
  for (const gp of splitList(row["gold_passages"] ?? "")) {
    if (!qrelPassages.get(id)?.has(gp)) fail(`no qrel covers ${id} passage "${gp}"`);
  }
}

if (repaired.length < 4) fail(`only ${repaired.length} repairs applied (expected 4 repair sites)`);

if (errors.length > 0) {
  console.error(`ingest-gold-workbook: ${errors.length} error(s) — nothing written:`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

writeFileSync(TOPICS_OUT, topicLines.join("\n") + "\n");
writeFileSync(QRELS_OUT, qrelLines.join("\n") + "\n");
const prev = readFileSync(VERSION_OUT, "utf8").trim();
writeFileSync(VERSION_OUT, VERSION + "\n");

console.log(`Repairs applied:`);
for (const r of repaired) console.log("  - " + r);
console.log(`Wrote ${topicLines.length} topics → ${path.relative(repoRoot, TOPICS_OUT)}`);
console.log(`Wrote ${qrelLines.length} qrels  → ${path.relative(repoRoot, QRELS_OUT)}`);
console.log(`CURRENT_VERSION: ${prev} → ${VERSION}`);

export {};
