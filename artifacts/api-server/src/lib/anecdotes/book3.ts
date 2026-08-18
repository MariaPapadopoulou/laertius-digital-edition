/**
 * Book 3 anecdotes - Plato. Narrated incidents only; bare dicta live in the
 * sayings layer (see the overlap policy in anecdotes.ts). Every `en` is a
 * verbatim Hicks excerpt of the cited section, enforced by
 * validate-anecdotes.
 *
 * Curation notes: incidents whose whole substance is already a curated
 * saying are not re-curated - the dice-player rebuke (3.38,
 * plato-habit-no-trifle), the memoirs answer (3.38, plato-name-memoirs),
 * Xenocrates asked to chastise the slave (3.38,
 * plato-xenocrates-chastise-slave), the flogging deferred for passion
 * (3.39, plato-passion-flogging), the dismount for fear of horse-pride
 * (3.39, plato-horse-pride), and the drunkards' mirror (3.39,
 * plato-drunkards-mirror). The Dionysius "old dotard" exchange (3.18) IS
 * curated here because the voyage narrative frames the saying
 * (plato-tyrant-dotard). Attributions to Speusippus, Clearchus and
 * Anaxilaïdes (3.2, the Apollo story) and to Neanthes (3.3, death at
 * eighty-four) stay in notes: those labels are philosopher nodes or would
 * mint new sources.
 */
import type { Anecdote } from "../anecdotes";

