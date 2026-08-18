/**
 * Book 8 anecdotes - Pythagoras, Empedocles, Archytas, Philolaus, Eudoxus.
 * Narrated incidents only; bare dicta live in the sayings layer (see the
 * overlap policy in anecdotes.ts). Every `en` is a verbatim Hicks excerpt of
 * the cited section, enforced by validate-anecdotes.
 *
 * Curation notes: the Leon-of-Phlius exchange (8.8) IS curated because the
 * court narrative frames the saying (pythagoras-life-great-games). The
 * ox-sacrifice for the theorem (8.12) is told by "Apollodorus the
 * calculator" - a different man from Apollodorus the chronographer, so the
 * attribution stays in the excerpt itself, never in accordingTo.
 * Attributions to Hieronymus (8.21) and Xanthus via Aristotle (8.63) stay
 * in the text/notes: neither label is an existing source node. Hicks refs
 * 8.83 and 8.84 are ambiguous section keys (Archytas/Alcmaeon,
 * Hippasus/Philolaus) - nothing is curated from the second claimant of
 * either. Epicharmus (8.78), Alcmaeon and Hippasus yield no narrated
 * incident. Theano's repartee (8.43) is hers, not a D.L. subject's, and is
 * skipped.
 */
import type { Anecdote } from "../anecdotes";

