/**
 * Book 7 anecdotes - the Stoa: Zeno of Citium, Ariston of Chios, Herillus,
 * Dionysius the Renegade, Cleanthes, Sphaerus, and Chrysippus. Narrated
 * incidents only; bare dicta live in the sayings layer (see the overlap
 * policy in anecdotes.ts). Every `en` is a verbatim Hicks excerpt of the
 * cited section, enforced by validate-anecdotes.
 *
 * Curation notes: several famous incidents are not re-curated because
 * their whole substance is already a curated saying whose excerpt carries
 * the narrative frame - Zeno silent before Ptolemy's envoys (7.24,
 * zeno-citium-hold-his-tongue), Crates dragging him from Stilpo by the
 * cloak (7.24, zeno-citium-seize-by-ears), Cleanthes' handful of coin
 * (7.170, cleanthes-maintain-second-cleanthes), and the horny-handed rake
 * unmasked by a sneeze (7.173, cleanthes-sneeze-effeminate). Persaeus'
 * false-news test by Antigonus (7.36) is skipped: Persaeus has no Life of
 * his own and is no graph philosopher, so the anecdote has no valid
 * subject. Hicks refs 7.160 and 7.166 are duplicated across chapter
 * boundaries and resolve first-match (7.160 → end of the Zeno doxography,
 * 7.166 → Herillus), so Ariston's Cynosarges fame (7.160-161) is left out
 * and Dionysius' ophthalmia motive (7.166) lives in a note rather than
 * an excerpt. Attributions to Cleanthes' On Bronze (7.14), Antisthenes'
 * Successions (7.168), and Demetrius of Magnesia (7.169, 7.185) stay in
 * notes: those labels would mint or conflate graph nodes.
 */
import type { Anecdote } from "../anecdotes";