export const BOOK3_ANECDOTES: Anecdote[] = [
  {
    id: "plato-apollo-dream-birth",
    philosopher: "Plato",
    topic: "piety",
    gloss:
      "A story at Athens: Ariston made violent love to Perictione and failed to win her - until Apollo appeared to him in a dream, whereupon he left her unmolested until her child was born.",
    en: "tell us that there was a story at Athens that Ariston made violent love to Perictione, then in her bloom, and failed to win her; and that, when he ceased to offer violence, Apollo appeared to him in a dream, whereupon he left her unmolested until her child was born.",
    grc: "ὡς Ἀθήνησιν ἦν λόγος, ὡραίαν οὖσαν τὴν Περικτιόνην βιάζεσθαι τὸν Ἀρίστωνα καὶ μὴ τυγχάνειν· παυόμενόν τε τῆς βίας ἰδεῖν τὴν τοῦ Ἀπόλλωνος ὄψιν· ὅθεν καθαρὰν γάμου φυλάξαι ἕως τῆς ἀποκυήσεως.",
    ref: "3.2",
    certainty: "reported",
    note: "Told by Speusippus in Plato's Funeral Feast, Clearchus in his Encomium on Plato, and Anaxilaïdes in his second book On Philosophers; the attributions stay in this note (Speusippus is a philosopher node, the others would mint new sources).",
  },
  {
    id: "plato-swan-dream",
    philosopher: "Plato",
    topic: "encounter",
    gloss:
      "Socrates dreams of a cygnet on his knees that puts forth plumage and flies away with a loud sweet note - and the next day, when Plato is introduced as a pupil, recognizes in him the swan of his dream.",
    en: "It is stated that Socrates in a dream saw a cygnet on his knees, which all at once put forth plumage, and flew away after uttering a loud sweet note. And the next day Plato was introduced as a pupil, and thereupon he recognized in him the swan of his dream.",
    grc: "λέγεται δʼ ὅτι Σωκράτης ὄναρ εἶδε κύκνου νεοττὸν ἐν τοῖς γόνασιν ἔχειν, ὃν καὶ παραχρῆμα πτεροφυήσαντα ἀναπτῆναι ἡδὺ κλάγξαντα· καὶ μεθʼ ἡμέραν Πλάτωνα αὐτῷ συστῆναι, τὸν δὲ τοῦτον εἰπεῖν εἶναι τὸν ὄρνιν.",
    ref: "3.5",
    involves: "Socrates",
    certainty: "reported",
  },
  {
    id: "plato-burns-his-tragedy",
    philosopher: "Plato",
    topic: "conversion",
    gloss:
      "About to compete for the prize with a tragedy, Plato listens to Socrates in front of the theatre of Dionysus - and consigns his poems to the flames: 'Come hither, O fire-god, Plato now has need of thee.'",
    en: "Afterwards, when he was about to compete for the prize with a tragedy, he listened to Socrates in front of the theatre of Dionysus, and then consigned his poems to the flames, with the words : Come hither, O fire-god, Plato now has need of thee.",
    grc: "ἔπειτα μέντοι μέλλων ἀγωνιεῖσθαι τραγῳδίᾳ πρὸ τοῦ Διονυσιακοῦ θεάτρου Σωκράτους ἀκούσας κατέφλεξε τὰ ποιήματα εἰπών· Ἥφαιστε, πρόμολʼ ὧδε· Πλάτων νύ τι σεῖο χατίζει.",
    ref: "3.5",
    involves: "Socrates",
    certainty: "asserted",
  },
  {
    id: "plato-offends-dionysius",
    philosopher: "Plato",
    topic: "defiance",
    gloss:
      "On his first voyage to Sicily, Plato holds forth on tyranny to Dionysius' face - the interest of the ruler alone is not the best end unless he excels in virtue - and trades insults with the enraged tyrant.",
    en: "He made three voyages to Sicily, the first time to see the island and the craters of Etna: on this occasion Dionysius, the son of Hermocrates, being on the throne, forced him to become intimate with him. But when Plato held forth on tyranny and maintained that the interest of the ruler alone was not the best end, unless he were also pre-eminent in virtue, he offended Dionysius, who in his anger exclaimed, You talk like an old dotard. And you like a tyrant, rejoined Plato.",
    grc: "τρὶς δὲ πέπλευκεν εἰς Σικελίαν· πρῶτον μὲν κατὰ θέαν τῆς νήσου καὶ τῶν κρατήρων, ὅτε καὶ Διονύσιος ὁ Ἑρμοκράτους τύραννος ὢν ἠνάγκασεν ὥστε συμμῖξαι αὐτῷ. ὁ δὲ διαλεγόμενος περὶ τυραννίδος καὶ φάσκων ὡς οὐκ ἔστι τὸ τοῦ κρείττονος συμφέρον αὐτὸ † μόνον, εἰ μὴ καὶ ἀρετῇ διαφέροι, προσέκρουσεν αὐτῷ. ὀργισθεὶς γὰρ οἱ λόγοι σου, φησί, γεροντιῶσι, καὶ ὅς· σοῦ δέ γε τυραννιῶσιν.",
    ref: "3.18",
    involves: "Dionysius",
    certainty: "asserted",
    framesSaying: "plato-tyrant-dotard",
  },
  {
    id: "plato-sold-into-slavery",
    philosopher: "Plato",
    topic: "capture",
    gloss:
      "Dissuaded from putting Plato to death, Dionysius hands him over to Pollis the Lacedaemonian with orders to sell him into slavery - and Pollis takes him to Aegina and offers him for sale.",
    en: "then, when he had been dissuaded from this by Dion and Aristomenes, he did not indeed go so far but handed him over to Pollis the Lacedaemonian, who had just then arrived on an embassy, with orders to sell him into slavery. And Pollis took him to Aegina and there offered him for sale.",
    grc: "εἶτα παρακληθεὶς ὑπὸ Δίωνος καὶ Ἀριστομένους τοῦτο μὲν οὐκ ἐποίησε, παρέδωκε δὲ αὐτὸν Πόλλιδι τῷ Λακεδαιμονίῳ κατὰ καιρὸν διὰ πρεσβείαν ἀφιγμένῳ ὥστε ἀποδόσθαι. κἀκεῖνος ἀγαγὼν αὐτὸν εἰς Αἴγιναν ἐπίπρασκεν·",
    ref: "3.19",
    involves: "Dion",
    certainty: "asserted",
  },
  {
    id: "plato-acquitted-on-aegina",
    philosopher: "Plato",
    topic: "capture",
    gloss:
      "Indicted on Aegina under a law dooming the first Athenian to set foot on the island, Plato is acquitted when someone urges - though in jest - that the offender is a philosopher.",
    en: "And then Charmandrus, the son of Charmandrides, indicted him on a capital charge according to the law in force among the Aeginetans, to the effect that the first Athenian who set foot upon the island should be put to death without a trial. This law had been passed by the prosecutor himself, according to Favorinus in his Miscellaneous History. But when some one urged, though in jest, that the offender was a philosopher, the court acquitted him.",
    grc: "ὅτε καὶ Χάρμανδρος Χαρμανδρίδου ἐγράψατο αὐτῷ δίκην θανάτου κατὰ τὸν παρʼ αὐτοῖς τεθέντα νόμον, τὸν πρῶτον ἐπιβάντα Ἀθηναίων τῇ νήσῳ ἄκριτον ἀποθνῄσκειν. ἦν δʼ αὐτὸς ὁ θεὶς τὸν νόμον, καθά φησι Φαβωρῖνος ἐν Παντοδαπῇ ἱστορίᾳ. εἰπόντος δέ τινος, ἀλλὰ κατὰ παιδιάν, φιλόσοφον εἶναι τὸν ἐπιβάντα, ἀπέλυσαν.",
    ref: "3.19",
    certainty: "asserted",
    note: "Another version: brought before the assembly, he kept absolute silence and was sold as if a prisoner of war (3.19).",
  },
  {
    id: "plato-ransomed-by-anniceris",
    philosopher: "Plato",
    topic: "capture",
    gloss:
      "Anniceris the Cyrenaic ransoms Plato for twenty minae and sends him to Athens; when his friends remit the money, Anniceris declines it - the Athenians are not the only people worthy of the privilege of providing for Plato.",
    en: "Anniceris the Cyrenaic happened to be present and ransomed him for twenty minae—according to others the sum was thirty minae—and dispatched him to Athens to his friends, who immediately remitted the money. But Anniceris declined it, saying that the Athenians were not the only people worthy of the privilege of providing for Plato.",
    grc: "Λυτροῦται δὴ αὐτὸν κατὰ τύχην παρὼν Ἀννίκερις ὁ Κυρηναῖος εἴκοσι μνῶν—οἱ δὲ τριάκοντα —καὶ ἀναπέμπει Ἀθήναζε πρὸς τοὺς ἑταίρους. οἱ δʼ εὐθὺς τἀργύριον ἐξέπεμψαν· ὅπερ οὐ προσήκατο εἰπὼν μὴ μόνους ἐκείνους ἀξίους εἶναι Πλάτωνος κήδεσθαι.",
    ref: "3.20",
    involves: "Anniceris",
    certainty: "asserted",
    note: "Others assert that Dion sent the money and that Anniceris bought for Plato the little garden in the Academy (3.20).",
  },
  {
    id: "plato-no-leisure-for-dionysius",
    philosopher: "Plato",
    topic: "wit",
    gloss:
      "Dionysius writes enjoining Plato not to speak evil of him; Plato replies that he has not the leisure to keep Dionysius in his mind.",
    en: "Dionysius, indeed, could not rest. On learning the facts he wrote and enjoined upon Plato not to speak evil of him. And Plato replied that he had not the leisure to keep Dionysius in his mind.",
    grc: "οὐ μὴν ἡσύχαζεν ὁ Διονύσιος· μαθὼν δὲ ἐπέστειλε Πλάτωνι μὴ κακῶς ἀγορεύειν αὐτόν. καὶ ὃς ἀντεπέστειλε μὴ τοσαύτην αὐτῷ σχολὴν εἶναι ὥστε Διονυσίου μεμνῆσθαι.",
    ref: "3.21",
    involves: "Dionysius",
    certainty: "asserted",
  },
  {
    id: "plato-archytas-rescue",
    philosopher: "Plato",
    topic: "capture",
    gloss:
      "Suspected of encouraging Dion and Theodotas in a scheme to liberate Sicily, Plato is in great danger - until Archytas the Pythagorean writes to Dionysius, procures his pardon, and gets him conveyed safe to Athens.",
    en: "Some say that Plato was also in great danger, being suspected of encouraging Dion and Theodotas in a scheme for liberating the whole island; on this occasion Archytas the Pythagorean wrote to Dionysius, procured his pardon, and got him conveyed safe to Athens.",
    grc: "ἔνιοι δέ φασι καὶ κινδυνεῦσαι αὐτὸν ὡς ἀναπείθοντα Δίωνα καὶ Θεοδόταν ἐπὶ τῇ τῆς νήσου ἐλευθερίᾳ· ὅτε καὶ Ἀρχύτας αὐτὸν ὁ Πυθαγορικὸς γράψας ἐπιστολὴν πρὸς Διονύσιον παρῃτήσατο καὶ διέσωσεν εἰς Ἀθήνας.",
    ref: "3.21",
    involves: "Archytas",
    certainty: "reported",
    note: "The letter itself - Archytas to Dionysius on Plato's safe return - is quoted at 3.21-22.",
  },
  {
    id: "plato-declines-megalopolis",
    philosopher: "Plato",
    topic: "defiance",
    gloss:
      "Invited by the Arcadians and Thebans to be legislator of the newly founded Megalopolis, Plato refuses to go on discovering that they are opposed to equality of possessions.",
    en: "Pamphila in the twenty-fifth book of her Memorabilia says that the Arcadians and Thebans, when they were founding Megalopolis, invited Plato to be their legislator; but that, when he discovered that they were opposed to equality of possessions, he refused to go.",
    grc: "φησὶ δὲ Παμφίλη ἐν τῷ πέμπτῳ καὶ εἰκοστῷ τῶν Ὑπομνημάτων ὡς Ἀρκάδες καὶ Θηβαῖοι Μεγάλην πόλιν οἰκίζοντες παρεκάλουν αὐτὸν νομοθέτην· ὁ δὲ μαθὼν ἴσον ἔχειν οὐ θέλοντας οὐκ ἐπορεύθη.",
    ref: "3.23",
    certainty: "reported",
    accordingTo: "Pamphila",
  },
  {
    id: "plato-hemlock-crobylus",
    philosopher: "Plato",
    topic: "defiance",
    gloss:
      "Going up to the Acropolis to plead for the general Chabrias - which no one else at Athens would do - Plato is warned by the informer Crobylus that the hemlock of Socrates awaits him: 'As I faced dangers when serving in the cause of my country, so I will face them now in the cause of duty for a friend.'",
    en: "and that, on this occasion, as he was going up to the Acropolis along with Chabrias, Crobylus the informer met him and said, What, are you come to speak for the defence? Don’t you know that the hemlock of Socrates awaits you? To this Plato replied, As I faced dangers when serving in the cause of my country, so I will face them now in the cause of duty for a friend.",
    grc: "ὅτε καὶ ἀνιόντι αὐτῷ εἰς τὴν ἀκρόπολιν σὺν τῷ Χαβρίᾳ Κρωβύλος ὁ συκοφάντης ἀπαντήσας φησίν· ἄλλῳ συναγορεύσων ἥκεις, ἀγνοῶν ὅτι καὶ σὲ τὸ Σωκράτους κώνειον ἀναμένει; τὸν δὲ φάναι· καὶ ὅτε ὑπὲρ τῆς πατρίδος ἐστρατευόμην, ὑπέμενον τοὺς κινδύνους, καὶ νῦν ὑπὲρ τοῦ καθήκοντος διὰ φίλον ὑπομενῶ.",
    ref: "3.24",
    involves: "Chabrias",
    certainty: "reported",
  },
  {
    id: "plato-mithradates-statue",
    philosopher: "Plato",
    topic: "legacy",
    gloss:
      "Mithradates the Persian sets up a statue of Plato in the Academy, made by Silanion and dedicated to the Muses.",
    en: "In the first book of the Memorabilia of Favorinus there is a statement that Mithradates the Persian set up a statue of Plato in the Academy and inscribed upon it these words: Mithradates the Persian, the son of Orontobates, dedicated to the Muses a likeness of Plato made by Silanion.",
    grc: "ἐν δὲ τῷ πρώτῳ τῶν Ἀπομνημονευμάτων Φαβωρίνου φέρεται ὅτι Μιθραδάτης ὁ Πέρσης ἀνδριάντα Πλάτωνος ἀνέθετο εἰς τὴν Ἀκαδήμειαν καὶ ἐπέγραψε· Μιθραδάτης Ὀροντοβάτου Πέρσης Μούσαις εἰκόνα ἀνέθηκε Πλάτωνος, ἣν Σιλανίων ἐποίησε.",
    ref: "3.25",
    certainty: "reported",
    accordingTo: "Favorinus",
  },
  {
    id: "plato-antisthenes-sathon",
    philosopher: "Plato",
    topic: "encounter",
    gloss:
      "Invited to hear Antisthenes read on the impossibility of contradiction, Plato asks how he can then write on the subject - showing the argument refutes itself; Antisthenes retorts with a dialogue against him titled Sathon, and they remain estranged.",
    en: "It is said also that Antisthenes, being about to read publicly something that he had composed, invited Plato to be present. And on his inquiring what he was about to read, Antisthenes replied that it was something about the impossibility of contradiction. How then, said Plato, can you write on this subject? thus showing him that the argument refutes itself. Thereupon he wrote a dialogue against Plato and entitled it Sathon. After this they continued to be estranged from one another.",
    grc: "λέγεται δʼ ὅτι καὶ Ἀντισθένης μέλλων ἀναγινώσκειν τι τῶν γεγραμμένων αὐτῷ παρεκάλεσεν αὐτὸν παρατυχεῖν. καὶ πυθομένου, τί μέλλει ἀναγινώσκειν, εἶπεν ὅτι περὶ τοῦ μὴ εἶναι ἀντιλέγειν· τοῦ δʼ εἰπόντος· πῶς οὖν σὺ περὶ αὐτοῦ τούτου γράφεις; καὶ διδάσκοντος ὅτι περιτρέπεται, ἔγραψε διάλογον κατὰ Πλάτωνος Σάθωνα ἐπιγράψας· ἐξ οὗ διετέλουν ἀλλοτρίως ἔχοντες πρὸς ἀλλήλους.",
    ref: "3.35",
    involves: "Antisthenes",
    certainty: "reported",
  },
  {
    id: "plato-socrates-lysis-lies",
    philosopher: "Plato",
    topic: "encounter",
    gloss:
      "Hearing Plato read the Lysis, Socrates exclaims: 'By Heracles, what a number of lies this young man is telling about me!' - for the dialogue includes much that Socrates never said.",
    en: "They say that, on hearing Plato read the Lysis , Socrates exclaimed, By Heracles, what a number of lies this young man is telling about me! For he has included in the dialogue much that Socrates never said.",
    grc: "φασὶ δὲ καὶ Σωκράτην ἀκούσαντα τὸν Λύσιν ἀναγινώσκοντος Πλάτωνος Ἡράκλεις, εἰπεῖν, ὡς πολλά μου καταψεύδεθʼ ὁ νεανίσκος. οὐκ ὀλίγα γὰρ ὧν οὐκ εἴρηκε Σωκράτης γέγραφεν ἁνήρ.",
    ref: "3.35",
    involves: "Socrates",
    certainty: "reported",
  },
  {
    id: "plato-aristotle-stays",
    philosopher: "Plato",
    topic: "teaching",
    gloss:
      "When Plato reads the dialogue On the Soul, Aristotle alone stays to the end - the rest of the audience gets up and goes away.",
    en: "And according to Favorinus, when Plato read the dialogue On the Soul , Aristotle alone stayed to the end; the rest of the audience got up and went away.",
    grc: "τοῦτον μόνον παραμεῖναι Πλάτωνι Φαβωρῖνός πού φησιν ἀναγινώσκοντι τὸν Περὶ ψυχῆς, τοὺς δʼ ἄλλους ἀναστῆναι πάντας.",
    ref: "3.37",
    involves: "Aristotle",
    certainty: "reported",
    accordingTo: "Favorinus",
  },
  {
    id: "plato-wedding-feast-death",
    philosopher: "Plato",
    topic: "death",
    gloss:
      "Plato dies at a wedding feast in the first year of the 108th Olympiad, in his eighty-first year.",
    en: "He died, according to Hermippus, at a wedding feast, in the first year of the 108th Olympiad, in his eightyfirst year.",
    grc: "τελευτᾷ δὲ—ὥς φησιν Ἕρμιππος, ἔν γάμοις δειπνῶν—τῷ πρώτῳ ἔτει τῆς ὀγδόης καὶ ἑκατοστῆς Ὀλυμπιάδος, βιοὺς ἔτος ἓν πρὸς τοῖς ὀγδοήκοντα.",
    ref: "3.2",
    certainty: "reported",
    accordingTo: "Hermippus",
    note: "Neanthes, however, makes him die at the age of eighty-four (3.3); Myronianus preserves a rival lice version (3.40).",
  },
  {
    id: "plato-death-by-lice",
    philosopher: "Plato",
    topic: "death",
    gloss:
      "Myronianus reports proverbs in circulation about Plato's lice - implying that this was the mode of his death.",
    en: "But Myronianus in his Parallels says that Philo mentions some proverbs that were in circulation about Plato’s lice, implying that this was the mode of his death.",
    grc: "Μυρωνιανὸς δʼ ἐν Ὁμοίοις φησὶ Φίλωνα παροιμίας μνημονεύειν περὶ τῶν Πλάτωνος φθειρῶν, ὡς οὕτως αὐτοῦ τελευτήσαντος.",
    ref: "3.40",
    certainty: "disputed",
    accordingTo: "Myronianus",
    note: "A rival to Hermippus' wedding-feast account (3.2).",
  },
  {
    id: "plato-buried-in-academy",
    philosopher: "Plato",
    topic: "legacy",
    gloss:
      "Plato is buried in the Academy, where he spent the greatest part of his life in philosophical study - whence the Academic school takes its name - and all the students join in the funeral procession.",
    en: "He was buried in the Academy, where he spent the greatest part of his life in philosophical study. And hence the school which he founded was called the Academic school. And all the students there joined in the funeral procession.",
    grc: "καὶ ἐτάφη ἐν τῇ Ἀκαδημείᾳ, ἔνθα τὸν πλεῖστον χρόνον διετέλεσε φιλοσοφῶν. ὅθεν καὶ Ἀκαδημαϊκὴ προσηγορεύθη ἡ ἀπʼ αὐτοῦ αἵρεσις. καὶ παρεπέμφθη πανδημεὶ πρὸς τῶν αὐτόθι",
    ref: "3.41",
    certainty: "asserted",
    note: "His will - estates, silver, four household servants, and the enfranchisement of Artemis - is quoted at 3.41-43.",
  },
  {
    id: "plato-writings-consultation-fee",
    philosopher: "Plato",
    topic: "legacy",
    gloss:
      "When Plato's writings are first edited with critical marks, their possessors charge a fee to anyone who wishes to consult them.",
    en: "As Antigonus of Carystus says in his Life of Zeno , when the writings were first edited with critical marks, their possessors charged a certain fee to anyone who wished to consult them.",
    grc: "ἅπερ Ἀντίγονός φησιν ὁ Καρύστιος ἐν τῷ Περὶ Ζήνωνος νεωστὶ ἐκδοθέντα εἴ τις ἤθελε διαναγνῶναι, μισθὸν ἐτέλει τοῖς κεκτημένοις.",
    ref: "3.66",
    certainty: "reported",
    accordingTo: "Antigonus of Carystus",
  },
];
