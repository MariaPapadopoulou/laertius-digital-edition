/**
 * Book 6 anecdotes - the Cynics: Antisthenes, Diogenes of Sinope (the most
 * anecdote-dense Life in the work), Monimus, Crates, Metrocles, Hipparchia,
 * Menippus, and Menedemus the Cynic. Narrated incidents only; bare dicta
 * live in the sayings layer (see the overlap policy in anecdotes.ts).
 * Every `en` is a verbatim Hicks excerpt of the cited section, enforced by
 * validate-anecdotes.
 *
 * Curation notes: Antisthenes' first-doubled-cloak report keeps its rival
 * attribution (Sosicrates → Diodorus of Aspendus) in the note rather than
 * alsoAttributedTo, because alsoAttributedTo mints a person node and
 * Diodorus of Aspendus exists nowhere else in the graph. Zeno of Citium's
 * sheepskin story (6.91) is deliberately not curated: Zeno is not otherwise
 * a claim/saying source, and one line of heedlessness does not justify
 * minting a source double node. Onesicritus (6.84) has no narrated incident
 * - his chapter is a literary comparison with Xenophon.
 */
import type { Anecdote } from "../anecdotes";

export const BOOK6_ANECDOTES: Anecdote[] = [
  {
    id: "antisthenes-tanagra-bravery",
    philosopher: "Antisthenes",
    topic: "encounter",
    gloss:
      "After Antisthenes distinguishes himself at Tanagra, Socrates remarks that so brave a man could not have sprung from two Athenian parents.",
    grc:
      "ὅθεν καὶ ἐν Τανάγρᾳ κατὰ τὴν μάχην εὐδοκιμήσας ἔδωκε λέγειν Σωκράτει ὡς οὐκ ἂν ἐκ δυοῖν Ἀθηναίων οὕτω γεγόνοι γενναῖος.",
    en: "Hence it was that, when he had distinguished himself in the battle of Tanagra, he gave Socrates occasion to remark that, if both his parents had been Athenians, he would not have turned out so brave.",
    ref: "6.1",
    involves: "Socrates",
    certainty: "asserted",
  },
  {
    id: "antisthenes-isthmian-excuse",
    philosopher: "Antisthenes",
    topic: "teaching",
    gloss:
      "He plans to lecture the assembled Greeks at the Isthmian games on their cities' faults and merits - and backs out when he sees the crowds arriving.",
    grc:
      "φησὶ δʼ Ἕρμιππος ὅτι προείλετο ἐν τῇ τῶν Ἰσθμίων πανηγύρει ψέξαι τε καὶ ἐπαινέσαι Ἀθηναίους, Θηβαίους, Λακεδαιμονίους· εἶτα μέντοι παραιτήσασθαι ἰδόντα πλείους ἐκ τῶν πόλεων ἀφιγμένους.",
    en: "According to Hermippus he intended at the public gathering for the Isthmian games to discourse on the faults and merits of Athenians, Thebans and Lacedaemonians, but begged to be excused when he saw throngs arriving from those cities.",
    ref: "6.2",
    certainty: "reported",
    accordingTo: "Hermippus",
  },
  {
    id: "antisthenes-tramps-to-socrates",
    philosopher: "Antisthenes",
    topic: "conversion",
    gloss:
      "Won over by Socrates, he tramps the five miles from the Peiraeus daily to hear him - and out of that hardihood inaugurates the Cynic way of life.",
    grc:
      "Ὕστερον δὲ παρέβαλε Σωκράτει, καὶ τοσοῦτον ὤνατο αὐτοῦ, ὥστε παρῄνει τοῖς μαθηταῖς γενέσθαι αὐτῷ πρὸς Σωκράτην συμμαθητάς. οἰκῶν τʼ ἐν Πειραιεῖ καθʼ ἑκάστην ἡμέραν τοὺς τετταράκοντα σταδίους ἀνιὼν ἤκουε Σωκράτους, παρʼ οὗ καὶ τὸ καρτερικὸν λαβὼν καὶ τὸ ἀπαθὲς ζηλώσας κατῆρξε πρῶτος τοῦ κυνισμοῦ.",
    en: "Later on, however, he came into touch with Socrates, and derived so much benefit from him that he used to advise his own disciples to become fellow-pupils with him of Socrates. He lived in the Peiraeus, and every day would tramp the five miles to Athens in order to hear Socrates. From Socrates he learned his hardihood, emulating his disregard of feeling, and thus he inaugurated the Cynic way of life.",
    ref: "6.2",
    involves: "Socrates",
    certainty: "asserted",
  },
  {
    id: "antisthenes-visits-sick-plato",
    philosopher: "Antisthenes",
    topic: "wit",
    gloss:
      "Visiting the sick Plato and eyeing the basin he had vomited into, Antisthenes finds the bile but not the pride.",
    grc:
      "καί ποτʼ ἐλθὼν πρὸς αὐτὸν νοσοῦντα καὶ θεασάμενος λεκάνην ἔνθα ὁ Πλάτων ἐμημέκει ἔφη, χολὴν μὲν ὁρῶ ἐνταῦθα, τῦφον δὲ οὐχ ὁρῶ.",
    en: "And one day he visited Plato, who was ill, and seeing the basin into which Plato had vomited, remarked, The bile I see, but not the pride.",
    ref: "6.7",
    involves: "Plato",
    certainty: "asserted",
    framesSaying: "antisthenes-bile-not-pride",
  },
  {
    id: "antisthenes-torn-cloak-vanity",
    philosopher: "Antisthenes",
    topic: "asceticism",
    gloss:
      "Antisthenes parades the torn part of his cloak - and Socrates spies his love of fame peeping through it.",
    grc:
      "στρέψαντος αὐτοῦ τὸ διερρωγὸς τοῦ τρίβωνος εἰς τὸ προφανές, Σωκράτης ἰδών φησιν, ὁρῶ σου διὰ τοῦ τρίβωνος τὴν φιλοδοξίαν.",
    en: "When he turned the torn part of his cloak so that it came into view, Socrates no sooner saw this than he said, I spy your love of fame peeping through your cloak.",
    ref: "6.8",
    involves: "Socrates",
    certainty: "asserted",
    framesSaying: "socrates-fame-through-cloak",
  },
  {
    id: "antisthenes-salt-fish-wallet",
    philosopher: "Antisthenes",
    topic: "wit",
    gloss:
      "Promised future favours by a young man awaiting his boatload of salt fish, Antisthenes has a wallet filled at the flour-dealer's and leaves the bill to the promiser.",
    grc:
      "Ποντικοῦ νε ανίσκου πολυωρήσειν αὐτοῦ ἐπαγγελλομένου, εἰ τὸ πλοῖον ἀφίκοιτο τῶν ταρίχων, λαβὼν αὐτὸν καὶ θύλακον κενὸν πρὸς ἀλφιτόπωλιν ἧκε καὶ σαξάμενος ἀπῄει· τῆς δὲ αἰτούσης τὸ διάφορον, ὁ νεανίσκος, ἔφη, δώσει ἐὰν τὸ πλοῖον αὐτοῦ τῶν ταρίχων ἀφίκηται.",
    en: "When a young man from Pontus promised to treat him with great consideration as soon as his boat with its freight of salt fish should arrive, he took him and an empty wallet to a flour-dealer’s, got it filled, and was going away. When the woman asked for the money, The young man will pay, said he, when his boatload of salt fish arrives.",
    ref: "6.9",
    certainty: "asserted",
    framesSaying: "antisthenes-salt-fish",
  },
  {
    id: "antisthenes-anytus-exile",
    philosopher: "Antisthenes",
    topic: "defiance",
    gloss:
      "Avenging Socrates, he leads young admirers from Pontus to Anytus, ironically declaring him the wiser man - and the indignant crowd drives Anytus out of the city.",
    grc:
      "Ποντικοῖς γὰρ νεανίσκοις κατὰ κλέος τοῦ Σωκράτους ἀφιγμένοις περιτυχὼν ἀπήγαγεν αὐτοὺς πρὸς τὸν Ἄνυτον, εἰπὼν ἐν ἤθει σοφώτερον εἶναι τοῦ Σωκράτους· ἐφʼ ᾧ διαγανακτήσαντας τοὺς περιεστῶτας ἐκδιῶξαι αὐτόν.",
    en: "For he fell in with some youths from Pontus whom the fame of Socrates had brought to Athens, and he led them off to Anytus, whom he ironically declared to be wiser than Socrates; whereupon (it is said) those about him with much indignation drove Anytus out of the city.",
    ref: "6.10",
    involves: "Anytus",
    certainty: "reported",
    note: "D.L. holds Antisthenes responsible for the exile of Anytus and the execution of Meletus (6.9).",
  },
  {
    id: "antisthenes-first-doubled-cloak",
    philosopher: "Antisthenes",
    topic: "asceticism",
    gloss:
      "Diocles credits Antisthenes with being the first to double his cloak, take up staff and wallet - the Cynic uniform - though Sosicrates gives the priority to Diodorus of Aspendus.",
    grc:
      "καὶ πρῶτος ἐδίπλωσε τὸν τρίβωνα, καθά φησι Διοκλῆς, καὶ μόνῳ αὐτῷ ἐχρῆτο· βάκτρον τʼ ἀνέλαβε καὶ πήραν. πρῶτον δὲ καὶ Νεάνθης φησὶ διπλῶσαι θοιμάτιον. Σωσικράτης δʼ ἐν τρίτῃ Διαδοχῶν Διόδωρον τὸν Ἀσπένδιον, καὶ πώγωνα καθεῖναι καὶ πήρᾳ καὶ βάκτρῳ χρῆσθαι.",
    en: "And he was the first, Diocles tells us, to double his cloak and be content with that one garment and to take up a staff and a wallet. Neanthes too asserts that he was the first to double his mantle. Sosicrates, however, in the third book of his Successions of Philosophers says this was first done by Diodorus of Aspendus, who also let his beard grow and used a staff and a wallet.",
    ref: "6.13",
    certainty: "disputed",
    accordingTo: "Diocles",
    note: "Neanthes concurs with Diocles; Sosicrates' rival candidate Diodorus of Aspendus is kept in this note (not alsoAttributedTo) so the anecdote layer mints no new person node.",
  },
  {
    id: "antisthenes-death-dagger",
    philosopher: "Antisthenes",
    topic: "death",
    gloss:
      "Dying of disease, Antisthenes cries out for release from his pains; Diogenes shows him a dagger - 'I said from my pains, not from life.'",
    grc:
      "ἐτελεύτησε δὲ ἀρρωστίᾳ· ὅτε καὶ Διογένης εἰσιὼν πρὸς αὐτὸν ἔφη, μήτι χρεία φίλου; καί ποτε παρʼ αὐτὸν ξιφίδιον ἔχων εἰσῄει. τοῦ δʼ εἰπόντος, τίς ἂν ἀπολύσειέ με τῶν πόνων; δείξας τὸ ξιφίδιον, ἔφη, τοῦτο · καὶ ὅς, τῶν πόνων, εἶπον, οὐ τοῦ ζῆν.",
    en: "He died of disease just as Diogenes, who had come in, inquired of him, Have you need of a friend? Once too Diogenes, when he came to him, brought a dagger. And when Antisthenes cried out, Who will release me from these pains? replied, This, showing him the dagger. I said, quoth the other, from my pains, not from life.",
    ref: "6.18",
    involves: "Diogenes",
    certainty: "asserted",
    note: "D.L. adds (6.19) that he was thought to show some weakness in bearing his malady through love of life.",
  },
  {
    id: "diogenes-sinope-exile-coinage",
    philosopher: "Diogenes of Sinope",
    topic: "exile",
    gloss:
      "Diogenes leaves Sinope over the adulterated coinage - D.L. reports rival versions of who debased it and why.",
    grc:
      "φησὶ δὲ Διοκλῆς, δημοσίαν αὐτοῦ τὴν τράπεζαν ἔχοντος τοῦ πατρὸς καὶ παραχαράξαντος τὸ νόμισμα, φυγεῖν. Εὐβουλίδης δʼ ἐν τῷ Περὶ Διογένους αὐτόν φησι Διογένην τοῦτο πρᾶξαι καὶ συναλᾶσθαι τῷ πατρί.",
    en: "Diocles relates that he went into exile because his father was entrusted with the money of the state and adulterated the coinage. But Eubulides in his book on Diogenes says that Diogenes himself did this and was forced to leave home along with his father.",
    ref: "6.20",
    certainty: "disputed",
    accordingTo: "Diocles",
    note: "Eubulides' rival version is quoted in the same section; D.L. adds that Diogenes himself confesses to the adulteration in his Pordalus.",
  },
  {
    id: "diogenes-sinope-wears-out-antisthenes",
    philosopher: "Diogenes of Sinope",
    topic: "conversion",
    gloss:
      "Rebuffed by Antisthenes, who never welcomed pupils, Diogenes wears him down by sheer persistence and becomes his student.",
    grc:
      "Γενόμενος δὲ Ἀθήνησιν Ἀντισθένει παρέβαλε. τοῦ δὲ διωθουμένου διὰ τὸ μηδένα προσίεσθαι, ἐξεβιάζετο τῇ προσεδρίᾳ.",
    en: "On reaching Athens he fell in with Antisthenes. Being repulsed by him, because he never welcomed pupils, by sheer persistence Diogenes wore him out.",
    ref: "6.21",
    involves: "Antisthenes",
    certainty: "asserted",
    framesSaying: "diogenes-sinope-strike-no-wood",
  },
  {
    id: "diogenes-sinope-mouse-lesson",
    philosopher: "Diogenes of Sinope",
    topic: "conversion",
    gloss:
      "Watching a mouse run about without wants, Diogenes discovers the means of adapting himself to circumstances.",
    grc:
      "Μῦν θεασάμενος διατρέχοντα, καθά φησι Θεόφραστος ἐν τῷ Μεγαρικῷ, καὶ μήτε κοίτην ἐπιζητοῦντα μήτε σκότος εὐλαβούμενον ἢ ποθοῦντά τι τῶν δοκούντων ἀπολαυστῶν, πόρον ἐξεῦρε τῆς περιστάσεως.",
    en: "Through watching a mouse running about, says Theophrastus in the Megarian dialogue, not looking for a place to lie down in, not afraid of the dark, not seeking any of the things which are considered to be dainties, he discovered the means of adapting himself to circumstances.",
    ref: "6.22",
    certainty: "reported",
    accordingTo: "Theophrastus",
  },
  {
    id: "diogenes-sinope-tub-metroon",
    philosopher: "Diogenes of Sinope",
    topic: "asceticism",
    gloss:
      "Kept waiting for a cottage, Diogenes takes the tub in the Metroön for his home.",
    grc:
      "ἐπιστείλας δέ τινι οἰκίδιον αὐτῷ προνοήσασθαι, βραδύνοντος, τὸν ἐν τῷ Μητρῴῳ πίθον ἔσχεν οἰκίαν, ὡς καὶ αὐτὸς ἐν ταῖς ἐπιστολαῖς διασαφεῖ.",
    en: "He had written to some one to try and procure a cottage for him. When this man was a long time about it, he took for his abode the tub in the Metroön, as he himself explains in his letters.",
    ref: "6.23",
    certainty: "asserted",
  },
  {
    id: "diogenes-sinope-sand-and-snow",
    philosopher: "Diogenes of Sinope",
    topic: "training",
    gloss:
      "He rolls his tub over hot sand in summer and embraces snow-covered statues in winter, inuring himself to hardship.",
    grc:
      "καὶ θέρους μὲν ἐπὶ ψάμμου ζεστῆς ἐκυλινδεῖτο, χειμῶνος δʼ ἀνδριάντας κεχιονισμένους περιελάμβανε, πανταχόθεν ἑαυτὸν συνασκῶν.",
    en: "And in summer he used to roll in it over hot sand, while in winter he used to embrace statues covered with snow, using every means of inuring himself to hardship.",
    ref: "6.23",
    certainty: "asserted",
  },
  {
    id: "diogenes-sinope-tramples-carpets",
    philosopher: "Diogenes of Sinope",
    topic: "defiance",
    gloss:
      "At Plato's house, before guests from Dionysius, Diogenes tramples the carpets to trample Plato's vainglory.",
    grc:
      "Πατῶν αὐτοῦ ποτε τὰ στρώματα κεκληκότος φίλους παρὰ Διονυσίου, ἔφη, πατῶ τὴν Πλάτωνος κενοσπουδίαν · πρὸς ὃν ὁ Πλάτων, ὅσον, ὦ Διόγενες, τοῦ τύφου διαφαίνεις, δοκῶν μὴ τετυφῶσθαι.",
    en: "And one day when Plato had invited to his house friends coming from Dionysius, Diogenes trampled upon his carpets and said, I trample upon Plato’s vainglory.",
    ref: "6.26",
    involves: "Plato",
    certainty: "asserted",
    framesSaying: "diogenes-sinope-trample-vainglory",
  },
  {
    id: "diogenes-sinope-spits-in-face",
    philosopher: "Diogenes of Sinope",
    topic: "shamelessness",
    gloss:
      "Warned not to spit in a magnificent house, Diogenes discharges the phlegm into his host's face - the only meaner receptacle.",
    grc:
      "εἰσαγαγόντος τινὸς αὐτὸν εἰς οἶκον πολυτελῆ καὶ κωλύοντος πτύσαι, ἐπειδὴ ἐχρέμψατο, εἰς τὴν ὄψιν αὐτοῦ ἔπτυσεν, εἰπὼν χείρονα τόπον μὴ εὑρηκέναι.",
    en: "Some one took him into a magnificent house and warned him not to expectorate, whereupon having cleared his throat he discharged the phlegm into the man’s face, being unable, he said, to find a meaner receptacle.",
    ref: "6.32",
    certainty: "disputed",
    alsoAttributedTo: "Aristippus",
    framesSaying: "diogenes-sinope-meaner-receptacle",
  },
  {
    id: "diogenes-sinope-revellers-tablet",
    philosopher: "Diogenes of Sinope",
    topic: "defiance",
    gloss:
      "Beaten by young revellers, Diogenes hangs a tablet with their names around his neck and shames them publicly.",
    grc:
      "εἰσελθών ποτε ἡμιξύρητος εἰς νέων συμπόσιον, καθά φησι Μητροκλῆς ἐν ταῖς Χρείαις, πληγὰς ἔλαβε· μετὰ δὲ ἐγγράψας τὰ ὀνόματα εἰς λεύκωμα τῶν πληξάντων περιῄει ἐξημμένος, ἕως αὐτοὺς ὕβρει περιέθηκε καταγινωσκομένους καὶ ἐπιπληττομένους.",
    en: "One day he made his way with head half shaven into a party of young revellers, as Metrocles relates in his Anecdotes, and was roughly handled by them. Afterwards he entered on a tablet the names of those who had struck him and went about with the tablet hung round his neck, till he had covered them with ridicule and brought universal blame and discredit upon them.",
    ref: "6.33",
    certainty: "reported",
    accordingTo: "Metrocles",
  },
  {
    id: "diogenes-sinope-raw-meat",
    philosopher: "Diogenes of Sinope",
    topic: "training",
    gloss:
      "Diogenes walks barefoot on snow and even attempts to eat raw meat, though he cannot digest it.",
    grc:
      "γυμνοῖς ποσὶ χιόνα ἐπάτει καὶ τἄλλα ὅσα ἄνω προείρηται· καὶ ὠμὰ δὲ κρέα ἐπεχείρησε φαγεῖν, ἀλλʼ οὐ διῴκησε.",
    en: "He would walk upon snow barefoot and do the other things mentioned above. Not only so; he even attempted to eat meat raw, but could not manage to digest it.",
    ref: "6.34",
    certainty: "asserted",
  },
  {
    id: "diogenes-sinope-wine-jar-lesson",
    philosopher: "Diogenes of Sinope",
    topic: "teaching",
    gloss:
      "To shame a man too embarrassed to pick up a dropped loaf, Diogenes drags a wine-jar on a rope across the Ceramicus.",
    grc:
      "ἐκβαλόντος δʼ ἄρτον τινὸς καὶ αἰσχυνομένου ἀνελέσθαι, βουλόμενος αὐτὸν νουθετῆσαι, κεράμου τράχηλον δήσας ἔσυρε διὰ τοῦ Κεραμεικοῦ.",
    en: "Some one dropped a loaf of bread and was ashamed to pick it up; whereupon Diogenes, wishing to read him a lesson, tied a rope to the neck of a wine-jar and proceeded to drag it across the Ceramicus.",
    ref: "6.35",
    certainty: "asserted",
  },
  {
    id: "diogenes-sinope-tunny-test",
    philosopher: "Diogenes of Sinope",
    topic: "teaching",
    gloss:
      "A would-be pupil is told to carry a tunny through the streets; shame defeats him, and the friendship is broken by a fish.",
    grc:
      "ἤθελέ τις παρʼ αὐτῷ φιλοσοφεῖν· ὁ δέ οἱ σαπέρδην δοὺς ἐκέλευσεν ἀκολουθεῖν. ὡς δʼ ὑπʼ αἰδοῦς ῥίψας ἀπῆλθε, μετὰ χρόνον ὑπαντήσας αὐτῷ καὶ γελάσας λέγει, τὴν σὴν καὶ ἐμὴν φιλίαν σαπέρδης διέλυσε.",
    en: "Some one wanted to study philosophy under him. Diogenes gave him a tunny to carry and told him to follow him. And when for shame the man threw it away and departed, some time after on meeting him he laughed and said, The friendship between you and me was broken by a tunny.",
    ref: "6.36",
    certainty: "disputed",
    framesSaying: "diogenes-sinope-tunny-friendship",
    note: "Diocles' version, given in the same section, has a half-obol cheese in place of the tunny.",
  },
  {
    id: "diogenes-sinope-discards-cup",
    philosopher: "Diogenes of Sinope",
    topic: "asceticism",
    gloss:
      "Seeing a child drink from its hands and eat from bread, Diogenes throws away his own cup and bowl as superfluous.",
    grc:
      "Θεασάμενός ποτε παιδίον ταῖς χερσὶ πῖνον ἐξέρριψε τῆς πήρας τὴν κοτύλην, εἰπών, παιδίον με νενίκηκεν εὐτελείᾳ. ἐξέβαλε δὲ καὶ τὸ τρυβλίον, ὁμοίως παιδίον θεασάμενος, ἐπειδὴ κατέαξε τὸ σκεῦος, τῷ κοίλῳ τοῦ ψωμίου τὴν φακῆν ὑποδεχόμενον.",
    en: "One day, observing a child drinking out of his hands, he cast away the cup from his wallet with the words, A child has beaten me in plainness of living. He also threw away his bowl when in like manner he saw a child who had broken his plate taking up his lentils with the hollow part of a morsel of bread.",
    ref: "6.37",
    certainty: "asserted",
    framesSaying: "diogenes-sinope-child-cup",
  },
  {
    id: "diogenes-sinope-alexander-craneum",
    philosopher: "Diogenes of Sinope",
    topic: "encounter",
    gloss:
      "Alexander stands over Diogenes sunning himself in the Craneum and offers any boon; Diogenes asks him to stand out of his light.",
    grc:
      "ἐν τῷ Κρανείῳ ἡλιουμένῳ αὐτῷ Ἀλέξανδρος ἐπιστάς φησιν, αἴτησόν με ὃ θέλεις. καὶ ὅς, ἀποσκότησόν μου, φησί.",
    en: "When he was sunning himself in the Craneum, Alexander came and stood over him and said, Ask of me any boon you like. To which he replied, Stand out of my light.",
    ref: "6.38",
    involves: "Alexander",
    certainty: "asserted",
    framesSaying: "diogenes-sinope-alexander-light",
  },
  {
    id: "diogenes-sinope-walks-at-motion",
    philosopher: "Diogenes of Sinope",
    topic: "teaching",
    gloss:
      "When someone declares that motion does not exist, Diogenes refutes him by getting up and walking about.",
    grc:
      "ὁμοίως καὶ πρὸς τὸν εἰπόντα ὅτι κίνησις οὐκ ἔστιν, ἀναστὰς περιεπάτει.",
    en: "In like manner, when somebody declared that there is no such thing as motion, he got up and walked about.",
    ref: "6.39",
    certainty: "asserted",
  },
  {
    id: "diogenes-sinope-plucked-fowl",
    philosopher: "Diogenes of Sinope",
    topic: "defiance",
    gloss:
      "Diogenes brings a plucked fowl into Plato's lecture-room to demolish the definition of man as a featherless biped.",
    grc:
      "Πλάτωνος ὁρισαμένου, Ἄνθρωπός ἐστι ζῷον δίπουν ἄπτερον, καὶ εὐδοκιμοῦντος, τίλας ἀλεκτρυόνα εἰσήνεγκεν αὐτὸν εἰς τὴν σχολὴν καί φησιν, οὗτός ἐστιν ὁ Πλάτωνος ἄνθρωπος. ὅθεν τῷ ὅρῳ προσετέθη τὸ πλατυώνυχον.",
    en: "Plato had defined Man as an animal, biped and featherless, and was applauded. Diogenes plucked a fowl and brought it into the lecture-room with the words, Here is Plato’s man. In consequence of which there was added to the definition, having broad nails.",
    ref: "6.40",
    involves: "Plato",
    certainty: "asserted",
    framesSaying: "diogenes-sinope-platos-man",
  },
  // 6.41 lamp-in-daylight: NOT curated here - its entire substance is the
  // saying diogenes-sinope-lamp (the excerpts would be identical, which the
  // cross-layer equality guard rejects by design).
  {
    id: "diogenes-sinope-meidias-gauntlets",
    philosopher: "Diogenes of Sinope",
    topic: "defiance",
    gloss:
      "Assaulted by Meidias with the taunt of 3000 drachmas, Diogenes returns next day with boxing-gauntlets and repays him in blows.",
    grc:
      "ἀλλὰ καὶ Μειδίου κονδυλίσαντος αὐτὸν καὶ εἰπόντος, τρισχίλιαί σοι κεῖνται ἐπὶ τῇ τραπέζῃ, τῇ ἑξῆς πυκτικοὺς λαβὼν ἱμάντας καὶ καταλοήσας αὐτὸν ἔφη, τρισχίλιαί σοι κεῖνται ἐπὶ τῇ τραπέζῃ.",
    en: "Further, when Meidias assaulted him and went on to say, There are 3000 drachmas to your credit, the next day he took a pair of boxing-gauntlets, gave him a thrashing and said, There are 3000 blows to your credit.",
    ref: "6.42",
    involves: "Meidias",
    certainty: "asserted",
    framesSaying: "diogenes-sinope-3000-blows",
  },
  {
    id: "diogenes-sinope-tub-replaced",
    philosopher: "Diogenes of Sinope",
    topic: "legacy",
    gloss:
      "When a youngster breaks his tub, the Athenians flog the boy and present Diogenes with another.",
    grc:
      "Ἠγαπᾶτο δὲ καὶ πρὸς Ἀθηναίων· μειρακίου γοῦν τὸν πίθον αὐτοῦ συντρίψαντος, τῷ μὲν πληγὰς ἔδοσαν, ἐκείνῳ δὲ ἄλλον παρέσχον.",
    en: "Still he was loved by the Athenians. At all events, when a youngster broke up his tub, they gave the boy a flogging and presented Diogenes with another.",
    ref: "6.43",
    certainty: "asserted",
  },
  {
    id: "diogenes-sinope-spy-on-philip",
    philosopher: "Diogenes of Sinope",
    topic: "capture",
    gloss:
      "Seized after Chaeronea and dragged before Philip, Diogenes calls himself a spy upon the king's insatiable greed - and is freed for it.",
    grc:
      "φησὶ δὲ Διονύσιος ὁ στωικὸς ὡς μετὰ Χαιρώνειαν συλληφθεὶς ἀπήχθη πρὸς Φίλιππον· καὶ ἐρωτηθεὶς ὅστις εἴη, ἀπεκρίνατο, κατάσκοπος τῆς σῆς ἀπληστίας· ὅθεν θαυμασθεὶς ἀφείθη.",
    en: "Dionysius the Stoic says that after Chaeronea he was seized and dragged off to Philip, and being asked who he was, replied, A spy upon your insatiable greed. For this he was admired and set free.",
    ref: "6.43",
    involves: "Philip",
    certainty: "reported",
    accordingTo: "Dionysius the Stoic",
    framesSaying: "diogenes-sinope-spy-greed",
  },
  {
    id: "diogenes-sinope-lupins-upstage",
    philosopher: "Diogenes of Sinope",
    topic: "wit",
    gloss:
      "Diogenes upstages a set speech by standing opposite the orator eating lupins until the audience deserts to watch him.",
    grc:
      "μειρακίου ἐπιδεικνυμένου πληρώσας τὸ προκόλπιον θέρμων ἀντικρὺ ἔκαπτε· τοῦ δὲ πλήθους εἰς αὐτὸν ἀφορῶντος θαυμάζειν ἔφη πῶς ἐκεῖνον ἀφέντες εἰς αὐτὸν ὁρῶσι.",
    en: "A young man was delivering a set speech, when Diogenes, having filled the front fold of his dress with lupins, began to eat them, standing right opposite to him. Having thus drawn off the attention of the assemblage, he said he was greatly surprised that they should desert the orator to look at himself.",
    ref: "6.48",
    certainty: "asserted",
  },
  {
    id: "diogenes-sinope-salt-fish-lecture",
    philosopher: "Diogenes of Sinope",
    topic: "wit",
    gloss:
      "An obol's worth of salt fish, produced at the right moment, breaks up Anaximenes' lecture-class.",
    grc:
      "διαλεγομένου ποτὲ τοῦ αὐτοῦ τάριχος προτείνας περιέσπασε τοὺς ἀκροατάς· ἀγανακτοῦντος δέ, τὴν Ἀναξιμένους, ἔφη, διάλεξιν ὀβολοῦ τάριχος διαλέλυκεν.",
    en: "And when the same man was discoursing, Diogenes distracted his audience by producing some salt fish. This annoyed the lecturer, and Diogenes said, An obol’s worth of salt fish has broken up Anaximenes’ lecture-class.",
    ref: "6.57",
    // NOT bare "Anaximenes": that label is the Milesian philosopher's node,
    // and the LOD layer links involves-labels that match philosopher nodes.
    involves: "Anaximenes the rhetorician",
    certainty: "asserted",
  },
  {
    id: "diogenes-sinope-pirates-sale",
    philosopher: "Diogenes of Sinope",
    topic: "capture",
    gloss:
      "Captured by pirates and put up for sale in Crete, Diogenes declares his trade is ruling men and picks out Xeniades as the buyer who needs a master.",
    grc:
      "Καὶ πρᾶσιν ἤνεγκε γενναιότατα· πλέων γὰρ εἰς Αἴγιναν καὶ πειραταῖς ἁλοὺς ὧν ἦρχε Σκίρπαλος, εἰς Κρήτην ἀπαχθεὶς ἐπιπράσκετο· καὶ τοῦ κήρυκος ἐρωτῶντος τί οἶδε ποιεῖν, ἔφη, ἀνθρώπων ἄρχειν. ὅτε καὶ δείξας τινὰ Κορίνθιον εὐπάρυφον, τὸν προειρημένον Ξενιάδην, ἔφη, τούτῳ με πώλει· οὗτος δεσπότου χρῄζει.",
    en: "For on a voyage to Aegina he was captured by pirates under the command of Scirpalus, conveyed to Crete and exposed for sale. When the auctioneer asked in what he was proficient, he replied, In ruling men. Thereupon he pointed to a certain Corinthian with a fine purple border to his robe, the man named Xeniades above-mentioned, and said, Sell me to this man; he needs a master.",
    ref: "6.74",
    involves: "Xeniades",
    certainty: "asserted",
  },
  {
    id: "diogenes-sinope-refuses-ransom",
    philosopher: "Diogenes of Sinope",
    topic: "defiance",
    gloss:
      "When friends offer to ransom him from slavery, Diogenes calls them simpletons: lions are not the slaves of those who feed them.",
    grc:
      "Φησὶ δὲ Κλεομένης ἐν τῷ ἐπιγραφομένῳ Παιδαγωγικῷ τοὺς γνωρίμους λυτρώσασθαι αὐτὸν θελῆσαι, τὸν δʼ εὐήθεις αὐτοὺς εἰπεῖν· οὐδὲ γὰρ τοὺς λέοντας δούλους εἶναι τῶν τρεφόντων, ἀλλὰ τοὺς τρέφοντας τῶν λεόντων. δούλου γὰρ τὸ φοβεῖσθαι, τὰ δὲ θηρία φοβερὰ τοῖς ἀνθρώποις εἶναι.",
    en: "Cleomenes in his work entitled Concerning Pedagogues says that the friends of Diogenes wanted to ransom him, whereupon he called them simpletons; for, said he, lions are not the slaves of those who feed them, but rather those who feed them are at the mercy of the lions: for fear is the mark of the slave, whereas wild beasts make men afraid of them.",
    ref: "6.75",
    certainty: "reported",
    accordingTo: "Cleomenes",
  },
  {
    id: "diogenes-sinope-rival-deaths",
    philosopher: "Diogenes of Sinope",
    topic: "death",
    gloss:
      "D.L. records rival accounts of Diogenes' end - colic from a raw octopus, or a voluntary death by holding his breath.",
    grc:
      "περὶ δὲ τοῦ θανάτου διάφοροι λέγονται λόγοι· οἱ μὲν γὰρ πολύποδα φαγόντα ὠμὸν χολερικῇ ληφθῆναι καὶ ὧδε τελευτῆσαι· οἱ δὲ τὸ πνεῦμα συγκρατήσαντα",
    en: "Regarding his death there are several different accounts. One is that he was seized with colic after eating an octopus raw and so met his end. Another is that he died voluntarily by holding his breath.",
    ref: "6.76",
    certainty: "disputed",
  },
  {
    id: "diogenes-sinope-burial-quarrel",
    philosopher: "Diogenes of Sinope",
    topic: "legacy",
    gloss:
      "His disciples come to blows over who shall bury him; he is laid by the Isthmus gate under a pillar crowned with a marble dog.",
    grc:
      "Ἔνθα καὶ στάσις, ὥς φασιν, ἐγένετο τῶν γνωρίμων, τίνες αὐτὸν θάψουσιν· ἀλλὰ καὶ μέχρι χειρῶν ἦλθον. ἀφικομένων δὲ τῶν πατέρων καὶ τῶν ὑπερεχόντων, ὑπὸ τούτοις ταφῆναι τὸν ἄνδρα παρὰ τῇ πύλῃ τῇ φερούσῃ εἰς τὸν Ἰσθμόν. ἐπέστησάν τʼ αὐτῷ κίονα καὶ ἐπʼ αὐτῷ λίθου Παρίου κύνα.",
    en: "Hence, it is said, arose a quarrel among his disciples as to who should bury him: nay, they even came to blows; but, when their fathers and men of influence arrived, under their direction he was buried beside the gate leading to the Isthmus. Over his grave they set up a pillar and a dog in Parian marble upon it.",
    ref: "6.78",
    certainty: "reported",
  },
  {
    id: "monimus-feigned-madness",
    philosopher: "Monimus",
    topic: "conversion",
    gloss:
      "Fired by Xeniades' reports of Diogenes, the banker's servant Monimus feigns madness and flings the money off the table until his master dismisses him - straight into philosophy.",
    grc:
      "οἰκέτης δέ τινος τραπεζίτου Κορινθίου, καθά φησι Σωσικράτης. πρὸς τοῦτον συνεχὲς ἀφικνούμενος ὁ Ξενιάδης ὁ τὸν Διογένην ἐωνημένος τὴν ἀρετὴν αὐτοῦ καὶ τῶν ἔργων καὶ τῶν λόγων διηγούμενος εἰς ἔρωτα τἀνδρὸς ἐνέβαλε τὸν Μόνιμον. αὐτίκα γὰρ ἐκεῖνος μανίαν προσποιηθεὶς τό τε κέρμα διερρίπτει καὶ πᾶν τὸ ἐπὶ τῆς τραπέζης ἀργύριον, ἕως αὐτὸν ὁ δεσπότης παρῃτήσατο· καὶ ὃς εὐθέως Διογένους ἦν.",
    en: "he was in the service of a certain Corinthian banker, to whom Xeniades, the purchaser of Diogenes, made frequent visits, and by the account which he gave of his goodness in word and deed, excited in Monimus a passionate admiration of Diogenes. For he forthwith pretended to be mad and proceeded to fling away the small change and all the money on the banker’s table, until at length his master dismissed him; and he then straightway devoted himself to Diogenes.",
    ref: "6.82",
    involves: "Xeniades",
    certainty: "reported",
    accordingTo: "Sosicrates",
  },
  {
    id: "crates-thebes-renounces-fortune",
    philosopher: "Crates of Thebes",
    topic: "conversion",
    gloss:
      "Struck by the sight of Telephus in beggar's rags on the tragic stage, Crates turns his 200-talent fortune into money and gives it to his fellow-citizens.",
    grc:
      "Τοῦτόν φησιν Ἀντισθένης ἐν ταῖς Διαδοχαῖς θεασάμενον ἔν τινι τραγῳδίᾳ Τήλεφον σπυρίδιον ἔχοντα καὶ τἄλλα λυπρὸν ᾆξαι ἐπὶ τὴν κυνικὴν φιλοσοφίαν· ἐξαργυρισάμενόν τε τὴν οὐσίαν—καὶ γὰρ ἦν τῶν ἐπιφανῶν—ἀθροίσαντα πρὸς τὰ [ἑκατὸν] διακόσια τάλαντα, τοῖς πολίταις διανεῖμαι ταῦτα.",
    en: "According to Antisthenes in his Successions , the first impulse to the Cynic philosophy was given to him when he saw Telephus in a certain tragedy carrying a little basket and altogether in a wretched plight. So he turned his property into money,—for he belonged to a distinguished family,—and having thus collected about 200 talents, distributed that sum among his fellow-citizens.",
    ref: "6.87",
    certainty: "disputed",
    accordingTo: "Antisthenes",
    note: "Rival accounts in the same context: Diocles relates that Diogenes persuaded him to give up his fields and throw his money into the sea (6.87), and Demetrius of Magnesia that he deposited the money with a banker for his sons - to be theirs only if they stayed ordinary men (6.88). The source is Antisthenes the Successions-writer, not the philosopher.",
  },
  {
    id: "crates-thebes-alexander-lodges",
    philosopher: "Crates of Thebes",
    topic: "encounter",
    gloss:
      "Alexander is said to have lodged in Crates' home, as Philip once lived in Hipparchia's.",
    grc:
      "Καὶ Κράτητος μέν, φησίν, ὁ οἶκος ὑπʼ Ἀλεξάνδρου * * Ἱππαρχίας δὲ ὑπὸ Φιλίππου.",
    en: "In the home of Crates Alexander is said to have lodged, as Philip once lived in Hipparchia’s.",
    ref: "6.88",
    involves: "Alexander",
    certainty: "reported",
  },
  {
    id: "crates-thebes-kinsmen-stick",
    philosopher: "Crates of Thebes",
    topic: "defiance",
    gloss:
      "Kinsmen keep coming to talk him out of the Cynic life; Crates drives them off with his stick, unshaken.",
    grc:
      "πολλάκις τε τῇ βακτηρίᾳ τῶν συγγενῶν τινας προσιόντας καὶ ἀποτρέποντας ἐδίωκε καὶ ἦν γενναῖος.",
    en: "Often, too, certain of his kinsmen would come to visit him and try to divert him from his purpose. These he would drive from him with his stick, and his resolution was unshaken.",
    ref: "6.88",
    certainty: "asserted",
  },
  {
    id: "crates-thebes-pasicles-brothel",
    philosopher: "Crates of Thebes",
    topic: "shamelessness",
    gloss:
      "Eratosthenes tells how Crates took his son Pasicles, service done, to a brothel - that, he said, was how his own father had married.",
    grc:
      "Ἐρατοσθένης δέ φησιν, ἐξ Ἱππαρχίας, περὶ ἧς λέξομεν, γενομένου παιδὸς αὐτῷ ὄνομα Πασικλέους, ὅτʼ ἐξ ἐφήβων ἐγένετο, ἀγαγεῖν αὐτὸν ἐπʼ οἴκημα παιδίσκης καὶ φάναι τοῦτον αὐτῷ πατρῷον εἶναι τὸν γάμον·",
    en: "Eratosthenes tells us that by Hipparchia, of whom we shall presently speak, he had a son born to him named Pasicles, and after he had ceased to be a cadet on service, Crates took him to a brothel and told him that was how his father had married.",
    ref: "6.88",
    involves: "Pasicles",
    certainty: "reported",
    accordingTo: "Eratosthenes",
  },
  {
    id: "crates-thebes-gymnasiarch-hips",
    philosopher: "Crates of Thebes",
    topic: "shamelessness",
    gloss:
      "Pressing a request on the master of the gymnasium, Crates lays hold of the man's hips - are they not his as much as his knees?",
    grc:
      "Χάριεν δʼ αὐτοῦ Φαβωρῖνος ἐν δευτέρῳ τῶν Ἀπομνημονευμάτων φέρει. φησὶ γάρ· παρακαλῶν περί του τὸν γυμνασίαρχον, τῶν ἰσχίων αὐτοῦ ἥπτετο· ἀγανακτοῦντος δέ, ἔφη, τί γάρ; οὐχὶ καὶ ταῦτα σά ἐστι καθάπερ καὶ τὰ γόνατα;",
    en: "Favorinus, in the second book of his Memorabilia , tells a pleasant story of Crates. For he relates how, when making some request of the master of the gymnasium, he laid hold on his hips; and when he demurred, said, What, are not these hip-joints yours as much as your knees?",
    ref: "6.89",
    certainty: "reported",
    accordingTo: "Favorinus",
    framesSaying: "crates-thebes-hip-joints",
  },
  {
    id: "crates-thebes-nicodromus-plaster",
    philosopher: "Crates of Thebes",
    topic: "defiance",
    gloss:
      "Struck in the face by the musician Nicodromus, Crates wears a plaster on his forehead inscribed 'Nicodromus's handiwork'.",
    grc:
      "Νικόδρομον ἐξερεθίσας τὸν κιθαρῳδὸν ὑπωπιάσθη· προσθεὶς οὖν πιττάκιον τῷ μετώπῳ ἐπέγραψε, Νικόδρομος ἐποίει.",
    en: "Having exasperated the musician Nicodromus, he was struck by him on the face. So he stuck a plaster on his forehead with these words on it, Nicodromus’s handiwork.",
    ref: "6.89",
    involves: "Nicodromus",
    certainty: "asserted",
    framesSaying: "crates-thebes-nicodromus-handiwork",
  },
  {
    id: "crates-thebes-muslin-barber",
    philosopher: "Crates of Thebes",
    topic: "wit",
    gloss:
      "Faulted by the police-inspectors for wearing muslin, Crates marches them to a barber's shop to see Theophrastus being shaved in the same.",
    grc:
      "ὑπὸ τῶν Ἀθήνησιν ἀστυνόμων ἐπιτιμηθεὶς ὅτι σινδόνα ἠμφίεστο, ἔφη, καὶ Θεόφραστον ὑμῖν δείξω σινδόνα περιβεβλημένον· ἀπιστούντων δέ, ἀπήγαγεν ἐπὶ κουρεῖον καὶ ἔδειξε κειρόμενον.",
    en: "When the police-inspectors found fault with him for wearing muslin, his answer was, I’ll show you that Theophrastus also wears muslin. This they would not believe: so he led them to a barber’s shop and showed them Theophrastus being shaved.",
    ref: "6.90",
    involves: "Theophrastus",
    certainty: "asserted",
    framesSaying: "crates-thebes-theophrastus-muslin",
  },
  {
    id: "crates-thebes-dragged-by-heels",
    philosopher: "Crates of Thebes",
    topic: "defiance",
    gloss:
      "Flogged and dragged by the heels, Crates declaims Homer as if it did not touch him - D.L. reports three versions of who did the dragging.",
    grc:
      "ἐν Θήβαις ὑπὸ τοῦ γυμνασιάρχου μαστιγωθείσ—οἱ δέ, ἐν Κορίνθῳ ὑπʼ Εὐθυκράτουσ—καὶ ἑλκόμενος τοῦ ποδὸς ἐπέλεγεν ἀφροντιστῶν, ἕλκε ποδὸς τεταγὼν διὰ βηλοῦ θεσπεσίοιο.",
    en: "At Thebes he was flogged by the master of the gymnasium—another version being that it was by Euthycrates and at Corinth; and being dragged by the heels, he called out, as if it did not affect him : Seized by the foot and dragged o’er heaven’s high threshold:",
    ref: "6.90",
    certainty: "disputed",
    note: "Diocles gives a third version (6.91): it was Menedemus of Eretria who dragged him, provoked by Crates' brutal taunt about Asclepiades the Phliasian.",
  },
  {
    id: "crates-thebes-mocked-gymnastics",
    philosopher: "Crates of Thebes",
    topic: "training",
    gloss:
      "Ugly and laughed at over his gymnastic exercises, Crates raises his hands and cheers himself on - it is for the good of his eyes and body.",
    grc:
      "ἦν δὲ καὶ τὴν ὄψιν αἰσχρὸς καὶ γυμναζόμενος ἐγελᾶτο. εἰώθει δὲ λέγειν ἐπαίρων τὰς χεῖρας, θάρρει, Κράτης, ὑπὲρ ὀφθαλμῶν καὶ τοῦ λοιποῦ σώματος·",
    en: "He was ugly to look at, and when performing his gymnastic exercises used to be laughed at. He was accustomed to say, raising his hands, Take heart, Crates, for it is for the good of your eyes and of the rest of your body.",
    ref: "6.91",
    certainty: "asserted",
    framesSaying: "crates-thebes-take-heart",
  },
  {
    id: "crates-thebes-death-chant",
    philosopher: "Crates of Thebes",
    topic: "death",
    gloss:
      "Feeling death near, the hunchbacked old Crates chants his own dirge: you are off to the house of Hades, bent crooked by old age.",
    grc:
      "συναισθανόμενος ὅτι ἀποθνήσκει, ἐπῇδε πρὸς ἑαυτὸν λέγων, στείχεις δή, φίλε κυρτών, βαίνεις τʼ εἰς Ἀΐδαο δόμους κυφὸς διὰ γῆρας. ἦν γὰρ κυφὸς ὑπὸ χρόνου.",
    en: "Perceiving that he was dying, he would chant over himself this charm, You are going, dear hunchback, you are off to the house of Hades,—bent crooked by old age. For his years had bowed him down.",
    ref: "6.92",
    certainty: "asserted",
  },
  {
    id: "metrocles-crates-cure",
    philosopher: "Metrocles",
    topic: "conversion",
    gloss:
      "Mortified by a breach of manners mid-speech, Metrocles shuts himself up to starve; Crates visits, dines on lupins, and cures him by argument and demonstration - winning a pupil.",
    grc:
      "Μητροκλῆς ὁ Μαρωνείτης, ἀδελφὸς Ἱππαρχίας, ὃς πρότερον ἀκούων Θεοφράστου τοῦ περιπατητικοῦ τοσοῦτον διέφθαρτο, ὥστε ποτὲ μελετῶν καὶ μεταξύ πως ἀποπαρδὼν ὑπʼ ἀθυμίας οἴκοι κατάκλειστος ἦν, ἀποκαρτερεῖν βουλόμενος. μαθὼν δὴ ὁ Κράτης εἰσῆλθε πρὸς αὐτὸν παρακληθεὶς καὶ θέρμους ἐπίτηδες βεβρωκὼς ἔπειθε μὲν αὐτὸν καὶ διὰ τῶν λόγων μηδὲν φαῦλον πεποιηκέναι· τέρας γὰρ ἂν γεγονέναι εἰ μὴ καὶ τὰ πνεύματα κατὰ φύσιν ἀπεκρίνετο· τέλος δὲ καὶ ἀποπαρδὼν αὐτὸν ἀνέρρωσεν, ἀφʼ ὁμοιότητος τῶν ἔργων παραμυθησάμενος. τοὐντεῦθεν ἤκουεν αὐτοῦ καὶ ἐγένετο ἀνὴρ ἱκανὸς ἐν φιλοσοφίᾳ.",
    en: "He had been formerly a pupil of Theophrastus the Peripatetic, and had been so far corrupted by weakness that, when he made a breach of good manners in the course of rehearsing a speech, it drove him to despair, and he shut himself up at home, intending to starve himself to death. On learning this Crates came to visit him as he had been asked to do, and after advisedly making a meal of lupins, he tried to persuade him by argument as well that he had committed no crime, for a prodigy would have happened if he had not taken the natural means of relieving himself. At last by reproducing the action he succeeded in lifting him from his dejection, using for his consolation the likeness of the occurrences. From that time forward Metrocles was his pupil, and became proficient in philosophy.",
    ref: "6.94",
    involves: "Crates",
    certainty: "asserted",
  },
  {
    id: "metrocles-burns-writings",
    philosopher: "Metrocles",
    topic: "eccentricity",
    gloss:
      "Metrocles burns his own compositions - or, others say, his notes of Theophrastus's lectures - with a tragic verse for each version.",
    grc:
      "Οὗτος τὰ ἑαυτοῦ συγγράμματα κατακαίων, ὥς φησιν Ἑκάτων ἐν πρώτῳ Χρειῶν, ἐπέλεγε· τάδʼ ἔστʼ ὀνείρων νερτέρων φαντάσματα, [οἷον λῆρος]· οἱ δʼ, ὅτι τὰς Θεοφράστου ἀκροάσεις καταφλέγων ἐπέλεγε, Ἥφαιστε, πρόμολʼ ὧδε, Θέτις νύ τι σεῖο χατίζει.",
    en: "Hecato in the first book of his Anecdotes tells us he burned his compositions with the words : Phantoms are these of dreams o’ the world below. Others say that when he set fire to his notes of Theophrastus’s lectures, he added the line: Come hither, Hephaestus, Thetis now needeth thee.",
    ref: "6.95",
    certainty: "disputed",
    accordingTo: "Hecato",
  },
  {
    id: "hipparchia-chooses-crates",
    philosopher: "Hipparchia",
    topic: "conversion",
    gloss:
      "Deaf to wealthy and well-born suitors, Hipparchia threatens her parents with suicide unless she may marry Crates - who strips before her: this is the bridegroom, these his possessions.",
    grc:
      "Καὶ ἤρα τοῦ Κράτητος καὶ τῶν λόγων καὶ τοῦ βίου, οὐδενὸς τῶν μνηστευομένων ἐπιστρεφομένη, οὐ πλούτου, οὐκ εὐγενείας, οὐ κάλλους· ἀλλὰ πάντʼ ἦν Κράτης αὐτῇ. καὶ δὴ καὶ ἠπείλει τοῖς γονεῦσιν ἀναιρήσειν αὑτήν, εἰ μὴ τούτῳ δοθείη. Κράτης μὲν οὖν παρακαλούμενος ὑπὸ τῶν γονέων αὐτῆς ἀποτρέψαι τὴν παῖδα, πάντʼ ἐποίει, καὶ τέλος μὴ πείθων, ἀναστὰς καὶ ἀποθέμενος τὴν ἑαυτοῦ σκευὴν ἀντικρὺ αὐτῆς ἔφη, ὁ μὲν νυμφίος οὗτος, ἡ δὲ κτῆσις αὕτη, πρὸς ταῦτα βουλεύου · οὐδὲ γὰρ ἔσεσθαι κοινωνόν, εἰ μὴ καὶ τῶν αὐτῶν ἐπιτηδευμάτων γενηθείη.",
    en: "She fell in love with the discourses and the life of Crates, and would not pay attention to any of her suitors, their wealth, their high birth or their beauty. But to her Crates was everything. She used even to threaten her parents she would make away with herself, unless she were given in marriage to him. Crates therefore was implored by her parents to dissuade the girl, and did all he could, and at last, failing to persuade her, got up, took off his clothes before her face and said, This is the bridegroom, here are his possessions; make your choice accordingly; for you will be no helpmeet of mine, unless you share my pursuits.",
    ref: "6.96",
    involves: "Crates",
    certainty: "asserted",
    framesSaying: "crates-thebes-bridegroom",
  },
  {
    id: "hipparchia-silences-theodorus",
    philosopher: "Hipparchia",
    topic: "encounter",
    gloss:
      "At Lysimachus' banquet Hipparchia corners Theodorus the atheist with a sophism he cannot answer; his attempt to strip off her cloak leaves her unmoved.",
    grc:
      "ὅτε καὶ πρὸς Λυσίμαχον εἰς τὸ συμπόσιον ἦλθεν, ἔνθα Θεόδωρον τὸν ἐπίκλην Ἄθεον ἐπήλεγξε, σόφισμα προτείνασα τοιοῦτον· ὃ ποιῶν Θεόδωρος οὐκ ἂν ἀδικεῖν λέγοιτο, οὐδʼ Ἱππαρχία ποιοῦσα τοῦτο ἀδικεῖν λέγοιτʼ ἄν· Θεόδωρος δὲ τύπτων ἑαυτὸν οὐκ ἀδικεῖ, οὐδʼ ἄρα Ἱππαρχία Θεόδωρον τύπτουσα ἀδικεῖ. ὁ δὲ πρὸς μὲν τὸ λεχθὲν οὐδὲν ἀπήντησεν, ἀνέσυρε δʼ αὐτῆς θοιμάτιον· ἀλλʼ οὔτε κατεπλάγη Ἱππαρχία οὔτε διεταράχθη ὡς γυνή.",
    en: "Accordingly she appeared at the banquet given by Lysimachus, and there put down Theodorus, known as the atheist, by means of the following sophism. Any action which would not be called wrong if done by Theodorus, would not be called wrong if done by Hipparchia. Now Theodorus does no wrong when he strikes himself: therefore neither does Hipparchia do wrong when she strikes Theodorus. He had no reply wherewith to meet the argument, but tried to strip her of her cloak. But Hipparchia showed no sign of alarm or of the perturbation natural in a woman.",
    ref: "6.97",
    involves: "Theodorus",
    certainty: "asserted",
  },
  {
    id: "hipparchia-loom-retort",
    philosopher: "Hipparchia",
    topic: "wit",
    gloss:
      "Taunted by Theodorus with the tragic line about quitting the loom, Hipparchia owns it - was she ill advised to spend on education the time she would have wasted weaving?",
    grc:
      "ἀλλὰ καὶ εἰπόντος αὐτῇ, αὕτη ʼστὶν ἡ τὰς παρʼ ἱστοῖς ἐκλιποῦσα κερκίδας; ἐγώ, φησίν, εἰμί, Θεόδωρε· ἀλλὰ μὴ κακῶς σοι δοκῶ βεβουλεῦσθαι περὶ αὑτῆς, εἰ, τὸν χρόνον ὃν ἔμελλον ἱστοῖς προσαναλώσειν, τοῦτον εἰς παιδείαν κατεχρησάμην;",
    en: "And when he said to her: Is this she Who quitting woof and warp and comb and loom? she replied, It is I, Theodorus,—but do you suppose that I have been ill advised about myself, if instead of wasting further time upon the loom I spent it in education?",
    ref: "6.98",
    involves: "Theodorus",
    certainty: "asserted",
    framesSaying: "hipparchia-loom-education",
  },
  {
    id: "menippus-ruin-hanging",
    philosopher: "Menippus",
    topic: "death",
    gloss:
      "The money-lending Cynic falls victim to a plot, loses everything, and in despair hangs himself.",
    grc:
      "τέλος δʼ ἐπιβουλευθέντα πάντων στερηθῆναι καὶ ὑπʼ ἀθυμίας βρόχῳ τὸν βίον μεταλλάξαι.",
    en: "At last, however, he fell a victim to a plot, was robbed of all, and in despair ended his days by hanging himself.",
    ref: "6.100",
    certainty: "reported",
    accordingTo: "Hermippus",
    note: "The money-lending report is Hermippus' (6.99): he lent by the day, made loans on bottomry and took security, accumulating a large fortune. D.L.'s own epigram mocks him for 'not understanding what it is to be a Cynic'.",
  },
  {
    id: "menedemus-cynic-fury-garb",
    philosopher: "Menedemus the Cynic",
    topic: "eccentricity",
    gloss:
      "Menedemus goes about dressed as a Fury - zodiac hat, crimson girdle, tragic buskins - claiming he has come up from Hades to take note of sins and report back below.",
    grc:
      "οὗτος, καθά φησιν Ἱππόβοτος, εἰς τοσοῦτον τερατείας ἤλασεν ὥστε Ἐρινύος ἀναλαβὼν σχῆμα περιῄει, λέγων ἐπίσκοπος ἀφῖχθαι ἐξ ᾅδου τῶν ἁμαρτανομένων, ὅπως πάλιν κατιὼν ταῦτα ἀπαγγέλλοι τοῖς ἐκεῖ δαίμοσιν. ἦν δὲ αὐτῷ ἡ ἐσθὴς αὕτη· χιτὼν φαιὸς ποδήρης, περὶ αὐτῷ ζώνη φοινικῆ, πῖλος Ἀρκαδικὸς ἐπὶ τῆς κεφαλῆς ἔχων ἐνυφασμένα τὰ δώδεκα στοιχεῖα, ἐμβάται τραγικοί, πώγων ὑπερμεγέθης, ῥάβδος ἐν τῇ χειρὶ μειλίνη.",
    en: "According to Hippobotus he had attained such a degree of audacity in wonder-working that he went about in the guise of a Fury, saying that he had come from Hades to take cognisance of sins committed, and was going to return and report them to the powers down below. This was his attire: a grey tunic reaching to the feet, about it a crimson girdle; an Arcadian hat on his head with the twelve signs of the zodiac inwrought in it; buskins of tragedy; and he wore a very long beard and carried an ashen staff in his hand.",
    ref: "6.102",
    certainty: "reported",
    accordingTo: "Hippobotus",
  },
];