export const BOOK8_ANECDOTES: Anecdote[] = [
  {
    id: "pythagoras-soul-wanderings",
    philosopher: "Pythagoras",
    topic: "eccentricity",
    gloss:
      "Pythagoras used to say of himself that he had once been Aethalides, accounted Hermes' son, and had asked of Hermes the gift of remembering his experiences through life and through death - so his soul recalled being wounded as Euphorbus by Menelaus.",
    grc: "Τοῦτόν φησιν Ἡρακλείδης ὁ Ποντικὸς περὶ αὑτοῦ τάδε λέγειν, ὡς εἴη ποτὲ γεγονὼς Αἰθαλίδης καὶ Ἑρμοῦ υἱὸς νομισθείη· τὸν δὲ Ἑρμῆν εἰπεῖν αὐτῷ ἑλέσθαι ὅ τι ἂν βούληται πλὴν ἀθανασίας. αἰτήσασθαι οὖν ζῶντα καὶ τελευτῶντα μνήμην ἔχειν τῶν συμβαινόντων. ἐν μὲν οὖν τῇ ζωῇ πάντων διαμνημονεῦσαι· ἐπεὶ δὲ ἀποθάνοι, τηρῆσαι τὴν αὐτὴν μνήμην. χρόνῳ δʼ ὕστερον εἰς Εὔφορβον ἐλθεῖν καὶ ὑπὸ Μενέλεω τρωθῆναι.",
    en: "This is what Heraclides of Pontus tells us he used to say about himself: that he had once been Aethalides and was accounted to be Hermes’ son, and Hermes told him he might choose any gift he liked except immortality; so he asked to retain through life and through death a memory of his experiences. Hence in life he could recall everything, and when he died he still kept the same memories. Afterwards in course of time his soul entered into Euphorbus and he was wounded by Menelaus.",
    ref: "8.4",
    certainty: "reported",
    accordingTo: "Heraclides",
    note: "Heraclides of Pontus. The chain continues: as Hermotimus he identified the rotted shield Menelaus had dedicated to Apollo at Branchidae, then became Pyrrhus the Delian fisherman, and at last Pythagoras (8.5).",
  },
  {
    id: "pythagoras-philosopher-at-phlius",
    philosopher: "Pythagoras",
    topic: "encounter",
    gloss:
      "Asked by Leon the tyrant of Phlius who he was, Pythagoras answers 'A philosopher' - and compares life to the Great Games, where the best come neither for prize nor profit but as spectators, as the philosopher seeks for truth.",
    grc: "Σωσικράτης δʼ ἐν Διαδοχαῖς φησιν αὐτὸν ἐρωτηθέντα ὑπὸ Λέοντος τοῦ Φλιασίων τυράννου τίς εἴη, φιλόσοφος, εἰπεῖν. καὶ τὸν βίον ἐοικέναι πανηγύρει· ὡς οὖν εἰς ταύτην οἱ μὲν ἀγωνιούμενοι, οἱ δὲ κατʼ ἐμπορίαν, οἱ δέ γε βέλτιστοι ἔρχονται θεαταί, οὕτως ἐν τῷ βίῳ οἱ μὲν ἀνδραποδώδεις, ἔφη, φύονται δόξης καὶ πλεονεξίας θηραταί, οἱ δὲ φιλόσοφοι τῆς ἀληθείας.",
    en: "Sosicrates in his Successions of Philosophers says that, when Leon the tyrant of Phlius asked him who he was, he said, A philosopher, and that he compared life to the Great Games, where some went to compete for the prize and others went with wares to sell, but the best as spectators; for similarly, in life, some grow up with servile natures, greedy for fame and gain, but the philosopher seeks for truth.",
    ref: "8.8",
    involves: "Leon",
    certainty: "reported",
    accordingTo: "Sosicrates",
    framesSaying: "pythagoras-life-great-games",
  },
  {
    id: "pythagoras-five-year-silence",
    philosopher: "Pythagoras",
    topic: "training",
    gloss:
      "For five whole years his disciples had to keep silence, merely listening to his discourses without seeing him, until they passed an examination and were admitted to his house and presence.",
    grc: "πενταετίαν θʼ ἡσύχαζον, μόνον τῶν λόγων κατακούοντες καὶ οὐδέπω Πυθαγόραν ὁρῶντες εἰς ὃ δοκιμασθεῖεν· τοὐντεῦθεν δʼ ἐγίνοντο τῆς οἰκίας αὐτοῦ καὶ τῆς ὄψεως μετεῖχον.",
    en: "For five whole years they had to keep silence, merely listening to his discourses without seeing him, until they passed an examination, and thenceforward they were admitted to his house and allowed to see him.",
    ref: "8.10",
    certainty: "asserted",
  },
  {
    id: "pythagoras-golden-thigh",
    philosopher: "Pythagoras",
    topic: "eccentricity",
    gloss:
      "Once, when Pythagoras was disrobed, his thigh was seen to be of gold; and when he crossed the river Nessus, quite a number of people said they heard it welcome him.",
    grc: "λόγος δέ ποτʼ αὐτοῦ παραγυμνωθέντος τὸν μηρὸν ὀφθῆναι χρυσοῦν· καὶ ὅτι Νέσσος ὁ ποταμὸς διαβαίνοντα αὐτὸν προσαγορεύσαι πολὺς ἦν ὁ φάσκων.",
    en: "There is a story that once, when he was disrobed, his thigh was seen to be of gold; and when he crossed the river Nessus, quite a number of people said they heard it welcome him.",
    ref: "8.11",
    certainty: "reported",
    note: "His disciples held the opinion about him that he was Apollo come down from the far north (8.11).",
  },
  {
    id: "pythagoras-ox-sacrifice-theorem",
    philosopher: "Pythagoras",
    topic: "piety",
    gloss:
      "On finding that in a right-angled triangle the square on the hypotenuse equals the squares on the two sides, Pythagoras offers a sacrifice of oxen.",
    grc: "φησὶ δʼ Ἀπολλόδωρος ὁ λογιστικὸς ἑκατόμβην θῦσαι αὐτόν, εὑρόντα ὅτι τοῦ ὀρθογωνίου τριγώνου ἡ ὑποτείνουσα πλευρὰ ἴσον δύναται ταῖς περιεχούσαις. καὶ ἔστιν ἐπίγραμμα οὕτως ἔχον· ἡνίκα Πυθαγόρης τὸ περικλεὲς εὕρετο γράμμα, κεῖνʼ ἐφʼ ὅτῳ κλεινὴν ἤγαγε βουθυσίην.",
    en: "We are told by Apollodorus the calculator that he offered a sacrifice of oxen on finding that in a right-angled triangle the square on the hypotenuse is equal to the squares on the sides containing the right angle. And there is an epigram running as follows : What time Pythagoras that famed figure found, For which the noble offering he brought.",
    ref: "8.12",
    certainty: "reported",
    note: "Told by Apollodorus 'the calculator' - a different man from Apollodorus the chronographer, so the attribution stays in the excerpt.",
  },
  {
    id: "pythagoras-hades-vision",
    philosopher: "Pythagoras",
    topic: "piety",
    gloss:
      "Descended into Hades, Pythagoras sees the soul of Hesiod bound to a brazen pillar and gibbering, and Homer's hung on a tree amid serpents - their punishment for what they said about the gods; for this he was honoured by the people of Croton.",
    grc: "φησὶ δʼ Ἱερώνυμος κατελθόντα αὐτὸν εἰς ᾅδου τὴν μὲν Ἡσιόδου ψυχὴν ἰδεῖν πρὸς κίονι χαλκῷ δεδεμένην καὶ τρίζουσαν, τὴν δʼ Ὁμήρου κρεμαμένην ἀπὸ δένδρου καὶ ὄφεις περὶ αὐτὴν ἀνθʼ ὧν εἶπον περὶ θεῶν, κολαζομένους δὲ καὶ τοὺς μὴ θέλοντας συνεῖναι ταῖς ἑαυτῶν γυναιξί· καὶ δὴ καὶ διὰ τοῦτο τιμηθῆναι ὑπὸ τῶν ἐν Κρότωνι.",
    en: "Hieronymus, however, says that, when he had descended into Hades, he saw the soul of Hesiod bound fast to a brazen pillar and gibbering, and the soul of Homer hung on a tree with serpents writhing about it, this being their punishment for what they had said about the gods; he also saw under torture those who would not remain faithful to their wives. This, says our authority, is why he was honoured by the people of Croton.",
    ref: "8.21",
    certainty: "reported",
    note: "Hieronymus' label is not an existing source node; the attribution stays in the excerpt. Hermippus' rationalizing version of the descent is at 8.41.",
  },
  {
    id: "pythagoras-whelp-friend-soul",
    philosopher: "Pythagoras",
    topic: "piety",
    gloss:
      "Passing a belaboured whelp, Pythagoras, full of pity, bids the striker stay his hand - 'Tis a friend, a human soul; I knew him straight whenas I heard him yelp.",
    grc: "περὶ δὲ τοῦ ἄλλοτʼ ἄλλον αὐτὸν γεγενῆσθαι Ξενοφάνης ἐν ἐλεγείᾳ προσμαρτυρεῖ, ἧς ἀρχή, νῦν αὖτʼ ἄλλον ἔπειμι λόγον, δείξω δὲ κέλευθον. ὃ δὲ περὶ αὐτοῦ φησιν, οὕτως ἔχει· καί ποτέ μιν στυφελιζομένου σκύλακος παριόντα φασὶν ἐποικτῖραι καὶ τόδε φάσθαι ἔπος· παῦσαι μηδὲ ῥάπιζʼ, ἐπεὶ ἦ φίλου ἀνέρος ἐστὶ ψυχή, τὴν ἔγνων φθεγξαμένης ἀΐων.",
    en: "Xenophanes confirms the statement about his having been different people at different times in the elegiacs beginning: Now other thoughts, another path, I show. What he says of him is as follows: They say that, passing a belaboured whelp, He, full of pity, spake these words of dole: Stay, smite not ! ’Tis a friend, a human soul; I knew him straight whenas I heard him yelp !",
    ref: "8.36",
    involves: "Xenophanes",
    certainty: "reported",
    note: "Told in Xenophanes' own elegiacs - mockery of the transmigration doctrine as much as testimony.",
  },
  {
    id: "pythagoras-beanfield-death",
    philosopher: "Pythagoras",
    topic: "death",
    gloss:
      "Fleeing the blaze at Milo's house, Pythagoras stops at a field of beans - he would be captured rather than cross it, and killed rather than prate about his doctrines; and so his pursuers cut his throat.",
    grc: "τὸν δὴ Πυθαγόραν καταληφθῆναι διεξιόντα· καὶ πρός τινι χωρίῳ γενόμενος πλήρει κυάμων, ἵνα [αὐτόθι] ἔστη, εἰπὼν ἁλῶναι ἂν μᾶλλον ἢ πατῆσαι [ἀναιρεθῆναι δὲ κρεῖττον ἢ λαλῆσαι]· καὶ ὧδε πρὸς τῶν διωκόντων ἀποσφαγῆναι.",
    en: "Pythagoras was caught as he tried to escape; he got as far as a certain field of beans, where he stopped, saying he would be captured rather than cross it, and be killed rather than prate about his doctrines; and so his pursuers cut his throat.",
    ref: "8.39",
    certainty: "asserted",
    note: "Rival accounts: Dicaearchus makes him die a fugitive in the temple of the Muses at Metapontum after forty days' starvation (8.40); Hermippus places his death in the war between Agrigentum and Syracuse (8.40).",
  },
  {
    id: "pythagoras-war-death-version",
    philosopher: "Pythagoras",
    topic: "death",
    gloss:
      "In Hermippus' version, Pythagoras and his disciples fight in the van of the Agrigentine army - and when the line turns, he is killed by the Syracusans as he tries to avoid the beanfield.",
    grc: "Ἕρμιππος δέ φησι, πολεμούντων Ἀκραγαντίνων καὶ Συρακοσίων, ἐξελθεῖν τὸν Πυθαγόραν μετὰ τῶν συνήθων καὶ προστῆναι τῶν Ἀκραγαντίνων· τροπῆς δὲ γενομένης περικάμπτοντα αὐτὸν τὴν τῶν κυάμων χώραν ὑπὸ τῶν Συρακοσίων ἀναιρεθῆναι",
    en: "Hermippus relates that, when the men of Agrigentum and Syracuse were at war, Pythagoras and his disciples went out and fought in the van of the army of the Agrigentines, and, their line being turned, he was killed by the Syracusans as he was trying to avoid the beanfield",
    ref: "8.40",
    certainty: "disputed",
    accordingTo: "Hermippus",
    note: "A rival to the fire at Milo's house (8.39) and to Dicaearchus' starvation account (8.40).",
  },
  {
    id: "pythagoras-subterranean-descent",
    philosopher: "Pythagoras",
    topic: "eccentricity",
    gloss:
      "Pythagoras builds a subterranean dwelling, has his mother record all that passes above, and emerges withered like a skeleton to declare he has been down to Hades - reading out their own history as proof, until the assembly weeps and holds him divine.",
    grc: "ὡς γενόμενος ἐν Ἰταλίᾳ κατὰ γῆς οἰκίσκον ποιήσαι καὶ τῇ μητρὶ ἐντείλαιτο τὰ γινόμενα εἰς δέλτον γράφειν σημειουμένην καὶ τὸν χρόνον, ἔπειτα καθιέναι αὐτῷ ἔστʼ ἂν ἀνέλθῃ. τοῦτο ποιῆσαι τὴν μητέρα. τὸν δὲ Πυθαγόραν μετὰ χρόνον ἀνελθεῖν ἰσχνὸν καὶ κατεσκελετευμένον· εἰσελθόντα τʼ εἰς τὴν ἐκκλησίαν φάσκειν ὡς ἀφῖκται ἐξ ᾅδου· καὶ δὴ καὶ ἀνεγίνωσκεν αὐτοῖς τὰ συμβεβηκότα.",
    en: "Pythagoras, on coming to Italy, made a subterranean dwelling and enjoined on his mother to mark and record all that passed, and at what hour, and to send her notes down to him until he should ascend. She did so. Pythagoras some time afterwards came up withered and looking like a skeleton, then went into the assembly and declared he had been down to Hades, and even read out his experiences to them.",
    ref: "8.41",
    certainty: "reported",
    accordingTo: "Hermippus",
    note: "The assembly was so affected that they wept and wailed, held him divine, and sent their wives to him - hence the 'Pythagorean women' (8.41).",
  },
  {
    id: "pythagoras-damo-memoirs",
    philosopher: "Pythagoras",
    topic: "legacy",
    gloss:
      "Entrusting his memoirs to his daughter Damo, Pythagoras charges her never to give them to anyone outside the house - and though she could have sold the writings for a large sum, she reckons poverty and her father's injunctions more precious than gold.",
    grc: "ὅς γέ τοι Δαμοῖ τᾷ ἑαυτοῦ θυγατρὶ παρακαταθέμενος τὰ ὑπομνάματα ἐπέσκαψε μηδενὶ τῶν ἐκτὸς τᾶς οἰκίας παραδιδόμεν. ἁ δὲ δυναμένα πολλῶν χραμάτων ἀποδίδοσθαι τὼς λόγως οὐκ ἐβουλάθη· πενίαν δὲ καὶ τὰς τῶ πατρὸς ἐπισκάψιας ἐνόμιζε χρυσῶ τιμιωτέρας ἦμεν, καὶ ταῦτα γυνά.",
    en: "when he entrusted his daughter Damo with the custody of his memoirs, he solemnly charged her never to give them to anyone outside his house. And, although she could have sold the writings for a large sum of money, she would not, but reckoned poverty and her father’s solemn injunctions more precious than gold, for all that she was a woman.",
    ref: "8.42",
    involves: "Damo",
    certainty: "reported",
    note: "From the letter of Lysis to Hippasus (8.42).",
  },
  {
    id: "empedocles-wind-stayer",
    philosopher: "Empedocles",
    topic: "eccentricity",
    gloss:
      "When the etesian winds blow violently enough to damage the crops, Empedocles has asses flayed and their skins stretched out on the hills and headlands to catch the wind - and, because this checks it, is called the wind-stayer.",
    grc: "καὶ γὰρ ἐτησίων ποτὲ σφοδρῶς πνευσάντων ὡς τοὺς καρποὺς λυμῆναι, κελεύσας ὄνους ἐκδαρῆναι καὶ ἀσκοὺς ποιῆσαι περὶ τοὺς λόφους καὶ τὰς ἀκρωρείας διέτεινε πρὸς τὸ συλλαβεῖν τὸ πνεῦμα· λήξαντος δὲ κωλυσανέμαν κληθῆναι.",
    en: "when the etesian winds once began to blow violently and to damage the crops, he ordered asses to be flayed and bags to be made of their skin. These he stretched out here and there on the hills and headlands to catch the wind and, because this checked the wind, he was called the wind-stayer.",
    ref: "8.60",
    certainty: "reported",
    accordingTo: "Timaeus",
  },
  {
    id: "empedocles-trance-woman",
    philosopher: "Empedocles",
    topic: "eccentricity",
    gloss:
      "For thirty days Empedocles keeps the body of a woman in a trance without pulsation though she never breathed - for which Heraclides calls him not merely a physician but a diviner as well.",
    grc: "τὴν γοῦν ἄπνουν ὁ Ἡρακλείδης φησὶ τοιοῦτόν τι εἶναι, ὡς τριάκοντα ἡμέρας συντηρεῖν ἄπνουν καὶ ἄσφυκτον τὸ σῶμα· ὅθεν καὶ εἶπεν αὐτὸν καὶ ἰητρὸν καὶ μάντιν",
    en: "At all events Heraclides testifies that the case of the woman in a trance was such that for thirty days he kept her body without pulsation though she never breathed; and for that reason Heraclides called him not merely a physician but a diviner as well",
    ref: "8.61",
    involves: "Pausanias",
    certainty: "reported",
    accordingTo: "Heraclides",
    note: "Heraclides of Pontus, in his book On Diseases; he furnished Pausanias with the facts about the woman in a trance (8.60). The 'sending away of the dead woman alive' made Empedocles famous (8.67).",
  },
  {
    id: "empedocles-declines-kingship",
    philosopher: "Empedocles",
    topic: "defiance",
    gloss:
      "A champion of freedom and averse to rule of every kind, Empedocles declines the kingship when it is offered to him - preferring a frugal life.",
    grc: "φησὶ δʼ αὐτὸν καὶ Ἀριστοτέλης ἐλεύθερον γεγονέναι καὶ πάσης ἀρχῆς ἀλλότριον, εἴ γε τὴν βασιλείαν αὐτῷ διδομένην παρῃτήσατο, καθάπερ Ξάνθος ἐν τοῖς περὶ αὐτοῦ λέγει, τὴν λιτότητα δηλονότι πλέον ἀγαπήσας.",
    en: "Aristotle too declares him to have been a champion of freedom and averse to rule of every kind, seeing that, as Xanthus relates in his account of him, he declined the kingship when it was offered to him, obviously because he preferred a frugal life.",
    ref: "8.63",
    certainty: "reported",
    note: "Aristotle is a philosopher node and Xanthus no existing source; both attributions stay in the excerpt.",
  },
  {
    id: "empedocles-impeaches-host",
    philosopher: "Empedocles",
    topic: "defiance",
    gloss:
      "At a magistrate's dinner where wine is withheld until the 'master of the revels' orders the guests to drink it or have it poured over their heads, Empedocles keeps silence - and the next day impeaches host and master both, securing their condemnation and execution.",
    grc: "φησὶ γὰρ ὅτι κληθεὶς ὑπό τινος τῶν ἀρχόντων 〈ὡσ〉 προβαίνοντος τοῦ δείπνου τὸ ποτὸν οὐκ εἰσεφέρετο, τῶν ἄλλων ἡσυχαζόντων, μισοπονήρως διατεθεὶς ἐκέλευσεν εἰσφέρειν· ὁ δὲ κεκληκὼς ἀναμένειν ἔφη τὸν τῆς βουλῆς ὑπηρέτην. ὡς δὲ παρεγένετο, ἐγενήθη συμποσίαρχος, τοῦ κεκληκότος δηλονότι καταστήσαντος, ὃς ὑπεγράφετο τυραννίδος ἀρχήν· ἐκέλευσε γὰρ ἢ πίνειν ἢ καταχεῖσθαι τῆς κεφαλῆς. τότε μὲν οὖν ὁ Ἐμπεδοκλῆς ἡσύχασε· τῇ δʼ ὑστεραίᾳ εἰσαγαγὼν εἰς δικαστήριον ἀπέκτεινε καταδικάσας ἀμφοτέρους, τόν τε κλήτορα καὶ τὸν συμποσίαρχον. ἀρχὴ μὲν οὖν αὐτῷ τῆς πολιτείας ἥδε.",
    en: "having been invited to dine with one of the magistrates, when the dinner had gone on some time and no wine was put on the table, though the other guests kept quiet, he, becoming indignant, ordered wine to be brought. Then the host confessed that he was waiting for the servant of the senate to appear. When he came he was made master of the revels, clearly by the arrangement of the host, whose design of making himself tyrant was but thinly veiled, for he ordered the guests either to drink wine or have it poured over their heads. For the time being Empedocles was reduced to silence; the next day he impeached both of them, the host and the master of the revels, and secured their condemnation and execution. This, then, was the beginning of his political career.",
    ref: "8.64",
    certainty: "reported",
    accordingTo: "Timaeus",
    note: "Timaeus gives this as the reason why Empedocles favoured democracy (8.64); he later broke up the assembly of the Thousand (8.66).",
  },
  {
    id: "empedocles-acron-inscription",
    philosopher: "Empedocles",
    topic: "wit",
    gloss:
      "When Acron the physician asks the council for a site to build his father a monument, Empedocles forbids it with a speech on equality - and a mock epitaph: 'Acron the eminent physician of Agrigentum, son of Acros, is buried beneath the steep eminence of his most eminent native city.'",
    grc: "Πάλιν δʼ Ἄκρωνος τοῦ ἰατροῦ τόπον αἰτοῦντος παρὰ τῆς βουλῆς εἰς κατασκευὴν πατρῴου μνήματος διὰ τὴν ἐν τοῖς ἰατροῖς ἀκρότητα παρελθὼν ὁ Ἐμπεδοκλῆς ἐκώλυσε, τά τʼ ἄλλα περὶ ἰσότητος διαλεχθεὶς καί τι καὶ τοιοῦτον ἐρωτήσας· τί δʼ ἐπιγράψομεν ἐλεγεῖον; ἢ τοῦτο; ἄκρον ἰατρὸν Ἄκρωνʼ Ἀκραγαντῖνον πατρὸς Ἄκρου κρύπτει κρημνὸς ἄκρος πατρίδος ἀκροτάτης.",
    en: "when Acron the physician asked the council for a site on which to build a monument to his father, who had been eminent among physicians, Empedocles came forward and forbade it in a speech where he enlarged upon equality and in particular put the following question: But what inscription shall we put upon it? Shall it be this? Acron the eminent physician of Agrigentum, son of Acros, is buried beneath the steep eminence of his most eminent native city?",
    ref: "8.65",
    involves: "Acron",
    certainty: "asserted",
    note: "Some attribute the couplet to Simonides (8.65).",
  },
  {
    id: "empedocles-vanishing-apotheosis",
    philosopher: "Empedocles",
    topic: "death",
    gloss:
      "After the sacrificial feast at Peisianax's field, Empedocles alone is missing at daybreak; someone tells of a loud voice in the night calling his name, and a light in the heavens - and Pausanias bids the searchers stop, for it is now their duty to sacrifice to him as a god.",
    grc: "ὡς δʼ ἡμέρας γενηθείσης ἐξανέστησαν, οὐχ ηὑρέθη μόνος. ζητουμένου δὲ καὶ τῶν οἰκετῶν ἀνακρινομένων καὶ φασκόντων μὴ εἰδέναι, εἷς τις ἔφη μέσων νυκτῶν φωνῆς ὑπερμεγέθους ἀκοῦσαι προσκαλουμένης Ἐμπεδοκλέα, εἶτʼ ἐξαναστὰς ἑωρακέναι φῶς οὐράνιον καὶ λαμπάδων φέγγος, ἄλλο δὲ μηδέν· τῶν δʼ ἐπὶ τῷ γενομένῳ ἐκπλαγέντων, καταβὰς ὁ Παυσανίας ἔπεμψέ τινας ζητήσοντας. ὕστερον δὲ ἐκώλυε πολυπραγμονεῖν, φάσκων εὐχῆς ἄξια συμβεβηκέναι καὶ θύειν αὐτῷ δεῖν καθαπερεὶ γεγονότι θεῷ.",
    en: "At daybreak all got up, and he was the only one missing. A search was made, and they questioned the servants, who said they did not know where he was. Thereupon someone said that in the middle of the night he heard an exceedingly loud voice calling Empedocles. Then he got up and beheld a light in the heavens and a glitter of lamps, but nothing else. His hearers were amazed at what had occurred, and Pausanias came down and sent people to search for him. But later he bade them take no further trouble, for things beyond expectation had happened to him, and it was their duty to sacrifice to him since he was now a god.",
    ref: "8.68",
    involves: "Pausanias",
    certainty: "disputed",
    note: "Heraclides' story (8.67-68). Timaeus expressly contradicts it: Empedocles left Sicily for the Peloponnesus and never returned, and Peisianax was a Syracusan with no land at Agrigentum (8.71).",
  },
  {
    id: "empedocles-etna-leap",
    philosopher: "Empedocles",
    topic: "death",
    gloss:
      "Empedocles sets out for Etna and plunges into the fiery craters to confirm the report that he has become a god - betrayed afterwards when one of his bronze slippers is thrown up in the flames.",
    grc: "Ἱππόβοτος δέ φησιν ἐξαναστάντα αὐτὸν ὡδευκέναι ὡς ἐπὶ τὴν Αἴτνην, εἶτα παραγενόμενον ἐπὶ τοὺς κρατῆρας τοῦ πυρὸς ἐναλέσθαι καὶ ἀφανισθῆναι, βουλόμενον τὴν περὶ αὑτοῦ φήμην βεβαιῶσαι ὅτι γεγόνοι θεός, ὕστερον δὲ γνωσθῆναι, ἀναρριπισθείσης αὐτοῦ μιᾶς τῶν κρηπίδων· χαλκᾶς γὰρ εἴθιστο ὑποδεῖσθαι.",
    en: "Hippobotus, again, asserts that, when he got up, he set out on his way to Etna; then, when he had reached it, he plunged into the fiery craters and disappeared, his intention being to confirm the report that he had become a god. Afterwards the truth was known, because one of his slippers was thrown up in the flames; it had been his custom to wear slippers of bronze.",
    ref: "8.69",
    certainty: "disputed",
    accordingTo: "Hippobotus",
    note: "Timaeus asks how he came to leap into craters he never once mentioned though they were not far off (8.71); D.L.'s own epigram teases the tale (8.75).",
  },
  {
    id: "empedocles-selinus-pestilence",
    philosopher: "Empedocles",
    topic: "piety",
    gloss:
      "When Selinus suffers pestilence from its noisome river, Empedocles brings two neighbouring rivers to the place at his own expense and sweetens the waters - and the feasting Selinuntines rise up and worship and pray to him as to a god.",
    grc: "τοῖς Σελινουντίοις ἐμπεσόντος λοιμοῦ διὰ τὰς ἀπὸ τοῦ παρακειμένου ποταμοῦ δυσωδίας, ὥστε καὶ αὐτοὺς φθείρεσθαι καὶ τὰς γυναῖκας δυστοκεῖν, ἐπινοῆσαι τὸν Ἐμπεδοκλέα καὶ δύο τινὰς ποταμοὺς τῶν σύνεγγυς ἐπαγαγεῖν ἰδίαις δαπάναις· καὶ καταμίξαντα γλυκῆναι τὰ ῥεύματα. οὕτω δὴ λήξαντος τοῦ λοιμοῦ καὶ τῶν Σελινουντίων εὐωχουμένων ποτὲ παρὰ τῷ ποταμῷ, ἐπιφανῆναι τὸν Ἐμπεδοκλέα· τοὺς δʼ ἐξαναστάντας προσκυνεῖν καὶ προσεύχεσθαι καθαπερεὶ θεῷ.",
    en: "We are told that the people of Selinus suffered from pestilence owing to the noisome smells from the river hard by, so that the citizens themselves perished and their women died in childbirth, that Empedocles conceived the plan of bringing two neighbouring rivers to the place at his own expense, and that by this admixture he sweetened the waters. When in this way the pestilence had been stayed and the Selinuntines were feasting on the river bank, Empedocles appeared; and the company rose up and worshipped and prayed to him as to a god.",
    ref: "8.70",
    certainty: "reported",
    note: "It was then, to confirm this belief of theirs, that he leapt into the fire (8.70).",
  },
  {
    id: "empedocles-carriage-fall-death",
    philosopher: "Empedocles",
    topic: "death",
    gloss:
      "Going in a carriage to a festival at Messene, Empedocles falls and breaks his thigh; the illness that follows kills him at seventy-seven, and his tomb is in Megara.",
    grc: "ὕστερον δὲ διά τινα πανήγυριν πορευόμενον ἐπʼ ἀμάξης ὡς εἰς Μεσσήνην πεσεῖν καὶ τὸν μηρὸν κλάσαι· νοσήσαντα δʼ ἐκ τούτου τελευτῆσαι ἐτῶν ἑπτὰ καὶ ἑβδομήκοντα. εἶναι δʼ αὐτοῦ καὶ τάφον ἐν Μεγάροις.",
    en: "as he was going in a carriage to Messene to attend some festival, he fell and broke his thigh; this brought an illness which caused his death at the age of seventy-seven. Moreover, his tomb is in Megara.",
    ref: "8.73",
    certainty: "disputed",
    note: "One of several rival deaths: the vanishing at Peisianax's field (8.68), the Etna leap (8.69), Demetrius of Troezen's noose (8.74), and the drowning of Telauges' letter (8.74). Timaeus holds the manner of his death unknown (8.71).",
  },
  {
    id: "archytas-letter-saves-plato",
    philosopher: "Archytas",
    topic: "encounter",
    gloss:
      "It is Archytas whose letter saves Plato when he is about to be put to death by Dionysius - the same Archytas whom his city made generalissimo seven times, though the law excluded all others from even a second year of command.",
    grc: "οὗτός ἐστιν ὁ Πλάτωνα ῥυσάμενος διʼ ἐπιστολῆς παρὰ Διονυσίου μέλλοντʼ ἀναιρεῖσθαι. ἐθαυμάζετο δὲ καὶ παρὰ τοῖς πολλοῖς ἐπὶ πάσῃ ἀρετῇ· καὶ δὴ ἑπτάκις τῶν πολιτῶν ἐστρατήγησε, τῶν ἄλλων μὴ πλέον ἐνιαυτοῦ στρατηγούντων διὰ τὸ κωλύειν τὸν νόμον.",
    en: "He it was whose letter saved Plato when he was about to be put to death by Dionysius. He was generally admired for his excellence in all fields; thus he was generalissimo of his city seven times, while the law excluded all others even from a second year of command.",
    ref: "8.79",
    involves: "Plato",
    certainty: "asserted",
    note: "The rescue as told from Plato's side - Archytas' letter to Dionysius and the safe passage to Athens - is at 3.21-22.",
  },
  {
    id: "archytas-undefeated-general",
    philosopher: "Archytas",
    topic: "legacy",
    gloss:
      "Archytas is never defeated during his whole generalship - and when he once resigns it owing to bad feeling against him, the army at once falls into the hands of the enemy.",
    grc: "Τὸν δὲ Πυθαγορικὸν Ἀριστόξενός φησι μηδέποτε στρατηγοῦντα ἡττηθῆναι· φθονούμενον δʼ ἅπαξ ἐκχωρῆσαι τῆς στρατηγίας καὶ τοὺς αὐτίκα ληφθῆναι.",
    en: "Aristoxenus says that our Pythagorean was never defeated during his whole generalship, though he once resigned it owing to bad feeling against him, whereupon the army at once fell into the hands of the enemy.",
    ref: "8.82",
    certainty: "reported",
    accordingTo: "Aristoxenus",
  },
  {
    id: "philolaus-book-bought-by-plato",
    philosopher: "Philolaus",
    topic: "legacy",
    gloss:
      "Philolaus wrote one book - the work Plato, at Dionysius' court in Sicily, buys from Philolaus' relatives for forty Alexandrine minas of silver, and from which the Timaeus was transcribed.",
    grc: "Γέγραφε δὲ βιβλίον ἕν, ὅ φησιν Ἕρμιππος λέγειν τινὰ τῶν συγγραφέων Πλάτωνα τὸν φιλόσοφον παραγενόμενον εἰς Σικελίαν πρὸς Διονύσιον ὠνήσασθαι παρὰ τῶν συγγενῶν τοῦ Φιλολάου ἀργυρίου Ἀλεξανδρινῶν μνῶν τετταράκοντα καὶ ἐντεῦθεν μεταγεγραφέναι τὸν Τίμαιον.",
    en: "He wrote one book, and it was this work which, according to Hermippus, some writer said that Plato the philosopher, when he went to Sicily to Dionysius’s court, bought from Philolaus’s relatives for the sum of forty Alexandrine minas of silver, from which also the Timaeus was transcribed.",
    ref: "8.85",
    involves: "Plato",
    certainty: "reported",
    accordingTo: "Hermippus",
    note: "Others say Plato received it as a present for procuring from Dionysius the release of a young disciple of Philolaus who had been cast into prison (8.85).",
  },
  {
    id: "eudoxus-egypt-shaved",
    philosopher: "Eudoxus",
    topic: "training",
    gloss:
      "Eudoxus proceeds to Egypt with letters of introduction from Agesilaus to Nectanabis, who recommends him to the priests - and remains there a year and four months with his beard and eyebrows shaved, where some say he wrote his Octaëteris.",
    grc: "εἰς Αἴγυπτον ἀπᾶραι μετὰ Χρυσίππου τοῦ ἰατροῦ, συστατικὰς φέροντα παρʼ Ἀγησιλάου πρὸς Νεκτάναβιν· τὸν δὲ τοῖς ἱερεῦσιν αὐτὸν συστῆσαι. καὶ τέτταρας μῆνας πρὸς ἐνιαυτῷ διατρίψαντʼ αὐτόθι ξυρόμενόν θʼ ὑπήνην καὶ ὀφρὺν τὴν Ὀκταετηρίδα κατά τινας συγγράψαι.",
    en: "he proceeded to Egypt with Chrysippus the physician, bearing with him letters of introduction from Agesilaus to Nectanabis, who recommended him to the priests. There he remained one year and four months with his beard and eyebrows shaved, and there, some say, he wrote his Octaëteris.",
    ref: "8.87",
    certainty: "asserted",
    note: "Chrysippus here is the Cnidian physician, not the Stoic.",
  },
  {
    id: "eudoxus-returns-to-annoy-plato",
    philosopher: "Eudoxus",
    topic: "defiance",
    gloss:
      "Eudoxus at length returns to Athens bringing a great number of pupils - according to some, for the purpose of annoying Plato, who had originally passed him over.",
    grc: "ἔπειθʼ οὕτως ἐπανελθεῖν Ἀθήναζε, πάνυ πολλοὺς περὶ ἑαυτὸν ἔχοντα μαθητάς, ὥς φασί τινες, ὑπὲρ τοῦ Πλάτωνα λυπῆσαι, ὅτι τὴν ἀρχὴν αὐτὸν παρεπέμψατο.",
    en: "Then at length he returned to Athens, bringing with him a great number of pupils: according to some, this was for the purpose of annoying Plato, who had originally passed him over.",
    ref: "8.87",
    involves: "Plato",
    certainty: "reported",
  },
  {
    id: "eudoxus-semicircular-couches",
    philosopher: "Eudoxus",
    topic: "encounter",
    gloss:
      "When Plato gives a banquet, Eudoxus - owing to the numbers present - introduces the fashion of arranging couches in a semicircle.",
    grc: "τινὲς δέ φασι καὶ συμπόσιον ἔχοντι τῷ Πλάτωνι αὐτὸν τὴν ἡμικύκλιον κατάκλισιν, πολλῶν ὄντων, εἰσηγήσασθαι.",
    en: "Some say that, when Plato gave a banquet, Eudoxus, owing to the numbers present, introduced the fashion of arranging couches in a semicircle.",
    ref: "8.88",
    involves: "Plato",
    certainty: "reported",
  },
  {
    id: "eudoxus-apis-omen",
    philosopher: "Eudoxus",
    topic: "piety",
    gloss:
      "In Egypt the sacred bull Apis licks Eudoxus' cloak - from which the priests foretell that he will be famous but short-lived.",
    grc: "ὅτε δὲ συνεγένετο ἐν Αἰγύπτῳ Χονούφιδι τῷ Ἡλιουπολίτῃ, ὁ Ἆπις αὐτοῦ θοἰμάτιον περιελιχμήσατο. ἔνδοξον οὖν αὐτὸν ἀλλʼ ὀλιγοχρόνιον ἔφασαν οἱ ἱερεῖς ἔσεσθαι, καθά φησι Φαβωρῖνος ἐν Ἀπομνημονεύμασιν.",
    en: "When he was in Egypt with Chonuphis of Heliopolis, the sacred bull Apis licked his cloak. From this the priests foretold that he would be famous but shortlived, so we are informed by Favorinus in his Memorabilia.",
    ref: "8.90",
    certainty: "reported",
    accordingTo: "Favorinus",
    note: "D.L.'s own epigram on the omen follows at 8.91; Eudoxus died in his fifty-third year (8.90).",
  },
];
