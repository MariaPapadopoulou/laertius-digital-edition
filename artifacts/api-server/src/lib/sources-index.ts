/**
 * Sources index: the user-curated workbook of ancient authorities cited in
 * the Lives (529 rows), converted to `data/dl_sources.jsonl` by
 * `scripts/src/parse-sources-xlsx.ts`. Each row is one citation event  - 
 * (cited name, D.L. reference, optionally a work title) - carrying the
 * curator's Greek/English/French name forms, an identification-certainty
 * grade, and (where verified) a Wikidata QID + English Wikipedia title.
 *
 * This module loads the rows and reconciles them against the existing
 * knowledge-graph nodes so lod.ts can attach citation records to the node
 * that already names the same person, instead of minting a duplicate:
 *
 *  1. QID equal to a curated philosopher QID (kg.ts PHILOSOPHER_META)
 *     -> that philosopher node;
 *  2. QID equal to a curated person/source QID (entity-links.ts ENTITY_QIDS)
 *     -> that person or source node (kind decided by which label set the
 *     entity-links label belongs to, mirroring lod.ts);
 *  3. exact label match (case-insensitive, with a trailing " (?)" doubt
 *     marker stripped for matching only) against philosopher, then source,
 *     then person labels;
 *  4. otherwise a new /source/<slug> node is minted for the *cited name*
 *     (never a guessed identification - the certainty grade and the
 *     curator's notes stay on the citation rows).
 *
 * Groups that resolve to the same URI (e.g. the QID-verified "Xanthus of
 * Lydia" rows and the unverified row citing the same name) are merged, so
 * one node collects all its citations. Rows with no cited person at all
 * (anonymous works, thematic entries, and rows the workbook itself labels
 * "Anonymous") are kept as author-less citation records.
 *
 * Deliberately NOT imported by kg/claims/gazetteer: lod.ts is the only
 * consumer, and this module never imports lod.ts (no cycle).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { dataDir } from "./corpus";
import { getKnowledgeGraph, PHILOSOPHER_META, slugify } from "./kg";
import { getClaimEntities, unicodeSlug } from "./kg-claims";
import { ENTITY_QIDS } from "./entity-links";
import { VERSE_AUTHORS } from "./verse-authors";
import { getSayings } from "./sayings";
import { getAnecdotes } from "./anecdotes";

export type SourceCertainty = "certain" | "probable" | "uncertain";

/** One workbook row = one citation event. */
export interface SourceCitationRow {
  /** Stable workbook id, e.g. "DL-SRC-0001". */
  id: string;
  nameGrc: string | null;
  /** null for anonymous-work / thematic rows (no cited person). */
  nameEn: string | null;
  nameFr: string | null;
  description: string | null;
  workGrc: string | null;
  workEn: string | null;
  workFr: string | null;
  /** The reference column as written, e.g. "II 133; VI 38, 95";
   *  null for the few index rows that carry no reference. */
  refRaw: string | null;
  /** Parsed book.section refs (Hicks numbering), e.g. ["2.133", "6.38"]. */
  refs: string[];
  qid: string | null;
  enwiki: string | null;
  externalLinks: string | null;
  /** null when the workbook left the identification ungraded. */
  certainty: SourceCertainty | null;
  notes: string | null;
  /** Set when the converter repaired a corrupted workbook row. */
  corrected: string | null;
}

export type SourceTargetKind = "philosopher" | "person" | "source";

/** A cited authority: one graph node collecting one or more citation rows. */
export interface SourcePersonGroup {
  /** Canonical label; for existing nodes this is the node's own label. */
  label: string;
  kind: SourceTargetKind;
  /** True when the group attaches to a node the graph already has. */
  existing: boolean;
  /** Workbook EN name variants that differ from the canonical label. */
  altLabels: string[];
  nameGrc: string | null;
  nameFr: string | null;
  /** Verified QID (enwiki-derived at curation time); null when unlinked. */
  qid: string | null;
  enwiki: string | null;
  /** Best identification certainty across graded rows; null if none graded. */
  certainty: SourceCertainty | null;
  rows: SourceCitationRow[];
}

