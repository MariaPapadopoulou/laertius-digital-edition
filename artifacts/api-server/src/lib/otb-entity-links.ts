/**
 * Text index -> ontoterminology object links.
 *
 * Maps a tagged index entry (kind + label) to the single OTB object whose
 * label is an EXACT match inside a kind-compatible category. The match is
 * never guessed: when no object matches, or when two or more objects in
 * the compatible categories share the label (homonyms), no link is made.
 *
 * Lives outside lib/otb/ so the annotations route can import it without
 * touching the OTB build pipeline, and outside annotate.ts so no import
 * cycle forms (otb/build.ts consumes the tagging layer indirectly).
 */
import { getOtbModel } from "./otb/build";
import { getClaimEntities } from "./kg-claims";

/** Index entry kind -> OTB categories its label may match. Terms are
 * deliberately unmapped: Greek term entries denote concepts, not objects. */
const KIND_CATEGORIES: Record<string, string[]> = {
  philosopher: ["Person"],
  person: ["Person"],
  source: ["Person"],
  place: ["Place"],
  work: ["Work"],
  school: ["PhilosophicalSchool", "GroupOfSages"],
};

/** "category\u0000label" -> object id, or null when the label is borne by
 * more than one object in that category (ambiguous, never linked). */
let byCategoryLabel: Map<string, string | null> | null = null;

function buildMap(): Map<string, string | null> {
  if (byCategoryLabel) return byCategoryLabel;
  const map = new Map<string, string | null>();
  for (const o of getOtbModel().objects) {
    const key = `${o.category}\u0000${o.label}`;
    map.set(key, map.has(key) ? null : o.id);
  }
  byCategoryLabel = map;
  return map;
}

/**
 * Id of the unique OTB object exactly matching the entry's label within
 * the categories compatible with its kind; undefined when there is no
 * match or the label is ambiguous.
 */
export function otbObjectIdForEntity(
  kind: string,
  label: string,
): string | undefined {
  const categories = KIND_CATEGORIES[kind];
  if (!categories) return undefined;
  const map = buildMap();
  let found: string | undefined;
  for (const category of categories) {
    const hit = map.get(`${category}\u0000${label}`);
    if (hit === null) return undefined;
    if (hit !== undefined) {
      if (found !== undefined) return undefined;
      found = hit;
    }
  }
  return found;
}

/** Greek lemma -> doctrine concept labels it denotes (otv:denotedConcept),
 * sorted. Same pairing the LOD graph emits: a claim-layer doctrine whose
 * curated Greek key term equals the lemma. */
let doctrinesByGreek: Map<string, string[]> | null = null;

/**
 * Doctrine concepts a tagged Greek term denotes, for the reader-facing
 * terminological record; undefined when the term anchors no doctrine.
 */
export function doctrineConceptsForTerm(lemma: string): string[] | undefined {
  if (!doctrinesByGreek) {
    doctrinesByGreek = new Map();
    for (const d of getClaimEntities().doctrines) {
      if (!d.greek) continue;
      const arr = doctrinesByGreek.get(d.greek) ?? [];
      arr.push(d.label);
      doctrinesByGreek.set(d.greek, arr);
    }
    for (const arr of doctrinesByGreek.values()) arr.sort();
  }
  return doctrinesByGreek.get(lemma);
}
