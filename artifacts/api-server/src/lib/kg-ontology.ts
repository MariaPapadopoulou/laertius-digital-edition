/**
 * Ontology extras: cited facts that answer competency questions the
 * succession graph (kg.ts) and the per-philosopher claims layer
 * (kg-claims.ts) don't reach on their own.
 *
 *  - alternate work titles Diogenes Laertius reports (CQ2.2)
 *  - the principal doctrine(s) D.L. summarizes for a school (CQ3.2)
 *  - which philosopher D.L. names as the founder of a school, as a real
 *    object property philosopher -> school (CQ4.3)
 *  - numeric earliest/latest year bounds derived from the dated claims,
 *    with a precision flag, for chronological comparison and uncertain
 *    chronology (CQ5, CQ13)
 *  - the transmission fate D.L. reports for a work - spurious / not
 *    genuine, contested authorship, or explicitly extant (CQ8, CQ14)
 *
 * Everything is source-internal: every curated fact carries a D.L.
 * citation (book.section, Hicks numbering) that exists in the corpus,
 * validated by scripts/src/validate-claims.ts. Works and schools
 * referenced here must already exist as entities derived from the claims
 * / movements, so the URIs can never dangle.
 */
import { MOVEMENTS, PHILOSOPHER_META, type MovementId } from "./kg";
import { getClaims, getClaimEntities } from "./kg-claims";

export interface AltTitle {
  /** Work title exactly as it appears as a wrote-claim value. */
  work: string;
  /** The alternate title D.L. gives for that work. */
  altTitle: string;
  ref: string;
  /**
   * Philosopher whose Life hosts the catalogue passage at `ref` — the
   * owner of the wrote-claim this alt title annotates. Consumers must
   * resolve the "(D.L. ref)" passage link against this owner instead of
   * hardcoding Plato, so a future non-Plato alt title cannot silently
   * open the wrong Life.
   */
  owner: string;
}

export interface SchoolDoctrine {
  school: MovementId;
  /** Canonical label for the school's principal doctrine (the end / telos). */
  doctrine: string;
  ref: string;
  note?: string;
}

/**
 * How D.L. reports a work has come down to us.
 *  - "spurious": D.L. names the work as acknowledged spurious / not genuine.
 *  - "disputed-authorship": D.L. reports the authorship is contested but does
 *    not flatly call it spurious.
 *  - "extant": D.L. states the work survives (e.g. "extant in a single volume").
 *  - "lost": D.L. reports the work itself was destroyed (e.g. Empedocles'
 *    Xerxes poem and Hymn to Apollo burnt by his sister, 8.57; Protagoras'
 *    books burnt by the Athenians, with On the Gods absent from the list of
 *    his works that survive, 9.52/9.55). Derived from curated notes that
 *    record the destruction in D.L.'s own words.
 */
export type TransmissionStatus =
  | "spurious"
  | "disputed-authorship"
  | "extant"
  | "lost";

export interface WorkTransmission {
  work: string;
  status: TransmissionStatus;
  ref: string;
  note?: string;
}

export interface FounderLink {
  philosopher: string;
  school: MovementId;
  /** Present when D.L. names the foundership at a specific passage. */
  ref?: string;
}

export interface Chronology {
  philosopher: string;
  /** Earliest attested year; negative = BCE. */
  earliestYear: number;
  /** Latest attested year; negative = BCE. */
  latestYear: number;
  /** True when the dating is hedged (Olympiad "flourished about ...") rather
   * than pinned to a specific year (archon, day of the month). */
  approximate: boolean;
  /** The date-claim refs the bounds were derived from, so the derived
   * chronology stays cited back to D.L. (book.section, Hicks numbering). */
  refs: string[];
}

// --------------------------------------------------------------- curated data

/**
 * Alternate work titles from Plato's catalogue: D.L. gives each dialogue a
 * double title ("X or On Y"). The primary form matches a wrote-claim value;
 * the second title is split out here. Refs verified against the corpus.
 */
