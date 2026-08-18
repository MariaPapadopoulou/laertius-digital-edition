/**
 * The curated testament layer: the six wills Diogenes Laertius quotes
 * verbatim in the Lives - Plato (3.41–43), and the great Peripatetic and
 * Epicurean series: Aristotle (5.11–16), Theophrastus (5.51–57), Strato
 * (5.61–64), Lyco (5.69–74), and Epicurus (10.16–21). D.L. is the sole
 * surviving source for all six; the four Peripatetic wills almost certainly
 * come from the collection of Ariston of Ceos, whom D.L. cites by name only
 * for Strato's (5.64).
 *
 * Like the epistles, this is hand-curated TypeScript, deliberately not
 * auto-detected: only documents D.L. quotes as an actual will text qualify
 * ("we have come across his will, which runs thus"), never mere reports
 * that someone left property. Each entry carries the will's full section
 * span, a verbatim Hicks English opening with the Greek incipit, and the
 * curated cast - beneficiaries, executors, witnesses - exactly as the text
 * names them.
 *
 * Node-vs-literal policy (the never-guess-a-homonym rule): beneficiaries,
 * executors and witnesses are ALWAYS literals in the LOD export - the wills
 * teem with dangerous bare homonyms (the slave Demetrius in Lyco's will vs.
 * Demetrius of Phalerum; "Epicurus son of Metrodorus" freed in Epicurus'
 * own will; "Strato son of Arcesilaus" witnessing Theophrastus' third
 * copy). Only `involves` links to graph nodes, and it is restricted to
 * corpus philosophers whose identification in the will is scholarly
 * consensus - as it happens, each such link is the testator's successor
 * as head of the school (Plato→Speusippus, Aristotle→Theophrastus,
 * Theophrastus→Strato, Strato→Lyco), so the wills trace the successions.
 * Lyco's successor Ariston of Ceos and Epicurus' successor Hermarchus have
 * no Life of their own, so those two wills link no one.
 *
 * There is no authenticity axis: unlike the letters, all six wills are
 * generally accepted as genuine documents (the Peripatetic series is among
 * the best-attested documentary material in D.L.), so the field would carry
 * a single value.
 *
 * The verbatim-against-corpus checks live in scripts/src/validate-testaments.ts.
 */
import { corpus, sectionById } from "./corpus";

export interface Testament {
  /** Stable id: the testator's name, lowercased. */
  id: string;
  /** The testator - always a philosopher with a Life of his own. */
  philosopher: string;
  /** Section id (book.chapter.section) of the will's opening, where both
   * the English and Greek excerpts live. Always equals sections[0]. */
  ref: string;
  /** The full ordered span of sections the will occupies. */
  sections: string[];
  /** Verbatim Greek incipit - the will's opening formula. */
  grc: string;
  /** Verbatim Hicks English opening. */
  en: string;
  /** One-line editorial summary (curator's words). */
  gloss: string;
  /** Principal legatees, exactly as the text names them. */
  beneficiaries: string[];
  /** Named executors/epimeletai; [] when the will appoints none (Lyco
   * charges Bulo and Callinus with the funeral but names no executors;
   * Epicurus' heirs hold the estate as trustees themselves). */
  executors: string[];
  /** Named witnesses; [] when the text records none. */
  witnesses: string[];
  /** Curated key provisions (curator's words, not the text's). */
  provisions: string[];
  /** Corpus philosophers certainly identified in the will (see the header
   * policy) - linked as graph nodes in the LOD export. */
  involves: string[];
  /** Curator's note - identifications, transmission, exclusions. */
  note?: string;
}

