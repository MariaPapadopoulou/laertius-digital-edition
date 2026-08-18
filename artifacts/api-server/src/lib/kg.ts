/**
 * Knowledge graph of the philosophers in Diogenes Laertius' Lives.
 *
 * Relations are curated from the text itself (the diadochai / successions),
 * with D.L. citations in `ref` (book.section, Hicks numbering).
 * Nodes are derived at runtime from the corpus, so the graph can never
 * reference a philosopher that is not present in the text.
 */
import { philosophers } from "./corpus";
import { EXTERNAL_LINKS } from "./kg-links";
import { PHILOSOPHY_PAGES } from "./philosophy-pages";

export type MovementId =
  | "seven-sages"
  | "ionian"
  | "socratic"
  | "cyrenaic"
  | "megarian"
  | "elian-eretrian"
  | "academy"
  | "peripatos"
  | "cynic"
  | "stoa"
  | "pythagorean"
  | "eleatic"
  | "atomist"
  | "sophist"
  | "sceptic"
  | "epicurean"
  | "other";

export const MOVEMENTS: { id: MovementId; label: string }[] = [
  { id: "seven-sages", label: "Seven Sages" },
  { id: "ionian", label: "Ionian / Milesian" },
  { id: "socratic", label: "Socratic" },
  { id: "cyrenaic", label: "Cyrenaic" },
  { id: "megarian", label: "Megarian" },
  { id: "elian-eretrian", label: "Elian–Eretrian" },
  { id: "academy", label: "Academy" },
  { id: "peripatos", label: "Peripatos" },
  { id: "cynic", label: "Cynic" },
  { id: "stoa", label: "Stoa" },
  { id: "pythagorean", label: "Pythagorean" },
  { id: "eleatic", label: "Eleatic" },
  { id: "atomist", label: "Atomist" },
  { id: "sophist", label: "Sophist" },
  { id: "sceptic", label: "Sceptic" },
  { id: "epicurean", label: "Epicurean (Garden)" },
  { id: "other", label: "Unaffiliated" },
];

interface PhilosopherMeta {
  movement: MovementId;
  /** Wikidata entity id for owl:sameAs links (only confident matches). */
  qid?: string;
  /** Founder of a movement, per Diogenes Laertius / tradition. */
  founderOf?: MovementId;
  aliases?: string[];
}