export const BOOK7_ANECDOTES: Anecdote[] = [
  // --- Zeno of Citium ---
  {
    id: "zeno-oracle-complexion-of-the-dead",
    philosopher: "Zeno of Citium",
    topic: "conversion",
    gloss:
      "Consulting the oracle on how to attain the best life, Zeno is told to take on the complexion of the dead - and, perceiving what this means, studies the ancient authors.",
    grc:
      "Ἑκάτων δέ φησι καὶ Ἀπολλώνιος ὁ Τύριος ἐν πρώτῳ περὶ Ζήνωνος, χρηστηριασαμένου αὐτοῦ τί πράττων ἄριστα βιώσεται, ἀποκρίνασθαι τὸν θεόν, εἰ συγχρωτίζοιτο τοῖς νεκροῖς· ὅθεν ξυνέντα τὰ τῶν ἀρχαίων ἀναγινώσκειν.",
    en: "It is stated by Hecato and by Apollonius of Tyre in his first book on Zeno that he consulted the oracle to know what he should do to attain the best life, and that the god’s response was that he should take on the complexion of the dead. Whereupon, perceiving what this meant, he studied ancient authors.",
    ref: "7.2",
    certainty: "reported",
    accordingTo: "Hecato",
  },
  {
    id: "zeno-shipwreck-bookshop",
    philosopher: "Zeno of Citium",
    topic: "conversion",
    gloss:
      "Shipwrecked with a cargo of purple, the thirty-year-old merchant sits down in an Athenian bookshop, reads Xenophon's Memorabilia - and asks where men like Socrates are to be found.",
    grc:
      "τῷ οὖν Κράτητι παρέβαλε τοῦτον τὸν τρόπον. πορφύραν ἐμπεπορευμένος ἀπὸ τῆς Φοινίκης πρὸς τῷ Πειραιεῖ ἐναυάγησεν. ἀνελθὼν δʼ εἰς τὰς Ἀθήνας ἤδη τριακοντούτης ἐκάθισε παρά τινα βιβλιοπώλην. ἀναγινώσκοντος δʼ ἐκείνου τὸ δεύτερον τῶν Ξενοφῶντος Ἀπομνημονευμάτων, ἡσθεὶς ἐπύθετο ποῦ διατρίβοιεν οἱ τοιοῦτοι ἄνδρες.",
    en: "Now the way he came across Crates was this. He was shipwrecked on a voyage from Phoenicia to Peiraeus with a cargo of purple. He went up into Athens and sat down in a bookseller’s shop, being then a man of thirty. As he went on reading the second book of Xenophon’s Memorabilia , he was so pleased that he inquired where men like Socrates were to be found.",
    ref: "7.2",
    involves: "Crates",
    certainty: "asserted",
    note: "The bookseller's answer - Crates passing by in the nick of time, 'Follow yonder man' - opens 7.3. Zeno's own verdict is the curated saying zeno-citium-shipwreck: 'I made a prosperous voyage when I suffered shipwreck' (7.4).",
  },
  {
    id: "zeno-lentil-soup-pot",
    philosopher: "Zeno of Citium",
    topic: "training",
    gloss:
      "To cure his pupil's excessive modesty, Crates makes Zeno carry a pot of lentil-soup through the Ceramicus - and when he hides it, breaks the pot with his staff: 'Why run away, my little Phoenician? nothing terrible has befallen you.'",
    grc:
      "εὐκαίρως δὲ παριόντος Κράτητος, ὁ βιβλιοπώλης δείξας αὐτόν φησι, τούτῳ παρακολούθησον. ἐντεῦθεν ἤκουσε τοῦ Κράτητος, ἄλλως μὲν εὔτονος 〈ὢν〉 πρὸς φιλοσοφίαν, αἰδήμων δὲ ὡς πρὸς τὴν Κυνικὴν ἀναισχυντίαν. ὅθεν ὁ Κράτης βουλόμενος αὐτὸν καὶ τοῦτο θεραπεῦσαι δίδωσι χύτραν φακῆς διὰ τοῦ Κεραμεικοῦ φέρειν. ἐπεὶ δʼ εἶδεν αὐτὸν αἰδούμενον καὶ παρακαλύπτοντα, παίσας τῇ βακτηρίᾳ κατάγνυσι τὴν χύτραν· φεύγοντος δʼ αὐτοῦ καὶ τῆς φακῆς κατὰ τῶν σκελῶν ῥεούσης, φησὶν ὁ Κράτης, τί φεύγεις, Φοινικίδιον; οὐδὲν δεινὸν πέπονθας.",
    en: "Crates passed by in the nick of time, so the bookseller pointed to him and said, Follow yonder man. From that day he became Crates’s pupil, showing in other respects a strong bent for philosophy, though with too much native modesty to assimilate Cynic shamelessness. Hence Crates, desirous of curing this defect in him, gave him a potful of lentil-soup to carry through the Ceramicus; and when he saw that he was ashamed and tried to keep it out of sight, with a blow of his staff he broke the pot. As Zeno took to flight with the lentil-soup flowing down his legs, Why run away, my little Phoenician? quoth Crates, nothing terrible has befallen you.",
    ref: "7.3",
    involves: "Crates",
    certainty: "asserted",
  },
  {
    id: "zeno-painted-colonnade",
    philosopher: "Zeno of Citium",
    topic: "teaching",
    gloss:
      "Zeno discourses pacing up and down the Painted Colonnade - chosen to keep the spot clear of idlers - and his hearers are called men of the Stoa: the Stoics.",
    grc:
      "Ἀνακάμπτων δὴ ἐν τῇ ποικίλῃ στοᾷ τῇ καὶ Πεισιανακτίῳ καλουμένῃ, ἀπὸ δὲ τῆς γραφῆς τῆς Πολυγνώτου ποικίλῃ, διετίθετο τοὺς λόγους, βουλόμενος καὶ τὸ χωρίον ἀπερίστατον ποιῆσαι. ἐπὶ γὰρ τῶν τριάκοντα τῶν πολιτῶν πρὸς τοῖς χιλίοις τετρακόσιοι ἀνῄρηντʼ ἐν αὐτῷ. προσῄεσαν δὴ λοιπὸν ἀκούοντες αὐτοῦ καὶ διὰ τοῦτο Στωικοὶ ἐκλήθησαν καὶ οἱ ἀπʼ αὐτοῦ ὁμοίως, πρότερον Ζηνώνειοι καλούμενοι, καθά φησι καὶ Ἐπίκουρος ἐν ἐπιστολαῖς. καὶ πρότερόν γε Στωικοὶ ἐκαλοῦντο οἱ διατρίβοντες ἐν αὐτῇ ποιηταί, καθά φησιν Ἐρατοσθένης ἐν ὀγδόῃ Περὶ τῆς ἀρχαίας κωμῳδίας, οἳ καὶ τὸν λόγον ἐπὶ πλεῖον ηὔξησαν.",
    en: "He used then to discourse, pacing up and down in the painted colonnade, which is also called the colonnade or Portico of Pisianax, but which received its name from the painting of Polygnotus; his object being to keep the spot clear of a concourse of idlers. It was the spot where in the time of the Thirty 1400 Athenian citizens had been put to death. Hither, then, people came henceforth to hear Zeno, and this is why they were known as men of the Stoa, or Stoics; and the same name was given to his followers, who had formerly been known as Zenonians.",
    ref: "7.5",
    certainty: "asserted",
  },
  {
    id: "zeno-keys-of-the-city",
    philosopher: "Zeno of Citium",
    topic: "legacy",
    gloss:
      "The Athenians hold Zeno in such honour that they deposit with him the keys of the city walls, and give him a golden crown and a bronze statue.",
    grc:
      "Ἐτίμων δὴ οὖν Ἀθηναῖοι σφόδρα τὸν Ζήνωνα, οὕτως ὡς καὶ τῶν τειχῶν αὐτῷ τὰς κλεῖς παρακαταθέσθαι καὶ χρυσῷ στεφάνῳ τιμῆσαι καὶ χαλκῇ εἰκόνι.",
    en: "The people of Athens held Zeno in high honour, as is proved by their depositing with him the keys of the city walls, and their honouring him with a golden crown and a bronze statue.",
    ref: "7.6",
    certainty: "asserted",
    note: "The full honorific decree - golden crown, public tomb in the Ceramicus, two inscribed pillars - is quoted at 7.10-12.",
  },
  {
    id: "zeno-declines-antigonus-court",
    philosopher: "Zeno of Citium",
    topic: "defiance",
    gloss:
      "Antigonus Gonatas hears Zeno lecture whenever he is in Athens and invites him to court; the old man declines, dispatching his friend Persaeus in his stead.",
    grc:
      "ἀπεδέχετο δʼ αὐτὸν καὶ Ἀντίγονος καὶ εἴ ποτʼ Ἀθήναζε ἥκοι, ἤκουεν αὐτοῦ πολλά τε παρεκάλει ἀφικέσθαι ὡς αὐτόν. ὁ δὲ τοῦτο μὲν παρῃτήσατο, Περσαῖον δʼ ἕνα τῶν γνωρίμων ἀπέστειλεν, ὃς ἦν Δημητρίου μὲν υἱός, Κιτιεὺς δὲ τὸ γένος, καὶ ἤκμαζε κατὰ τὴν τριακοστὴν καὶ ἑκατοστὴν Ὀλυμπιάδα, ἤδη γέροντος ὄντος Ζήνωνος.",
    en: "Antigonus (Gonatas) also favoured him, and whenever he came to Athens would hear him lecture and often invited him to come to his court. This offer he declined but dispatched thither one of his friends, Persaeus, the son of Demetrius and a native of Citium, who flourished in the 130th Olympiad (260-256 b.c.), at which time Zeno was already an old man.",
    ref: "7.6",
    involves: "Antigonus",
    certainty: "asserted",
    note: "The exchange of letters - Antigonus' invitation and Zeno's refusal on the ground of his eighty years - is quoted at 7.7-9 and curated in the epistles layer.",
  },
  {
    id: "zeno-of-citium-inscription",
    philosopher: "Zeno of Citium",
    topic: "legacy",
    gloss:
      "Contributing to the restoration of the baths, and finding his name inscribed simply as 'Zeno the philosopher', he asks that 'of Citium' be added - never denying his Phoenician city.",
    grc:
      "Φησὶ δʼ Ἀντίγονος ὁ Καρύστιος οὐκ ἀρνεῖσθαι αὐτὸν εἶναι Κιτιέα. τῶν γὰρ εἰς τὴν ἐπισκευὴν τοῦ λουτρῶνος συμβαλλομένων εἷς ὢν καὶ ἀναγραφόμενος ἐν τῇ στήλῃ, Ζήνωνος τοῦ φιλοσόφου, ἠξίωσε καὶ τὸ Κιτιεύς προστεθῆναι.",
    en: "Antigonus of Carystus tells us that he never denied that he was a citizen of Citium. For when he was one of those who contributed to the restoration of the baths and his name was inscribed upon the pillar as Zeno the philosopher, he requested that the words of Citium should be added.",
    ref: "7.12",
    certainty: "reported",
    accordingTo: "Antigonus of Carystus",
  },
  {
    id: "zeno-hollow-flask-lid",
    philosopher: "Zeno of Citium",
    topic: "eccentricity",
    gloss:
      "Zeno makes a hollow lid for a flask and carries money hidden in it - so that provision is always at hand for the necessities of his master Crates.",
    grc:
      "ποιήσας δέ ποτε κοῖλον ἐπίθημα τῇ ληκύθῳ περιέφερε νόμισμα, λύσιν ἕτοιμον τῶν ἀναγκαίων ἵνʼ ἔχοι Κράτης ὁ διδάσκαλος.",
    en: "He made a hollow lid for a flask and used to carry about money in it, in order that there might be provision at hand for the necessities of his master Crates.",
    ref: "7.12",
    involves: "Crates",
    certainty: "asserted",
  },
  {
    id: "zeno-flute-girl",
    philosopher: "Zeno of Citium",
    topic: "asceticism",
    gloss:
      "Sharing a house with Persaeus, Zeno wastes no time when the latter brings in a little flute-player - leading her straight back to Persaeus.",
    grc:
      "σύν τε Περσαίῳ τὴν αὐτὴν οἰκίαν ᾤκει· καὶ αὐτοῦ αὐλητρίδιον εἰσαγαγόντος πρὸς αὐτόν, σπάσας πρὸς τὸν Περσαῖον αὐτὸ ἀπήγαγεν.",
    en: "He shared the same house with Persaeus, and when the latter brought in a little flute-player he lost no time in leading her straight to Persaeus.",
    ref: "7.13",
    involves: "Persaeus",
    certainty: "asserted",
  },
  {
    id: "zeno-slips-the-revellers",
    philosopher: "Zeno of Citium",
    topic: "asceticism",
    gloss:
      "King Antigonus breaks in on Zeno with noisy parties and once drags him off among the revellers to Aristocles the musician - but Zeno, in a little while, gives them the slip.",
    grc:
      "ἦν τε, φασίν, εὐσυμπερίφορος, ὡς πολλάκις Ἀντίγονον τὸν βασιλέα ἐπικωμάσαι αὐτῷ καὶ πρὸς Ἀριστοκλέα τὸν κιθαρῳδὸν ἅμʼ αὐτῷ ἐλθεῖν ἐπὶ κῶμον, εἶτα μέντοι ὑποδῦναι.",
    en: "They tell us he readily adapted himself to circumstances, so much so that King Antigonus often broke in on him with a noisy party, and once took him along with other revellers to Aristocles the musician; Zeno, however, in a little while gave them the slip.",
    ref: "7.13",
    involves: "Antigonus",
    certainty: "reported",
  },
  {
    id: "zeno-asks-for-coppers",
    philosopher: "Zeno of Citium",
    topic: "eccentricity",
    gloss:
      "Disliking crowds, Zeno occasionally asks the bystanders for coppers - so that fear of being asked to give keeps people from mobbing him.",
    grc:
      "ἐνίοτε δὲ καὶ χαλκὸν εἰσέπραττε τοὺς περιισταμένους, 〈ὥστε δεδιότασ〉 τὸ διδόναι μὴ ἐνοχλεῖν, καθά φησι Κλεάνθης ἐν τῷ Περὶ χαλκοῦ·",
    en: "He would occasionally ask the bystanders for coppers, in order that, for fear of being asked to give, people might desist from mobbing him, as Cleanthes says in his work On Bronze.",
    ref: "7.14",
    certainty: "reported",
    note: "Told by Cleanthes in his work On Bronze; the attribution stays in this note because Cleanthes is a philosopher node, not a claim source.",
  },
  {
    id: "zeno-drops-demochares",
    philosopher: "Zeno of Citium",
    topic: "defiance",
    gloss:
      "When Demochares offers to obtain anything Zeno wants from Antigonus by a word or a letter, Zeno will have nothing more to do with him.",
    grc:
      "Δημοχάρους δὲ τοῦ Λάχητος ἀσπαζομένου αὐτὸν καὶ φάσκοντος λέγειν καὶ γράφειν ὧν ἂν χρείαν ἔχῃ πρὸς Ἀντίγονον, ὡς ἐκείνου πάντα παρέξοντος, ἀκούσας οὐκέτʼ αὐτῷ συνδιέτριψε.",
    en: "When Demochares, the son of Laches, greeted him and told him he had only to speak or write for anything he wanted to Antigonus, who would be sure to grant all his requests, Zeno after hearing this would have nothing more to do with him.",
    ref: "7.14",
    involves: "Antigonus",
    certainty: "asserted",
  },
  {
    id: "zeno-what-an-audience",
    philosopher: "Zeno of Citium",
    topic: "legacy",
    gloss:
      "After Zeno's death Antigonus exclaims, 'What an audience I have lost' - and, asked why he admired him, answers that his many ample gifts never made Zeno conceited nor poor-spirited.",
    grc:
      "λέγεται δὲ καὶ μετὰ τὴν τελευτὴν τοῦ Ζήνωνος εἰπεῖν τὸν Ἀντίγονον, οἷον εἴη θέατρον ἀπολωλεκώς· ὅθεν καὶ διὰ Θράσωνος πρεσβευτοῦ παρὰ τῶν Ἀθηναίων ᾔτησεν αὐτῷ τὴν ἐν Κεραμεικῷ ταφήν. ἐρωτηθεὶς δὲ διὰ τί θαυμάζει αὐτόν, ὅτι, ἔφη, πολλῶν καὶ μεγάλων αὐτῷ διδομένων ὑπʼ ἐμοῦ οὐδέποτʼ ἐχαυνώθη οὐδὲ ταπεινὸς ὤφθη.",
    en: "After Zeno’s death Antigonus is reported to have said, What an audience I have lost. Hence too he employed Thraso as his agent to request the Athenians to bury Zeno in the Ceramicus. And when asked why he admired him, Because, said he, the many ample gifts I offered him never made him conceited nor yet appear poor-spirited.",
    ref: "7.15",
    involves: "Antigonus",
    certainty: "reported",
  },
  {
    id: "zeno-rhodian-on-dusty-benches",
    philosopher: "Zeno of Citium",
    topic: "teaching",
    gloss:
      "A handsome rich Rhodian - and nothing more - insists on joining the class; Zeno seats him first on the dusty benches, then among the beggars' rags, until the young man goes away.",
    grc:
      "Ῥοδίου δέ τινος καλοῦ καὶ πλουσίου, ἄλλως δὲ μηδέν, προσκειμένου αὐτῷ, μὴ βουλόμενος ἀνέχεσθαι, πρῶτον μὲν ἐπὶ τὰ κεκονιμένα τῶν βάθρων ἐκάθιζεν αὐτόν, ἵνα μολύνῃ τὴν χλανίδα· ἔπειτα εἰς τὸν τῶν πτωχῶν τόπον, ὥστε συνανατρίβεσθαι τοῖς ῥάκεσιν αὐτῶν· καὶ τέλος ἀπῆλθεν ὁ νεανίσκος.",
    en: "A Rhodian, who was handsome and rich, but nothing more, insisted on joining his class; but so unwelcome was this pupil, that first of all Zeno made him sit on the benches that were dusty, that he might soil his cloak, and then he consigned him to the place where the beggars sat, that he might rub shoulders with their rags; so at last the young man went away.",
    ref: "7.22",
    certainty: "asserted",
  },
  {
    id: "zeno-pays-double-for-the-reaper",
    philosopher: "Zeno of Citium",
    topic: "training",
    gloss:
      "Shown seven logical forms of the sophism called The Reaper and asked a hundred drachmas for them, Zeno promptly pays two hundred - such is his love of learning.",
    grc:
      "καὶ πρὸς τὸν δείξαντα δʼ αὐτῷ διαλεκτικὸν ἐν τῷ θερίζοντι λόγῳ ἑπτὰ διαλεκτικὰς ἰδέας πυθέσθαι, πόσας εἰσπράττεται μισθοῦ· ἀκούσαντα δὲ ἑκατόν, διακοσίας αὐτῷ δοῦναι. τοσοῦτον ἤσκει φιλομάθειαν.",
    en: "A dialectician once showed him seven logical forms concerned with the sophism known as The Reaper, and Zeno asked him how much he wanted for them. Being told a hundred drachmas, he promptly paid two hundred: to such lengths would he go in his love of learning.",
    ref: "7.25",
    certainty: "asserted",
  },
  {
    id: "zeno-garden-door",
    philosopher: "Zeno of Citium",
    topic: "encounter",
    gloss:
      "Still attending Polemo's school though already making progress, Zeno is called out by the master: 'You slip in, Zeno, by the garden door - you filch my doctrines and give them a Phoenician make-up.'",
    grc:
      "Συνδιέτριψε δὲ καὶ Διοδώρῳ, καθά φησιν Ἱππόβοτος· παρʼ ᾧ καὶ τὰ διαλεκτικὰ ἐξεπόνησεν. ἤδη δὲ προκόπτων εἰσῄει καὶ πρὸς Πολέμωνα ὑπʼ ἀτυφίας, ὥστε φασὶ λέγειν ἐκεῖνον, οὐ λανθάνεις, ὦ Ζήνων, ταῖς κηπαίαις παρεισρέων θύραις καὶ τὰ δόγματα κλέπτων Φοινικικῶς μεταμφιεννύς.",
    en: "According to Hippobotus he forgathered with Diodorus, with whom he worked hard at dialectic. And when he was already making progress, he would enter Polemo’s school: so far from all selfconceit was he. In consequence Polemo is said to have addressed him thus: You slip in, Zeno, by the garden door—I’m quite aware of it—you filch my doctrines and give them a Phoenician make-up.",
    ref: "7.25",
    involves: "Polemo",
    certainty: "reported",
    accordingTo: "Hippobotus",
  },
  {
    id: "zeno-holds-his-breath",
    philosopher: "Zeno of Citium",
    topic: "death",
    gloss:
      "Leaving the school at ninety-eight, Zeno trips and breaks a toe; striking the ground with his fist he quotes the Niobe - 'I come, I come, why dost thou call for me?' - and dies on the spot through holding his breath.",
    grc:
      "ἐτελεύτα δὴ οὕτως· ἐκ τῆς σχολῆς ἀπιὼν προσέπταισε καὶ τὸν δάκτυλον περιέρρηξε· παίσας δὲ τὴν γῆν τῇ χειρί, φησὶ τὸ ἐκ τῆς Νιόβης, ἔρχομαι· τί μʼ αὔεις; καὶ παραχρῆμα ἐτελεύτησεν, ἀποπνίξας ἑαυτόν.",
    en: "The manner of his death was as follows. As he was leaving the school he tripped and fell, breaking a toe. Striking the ground with his fist, he quoted the line from the Niobe : I come, I come, why dost thou call for me? and died on the spot through holding his breath.",
    ref: "7.28",
    certainty: "asserted",
    note: "D.L.'s Pammetros records a rival version: that he was set free by ceasing to take food (7.31).",
  },
  // --- Ariston of Chios ---
  {
    id: "ariston-refuted-by-twins",
    philosopher: "Ariston of Chios",
    topic: "encounter",
    gloss:
      "To explode Ariston's doctrine that the wise man never holds mere opinion, Persaeus has one of a pair of twins deposit money with him - and the other twin reclaim it.",
    grc:
      "πρὸς ὃ Περσαῖος ἐναντιούμενος διδύμων ἀδελφῶν τὸν ἕτερον ἐποίησεν αὐτῷ παρακαταθήκην δοῦναι, ἔπειτα τὸν ἕτερον ἀπολαβεῖν· καὶ οὕτως ἀπορούμενον διήλεγξεν.",
    en: "And against this doctrine Persaeus was contending when he induced one of a pair of twins to deposit a certain sum with Ariston and afterwards got the other to reclaim it. Ariston being thus reduced to perplexity was refuted.",
    ref: "7.162",
    involves: "Persaeus",
    certainty: "asserted",
  },
  {
    id: "ariston-bull-with-a-uterus",
    philosopher: "Ariston of Chios",
    topic: "wit",
    gloss:
      "Seeing an abortion in the shape of a bull with a uterus, Ariston sighs that Arcesilaus has been handed an argument against the evidence of the senses.",
    grc:
      "ἀπετείνετο δὲ πρὸς Ἀρκεσίλαον· ὅτε θεασάμενος ταῦρον τερατώδη μήτραν ἔχοντα, οἴμοι, ἔφη, δέδοται Ἀρκεσιλάῳ ἐπιχείρημα κατὰ τῆς ἐναργείας.",
    en: "He was at variance with Arcesilaus; and one day when he saw an abortion in the shape of a bull with a uterus, he said, Alas, here Arcesilaus has had given into his hand an argument against the evidence of the senses.",
    ref: "7.162",
    involves: "Arcesilaus",
    certainty: "asserted",
  },
  {
    id: "ariston-bald-sunstroke",
    philosopher: "Ariston of Chios",
    topic: "death",
    gloss:
      "Being bald, Ariston takes a sunstroke and so comes to his end - earning D.L.'s limping iambics on seeking warmth more than was reasonable.",
    grc:
      "Τοῦτον λόγος φαλακρὸν ὄντα ἐγκαυθῆναι ὑπὸ ἡλίου καὶ ὧδε τελευτῆσαι.",
    en: "The story goes that being bald he had a sunstroke and so came to his end.",
    ref: "7.164",
    certainty: "reported",
  },
  // --- Herillus ---
  {
    id: "herillus-head-shaved",
    philosopher: "Herillus",
    topic: "training",
    gloss:
      "Beset by many admirers as a boy, Herillus is compelled by Zeno to have his head shaved - which disgusts them away.",
    grc:
      "Λέγεται δʼ ὅτι παιδὸς ὄντος αὐτοῦ ἠράσθησαν ἱκανοί, οὓς ἀποτρέψαι βουλόμενος ὁ Ζήνων ἠνάγκασε ξυρᾶσθαι Ἥριλλον, οἱ δʼ ἀπετράποντο.",
    en: "He is said to have had many admirers when a boy; and as Zeno wished to drive them away, he compelled Herillus to have his head shaved, which disgusted them.",
    ref: "7.166",
    involves: "Zeno",
    certainty: "reported",
  },
  // --- Dionysius the Renegade ---
  {
    id: "dionysius-falls-away-to-pleasure",
    philosopher: "Dionysius the Renegade",
    topic: "conversion",
    gloss:
      "Falling away from Zeno, Dionysius goes over to the Cyrenaics, frequenting houses of ill fame without disguise - and at nearly eighty starves himself to death.",
    grc:
      "ἀποστὰς δὲ τοῦ Ζήνωνος πρὸς τοὺς Κυρηναϊκοὺς ἀπετράπη καὶ εἴς τε τὰ χαμαιτυπεῖα εἰσῄει καὶ τἄλλʼ ἀπαρακαλύπτως ἡδυπάθει. βιοὺς δὲ πρὸς τὰ ὀγδοήκοντʼ ἀσιτίᾳ κατέστρεψε.",
    en: "When he fell away from Zeno, he went over to the Cyrenaics, and used to frequent houses of ill fame and indulge in all other excesses without disguise. After living till he was nearly eighty years of age, he committed suicide by starving himself.",
    ref: "7.167",
    involves: "Zeno",
    certainty: "asserted",
    note: "The motive is at 7.166: an attack of ophthalmia so violent that he could no longer bring himself to call pain a thing indifferent - whence he declared pleasure the end of action and earned the name Renegade.",
  },
  // --- Cleanthes ---
  {
    id: "cleanthes-the-well-lifter",
    philosopher: "Cleanthes",
    topic: "asceticism",
    gloss:
      "Arriving in Athens with four drachmas, the ex-pugilist Cleanthes draws garden water by night and works at arguments by day - earning the nickname Phreantles, the Well-lifter.",
    grc:
      "ἀφικόμενος δʼ εἰς Ἀθήνας τέσσαρας ἔχων δραχμάς, καθά φασί τινες, καὶ Ζήνωνι παραβαλὼν ἐφιλοσόφησε γενναιότατα καὶ ἐπὶ τῶν αὐτῶν ἔμεινε δογμάτων. διεβοήθη δʼ ἐπὶ φιλοπονίᾳ, ὅς γε πένης ὢν ἄγαν ὥρμησε μισθοφορεῖν· καὶ νύκτωρ μὲν ἐν τοῖς κήποις ἤντλει, μεθʼ ἡμέραν δʼ ἐν τοῖς λόγοις ἐγυμνάζετο· ὅθεν καὶ Φρεάντλης ἐκλήθη.",
    en: "He arrived in Athens, as some people say, with four drachmas only, and meeting with Zeno he studied philosophy right nobly and adhered to the same doctrines throughout. He was renowned for his industry, being indeed driven by extreme poverty to work for a living. Thus, while by night he used to draw water in gardens, by day he exercised himself in arguments: hence the nickname Phreantles or Welllifter was given him.",
    ref: "7.168",
    involves: "Zeno",
    certainty: "reported",
    note: "Antisthenes of Rhodes tells in his Successions that he had first been a pugilist (7.168); the attribution stays in this note to avoid conflation with the Cynic Antisthenes.",
  },
  {
    id: "cleanthes-acquitted-by-witnesses",
    philosopher: "Cleanthes",
    topic: "asceticism",
    gloss:
      "Summoned to court to explain how so sturdy a fellow makes his living, Cleanthes produces the gardener and the meal-woman as witnesses - the Areopagites vote him ten minas, and Zeno forbids him to accept.",
    grc:
      "καὶ τὴν ἀλφιτόπωλιν παρʼ ᾗ τἄλφιτα ἔπεττεν. ἀποδεξαμένους δʼ αὐτὸν τοὺς Ἀρεοπαγίτας ψηφίσασθαι δέκα μνᾶς δοθῆναι, Ζήνωνα δὲ κωλῦσαι λαβεῖν.",
    en: "and then to have been acquitted on producing as his witnesses the gardener in whose garden he drew water and the woman who sold the meal which he used to crush. The Areopagites were satisfied and voted him a donation of ten minas, which Zeno forbade him to accept.",
    ref: "7.169",
    involves: "Zeno",
    certainty: "reported",
  },
  {
    id: "cleanthes-cloak-blown-aside",
    philosopher: "Cleanthes",
    topic: "asceticism",
    gloss:
      "Conducting some youths to a public spectacle, Cleanthes has his cloak blown aside - revealing that he wears no shirt, whereupon the Athenians applaud him.",
    grc:
      "ἡγούμενόν τε τῶν ἐφήβων ἐπί τινα θέαν ὑπʼ ἀνέμου παραγυμνωθῆναι καὶ ὀφθῆναι ἀχίτωνα· ἐφʼ ᾧ κρότῳ τιμηθῆναι ὑπʼ Ἀθηναίων, καθά φησι Δημήτριος ὁ Μάγνης ἐν τοῖς Ὁμωνύμοις.",
    en: "Once, as he was conducting some youths to a public spectacle, the wind blew his cloak aside and disclosed the fact that he wore no shirt, whereupon he was applauded by the Athenians, as is stated by Demetrius of Magnesia in his work on Men of the Same Name.",
    ref: "7.169",
    certainty: "reported",
    note: "Told by Demetrius of Magnesia (cited only here; no source node).",
  },
  {
    id: "cleanthes-is-drawing-water-all-i-do",
    philosopher: "Cleanthes",
    topic: "asceticism",
    gloss:
      "Antigonus, attending his lectures, asks why he draws water - 'Is drawing water all I do? Do I not dig? Do I not water the garden, or undertake any other labour for the love of philosophy?' For Zeno disciplined him to it, and bade him hand over an obol from his wages.",
    grc:
      "φασὶ δὲ καὶ Ἀντίγονον αὐτοῦ πυθέσθαι ὄντα ἀκροατήν, διὰ τί ἀντλεῖ· τὸν δʼ εἰπεῖν, ἀντλῶ γὰρ μόνον; τίδʼ ; οὐχὶ σκάπτω ; τίδʼ ; οὐκ ἄρδω καὶ πάντα ποιῶ φιλοσοφίας ἕνεκα; καὶ γὰρ ὁ Ζήνων αὐτὸν συνεγύμναζεν εἰς τοῦτο καὶ ἐκέλευεν ὀβολὸν φέρειν ἀποφορᾶς.",
    en: "There is another story that Antigonus when attending his lectures inquired of him why he drew water and received the reply, Is drawing water all I do? What? Do I not dig? What? Do I not water the garden? or undertake any other labour for the love of philosophy? For Zeno used to discipline him to this and bid him return him an obol from his wages.",
    ref: "7.169",
    involves: "Antigonus",
    certainty: "reported",
  },
  {
    id: "cleanthes-unmoved-in-the-theatre",
    philosopher: "Cleanthes",
    topic: "training",
    gloss:
      "Mocked from the stage by the poet Sositheus, Cleanthes sits unmoved - the audience applauds him and drives the poet off; and when Sositheus apologizes, he accepts: if Dionysus and Heracles bear the poets' ridicule, why should he mind casual abuse?",
    grc:
      "Σωσιθέου τοῦ ποιητοῦ ἐν θεάτρῳ εἰπόντος πρὸς αὐτὸν παρόντα, οὓς ἡ Κλεάνθους μωρία βοηλατεῖ, ἔμεινεν ἐπὶ ταὐτοῦ σχήματος· ἐφʼ ᾧ ἀγασθέντες οἱ ἀκροαταὶ τὸν μὲν ἐκρότησαν, τὸν δὲ Σωσίθεον ἐξέβαλον. μεταγινώσκοντα δʼ αὐτὸν ἐπὶ τῇ λοιδορίᾳ προσήκατο, εἰπὼν ἄτοπον εἶναι τὸν μὲν Διόνυσον καὶ τὸν Ἡρακλέα φλυαρουμένους ὑπὸ τῶν ποιητῶν μὴ ὀργίζεσθαι, αὐτὸν δʼ ἐπὶ τῇ τυχούσῃ βλασφημίᾳ δυσχεραίνειν.",
    en: "He was present in the theatre when the poet Sositheus uttered the verse— Driven by Cleanthes’ folly like dumb herds, and he remained unmoved in the same attitude. At which the audience were so astonished that they applauded him and drove Sositheus off the stage. Afterwards when the poet apologized for the insult, he accepted the apology, saying that, when Dionysus and Heracles were ridiculed by the poets without getting angry, it would be absurd for him to be annoyed at casual abuse.",
    ref: "7.173",
    certainty: "asserted",
    framesSaying: "cleanthes-dionysus-heracles-abuse",
  },
  {
    id: "cleanthes-oyster-shells",
    philosopher: "Cleanthes",
    topic: "asceticism",
    gloss:
      "Too poor to buy paper, Cleanthes writes down Zeno's lectures on oyster-shells and the blade-bones of oxen - and yet succeeds him at the head of the school over many eminent disciples.",
    grc:
      "τοῦτόν φασιν εἰς ὄστρακα καὶ βοῶν ὠμοπλάτας γράφειν ἅπερ ἤκουε παρὰ τοῦ Ζήνωνος, ἀπορίᾳ κερμάτων ὥστε ὠνήσασθαι χαρτία. τοιοῦτος δʼ ὢν ἐξίσχυσε, πολλῶν καὶ ἄλλων ὄντων ἀξιολόγων Ζήνωνος μαθητῶν, αὐτὸς διαδέξασθαι τὴν σχολήν.",
    en: "We are told that he wrote down Zeno’s lectures on oyster-shells and the blade-bones of oxen through lack of money to buy paper. Such was he; and yet, although Zeno had many other eminent disciples, he was able to succeed him in the headship of the school.",
    ref: "7.174",
    involves: "Zeno",
    certainty: "reported",
  },
  {
    id: "cleanthes-too-far-on-the-road",
    philosopher: "Cleanthes",
    topic: "death",
    gloss:
      "Ordered by his doctors to fast two days for an ulcered gum, Cleanthes recovers - but refuses to resume eating, declaring himself already too far on the road, and fasts on to his death.",
    grc:
      "Καὶ τελευτᾷ τόνδε τὸν τρόπον· διῴδησεν αὐτῷ τὸ οὖλον· ἀπαγορευσάντων δὲ τῶν ἰατρῶν, δύο ἡμέρας ἀπέσχετο τροφῆς. καί πως ἔσχε καλῶς ὥστε τοὺς ἰατροὺς αὐτῷ πάντα τὰ συνήθη συγχωρεῖν· τὸν δὲ μὴ ἀνασχέσθαι, ἀλλʼ εἰπόντα ἤδη αὐτῷ προωδοιπορῆσθαι καὶ τὰς λοιπὰς ἀποσχόμενον τελευτῆσαι ταὐτὰ Ζήνωνι, καθά φασί τινες, [ὀγδοήκοντα] ἔτη βιώσαντα καὶ ἀκούσαντα Ζήνωνος ἔτη ἐννεακαίδεκα.",
    en: "His end was as follows. He had severe inflammation of the gums, and by the advice of his doctors he abstained from food for two whole days. As it happened, this treatment succeeded, so that the doctors were for allowing him to resume his usual diet. To this, however, he would not consent, but declaring that he had already got too far on the road, he went on fasting the rest of his days until his death at the same age as Zeno according to some authorities, having spent nineteen years as Zeno’s pupil.",
    ref: "7.176",
    certainty: "asserted",
  },
  // --- Sphaerus ---
  {
    id: "sphaerus-waxen-pomegranates",
    philosopher: "Sphaerus",
    topic: "wit",
    gloss:
      "King Ptolemy sets waxen pomegranates before Sphaerus to refute his doctrine that the wise man never opines; taken in, Sphaerus parries: he assented not to their being pomegranates, but to there being good grounds for thinking so.",
    grc:
      "λόγου δέ ποτε γενομένου περὶ τοῦ δοξάσειν τὸν σοφὸν καὶ τοῦ Σφαίρου εἰπόντος ὡς οὐ δοξάσει, βουλόμενος ὁ βασιλεὺς ἐλέγξαι αὐτόν, κηρίνας ῥόας ἐκέλευσε παρατεθῆναι· τοῦ δὲ Σφαίρου ἀπατηθέντος ἀνεβόησεν ὁ βασιλεὺς ψευδεῖ συγκατατεθεῖσθαι αὐτὸν φαντασίᾳ. πρὸς ὃν ὁ Σφαῖρος εὐστόχως ἀπεκρίνατο, εἰπὼν οὕτως συγκατατεθεῖσθαι, οὐχ ὅτι ῥόαι εἰσίν, ἀλλʼ ὅτι εὔλογόν ἐστι ῥόας αὐτὰς εἶναι· διαφέρειν δὲ τὴν καταληπτικὴν φαντασίαν τοῦ εὐλόγου.",
    en: "One day when a discussion had arisen on the question whether the wise man could stoop to hold opinion, and Sphaerus had maintained that this was impossible, the king, wishing to refute him, ordered some waxen pomegranates to be put on the table. Sphaerus was taken in and the king cried out, You have given your assent to a presentation which is false. But Sphaerus was ready with a neat answer. I assented not to the proposition that they are pomegranates, but to another, that there are good grounds for thinking them to be pomegranates. Certainty of presentation and reasonable probability are two totally different things.",
    ref: "7.177",
    involves: "Ptolemy",
    certainty: "asserted",
  },
  // --- Chrysippus ---
  {
    id: "chrysippus-remorse-toward-cleanthes",
    philosopher: "Chrysippus",
    topic: "encounter",
    gloss:
      "Whenever he has contended against his teacher Cleanthes, Chrysippus feels remorse afterwards - constantly quoting: 'Blest in all else am I, save only where I touch Cleanthes: there I am ill-fortuned.'",
    grc:
      "μετενόει μέντοι ὁπότε πρὸς αὐτὸν ἀποτείνοιτο, ὥστε συνεχὲς προφέρεσθαι ταῦτα· ἐγὼ δὲ τἄλλα μακάριος πέφυκʼ ἀνὴρ πλὴν εἰς Κλεάνθην· τοῦτο δʼ οὐκ εὐδαιμονῶ.",
    en: "Nevertheless, whenever he had contended against Cleanthes, he would afterwards feel remorse, so that he constantly came out with the lines : Blest in all else am I, save only where I touch Cleanthes: there I am ill-fortuned.",
    ref: "7.179",
    involves: "Cleanthes",
    certainty: "asserted",
  },
  {
    id: "chrysippus-medea-of-chrysippus",
    philosopher: "Chrysippus",
    topic: "eccentricity",
    gloss:
      "So freely does Chrysippus quote that in one treatise he copies out nearly the whole of Euripides' Medea - and a reader, asked what he has in hand, answers: 'The Medea of Chrysippus.'",
    grc:
      "ὥστε καὶ ἐπειδή ποτʼ ἔν τινι τῶν συγγραμμάτων παρʼ ὀλίγον τὴν Εὐριπίδου Μήδειαν ὅλην παρετίθετο καί τις μετὰ χεῖρας εἶχε τὸ βιβλίον, πρὸς τὸν πυθόμενον τί ἄρα ἔχοι, ἔφη, Χρυσίππου Μήδειαν.",
    en: "So much so that in one of his treatises he copied out nearly the whole of Euripides’ Medea , and some one who had taken up the volume, being asked what he was reading, replied, The Medea of Chrysippus.",
    ref: "7.180",
    certainty: "asserted",
  },
  {
    id: "chrysippus-horse-hidden",
    philosopher: "Chrysippus",
    topic: "wit",
    gloss:
      "So insignificant in person is Chrysippus that his statue in the Ceramicus is almost hidden by a neighbouring equestrian statue - whence Carneades dubs him Crypsippus, Horse-hidden.",
    grc:
      "Ἦν δὲ καὶ τὸ σωμάτιον εὐτελής, ὡς δῆλον ἐκ τοῦ ἀνδριάντος τοῦ ἐν Κεραμεικῷ, ὃς σχεδόν τι ὑποκέκρυπται τῷ πλησίον ἱππεῖ· ὅθεν αὐτὸν ὁ Καρνεάδης Κρύψιππον ἔλεγεν.",
    en: "In person he was insignificant, as is shown by the statue in the Ceramicus, which is almost hidden by an equestrian statue hard by; and this is why Carneades called him Crypsippus or Horse-hidden.",
    ref: "7.182",
    involves: "Carneades",
    certainty: "asserted",
  },
  {
    id: "chrysippus-legs-get-tipsy",
    philosopher: "Chrysippus",
    topic: "eccentricity",
    gloss:
      "At wine-parties Chrysippus behaves quietly though unsteady on his legs - causing the woman-slave to say that only his legs get tipsy.",
    grc:
      "Ἐν μέντοι ταῖς οἰνώσεσιν ἡσύχαζε παραφε· ρόμενος τοῖς σκέλεσιν, ὥστʼ εἰπεῖν τὴν δούλην, Χρυσίππου μόνα τὰ σκέλη μεθύει.",
    en: "At wine-parties he used to behave quietly, though he was unsteady on his legs; which caused the woman-slave to say, As for Chrysippus, only his legs get tipsy.",
    ref: "7.183",
    certainty: "asserted",
  },
  {
    id: "chrysippus-declines-ptolemys-court",
    philosopher: "Chrysippus",
    topic: "defiance",
    gloss:
      "When Ptolemy writes asking Cleanthes to come or send someone to his court, Sphaerus undertakes the journey - while Chrysippus declines to go, and of all his many writings dedicates none to any king.",
    grc:
      "Πτολεμαίου τε πρὸς Κλεάνθην ἐπιστείλαντος ἢ αὐτὸν ἐλθεῖν ἢ πέμψαι τινά, Σφαῖρος μὲν ἀπῆλθε, Χρύσιππος δὲ περιεῖδε.",
    en: "When Ptolemy wrote to Cleanthes requesting him to come himself or else to send some one to his court, Sphaerus undertook the journey, while Chrysippus declined to go.",
    ref: "7.185",
    involves: "Ptolemy",
    certainty: "asserted",
  },
  {
    id: "chrysippus-draught-of-sweet-wine",
    philosopher: "Chrysippus",
    topic: "death",
    gloss:
      "Invited by his pupils to a sacrificial feast, Chrysippus takes a draught of sweet unmixed wine, is seized with dizziness, and departs this life five days later at seventy-three.",
    grc:
      "Τοῦτον ἐν τῷ ᾨδείῳ σχολάζοντά φησιν Ἕρμιππος ἐπὶ θυσίαν ὑπὸ τῶν μαθητῶν κληθῆναι· ἔνθα προσενεγκάμενον γλυκὺν ἄκρατον καὶ ἰλιγγιάσαντα πεμπταῖον ἀπελθεῖν ἐξ ἀνθρώπων, τρία καὶ ἑβδομήκοντα βιώσαντʼ ἔτη, κατὰ τὴν τρίτην καὶ τετταρακοστὴν καὶ ἑκατοστὴν Ὀλυμπιάδα",
    en: "On one occasion, as Hermippus relates, when he had his school in the Odeum, he was invited by his pupils to a sacrificial feast. There after he had taken a draught of sweet wine unmixed with water, he was seized with dizziness and departed this life five days afterwards, having reached the age of seventy-three years, in the 143rd Olympiad.",
    ref: "7.184",
    certainty: "reported",
    accordingTo: "Hermippus",
  },
  {
    id: "chrysippus-dies-of-laughter",
    philosopher: "Chrysippus",
    topic: "death",
    gloss:
      "By another account, an ass eats up his figs; Chrysippus cries to the old woman to give the beast pure wine to wash them down - and laughs so heartily that he dies.",
    grc:
      "Ἔνιοι δέ φασι γέλωτι συσχεθέντα αὐτὸν τελευτῆσαι· ὄνου γὰρ τὰ σῦκα αὐτῷ φαγόντος, εἰπόντα τῇ γραῒ διδόναι ἄκρατον ἐπιρροφῆσαι τῷ ὄνῳ, ὑπερκαγχάσαντα τελευτῆσαι.",
    en: "Another account is that his death was caused by a violent fit of laughter; for after an ass had eaten up his figs, he cried out to the old woman, Now give the ass a drink of pure wine to wash down the figs. And thereupon he laughed so heartily that he died.",
    ref: "7.185",
    certainty: "disputed",
    framesSaying: "chrysippus-ass-drink-wine",
    note: "A rival to Hermippus' sweet-wine account (7.184).",
  },
];
