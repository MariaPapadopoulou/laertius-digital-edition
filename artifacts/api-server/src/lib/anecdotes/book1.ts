/**
 * Book 1 anecdotes - the Seven Sages and the other wise men: Thales, Solon,
 * Chilon, Pittacus, Bias, Cleobulus, Periander, Anacharsis, Myson,
 * Epimenides, and Pherecydes. Narrated incidents only; bare dicta live in
 * the sayings layer (see the overlap policy in anecdotes.ts). Every `en` is
 * a verbatim Hicks excerpt of the cited section, enforced by
 * validate-anecdotes.
 *
 * Curation notes: the marriage exchange with Thales' mother (1.26), Solon
 * before Croesus on happiness (1.50), Solon on Pisistratus' self-inflicted
 * wounds (1.60), and Myson laughing alone (1.108) are not re-curated: their
 * whole substance is already the curated sayings thales-too-soon-too-late,
 * solon-croesus-happy, solon-acting-tragedies, and myson-laughing-alone,
 * whose excerpts carry the full narrative. Hieronymus of Rhodes (olive
 * presses and pyramid measurement, 1.26-27), Phanodicus (the ransomed
 * Messenian maidens, 1.82), and Ephorus (Periander's golden-statue vow,
 * 1.96) are cited only here and are not otherwise claim/saying sources, so
 * they stay in notes rather than accordingTo (no source node is minted for
 * one or two citations). "Demetrius" for the Nymphs' food (1.114) is the
 * bare homonym (of Magnesia, named in full at 1.112) and likewise stays in
 * a note.
 */
import type { Anecdote } from "../anecdotes";

