import { normalizeGreek, tokenize } from "./greek";

/**
 * Detects philosophical schools named in a search query so hybrid fusion
 * can boost the matching sections (mirroring the philosopher-name boost).
 * Keys are corpus `school` labels; values are Greek and English word forms,
 * stored normalized like BM25 tokens (lowercase, accents stripped, final
 * sigma folded), so common inflections match without a morphology layer.
 */
const SCHOOL_ALIASES: Record<string, string[]> = {
  Cynics: [
    "κυνικοι", "κυνικοσ", "κυνικη", "κυνικων", "κυνικουσ", "κυνικεσ",
    "cynic", "cynics", "cynicism",
  ],
  Stoa: [
    "στωικοι", "στωικοσ", "στωικη", "στωικων", "στωικουσ", "στοα",
    "stoic", "stoics", "stoicism", "stoa",
  ],
  "Garden (Epicurus)": [
    "επικουρειοι", "επικουρειοσ", "επικουρεια", "επικουρειων", "επικουρειουσ",
    "epicurean", "epicureans", "epicureanism",
  ],
  // Both corpus headings are Academy sections (Plato's book and the later
  // Academy), so an Academy query intentionally boosts both.
  "Academy (Plato)": [
    "ακαδημια", "ακαδημιασ", "ακαδημαικοι", "ακαδημαικοσ", "πλατωνικοι",
    "academy", "academics", "platonists", "platonism",
  ],
  Academy: [
    "ακαδημια", "ακαδημιασ", "ακαδημαικοι", "ακαδημαικοσ",
    "academy", "academics",
  ],
  Peripatos: [
    "περιπατοσ", "περιπατητικοι", "περιπατητικοσ", "περιπατητικων",
    "peripatos", "peripatetic", "peripatetics",
  ],
  "Italian / Pythagorean": [
    "πυθαγορειοι", "πυθαγορειοσ", "πυθαγορειων", "πυθαγορειουσ",
    "pythagorean", "pythagoreans", "pythagoreanism",
  ],
  // The remaining corpus headings ("Eleatics, Atomists, Sceptics",
  // "Ionian & Socratic", "Seven Sages / Ionian tradition") are composite
  // book traditions: boosting the whole heading for one member sect (e.g.
  // Atomists) would lift unrelated sections, so they get no aliases until
  // finer per-section sect metadata exists.
};

const ALIAS_TO_SCHOOLS = new Map<string, string[]>();
for (const [school, aliases] of Object.entries(SCHOOL_ALIASES)) {
  for (const alias of aliases) {
    const key = normalizeGreek(alias);
    const list = ALIAS_TO_SCHOOLS.get(key) ?? [];
    list.push(school);
    ALIAS_TO_SCHOOLS.set(key, list);
  }
}

/** Corpus school labels named in the query (empty when none detected). */
export function detectSchools(query: string): string[] {
  const found = new Set<string>();
  for (const token of tokenize(query)) {
    for (const school of ALIAS_TO_SCHOOLS.get(token) ?? []) {
      found.add(school);
    }
  }
  return [...found];
}
