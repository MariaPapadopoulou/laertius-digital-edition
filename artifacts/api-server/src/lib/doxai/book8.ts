/**
 * Curated doxography from Book 8 of Diogenes Laertius' Lives, cited to
 * Hicks section ids (book.section). See doxai.ts for the model and curation
 * rules. Source-internal: every `en` is a verbatim excerpt of its cited
 * section.
 */
import type { Doxa } from "../doxai";

export const BOOK8_DOXAI: Doxa[] = [
  // ---------------------------------------------------------------- Pythagoras
  {
    id: "pythagoras-transmigration",
    philosopher: "Pythagoras",
    domain: "soul",
    gloss:
      "The soul, driven by necessity, passes in turn through one living body after another.",
    grc: "Πρῶτόν τέ φασι τοῦτον ἀποφῆναι τὴν ψυχὴν κύκολον ἀνάγκης ἀμείβουσαν ἄλλοτʼ ἄλλοις ἐνδεῖσθαι ζῴοις",
    en: "He was the first, they say, to declare that the soul, bound now in this creature, now in that, thus goes on a round ordained of necessity",
    ref: "8.14",
    doctrine: "The soul is immortal and passes at death into other living creatures",
    certainty: "reported",
    note: "D.L. hedges with 'they say' (φασι).",
  },
  {
    id: "pythagoras-abstinence-from-animals",
    philosopher: "Pythagoras",
    domain: "ethics",
    gloss:
      "One must not kill or eat animals, since they share with us the privilege of having a soul.",
    grc: "τοῦτον γὰρ καὶ τὸ φονεύειν ἀπαγορεύειν, μὴ ὅτι γεύεσθαι τῶν ζῴων κοινὸν δίκαιον ἡμῖν ἐχόντων ψυχῆς",
    en: "who forbade even the killing, let alone the eating, of animals which share with us the privilege of having a soul",
    ref: "8.13",
    doctrine: "Not to kill or eat animals that share with us the privilege of having a soul",
    certainty: "asserted",
    note: "D.L. adds that Pythagoras' real reason was to accustom people to simplicity of life for a healthy body and keen mind.",
  },
  {
    id: "pythagoras-monad-first-principle",
    philosopher: "Pythagoras",
    domain: "first-principles",
    gloss:
      "The monad is the first principle; from it and the undefined dyad spring numbers, then points, lines, figures, and finally sensible bodies.",
    grc: "ἀρχὴν μὲν ἁπάντων μονάδα· ἐκ δὲ τῆς μονάδος ἀόριστον δυάδα ὡς ἂν ὕλην τῇ μονάδι αἰτίῳ ὄντι ὑποστῆναι· ἐκ δὲ τῆς μονάδος καὶ τῆς ἀορίστου δυάδος τοὺς ἀριθμούς· ἐκ δὲ τῶν ἀριθμῶν τὰ σημεῖα· ἐκ δὲ τούτων τὰς γραμμάς, ἐξ ὧν τὰ ἐπίπεδα σχήματα· ἐκ δὲ τῶν ἐπιπέδων τὰ στερεὰ σχήματα· ἐκ δὲ τούτων τὰ αἰσθητὰ σώματα",
    en: "The principle of all things is the monad or unit; arising from this monad the undefined dyad or two serves as material substratum to the monad, which is cause; from the monad and the undefined dyad spring numbers; from numbers, points; from points, lines; from lines, plane figures; from plane figures, solid figures; from solid figures, sensible bodies",
    ref: "8.25",
    doctrine: "The principle of all things is the monad; from it spring numbers, points, lines, figures and bodies",
    certainty: "reported",
    accordingTo: "Alexander",
    note: "From the Pythagorean memoirs as reported by Alexander (Polyhistor) in his Successions of Philosophers.",
  },
  {
    id: "pythagoras-cosmos-animate-spherical",
    philosopher: "Pythagoras",
    domain: "cosmology",
    gloss:
      "The four elements combine into a single living, intelligent, spherical cosmos with the spherical earth at its centre.",
    grc: "καὶ γίνεσθαι ἐξ αὐτῶν κόσμον ἔμψυχον, νοερόν, σφαιροειδῆ, μέσην περιέχοντα τὴν γῆν καὶ αὐτὴν σφαιροειδῆ καὶ περιοικουμένην",
    en: "combine to produce a universe animate, intelligent, spherical, with the earth at its centre, the earth itself too being spherical and inhabited round about",
    ref: "8.25",
    certainty: "reported",
    accordingTo: "Alexander",
    note: "From the Pythagorean memoirs as reported by Alexander (Polyhistor).",
  },
  {
    id: "pythagoras-heavenly-bodies-are-gods",
    philosopher: "Pythagoras",
    domain: "gods",
    gloss:
      "The heavenly bodies are gods, since heat - the cause of life - predominates in them.",
    grc: "ἥλιόν τε καὶ σελήνην καὶ τοὺς ἄλλους ἀστέρας εἶναι θεούς· ἐπικρατεῖν γὰρ τὸ θερμὸν ἐν αὐτοῖς, ὅπερ ἐστὶ ζωῆς αἴτιον",
    en: "The sun, the moon, and the other stars are gods; for, in them, there is a preponderance of heat, and heat is the cause of life",
    ref: "8.27",
    certainty: "reported",
    accordingTo: "Alexander",
    note: "From the Pythagorean memoirs as reported by Alexander (Polyhistor).",
  },
  {
    id: "pythagoras-fate-orders-all",
    philosopher: "Pythagoras",
    domain: "fate",
    gloss:
      "Fate is the cause of the ordering of the universe both as a whole and in its parts.",
    grc: "εἱμαρμένην τε τῶν ὅλων καὶ κατὰ μέρος αἰτίαν εἶναι τῆς διοικήσεως",
    en: "Fate is the cause of things being thus ordered both as a whole and separately",
    ref: "8.27",
    certainty: "reported",
    accordingTo: "Alexander",
    note: "From the Pythagorean memoirs as reported by Alexander (Polyhistor).",
  },
  {
    id: "pythagoras-soul-immortal",
    philosopher: "Pythagoras",
    domain: "soul",
    gloss:
      "The soul, a detached fragment of the immortal aether, is itself immortal and distinct from mere life.",
    grc: "διαφέρειν τε ψυχὴν ζωῆς· ἀθάνατόν τʼ εἶναι αὐτήν, ἐπειδήπερ καὶ τὸ ἀφʼ οὗ ἀπέσπασται ἀθάνατόν ἐστι",
    en: "Soul is distinct from life; it is immortal, since that from which it is detached is immortal",
    ref: "8.28",
    certainty: "reported",
    accordingTo: "Alexander",
    note: "From the Pythagorean memoirs as reported by Alexander (Polyhistor).",
  },
  {
    id: "pythagoras-soul-tripartite",
    philosopher: "Pythagoras",
    domain: "soul",
    gloss:
      "The human soul has three parts - intelligence, reason, and passion - of which reason is unique to man.",
    grc: "Τὴν δʼ ἀνθρώπου ψυχὴν διαιρεῖσθαι τριχῆ, εἴς τε νοῦν καὶ φρένας καὶ θυμόν",
    en: "The soul of man, he says, is divided into three parts, intelligence, reason, and passion",
    ref: "8.30",
    certainty: "reported",
    accordingTo: "Alexander",
    note: "From the Pythagorean memoirs as reported by Alexander (Polyhistor).",
  },
  {
    id: "pythagoras-air-full-of-souls",
    philosopher: "Pythagoras",
    domain: "gods",
    gloss:
      "The whole air is filled with souls - daimones and heroes - who send men dreams and omens of sickness and health.",
    grc: "εἶναί τε πάντα τὸν ἀέρα ψυχῶν ἔμπλεων· καὶ ταύτας δαίμονάς τε καὶ ἥρωας ὀνομάζεσθαι· καὶ ὑπὸ τούτων πέμπεσθαι ἀνθρώποις τούς τʼ ὀνείρους καὶ τὰ σημεῖα νόσου τε καὶ ὑγιείας",
    en: "The whole air is full of souls which are called genii or heroes; these are they who send men dreams and signs of future disease and health",
    ref: "8.32",
    certainty: "reported",
    accordingTo: "Alexander",
    note: "From the Pythagorean memoirs as reported by Alexander (Polyhistor).",
  },
  {
    id: "pythagoras-virtue-is-harmony",
    philosopher: "Pythagoras",
    domain: "ethics",
    gloss:
      "Virtue, health, all good, and God alike are harmony; hence all things are framed according to harmony.",
    grc: "τήν τʼ ἀρετὴν ἁρμονίαν εἶναι καὶ τὴν ὑγίειαν καὶ τὸ ἀγαθὸν ἅπαν καὶ τὸν θεόν· διὸ καὶ καθʼ ἁρμονίαν συνεστάναι τὰ ὅλα",
    en: "Virtue is harmony, and so are health and all good and God himself; this is why they say that all things are constructed according to the laws of harmony",
    ref: "8.33",
    doctrine: "Virtue is harmony, and so are health and all good and God himself",
    certainty: "reported",
    accordingTo: "Alexander",
    note: "From the Pythagorean memoirs as reported by Alexander (Polyhistor).",
  },
  // ---------------------------------------------------------------- Empedocles
  {
    id: "empedocles-four-elements-love-strife",
    philosopher: "Empedocles",
    domain: "first-principles",
    gloss:
      "There are four elements - fire, water, earth and air - united by Love and separated by Strife.",
    grc: "στοιχεῖα μὲν εἶναι τέτταρα, πῦρ, ὕδωρ, γῆν, ἀέρα· Φιλίαν θʼ ᾗ συγκρίνεται καὶ Νεῖκος ᾧ διακρίνεται",
    en: "there are four elements, fire, water, earth and air, besides friendship by which these are united, and strife by which they are separated",
    ref: "8.76",
    doctrine: "There are four elements - fire, water, earth and air - united by Love and separated by Strife",
    certainty: "asserted",
  },
  {
    id: "empedocles-soul-transmigrates",
    philosopher: "Empedocles",
    domain: "soul",
    gloss:
      "The soul passes through and takes on every form of animal and plant.",
    grc: "καὶ τὴν ψυχὴν παντοῖα εἴδη ζῴων καὶ φυτῶν ἐνδύεσθαι",
    en: "The soul, again, assumes all the various forms of animals and plants",
    ref: "8.77",
    doctrine: "The soul assumes all the various forms of animals and plants",
    certainty: "asserted",
  },
  // ----------------------------------------------------------------- Philolaus
  {
    id: "philolaus-necessity-and-harmony",
    philosopher: "Philolaus",
    domain: "fate",
    gloss:
      "Everything comes about by necessity and in harmonious inter-relation.",
    grc: "Δοκεῖ δʼ αὐτῷ πάντα ἀνάγκῃ καὶ ἁρμονίᾳ γίνεσθαι",
    en: "all things are brought about by necessity and in harmonious inter-relation",
    ref: "8.85",
    doctrine: "All things are brought about by necessity and in harmonious inter-relation",
    certainty: "asserted",
  },
  {
    id: "philolaus-earth-moves-in-circle",
    philosopher: "Philolaus",
    domain: "cosmology",
    gloss:
      "The earth moves in a circle - a priority D.L. notes some credit instead to Hicetas of Syracuse.",
    grc: "καὶ τὴν γῆν κινεῖσθαι κατὰ κύκλον πρῶτον εἰπεῖν",
    en: "He was the first to declare that the earth moves in a circle",
    ref: "8.85",
    doctrine: "The earth moves in a circle",
    certainty: "asserted",
    alsoAttributedTo: "Hicetas of Syracuse",
  },
  // ------------------------------------------------------------------- Eudoxus
  {
    id: "eudoxus-pleasure-the-good",
    philosopher: "Eudoxus",
    domain: "pleasure",
    gloss: "Pleasure is the good.",
    grc: "τὴν ἡδονὴν λέγειν τὸ ἀγαθόν",
    en: "he declared pleasure to be the good",
    ref: "8.88",
    doctrine: "Pleasure is the good",
    certainty: "reported",
    accordingTo: "Nicomachus",
    note: "D.L. sources this to Nicomachus, the son of Aristotle.",
  },
];