export const ALT_TITLES: AltTitle[] = [
  // First tetralogy (3.58)
  { work: "Euthyphro, or On Holiness", altTitle: "On Holiness", ref: "3.58", owner: "Plato" },
  {
    work: "Crito, or On what is to be done",
    altTitle: "On what is to be done",
    ref: "3.58", owner: "Plato",
  },
  { work: "Phaedo, or On the Soul", altTitle: "On the Soul", ref: "3.58", owner: "Plato" },
  // Second tetralogy (3.58)
  {
    work: "Cratylus, or On Correctness of Names",
    altTitle: "On Correctness of Names",
    ref: "3.58", owner: "Plato",
  },
  {
    work: "Theaetetus, or On Knowledge",
    altTitle: "On Knowledge",
    ref: "3.58", owner: "Plato",
  },
  { work: "Sophist, or On Being", altTitle: "On Being", ref: "3.58", owner: "Plato" },
  { work: "Statesman, or On Monarchy", altTitle: "On Monarchy", ref: "3.58", owner: "Plato" },
  // Third tetralogy (3.58)
  { work: "Parmenides, or On Ideas", altTitle: "On Ideas", ref: "3.58", owner: "Plato" },
  { work: "Philebus, or On Pleasure", altTitle: "On Pleasure", ref: "3.58", owner: "Plato" },
  { work: "The Banquet, or On the Good", altTitle: "On the Good", ref: "3.58", owner: "Plato" },
  { work: "Phaedrus, or On Love", altTitle: "On Love", ref: "3.58", owner: "Plato" },
  // Fourth tetralogy (3.59)
  {
    work: "Alcibiades, or On the Nature of Man",
    altTitle: "On the Nature of Man",
    ref: "3.59", owner: "Plato",
  },
  {
    work: "Second Alcibiades, or On Prayer",
    altTitle: "On Prayer",
    ref: "3.59", owner: "Plato",
  },
  {
    work: "Hipparchus, or The Lover of Gain",
    altTitle: "The Lover of Gain",
    ref: "3.59", owner: "Plato",
  },
  {
    work: "The Rivals, or On Philosophy",
    altTitle: "On Philosophy",
    ref: "3.59", owner: "Plato",
  },
  // Fifth tetralogy (3.59)
  {
    work: "Theages, or On Philosophy",
    altTitle: "On Philosophy",
    ref: "3.59", owner: "Plato",
  },
  {
    work: "Charmides, or On Temperance",
    altTitle: "On Temperance",
    ref: "3.59", owner: "Plato",
  },
  { work: "Laches, or On Courage", altTitle: "On Courage", ref: "3.59", owner: "Plato" },
  { work: "Lysis, or On Friendship", altTitle: "On Friendship", ref: "3.59", owner: "Plato" },
  // Sixth tetralogy (3.59)
  {
    work: "Euthydemus, or The Eristic",
    altTitle: "The Eristic",
    ref: "3.59", owner: "Plato",
  },
  { work: "Protagoras, or Sophists", altTitle: "Sophists", ref: "3.59", owner: "Plato" },
  { work: "Gorgias, or On Rhetoric", altTitle: "On Rhetoric", ref: "3.59", owner: "Plato" },
  { work: "Meno, or On Virtue", altTitle: "On Virtue", ref: "3.59", owner: "Plato" },
  // Seventh tetralogy (3.60)
  {
    work: "Hippias (major), or On Beauty",
    altTitle: "On Beauty",
    ref: "3.60", owner: "Plato",
  },
  {
    work: "Hippias (minor), or On Falsehood",
    altTitle: "On Falsehood",
    ref: "3.60", owner: "Plato",
  },
  { work: "Ion, or On the Iliad", altTitle: "On the Iliad", ref: "3.60", owner: "Plato" },
  {
    work: "Menexenus, or The Funeral Oration",
    altTitle: "The Funeral Oration",
    ref: "3.60", owner: "Plato",
  },
  // Eighth tetralogy (3.60)
  { work: "Clitophon, or Introduction", altTitle: "Introduction", ref: "3.60", owner: "Plato" },
  { work: "Timaeus, or On Nature", altTitle: "On Nature", ref: "3.60", owner: "Plato" },
  {
    work: "Critias, or Story of Atlantis",
    altTitle: "Story of Atlantis",
    ref: "3.60", owner: "Plato",
  },
  // Ninth tetralogy (3.60)
  { work: "Minos, or On Law", altTitle: "On Law", ref: "3.60", owner: "Plato" },
  { work: "Laws, or On Legislation", altTitle: "On Legislation", ref: "3.60", owner: "Plato" },
  {
    work: "Epinomis, or Nocturnal Council",
    altTitle: "Nocturnal Council",
    ref: "3.60", owner: "Plato",
  },
  // Acknowledged spurious dialogues (3.62): D.L. lists these with the same
  // double-title pattern ("the Midon or Horse-breeder ...").
  {
    work: "Midon, or Horse-breeder",
    altTitle: "Horse-breeder",
    ref: "3.62", owner: "Plato",
  },
  {
    work: "Eryxias, or Erasistratus",
    altTitle: "Erasistratus",
    ref: "3.62", owner: "Plato",
  },
  { work: "Acephali, or Sisyphus", altTitle: "Sisyphus", ref: "3.62", owner: "Plato" },
];

