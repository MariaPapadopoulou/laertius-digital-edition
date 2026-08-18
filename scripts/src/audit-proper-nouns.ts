/**
 * Audit proper-noun tagging coverage and correctness.
 *
 * For EVERY corpus section this script:
 *   1. Runs the deterministic tagger and records which character-offsets
 *      are covered by a name annotation (English or Greek).
 *   2. Scans the raw text for capitalized-token candidates:
 *        English  — /\b[A-Z][a-zA-Z'-]+/ (skips purely-uppercase abbreviations)
 *        Greek    — any word-token whose first codepoint in the ORIGINAL
 *                   polytonic text is an uppercase letter (Ἀ, Κ, …)
 *   3. Classifies each candidate:
 *        tagged            — fully covered by a name annotation (not a term)
 *        tagged-heuristic  — covered by a section-owner heuristic tag
 *        skipped-blocklist — surface is in SURFACE_BLOCKLIST / GREEK_NAME_SKIPS
 *        skipped-ambiguous — surface is in the gazetteer's skipped ledger
 *        not-tagged        — none of the above; the gap to investigate
 *   4. For "not-tagged" candidates, notes whether every occurrence in the
 *      corpus is sentence-initial (lower risk of being a proper noun).
 *
 * Positive-count proof:
 *   The script prints the total candidate count per language before the
 *   skip/tag breakdown so an empty residual is provably non-vacuous.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run audit-proper-nouns
 *
 * Optional env-var controls:
 *   AUDIT_BOOK=<number>   — restrict to one book (1-10)
 *   AUDIT_GREEK=0         — skip Greek side
 *   AUDIT_EN=0            — skip English side
 *   AUDIT_VERBOSE=1       — print every untagged occurrence, not just summary
 *   AUDIT_MIN_COUNT=<n>   — only report words with >= n occurrences (default 1)
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { annotateSection } = await import(
  "../../artifacts/api-server/src/lib/annotate"
);
const { normalizeGreek } = await import(
  "../../artifacts/api-server/src/lib/greek"
);
const { getGazetteer } = await import(
  "../../artifacts/api-server/src/lib/gazetteer"
);
const { corpus } = await import("../../artifacts/api-server/src/lib/corpus");
const { GREEK_NAME_SKIPS } = await import(
  "../../artifacts/api-server/src/lib/greek-names"
);

// ---------------------------------------------------------------- config
const BOOK_FILTER = process.env["AUDIT_BOOK"]
  ? Number(process.env["AUDIT_BOOK"])
  : null;
const DO_EN = process.env["AUDIT_EN"] !== "0";
const DO_GRC = process.env["AUDIT_GREEK"] !== "0";
const VERBOSE = process.env["AUDIT_VERBOSE"] === "1";
const MIN_COUNT = process.env["AUDIT_MIN_COUNT"]
  ? Number(process.env["AUDIT_MIN_COUNT"])
  : 1;

// ----------------------------------------- common English non-proper-nouns
// Words that are NEVER proper nouns in any position — a capitalized token
// matching one of these is always sentence-initial or a grammatical word,
// never a missed entity.
const EN_STOPWORDS = new Set([
  // articles
  "A", "An", "The",
  // personal pronouns
  "He", "She", "It", "They", "We", "I", "You",
  // possessive pronouns
  "His", "Her", "Its", "Their", "Our", "My", "Your",
  // demonstratives / determiners
  "This", "That", "These", "Those",
  // prepositions
  "In", "On", "At", "By", "For", "Of", "To", "From", "With", "Without",
  "About", "After", "Before", "During", "Between", "Among", "Against",
  "Along", "Around", "Through", "Into", "Onto", "Upon", "Over", "Under",
  "Above", "Below", "Behind", "Beyond", "Beside", "Besides", "Except",
  "Per", "Via", "Towards", "Toward",
  // conjunctions
  "And", "But", "Or", "Nor", "Yet", "So", "As", "If", "Although",
  "Though", "Because", "Since", "While", "When", "Where", "How", "Why",
  "Whether", "Unless", "Until", "After", "Before",
  // relative/interrogative
  "Who", "Whom", "Whose", "Which", "What",
  // adverbs (common sentence-starters)
  "Now", "Then", "Here", "There", "Still", "Again", "Already", "Always",
  "Often", "Never", "Also", "Even", "Only", "Not", "Very", "More",
  "Most", "Less", "Much", "Many", "Few", "All", "Some", "Both", "Each",
  "Every", "Either", "Neither", "Nor", "First", "Last", "Just", "Soon",
  "Still", "Thus", "Hence", "Therefore", "However", "Moreover",
  "Furthermore", "Nevertheless", "Meanwhile", "Indeed", "Yet",
  // numerals written out
  "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen", "Twenty", "Thirty", "Forty",
  "Fifty", "Hundred", "Thousand",
  // auxiliary / copular verbs
  "Is", "Are", "Was", "Were", "Be", "Been", "Being",
  "Have", "Has", "Had", "Do", "Does", "Did",
  "Will", "Would", "Can", "Could", "Should", "Shall", "May", "Might",
  "Must", "Ought",
  // common adjectives that start sentences
  "Such", "Same", "Other", "Another", "Any", "No", "Not", "True",
  "False", "Good", "Bad", "Next", "New", "Old", "Great", "Long",
  "Short", "Large", "Small", "High", "Low", "Public", "Common",
  // words that are occasionally capitalized in D.L.'s conventions
  "Having", "Being", "When", "As", "At", "But", "And", "So",
  "For", "If", "Now",
]);

// ----------------------------------------- check if offset is sentence-initial
function isSentenceInitial(text: string, offset: number): boolean {
  if (offset === 0) return true;
  // Walk backwards past whitespace
  let i = offset - 1;
  while (i >= 0 && (text[i] === " " || text[i] === "\n" || text[i] === "\t"))
    i--;
  if (i < 0) return true;
  const ch = text[i]!;
  // Common sentence-ending punctuation
  return ch === "." || ch === "!" || ch === "?" || ch === ";" || ch === "—";
}

// ----------------------------------------- check if Greek codepoint is uppercase
function isGreekUppercase(ch: string): boolean {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return false;
  return /\p{Lu}/u.test(String.fromCodePoint(cp));
}

// ----------------------------------------------------------------- types
interface CandidateOccurrence {
  sectionId: string;
  book: number;
  offset: number;
  sentenceInitial: boolean;
}

interface CandidateSummary {
  surface: string;
  lang: "en" | "grc";
  // classification of ALL occurrences as a majority label
  tagged: number;
  taggedHeuristic: number;
  skippedBlocklist: number;
  skippedAmbiguous: number;
  notTagged: CandidateOccurrence[];
  // true if every single occurrence is sentence-initial
  allSentenceInitial: boolean;
}

// ============================================================ main pass
const g = getGazetteer();

const blocklistedEn = new Set(
  g.skipped.filter((s) => s.reason === "text-ambiguous").map((s) => s.surface),
);
const ambiguousEn = new Set(
  g.skipped.filter((s) => s.reason === "ambiguous").map((s) => s.surface),
);
// Also the bare philosopher names (section-owner heuristic)
const ownerNames = new Set(g.ambiguousPhilosopherNames.keys());

// Greek: normalized forms derived from GREEK_NAME_SKIPS values.
// Keys are English labels; values START with the Greek nominative
// ("Ἀλέξανδρος: ..."). For -ος endings (2nd-declension masculine),
// generate gen/dat/acc/pl forms so that declined cases are also
// recognised as explained rather than "not tagged".
// NOTE: only nominatives are listed in GREEK_NAME_SKIPS, so declined
// forms are derived heuristically. Paradigms for other declensions
// (e.g. 1st-decl. Ἐπίκουρος-alias entries) are not generated.
const blocklistedGrcForms = new Set<string>();
for (const val of Object.values(GREEK_NAME_SKIPS)) {
  // Skip values that start with Latin text (editorial notes without a Greek form)
  const firstCp = val.codePointAt(0) ?? 0;
  const isGreekStart =
    (firstCp >= 0x0370 && firstCp <= 0x03ff) ||
    (firstCp >= 0x1f00 && firstCp <= 0x1fff);
  if (!isGreekStart) continue;
  const m = val.match(/^(\p{L}+)/u);
  if (!m) continue;
  const normNom = normalizeGreek(m[1]!);
  blocklistedGrcForms.add(normNom);
  // 2nd-declension masculine (-ος ending after normalization: "...οσ")
  if (normNom.endsWith("οσ")) {
    const stem = normNom.slice(0, -2);
    blocklistedGrcForms.add(stem + "ου");  // genitive sg
    blocklistedGrcForms.add(stem + "ω");   // dative sg (ῳ → ω after normalization)
    blocklistedGrcForms.add(stem + "ον");  // accusative sg
    blocklistedGrcForms.add(stem + "ε");   // vocative sg
    blocklistedGrcForms.add(stem + "οι");  // nominative pl
    blocklistedGrcForms.add(stem + "ων");  // genitive pl
    blocklistedGrcForms.add(stem + "οισ"); // dative pl (οις, ς→σ)
    blocklistedGrcForms.add(stem + "ουσ"); // accusative pl (ους, ς→σ)
  }
}
const blocklistedGrc = blocklistedGrcForms;
const ambiguousGrc = new Set(g.greekSkipped.map((s) => s.surface));
const ownerGrcForms = new Set(g.ambiguousGreekPhilosopherForms.keys());

// Greek common words (particles, prepositions, articles, pronouns) that can
// appear capitalized but are NEVER proper nouns — filter before classification.
// Specified in polytonic Greek; normalized at startup so accent variants merge.
const GRC_STOPWORDS = new Set(
  [
    // prepositions (appear capitalized when they start mid-sentence work titles)
    "Περί", "Πρός", "Κατά", "Παρά", "Μετά", "Ἀπό", "Εἰς", "Ἐκ", "Ἐξ",
    "Ἐν", "Ὑπό", "Ὑπέρ", "Ἐπί", "Διά", "Σύν", "Ἀντί", "Ἀμφί", "Ἀνά",
    // conjunctions / particles
    "Καί", "Καὶ", "Ἀλλά", "Ἀλλὰ", "Ὅτι", "Ἵνα", "Ὡς", "Εἰ", "Ὅτε",
    "Ἐπεί", "Ὅπως", "Ἤ", "Ἤτοι", "Εἴτε", "Εἴπερ", "Οὖν",
    "Μέν", "Δέ", "Γάρ", "Τε", "Ἄν", "Ἄρα", "Εἶτα", "Ἔπειτα",
    "Νῦν", "Ἔτι", "Πῶς", "Ἤδη", "Ἴσως",
    // negations
    "Οὐ", "Οὐκ", "Οὐχ", "Οὐδέ", "Οὐδέν", "Οὐδεὶς", "Οὐδείς",
    "Μή", "Μηδέ", "Μηδείς",
    // definite article forms (sentence-initial capitals from scribal convention)
    "Τῆς", "Τοῦ", "Τῷ", "Τήν", "Τόν", "Τῶν", "Τοῖς", "Τάς", "Τά", "Τό", "Τὸ",
  ].map(normalizeGreek),
);

// Collect results per surface
const enResults = new Map<string, CandidateSummary>();
const grcResults = new Map<string, CandidateSummary>();

const ensure = (
  map: Map<string, CandidateSummary>,
  surface: string,
  lang: "en" | "grc",
): CandidateSummary => {
  let r = map.get(surface);
  if (!r) {
    r = {
      surface,
      lang,
      tagged: 0,
      taggedHeuristic: 0,
      skippedBlocklist: 0,
      skippedAmbiguous: 0,
      notTagged: [],
      allSentenceInitial: true,
    };
    map.set(surface, r);
  }
  return r;
};

// Progress counter
let processed = 0;
const total = corpus.filter(
  (s) => BOOK_FILTER === null || s.book === BOOK_FILTER,
).length;

for (const section of corpus) {
  if (BOOK_FILTER !== null && section.book !== BOOK_FILTER) continue;
  processed++;
  if (processed % 500 === 0 || processed === total) {
    process.stderr.write(`  [${processed}/${total}] processed...\r`);
  }

  const anns = annotateSection(section);

  // Build lookup: start offset -> annotation (name kinds only, not terms)
  const coveredEn = new Map<
    number,
    { end: number; heuristic: boolean }
  >();
  const coveredGrc = new Map<
    number,
    { end: number; heuristic: boolean }
  >();
  for (const a of anns) {
    if (a.kind === "term") continue;
    if (a.lang === "en") {
      coveredEn.set(a.start, { end: a.end, heuristic: !!a.heuristic });
    } else {
      coveredGrc.set(a.start, { end: a.end, heuristic: !!a.heuristic });
    }
  }
  // Also build a "covered offset" set for any position inside an annotation
  const coveredEnOffsets = new Set<number>();
  const coveredGrcOffsets = new Set<number>();
  for (const a of anns) {
    if (a.kind === "term") continue;
    const set = a.lang === "en" ? coveredEnOffsets : coveredGrcOffsets;
    for (let i = a.start; i < a.end; i++) set.add(i);
  }

  // ----------------------------------------- English side
  if (DO_EN && section.textEn) {
    const text = section.textEn;
    // Match word-tokens starting with uppercase letter (skip ALL-CAPS short abbreviations)
    for (const m of text.matchAll(/\b([A-Z][a-zA-Z'-]{1,})/gu)) {
      const surface = m[1]!;
      const offset = m.index!;
      if (EN_STOPWORDS.has(surface)) continue;

      const r = ensure(enResults, surface, "en");
      const si = isSentenceInitial(text, offset);
      if (!si) r.allSentenceInitial = false;

      // Is offset covered?
      if (coveredEnOffsets.has(offset)) {
        const ann = coveredEn.get(offset);
        if (ann?.heuristic) {
          r.taggedHeuristic++;
        } else {
          r.tagged++;
        }
      } else if (blocklistedEn.has(surface)) {
        r.skippedBlocklist++;
      } else if (
        ambiguousEn.has(surface) ||
        ownerNames.has(surface)
      ) {
        // ambiguous names covered by section-owner heuristic elsewhere
        r.skippedAmbiguous++;
      } else {
        r.notTagged.push({
          sectionId: section.id,
          book: section.book,
          offset,
          sentenceInitial: si,
        });
      }
    }
  }

  // ----------------------------------------- Greek side
  if (DO_GRC && section.text) {
    const text = section.text;
    // Find word-tokens: sequences of Unicode letters
    for (const m of text.matchAll(/(\p{L}+)/gu)) {
      const origToken = m[0]!;
      const offset = m.index!;
      // Check if original token starts with uppercase
      if (!isGreekUppercase(origToken[0]!)) continue;

      const normToken = normalizeGreek(origToken);
      if (normToken.length < 2) continue;
      if (GRC_STOPWORDS.has(normToken)) continue;

      const r = ensure(grcResults, origToken, "grc");
      const si = isSentenceInitial(text, offset);
      if (!si) r.allSentenceInitial = false;

      if (coveredGrcOffsets.has(offset)) {
        const ann = coveredGrc.get(offset);
        if (ann?.heuristic) {
          r.taggedHeuristic++;
        } else {
          r.tagged++;
        }
      } else if (
        blocklistedGrc.has(normToken) ||
        // GREEK_NAME_SKIPS is keyed by English label, but also check normalized forms
        ambiguousGrc.has(normToken) ||
        ownerGrcForms.has(normToken)
      ) {
        r.skippedBlocklist++;
      } else {
        r.notTagged.push({
          sectionId: section.id,
          book: section.book,
          offset,
          sentenceInitial: si,
        });
      }
    }
  }
}
process.stderr.write("\n");

// ================================================================== report
const printSection = (
  lang: "en" | "grc",
  results: Map<string, CandidateSummary>,
): void => {
  const label = lang === "en" ? "ENGLISH" : "GREEK";
  const all = [...results.values()];
  const totalCandidates =
    all.reduce(
      (n, r) =>
        n +
        r.tagged +
        r.taggedHeuristic +
        r.skippedBlocklist +
        r.skippedAmbiguous +
        r.notTagged.length,
      0,
    );
  const totalTagged = all.reduce((n, r) => n + r.tagged, 0);
  const totalHeuristic = all.reduce((n, r) => n + r.taggedHeuristic, 0);
  const totalBlocklisted = all.reduce((n, r) => n + r.skippedBlocklist, 0);
  const totalAmbiguous = all.reduce((n, r) => n + r.skippedAmbiguous, 0);
  const totalUntagged = all.reduce((n, r) => n + r.notTagged.length, 0);
  const distinctUntagged = all.filter((r) => r.notTagged.length > 0).length;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`${label} PROPER NOUN AUDIT`);
  console.log(`${"=".repeat(60)}`);
  console.log(`  Total capitalized token occurrences:  ${totalCandidates.toString().padStart(7)}`);
  console.log(`  Tagged (explicit):                    ${totalTagged.toString().padStart(7)}`);
  console.log(`  Tagged (section-owner heuristic):     ${totalHeuristic.toString().padStart(7)}`);
  console.log(`  Skipped (blocklisted):                ${totalBlocklisted.toString().padStart(7)}`);
  console.log(`  Skipped (ambiguous / owner set):      ${totalAmbiguous.toString().padStart(7)}`);
  console.log(`  Not tagged (residual candidates):     ${totalUntagged.toString().padStart(7)}`);
  console.log(`  Distinct untagged word types:         ${distinctUntagged.toString().padStart(7)}`);

  // Filter to residual candidates worth reporting
  const residual = all
    .filter((r) => r.notTagged.length >= MIN_COUNT)
    .sort((a, b) => {
      // Sort: non-sentence-initial first (more likely to be real proper nouns),
      // then by count descending
      const aNonSI = a.notTagged.filter((o) => !o.sentenceInitial).length;
      const bNonSI = b.notTagged.filter((o) => !o.sentenceInitial).length;
      if (bNonSI !== aNonSI) return bNonSI - aNonSI;
      return b.notTagged.length - a.notTagged.length;
    });

  if (residual.length === 0) {
    console.log("\n  No untagged candidates found.");
    return;
  }

  console.log(`\n--- UNTAGGED CANDIDATES (${residual.length} types, sorted by non-sentence-initial occurrences) ---\n`);
  console.log(
    `  ${"Surface".padEnd(35)} ${"Count".padStart(5)} ${"NonSI".padStart(5)} ${"SentI".padStart(5)}  Books`,
  );
  console.log("  " + "-".repeat(75));

  for (const r of residual) {
    const nonSI = r.notTagged.filter((o) => !o.sentenceInitial).length;
    const sentI = r.notTagged.filter((o) => o.sentenceInitial).length;
    const books = [
      ...new Set(r.notTagged.map((o) => o.book)),
    ].sort((a, b) => a - b).join(",");
    const surface = r.surface.length > 33 ? r.surface.slice(0, 31) + ".." : r.surface;
    const note = r.allSentenceInitial ? " [all sentence-initial]" : "";
    console.log(
      `  ${surface.padEnd(35)} ${r.notTagged.length.toString().padStart(5)} ${nonSI.toString().padStart(5)} ${sentI.toString().padStart(5)}  ${books}${note}`,
    );
    if (VERBOSE) {
      for (const o of r.notTagged.slice(0, 5)) {
        console.log(`      ${o.sectionId}${o.sentenceInitial ? " [SI]" : ""}`);
      }
      if (r.notTagged.length > 5)
        console.log(`      ... and ${r.notTagged.length - 5} more`);
    }
  }
};

printSection("en", enResults);
printSection("grc", grcResults);

console.log("\n" + "=".repeat(60));
console.log("AUDIT COMPLETE");
console.log("=".repeat(60));
console.log(
  "Columns: Count = total untagged occurrences, NonSI = non-sentence-initial,",
);
console.log(
  "         SentI = sentence-initial. Words only at sentence-initial",
);
console.log(
  "         position are lower risk (may be sentence starters, not proper nouns).",
);
console.log(
  "Use AUDIT_VERBOSE=1 for section-level detail, AUDIT_BOOK=N for one book,",
);
console.log("AUDIT_MIN_COUNT=N to filter low-frequency candidates.");