const RAW_TESTAMENTS: Testament[] = [
  {
    id: "plato",
    philosopher: "Plato",
    ref: "3.1.41",
    sections: ["3.1.41", "3.1.42", "3.1.43"],
    grc: "Τάδε κατέλιπε Πλάτων καὶ διέθετο· τὸ ἐν Ἰφιστιαδῶν χωρίον, ᾧ γείτων βορρᾶθεν ἡ ὁδὸς ἡ ἐκ τοῦ Κηφισιᾶσιν ἱεροῦ, νοτόθεν τὸ Ἡράκλειον τὸ ἐν Ἰφιστιαδῶν",
    en: "These things have been left and devised by Plato: the estate in Iphistiadae, bounded on the north by the road from the temple at Cephisia, on the south by the temple of Heracles in Iphistiadae, on the east by the property of Archestratus of Phrearrhi, on the west by that of Philippus of Chollidae: this it shall be unlawful for anyone to sell or alienate, but it shall be the property of the boy Adeimantus to all intents and purposes",
    gloss:
      "Plato entails his two estates on the boy Adeimantus, frees the servant Artemis, and names seven executors - closing with the proud declaration that he owes no one anything.",
    beneficiaries: ["Adeimantus"],
    executors: [
      "Leosthenes",
      "Speusippus",
      "Demetrius",
      "Hegias",
      "Eurymedon",
      "Callimachus",
      "Thrasippus",
    ],
    witnesses: [],
    provisions: [
      "The Iphistiadae estate is entailed on the boy Adeimantus and may never be sold or alienated",
      "The Eiresidae estate, bought from Callimachus, with three minae of silver, plate, a gold ring and a gold earring",
      "Artemis the servant is set free; four household servants are left to Adeimantus",
      "Euclides the lapidary owes three minae; 'I owe no one anything'",
    ],
    involves: ["Speusippus"],
    note: "The executor Speusippus is Plato's nephew and successor as head of the Academy. The boy Adeimantus is usually identified as Plato's grand-nephew, named after Plato's brother. No witnesses are recorded.",
  },
  {
    id: "aristotle",
    philosopher: "Aristotle",
    ref: "5.1.11",
    sections: ["5.1.11", "5.1.12", "5.1.13", "5.1.14", "5.1.15", "5.1.16"],
    grc: "Ἔσται μὲν εὖ· ἐὰν δέ τι συμβαίνῃ, τάδε διέθετο Ἀριστοτέλης· ἐπίτροπον μὲν εἶναι πάντων καὶ διὰ παντὸς Ἀντίπατρον·",
    en: "All will be well; but, in case anything should happen, Aristotle has made these dispositions. Antipater is to be executor in all matters and in general;",
    gloss:
      "Aristotle makes Antipater executor-in-chief, betroths his daughter to Nicanor, provides generously for Herpyllis, frees his servants, and orders Pythias' bones laid beside his own.",
    beneficiaries: ["Nicanor", "Herpyllis", "Nicomachus"],
    executors: [
      "Antipater",
      "Aristomenes",
      "Timarchus",
      "Hipparchus",
      "Dioteles",
      "Theophrastus",
    ],
    witnesses: [],
    provisions: [
      "Antipater is executor in all matters; until Nicanor arrives, five friends care for the children, Herpyllis and the estate - Theophrastus joining them if he consents",
      "The daughter shall marry Nicanor when she comes of age; if anything should befall him first, Theophrastus may take his place",
      "Herpyllis, 'in memory of the steady affection she has borne me', receives a talent of silver, three handmaids, and a furnished house in Chalcis or Stagira",
      "Ambracis, Thale, Simon, Tycho, Philo and Olympius are freed or provided for; none of the servants who waited on him may be sold",
      "Statues of Nicanor, Proxenus and Nicanor's mother are to be set up, and the bust of Arimnestus, 'to be a memorial of him seeing that he died childless'",
      "The bones of Pythias are to be laid with his, as she herself instructed",
    ],
    involves: ["Theophrastus"],
    note: "D.L. introduces the text with 'we have come across his will' (5.11). Like the rest of the Peripatetic series, it almost certainly derives from the collection of Ariston of Ceos, whom D.L. cites by name only for Strato's will (5.64). The unnamed daughter is Pythias; the boy Nicomachus is Aristotle's son; Nicanor was his ward, the son of Proxenus.",
  },
  {
    id: "theophrastus",
    philosopher: "Theophrastus",
    ref: "5.2.51",
    sections: [
      "5.2.51",
      "5.2.52",
      "5.2.53",
      "5.2.54",
      "5.2.55",
      "5.2.56",
      "5.2.57",
    ],
    grc: "Ἔσται μὲν εὖ· ἐὰν δέ τι συμβῇ, τάδε διατίθεμαι· τὰ μὲν οἴκοι ὑπάρχοντα πάντα δίδωμι Μελάντῃ καὶ Παγκρέοντι τοῖς υἱοῖς Λέοντος.",
    en: "All will be well; but in case anything should happen, I make these dispositions. I give and bequeath all my property at home to Melantes and Pancreon, the sons of Leon.",
    gloss:
      "Theophrastus leaves the garden and walk to ten friends in common 'like a temple', his whole library to Neleus, and directs his own burial in the garden without extravagance.",
    beneficiaries: ["Melantes", "Pancreon", "Callinus", "Neleus", "Pompylus"],
    executors: [
      "Hipparchus",
      "Neleus",
      "Strato",
      "Callinus",
      "Demotimus",
      "Callisthenes",
      "Ctesarchus",
    ],
    witnesses: [
      "Callippus of Pallene",
      "Philomelus of Euonymaea",
      "Lysander of Hyba",
      "Philo of Alopece",
    ],
    provisions: [
      "The Museum and its cloisters are to be rebuilt, the bust of Aristotle restored, and the maps of the world replaced",
      "The estate at Stagira goes to Callinus, the whole library to Neleus",
      "The garden, the walk and the houses adjoining the garden belong to ten named friends in common, 'like a temple in joint possession', to study and philosophize in",
      "Burial in a corner of the garden without unnecessary outlay; Pompylus, already free, continues as keeper",
      "Molon, Timon and Parmeno are freed at once; Manes and Callias after four years' blameless work in the garden",
      "Out of the trust funds with Hipparchus, Melantes and Pancreon receive a talent each",
    ],
    involves: ["Strato"],
    note: "The executor Strato is Theophrastus' successor as head of the school. Three sealed copies were deposited (5.57); among the third copy's witnesses is 'Strato the son of Arcesilaus of Lampsacus' - the philosopher himself. The bequest of the library to Neleus is the hinge of Strabo's famous story of the fate of Aristotle's books.",
  },
  {
    id: "strato",
    philosopher: "Strato",
    ref: "5.3.61",
    sections: ["5.3.61", "5.3.62", "5.3.63", "5.3.64"],
    grc: "Τάδε διατίθεμαι, ἐάν τι πάσχω· τὰ μὲν οἴκοι καταλείπω πάντα Λαμπυρίωνι καὶ Ἀρκεσιλάῳ.",
    en: "In case anything should happen to me I make these dispositions. All the goods in my house I give and bequeath to Lampyrio and Arcesilaus.",
    gloss:
      "Strato leaves his household goods to Lampyrio and Arcesilaus and the school, with all his books, to Lyco - the one will whose source D.L. names: the Collection of Ariston of Ceos.",
    beneficiaries: ["Lampyrio", "Arcesilaus", "Lyco", "Epicrates"],
    executors: [
      "Olympichus",
      "Aristides",
      "Mnesigenes",
      "Hippocrates",
      "Epicrates",
      "Gorgylus",
      "Diocles",
      "Lyco",
      "Athanes",
    ],
    witnesses: [],
    provisions: [
      "All the goods in the house to Lampyrio and Arcesilaus; the funeral 'without extravagance on the one hand or meanness on the other'",
      "The school passes to Lyco, 'since of the rest some are too old and others too busy', with all the books except Strato's own writings, and the furniture of the dining-hall",
      "Epicrates receives five hundred drachmas and one of the servants",
      "Diophantus, Diocles and Abus are freed; Simias is given to Arcesilaus; Dromo is freed",
      "Arcesilaus, Olympichus and Lyco settle the accounts and see to the monument",
    ],
    involves: ["Lyco"],
    note: "The legatee of the school is Lyco the philosopher, Strato's successor. D.L. closes: 'Such is the tenor of his will, as it is preserved in the collection of Ariston of Ceos' (5.64) - the only will of the series whose source he names. The Arcesilaus of the will is a kinsman, not the Academic.",
  },
  {
    id: "lyco",
    philosopher: "Lyco",
    ref: "5.4.69",
    sections: [
      "5.4.69",
      "5.4.70",
      "5.4.71",
      "5.4.72",
      "5.4.73",
      "5.4.74",
    ],
    grc: "Τάδε διατίθεμαι περὶ τῶν κατʼ ἐμαυτόν, ἐὰν μὴ δυνηθῶ τὴν ἀρρωστίαν ταύτην ὑπενεγκεῖν· τὰ μὲν ἐν οἴκῳ πάντα δίδωμι τοῖς ἀδελφοῖς Ἀστυἀνακτι καὶ Λύκωνι.",
    en: "These are my dispositions concerning my property, in case I should be unable to sustain my present ailment. All the goods in my house I give to my brothers Astyanax and Lyco,",
    gloss:
      "Lyco divides his property between his brother Astyanax and his nephew Lyco, leaves the Peripatus to whichever of his friends will keep the school together, rewards his physicians, and frees his household one by one.",
    beneficiaries: ["Astyanax", "Lyco the nephew"],
    executors: [],
    witnesses: [
      "Callinus of Hermione",
      "Ariston of Ceos",
      "Euphronius of Paeania",
    ],
    provisions: [
      "The household goods go to his brothers Astyanax and Lyco; the property in town and at Aegina to his nephew Lyco, 'because he bears the same name with me' and was treated as a son",
      "The Peripatus is left to those of his friends who will use it - Bulo, Callinus, Ariston, Amphion, Lyco, Pytho, Aristomachus, Heracleus, Lycomedes and his nephew Lyco - to set over it whoever will best keep the school together",
      "The oil from the olive-trees at Aegina goes to the young men, 'that from its use the memory of me and of my benefactor may be kept alive'",
      "The physicians Pasithemis and Medias deserve honour for their attention; Callinus' household receives cups and coverlets",
      "Demetrius, Crito, Micrus, Chares and Syrus are freed with bequests; Agathon is freed after two years, the litter-bearers Ophelio and Poseidonius after four",
      "The unpublished writings go to Callinus, 'that he may carefully edit them'",
    ],
    involves: [],
    note: "No executors are formally appointed: Bulo and Callinus, 'together with their colleagues', are charged with the funeral. The witness Ariston of Ceos is Lyco's own successor as head of the Peripatos - but he has no Life of his own, so he is not linked; the slave Demetrius freed here must not be confused with Demetrius of Phalerum.",
  },
  {
    id: "epicurus",
    philosopher: "Epicurus",
    ref: "10.1.16",
    sections: [
      "10.1.16",
      "10.1.17",
      "10.1.18",
      "10.1.19",
      "10.1.20",
      "10.1.21",
    ],
    grc: "Κατὰ τάδε δίδωμι τὰ ἐμαυτοῦ πάντα Ἀμυνομάχῳ Φιλοκράτους Βατῆθεν καὶ Τιμοκράτει Δημητρίου Ποταμίῳ κατὰ τὴν ἐν τῷ Μητρῴῳ ἀναγεγραμμένην ἑκατέρῳ δόσιν,",
    en: "On this wise I give and bequeath all my property to Amynomachus, son of Philocrates of Bate and Timocrates, son of Demetrius of Potamus, to each severally according to the items of the deed of gift laid up in the Metroön,",
    gloss:
      "Epicurus deeds everything to the Athenians Amynomachus and Timocrates in trust: the Garden for Hermarchus and the school, memorial feasts for himself and Metrodorus, provision for the disciples' children, and freedom for his slaves.",
    beneficiaries: ["Amynomachus", "Timocrates", "Hermarchus"],
    executors: [],
    witnesses: [],
    provisions: [
      "All property passes to Amynomachus and Timocrates by the deed of gift laid up in the Metroön, on trust for Hermarchus and the school",
      "The garden and all that pertains to it are for Hermarchus, his fellow-students in philosophy, and his successors, 'to live and study in'; the house in Melite is Hermarchus' for life",
      "Funeral offerings for his father, mother and brothers; his birthday kept each year on the tenth of Gamelion; the school gathers on the twentieth of every month in memory of himself and Metrodorus",
      "The son of Polyaenus and the children of Metrodorus are maintained, and Metrodorus' daughter dowered, so long as they are guided by Hermarchus",
      "All the books go to Hermarchus; provision is made for Nicanor, 'that none of those members of the school who have rendered service to me... should want for the necessaries of life'",
      "Mys, Nicias and Lycon are set free, and Phaedrium is given her liberty",
    ],
    involves: [],
    note: "Athenian law barred the school itself from inheriting: the two citizens Amynomachus and Timocrates hold the estate as legal trustees, so the will appoints no separate executors. Hermarchus, the designated successor, has no Life of his own and so is not linked; the 'Epicurus son of Metrodorus' provided for in the will is the disciple's son, not the testator.",
  },
];