/**
 * The end (telos) each school professes, as D.L. summarizes it in the
 * doctrinal sections. Refs verified against the corpus.
 *
 * Hedge-note curation decision (reviewed against the corpus): every entry
 * below carries a note recording HOW D.L. hedges or attributes the
 * formulation, because in each case the text credits the telos to a
 * specific figure, treatise, or reporter rather than stating it as a
 * bare school creed. Movements deliberately left WITHOUT a doctrine line
 * (and hence needing no hedge note):
 *  - seven-sages, ionian, socratic, megarian, elian-eretrian,
 *    pythagorean, eleatic, sophist, other: D.L. states no school-level
 *    end (telos) for them anywhere in the corpus.
 *  - atomist: the "end of action is tranquillity" passage (9.45) is
 *    Democritus' personal doxography, not a school telos; it lives in
 *    the claims/doxai layers instead.
 * Where a school's telos is voiced through its founder's Life (academy
 * 3.78, peripatos 5.30, sceptic 9.107), the doctrine label reuses the
 * existing heldDoctrine claim value verbatim so the LOD layer links the
 * school to the same doctrine node instead of minting a near-duplicate.
 */
export const SCHOOL_DOCTRINES: SchoolDoctrine[] = [
  {
    school: "stoa",
    doctrine: "Life in agreement with nature is the end",
    ref: "7.87",
    note:
      "D.L. credits Zeno as the first to designate this end, in his treatise " +
      "On the Nature of Man, and reports Cleanthes, Posidonius, Hecato, and " +
      "Chrysippus following him.",
  },
  {
    school: "epicurean",
    doctrine: "Pleasure is the end and aim",
    ref: "10.131",
    note:
      "Epicurus himself hedges the term: not the pleasures of the prodigal " +
      "or of sensuality, but absence of pain in the body and of trouble in " +
      "the soul.",
  },
  {
    school: "cyrenaic",
    doctrine: "Bodily pleasure is the end",
    ref: "2.87",
    note:
      "On Panaetius's report, not the settled pleasure following the removal " +
      "of pains that Epicurus accepts; the end is particular pleasure, " +
      "distinct from happiness as the sum of pleasures.",
  },
  {
    school: "cynic",
    doctrine: "Life according to virtue is the end",
    ref: "6.104",
    note:
      "As Antisthenes says in his Heracles - exactly like the Stoics; D.L. " +
      "notes the close relationship between the two schools and calls " +
      "Cynicism a short cut to virtue.",
  },
  {
    school: "academy",
    doctrine: "The end to aim at is assimilation to God",
    ref: "3.78",
    note:
      "D.L. reports this as Plato's own teaching in his summary of " +
      "Plato's doctrines (\"he maintained that the end to aim at is " +
      "assimilation to God\"), not as a creed professed by the Academy " +
      "at large.",
  },
  {
    school: "peripatos",
    doctrine: "The one ethical end is the exercise of virtue in a completed life",
    ref: "5.30",
    note:
      "D.L. attributes the formulation to Aristotle personally in the " +
      "doxography of his views; it is Aristotle's ethical end, extended " +
      "here to the Peripatos as the school he founded.",
  },
  {
    school: "sceptic",
    doctrine:
      "The end to be realized is suspension of judgement, which brings tranquillity in its train",
    ref: "9.107",
    note:
      "D.L. gives the formulation on named authority - \"so Timon and " +
      "Aenesidemus declare\" - reporting what the Sceptics say rather " +
      "than asserting it in his own voice.",
  },
];

/**
 * Passages where D.L. explicitly names a philosopher as a school's founder.
 * Only these get a cited reification; the object-property triple is emitted
 * for every founder in PHILOSOPHER_META (see getFounderLinks).
 */
const FOUNDER_REFS: Record<string, string> = {
  Thales: "1.122",
  Plato: "2.47",
  "Zeno of Citium": "6.105",
  Epicurus: "10.15",
};

/** Founder -> school object links, derived from PHILOSOPHER_META. */
export function getFounderLinks(): FounderLink[] {
  const links: FounderLink[] = [];
  for (const [name, meta] of Object.entries(PHILOSOPHER_META)) {
    if (!meta.founderOf) continue;
    const link: FounderLink = { philosopher: name, school: meta.founderOf };
    const ref = FOUNDER_REFS[name];
    if (ref) link.ref = ref;
    links.push(link);
  }
  return links;
}

const SPURIOUS_RE = /spurious|not genuine|forged/i;
const EXTANT_RE = /\bextant\b|\bsurvive/i;
// The work itself destroyed, in D.L.'s own report (burnt works). Tested
// BEFORE the other regimes so a "burnt ... does not survive" note can never
// fall through to "extant".
const LOST_RE = /\bburnt\b|\bburned\b|\bdestroyed\b/i;