export const BOOK1_ANECDOTES: Anecdote[] = [
  // --- Thales ---
  {
    id: "thales-croesus-alliance",
    philosopher: "Thales",
    topic: "encounter",
    gloss:
      "Thales frustrates Croesus' offer of alliance to Miletus - counsel that saves the city when Cyrus wins.",
    grc: "Δοκεῖ δὲ καὶ ἐν τοῖς πολιτικοῖς ἄριστα βεβουλεῦσθαι. Κροίσου γοῦν πέμψαντος πρὸς Μιλησίους ἐπὶ συμμαχίᾳ ἐκώλυσεν· ὅπερ Κύρου κρατήσαντος ἔσωσε τὴν πόλιν.",
    en: "Thales is also credited with having given excellent advice on political matters. For instance, when Croesus sent to Miletus offering terms of alliance, he frustrated the plan; and this proved the salvation of the city when Cyrus obtained the victory.",
    ref: "1.25",
    involves: "Croesus",
    certainty: "reported",
  },
  {
    id: "thales-olive-presses",
    philosopher: "Thales",
    topic: "wit",
    gloss:
      "To show how easy it is to grow rich, Thales foresees a good olive season, rents all the oil-mills, and amasses a fortune.",
    grc: "φησὶ δὲ καὶ Ἱερώνυμος ὁ Ῥόδιος ἐν τῷ δευτέρῳ Τῶν σποράδην ὑπομνημάτων, ὅτι βουλόμενος δεῖξαι ῥᾴδιον εἶναι πλουτεῖν, φορᾶς μελλούσης ἐλαιῶν ἔσεσθαι, προνοήσας ἐμισθώσατο τὰ ἐλαιουργεῖα καὶ πάμπλειστα συνεῖλε χρήματα.",
    en: "Hieronymus of Rhodes in the second book of his Scattered Notes relates that, in order to show how easy it is to grow rich, Thales, foreseeing that it would be a good season for olives, rented all the oil-mills and thus amassed a fortune.",
    ref: "1.26",
    certainty: "reported",
    note: "Named authority: Hieronymus of Rhodes (Scattered Notes, book 2), cited only in this layer and so not minted as a source node.",
  },
  {
    id: "thales-pyramid-shadow",
    philosopher: "Thales",
    topic: "wit",
    gloss:
      "He measures the height of the pyramids by their shadow, taking the observation at the hour when our own shadow equals our height.",
    grc: "ὁ δὲ Ἱερώνυμος καὶ ἐκμετρῆσαί φησιν αὐτὸν τὰς πυραμίδας ἐκ τῆς σκιᾶς, παρατηρήσαντα ὅτε ἡμῖν ἰσομεγέθης ἐστίν.",
    en: "Hieronymus informs us that he measured the height of the pyramids by the shadow they cast, taking the observation at the hour when our shadow is of the same length as ourselves.",
    ref: "1.27",
    certainty: "reported",
    note: "Named authority: Hieronymus of Rhodes (see 1.26), cited only in this layer and so not minted as a source node.",
  },
  {
    id: "thales-tripod-of-the-wise",
    philosopher: "Thales",
    topic: "legacy",
    gloss:
      "The tripod found by fishermen is awarded by Delphi to the wisest: it goes to Thales, passes round the sages to Solon, who sends it to the god himself.",
    grc: "φασὶ γὰρ Ἰωνικούς τινας νεανίσκους βόλον ἀγοράσαι παρὰ Μιλησίων ἁλιέων. ἀνασπασθέντος δὲ τοῦ τρίποδος ἀμφισβήτησις ἦν, ἕως οἱ Μιλήσιοι ἔπεμψαν εἰς Δελφούς· καὶ ὁ θεὸς ἔχρησεν οὕτως· ἔκγονε Μιλήτου, τρίποδος πέρι Φοῖβον ἐρωτᾷς; τίς σοφίῃ πάντων πρῶτος, τούτου τρίποδʼ αὐδῶ. διδοῦσιν οὖν Θαλῇ· ὁ δὲ ἄλλῳ καὶ ἄλλος ἄλλῳ ἕως Σόλωνος. ὁ δὲ ἔφη σοφίᾳ πρῶτον εἶναι τὸν θεὸν καὶ ἀπέστειλεν εἰς Δελφούς.",
    en: "Certain Ionian youths having purchased of the Milesian fishermen their catch of fish, a dispute arose over the tripod which had formed part of the catch. Finally the Milesians referred the question to Delphi, and the god gave an oracle in this form : Who shall possess the tripod? Thus replies Apollo: Whosoever is most wise. Accordingly they give it to Thales, and he to another, and so on till it comes to Solon, who, with the remark that the god was the most wise, sent it off to Delphi.",
    ref: "1.28",
    involves: "Solon",
    certainty: "disputed",
    note: "D.L. reports many rival versions: Callimachus (from Maeandrius) makes it Bathycles' bowl; Eudoxus and Euanthes a golden goblet from Croesus; others a vessel sent by Periander, a tripod of Hephaestus passed down from Pelops, or an Argive prize of virtue (1.28-33).",
  },
  {
    id: "thales-stargazer-ditch",
    philosopher: "Thales",
    topic: "eccentricity",
    gloss:
      "Led outdoors to observe the stars, Thales falls into a ditch - and the old woman asks how he can know the heavens when he cannot see what is at his feet.",
    grc: "λέγεται δʼ ἀγόμενος ὑπὸ γραὸς ἐκ τῆς οἰκίας, ἵνα τὰ ἄστρα κατανοήσῃ, εἰς βόθρον ἐμπεσεῖν καὶ αὐτῷ ἀνοιμώξαντι φάναι τὴν γραῦν· σὺ γάρ, ὦ Θαλῆ, τὰ ἐν ποσὶν οὐ δυνάμενος ἰδεῖν τὰ ἐπὶ τοῦ οὐρανοῦ οἴει γνώσεσθαι;",
    en: "It is said that once, when he was taken out of doors by an old woman in order that he might observe the stars, he fell into a ditch, and his cry for help drew from the old woman the retort, How can you expect to know all about the heavens, Thales, when you cannot even see what is just before your feet?",
    ref: "1.34",
    certainty: "reported",
  },
  {
    id: "thales-halys-diverted",
    philosopher: "Thales",
    topic: "encounter",
    gloss:
      "He undertakes to take Croesus across the Halys without a bridge, by diverting the river.",
    grc: "γεγονότα κατὰ Κροῖσον, ᾧ καὶ τὸν Ἅλυν ὑποσχέσθαι ἄνευ γεφύρας περᾶσαι, τὸ ῥεῖθρον παρατρέψαντα.",
    en: "being contemporary with Croesus, whom he undertook to take across the Halys without building a bridge, by diverting the river",
    ref: "1.38",
    involves: "Croesus",
    certainty: "asserted",
  },
  {
    id: "thales-dies-at-games",
    philosopher: "Thales",
    topic: "death",
    gloss:
      "Thales dies watching an athletic contest, from heat, thirst, and the weakness of old age.",
    grc: "Ὁ δʼ οὖν σοφὸς ἐτελεύτησεν ἀγῶνα θεώμενος γυμνικὸν ὑπό τε καύματος καὶ δίψους καὶ ἀσθενείας, ἤδη γηραιός.",
    en: "Thales the Sage died as he was watching an athletic contest from heat, thirst, and the weakness incident to advanced age.",
    ref: "1.39",
    certainty: "asserted",
  },
  // --- Solon ---
  {
    id: "solon-feigns-madness",
    philosopher: "Solon",
    topic: "defiance",
    gloss:
      "Under a decree of death for proposing to renew the Salaminian war, Solon feigns madness, rushes into the Agora garlanded, and has his Salamis poem rouse Athens to victory.",
    grc: "Τὸ δὲ μέγιστον, τῆς πατρίδος αὐτοῦ [Σαλαμῖνος] ἀμφισβητουμένης ὑπό τε Ἀθηναίων καὶ Μεγαρέων καὶ πολλάκις τῶν Ἀθηναίων ἐπταικότων ἐν τοῖς πολέμοις καὶ ψηφισαμένων εἴ τις ἔτι συμβουλεύσοι περὶ Σαλαμῖνος μάχεσθαι, θανάτῳ ζημιοῦσθαι, οὗτος μαίνεσθαι προσποιησάμενος καὶ στεφανωσάμενος εἰσέπαισεν εἰς τὴν ἀγοράν· ἔνθα τοῖς Ἀθηναίοις ἀνέγνω διὰ κήρυκος τὰ συντείνοντα περὶ Σαλαμῖνος ἐλεγεῖα καὶ παρώρμησεν αὐτούς. καὶ αὖθις πρὸς τοὺς Μεγαρέας ἐπολέμησαν καὶ ἐνίκων διὰ Σόλωνα.",
    en: "Megara and Athens laid rival claims to his birthplace Salamis, and after many defeats the Athenians passed a decree punishing with death any man who should propose a renewal of the Salaminian war. Solon, feigning madness, rushed into the Agora with a garland on his head; there he had his poem on Salamis read to the Athenians by the herald and roused them to fury. They renewed the war with the Megarians and, thanks to Solon, were victorious.",
    ref: "1.46",
    certainty: "asserted",
  },
  {
    id: "solon-graves-of-salamis",
    philosopher: "Solon",
    topic: "wit",
    gloss:
      "To prove Athens' right to Salamis, Solon opens graves and shows the dead buried facing east, named by demes - Athenian fashion.",
    grc: "ἀνασκάψας τινὰς τάφους ἔδειξε τοὺς νεκροὺς πρὸς ἀνατολὰς ἐστραμμένους, ὡς ἦν ἔθος θάπτειν Ἀθηναίοις· ἀλλὰ καὶ αὐτοὺς τοὺς τάφους πρὸς ἕω βλέποντας καὶ ἀπὸ τῶν δήμων τοὺς χρηματισμοὺς ἐγκεχαραγμένους, ὅπερ ἦν ἴδιον Ἀθηναίων.",
    en: "he opened certain graves and showed that the dead were buried with their faces to the east, as was the custom of burial among the Athenians; further, that the tombs themselves faced the east, and that the inscriptions graven upon them named the deceased by their demes, which is a style peculiar to Athens",
    ref: "1.48",
    certainty: "asserted",
  },
  {
    id: "solon-spear-and-shield",
    philosopher: "Solon",
    topic: "defiance",
    gloss:
      "Solon rushes armed into the Assembly to warn Athens of Pisistratus' plot - and Pisistratus' partisans vote him mad.",
    grc: "ᾅξας γὰρ εἰς τὴν ἐκκλησίαν μετὰ δόρατος καὶ ἀσπίδος προεῖπεν αὐτοῖς τὴν ἐπίθεσιν τοῦ Πεισιστράτου· καὶ οὐ μόνον, ἀλλὰ καὶ βοηθεῖν ἕτοιμος εἶναι, λέγων ταῦτα· ἄνδρες Ἀθηναῖοι, τῶν μὲν σοφώτερος, τῶν δὲ ἀνδρειότερός εἰμι· σοφώτερος μὲν τῶν τὴν ἀπάτην τοῦ Πεισιστράτου μὴ συνιέντων, ἀνδρειότερος δὲ τῶν ἐπισταμένων μέν, διὰ δέος δὲ σιωπώντων. καὶ ἡ βουλή, Πεισιστρατίδαι ὄντες, μαίνεσθαι ἔλεγον αὐτόν· ὅθεν εἶπε ταυτί· δείξει δὴ μανίην μὲν ἐμὴν βαιὸς χρόνος ἀστοῖς, δείξει, ἀληθείης ἐς μέσον ἐρχομένης.",
    en: "He rushed into the Assembly armed with spear and shield, warned them of the designs of Pisistratus, and not only so, but declared his willingness to render assistance, in these words: Men of Athens, I am wiser than some of you and more courageous than others: wiser than those who fail to understand the plot of Pisistratus, more courageous than those who, though they see through it, keep silence through fear. And the members of the council, who were of Pisistratus’ party, declared that he was mad: which made him say the lines : A little while, and the event will show To all the world if I be mad or no.",
    ref: "1.49",
    involves: "Pisistratus",
    certainty: "reported",
    accordingTo: "Sosicrates",
    note: "Sosicrates is D.L.'s named authority for Solon's early perception of his kinsman Pisistratus' designs.",
  },
  {
    id: "solon-arms-at-headquarters",
    philosopher: "Solon",
    topic: "defiance",
    gloss:
      "With the tyranny established and the people unmoved, Solon piles his arms before the generals' quarters - 'My country, I have served thee with my word and sword!' - and sails into exile.",
    grc: "Ἤδη δὲ αὐτοῦ κρατοῦντος οὐ πείθων ἔθηκε τὰ ὅπλα πρὸ τοῦ στρατηγείου καὶ εἰπών, ὦ πατρίς, βεβοήθηκά σοι καὶ λόγῳ καὶ ἔργῳ, ἀπέπλευσεν εἰς Αἴγυπτον καὶ εἰς Κύπρον, καὶ πρὸς Κροῖσον ἦλθεν.",
    en: "When Pisistratus was already established, Solon, unable to move the people, piled his arms in front of the generals’ quarters, and exclaimed, My country, I have served thee with my word and sword! Thereupon he sailed to Egypt and to Cyprus, and thence proceeded to the court of Croesus.",
    ref: "1.50",
    involves: "Pisistratus",
    certainty: "asserted",
  },
  {
    id: "solon-cocks-and-peacocks",
    philosopher: "Solon",
    topic: "wit",
    gloss:
      "Croesus, enthroned in magnificent array, asks if Solon has ever seen anything more beautiful - and is told yes: cocks, pheasants, and peacocks, whose splendour is nature's own.",
    grc: "Φασὶ δέ τινες ὅτι κοσμήσας ἑαυτὸν ὁ Κροῖσος παντοδαπῶς καὶ καθίσας εἰς τὸν θρόνον ἤρετο αὐτὸν εἴ τι θέαμα κάλλιον τεθέαται· ὁ δέ ἀλεκτρυόνας, εἶπε, καὶ φασιανοὺς καὶ ταώς· φυσικῷ γὰρ ἄνθει κεκόσμηνται καὶ μυρίῳ καλλίονι.",
    en: "There is a story that Croesus in magnificent array sat himself down on his throne and asked Solon if he had ever seen anything more beautiful. Yes, was the reply, cocks and pheasants and peacocks; for they shine in nature’s colours, which are ten thousand times more beautiful.",
    ref: "1.51",
    involves: "Croesus",
    certainty: "reported",
    framesSaying: "solon-cocks-peacocks",
  },
  {
    id: "solon-ashes-over-salamis",
    philosopher: "Solon",
    topic: "death",
    gloss:
      "Dying in Cyprus at eighty, Solon enjoins his relations to carry his bones to Salamis and scatter the ashes over the soil.",
    grc: "ἐτελεύτησε δʼ ἐν Κύπρῳ βιοὺς ἔτη ὀγδοήκοντα, τοῦτον ἐπισκήψας τοῖς ἰδίοις τὸν τρόπον, ἀποκομίσαι αὐτοῦ τὰ ὀστᾶ εἰς Σαλαμῖνα καὶ τεφρώσαντας εἰς τὴν χώραν σπεῖραι.",
    en: "He died in Cyprus at the age of eighty. His last injunctions to his relations were on this wise: that they should convey his bones to Salamis and, when they had been reduced to ashes, scatter them over the soil.",
    ref: "1.62",
    certainty: "asserted",
  },
  {
    id: "solon-weeps-for-son",
    philosopher: "Solon",
    topic: "encounter",
    gloss:
      "Weeping for his dead son and told that weeping is of no avail, Solon answers: that is exactly why I weep.",
    grc: "καὶ αὐτόν φησι Διοσκουρίδης ἐν τοῖς Ἀπομνημονεύμασιν, ἐπειδὴ δακρύοι τὸν παῖδα τελευτήσαντα, ὃν ἡμεῖς οὐ παρειλήφαμεν, πρὸς τὸν εἰπόντα, ἀλλʼ οὐδὲν ἀνύτεις, εἰπεῖν, διʼ αὐτὸ δὲ τοῦτο δακρύω, ὅτι οὐδὲν ἀνύτω.",
    en: "According to Dioscurides in his Memorabilia, when he was weeping for the loss of his son, of whom nothing more is known, and some one said to him, It is all of no avail, he replied, That is why I weep, because it is of no avail.",
    ref: "1.63",
    certainty: "reported",
    accordingTo: "Dioscurides",
    framesSaying: "solon-weep-no-avail",
  },
  // --- Chilon ---
  {
    id: "chilon-brother-ephor",
    philosopher: "Chilon",
    topic: "wit",
    gloss:
      "When his brother grumbles at not being made ephor, Chilon replies that he himself knows how to submit to injustice.",
    grc: "πρός τε τὸν ἀδελφὸν δυσφοροῦντα ὅτι μὴ ἔφορος ἐγένετο, αὐτοῦ ὄντος, ἐγὼ μὲν γὰρ ἐπίσταμαι, εἶπεν, ἀδικεῖσθαι, σὺ δὲ οὔ.",
    en: "When his brother grumbled that he was not made ephor as Chilon was, the latter replied, I know how to submit to injustice and you do not.",
    ref: "1.68",
    certainty: "asserted",
    framesSaying: "chilon-submit-injustice",
  },
  {
    id: "chilon-hippocrates-cauldrons",
    philosopher: "Chilon",
    topic: "encounter",
    gloss:
      "When Hippocrates' cauldrons boil of their own accord at Olympia, Chilon advises him not to marry - or to divorce his wife and disown his children.",
    grc: "Οὗτος, ὥς φησιν Ἡρόδοτος ἐν τῇ πρώτῃ, Ἱπποκράτει θυομένῳ ἐν Ὀλυμπίᾳ, τῶν λεβήτων αὐτομάτων ζεσάντων, συνεβούλευσεν ἢ μὴ γῆμαι, ἤ, εἰ ἔχοι γυναῖκα, ἐκπέμψαι καὶ παῖδας ἀπείπασθαι.",
    en: "As Herodotus relates in his first Book, when Hippocrates was sacrificing at Olympia and his cauldrons boiled of their own accord, it was Chilon who advised him not to marry, or, if he had a wife, to divorce her and disown his children.",
    ref: "1.68",
    certainty: "reported",
    accordingTo: "Herodotus",
    note: "Hippocrates is the father of Pisistratus, whose tyranny the omen foreshadows.",
  },
  {
    id: "chilon-aesop-zeus",
    philosopher: "Chilon",
    topic: "encounter",
    gloss:
      "Chilon asks Aesop what Zeus is doing, and receives the answer: humbling the proud and exalting the humble.",
    grc: "φασὶ δʼ αὐτὸν καὶ Αἰσώπου πυθέσθαι, ὁ Ζεὺς τί εἴη ποιῶν· τὸν δὲ φάναι, τὰ μὲν ὑψηλὰ ταπεινῶν, τὰ δὲ ταπεινὰ ὑψῶν.",
    en: "The tale is also told that he inquired of Aesop what Zeus was doing and received the answer: He is humbling the proud and exalting the humble.",
    ref: "1.69",
    involves: "Aesop",
    certainty: "reported",
  },
  {
    id: "chilon-friend-on-trial",
    philosopher: "Chilon",
    topic: "wit",
    gloss:
      "The one blot on his lawful life: judging a friend's case, he votes to condemn by law but persuades his colleague to acquit - keeping both the law and the friend.",
    grc: "κρίνων γάρ ποτε φίλῳ δίκην αὐτὸς μὲν κατὰ τὸν νόμον, τὸν δὲ φίλον πείσειεν ἀποδικάσαι αὐτοῦ, ἵνα ἀμφότερα καὶ τὸν νόμον καὶ τὸν φίλον τηρήσαι.",
    en: "In a suit in which a friend of his was concerned he himself pronounced sentence according to the law, but he persuaded his colleague who was his friend to acquit the accused, in order at once to maintain the law and yet not to lose his friend.",
    ref: "1.71",
    certainty: "reported",
  },
  {
    id: "chilon-cythera-warning",
    philosopher: "Chilon",
    topic: "legacy",
    gloss:
      "His famous warning about Cythera - would it had never existed or had sunk in the sea - is vindicated when Demaratus urges Xerxes to anchor there and later Nicias garrisons it against Sparta.",
    grc: "Ἐνδοξότατος δὲ μάλιστα παρὰ τοῖς Ἕλλησιν ἐγένετο προειπὼν περὶ Κυθήρων τῆς νήσου τῆς Λακωνικῆς. καταμαθὼν γὰρ τὴν φύσιν αὐτῆς, εἴθε, ἔφη, μὴ ἐγεγόνει, ἢ γενομένη κατεβυθίσθη.",
    en: "He became very famous in Greece by his warning about the island of Cythera off the Laconian coast. For, becoming acquainted with the nature of the island, he exclaimed: Would it had never been placed there, or else had been sunk in the depths of the sea.",
    ref: "1.71",
    certainty: "asserted",
    framesSaying: "chilon-cythera",
  },
  {
    id: "chilon-dies-of-joy",
    philosopher: "Chilon",
    topic: "death",
    gloss:
      "Chilon dies at Pisa of excess of joy, just after congratulating his son on an Olympic boxing victory.",
    grc: "ἐτελεύτησε δʼ, ὥς φησιν Ἕρμιππος, ἐν Πίσῃ, τὸν υἱὸν Ὀλυμπιονίκην ἀσπασάμενος πυγμῆς. ἔπαθε δὲ τοῦτο ὑπερβολῇ τε χαρᾶς καὶ ἀσθενείᾳ πολυετίας. καὶ αὐτὸν πάντες οἱ κατὰ τὴν πανήγυριν ἐντιμότατα παρέπεμψαν.",
    en: "According to Hermippus, his death took place at Pisa, just after he had congratulated his son on an Olympic victory in boxing. It was due to excess of joy coupled with the weakness of a man stricken in years. And all present joined in the funeral procession.",
    ref: "1.72",
    certainty: "reported",
    accordingTo: "Hermippus",
  },
  // --- Pittacus ---
  {
    id: "pittacus-phrynon-net",
    philosopher: "Pittacus",
    topic: "defiance",
    gloss:
      "Commanding Mitylene against Athens, Pittacus meets the Olympic champion Phrynon in single combat and entangles him with a net hidden under his shield.",
    grc: "καὶ περὶ τῆς Ἀχιλείτιδος χώρας μαχομένων Ἀθηναίων καὶ Μυτιληναίων ἐστρατήγει μὲν αὐτός, Ἀθηναίων δὲ Φρύνων παγκρατιαστὴς Ὀλυμπιονίκης. συνέθετο δὴ μονομαχῆσαι πρὸς αὐτόν· καὶ δίκτυον ἔχων ὑπὸ τὴν ἀσπίδα λαθραίως περιέβαλε τὸν Φρύνωνα, καὶ κτείνας ἀνεσώσατο τὸ χωρίον.",
    en: "in the war between Mitylene and Athens for the territory of Achileis he himself had the chief command on the one side, and Phrynon, who had won an Olympic victory in the pancratium, commanded the Athenians. Pittacus agreed to meet him in single combat; with a net which he concealed beneath his shield he entangled Phrynon, killed him, and recovered the territory.",
    ref: "1.74",
    certainty: "asserted",
  },
  {
    id: "pittacus-half-more-than-whole",
    philosopher: "Pittacus",
    topic: "asceticism",
    gloss:
      "After ten years' rule he lays down his office; granted land by Mitylene, he keeps only a small portion, pronouncing the half more than the whole.",
    grc: "ὁ δὲ δέκα ἔτη κατασχὼν καὶ εἰς τάξιν ἀγαγὼν τὸ πολίτευμα, κατέθετο τὴν ἀρχήν, καὶ δέκα ἐπεβίω ἄλλα. καὶ χώραν αὐτῷ ἀπένειμαν οἱ Μυτιληναῖοι· ὁ δὲ ἱερὰν ἀνῆκεν, ἥτις νῦν Πιττάκειος καλεῖται. Σωσικράτης δέ φησιν ὅτι ὀλίγον ἀποτεμόμενος ἔφη τὸ ἥμισυ τοῦ παντὸς πλεῖον εἶναι.",
    en: "He ruled for ten years and brought the constitution into order, and then laid down his office. He lived another ten years after his abdication and received from the people of Mitylene a grant of land, which he dedicated as sacred domain; and it bears his name to this day Sosicrates relates that he cut off a small portion for himself and pronounced the half to be more than the whole.",
    ref: "1.75",
    certainty: "asserted",
    accordingTo: "Sosicrates",
    framesSaying: "pittacus-half-more-whole",
    note: "Sosicrates is named for the half-more-than-whole remark; the abdication itself D.L. asserts in his own voice.",
  },
  {
    id: "pittacus-declines-croesus",
    philosopher: "Pittacus",
    topic: "asceticism",
    gloss:
      "He declines Croesus' offer of money: he already has twice as much as he wants, having inherited his brother's estate.",
    grc: "ἀλλὰ καὶ Κροίσου διδόντος χρήματα οὐκ ἐδέξατο, εἰπὼν ἔχειν ὧν ἐβούλετο διπλάσια· ἄπαιδος γὰρ τἀδελφοῦ τελευτήσαντος κεκληρονομηκέναι.",
    en: "Furthermore, he declined an offer of money made him by Croesus, saying that he had twice as much as he wanted; for his brother had died without issue and he had inherited his estate.",
    ref: "1.75",
    involves: "Croesus",
    certainty: "asserted",
    framesSaying: "pittacus-twice-as-much",
  },
  {
    id: "pittacus-pardons-the-smith",
    philosopher: "Pittacus",
    topic: "encounter",
    gloss:
      "When Cyme sends him the smith who killed his son with an axe, Pittacus sets the man free: better to pardon now than repent later - though Heraclitus says the man released was Alcaeus.",
    grc: "Παμφίλη δέ φησιν ἐν τῷ δευτέρῳ τῶν Ὑπομνημάτων, ὡς τὸν υἱὸν αὐτοῦ Τυρραῖον καθήμενον ἐπὶ κουρείου ἐν Κύμῃ χαλκεύς τις πέλεκυν ἐμβαλὼν ἀνέλοι. τῶν δὲ Κυμαίων πεμψάντων τὸν φονέα τῷ Πιττακῷ, μαθόντα καὶ ἀπολύσαντα εἰπεῖν, συγγνώμη μετανοίας κρείσσων. Ἡράκλειτος δέ φησιν, Ἀλκαῖον ὑποχείριον λαβόντα καὶ ἀπολύσαντα φάναι, συγγνώμη τιμωρίας κρείσσων.",
    en: "Pamphila in the second book of her Memorabilia narrates that, as his son Tyrraeus sat in a barber’s shop in Cyme, a smith killed him with a blow from an axe. When the people of Cyme sent the murderer to Pittacus, he, on learning the story, set him at liberty and declared that It is better to pardon now than to repent later. Heraclitus, however, says that it was Alcaeus whom he set at liberty when he had got him in his power, and that what he said was: Mercy is better than vengeance.",
    ref: "1.76",
    certainty: "disputed",
    accordingTo: "Pamphila",
    framesSaying: "pittacus-mercy-vengeance",
    note: "Both named accounts are quoted in the excerpt; Heraclitus' rival version makes the released man the poet Alcaeus.",
  },
  {
    id: "pittacus-spinning-tops",
    philosopher: "Pittacus",
    topic: "teaching",
    gloss:
      "Asked by a young man which of two brides to wed, Pittacus points his staff at boys whipping their tops: 'Keep to your own sphere' - and the stranger takes the humbler match.",
    grc: "εἶπεν· ὁ δὲ σκίπωνα, γεροντικὸν ὅπλον, ἀείρας, ἤνιδε, κεῖνοί σοι πᾶν ἐρέουσιν ἔπος. οἱ δʼ ἄρʼ ὑπὸ πληγῇσι θοὰς βέμβικας ἔχοντες ἔστρεφον εὐρείῃ παῖδες ἐνὶ τριόδῳ. κείνων ἔρχεο, φησί, μετʼ ἴχνια. χὠ μὲν ἐπέστη πλησίον· οἱ δʼ ἔλεγον· τὴν κατὰ σαυτὸν ἔλα. ταῦτʼ ἀΐων ὁ ξεῖνος ἐφείσατο μείζονος οἴκου δράξασθαι, παίδων κληδόνα συνθέμενος.",
    en: "But Pittacus, raising his staff, an old man’s weapon, said, See there, yonder boys will tell you the whole tale. The boys were whipping their tops to make them go fast and spinning them in a wide open space. Follow in their track, said he. So he approached near, and the boys were saying, Keep to your own sphere. When he heard this, the stranger desisted from aiming at the lordlier match, assenting to the warning of the boys.",
    ref: "1.80",
    certainty: "reported",
    note: "The story is introduced at 1.79 ('the story goes that a young man took counsel with him about marriage') and given in the words of Callimachus' Epigrams.",
  },
  // --- Bias ---
  {
    id: "bias-ransoms-maidens",
    philosopher: "Bias",
    topic: "piety",
    gloss:
      "Bias ransoms Messenian maidens captured in war, brings them up as his daughters, gives them dowries, and restores them to their fathers.",
    grc: "Φανόδικος δὲ κόρας αἰχμαλώτους λυτρωσάμενον Μεσσηνίας θρέψαι τε ὡς θυγατέρας καὶ προῖκας ἐπιδοῦναι καὶ εἰς τὴν Μεσσήνην ἀποστεῖλαι τοῖς πατράσιν αὐτῶν.",
    en: "Phanodicus relates that he ransomed certain Messenian maidens captured in war and brought them up as his daughters, gave them dowries, and restored them to their fathers in Messenia.",
    ref: "1.82",
    certainty: "reported",
    note: "Named authority: Phanodicus, cited only in this layer and so not minted as a source node.",
  },
  {
    id: "bias-refuses-tripod",
    philosopher: "Bias",
    topic: "piety",
    gloss:
      "When the maidens' testimony wins him the tripod inscribed 'To him that is wise', Bias declares that Apollo is wise and refuses it.",
    grc: "Σάτυρος μέν φησι παρελθεῖν τὰς κόρασ—οἱ δὲ τὸν πατέρα αὐτῶν, ὡς καὶ Φανόδικοσ—εἰς τὴν ἐκκλησίαν, καὶ εἰπεῖν τὸν Βίαντα σοφόν, διηγησαμένας τὰ καθʼ ἑαυτάς. καὶ ἀπεστάλη ὁ τρίπους· καὶ ὁ Βίας ἰδὼν ἔφη τὸν Ἀπόλλωνα σοφὸν εἶναι, οὐδὲ προσήκατο.",
    en: "the maidens according to Satyrus, or their father according to other accounts, including that of Phanodicus, came forward into the assembly and, after the recital of their own adventures, pronounced Bias to be wise. And thereupon the tripod was dispatched to him; but Bias, on seeing it, declared that Apollo was wise, and refused to take the tripod.",
    ref: "1.82",
    certainty: "disputed",
    note: "Satyrus and Phanodicus give rival accounts of who testified; others say he dedicated the tripod to Heracles in Thebes (1.83).",
  },
  {
    id: "bias-fattened-mules",
    philosopher: "Bias",
    topic: "wit",
    gloss:
      "Besieged by Alyattes, Bias fattens two mules and drives them into the camp, then shows heaps of sand topped with corn - and wins a peace treaty by the ruse.",
    grc: "Λέγεται δὲ καὶ Ἀλυάττου πολιορκοῦντος Πριήνην τὸν Βίαντα πιήναντα δύο ἡμιόνους ἐξελάσαι εἰς τὸ στρατόπεδον· τὸν δὲ συνιδόντα καταπλαγῆναι τὸ μέχρι καὶ ἀλόγων διατείνειν αὐτῶν τὴν εὐθενίαν. καὶ ἐβουλήθη σπείσασθαι, καὶ εἰσέπεμψεν ἄγγελον. Βίας δὲ σωροὺς ψάμμου χέας καὶ ἄνωθεν σῖτον περιχέας ἔδειξε τῷ ἀνθρώπῳ· καὶ τέλος μαθὼν ὁ Ἀλυάττης εἰρήνην ἐσπείσατο πρὸς τοὺς Πριηνέας. θᾶττον δʼ αὐτῷ πέμψαντι πρὸς τὸν Βίαντα ἵνα ἥκοι παρʼ αὐτόν, ἐγὼ δέ, φησίν, Ἀλυάττῃ κελεύω κρόμμυα ἐσθίειν, [ἴσον τῷ κλαίειν].",
    en: "A story is told that, while Alyattes was besieging Priene, Bias fattened two mules and drove them into the camp, and that the king, when he saw them, was amazed at the good condition of the citizens actually extending to their beasts of burden. And he decided to make terms and sent a messenger. But Bias piled up heaps of sand with a layer of corn on the top, and showed them to the man, and finally, on being informed of this, Alyattes made a treaty of peace with the people of Priene. Soon afterwards, when Alyattes sent to invite Bias to his court, he replied, Tell Alyattes, from me, to make his diet of onions, that is, to weep.",
    ref: "1.83",
    certainty: "reported",
    framesSaying: "bias-alyattes-onions",
  },
  {
    id: "bias-dies-in-court",
    philosopher: "Bias",
    topic: "death",
    gloss:
      "Pleading a case in extreme old age, Bias rests his head on his grandson's bosom when he finishes - and is found dead there when the verdict goes to his client.",
    grc: "δίκην γὰρ ὑπέρ τινος λέξας ἤδη ὑπέργηρως ὑπάρχων, μετὰ τὸ καταπαῦσαι τὸν λόγον ἀπέκλινε τὴν κεφαλὴν εἰς τοὺς τοῦ τῆς θυγατρὸς υἱοῦ κόλπους· εἰπόντος δὲ καὶ τοῦ ἐξ ἐναντίας καὶ τῶν δικαστῶν τὴν ψῆφον ἐνεγκόντων τῷ ὑπὸ τοῦ Βίαντος βοηθουμένῳ, λυθέντος τοῦ δικαστηρίου νεκρὸς ἐν τοῖς κόλποις εὑρέθη.",
    en: "He had been pleading in defence of some client in spite of his great age. When he had finished speaking, he reclined his head on his grandson’s bosom. The opposing counsel made a speech, the judges voted and gave their verdict in favour of the client of Bias, who, when the court rose, was found dead in his grandson’s arms.",
    ref: "1.84",
    certainty: "asserted",
  },
  {
    id: "bias-storm-at-sea",
    philosopher: "Bias",
    topic: "piety",
    gloss:
      "In a storm at sea, when his impious shipmates begin calling on the gods, Bias hushes them - lest the gods notice they are aboard.",
    grc: "συμπλέων ποτὲ ἀσεβέσι, χειμαζομένης τῆς νεὼς κἀκείνων τοὺς θεοὺς ἐπικαλουμένων, σιγᾶτε, ἔφη, μὴ αἴσθωνται ὑμᾶς ἐνθάδε πλέοντας.",
    en: "He was once on a voyage with some impious men; and, when a storm was encountered, even they began to call upon the gods for help. Peace! said he, lest they hear and become aware that you are here in the ship.",
    ref: "1.86",
    certainty: "asserted",
    framesSaying: "bias-ship-impious",
  },
  // --- Cleobulus ---
  {
    id: "cleobulus-rebuilds-temple",
    philosopher: "Cleobulus",
    topic: "piety",
    gloss:
      "Cleobulus is said to have rebuilt the temple of Athena at Lindus, founded by Danaus.",
    grc: "ἀλλὰ καὶ τὸ ἱερὸν τῆς Ἀθηνᾶς ἀνανεώσασθαι αὐτὸν κτισθὲν ὑπὸ Δαναοῦ.",
    en: "He is also said to have rebuilt the temple of Athena which was founded by Danaus.",
    ref: "1.89",
    certainty: "reported",
  },
  // --- Periander ---
  {
    id: "periander-kills-melissa",
    philosopher: "Periander",
    topic: "shamelessness",
    gloss:
      "In a fit of anger, egged on by his concubines' slanders, Periander kills his pregnant wife - then burns the concubines alive and banishes his grieving son to Corcyra.",
    grc: "χρόνῳ δὴ ὑπʼ ὀργῆς βαλὼν ὑποβάθρῳ ἢ λακτίσας τὴν γυναῖκα ἔγκυον οὖσαν ἀπέκτεινε, πεισθεὶς διαβολαῖς παλλακίδων, ἃς ὕστερον ἔκαυσε. Τόν τε παῖδα ἀπεκήρυξεν εἰς Κέρκυραν, λυπούμενον ἐπὶ τῇ μητρί, ᾧ ὄνομα Λυκόφρων.",
    en: "However, after some time, in a fit of anger, he killed his wife by throwing a footstool at her, or by a kick, when she was pregnant, having been egged on by the slanderous tales of concubines, whom he afterwards burnt alive. When the son whose name was Lycophron grieved for his mother, he banished him to Corcyra.",
    ref: "1.94",
    certainty: "asserted",
  },
  {
    id: "periander-corcyra-revenge",
    philosopher: "Periander",
    topic: "death",
    gloss:
      "When the Corcyraeans kill his son, Periander ships their sons to Alyattes to be made eunuchs; saved at Samos, the boys' escape breaks him and he dies at eighty.",
    grc: "ἐν γήρᾳ καθεστὼς μετεπέμπετο αὐτὸν ὅπως παραλάβοι τὴν τυραννίδα· ὃν φθάσαντες οἱ Κερκυραῖοι διεχρήσαντο. ὅθεν ὀργισθεὶς ἔπεμψε τοὺς παῖδας αὐτῶν πρὸς Ἀλυάττην ἐπʼ ἐκτομῇ· προσχούσης δὲ τῆς νεὼς Σάμῳ, ἱκετεύσαντες τὴν Ἥραν ὑπὸ τῶν Σαμίων διεσώθησαν. Καὶ ὃς ἀθυμήσας ἐτελεύτησεν, ἤδη γεγονὼς ἔτη ὀγδοήκοντα.",
    en: "And when well advanced in years he sent for his son to be his successor in the tyranny; but the Corcyraeans put him to death before he could set sail. Enraged at this, he dispatched the sons of the Corcyraeans to Alyattes that he might make eunuchs of them; but, when the ship touched at Samos, they took sanctuary in the temple of Hera, and were saved by the Samians. Periander lost heart and died at the age of eighty.",
    ref: "1.95",
    certainty: "asserted",
  },
  {
    id: "periander-golden-statue-vow",
    philosopher: "Periander",
    topic: "piety",
    gloss:
      "Having vowed a golden statue if he won the Olympic chariot-race, Periander pays the vow by stripping the women of Corinth of the ornaments they wore at a festival.",
    grc: "ἀλλὰ καὶ Ἔφορος ἱστορεῖ ὡς εὔξαιτο, εἰ νικήσειεν Ὀλύμπια τεθρίππῳ, χρυσοῦν ἀνδριάντα ἀναθεῖναι. νικήσας δὲ καὶ ἀπορῶν χρυσίου, κατά τινα ἑορτὴν ἐπιχώριον κεκοσμημένας ἰδὼν τὰς γυναῖκας πάντα ἀφείλετο τὸν κόσμον, καὶ ἔπεμψε τὸ ἀνάθημα.",
    en: "Ephorus records his now that, if he won the victory at Olympia in the chariot-race, he would set up a golden statue. When the victory was won, being in sore straits for gold, he despoiled the women of all the ornaments which he had seen them wearing at some local festival. He was thus enabled to send the votive offering.",
    ref: "1.96",
    certainty: "reported",
    note: "Named authority: Ephorus, cited only in this layer and so not minted as a source node. 'his now' is Hicks' text (for 'his vow'), reproduced verbatim.",
  },
  {
    id: "periander-secret-grave",
    philosopher: "Periander",
    topic: "death",
    gloss:
      "To keep his grave unknown, Periander orders two men to kill and bury whomever they meet, four to kill the two, more to kill the four - then goes to meet the first pair himself.",
    grc: "Λέγουσι δέ τινες ὡς θελήσας αὐτοῦ τὸν τάφον μὴ γνωσθῆναι, τοιοῦτόν τι ἐμηχανήσατο. δυσὶν ἐκέλευσε νεανίσκοις, δείξας τινὰ ὁδόν, ἐξελθεῖν νύκτωρ, καὶ τὸν ἀπαντήσαντα ἀνελεῖν καὶ θάψαι· ἔπειτα βαδίζειν ἄλλους τε κατὰ τούτων τέτταρας, καὶ ἀνελόντας θάψαι· πάλιν τε κατὰ τούτων πλείονας. καὶ οὕτως αὐτὸς τοῖς πρώτοις ἐντυχὼν ἀνῃρέθη.",
    en: "There is a story that he did not wish the place where he was buried to be known, and to that end contrived the following device. He ordered two young men to go out at night by a certain road which he pointed out to them; they were to kill the man they met and bury him. He afterwards ordered four more to go in pursuit of the two, kill them and bury them; again, he dispatched a larger number in pursuit of the four. Having taken these measures, he himself encountered the first pair and was slain.",
    ref: "1.96",
    certainty: "reported",
  },
  {
    id: "periander-crateia-scandal",
    philosopher: "Periander",
    topic: "shamelessness",
    gloss:
      "Aristippus' On the Luxury of the Ancients accuses Periander of incest with his mother Crateia - and of venting indiscriminate severity when the fact came to light.",
    grc: "Φησὶ δὲ Ἀρίστιππος ἐν πρώτῳ Περὶ παλαιᾶς τρυφῆς περὶ αὐτοῦ τάδε, ὡς ἄρα ἐρασθεῖσα ἡ μήτηρ αὐτοῦ Κράτεια συνῆν αὐτῷ λάθρα· καὶ ὃς ἥδετο. φανεροῦ δὲ γενομένου βαρὺς πᾶσιν ἐγένετο διὰ τὸ ἀλγεῖν ἐπὶ τῇ φωρᾷ.",
    en: "Aristippus in the first book of his work On the Luxury of the Ancients accuses him of incest with his own mother Crateia, and adds that, when the fact came to light, he vented his annoyance in indiscriminate severity.",
    ref: "1.96",
    certainty: "reported",
    note: "The authority is the philosopher Aristippus (On the Luxury of the Ancients), who is not otherwise a claim/saying source; he stays in this note rather than accordingTo (following the book-2 convention).",
  },
  // --- Anacharsis ---
  {
    id: "anacharsis-claims-guest-right",
    philosopher: "Anacharsis",
    topic: "wit",
    gloss:
      "Told that Solon chooses guests from his own countrymen, Anacharsis retorts that Solon is in his own country - and may therefore make him a guest; Solon, struck by his wit, takes him in.",
    grc: "καὶ ὁ θεράπων εἰσαγγείλας ἐκελεύσθη ὑπὸ τοῦ Σόλωνος εἰπεῖν αὐτῷ, ὅτιπερ ἐν ταῖς ἰδίαις πατρίσι ξένους ποιοῦνται. ἔνθεν ὁ Ἀνάχαρσις ἑλὼν ἔφη νῦν αὐτὸν ἐν τῇ πατρίδι εἶναι καὶ προσήκειν αὐτῷ ξένους ποιεῖθαι. ὁ δὲ καταπλαγεὶς τὴν ἑτοιμότητα εἰσέφρησεν αὐτὸν καὶ μέγιστον φίλον ἐποιήσατο.",
    en: "The servant delivered his message and was ordered by Solon to tell him that men as a rule choose their guests from among their own countrymen. Then Anacharsis took him up and said that he was now in his own country and had a right to be entertained as a guest. And Solon, struck with his ready wit, admitted him into his house and made him his greatest friend.",
    ref: "1.102",
    involves: "Solon",
    certainty: "reported",
    accordingTo: "Hermippus",
    note: "Hermippus is named at 1.101, where the arrival at Solon's house is introduced.",
  },
  {
    id: "anacharsis-arrow-of-envy",
    philosopher: "Anacharsis",
    topic: "death",
    gloss:
      "Back in Scythia, suspected of subverting national institutions by his Greek enthusiasms, Anacharsis is shot by his brother while hunting - dying with the words that envy at home has been his ruin.",
    grc: "Μετὰ χρόνον δὲ παραγενόμενος εἰς τὴν Σκυθίαν καὶ δοκῶν τὰ νόμιμα παραλύειν τῆς πατρίδος πολὺς ὢν ἐν τῷ ἑλληνίζειν, τοξευθεὶς ἐν κυνηγεσίῳ πρὸς τἀδελφοῦ τελευτᾷ, εἰπὼν διὰ μὲν τὸν λόγον ἐκ τῆς Ἑλλάδος σωθῆναι, διὰ δὲ τὸν φθόνον ἐν τῇ οἰκείᾳ ἀπολέσθαι. ἔνιοι δὲ τελετὰς Ἑλληνικὰς ἐπιτελοῦντα διαχρησθῆναι.",
    en: "After a while Anacharsis returned to Scythia, where, owing to his enthusiasm for everything Greek, he was supposed to be subverting the national institutions, and was killed by his brother while they were out hunting together. When struck by the arrow he exclaimed, My reputation carried me safe through Greece, but the envy it excited at home has been my ruin. In some accounts it is said that he was slain while performing Greek rites.",
    ref: "1.102",
    certainty: "disputed",
    framesSaying: "anacharsis-reputation-envy",
    note: "D.L. records the rival account that he was killed while performing Greek rites.",
  },
  // --- Myson ---
  {
    id: "myson-repairs-the-plough",
    philosopher: "Myson",
    topic: "encounter",
    gloss:
      "Curious about the oracle that named Myson wiser than himself, Anacharsis finds him fitting a share to a plough in summer - just the time, says Myson, to repair it.",
    grc: "πολυπραγμονήσαντα δὲ ἐλθεῖν εἰς τὴν κώμην καὶ εὑρεῖν αὐτὸν θέρους ἐχέτλην ἀρότρῳ προσαρμόττοντα, καὶ εἰπεῖν, ἀλλʼ, ὦ Μύσων, οὐχ ὥρα νῦν ἀρότρου. καὶ μάλα, εἶπεν, ὥστε ἐπισκευάζειν.",
    en: "His curiosity aroused, Anacharsis went to the village in summer time and found him fitting a share to a plough and said, Myson, this is not the season for the plough. It is just the time to repair it, was the reply.",
    ref: "1.106",
    involves: "Anacharsis",
    certainty: "reported",
    framesSaying: "myson-plough-repair",
  },
  // --- Epimenides ---
  {
    id: "epimenides-57-year-sleep",
    philosopher: "Epimenides",
    topic: "eccentricity",
    gloss:
      "Sent after a stray sheep, Epimenides sleeps fifty-seven years in a cave, then wakes to a changed farm, an unknown town, and a younger brother grown old.",
    grc: "οὗτός ποτε πεμφθεὶς παρὰ τοῦ πατρὸς εἰς ἀγρὸν ἐπὶ πρόβατον, τῆς ὁδοῦ κατὰ μεσημβρίαν ἐκκλίνας ὑπʼ ἄντρῳ τινὶ κατεκοιμήθη ἑπτὰ καὶ πεντήκοντα ἔτη. διαναστὰς δὲ μετὰ ταῦτα ἐζήτει τὸ πρόβατον, νομίζων ἐπʼ ὀλίγον κεκοιμῆσθαι. ὡς δὲ οὐχ εὕρισκε, παρεγένετο εἰς τὸν ἀγρόν, καὶ μετεσκευασμένα πάντα καταλαβὼν καὶ παρʼ ἑτέρῳ τὴν κτῆσιν, πάλιν ἧκεν εἰς ἄστυ διαπορούμενος. κἀκεῖ δὲ εἰς τὴν ἑαυτοῦ εἰσιὼν οἰκίαν περιέτυχε τοῖς πυνθανομένοις τίς εἴη, ἕως τὸν νεώτερον ἀδελφὸν εὑρὼν τότε ἤδη γέροντα ὄντα, πᾶσαν ἔμαθε παρʼ ἐκείνου τὴν ἀλήθειαν.",
    en: "One day he was sent into the country by his father to look for a stray sheep, and at noon he turned aside out of the way, and went to sleep in a cave, where he slept for fifty-seven years. After this he got up and went in search of the sheep, thinking he had been asleep only a short time. And when he could not find it, he came to the farm, and found everything changed and another owner in possession. Then he went back to the town in utter perplexity; and there, on entering his own house, he fell in with people who wanted to know who he was. At length he found his younger brother, now an old man, and learnt the truth from him.",
    ref: "1.109",
    certainty: "disputed",
    note: "Some maintained instead that he did not sleep but withdrew for a while gathering simples (1.112).",
  },
  {
    id: "epimenides-purifies-athens",
    philosopher: "Epimenides",
    topic: "piety",
    gloss:
      "Summoned from Crete against a pestilence, Epimenides purifies Athens by loosing black and white sheep from the Areopagus and sacrificing where each lay down - the nameless altars remain.",
    grc: "Τότε καὶ Ἀθηναίοις [τότε] λοιμῷ κατεχομένοις ἔχρησεν ἡ Πυθία καθῆραι τὴν πόλιν· οἱ δὲ πέμπουσι ναῦν τε καὶ Νικίαν τὸν Νικηράτου εἰς Κρήτην, καλοῦντες τὸν Ἐπιμενίδην. καὶ ὃς ἐλθὼν Ὀλυμπιάδι τεσσαρακοστῇ ἕκτῇ ἐκάθηρεν αὐτῶν τὴν πόλιν καὶ ἔπαυσε τὸν λοιμὸν τοῦτον τὸν τρόπον. λαβὼν πρόβατα μέλανά τε καὶ λευκὰ ἤγαγε πρὸς τὸν Ἄρειον πάγον· κἀκεῖθεν εἴασεν ἰέναι οἷ βούλοιντο, προστάξας τοῖς ἀκολούθοις ἔνθα ἂν κατακλίνοι αὐτῶν ἕκαστον, θύειν τῷ προσήκοντι θεῷ· καὶ οὕτω λῆξαι τὸ κακόν.",
    en: "Hence, when the Athenians were attacked by pestilence, and the Pythian priestess bade them purify the city, they sent a ship commanded by Nicias, son of Niceratus, to Crete to ask the help of Epimenides. And he came in the 46th Olympiad, purified their city, and stopped the pestilence in the following way. He took sheep, some black and others white, and brought them to the Areopagus; and there he let them go whither they pleased, instructing those who followed them to mark the spot where each sheep lay down and offer a sacrifice to the local divinity. And thus, it is said, the plague was stayed.",
    ref: "1.110",
    certainty: "reported",
    note: "Others said he traced the plague to the Cylonian pollution and had it removed by the death of two young men (1.110).",
  },
  {
    id: "epimenides-declines-the-talent",
    philosopher: "Epimenides",
    topic: "asceticism",
    gloss:
      "Voted a talent by the Athenians for the purification, Epimenides declines the money and instead concludes a treaty of friendship between Cnossos and Athens.",
    grc: "Ἀθηναῖοι δὲ τάλαντον ἐψηφίσαντο δοῦναι αὐτῷ καὶ ναῦν τὴν ἐς Κρήτην ἀπάξουσαν αὐτόν. ὁ δὲ τὸ μὲν ἀργύριον οὐ προσήκατο· φιλίαν δὲ καὶ συμμαχίαν ἐποιήσατο Κνωσίων καὶ Ἀθηναίων.",
    en: "The Athenians voted him a talent in money and a ship to convey him back to Crete. The money he declined, but he concluded a treaty of friendship and alliance between Cnossos and Athens.",
    ref: "1.111",
    certainty: "asserted",
  },
  {
    id: "epimenides-nymphs-food",
    philosopher: "Epimenides",
    topic: "eccentricity",
    gloss:
      "He is said to have received a special food from the Nymphs, kept in a cow's hoof and taken in small doses - so that he was never seen to eat.",
    grc: "φησὶ δὲ Δημήτριός τινας ἱστορεῖν ὡς λάβοι παρὰ Νυμφῶν ἔδεσμά τι καὶ φυλάττοι ἐν χηλῇ βοός· προσφερόμενός τε κατʼ ὀλίγον μηδεμιᾷ κενοῦσθαι ἀποκρίσει μηδὲ ὀφθῆναί ποτε ἐσθίων.",
    en: "But Demetrius reports a story that he received from the Nymphs food of a special sort and kept it in a cow’s hoof; that he took small doses of this food, which was entirely absorbed into his system, and he was never seen to eat.",
    ref: "1.114",
    certainty: "reported",
    note: "The bare 'Demetrius' here is Demetrius of Magnesia (named in full at 1.112); the bare homonym stays in this note rather than accordingTo.",
  },
  {
    id: "epimenides-voice-from-heaven",
    philosopher: "Epimenides",
    topic: "piety",
    gloss:
      "As he builds a temple to the Nymphs, a voice from heaven corrects him - not to the Nymphs but to Zeus - and his prophecy of the Lacedaemonians' defeat comes true at Orchomenus.",
    grc: "Θεόπομπος δʼ ἐν τοῖς Θαυμασίοις, κατασκευάζοντος αὐτοῦ τὸ τῶν Νυμφῶν ἱερὸν ῥαγῆναι φωνὴν ἐξ οὐρανοῦ, Ἐπιμενίδη, μὴ Νυμφῶν, ἀλλὰ Διός· Κρησί τε προειπεῖν τὴν Λακεδαιμονίων ἧτταν ὑπʼ Ἀρκάδων, καθάπερ προείρηται· καὶ δὴ καὶ ἐλήφθησαν πρὸς Ὀρχομενῷ.",
    en: "Theopompus relates in his Mirabilia that, as he was building a temple to the Nymphs, a voice came from heaven: Epimenides, not a temple to the Nymphs but to Zeus, and that he foretold to the Cretans the defeat of the Lacedaemonians by the Arcadians, as already stated; and in very truth they were crushed at Orchomenus.",
    ref: "1.115",
    certainty: "reported",
    accordingTo: "Theopompus",
  },
  // --- Pherecydes ---
  {
    id: "pherecydes-predicts-shipwreck",
    philosopher: "Pherecydes",
    topic: "eccentricity",
    gloss:
      "Walking on the Samian shore, Pherecydes foretells a running ship's sinking as he watches, and - drinking well-water - an earthquake two days off; both come to pass.",
    grc: "καὶ γὰρ παρὰ τὸν αἰγιαλὸν τῆς Σάμου περιπατοῦντα καὶ ναῦν οὐριοδρομοῦσαν ἰδόντα εἰπεῖν ὡς οὐ μετὰ πολὺ καταδύσεται· καὶ ἐν ὀφθαλμοῖς αὐτοῦ καταδῦναι. καὶ ἀνιμηθέντος ἐκ φρέατος ὕδατος πιόντα προειπεῖν, ὡς εἰς τρίτην ἡμέραν ἔσοιτο σεισμός, καὶ γενέσθαι.",
    en: "He was walking along the beach in Samos and saw a ship running before the wind; he exclaimed that in no long time she would go down, and, even as he watched her, down she went. And as he was drinking water which had been drawn up from a well he predicted that on the third day there would be an earthquake; which came to pass.",
    ref: "1.116",
    certainty: "reported",
    note: "Introduced by D.L. among the 'many wonderful stories' told about him.",
  },
  {
    id: "pherecydes-heracles-dream",
    philosopher: "Pherecydes",
    topic: "piety",
    gloss:
      "He bids the Lacedaemonians honour neither gold nor silver, on Heracles' command in a dream - the same night Heracles enjoins the kings to obey Pherecydes.",
    grc: "Καὶ Λακεδαιμονίοις εἰπεῖν μήτε χρυσὸν τιμᾶν μήτε ἄργυρον, ὥς φησι Θεόπομπος ἐν Θαυμασίοις· προστάξαι δὲ αὐτῷ ὄναρ τοῦτο τὸν Ἡρακλέα, ὃν καὶ τῆς αὐτῆς νυκτὸς τοῖς βασιλεῦσι κελεῦσαι Φερεκύδῃ πείθεσθαι. ἔνιοι δὲ Πυθαγόρᾳ περιάπτουσι ταῦτα.",
    en: "He bade the Lacedaemonians set no store by gold or silver, as Theopompus says in his Mirabilia. He told them he had received this command from Heracles in a dream; and the same night Heracles enjoined upon the kings to obey Pherecydes. But some fasten this story upon Pythagoras.",
    ref: "1.117",
    certainty: "reported",
    accordingTo: "Theopompus",
    alsoAttributedTo: "Pythagoras",
  },
  {
    id: "pherecydes-magnesia-burial",
    philosopher: "Pherecydes",
    topic: "death",
    gloss:
      "On the eve of the Ephesian war with Magnesia, Pherecydes has himself dragged into Magnesian territory to be buried there after the victory he foretells.",
    grc: "Φησὶ δʼ Ἕρμιππος πολέμου συνεστῶτος Ἐφεσίοις καὶ Μάγνησι βουλόμενον τοὺς Ἐφεσίους νικῆσαι πυθέσθαι τινὸς παριόντος πόθεν εἴη, τοῦ δʼ εἰπόντος ἐξ Ἐφέσου, ἕλκυσόν με τοίνυν, ἔφη, τῶν σκελῶν καὶ θὲς εἰς τὴν τῶν Μαγνήτων χώραν, καὶ ἀπάγγειλόν σου τοῖς πολίταις μετὰ τὸ νικῆσαι αὐτόθι με θάψαι· ἐπεσκηφέναι τε ταῦτα Φερεκύδην.",
    en: "Hermippus relates that on the eve of war between Ephesus and Magnesia he favoured the cause of the Ephesians, and inquired of some one passing by where he came from, and on receiving the reply From Ephesus, he said, Drag me by the legs and place me in the territory of Magnesia; and take a message to your countrymen that after their victory they must bury me there, and that this is the last injunction of Pherecydes.",
    ref: "1.117",
    certainty: "reported",
    accordingTo: "Hermippus",
  },
  {
    id: "pherecydes-rival-deaths",
    philosopher: "Pherecydes",
    topic: "death",
    gloss:
      "Rival accounts of his end: a leap from Mount Corycus at Delphi, a natural death and burial by Pythagoras on Delos, or a verminous disease - his finger thrust through the doorway: 'My skin tells its own tale.'",
    grc: "ἔνιοι δέ φασιν ἐλθόντα εἰς Δελφοὺς ἀπὸ τοῦ Κωρυκίου ὄρους αὑτὸν δισκῆσαι. Ἀριστόξενος δʼ ἐν τῷ Περὶ Πυθαγόρου καὶ τῶν γνωρίμων αὐτοῦ φησι νοσήσαντα αὐτὸν ὑπὸ Πυθαγόρου ταφῆναι ἐν Δήλῳ. οἱ δὲ φθειριάσαντα τὸν βίον τελευτῆσαι· ὅτε καὶ Πυθαγόρου παραγενομένου καὶ πυνθανομένου, πῶς διακέοιτο, διαβαλόντα τῆς θύρας τὸν δάκτυλον εἰπεῖν, χροῒ δῆλα",
    en: "Another version is that he came to Delphi and hurled himself down from Mount Corycus. But Aristoxenus in his work On Pythagoras and his School affirms that he died a natural death and was buried by Pythagoras in Delos; another account again is that he died of a verminous disease, that Pythagoras was also present and inquired how he was, that he thrust his finger through the doorway and exclaimed, My skin tells its own tale, a phrase subsequently applied by the grammarians as equivalent to getting worse, although some wrongly understand it to mean all is going well.",
    ref: "1.118",
    involves: "Pythagoras",
    certainty: "disputed",
    note: "Aristoxenus' natural-death account is quoted in the excerpt alongside the Delphi and verminous-disease versions; the Magnesian burial (1.117-118) is yet another.",
  },
];
