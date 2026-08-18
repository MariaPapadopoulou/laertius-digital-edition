/**
 * Chapter-subject layer: the class-level distinction between the sages
 * (sophoi) of Book 1 and the philosophers of Books 2-10.
 *
 * Diogenes Laertius draws the line himself: closing Book 1 he writes
 * "these were the men called wise" and opens the account of philosophy
 * proper with the Ionian succession (1.122, 2.1). The eleven Book 1
 * subjects (Thales, Solon, Chilon, Pittacus, Bias, Cleobulus, Periander,
 * Anacharsis, Myson, Epimenides, Pherecydes) are therefore typed
 * `lo:Sage`, the 71 subjects of Books 2-10 `lo:Philosopher`, and all 82
 * share the superclass `lo:ChapterSubject`: the person a chapter of the
 * Lives is about. Each Life is additionally reified as a `lo:Chapter`
 * node linked to its main subject via `lo:hasMainSubject`, so the graph
 * can answer "how many chapters does Book N have and who are they about"
 * directly in SPARQL.
 *
 * Dual classification is allowed only where scholarship clearly supports
 * it, and is curated here, never inferred:
 *  - Thales is BOTH lo:Sage and lo:Philosopher. D.L. reports him first
 *    of the Seven Sages (1.22) yet also transmits his doctrines (water
 *    as the primary substance, the soul in the magnet, 1.24 and 1.27;
 *    three curated doxai carry them), and the Ionian succession that
 *    opens philosophy proper begins from him (1.13). Aristotle calls
 *    him the founder of this kind of philosophy (Met. 983b20).
 *  - No other Book 1 subject qualifies: Solon, Chilon, Pittacus, Bias,
 *    Cleobulus, Periander and Anacharsis are statesmen and moralists of
 *    the sayings tradition; Myson is known only as a sage; Epimenides
 *    is a seer-poet; Pherecydes, though a cosmological writer and
 *    Pythagoras' teacher, is presented by D.L. among the sages and
 *    conventionally counted proto-philosophical at most.
 *
 * Class counts the graph must answer (pinned by validate-lod):
 * 82 lo:ChapterSubject, 72 lo:Philosopher (71 strict + Thales),
 * 11 lo:Sage, 82 lo:Chapter with the per-book distribution
 * 11/17/1/10/6/9/7/8/12/1.
 *
 * The role layer (person-ontology.ts) is deliberately untouched: all 82
 * keep lo:PhilosopherRole (they are the subjects of the Lives of the
 * Philosophers; roles are occupational hats, not the class distinction),
 * and annotation pins depend on the role layer staying put. The
 * gazetteer maps lo:Sage to the same "philosopher" entity kind, so
 * entity URIs, tagging pins and the UI are unaffected.
 */

/** Book whose chapter subjects are the sages. */
export const SAGE_BOOK = 1;

/**
 * Book 1 subjects that are ALSO philosophers in the strict sense.
 * Membership requires positive doctrinal evidence in the corpus itself
 * (see the module header). Checked against the graph by lod.ts: every
 * entry must be a Book 1 node, or serialization throws.
 */
export const DUAL_CLASSIFIED_SAGES: ReadonlySet<string> = new Set(["Thales"]);

/** True when a chapter subject of this book is typed lo:Sage. */
export function isSageBook(book: number): boolean {
  return book === SAGE_BOOK;
}

/**
 * The lo: classes (local names, most specific first, superclass last)
 * for a chapter subject. Always ends with "ChapterSubject"; foaf:Person
 * is appended by the serializers.
 */
export function chapterSubjectClasses(name: string, book: number): string[] {
  if (!isSageBook(book)) return ["Philosopher", "ChapterSubject"];
  return DUAL_CLASSIFIED_SAGES.has(name)
    ? ["Philosopher", "Sage", "ChapterSubject"]
    : ["Sage", "ChapterSubject"];
}

/**
 * The OTV concept kinds (conceptUri arguments) the subject is
 * otv:instanceOf, mirroring the class layer.
 */
export function chapterSubjectConcepts(name: string, book: number): string[] {
  if (!isSageBook(book)) return ["philosopher"];
  return DUAL_CLASSIFIED_SAGES.has(name)
    ? ["philosopher", "sage"]
    : ["sage"];
}

/** English label for a lo:Chapter node. */
export function chapterLabel(
  name: string,
  book: number,
  chapter: string,
): string {
  return `Lives, Book ${book}, Chapter ${chapter}: ${name}`;
}

/**
 * Guard called by both serializers: every curated dual-classified name
 * must exist among the nodes and belong to Book 1, so the set can never
 * silently go stale.
 */
export function assertDualSages(
  nodes: ReadonlyArray<{ name: string; book: number }>,
): void {
  for (const name of DUAL_CLASSIFIED_SAGES) {
    const node = nodes.find((n) => n.name === name);
    if (!node) {
      throw new Error(
        `chapter-subjects: dual-classified sage "${name}" is not a corpus node`,
      );
    }
    if (node.book !== SAGE_BOOK) {
      throw new Error(
        `chapter-subjects: dual-classified sage "${name}" is in Book ${node.book}, not Book ${SAGE_BOOK}`,
      );
    }
  }
}