/** Keyed by the exact philosopher name used in the corpus. */
export const PHILOSOPHER_META: Record<string, PhilosopherMeta> = {
  Thales: { movement: "seven-sages", qid: "Q36303", founderOf: "ionian" },
  Solon: { movement: "seven-sages", qid: "Q133337" },
  Chilon: { movement: "seven-sages", qid: "Q34601" },
  Pittacus: { movement: "seven-sages", qid: "Q311835" },
  Bias: { movement: "seven-sages", qid: "Q365977" },
  Cleobulus: { movement: "seven-sages", qid: "Q365950" },
  Periander: { movement: "seven-sages", qid: "Q328793" },
  Anacharsis: { movement: "seven-sages", qid: "Q325026" },
  Myson: { movement: "seven-sages", qid: "Q920354" },
  Epimenides: { movement: "other", qid: "Q319406" },
  Pherecydes: { movement: "other", qid: "Q311485" },
  Anaximander: { movement: "ionian", qid: "Q42458" },
  Anaximenes: { movement: "ionian", qid: "Q80612" },
  Anaxagoras: { movement: "ionian", qid: "Q83041" },
  Archelaus: { movement: "ionian", qid: "Q343607" },
  Socrates: { movement: "socratic", qid: "Q913", founderOf: "socratic" },
  Xenophon: { movement: "socratic", qid: "Q129772" },
  Aeschines: { movement: "socratic", qid: "Q409647" },
  Aristippus: { movement: "cyrenaic", qid: "Q189506", founderOf: "cyrenaic" },
  Phaedo: {
    movement: "elian-eretrian",
    qid: "Q380190",
    founderOf: "elian-eretrian",
  },
  Euclides: { movement: "megarian", qid: "Q312682", founderOf: "megarian" },
  Stilpo: { movement: "megarian", qid: "Q381048" },
  Crito: { movement: "socratic", qid: "Q934471" },
  Simon: { movement: "socratic", qid: "Q3780768" },
  // Q1364945 is Plato's brother; the enwiki article records D.L. 2.124's
  // nine dialogues under that identity, so the identification is
  // documented, not guessed.
  Glaucon: { movement: "socratic", qid: "Q1364945" },
  Simmias: { movement: "socratic", qid: "Q928470" },
  Cebes: { movement: "socratic", qid: "Q965144" },
  "Menedemus of Eretria": { movement: "elian-eretrian", qid: "Q990589" },
  Plato: { movement: "academy", qid: "Q859", founderOf: "academy" },
  Speusippus: { movement: "academy", qid: "Q325955" },
  Xenocrates: { movement: "academy", qid: "Q214121" },
  Polemo: { movement: "academy", qid: "Q553856" },
  "Crates of Athens": { movement: "academy", qid: "Q712755" },
  Crantor: { movement: "academy", qid: "Q434773" },
  Arcesilaus: { movement: "academy", qid: "Q73527" },
  Bion: { movement: "academy", qid: "Q359231" },
  Lacydes: { movement: "academy", qid: "Q386261" },
  Carneades: { movement: "academy", qid: "Q284994" },
  Clitomachus: { movement: "academy", qid: "Q466951" },
  Aristotle: { movement: "peripatos", qid: "Q868", founderOf: "peripatos" },
  Theophrastus: { movement: "peripatos", qid: "Q160362" },
  Strato: { movement: "peripatos", qid: "Q316353" },
  Lyco: { movement: "peripatos", qid: "Q934510" },
  "Demetrius of Phalerum": { movement: "peripatos", qid: "Q313286" },
  "Heraclides Ponticus": { movement: "peripatos", qid: "Q316334" },
  Antisthenes: { movement: "cynic", qid: "Q179149", founderOf: "cynic" },
  "Diogenes of Sinope": { movement: "cynic", qid: "Q59180" },
  Monimus: { movement: "cynic", qid: "Q942439" },
  Onesicritus: { movement: "cynic", qid: "Q447476" },
  "Crates of Thebes": { movement: "cynic", qid: "Q317947" },
  Metrocles: { movement: "cynic", qid: "Q1287486" },
  Hipparchia: { movement: "cynic", qid: "Q235494" },
  Menippus: { movement: "cynic", qid: "Q452077" },
  "Menedemus the Cynic": { movement: "cynic", qid: "Q925732" },
  "Zeno of Citium": { movement: "stoa", qid: "Q171303", founderOf: "stoa" },
  "Ariston of Chios": { movement: "stoa", qid: "Q646951" },
  Herillus: { movement: "stoa", qid: "Q248975" },
  "Dionysius the Renegade": { movement: "stoa", qid: "Q969976" },
  Cleanthes: { movement: "stoa", qid: "Q310149" },
  Sphaerus: { movement: "stoa", qid: "Q2311453" },
  Chrysippus: { movement: "stoa", qid: "Q211411" },
  Pythagoras: {
    movement: "pythagorean",
    qid: "Q10261",
    founderOf: "pythagorean",
  },
  Empedocles: { movement: "pythagorean", qid: "Q83375" },
  Epicharmus: { movement: "pythagorean", qid: "Q312410" },
  Archytas: { movement: "pythagorean", qid: "Q202001" },
  Alcmaeon: { movement: "pythagorean", qid: "Q188332" },
  Hippasus: { movement: "pythagorean", qid: "Q298860" },
  Philolaus: { movement: "pythagorean", qid: "Q212338" },
  Eudoxus: { movement: "pythagorean", qid: "Q185150" },
  Heraclitus: { movement: "other", qid: "Q41155" },
  Xenophanes: { movement: "eleatic", qid: "Q131671", founderOf: "eleatic" },
  Parmenides: { movement: "eleatic", qid: "Q125551" },
  Melissus: { movement: "eleatic", qid: "Q233711" },
  "Zeno of Elea": { movement: "eleatic", qid: "Q132157" },
  Leucippus: { movement: "atomist", qid: "Q165589", founderOf: "atomist" },
  Democritus: { movement: "atomist", qid: "Q41980" },
  Protagoras: { movement: "sophist", qid: "Q169243" },
  "Diogenes of Apollonia": { movement: "ionian", qid: "Q191964" },
  Anaxarchus: { movement: "atomist", qid: "Q366031" },
  Pyrrho: { movement: "sceptic", qid: "Q192313", founderOf: "sceptic" },
  Timon: { movement: "sceptic", qid: "Q280872" },
  Epicurus: { movement: "epicurean", qid: "Q43216", founderOf: "epicurean" },
};

export type EdgeType = "teacherOf" | "influenced" | "spouseOf";

export interface KgEdge {
  from: string;
  to: string;
  type: EdgeType;
  /** D.L. citation (book.section, Hicks numbering) supporting the relation. */
  ref?: string;
}

