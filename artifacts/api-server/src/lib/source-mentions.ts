/**
 * Curated text-tagging opt-in for the minted sources-index authorities.
 *
 * The sources index (529 workbook rows -> 253 groups) mints ~121
 * `lo:Source` nodes for authorities the claims layer never names. Those
 * nodes are deliberately NOT fed to the gazetteer wholesale - the
 * bibliographic index is full of bare homonyms (Zeno, Heraclides,
 * Apollodorus, ...) that would wreck the tagging layer. Instead, this
 * module opts individual minted authorities in, each with curator-verified
 * Hicks surfaces and the Hicks `book.section` references where the surface
 * may tag. Every (surface, ref) pair was checked against the Hicks text at
 * curation time (July 2026); the resulting tags are pinned by
 * validate-annotations.
 *
 * Scope policy: a surface tags ONLY inside the sections the workbook cites
 * for that authority (plus the rare curated `extra` section where Hicks
 * names the same authority outside the workbook's reference list, e.g.
 * Seleucus the grammarian at 9.12). Occurrences of the same name
 * elsewhere stay untagged - even for unambiguous bearers like Pisistratus
 * the tyrant (cited as a source only for his letter at 1.53) - because
 * only the cited sections were verified. Broadening a scope is a curation
 * act: verify each new section first.
 *
 * The gazetteer SUPPRESSES its automatic surface generation for every
 * label listed here (see gazetteer.ts) and registers exactly the surfaces
 * below as section-scoped entries. That is what makes bare-name surfaces
 * like "Diodorus" (also "Diodorus of Ephesus"), "Croton" (also the city)
 * and "Eleusis" (also the deme) safe: the explicit entry carries its
 * scope, and annotate.ts prefers a scope-matching entry over an unscoped
 * one for the same surface.
 *
 * Deliberately NOT opted in (the node still exists in LOD; it just tags
 * nothing):
 *  - no-reference groups (nothing to scope to): Anticlides, Antileon,
 *    Apelles, Apollophanes, Chamaeleon, Lobon, Antipater of Tyre,
 *    "Antipater of Tyre or Tarsus". Hecataeus of Abdera left this list
 *    in July 2026: Hicks names him in full at 9.69 (a curated extra
 *    section), and the Sceptic roster (school-members.ts) and
 *    succession-links layer need his node in the tagged pool;
 *  - authorities whose name never appears in Hicks' translation at the
 *    cited sections (Hicks translates or paraphrases them away):
 *    Anaxilaides, Choerilus, Clitarchus, Demodocus of Leros, Evanthes,
 *    Polycrates, Posidippus, Telecleides, Theognis, Timotheus of Miletus,
 *    Zoilus of Perga, Polemon of Ilium (5.85 has bare "Polemo", which is
 *    the philosopher's surface);
 *  - bare-name homonyms where the cited surface belongs to somebody else
 *    or to several bearers at once: Antipater of Tarsus (bare "Antipater"
 *    = Antipater of Sidon problem, see greek-names.ts), Anaximenes of
 *    Lampsacus, Apollonius Molon, Athenodorus of Tarsus, Diogenes of
 *    Ptolemais / of Seleucia / of Tarsus, "Dionysius of Halicarnassus
 *    (?)", "Herodotus the Epicurean" (identity murky), "Theodorus (of
 *    Athens?)", "Archytas the Architect", "Aristippus or
 *    Pseudo-Aristippus" and "Aristippus the Cyrenaic" (pseudo-authorship
 *    doubt), Agrippa (documented source/person double node, tagged via
 *    the person node).
 *
 * The Apollodorus homonyms (of Seleucia, of Cyzicus, the Arithmetician)
 * ARE opted in since the occurrence-level split of July 2026: every
 * "Apollodorus" occurrence in the text was classified by bearer, so the
 * bare Stoic citations of book 7 can safely tag the Seleucian. The
 * chronographer (person/apollodorus) and the Epicurean Kepotyrannos
 * (claim source) are the remaining bearers - their scoped entries live
 * in gazetteer.ts (Apollodorus split) and greek-names.ts.
 *
 * `hicksNames` records the Hicks spelling when it differs from the group
 * label (Potamon -> "Potamo"); it flows into the LOD node as an extra
 * name variant and is usually also the tag surface.
 *
 * Greek declensions: a mention with `grcRefs` opts its label's Greek
 * paradigm (GREEK_NAMES spec in greek-names.ts, keyed by the label) into
 * section-scoped Greek tagging via the source-mentions Greek block in
 * gazetteer.ts. Auto surface generation for these labels stays
 * suppressed in BOTH languages, so the ONLY Greek tagging sites are the
 * grcRefs sections, each verified against the Greek text (July 2026):
 * refs whose Greek section has no form of the name (Hicks paraphrase)
 * are deliberately absent from grcRefs. The 2026-07 coverage audit
 * re-pointed four workbook refs that sat one section off our split
 * (Hieronymus 9.16, Dicaearchus 3.4, Eubulides 2.41, Archedemus 7.134);
 * their "no Greek form" notes were artifacts of that shift, and each
 * corrected section carries the Greek nominative, so they now appear in
 * grcRefs after all. The second pass (July
 * 2026) curated every remaining label; the only mention still without
 * grcRefs is Olympiodorus, whose 6.23 Greek reads Ἀθηνόδωρος.
 * Exception: the Apollodorus homonyms get scoped Greek forms via the
 * curated block in gazetteer.ts (Apollodorus split), NOT via grcRefs.
 */