export interface SourcesIndex {
  /** All rows, workbook order. */
  rows: SourceCitationRow[];
  /** Cited authorities, merged by target URI, sorted by label. */
  groups: SourcePersonGroup[];
  /** Rows with no cited person: emitted as author-less citations. */
  anonymousRows: SourceCitationRow[];
}

const CERTAINTY_RANK: Record<SourceCertainty, number> = {
  certain: 0,
  probable: 1,
  uncertain: 2,
};

/** Field overrides for a corrupted workbook row (see SOURCE_ROW_CORRECTIONS). */
interface SourceRowCorrection {
  nameEn?: string;
  nameGrc?: string;
  nameFr?: string;
  /** `null` removes a wrongly-attached identifier. */
  qid?: string | null;
  enwiki?: string | null;
  refs?: string[];
  /** Curator's rationale - required, verified at curation time. */
  reason: string;
}

/**
 * Row-id-keyed repairs for workbook rows whose IDENTITY fields are
 * scrambled (as opposed to SOURCE_LABEL_CANON, which is keyed by the
 * workbook primary name and thus cannot distinguish two rows that share
 * one name). The Apollodorus block rows 44–48 suffered an off-by-one
 * shift: the (nameEn, nameGrc) pairs slid one row up relative to the
 * identifying evidence (refs, notes, QIDs), while the French labels
 * mostly stayed on the true identities. Each repair below was verified
 * against the Hicks text, the DK/SVF notes the workbook itself carries,
 * and Wikidata (Q248616 = Apollodorus of Seleucia, the Stoic; Q205704 =
 * Apollodorus of Athens, the chronographer) at curation time (July 2026).
 *
 * Every entry must match an existing row AND change at least one field,
 * or getSourcesIndex() throws - a stale correction means the converter
 * output changed and the curation must be reconciled.
 */
const SOURCE_ROW_CORRECTIONS: Record<string, SourceRowCorrection> = {
  // "Apollodorus (called Ephilos)" - Ephilos/Ephillus is the epithet of
  // the STOIC, Apollodorus of Seleucia (D.L. 7.39 Ἀπολλόδωρος ὁ Ἔφιλλος;
  // SVF III), yet the row carried the chronographer's Q205704 (copied
  // "from row 48 for the same author" per its own comment - the very row
  // the shift displaced). Rehomed to the Stoic; the French label was the
  // chronographer's, shifted up from the next row.
  "DL-SRC-0044": {
    qid: "Q248616",
    enwiki: "Apollodorus of Seleucia",
    nameFr: "Apollodore de Séleucie",
    reason:
      "Ephilos = Apollodorus of Seleucia (7.39), not the chronographer; Q205704 was copied from the shifted neighbour row",
  },
  // The real chronographer row (Chronology refs, FGrHist 244): its French
  // label carried the EPICUREAN's epithet "Maître du Jardin" (the
  // garden-tyrant of 10.25 - a different Athenian Apollodorus entirely).
  "DL-SRC-0045": {
    nameFr: "Apollodore d’Athènes",
    reason:
      "'Maître du Jardin' is the Epicurean garden-tyrant's epithet, not the chronographer's",
  },
  // Labeled "of Athens" but its evidence (ref IX 38, note DK 74, French
  // label "Apollodore de Cyzique") is the Democritean of CYZICUS.
  "DL-SRC-0046": {
    nameEn: "Apollodorus of Cyzicus",
    nameGrc: "Ἀπολλόδωρος Κυζικηνός",
    reason:
      "ref 9.38 + DK 74 + the French label identify the Democritean of Cyzicus, not the chronographer",
  },
  // Labeled "of Cyzicus" but its evidence (Stoic book-7 refs, SVF III,
  // Q248616 = of Seleucia, French label "Apollodore de Séleucie") is the
  // Stoic of SELEUCIA.
  "DL-SRC-0047": {
    nameEn: "Apollodorus of Seleucia",
    nameGrc: "Ἀπολλόδωρος Σελευκεύς",
    reason:
      "Stoic refs + SVF III + Q248616 + the French label identify the Stoic of Seleucia, not the Cyzicene",
  },
  // The calculator's refRaw "I 25 VIII 12" defeated the converter's ref
  // parser (no comma between books), leaving refs empty; also a stray
  // acute in the French article.
  "DL-SRC-0049": {
    refs: ["1.25", "8.12"],
    nameFr: "Apollodore l'arithméticien",
    reason:
      "refRaw 'I 25 VIII 12' left refs unparsed; both sections verified in Hicks (1.25, 8.12)",
  },
};