/**
 * Curated relations, following Diogenes Laertius' own successions
 * (Ionian succession 1.13–14; Italian succession 1.15).
 * `teacherOf` = D.L. reports a direct teacher–pupil relation;
 * `influenced` = succession or doctrinal transmission without direct teaching.
 */
export const KG_EDGES: KgEdge[] = [
  // Ionian succession
  { from: "Thales", to: "Anaximander", type: "teacherOf", ref: "1.13" },
  { from: "Anaximander", to: "Anaximenes", type: "teacherOf", ref: "2.3" },
  { from: "Anaximenes", to: "Anaxagoras", type: "teacherOf", ref: "2.6" },
  { from: "Anaxagoras", to: "Archelaus", type: "teacherOf", ref: "2.16" },
  { from: "Archelaus", to: "Socrates", type: "teacherOf", ref: "2.16" },
  {
    from: "Anaximenes",
    to: "Diogenes of Apollonia",
    type: "teacherOf",
    ref: "9.57",
  },
  // Socrates' circle
  { from: "Socrates", to: "Xenophon", type: "teacherOf", ref: "2.48" },
  { from: "Socrates", to: "Aeschines", type: "teacherOf", ref: "2.60" },
  { from: "Socrates", to: "Aristippus", type: "teacherOf", ref: "2.65" },
  { from: "Socrates", to: "Phaedo", type: "teacherOf", ref: "2.105" },
  { from: "Socrates", to: "Euclides", type: "teacherOf", ref: "2.106" },
  { from: "Socrates", to: "Crito", type: "teacherOf", ref: "2.121" },
  { from: "Socrates", to: "Simon", type: "teacherOf", ref: "2.122" },
  { from: "Socrates", to: "Glaucon", type: "teacherOf", ref: "2.124" },
  { from: "Socrates", to: "Simmias", type: "teacherOf", ref: "2.124" },
  { from: "Socrates", to: "Cebes", type: "teacherOf", ref: "2.125" },
  { from: "Socrates", to: "Plato", type: "teacherOf", ref: "3.5" },
  { from: "Socrates", to: "Antisthenes", type: "teacherOf", ref: "6.2" },
  // Megarian / Elian-Eretrian lines
  { from: "Euclides", to: "Stilpo", type: "teacherOf", ref: "2.113" },
  {
    from: "Stilpo",
    to: "Menedemus of Eretria",
    type: "teacherOf",
    ref: "2.126",
  },
  {
    from: "Phaedo",
    to: "Menedemus of Eretria",
    type: "influenced",
    ref: "2.126",
  },
  // Academy
  { from: "Plato", to: "Speusippus", type: "teacherOf", ref: "4.1" },
  { from: "Plato", to: "Xenocrates", type: "teacherOf", ref: "4.6" },
  { from: "Plato", to: "Aristotle", type: "teacherOf", ref: "5.1" },
  {
    from: "Plato",
    to: "Heraclides Ponticus",
    type: "teacherOf",
    ref: "5.86",
  },
  { from: "Xenocrates", to: "Polemo", type: "teacherOf", ref: "4.16" },
  { from: "Xenocrates", to: "Crantor", type: "teacherOf", ref: "4.24" },
  { from: "Polemo", to: "Crates of Athens", type: "teacherOf", ref: "4.21" },
  { from: "Polemo", to: "Crantor", type: "teacherOf", ref: "4.24" },
  { from: "Polemo", to: "Zeno of Citium", type: "teacherOf", ref: "7.25" },
  { from: "Crantor", to: "Arcesilaus", type: "teacherOf", ref: "4.29" },
  { from: "Theophrastus", to: "Arcesilaus", type: "influenced", ref: "4.29" },
  { from: "Arcesilaus", to: "Lacydes", type: "teacherOf", ref: "4.59" },
  { from: "Lacydes", to: "Carneades", type: "influenced", ref: "4.62" },
  { from: "Carneades", to: "Clitomachus", type: "teacherOf", ref: "4.67" },
  { from: "Crates of Athens", to: "Bion", type: "teacherOf", ref: "4.51" },
  { from: "Theophrastus", to: "Bion", type: "teacherOf", ref: "4.52" },
  // Peripatos
  { from: "Aristotle", to: "Theophrastus", type: "teacherOf", ref: "5.36" },
  { from: "Theophrastus", to: "Strato", type: "teacherOf", ref: "5.58" },
  { from: "Strato", to: "Lyco", type: "teacherOf", ref: "5.65" },
  {
    from: "Theophrastus",
    to: "Demetrius of Phalerum",
    type: "teacherOf",
    ref: "5.75",
  },
  // Cynics
  {
    from: "Antisthenes",
    to: "Diogenes of Sinope",
    type: "teacherOf",
    ref: "6.21",
  },
  { from: "Diogenes of Sinope", to: "Monimus", type: "influenced", ref: "6.82" },
  {
    from: "Diogenes of Sinope",
    to: "Onesicritus",
    type: "teacherOf",
    ref: "6.84",
  },
  {
    from: "Diogenes of Sinope",
    to: "Crates of Thebes",
    type: "teacherOf",
    ref: "6.85",
  },
  { from: "Crates of Thebes", to: "Metrocles", type: "teacherOf", ref: "6.94" },
  { from: "Crates of Thebes", to: "Hipparchia", type: "spouseOf", ref: "6.96" },
  { from: "Crates of Thebes", to: "Menippus", type: "influenced", ref: "6.99" },
  // Stoa
  { from: "Crates of Thebes", to: "Zeno of Citium", type: "teacherOf", ref: "7.2" },
  { from: "Stilpo", to: "Zeno of Citium", type: "teacherOf", ref: "7.24" },
  { from: "Zeno of Citium", to: "Cleanthes", type: "teacherOf", ref: "7.168" },
  {
    from: "Zeno of Citium",
    to: "Ariston of Chios",
    type: "teacherOf",
    ref: "7.160",
  },
  { from: "Zeno of Citium", to: "Herillus", type: "teacherOf", ref: "7.165" },
  {
    from: "Zeno of Citium",
    to: "Dionysius the Renegade",
    type: "teacherOf",
    ref: "7.166",
  },
  { from: "Zeno of Citium", to: "Sphaerus", type: "teacherOf", ref: "7.177" },
  { from: "Cleanthes", to: "Sphaerus", type: "teacherOf", ref: "7.177" },
  { from: "Cleanthes", to: "Chrysippus", type: "teacherOf", ref: "7.179" },
  // Italian / Pythagorean succession
  { from: "Pherecydes", to: "Pythagoras", type: "teacherOf", ref: "1.118" },
  { from: "Pythagoras", to: "Empedocles", type: "influenced", ref: "8.54" },
  { from: "Pythagoras", to: "Epicharmus", type: "teacherOf", ref: "8.78" },
  { from: "Pythagoras", to: "Alcmaeon", type: "teacherOf", ref: "8.83" },
  { from: "Pythagoras", to: "Hippasus", type: "influenced", ref: "8.84" },
  { from: "Pythagoras", to: "Philolaus", type: "influenced", ref: "8.84" },
  { from: "Pythagoras", to: "Archytas", type: "influenced", ref: "8.79" },
  { from: "Archytas", to: "Eudoxus", type: "teacherOf", ref: "8.86" },
  { from: "Philolaus", to: "Plato", type: "influenced", ref: "8.84" },
  // Eleatics, Atomists, Sceptics
  { from: "Xenophanes", to: "Parmenides", type: "teacherOf", ref: "9.21" },
  { from: "Parmenides", to: "Zeno of Elea", type: "teacherOf", ref: "9.25" },
  { from: "Parmenides", to: "Melissus", type: "teacherOf", ref: "9.24" },
  { from: "Zeno of Elea", to: "Leucippus", type: "teacherOf", ref: "9.30" },
  { from: "Leucippus", to: "Democritus", type: "teacherOf", ref: "9.34" },
  { from: "Democritus", to: "Protagoras", type: "teacherOf", ref: "9.50" },
  { from: "Democritus", to: "Anaxarchus", type: "influenced", ref: "9.58" },
  { from: "Anaxarchus", to: "Pyrrho", type: "teacherOf", ref: "9.61" },
  { from: "Pyrrho", to: "Timon", type: "teacherOf", ref: "9.109" },
  { from: "Stilpo", to: "Timon", type: "teacherOf", ref: "9.109" },
  { from: "Democritus", to: "Epicurus", type: "influenced", ref: "10.2" },
];