import { corpus } from "./corpus";

export interface SourceMentionSurface {
  /** Verbatim Hicks surface (case-sensitive, matched with word bounds). */
  surface: string;
  /** Hicks book.section refs (workbook numbering) where it may tag. */
  refs: string[];
}

export interface SourceMention {
  /** Minted sources-index group label (post-SOURCE_LABEL_CANON). */
  label: string;
  /** Hicks name variants that differ from the label (LOD name nodes). */
  hicksNames?: string[];
  surfaces: SourceMentionSurface[];
  /**
   * Hicks book.section refs where the label's curated Greek paradigm
   * (greek-names.ts) may tag. Every ref verified to contain a declined
   * form of the name in the Greek text; requires a GREEK_NAMES spec
   * keyed by the label (sourceMentionGreekEntries throws otherwise).
   */
  grcRefs?: string[];
}

export const SOURCE_MENTIONS: SourceMention[] = [
  {
    label: "Aenesidemus",
    surfaces: [
      { surface: "Aenesidemus", refs: ["9.62", "9.78", "9.87", "9.106", "9.107", "9.116"] },
    ],
    grcRefs: ["9.62", "9.78", "9.87", "9.106", "9.107", "9.116"],
  },
  {
    label: "Alcimus",
    surfaces: [{ surface: "Alcimus", refs: ["3.9"] }],
    grcRefs: ["3.9"],
  },
  {
    label: "Ambryon",
    surfaces: [{ surface: "Ambryon", refs: ["5.11"] }],
    grcRefs: ["5.11"],
  },
  {
    label: "Anaxilas (comic poet)",
    surfaces: [{ surface: "Anaxilas", refs: ["3.28"] }],
    grcRefs: ["3.28"],
  },
  {
    label: "Anaxilaus",
    surfaces: [{ surface: "Anaxilaus", refs: ["1.107"] }],
    grcRefs: ["1.107"],
  },
  {
    label: "Andron of Ephesus",
    surfaces: [
      { surface: "Andron of Ephesus", refs: ["1.30", "1.119"] },
      { surface: "Andron", refs: ["1.30", "1.119"] },
    ],
    grcRefs: ["1.30", "1.119"],
  },
  {
    label: "Antiochus of Laodicea",
    surfaces: [
      { surface: "Antiochus of Laodicea", refs: ["9.106"] },
      { surface: "Antiochus", refs: ["9.106"] },
    ],
    grcRefs: ["9.106"],
  },
  {
    label: "Antiphon",
    surfaces: [{ surface: "Antiphon", refs: ["8.3"] }],
    grcRefs: ["8.3"],
  },
  // The Apollodorus split (July 2026): every occurrence of the name was
  // classified by bearer against both the Hicks and the Greek text. The
  // bare surface is safe here ONLY because the entries are scoped and
  // annotate.ts prefers a scope-matching entry; the chronographer keeps
  // the demoted bare entry everywhere else (gazetteer.ts).
  {
    label: "Apollodorus of Cyzicus",
    surfaces: [
      // 9.38: "Apollodorus of Cyzicus, again, will have it that he
      // lived with Philolaus" - the Democritean.
      { surface: "Apollodorus of Cyzicus", refs: ["9.38"] },
    ],
  },
  {
    label: "Apollodorus of Seleucia",
    surfaces: [
      // The Stoic handbook citations of book 7 ("Apollodorus in his
      // Physics/Ethics/..."), all inside the Zeno doxography - the
      // chronographer's only book-7 sections are 7.184 (Chronology,
      // kept by his scoped entry) and none of the below.
      {
        surface: "Apollodorus",
        refs: [
          "7.39",
          "7.41",
          "7.54",
          "7.64",
          "7.84",
          "7.102",
          "7.118",
          "7.121",
          "7.125",
          "7.129",
          "7.135",
          "7.140",
          "7.142",
          "7.143",
          "7.150",
          "7.157",
        ],
      },
    ],
  },
  {
    label: "Apollodorus the Arithmetician",
    hicksNames: ["Apollodorus the arithmetician", "Apollodorus the calculator"],
    surfaces: [
      // 1.25: "Others tell this tale of Pythagoras, amongst them
      // Apollodorus the arithmetician"; 8.12: "We are told by
      // Apollodorus the calculator". The workbook rows for this group
      // carry no refs; both sections are curated extras verified
      // against the Hicks text (the Seleucus-at-9.12 precedent).
      { surface: "Apollodorus the arithmetician", refs: ["1.25"] },
      { surface: "Apollodorus the calculator", refs: ["8.12"] },
    ],
  },
  {
    label: "Archedemus",
    surfaces: [
      {
        surface: "Archedemus",
        refs: ["7.40", "7.55", "7.68", "7.84", "7.88", "7.134", "7.136"],
      },
    ],
    // Coverage audit July 2026: the workbook's 7.135 citation (On
    // Elements) sits at 7.134 in our section split - with the Greek
    // nominative present after all. The audit also closed three more
    // unambiguous citations of the Tarsian Stoic: 7.55 (On Voice, cited
    // with Diogenes, Antipater and Chrysippus), 7.88 (his telos
    // definition) and 7.136 (On Elements again), each verified in
    // context in both languages (nominatives, incl. the enclitic double
    // accent at 7.55). The catalogue title "Archedemus or Concerning
    // Justice" at 4.13 (Xenocrates' works) is a dialogue named for the
    // Socratic associate, not this man, and stays untagged.
    grcRefs: ["7.40", "7.55", "7.68", "7.84", "7.88", "7.134", "7.136"],
  },
  {
    label: "Aristagoras of Miletus",
    surfaces: [{ surface: "Aristagoras", refs: ["1.11", "1.72"] }],
    grcRefs: ["1.11", "1.72"],
  },
  {
    label: "Aristophanes the Grammarian",
    hicksNames: ["Aristophanes the grammarian"],
    surfaces: [
      { surface: "Aristophanes the grammarian", refs: ["3.61", "10.13"] },
    ],
    grcRefs: ["3.61", "10.13"],
  },
  {
    label: "Artemidorus the Dialectician",
    surfaces: [
      { surface: "Artemidorus the Dialectician", refs: ["9.53"] },
      { surface: "Artemidorus", refs: ["9.53"] },
    ],
    grcRefs: ["9.53"],
  },
  {
    label: "Ascanius of Abdera",
    surfaces: [
      { surface: "Ascanius of Abdera", refs: ["9.61"] },
      { surface: "Ascanius", refs: ["9.61"] },
    ],
    grcRefs: ["9.61"],
  },
  {
    label: "Boethus of Sidon",
    hicksNames: ["Boëthus"],
    surfaces: [
      { surface: "Boëthus", refs: ["7.54", "7.143", "7.148", "7.149"] },
    ],
    grcRefs: ["7.54", "7.143", "7.148", "7.149"],
  },
  {
    label: "Cassius the Skeptic",
    hicksNames: ["Cassius the Sceptic"],
    surfaces: [
      { surface: "Cassius the Sceptic", refs: ["7.32"] },
      { surface: "Cassius", refs: ["7.32", "7.34"] },
    ],
    // 7.32 accusative, 7.34 dative in the Greek text.
    grcRefs: ["7.32", "7.34"],
  },
  {
    label: "Clearchus of Soli",
    surfaces: [
      { surface: "Clearchus of Soli", refs: ["1.9", "1.30", "1.81", "3.2"] },
      { surface: "Clearchus", refs: ["1.9", "1.30", "1.81", "3.2"] },
    ],
    grcRefs: ["1.9", "1.30", "1.81", "3.2"],
  },
  {
    label: "Crinis",
    surfaces: [{ surface: "Crinis", refs: ["7.62", "7.68", "7.71", "7.76"] }],
    grcRefs: ["7.62", "7.68", "7.71", "7.76"],
  },
  {
    // The man cited for the Diver at 9.12 (accusative in the Greek).
    // He shares the CITY spec Κρότων (n3o) in greek-names.ts - same
    // paradigm, same key - so no second spec is minted; the scoped
    // source entry here outranks the unscoped place entry at 9.12,
    // which previously mis-tagged the token as the city.
    label: "Croton",
    surfaces: [{ surface: "Croton", refs: ["9.12"] }],
    grcRefs: ["9.12"],
  },
  {
    label: "Daimachus of Plataea",
    surfaces: [{ surface: "Daimachus", refs: ["1.30"] }],
    grcRefs: ["1.30"],
  },
  {
    label: "Damon of Cyrene",
    surfaces: [{ surface: "Damon of Cyrene", refs: ["1.40"] }],
    grcRefs: ["1.40"],
  },
  {
    label: "Dicaearchus of Messene",
    surfaces: [
      {
        surface: "Dicaearchus",
        refs: ["1.40", "1.41", "3.4", "3.38", "8.40"],
      },
    ],
    // Coverage audit July 2026: the workbook's 3.5 citation (first book
    // Of Lives, Plato wrestling at the Isthmian games) sits at 3.4 in
    // our section split - with the Greek nominative present after all.
    grcRefs: ["1.40", "1.41", "3.4", "3.38", "8.40"],
  },
  {
    label: "Didymus",
    surfaces: [{ surface: "Didymus", refs: ["5.76"] }],
    grcRefs: ["5.76"],
  },
  {
    label: "Dieuchidas",
    surfaces: [{ surface: "Dieuchidas", refs: ["1.57"] }],
    grcRefs: ["1.57"],
  },
  {
    label: "Dinarchus",
    surfaces: [{ surface: "Dinarchus", refs: ["2.52"] }],
    grcRefs: ["2.52"],
  },
  {
    label: "Dinon",
    surfaces: [{ surface: "Dinon", refs: ["1.8", "9.50"] }],
    grcRefs: ["1.8", "9.50"],
  },
  {
    label: "Diodorus",
    surfaces: [{ surface: "Diodorus", refs: ["4.2"] }],
    grcRefs: ["4.2"],
  },
  {
    label: "Diodorus of Ephesus",
    surfaces: [{ surface: "Diodorus of Ephesus", refs: ["8.70"] }],
    grcRefs: ["8.70"],
  },
  {
    label: "Dionysodorus",
    surfaces: [{ surface: "Dionysodorus", refs: ["2.42"] }],
    grcRefs: ["2.42"],
  },
  {
    label: "Diotimus the Stoic",
    surfaces: [{ surface: "Diotimus the Stoic", refs: ["10.3"] }],
    grcRefs: ["10.3"],
  },
  {
    label: "Eleusis (author uncertain)",
    surfaces: [{ surface: "Eleusis", refs: ["1.29"] }],
    grcRefs: ["1.29"],
  },
  {
    label: "Ephorus",
    surfaces: [{ surface: "Ephorus", refs: ["1.40", "1.41", "1.96", "1.98"] }],
    grcRefs: ["1.40", "1.41", "1.96", "1.98"],
  },
  {
    label: "Epictetus",
    surfaces: [{ surface: "Epictetus", refs: ["10.6"] }],
    grcRefs: ["10.6"],
  },
  {
    label: "Eubulides",
    surfaces: [
      {
        surface: "Eubulides",
        refs: ["2.41", "2.108", "2.109", "2.110", "2.111", "6.20", "7.187"],
      },
    ],
    // Coverage audit July 2026: the workbook's 2.42 citation (Socrates'
    // counter-penalty of 100 drachmae) sits at 2.41 in our section
    // split - with the Greek nominative present after all. The audit
    // also closed the Megarian's own biography, previously untagged:
    // 2.108-111 in Euclides' chapter (the "Eubulides of Miletus" roster
    // line and the comic poets' "Eubulides the Eristic", the quarrel
    // with Aristotle, Alexinus and Euphantus in "the school of
    // Eubulides", Apollonius Cronus among "pupils of Eubulides") and
    // 7.187 (the Horned One attributed to him in Chrysippus' chapter),
    // all verified in context in both languages (nom. 2.41/2.108/2.109,
    // gen. 2.109-111 and 7.187).
    grcRefs: ["2.41", "2.108", "2.109", "2.110", "2.111", "6.20", "7.187"],
  },
  {
    label: "Eudemus of Rhodes",
    surfaces: [
      { surface: "Eudemus of Rhodes", refs: ["1.9", "1.23"] },
      { surface: "Eudemus", refs: ["1.9", "1.23"] },
    ],
    grcRefs: ["1.9", "1.23"],
  },
  {
    label: "Eudromus",
    surfaces: [{ surface: "Eudromus", refs: ["7.39", "7.40"] }],
    grcRefs: ["7.39", "7.40"],
  },
  {
    label: "Euphantus of Olynthus",
    surfaces: [
      { surface: "Euphantus of Olynthus", refs: ["2.141"] },
      { surface: "Euphantus", refs: ["2.141"] },
    ],
    grcRefs: ["2.141"],
  },
  {
    label: "Euphorion",
    surfaces: [{ surface: "Euphorion", refs: ["3.37"] }],
    grcRefs: ["3.37"],
  },
  {
    label: "Euthyphron (son of Heraclides Ponticus)",
    hicksNames: ["Euthyphro"],
    surfaces: [{ surface: "Euthyphro", refs: ["1.107"] }],
    grcRefs: ["1.107"],
  },
  {
    label: "Glaucus of Rhegium",
    surfaces: [
      { surface: "Glaucus of Rhegium", refs: ["8.52", "9.38"] },
      { surface: "Glaucus", refs: ["8.52", "9.38"] },
    ],
    grcRefs: ["8.52", "9.38"],
  },
  // Hecataeus of Abdera is a no-reference workbook group, but Hicks
  // names him in full at 9.69 (Pyrrho's pupil list) - a curated extra
  // section, verified July 2026. Opting him in puts the node in the
  // base graph's tagged pool, which the school-members and
  // succession-links rosters require (he is a cited Sceptic and
  // Pyrrho's pupil). Bare "Hecataeus" stays untagged everywhere: the
  // prologue occurrences (1.9, 1.10) are this man but unverified
  // against the workbook, and 9.1 is Hecataeus of Miletus.
  {
    label: "Hecataeus of Abdera",
    // Greek 9.69 names him with the ethnic (Ἑκαταῖός... the Abderite in
    // Pyrrho's pupil list); like the English side, bare Ἑκαταῖος
    // elsewhere (prologue, 9.1 the Milesian) stays untagged.
    surfaces: [{ surface: "Hecataeus of Abdera", refs: ["9.69"] }],
    grcRefs: ["9.69"],
  },
  {
    label: "Heraclides of Tarsus",
    surfaces: [{ surface: "Heraclides of Tarsus", refs: ["7.121"] }],
    grcRefs: ["7.121"],
  },
  // Hesiod: every English occurrence is the poet, verified July 2026
  // (extended in the frequently-mentioned batch from the original 1.12
  // Cratinus mention and 7.25): Thales' chronographic priority (1.38),
  // Socrates' recitation habit (2.46), Theophrastus' catalogue and the
  // callousness anecdote (5.87, 5.92), Hieronymus on Pythagoras' descent
  // into Hades (8.21), the Theogony-inspired verses (8.48), Xenophanes'
  // and Heraclitus' censures (9.1, 9.18, 9.22), and Epicurus' start in
  // philosophy from the Theogony's chaos (10.2). Greek pass completed
  // July 2026: every one of the twelve sections carries a declined form
  // of Ἡσίοδος in the Greek text, verified token-by-token (1.38 acc,
  // 2.46 dat, 5.87/5.92/7.25/8.21/9.18 gen incl. citation formulas
  // that still name the poet, 8.48/9.1 acc, 9.22 nom with enclitic
  // double accent Ἡσίοδός τε, 10.2 dat, plus the original 1.12 acc).
  {
    label: "Hesiod",
    surfaces: [
      {
        surface: "Hesiod",
        refs: [
          "1.12",
          "1.38",
          "2.46",
          "5.87",
          "5.92",
          "7.25",
          "8.21",
          "8.48",
          "9.1",
          "9.18",
          "9.22",
          "10.2",
        ],
      },
    ],
    grcRefs: [
      "1.12",
      "1.38",
      "2.46",
      "5.87",
      "5.92",
      "7.25",
      "8.21",
      "8.48",
      "9.1",
      "9.18",
      "9.22",
      "10.2",
    ],
  },
  {
    label: "Hieronymus of Rhodes",
    surfaces: [
      {
        surface: "Hieronymus of Rhodes",
        refs: ["1.26", "1.27", "2.14", "2.26", "2.105", "8.21", "8.57", "8.58", "9.16", "9.112"],
      },
      {
        surface: "Hieronymus",
        refs: ["1.26", "1.27", "2.14", "2.26", "2.105", "8.21", "8.57", "8.58", "9.16", "9.112"],
      },
    ],
    // Coverage audit July 2026: the workbook's 9.6 citation (Scythinus
    // versifying Heraclitus' book) sits at 9.16 in our section split -
    // with the Greek nominative present after all.
    grcRefs: ["1.26", "1.27", "2.14", "2.26", "2.105", "8.21", "8.57", "8.58", "9.16", "9.112"],
  },
  {
    label: "Hippias",
    surfaces: [{ surface: "Hippias", refs: ["1.24"] }],
    grcRefs: ["1.24"],
  },
  {
    label: "Idomeneus of Lampsacus",
    surfaces: [{ surface: "Idomeneus", refs: ["2.19", "2.20", "2.60"] }],
    grcRefs: ["2.19", "2.20", "2.60"],
  },
  {
    label: "Isidorus of Pergamum",
    surfaces: [
      { surface: "Isidorus of Pergamum", refs: ["7.34"] },
      { surface: "Isidorus", refs: ["7.34"] },
    ],
    // Dative in the Greek text (Κασσίῳ τε καὶ Ἰσιδώρῳ τῷ Περγαμηνῷ).
    grcRefs: ["7.34"],
  },
  {
    label: "Istrus",
    surfaces: [{ surface: "Istrus", refs: ["2.59"] }],
    grcRefs: ["2.59"],
  },
  {
    label: "Lysanias",
    surfaces: [{ surface: "Lysanias", refs: ["6.23"] }],
    grcRefs: ["6.23"],
  },
  {
    label: "Lysias",
    surfaces: [{ surface: "Lysias", refs: ["1.55"] }],
    grcRefs: ["1.55"],
  },
  {
    label: "Lysis",
    surfaces: [{ surface: "Lysis", refs: ["8.42"] }],
    grcRefs: ["8.42"],
  },
  {
    label: "Maeandrius of Miletus",
    surfaces: [
      { surface: "Maeandrius of Miletus", refs: ["1.28", "1.41"] },
      { surface: "Maeandrius", refs: ["1.28", "1.41"] },
    ],
    // 1.28 genitive, 1.41 nominative.
    grcRefs: ["1.28", "1.41"],
  },
  {
    label: "Manetho",
    surfaces: [{ surface: "Manetho", refs: ["1.10"] }],
    grcRefs: ["1.10"],
  },
  {
    label: "Melanthius",
    surfaces: [{ surface: "Melanthius", refs: ["4.18"] }],
    grcRefs: ["4.18"],
  },
  {
    label: "Meleager",
    surfaces: [{ surface: "Meleager", refs: ["2.92"] }],
    grcRefs: ["2.92"],
  },
  {
    label: "Menodotus of Nicomedia",
    surfaces: [{ surface: "Menodotus", refs: ["9.115"] }],
    grcRefs: ["9.115"],
  },
  {
    label: "Metrodorus of Chios",
    surfaces: [{ surface: "Metrodorus of Chios", refs: ["9.58"] }],
    grcRefs: ["9.58"],
  },
  {
    label: "Minyas",
    surfaces: [{ surface: "Minyas", refs: ["1.27"] }],
    grcRefs: ["1.27"],
  },
  {
    label: "Mnesistratus of Thasos",
    surfaces: [{ surface: "Mnesistratus", refs: ["3.47"] }],
    grcRefs: ["3.47"],
  },
  {
    label: "Nicolaus",
    surfaces: [{ surface: "Nicolaus", refs: ["10.4"] }],
    grcRefs: ["10.4"],
  },
  {
    label: "Numenius",
    surfaces: [{ surface: "Numenius", refs: ["9.68"] }],
    grcRefs: ["9.68"],
  },
  {
    // No grcRefs: the Perseus Greek at 6.23 reads Ἀθηνόδωρος ὁ
    // Ἀθηναίων προστατήσας where Hicks prints Olympiodorus; the name
    // has no Greek form in the corpus (see GREEK_NAME_SKIPS).
    label: "Olympiodorus",
    surfaces: [{ surface: "Olympiodorus", refs: ["6.23"] }],
  },
  {
    label: "Onetor",
    surfaces: [{ surface: "Onetor", refs: ["2.114"] }],
    grcRefs: ["2.114"],
  },
  {
    label: "Panaetius of Rhodes",
    surfaces: [
      {
        surface: "Panaetius",
        refs: ["2.64", "2.85", "2.87", "3.37", "3.109", "7.41", "7.92", "7.128", "7.142", "7.149", "7.163", "9.20"],
      },
    ],
    grcRefs: ["2.64", "2.85", "2.87", "3.37", "3.109", "7.41", "7.92", "7.128", "7.142", "7.149", "7.163", "9.20"],
  },
  {
    label: "Pisistratus",
    // Extended July 2026 (frequently-mentioned batch) from the 1.53
    // letter to every verified Book 1 mention of the tyrant: the
    // prologue's sage-list variant (1.13), Solon's warnings and exile
    // (1.49-55, 1.57, 1.60), the letter exchange and Epimenides'
    // shelter (1.53, 1.64-67), Cleobulus' and Epimenides' letters
    // (1.93, 1.113), the Myson mix-up (1.108) and the tyrants-among-
    // the-sages recap (1.122). QID Q242172 verified. Pisistratus of
    // Ephesus (2.60), who denied Aeschines' dialogues, is a different
    // man and stays untagged in BOTH languages; the patronymic plural
    // Pisistratidae / Πεισιστρατίδαι (1.49) is not a form of the name
    // (the Greek paradigm cannot match it). 1.93 has the dative
    // without iota subscript in Perseus (Πεισιστράτω) - it normalizes
    // to the same form.
    surfaces: [
      {
        surface: "Pisistratus",
        refs: [
          "1.13",
          "1.49",
          "1.50",
          "1.51",
          "1.52",
          "1.53",
          "1.54",
          "1.55",
          "1.57",
          "1.60",
          "1.65",
          "1.66",
          "1.67",
          "1.93",
          "1.108",
          "1.113",
          "1.122",
        ],
      },
    ],
    grcRefs: [
      "1.13",
      "1.49",
      "1.50",
      "1.51",
      "1.52",
      "1.53",
      "1.54",
      "1.55",
      "1.57",
      "1.60",
      "1.65",
      "1.66",
      "1.67",
      "1.93",
      "1.108",
      "1.113",
      "1.122",
    ],
  },
  {
    label: "Polyeuctus",
    surfaces: [{ surface: "Polyeuctus", refs: ["6.23"] }],
    grcRefs: ["6.23"],
  },
  {
    label: "Potamon",
    hicksNames: ["Potamo"],
    surfaces: [{ surface: "Potamo", refs: ["1.21"] }],
    // Genitive in the Greek text (ὑπὸ Ποτάμωνος τοῦ Ἀλεξανδρέως).
    grcRefs: ["1.21"],
  },
  {
    label: "Praxiphanes",
    surfaces: [{ surface: "Praxiphanes", refs: ["3.8"] }],
    grcRefs: ["3.8"],
  },
  {
    label: "Sabinus",
    surfaces: [{ surface: "Sabinus", refs: ["3.47"] }],
    grcRefs: ["3.47"],
  },
  {
    label: "Seleucus (grammarian)",
    surfaces: [{ surface: "Seleucus", refs: ["3.109", "9.12"] }],
    grcRefs: ["3.109", "9.12"],
  },
  {
    label: "Sextus Empiricus",
    surfaces: [
      { surface: "Sextus Empiricus", refs: ["9.87", "9.116"] },
      { surface: "Sextus", refs: ["9.87", "9.116"] },
    ],
    grcRefs: ["9.87", "9.116"],
  },
  {
    label: "Silenus (of Kale Acte)",
    surfaces: [{ surface: "Silenus", refs: ["2.11"] }],
    grcRefs: ["2.11"],
  },
  {
    label: "Sophilus",
    surfaces: [{ surface: "Sophilus", refs: ["2.120"] }],
    // Genitive in the Greek text (Σωφίλου).
    grcRefs: ["2.120"],
  },
  {
    label: "Sosibius of Laconia",
    surfaces: [{ surface: "Sosibius", refs: ["1.115"] }],
    grcRefs: ["1.115"],
  },
  {
    label: "Theodosius",
    surfaces: [{ surface: "Theodosius", refs: ["9.70"] }],
    grcRefs: ["9.70"],
  },
  {
    label: "Theophanes",
    surfaces: [{ surface: "Theophanes", refs: ["2.104"] }],
    grcRefs: ["2.104"],
  },
  {
    label: "Timonides",
    surfaces: [{ surface: "Timonides", refs: ["4.5"] }],
    grcRefs: ["4.5"],
  },
  {
    label: "Timotheus of Athens",
    surfaces: [
      { surface: "Timotheus of Athens", refs: ["3.5", "4.4", "5.1", "7.1"] },
      { surface: "Timotheus", refs: ["3.5", "4.4", "5.1", "7.1"] },
    ],
    grcRefs: ["3.5", "4.4", "5.1", "7.1"],
  },
  {
    label: "Xanthus of Lydia",
    surfaces: [{ surface: "Xanthus", refs: ["1.2", "8.63"] }],
    grcRefs: ["1.2", "8.63"],
  },
  {
    label: "Zeno of Tarsus",
    surfaces: [{ surface: "Zeno of Tarsus", refs: ["7.41", "7.84"] }],
    // Multi-word Greek forms only ("Ζήνων ὁ Ταρσεύς" 7.41, "Ζήνωνα
    // τὸν Ταρσέα" 7.84): 7.84 also has Zeno of Citium ("Κιτιεὺς
    // Ζήνων"), so bare Ζήνων must never enter this scope.
    grcRefs: ["7.41", "7.84"],
  },
  {
    label: "Zeuxis",
    surfaces: [{ surface: "Zeuxis", refs: ["9.106"] }],
    grcRefs: ["9.106"],
  },
];