function loadRows(): SourceCitationRow[] {
  const file = path.resolve(dataDir, "dl_sources.jsonl");
  const rows = readFileSync(file, "utf-8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as SourceCitationRow);
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const [id, fix] of Object.entries(SOURCE_ROW_CORRECTIONS)) {
    const row = byId.get(id);
    if (!row) {
      throw new Error(
        `sources-index: SOURCE_ROW_CORRECTIONS entry "${id}" matches no workbook row - the converter output changed, reconcile the curation`,
      );
    }
    let changed = false;
    const { reason: _reason, ...fields } = fix;
    for (const [k, v] of Object.entries(fields) as [
      keyof Omit<SourceRowCorrection, "reason">,
      SourceRowCorrection[keyof Omit<SourceRowCorrection, "reason">],
    ][]) {
      const cur = row[k];
      const same =
        Array.isArray(v) && Array.isArray(cur)
          ? v.length === cur.length && v.every((x, i) => x === cur[i])
          : cur === v;
      if (!same) {
        (row as unknown as Record<string, unknown>)[k] = v;
        changed = true;
      }
    }
    if (!changed) {
      throw new Error(
        `sources-index: SOURCE_ROW_CORRECTIONS entry "${id}" changes nothing - the converter output was fixed, drop the correction`,
      );
    }
  }
  return rows;
}

/** Strip the curator's trailing doubt marker for matching purposes only. */
function matchForm(label: string): string {
  return label
    .replace(/\s*\(\?\)\s*$/u, "")
    .trim()
    .toLowerCase();
}

/**
 * Curated reconciliation table: workbook primary name -> canonical label.
 * Each entry was verified against the Hicks text and the graph at curation
 * time (July 2026). Two uses:
 *
 *  - ALIASES: the workbook names a person the graph already has under a
 *    different label ("Duris of Samos" is the claim source "Duris";
 *    "Epicurus of Samos" is the philosopher Epicurus). The alias makes
 *    step 3 of the reconciliation hit the existing node, so no duplicate
 *    is minted; the workbook spelling survives in `altLabels`.
 *  - RENAMES: the group stays minted, but under Hicks' spelling instead
 *    of the workbook's French-shaped form ("Alcimos" -> "Alcimus"), so
 *    the label matches the translation the reader actually sees and the
 *    text tagger can use it as a surface.
 *
 * The doubt-marker groups ("Theodorus (of Athens?)" etc.) are deliberately
 * NOT aliased: matchForm already strips " (?)" and the remaining
 * identifications were graded uncertain by the curator.
 */
const SOURCE_LABEL_CANON: Record<string, string> = {
  // aliases to existing source nodes
  "Achaïcos": "Achaïcus",
  "Stesicleides": "Ctesiclides",
  "Sosiocrates of Rhodes": "Sosicrates",
  "Thrasyllus": "Thrasylus",
  "Pamphile of Epidaurus": "Pamphila",
  "Duris of Samos": "Duris",
  "Diocles of Magnesia": "Diocles",
  "Apollonides of Nicaea": "Apollonides",
  "Aristoxenus of Tarentum": "Aristoxenus",
  "Myronianus of Amastris": "Myronianus",
  "Neanthes of Cyzicus": "Neanthes",
  "Heraclides Lembus": "Heraclides",
  "Ariston of Ceos": "Ariston",
  "Timocrates (Epicurean)": "Timocrates",
  // aliases to existing person nodes
  "Linus of Thebes": "Linus",
  "Metrodorus of Lampsacus": "Metrodorus",
  // aliases to philosopher nodes
  "Epicurus of Samos": "Epicurus",
  "Aristotle of Stagira": "Aristotle",
  "Empedocles of Agrigentum": "Empedocles",
  "Archytas of Tarentum": "Archytas",
  "Arcesilaus of Pitane": "Arcesilaus",
  // merges two workbook groups citing the same Sceptic
  "Aenesidemus of Cnossos": "Aenesidemus",
  // after the SOURCE_ROW_CORRECTIONS qid repair, the Ephilos row leads the
  // Q248616 group; mint it under the Stoic's canonical label (the epithet
  // survives as an altLabel)
  "Apollodorus (called Ephilos)": "Apollodorus of Seleucia",
  // renames: mint under the Hicks spelling
  "Alcimos": "Alcimus",
  "Istros": "Istrus",
  "Peisistratus": "Pisistratus",
  "Polyeucte": "Polyeuctus",
  "Melanthios": "Melanthius",
  "Isidore of Pergamum": "Isidorus of Pergamum",
  "Leandrios of Miletus": "Maeandrius of Miletus",
  "Euphanes of Olynthus": "Euphantus of Olynthus",
};