export interface KgNode {
  name: string;
  movement: MovementId;
  movementLabel: string;
  school: string;
  book: number;
  chapter: string;
  sectionCount: number;
  firstId: string;
  qid?: string;
  founderOf?: string;
  /** VIAF authority id. */
  viaf?: string;
  /** Encyclopaedia Britannica article path. */
  britannica?: string;
  /** English Wikipedia title; DBpedia URI derives from it. */
  enwiki?: string;
  /** InPhO entity path (Indiana Philosophy Ontology), e.g. "thinker/3724". */
  inpho?: string;
  /** Philosophy Pages site path (philosophypages.com), e.g. "ph/plat.htm". */
  philosophyPages?: string;
}

export interface KnowledgeGraph {
  nodes: KgNode[];
  edges: KgEdge[];
  movements: { id: MovementId; label: string }[];
}

let cached: KnowledgeGraph | null = null;

export function getKnowledgeGraph(): KnowledgeGraph {
  if (cached) return cached;
  const movementLabel = new Map(MOVEMENTS.map((m) => [m.id, m.label]));
  const nodes: KgNode[] = philosophers
    .filter((p) => p.name !== "Prologue")
    .map((p) => {
      const meta = PHILOSOPHER_META[p.name];
      const movement: MovementId = meta?.movement ?? "other";
      const node: KgNode = {
        name: p.name,
        movement,
        movementLabel: movementLabel.get(movement) ?? "Unaffiliated",
        school: p.school,
        book: p.book,
        chapter: p.chapter,
        sectionCount: p.sectionCount,
        firstId: p.firstId,
      };
      if (meta?.qid) node.qid = meta.qid;
      const links = EXTERNAL_LINKS[p.name];
      if (links?.viaf) node.viaf = links.viaf;
      if (links?.britannica) node.britannica = links.britannica;
      if (links?.enwiki) node.enwiki = links.enwiki;
      if (links?.inpho) node.inpho = links.inpho;
      const pp = PHILOSOPHY_PAGES[p.name];
      if (pp) node.philosophyPages = pp;
      if (meta?.founderOf) {
        node.founderOf = movementLabel.get(meta.founderOf) ?? meta.founderOf;
      }
      return node;
    });
  const names = new Set(nodes.map((n) => n.name));
  const edges = KG_EDGES.filter((e) => {
    const valid = names.has(e.from) && names.has(e.to);
    return valid;
  });
  cached = { nodes, edges, movements: MOVEMENTS };
  return cached;
}