/** Labels opted in for tagging; also the gazetteer suppression set. */
export const SOURCE_MENTION_LABELS: ReadonlySet<string> = new Set(
  SOURCE_MENTIONS.map((m) => m.label),
);

/** Extra Hicks name variants for a minted group label. */
export function sourceMentionHicksNames(label: string): string[] {
  return SOURCE_MENTIONS.find((m) => m.label === label)?.hicksNames ?? [];
}

export interface SourceMentionTagEntry {
  surface: string;
  label: string;
  /** Corpus section ids (book.chapter.section) the surface may tag in. */
  sections: string[];
}

let tagEntries: SourceMentionTagEntry[] | null = null;

/**
 * The curated surfaces with their Hicks refs expanded to corpus section
 * ids ("9.12" -> "9.1.12"). A ref may match several sections (chapter
 * boundaries reuse section numbers); all matches are in scope. Throws on
 * a ref that matches no section - the curation drifted from the corpus.
 */
export function sourceMentionTagEntries(): SourceMentionTagEntry[] {
  if (tagEntries) return tagEntries;
  const byRef = new Map<string, string[]>();
  for (const s of corpus) {
    const ref = `${s.book}.${s.section}`;
    const arr = byRef.get(ref) ?? [];
    arr.push(s.id);
    byRef.set(ref, arr);
  }
  const out: SourceMentionTagEntry[] = [];
  const seen = new Set<string>();
  for (const m of SOURCE_MENTIONS) {
    if (seen.has(m.label)) {
      throw new Error(`source-mentions: duplicate label "${m.label}"`);
    }
    seen.add(m.label);
    for (const sf of m.surfaces) {
      const sections: string[] = [];
      for (const ref of sf.refs) {
        const ids = byRef.get(ref);
        if (!ids) {
          throw new Error(
            `source-mentions: ref ${ref} for "${m.label}" matches no corpus section`,
          );
        }
        sections.push(...ids);
      }
      out.push({
        surface: sf.surface,
        label: m.label,
        sections: [...new Set(sections)].sort(),
      });
    }
  }
  tagEntries = out;
  return tagEntries;
}

