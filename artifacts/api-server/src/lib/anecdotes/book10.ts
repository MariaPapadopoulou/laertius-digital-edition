/**
 * Book 10 anecdotes - Epicurus. The book is dominated by the three
 * doctrinal epistles and the Sovran Maxims (the epistles layer curates the
 * letters, including the deathbed note to Idomeneus, 10.22 - deliberately
 * NOT re-curated here); the narrated incidents all come from the
 * biographical frame, 10.1-28. Narrated incidents only; bare dicta live in
 * the sayings layer (see the overlap policy in anecdotes.ts). Every `en`
 * is a verbatim Hicks excerpt of the cited section, enforced by
 * validate-anecdotes.
 *
 * Curation notes: the hostile tradition (Diotimus's forged letters, the
 * Stoic slanders, Timocrates' Merriment, 10.3-8) is curated as `disputed`
 * - D.L. himself rejects it wholesale ("But these people are stark mad",
 * 10.9). "Apollodorus the Epicurean", biographer of Epicurus (10.2, 10.10),
 * is NOT the chronographer who is an existing claim source - his reports
 * keep the attribution in the excerpt; only "Apollodorus in his Chronology"
 * (10.13) goes into accordingTo.
 */
import type { Anecdote } from "../anecdotes";

export const BOOK10_ANECDOTES: Anecdote[] = [
  {
    id: "epicurus-chaos-in-hesiod",
    philosopher: "Epicurus",
    topic: "conversion",
    gloss:
      "Epicurus turns to philosophy in disgust at the schoolmasters who cannot tell him the meaning of chaos in Hesiod - though Hermippus has him a schoolmaster himself, turning to philosophy on coming across the works of Democritus.",
    grc: "Ἀπολλόδωρος δʼ ὁ Ἐπικούρειος ἐν τῷ πρώτῳ περὶ τοῦ Ἐπικούρου βίου φησὶν ἐλθεῖν αὐτὸν ἐπὶ φιλοσοφίαν καταγνόντα τῶν γραμματιστῶν, ἐπειδὴ μὴ ἐδυνήθησαν ἑρμηνεῦσαι αὐτῷ τὰ περὶ τοῦ παρʼ Ἡσιόδῳ χάους. φησὶ δʼ Ἕρμιππος γραμματοδιδάσκαλον αὐτὸν γεγενῆσθαι, ἔπειτα μέντοι περιτυχόντα τοῖς Δημοκρίτου βιβλίοις ἐπὶ φιλοσοφίαν ᾆξαι·",
    en: "Apollodorus the Epicurean, in the first book of his Life of Epicurus , says that he turned to philosophy in disgust at the schoolmasters who could not tell him the meaning of chaos in Hesiod. According to Hermippus, however, he started as a schoolmaster, but on coming across the works of Democritus turned eagerly to philosophy.",
    ref: "10.2",
    certainty: "disputed",
    note: "Two rival conversion accounts, from Apollodorus the Epicurean (not the chronographer) and Hermippus; hence Timon's sneer at 'the schoolmaster's son from Samos' (10.3).",
  },
  {
    id: "epicurus-charms-allegation",
    philosopher: "Epicurus",
    topic: "shamelessness",
    gloss:
      "The hostile tradition alleges that Epicurus went round with his mother to cottages reading charms, and assisted his father in his school for a pitiful fee.",
    grc: "καὶ γὰρ σὺν τῇ μητρὶ περιιόντα αὐτὸν ἐς τὰ οἰκίδια καθαρμοὺς ἀναγινώσκειν, καὶ σὺν τῷ πατρὶ γράμματα διδάσκειν λυπροῦ τινος μισθαρίου. ἀλλὰ καὶ τῶν ἀδελφῶν ἕνα προαγωγεύειν, Λεοντίῳ καὶ συνεῖναι τῇ ἑταίρᾳ. τὰ δὲ Δημοκρίτου περὶ τῶν ἀτόμων καὶ Ἀριστίππου περὶ τῆς ἡδονῆς ὡς ἴδια λέγειν",
    en: "They allege that he used to go round with his mother to cottages and read charms, and assist his father in his school for a pitiful fee ; further, that one of his brothers was a pander and lived with Leontion the courtesan; that he put forward as his own the doctrines of Democritus about atoms and of Aristippus about pleasure",
    ref: "10.4",
    certainty: "disputed",
    note: "The allegations of Posidonius the Stoic and his school, Nicolaus, Sotion and Dionysius of Halicarnassus (10.4); D.L. dismisses the whole tradition - 'But these people are stark mad' (10.9).",
  },
  {
    id: "epicurus-timocrates-slanders",
    philosopher: "Epicurus",
    topic: "shamelessness",
    gloss:
      "Timocrates, Metrodorus' brother, deserts the school and in his Merriment asserts that Epicurus vomited twice a day from over-indulgence - and that he himself barely escaped the notorious midnight philosophizings.",
    grc: "Καὶ μὴν καὶ Τιμοκράτης ἐν τοῖς ἐπιγραφομένοις Εὐφραντοῖς ὁ Μητροδώρου μὲν ἀδελφός, μαθητὴς δὲ αὐτοῦ τῆς σχολῆς ἐκφοιτήσας φησὶ δὶς αὐτὸν τῆς ἡμέρας ἐμεῖν ἀπὸ τρυφῆς, ἑαυτόν τε διηγεῖται μόγις ἐκφυγεῖν ἰσχῦσαι τὰς νυκτερινὰς ἐκείνας φιλοσοφίας καὶ τὴν μυστικὴν ἐκείνην συνδιαγωγήν.",
    en: "Again there was Timocrates, the brother of Metrodorus, who was his disciple and then left the school. He in the book entitled Merriment asserts that Epicurus vomited twice a day from over-indulgence, and goes on to say that he himself had much ado to escape from those notorious midnight philosophizings and the confraternity with all its secrets",
    ref: "10.6",
    involves: "Timocrates",
    certainty: "disputed",
    note: "The renegade disciple's testimony, part of the hostile tradition D.L. rejects at 10.9.",
  },
  {
    id: "epicurus-statues-and-friends",
    philosopher: "Epicurus",
    topic: "legacy",
    gloss:
      "Against the slanderers, D.L. sets the witnesses to Epicurus' unsurpassed goodwill: his native land honours him with bronze statues, and his friends are so many they could hardly be counted by whole cities.",
    grc: "Μεμήνασι δʼ οὗτοι. τῷ γὰρ ἀνδρὶ μάρτυρες ἱκανοὶ τῆς ἀνυπερβλήτου πρὸς πάντας εὐγνωμοσύνης ἥ τε πατρὶς χαλκαῖς εἰκόσι τιμήσασα οἵ τε φίλοι τοσοῦτοι τὸ πλῆθος ὡς μηδʼ ἂν πόλεσιν ὅλαις μετρεῖσθαι δύνασθαι· οἵ τε γνώριμοι πάντες ταῖς δογματικαῖς αὐτοῦ σειρῆσι προσκατασχεθέντες",
    en: "But these people are stark mad. For our philosopher has abundance of witnesses to attest his unsurpassed goodwill to all men—his native land, which honoured him with statues in bronze; his friends, so many in number that they could hardly be counted by whole cities, and indeed all who knew him, held fast as they were by the siren-charms of his doctrine",
    ref: "10.9",
    certainty: "asserted",
    note: "The one defector D.L. concedes is Metrodorus of Stratonicea, who went over to Carneades (10.9).",
  },
  {
    id: "epicurus-friends-in-garden",
    philosopher: "Epicurus",
    topic: "teaching",
    gloss:
      "Epicurus spends all his life in Greece, and friends come to him from all parts and live with him in his garden - purchased, we are told, for eighty minae.",
    grc: "καὶ χαλεπωτάτων δὲ καιρῶν κατασχόντων τηνικάδε τὴν Ἑλλάδα, αὐτόθι καταβιῶναι, δὶς ἢ τρὶς τοὺς περὶ τὴν Ἰωνίαν τόπους πρὸς τοὺς φίλους διαδραμόντα. οἳ καὶ πανταχόθεν πρὸς αὐτὸν ἀφικνοῦντο καὶ συνεβίουν αὐτῷ ἐν τῷ κήπῳ, καθά φησι καὶ Ἀπολλόδωρος· ὃν καὶ ὀγδοήκοντα μνῶν πρίασθαι.",
    en: "He spent all his life in Greece, notwithstanding the calamities which had befallen her in that age ; when he did once or twice take a trip to Ionia, it was to visit his friends there. Friends indeed came to him from all parts and lived with him in his garden. This is stated by Apollodorus, who also says that he purchased the garden for eighty minae",
    ref: "10.10",
    certainty: "reported",
    note: "Stated by Apollodorus the Epicurean, the biographer (cf. 10.2) - not the chronographer, so the attribution stays in the excerpt.",
  },
  {
    id: "epicurus-garden-frugality",
    philosopher: "Epicurus",
    topic: "asceticism",
    gloss:
      "The life of the Garden is very simple and frugal - half a pint of thin wine, otherwise thoroughgoing water-drinkers; Epicurus himself is content with plain bread and water, asking only for a little pot of cheese to fare sumptuously.",
    grc: "κοτύλῃ γοῦν, φησίν, οἰνιδίου ἠρκοῦντο, τὸ δὲ πᾶν ὕδωρ ἦν αὐτοῖς ποτόν. τόν τʼ Ἐπίκουρον μὴ ἀξιοῦν εἰς τὸ κοινὸν κατατίθεσθαι τὰς οὐσίας, καθάπερ τὸν Πυθαγόραν κοινὰ τὰ φίλων λέγοντα· ἀπιστούντων γὰρ εἶναι τὸ τοιοῦτον· εἰ δʼ ἀπίστων οὐδὲ φίλων. αὐτός τέ φησιν ἐν ταῖς ἐπιστολαῖς, ὕδατι μόνον ἀρκεῖσθαι καὶ ἄρτῳ λιτῷ. καί, πέμψον μοι τυροῦ, φησί, κυθριδίου, ἵνʼ ὅταν βούλωμαι πολυτελεύσασθαι δύνωμαι. τοιοῦτος ἦν ὁ τὴν ἡδονὴν εἶναι τέλος δογματίζων",
    en: "at all events they were content with half a pint of thin wine and were, for the rest, thoroughgoing water-drinkers. He further says that Epicurus did not think it right that their property should be held in common, as required by the maxim of Pythagoras about the goods of friends; such a practice in his opinion implied mistrust, and without confidence there is no friendship. In his correspondence he himself mentions that he was content with plain bread and water. And again: Send me a little pot of cheese, that, when I like, I may fare sumptuously. Such was the man who laid down that pleasure was the end of life.",
    ref: "10.11",
    certainty: "reported",
    accordingTo: "Diocles",
    framesSaying: "epicurus-pot-of-cheese",
  },
  {
    id: "epicurus-self-taught",
    philosopher: "Epicurus",
    topic: "training",
    gloss:
      "Apollodorus' Chronology makes Epicurus a pupil of Nausiphanes and Praxiphanes - but Epicurus himself, in his letter to Eurylochus, denies it and says he was self-taught.",
    grc: "Τοῦτον Ἀπολλόδωρος ἐν Χρονικοῖς Ναυσιφάνους ἀκοῦσαί φησι καὶ Πραξιφάνους· αὐτὸς δὲ οὔ φησιν, ἀλλʼ ἑαυτοῦ, ἐν τῇ πρὸς Εὐρύλοχον ἐπιστολῇ.",
    en: "Apollodorus in his Chronology tells us that our philosopher was a pupil of Nausiphanes and Praxiphanes ; but in his letter to Eurylochus, Epicurus himself denies it and says that he was self-taught.",
    ref: "10.13",
    involves: "Nausiphanes",
    certainty: "disputed",
    accordingTo: "Apollodorus",
    note: "Ariston's Life adds that he derived The Canon from Nausiphanes' Tripod (10.14); Epicurus' own verdict on Nausiphanes was 'jelly-fish, an illiterate, a fraud, and a trollop' (10.8).",
  },
  {
    id: "epicurus-warm-bath-death",
    philosopher: "Epicurus",
    topic: "death",
    gloss:
      "Dying of renal calculus after a fortnight's illness, Epicurus enters a bronze bath of lukewarm water, asks for unmixed wine, and - having bidden his friends remember his doctrines - breathes his last.",
    grc: "τελευτῆσαι δʼ αὐτὸν λίθῳ τῶν οὔρων ἐπισχεθέντων, ὥς φησι καὶ Ἕρμαρχος ἐν ἐπιστολαῖς, ἡμέρας νοσήσαντα τεσσαρεσκαίδεκα. ὅτε καί φησιν Ἕρμιππος ἐμβάντα αὐτὸν εἰς πύελον χαλκῆν κεκραμένην ὕδατι θερμῷ καὶ αἰτήσαντα ἄκρατον ῥοφῆσαι·",
    en: "Epicurus died of renal calculus after an illness which lasted a fortnight: so Hermarchus tells us in his letters. Hermippus relates that he entered a bronze bath of lukewarm water and asked for unmixed wine, which he swallowed",
    ref: "10.15",
    certainty: "reported",
    accordingTo: "Hermippus",
    note: "The scene concludes at 10.16: 'and then, having bidden his friends remember his doctrines, breathed his last' - the frame of the curated saying epicurus-remember-doctrines. His deathbed letter to Idomeneus (10.22) is curated in the epistles layer.",
  },
  {
    id: "epicurus-will-manumits-slaves",
    philosopher: "Epicurus",
    topic: "legacy",
    gloss:
      "In his will Epicurus manumits his slaves Mys, Nicias and Lycon, and gives Phaedrium her liberty - the gentleness to his servants D.L. had already cited among the proofs of his character.",
    grc: "ἀφίημι δὲ τῶν παίδων ἐλεύθερον Μῦν, Νικίαν, Λύκωνα· ἀφίημι δὲ καὶ Φαίδριον ἐλευθερίᾳ.",
    en: "Of my slaves I manumit Mys, Nicias, Lycon, and I also give Phaedrium her liberty.",
    ref: "10.21",
    certainty: "asserted",
    note: "The will (10.16-21) also endows the annual birthday celebration on the tenth of Gamelion and the monthly meeting of the School on the twentieth, commemorating Metrodorus and himself (10.18). The slave Mys was a member of the School (10.10).",
  },
  {
    id: "epicurus-metrodorus-never-left",
    philosopher: "Epicurus",
    topic: "teaching",
    gloss:
      "Metrodorus of Lampsacus, from his first acquaintance with Epicurus, never leaves him - except once, for six months, on a visit to his native place, from which he returns to him again.",
    grc: "Μαθητὰς δὲ ἔσχε πολλοὺς μέν, σφόδρα δὲ ἐλλογίμους Μητρόδωρον Ἀθηναίου ἢ Τιμοκρατους καὶ Σάνδης Λαμψακηνόν· ὃς ἀφʼ οὗ τὸν ἄνδρα ἔγνω, οὐκ ἀπέστη ἀπʼ αὐτοῦ πλὴν ἓξ μηνῶν εἰς τὴν οἰκείαν, ἔπειτʼ ἐπανῆλθε.",
    en: "Metrodorus, the son of Athenaeus (or of Timocrates) and of Sande, a citizen of Lampsacus, who from his first acquaintance with Epicurus never left him except once for six months spent on a visit to his native place, from which he returned to him again.",
    ref: "10.22",
    involves: "Metrodorus",
    certainty: "asserted",
    note: "Metrodorus died seven years before Epicurus, in his fifty-third year; the will provides for his children (10.23, 10.19-21).",
  },
];