/** Wikidata (qid) and English Wikipedia (enwiki) links for a philosopher. */
export function externalLinksFor(name: string): {
  qid?: string;
  enwiki?: string;
} {
  const out: { qid?: string; enwiki?: string } = {};
  const meta = PHILOSOPHER_META[name];
  if (meta?.qid) out.qid = meta.qid;
  const links = EXTERNAL_LINKS[name];
  if (links?.enwiki) out.enwiki = links.enwiki;
  return out;
}

/** Direct graph neighbours of a philosopher (both directions). */
export function kgNeighbors(name: string): string[] {
  const g = getKnowledgeGraph();
  const out = new Set<string>();
  for (const e of g.edges) {
    if (e.from === name) out.add(e.to);
    if (e.to === name) out.add(e.from);
  }
  return [...out];
}

let detectionTable: Map<string, string> | null = null;

/**
 * Lookup table from lowercase name variants to canonical philosopher names.
 * Bare first names ("Zeno", "Diogenes", "Crates", ...) are only included
 * when they are unambiguous across the corpus.
 */
function getDetectionTable(): Map<string, string> {
  if (detectionTable) return detectionTable;
  const names = getKnowledgeGraph().nodes.map((n) => n.name);
  const table = new Map<string, string>();
  for (const name of names) table.set(name.toLowerCase(), name);
  const firstWordCount = new Map<string, number>();
  for (const name of names) {
    const first = name.split(" ")[0]!.toLowerCase();
    firstWordCount.set(first, (firstWordCount.get(first) ?? 0) + 1);
  }
  for (const name of names) {
    const first = name.split(" ")[0]!.toLowerCase();
    if (firstWordCount.get(first) === 1 && !table.has(first)) {
      table.set(first, name);
    }
  }
  detectionTable = table;
  return table;
}

/** Detect philosopher names mentioned in a free-text query. */
export function detectPhilosophers(query: string): string[] {
  const table = getDetectionTable();
  const q = query.toLowerCase();
  const matched = new Set<string>();
  // Longest variants first so "zeno of citium" wins over "zeno".
  const variants = [...table.keys()].sort((a, b) => b.length - a.length);
  let remaining = q;
  for (const variant of variants) {
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|[^\\p{L}])${escaped}(?:[^\\p{L}]|$)`, "u");
    if (re.test(remaining)) {
      matched.add(table.get(variant)!);
      remaining = remaining.replace(new RegExp(escaped, "g"), " ");
    }
  }
  return [...matched];
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