export interface SourceMentionGreekEntry {
  label: string;
  /** Corpus section ids the label's Greek paradigm may tag in. */
  sections: string[];
}

let greekEntriesCache: SourceMentionGreekEntry[] | null = null;

/**
 * The mentions carrying grcRefs, expanded to corpus section ids the same
 * way as sourceMentionTagEntries(). Throws on a ref that matches no
 * section. The gazetteer joins each label to its GREEK_NAMES spec and
 * throws there if the spec is missing.
 */
export function sourceMentionGreekEntries(): SourceMentionGreekEntry[] {
  if (greekEntriesCache) return greekEntriesCache;
  const byRef = new Map<string, string[]>();
  for (const s of corpus) {
    const ref = `${s.book}.${s.section}`;
    const arr = byRef.get(ref) ?? [];
    arr.push(s.id);
    byRef.set(ref, arr);
  }
  const out: SourceMentionGreekEntry[] = [];
  for (const m of SOURCE_MENTIONS) {
    if (!m.grcRefs) continue;
    const sections: string[] = [];
    for (const ref of m.grcRefs) {
      const ids = byRef.get(ref);
      if (!ids) {
        throw new Error(
          `source-mentions: grcRef ${ref} for "${m.label}" matches no corpus section`,
        );
      }
      sections.push(...ids);
    }
    out.push({ label: m.label, sections: [...new Set(sections)].sort() });
  }
  greekEntriesCache = out;
  return greekEntriesCache;
}