/** URI-identity key for a reconciled target (mirrors lod.ts URI builders). */
function targetKey(kind: SourceTargetKind, label: string): string {
  return kind === "philosopher"
    ? `philosopher/${slugify(label)}`
    : `${kind}/${unicodeSlug(label)}`;
}

let cached: SourcesIndex | null = null;

export function getSourcesIndex(): SourcesIndex {
  if (cached) return cached;
  const rows = loadRows();

  const ids = new Set<string>();
  for (const r of rows) {
    if (ids.has(r.id)) throw new Error(`sources-index: duplicate row id ${r.id}`);
    ids.add(r.id);
    if (r.certainty !== null && !(r.certainty in CERTAINTY_RANK)) {
      throw new Error(`sources-index: row ${r.id} has bad certainty "${r.certainty}"`);
    }
    if (!r.nameEn && !(r.workFr || r.workEn || r.workGrc)) {
      throw new Error(`sources-index: row ${r.id} has neither name nor work`);
    }
  }

  // --- label sets, mirroring exactly the nodes lod.ts emits -----------------
  const g = getKnowledgeGraph();
  const philosopherNames = new Set(g.nodes.map((n) => n.name));
  const ce = getClaimEntities();
  const sayings = getSayings();
  const sourceLabels = new Set<string>(ce.sources);
  for (const s of sayings) if (s.accordingTo) sourceLabels.add(s.accordingTo);
  for (const a of getAnecdotes()) {
    if (a.accordingTo) sourceLabels.add(a.accordingTo);
  }
  const personLabels = new Set<string>(ce.persons);
  for (const s of sayings) {
    if (s.alsoAttributedTo && !philosopherNames.has(s.alsoAttributedTo)) {
      personLabels.add(s.alsoAttributedTo);
    }
  }
  for (const a of Object.values(VERSE_AUTHORS)) {
    if (!philosopherNames.has(a)) personLabels.add(a);
  }

  const philByQid = new Map<string, string>();
  for (const [name, meta] of Object.entries(PHILOSOPHER_META)) {
    if (meta.qid) philByQid.set(meta.qid, name);
  }
  const entityByQid = new Map<string, string>();
  for (const [label, qid] of Object.entries(ENTITY_QIDS)) {
    // First label wins; ENTITY_QIDS has no duplicate QIDs by curation.
    if (!entityByQid.has(qid)) entityByQid.set(qid, label);
  }
  const byMatchForm = new Map<string, { kind: SourceTargetKind; label: string }>();
  // Priority: philosopher > source > person (later set() calls must not
  // overwrite earlier ones, hence the guard).
  const addMatch = (kind: SourceTargetKind, label: string) => {
    const k = matchForm(label);
    if (!byMatchForm.has(k)) byMatchForm.set(k, { kind, label });
  };
  for (const n of philosopherNames) addMatch("philosopher", n);
  for (const l of sourceLabels) addMatch("source", l);
  for (const l of personLabels) addMatch("person", l);

  // --- group rows by identity (QID when verified, else the cited name) -----
  const anonymousRows = rows.filter(
    (r) => r.nameEn === null || r.nameEn === "Anonymous",
  );
  const anonymousIds = new Set(anonymousRows.map((r) => r.id));
  const rawGroups = new Map<string, SourceCitationRow[]>();
  for (const r of rows) {
    if (anonymousIds.has(r.id)) continue;
    const key = r.qid ?? `n:${r.nameEn}`;
    const arr = rawGroups.get(key) ?? [];
    arr.push(r);
    rawGroups.set(key, arr);
  }

  // --- reconcile each raw group to a target node ----------------------------
  interface Resolved {
    kind: SourceTargetKind;
    label: string;
    existing: boolean;
    rows: SourceCitationRow[];
    qid: string | null;
    enwiki: string | null;
  }
  const resolved: Resolved[] = [];
  const usedCanon = new Set<string>();
  for (const [key, groupRows] of rawGroups) {
    const names = [...new Set(groupRows.map((r) => r.nameEn as string))];
    const rawPrimary = names[0]!;
    const canon = SOURCE_LABEL_CANON[rawPrimary];
    if (canon !== undefined) usedCanon.add(rawPrimary);
    const primary = canon ?? rawPrimary;
    const qid = groupRows.find((r) => r.qid)?.qid ?? null;
    const enwiki = groupRows.find((r) => r.enwiki)?.enwiki ?? null;
    let target: { kind: SourceTargetKind; label: string; existing: boolean } | null =
      null;
    if (qid && key === qid) {
      const phil = philByQid.get(qid);
      const entLabel = entityByQid.get(qid);
      if (phil) target = { kind: "philosopher", label: phil, existing: true };
      else if (entLabel) {
        const kind: SourceTargetKind = sourceLabels.has(entLabel)
          ? "source"
          : personLabels.has(entLabel)
            ? "person"
            : "source";
        target = { kind, label: entLabel, existing: true };
      }
    }
    if (!target) {
      const hit = byMatchForm.get(matchForm(primary));
      if (hit) target = { ...hit, existing: true };
    }
    if (!target) target = { kind: "source", label: primary, existing: false };
    resolved.push({ ...target, rows: groupRows, qid, enwiki });
  }
  for (const k of Object.keys(SOURCE_LABEL_CANON)) {
    if (!usedCanon.has(k)) {
      throw new Error(
        `sources-index: SOURCE_LABEL_CANON entry "${k}" matched no workbook group - the workbook changed, reconcile the curation`,
      );
    }
  }

  // --- merge groups that landed on the same URI ------------------------------
  const merged = new Map<string, Resolved>();
  for (const r of resolved) {
    const key = targetKey(r.kind, r.label);
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, r);
      continue;
    }
    prev.rows.push(...r.rows);
    prev.existing = prev.existing || r.existing;
    // QID-verified metadata wins over the unverified same-name group.
    if (!prev.qid && r.qid) {
      prev.qid = r.qid;
      prev.enwiki = r.enwiki;
      prev.label = r.label;
    }
  }

  // --- guard: a minted /source/ URI must not shadow an existing source node --
  const existingSourceSlugs = new Map<string, string>();
  for (const l of sourceLabels) existingSourceSlugs.set(unicodeSlug(l), l);
  for (const [key, grp] of merged) {
    if (grp.existing) continue;
    const clash = existingSourceSlugs.get(key.replace(/^source\//, ""));
    if (clash !== undefined && clash !== grp.label) {
      throw new Error(
        `sources-index: minted source "${grp.label}" collides with existing source label "${clash}"`,
      );
    }
  }

  const groups: SourcePersonGroup[] = [...merged.values()]
    .map((r) => {
      r.rows.sort((a, b) => a.id.localeCompare(b.id));
      const names = [...new Set(r.rows.map((x) => x.nameEn as string))];
      const best = r.rows.reduce<SourceCertainty | null>(
        (acc, x) =>
          x.certainty !== null &&
          (acc === null || CERTAINTY_RANK[x.certainty] < CERTAINTY_RANK[acc])
            ? x.certainty
            : acc,
        null,
      );
      return {
        label: r.label,
        kind: r.kind,
        existing: r.existing,
        altLabels: names.filter((n) => n !== r.label).sort(),
        nameGrc: r.rows.find((x) => x.nameGrc)?.nameGrc ?? null,
        nameFr:
          r.rows.find((x) => x.nameFr && x.nameFr !== r.label)?.nameFr ?? null,
        qid: r.qid,
        enwiki: r.enwiki,
        certainty: best,
        rows: r.rows,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  cached = { rows, groups, anonymousRows };
  return cached;
}