/**
 * Transmission fate per work, derived from the `wrote` claims so the flag
 * stays in lock-step with the claims layer and is always cited (CQ8/CQ14):
 *
 *  - a work D.L. explicitly calls spurious / not genuine -> "spurious"
 *  - any other work whose authorship D.L. reports as contested (a disputed
 *    `wrote` claim) -> "disputed-authorship"
 *  - a work D.L. says survives ("extant in a single volume") -> "extant"
 *  - a work D.L. reports destroyed (burnt) -> "lost"
 *
 * Only claims that actually carry one of these signals are flagged; a plain
 * asserted `wrote` claim with no transmission note is left unflagged.
 */
export function getWorkTransmission(): WorkTransmission[] {
  const out: WorkTransmission[] = [];
  const seen = new Set<string>();
  for (const c of getClaims()) {
    if (c.property !== "wrote") continue;
    const note = c.note ?? "";
    let status: TransmissionStatus | null = null;
    if (LOST_RE.test(note)) {
      status = "lost";
    } else if (EXTANT_RE.test(note)) {
      status = "extant";
    } else if (c.certainty === "disputed") {
      status = SPURIOUS_RE.test(note) ? "spurious" : "disputed-authorship";
    }
    if (!status) continue;
    const key = `${c.value}\u0001${c.ref}\u0001${status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const entry: WorkTransmission = { work: c.value, status, ref: c.ref };
    if (c.note) entry.note = c.note;
    out.push(entry);
  }
  return out;
}

const BCE_RE = /(\d[\d/\u2013\u2014-]*)\s*BCE/g;

/**
 * Numeric year bounds per philosopher, parsed from the BCE years already
 * curated in the birthDate/deathDate claim values. BCE years become negative
 * integers so the bounds sort and compare directly (contemporaneity, CQ5).
 */
export function getChronology(): Chronology[] {
  const acc = new Map<
    string,
    { years: number[]; approx: boolean; refs: Set<string> }
  >();
  for (const c of getClaims()) {
    if (c.property !== "birthDate" && c.property !== "deathDate") continue;
    const nums: number[] = [];
    for (const m of c.value.matchAll(BCE_RE)) {
      for (const part of m[1]!.split(/[^\d]+/)) {
        if (part) nums.push(Number(part));
      }
    }
    if (nums.length === 0) continue;
    const approx = /\babout\b|flourish/i.test(c.value);
    let entry = acc.get(c.subject);
    if (!entry) {
      entry = { years: [], approx: false, refs: new Set() };
      acc.set(c.subject, entry);
    }
    entry.years.push(...nums);
    entry.approx = entry.approx || approx;
    entry.refs.add(c.ref);
  }
  const out: Chronology[] = [];
  for (const [philosopher, { years, approx, refs }] of acc) {
    out.push({
      philosopher,
      earliestYear: -Math.max(...years),
      latestYear: -Math.min(...years),
      approximate: approx,
      refs: [...refs].sort(),
    });
  }
  return out.sort((a, b) => a.philosopher.localeCompare(b.philosopher));
}

export interface OntologyExtras {
  altTitles: AltTitle[];
  schoolDoctrines: SchoolDoctrine[];
  workTransmission: WorkTransmission[];
  founderLinks: FounderLink[];
  chronology: Chronology[];
}

let cached: OntologyExtras | null = null;

/**
 * All ontology extras, validated at first use: alternate-title and
 * transmission works must exist as claim-derived works, and school-doctrine
 * schools must be known movement ids. Throws on curation errors so they
 * cannot ship silently.
 */
export function getOntologyExtras(): OntologyExtras {
  if (cached) return cached;
  const works = new Set(getClaimEntities().works);
  const movementIds = new Set(MOVEMENTS.map((m) => m.id));
  for (const a of ALT_TITLES) {
    if (!works.has(a.work)) {
      throw new Error(`kg-ontology: unknown work "${a.work}" (alternate title)`);
    }
    if (a.altTitle.trim().length === 0) {
      throw new Error(`kg-ontology: empty alternate title for "${a.work}"`);
    }
  }
  for (const sd of SCHOOL_DOCTRINES) {
    if (!movementIds.has(sd.school)) {
      throw new Error(`kg-ontology: unknown school "${sd.school}"`);
    }
    if (sd.doctrine.trim().length === 0) {
      throw new Error(`kg-ontology: empty doctrine for school "${sd.school}"`);
    }
  }
  const workTransmission = getWorkTransmission();
  for (const tr of workTransmission) {
    if (!works.has(tr.work)) {
      throw new Error(`kg-ontology: unknown work "${tr.work}" (transmission)`);
    }
  }
  cached = {
    altTitles: ALT_TITLES,
    schoolDoctrines: SCHOOL_DOCTRINES,
    workTransmission,
    founderLinks: getFounderLinks(),
    chronology: getChronology(),
  };
  return cached;
}