/** Philosopher names present in the corpus (for node-vs-literal decisions). */
const corpusPhilosophers = new Set<string>();
for (const s of corpus) corpusPhilosophers.add(s.philosopher);

/**
 * Validate structural invariants and return the curated testaments. Throws
 * on duplicate ids, empty fields, malformed or non-contiguous section
 * spans, testators or `involves` names without a Life of their own. The
 * verbatim-against-corpus checks live in the validation script.
 */
let validated: Testament[] | null = null;
export function getTestaments(): Testament[] {
  if (validated) return validated;
  const seen = new Set<string>();
  const refPattern = /^\d+\.[A-Za-z0-9]+\.\d+$/;
  for (const t of RAW_TESTAMENTS) {
    if (seen.has(t.id)) throw new Error(`Duplicate testament id: ${t.id}`);
    seen.add(t.id);
    if (!corpusPhilosophers.has(t.philosopher)) {
      throw new Error(
        `Testament ${t.id}: testator "${t.philosopher}" has no Life in the corpus`,
      );
    }
    if (t.en.trim().length === 0) {
      throw new Error(`Testament ${t.id}: empty English text`);
    }
    if (t.grc.trim().length === 0) {
      throw new Error(`Testament ${t.id}: empty Greek text`);
    }
    if (t.gloss.trim().length === 0) {
      throw new Error(`Testament ${t.id}: empty gloss`);
    }
    if (t.sections.length < 2) {
      throw new Error(`Testament ${t.id}: a will spans multiple sections`);
    }
    if (t.ref !== t.sections[0]) {
      throw new Error(
        `Testament ${t.id}: ref "${t.ref}" is not the first section "${t.sections[0]}"`,
      );
    }
    let prev: number | null = null;
    let chapterKey: string | null = null;
    for (const sec of t.sections) {
      if (!refPattern.test(sec)) {
        throw new Error(`Testament ${t.id}: malformed section id "${sec}"`);
      }
      const parts = sec.split(".");
      const key = `${parts[0]}.${parts[1]}`;
      const n = Number(parts[2]);
      if (chapterKey === null) {
        chapterKey = key;
      } else if (key !== chapterKey) {
        throw new Error(
          `Testament ${t.id}: sections cross chapters (${chapterKey} vs ${key})`,
        );
      }
      if (prev !== null && n !== prev + 1) {
        throw new Error(
          `Testament ${t.id}: sections not contiguous at "${sec}"`,
        );
      }
      prev = n;
    }
    if (t.beneficiaries.length === 0) {
      throw new Error(`Testament ${t.id}: no beneficiaries`);
    }
    if (t.provisions.length === 0) {
      throw new Error(`Testament ${t.id}: no provisions`);
    }
    for (const name of t.involves) {
      if (!corpusPhilosophers.has(name)) {
        throw new Error(
          `Testament ${t.id}: involves "${name}" has no Life in the corpus - only certain philosopher identifications may be linked`,
        );
      }
    }
  }
  validated = RAW_TESTAMENTS;
  return validated;
}

export interface SerializedTestament {
  id: string;
  philosopher: string;
  book: number;
  /** Display citation (Hicks book.section span, e.g. "3.41–43"). */
  ref: string;
  /** Corpus section id of the will's opening, for linking. */
  sectionId: string | null;
  sections: string[];
  grc: string;
  en: string;
  gloss: string;
  beneficiaries: string[];
  executors: string[];
  witnesses: string[];
  provisions: string[];
  involves: string[];
  note?: string;
}

/**
 * Testament section ids are book.chapter.section; the display / citation
 * form is Hicks' book.firstSection–lastSection (D.L. numbers sections
 * continuously through each book).
 */
export function testamentRefForDisplay(t: Testament): string {
  const [book, , first] = t.ref.split(".");
  const last = t.sections[t.sections.length - 1]!.split(".")[2];
  return `${book}.${first}–${last}`;
}

function serialize(t: Testament): SerializedTestament {
  return {
    id: t.id,
    philosopher: t.philosopher,
    book: Number(t.ref.split(".")[0]),
    ref: testamentRefForDisplay(t),
    sectionId: sectionById.has(t.ref) ? t.ref : null,
    sections: t.sections,
    grc: t.grc,
    en: t.en,
    gloss: t.gloss,
    beneficiaries: t.beneficiaries,
    executors: t.executors,
    witnesses: t.witnesses,
    provisions: t.provisions,
    involves: t.involves,
    ...(t.note ? { note: t.note } : {}),
  };
}

/** The six wills in corpus (reading) order. */
export function listTestaments(): SerializedTestament[] {
  return getTestaments().map(serialize);
}
