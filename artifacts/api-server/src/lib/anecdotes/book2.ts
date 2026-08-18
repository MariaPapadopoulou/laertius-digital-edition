/**
 * Book 2 anecdotes - the Ionians and Socratics: Anaxagoras, Socrates,
 * Xenophon, Aeschines, Aristippus, Phaedo, Euclides, Stilpo, Simon, and
 * Menedemus of Eretria. Narrated incidents only; bare dicta live in the
 * sayings layer (see the overlap policy in anecdotes.ts). Every `en` is a
 * verbatim Hicks excerpt of the cited section, enforced by
 * validate-anecdotes.
 *
 * Curation notes: Anaximander, Anaximenes, Archelaus, Crito, Glaucon,
 * Simmias and Cebes have no narrated incident in their chapters (doctrine,
 * book lists and letters only). The Alexinus reed-death (2.109-110) and
 * Diodorus Cronus at Ptolemy's court (2.111-112) are told inside Euclides'
 * chapter about men who are not corpus philosophers, so they cannot carry a
 * philosopher link and are deliberately not curated. Simon's refusal of
 * Pericles (2.123) is not re-curated: its whole substance is the curated
 * saying simon-free-speech. Socrates' ransom of Phaedo is curated once,
 * under Phaedo (2.105), where the fuller narrative lives; the 2.31 notice
 * is the same incident. The trial authorities Aristippus (On the Luxury of
 * the Ancients, 2.23) and Xenophon (Symposium, 2.32) are philosophers who
 * are not otherwise claim/saying sources, so they stay in notes rather than
 * accordingTo (no source double node is minted for one citation each).
 * Menedemus' conversion at the Academy (2.125) is deliberately not curated:
 * the Hicks key 2.125 is ambiguous (Cebes' single section 2.16.125 shadows
 * Menedemus' 2.17.125 in first-match resolution), so the citation would
 * resolve to the wrong section.
 */
import type { Anecdote } from "../anecdotes";

export const BOOK2_ANECDOTES: Anecdote[] = [
  // --- Anaxagoras ---
  {
    id: "anaxagoras-gives-up-patrimony",
    philosopher: "Anaxagoras",
    topic: "conversion",
    gloss:
      "Born to wealth and noble family, Anaxagoras hands his patrimony over to his relations and withdraws into physical inquiry.",
    grc:
      "Οὗτος εὐγενείᾳ καὶ πλούτῳ διαφέρων ἦν, ἀλλὰ καὶ μεγαλοφροσύνῃ, ὅς γε τὰ πατρῷα παρεχώρησε τοῖς οἰκείοις.",
    en: "He was eminent for wealth and noble birth, and furthermore for magnanimity, in that he gave up his patrimony to his relations.",
    ref: "2.6",
    certainty: "asserted",
    note: "The sequel at 2.7 - accused of neglecting the estate, he answers Why then do you not look after it? and retires into physical investigation - is the curated saying anaxagoras-look-after-it.",
  },
  {
    id: "anaxagoras-meteor-prediction",
    philosopher: "Anaxagoras",
    topic: "eccentricity",
    gloss:
      "He is said to have predicted the fall of the meteoric stone at Aegospotami, which he declared would fall from the sun.",
    grc:
      "Φασὶ δʼ αὐτὸν προειπεῖν τὴν περὶ Αἰγὸς ποταμοὺς γενομένην τοῦ λίθου πτῶσιν, ὃν εἶπεν ἐκ τοῦ ἡλίου πεσεῖσθαι.",
    en: "There is a story that he predicted the fall of the meteoric stone at Aegospotami, which he said would fall from the sun.",
    ref: "2.10",
    certainty: "reported",
  },
  {
    id: "anaxagoras-olympia-sheepskin",
    philosopher: "Anaxagoras",
    topic: "eccentricity",
    gloss:
      "At Olympia he sits down wrapped in a sheep-skin cloak as if rain were coming - and the rain comes.",
    grc:
      "ἀλλὰ καὶ εἰς Ὀλυμπίαν ἐλθόντα ἐν δερματίνῳ καθίσαι, ὡς μέλλοντος ὕσειν· καὶ γενέσθαι.",
    en: "Furthermore, when he went to Olympia, he sat down wrapped in a sheep-skin cloak as if it were going to rain; and the rain came.",
    ref: "2.10",
    certainty: "asserted",
  },
  {
    id: "anaxagoras-trial-accounts",
    philosopher: "Anaxagoras",
    topic: "piety",
    gloss:
      "Of his impiety trial rival accounts survive: Sotion has Cleon prosecute and Pericles win a fine and banishment; Satyrus has Thucydides prosecute for Medism as well, with a death sentence passed by default.",
    grc:
      "Περὶ δὲ τῆς δίκης αὐτοῦ διάφορα λέγεται. Σωτίων μὲν γάρ φησιν ἐν τῇ Διαδοχῇ τῶν φιλοσόφων ὑπὸ Κλέωνος αὐτὸν ἀσεβείας κριθῆναι, διότι τὸν ἥλιον μύδρον ἔλεγε διάπυρον· ἀπολογησαμένου δὲ ὑπὲρ αὐτοῦ Περικλέους τοῦ μαθητοῦ, πέντε ταλάντοις ζημιωθῆναι καὶ φυγαδευθῆναι. Σάτυρος δʼ ἐν τοῖς Βίοις ὑπὸ Θουκυδίδου φησὶν εἰσαχθῆναι τὴν δίκην, ἀντιπολιτευομένου τῷ Περικλεῖ· καὶ οὐ μόνον ἀσεβείας, ἀλλὰ καὶ μηδισμοῦ· καὶ ἀπόντα καταδικασθῆναι θανάτῳ.",
    en: "Of the trial of Anaxagoras different accounts are given. Sotion in his Succession of the Philosophers says that he was indicted by Cleon on a charge of impiety, because he declared the sun to be a mass of red-hot metal; that his pupil Pericles defended him, and he was fined five talents and banished. Satyrus in his Lives says that the prosecutor was Thucydides, the opponent of Pericles, and the charge one of treasonable correspondence with Persia as well as of impiety; and that sentence of death was passed on Anaxagoras by default.",
    ref: "2.12",
    involves: "Pericles",
    certainty: "disputed",
    note: "Both named accounts are quoted in the excerpt; D.L. sets Sotion's and Satyrus' versions side by side without deciding between them.",
  },
  {
    id: "anaxagoras-pericles-plea",
    philosopher: "Anaxagoras",
    topic: "death",
    gloss:
      "In Hermippus' version Pericles asks the assembly whether his own career gives any ground of complaint - then pleads for his teacher's release; freed, Anaxagoras cannot bear the indignity and takes his own life.",
    grc:
      "Ἕρμιππος δʼ ἐν τοῖς Βίοις φησὶν ὅτι καθείρχθη ἐν τῷ δεσμωτηρίῳ τεθνηξόμενος. Περικλῆς δὲ παρελθὼν εἶπεν εἴ τι ἔχουσιν ἐγκαλεῖν αὑτῷ κατὰ τὸν βίον· οὐδὲν δὲ εἰπόντων, καὶ μὴν ἐγώ, ἔφη, τούτου μαθητής εἰμι· μὴ οὖν διαβολαῖς ἐπαρθέντες ἀποκτείνητε τὸν ἄνθρωπον, ἀλλʼ ἐμοὶ πεισθέντες ἄφετε. καὶ ἀφείθη· οὐκ ἐνεγκὼν δὲ τὴν ὕβριν ἑαυτὸν ἐξήγαγεν.",
    en: "Hermippus in his Lives says that he was confined in the prison pending his execution; that Pericles came forward and asked the people whether they had any fault to find with him in his own public career; to which they replied that they had not. Well, he continued, I am a pupil of Anaxagoras; do not then be carried away by slanders and put him to death. Let me prevail upon you to release him. So he was released; but he could not brook the indignity he had suffered and committed suicide.",
    ref: "2.13",
    involves: "Pericles",
    certainty: "reported",
    accordingTo: "Hermippus",
    note: "Hieronymus of Rhodes (2.14) has yet another version: Pericles brought him into court so wasted by illness that he was acquitted out of sympathy.",
  },
  {
    id: "anaxagoras-lampsacus-holiday",
    philosopher: "Anaxagoras",
    topic: "legacy",
    gloss:
      "Asked by the magistrates of Lampsacus what should be done for him, the dying Anaxagoras requests an annual school holiday for the boys in the month of his death - a custom still kept in D.L.'s day.",
    grc:
      "καὶ τέλος ἀποχωρήσας εἰς Λάμψακον αὐτόθι κατέστρεψεν. ὅτε καὶ τῶν ἀρχόντων τῆς πόλεως ἀξιούντων τί βούλεται αὐτῷ γενέσθαι, φάναι, τοὺς παῖδας ἐν ᾧ ἂν ἀποθάνῃ μηνὶ κατʼ ἔτος παίζειν συγχωρεῖν. καὶ φυλάττεται τὸ ἔθος καὶ νῦν.",
    en: "At length he retired to Lampsacus and there died. And when the magistrates of the city asked if there was anything he would like done for him, he replied that he would like them to grant an annual holiday to the boys in the month in which he died; and the custom is kept up to this day.",
    ref: "2.14",
    certainty: "asserted",
    framesSaying: "anaxagoras-holiday-for-boys",
  },
  // --- Socrates ---
  {
    id: "socrates-crito-workshop",
    philosopher: "Socrates",
    topic: "conversion",
    gloss:
      "Struck by the beauty of his soul, Crito takes Socrates out of the stonemason's workshop and has him educated.",
    grc:
      "Κρίτωνα δʼ ἀναστῆσαι αὐτὸν ἀπὸ τοῦ ἐργαστηρίου καὶ παιδεῦσαι τῆς κατὰ ψυχὴν χάριτος ἐρασθέντα Δημήτριός φησιν ὁ Βυζάντιος.",
    en: "Demetrius of Byzantium relates that Crito removed him from his workshop and educated him, being struck by his beauty of soul;",
    ref: "2.20",
    involves: "Crito",
    certainty: "reported",
    accordingTo: "Demetrius of Byzantium",
  },
  {
    id: "socrates-endures-fists",
    philosopher: "Socrates",
    topic: "defiance",
    gloss:
      "Men set upon him with fists and tear his hair for his vehemence in argument, and he bears it all patiently - kicked, he asks whether he should sue a donkey.",
    grc:
      "πολλάκις δὲ βιαιότερον ἐν ταῖς ζητήσεσι διαλεγόμενον κονδυλίζεσθαι καὶ παρατίλλεσθαι, τὸ πλέον τε γελᾶσθαι καταφρονούμενον· καὶ πάντα ταῦτα φέρειν ἀνεξικάκως. ὅθεν καὶ λακτισθέντα, ἐπειδὴ ἠνέσχετο, τινὸς θαυμάσαντος, εἰπεῖν, εἰ δέ με ὄνος ἐλάκτισε, δίκην ἂν αὐτῷ ἐλάγχανον;",
    en: "that frequently, owing to his vehemence in argument, men set upon him with their fists or tore his hair out; and that for the most part he was despised and laughed at, yet bore all this ill-usage patiently. So much so that, when he had been kicked, and some one expressed surprise at his taking it so quietly, Socrates rejoined, Should I have taken the law of a donkey, supposing that he had kicked me?",
    ref: "2.21",
    certainty: "reported",
    accordingTo: "Demetrius of Byzantium",
    framesSaying: "socrates-donkey-kick",
  },
  {
    id: "socrates-saves-xenophon",
    philosopher: "Socrates",
    topic: "encounter",
    gloss:
      "At the battle of Delium, Socrates steps in and saves the life of Xenophon, fallen from his horse.",
    grc:
      "ἐστρατεύσατο γοῦν εἰς Ἀμφίπολιν καὶ Ξενοφῶντα ἀφʼ ἵππου πεσόντα ἐν τῇ κατὰ Δήλιον μάχῃ διέσωσεν ὑπολαβών·",
    en: "At all events he served on the expedition to Amphipolis; and when in the battle of Delium Xenophon had fallen from his horse, he stepped in and saved his life.",
    ref: "2.22",
    involves: "Xenophon",
    certainty: "asserted",
  },
  {
    id: "socrates-potidaea-prize",
    philosopher: "Socrates",
    topic: "training",
    gloss:
      "At Potidaea he stands a whole night without changing position, wins the prize of valour - and resigns it to Alcibiades.",
    grc:
      "ἐστρατεύσατο δὲ καὶ εἰς Ποτίδαιαν διὰ θαλάττης· πεζῇ γὰρ οὐκ ἐνῆν τοῦ πολέμου κωλύοντος. ὅτε καὶ μεῖναι διὰ νυκτὸς ὅλης ἐφʼ ἑνὸς σχήματος αὐτόν φασι, καὶ ἀριστεύσαντα αὐτόθι παραχωρῆσαι Ἀλκιβιάδῃ τοῦ ἀριστείου· οὗ καὶ ἐρασθῆναί φησιν αὐτὸν Ἀρίστιππος ἐν τετάρτῳ Περὶ παλαιᾶς τρυφῆς.",
    en: "Again, he served at Potidaea, whither he had gone by sea, as land communications were interrupted by the war ; and while there he is said to have remained a whole night without changing his position, and to have won the prize of valour. But he resigned it to Alcibiades, for whom he cherished the tenderest affection, according to Aristippus in the fourth book of his treatise On the Luxury of the Ancients.",
    ref: "2.23",
    involves: "Alcibiades",
    certainty: "reported",
    note: "The affection for Alcibiades rests on Aristippus' On the Luxury of the Ancients; Aristippus is a philosopher, not otherwise a claim source, so he is not carried as accordingTo.",
  },
  {
    id: "socrates-refuses-leon",
    philosopher: "Socrates",
    topic: "defiance",
    gloss:
      "He refuses the Thirty's order to fetch Leon of Salamis for execution, alone votes to acquit the ten generals, declines to escape from prison, and rebukes his friends for weeping.",
    grc:
      "Ἦν δὲ καὶ ἰσχυρογνώμων καὶ δημοκρατικός, ὡς δῆλον ἔκ τε τοῦ μὴ εἶξαι τοῖς περὶ Κριτίαν, κελεύουσι Λέοντα τὸν Σαλαμίνιον, ἄνδρα πλούσιον, ἀγαγεῖν πρὸς αὐτούς, ὥστε ἀπολέσθαι· ἀλλὰ καὶ μόνος ἀποψηφίσασθαι τῶν δέκα στρατηγῶν. καὶ ἐνὸν αὐτῷ ἀποδρᾶναι τῆς εἱρκτῆς μὴ ἐθελῆσαι· τοῖς τε κλαίουσιν αὐτὸν ἐπιπλῆξαι καὶ τοὺς καλλίστους λόγους ἐκείνους δεδεμένον διαθέσθαι.",
    en: "His strength of will and attachment to the democracy are evident from his refusal to yield to Critias and his colleagues when they ordered him to bring the wealthy Leon of Salamis before them for execution, and further from the fact that he alone voted for the acquittal of the ten generals; and again from the facts that when he had the opportunity to escape from the prison he declined to do so, and that he rebuked his friends for weeping over his fate, and addressed to them his most memorable discourses in the prison.",
    ref: "2.24",
    involves: "Critias",
    certainty: "asserted",
  },
  {
    id: "socrates-alcibiades-site",
    philosopher: "Socrates",
    topic: "wit",
    gloss:
      "Offered a large building site by Alcibiades, Socrates asks whether it would not be ridiculous to accept a whole hide when he wanted a pair of shoes.",
    grc:
      "καί ποτε Ἀλκιβιάδου, καθά φησι Παμφίλη ἐν τῷ ἑβδόμῳ τῶν Ὑπομνημάτων, διδόντος αὐτῷ χώραν μεγάλην, ἵνα ἐνοικοδομήσηται οἰκίαν, φάναι, καὶ εἰ ὑποδημάτων ἔδει, καὶ βύρσαν μοι ἐδίδους, ἵνʼ ἐμαυτῷ ὑποδήματα ποιησαίμην, καταγέλαστος ἂν ἦν λαβών.",
    en: "Pamphila in the seventh book of her Commentaries tells how Alcibiades once offered him a large site on which to build a house; but he replied, Suppose, then, I wanted shoes and you offered me a whole hide to make a pair with, would it not be ridiculous in me to take it?",
    ref: "2.24",
    involves: "Alcibiades",
    certainty: "reported",
    accordingTo: "Pamphila",
    framesSaying: "socrates-whole-hide",
  },
  {
    id: "socrates-scorns-royal-courts",
    philosopher: "Socrates",
    topic: "asceticism",
    gloss:
      "He shows his contempt for Archelaus of Macedon, Scopas of Cranon and Eurylochus of Larissa by refusing their presents and their courts.",
    grc:
      "ὑπερεφρόνησε δὲ καὶ Ἀρχελάου τοῦ Μακεδόνος καὶ Σκόπα τοῦ Κρανωνίου καὶ Εὐρυλόχου τοῦ Λαρισσαίου, μήτε χρήματα προσέμενος παρʼ αὐτῶν, μήτε παρʼ αὐτοὺς ἀπελθών.",
    en: "He showed his contempt for Archelaus of Macedon and Scopas of Cranon and Eurylochus of Larissa by refusing to accept their presents or to go to their court.",
    ref: "2.25",
    certainty: "asserted",
  },
  {
    id: "socrates-iphicrates-cocks",
    philosopher: "Socrates",
    topic: "teaching",
    gloss:
      "He rouses the general Iphicrates to a martial spirit by pointing to the barber Midias' fighting cocks flapping their wings in defiance of those of Callias.",
    grc:
      "Ἐπῆρε δὲ καὶ εἰς φρόνημα Ἰφικράτην τὸν στρατηγόν, δείξας αὐτῷ τοῦ κουρέως Μειδίου ἀλεκτρυόνας ἀντίον τῶν Καλλίου πτερυξαμένους.",
    en: "He roused Iphicrates the general to a martial spirit by showing him how the fighting cocks of Midias the barber flapped their wings in defiance of those of Callias.",
    ref: "2.30",
    involves: "Iphicrates",
    certainty: "asserted",
  },
  {
    id: "socrates-lyre-and-dance",
    philosopher: "Socrates",
    topic: "eccentricity",
    gloss:
      "In old age he learns to play the lyre, seeing no absurdity in a new accomplishment, and makes a regular habit of dancing for the body's condition.",
    grc:
      "Ἀλλὰ καὶ λυρίζειν ἐμάνθανεν ἤδη γηραιός, μηδὲν λέγων ἄτοπον εἶναι ἅ τις μὴ οἶδεν ἐκμανθάνειν. ἔτι τε ὠρχεῖτο συνεχές, τῇ τοῦ σώματος εὐεξίᾳ λυσιτελεῖν ἡγούμενος τὴν τοιαύτην γυμνασίαν, ὡς καὶ Ξενοφῶν ἐν Συμποσίῳ φησίν.",
    en: "Moreover, in his old age he learnt to play the lyre, declaring that he saw no absurdity in learning a new accomplishment. As Xenophon relates in the Symposium , it was his regular habit to dance, thinking that such exercise helped to keep the body in good condition.",
    ref: "2.32",
    certainty: "asserted",
    note: "The dancing habit rests on Xenophon's Symposium; Xenophon is a philosopher, not otherwise a claim source, so he is not carried as accordingTo.",
  },
  {
    id: "socrates-auge-walkout",
    philosopher: "Socrates",
    topic: "defiance",
    gloss:
      "Hearing Euripides say of virtue that it is best to let her roam at will, Socrates gets up and walks out of the theatre.",
    grc:
      "Εὐριπίδου δʼ ἐν τῇ Αὔγῃ εἰπόντος περὶ ἀρετῆς, κράτιστον εἰκῆ ταῦτʼ ἐᾶν ἀφειμένα, ἀναστὰς ἐξῆλθε, φήσας γελοῖον εἶναι ἀνδράποδον μὲν μὴ εὑρισκόμενον ἀξιοῦν ζητεῖν, ἀρετὴν δʼ οὕτως ἐᾶν ἀπολωλέναι.",
    en: "On hearing the line of Euripides’ play Auge where the poet says of virtue: ’Tis best to let her roam at will, he got up and left the theatre. For he said it was absurd to make a hue and cry about a slave who could not be found, and to allow virtue to perish in this way.",
    ref: "2.33",
    certainty: "asserted",
  },
  {
    id: "socrates-xanthippe-market",
    philosopher: "Socrates",
    topic: "encounter",
    gloss:
      "When Xanthippe tears his coat off his back in the market-place, his friends urge him to hit back - and Socrates turns the scene into a boxing match with spectators.",
    grc:
      "ποτὲ αὐτῆς ἐν ἀγορᾷ καὶ θοἰμάτιον περιελομένης συνεβούλευον οἱ γνώριμοι χερσὶν ἀμύνασθαι, νὴ Δίʼ, εἶπεν, ἵνʼ ἡμῶν πυκτευόντων ἕκαστος ὑμῶν λέγῃ, εὖ Σώκρατες, εὖ Ξανθίππη.",
    en: "When she tore his coat off his back in the market-place and his acquaintances advised him to hit back, Yes, by Zeus, said he, in order that while we are sparring each of you may join in with Go it, Socrates! Well done, Xanthippe!",
    ref: "2.37",
    involves: "Xanthippe",
    involvesRef: "2.36",
    certainty: "asserted",
    framesSaying: "socrates-sparring-match",
  },
  {
    id: "socrates-plato-platform",
    philosopher: "Socrates",
    topic: "encounter",
    gloss:
      "At the trial Plato mounts the platform to speak for Socrates - and the judges shout him down before he can finish a sentence.",
    grc:
      "Κρινομένου δʼ αὐτοῦ φησιν Ἰοῦστος ὁ Τιβεριεὺς ἐν τῷ Στέμματι Πλάτωνα ἀναβῆναι ἐπὶ τὸ βῆμα καὶ εἰπεῖν, νεώτατος ὤν, ὦ ἄνδρες Ἀθηναῖοι, τῶν ἐπὶ τὸ βῆμα ἀναβάντων· τοὺς δὲ δικαστὰς ἐκβοῆσαι, Κατάβα, κατάβα [τουτέστι κατάβηθι].",
    en: "Justus of Tiberias in his book entitled The Wreath says that in the course of the trial Plato mounted the platform and began: Though I am the youngest, men of Athens, of all who ever rose to address you —whereupon the judges shouted out, Get down! Get down!",
    ref: "2.41",
    involves: "Plato",
    certainty: "reported",
    accordingTo: "Justus of Tiberias",
  },
  {
    id: "socrates-prytaneum-sentence",
    philosopher: "Socrates",
    topic: "death",
    gloss:
      "Asked to assess his own penalty, Socrates proposes maintenance in the Prytaneum at public expense; the death sentence follows with eighty fresh votes, and a few days later he drinks the hemlock.",
    grc:
      "θορυβησάντων δὲ τῶν δικαστῶν, ἕνεκα μέν, εἶπε, τῶν ἐμοὶ διαπεπραγμένων τιμῶμαι τὴν δίκην τῆς ἐν πρυτανείῳ σιτήσεως. Καὶ οἳ θάνατον αὐτοῦ κατέγνωσαν, προσθέντες ἄλλας ψήφους ὀγδοήκοντα. καὶ δεθεὶς μετʼ οὐ πολλὰς ἡμέρας ἔπιε τὸ κώνειον, πολλὰ καλὰ κἀγαθὰ διαλεχθείς, ἃ Πλάτων ἐν τῷ Φαίδωνί φησιν.",
    en: "When this caused an uproar among the judges, he said, Considering my services, I assess the penalty at maintenance in the Prytaneum at the public expense. Sentence of death was passed, with an accession of eighty fresh votes. He was put in prison, and a few days afterwards drank the hemlock, after much noble discourse which Plato records in the Phaedo.",
    ref: "2.42",
    certainty: "asserted",
    framesSaying: "socrates-prytaneum",
  },
  {
    id: "socrates-athens-remorse",
    philosopher: "Socrates",
    topic: "legacy",
    gloss:
      "Athens repents: training grounds and gymnasia are shut, the accusers banished, Meletus put to death, and Socrates honoured with a bronze statue by Lysippus.",
    grc:
      "Ὁ μὲν οὖν ἐξ ἀνθρώπων ἦν· Ἀθηναῖοι δʼ εὐθὺς μετέγνωσαν, ὥστε κλεῖσαι καὶ παλαίστρας καὶ γυμνάσια. καὶ τοὺς μὲν 〈ἄλλουσ〉 ἐφυγάδευσαν, Μελήτου δὲ θάνατον κατέγνωσαν· Σωκράτην δὲ χαλκῇ εἰκόνι ἐτίμησαν, ἣν ἔθεσαν ἐν τῷ πομπείῳ, Λυσίππου ταύτην ἐργασαμένου.",
    en: "So he was taken from among men; and not long afterwards the Athenians felt such remorse that they shut up the training grounds and gymnasia. They banished the other accusers but put Meletus to death; they honoured Socrates with a bronze statue, the work of Lysippus, which they placed in the hall of processions.",
    ref: "2.43",
    certainty: "asserted",
  },
  // --- Xenophon ---
  {
    id: "xenophon-narrow-passage",
    philosopher: "Xenophon",
    topic: "conversion",
    gloss:
      "Socrates bars the handsome young Xenophon's way in a narrow passage with his stick, asks where men become good and honourable - and tells the puzzled youth to follow him and learn.",
    grc:
      "τούτῳ δὲ ἐν στενωπῷ φασιν ἀπαντήσαντα Σωκράτην διατεῖναι τὴν βακτηρίαν καὶ κωλύειν παριέναι, πυνθανόμενον ποῦ πιπράσκοιτο τῶν προσφερομένων ἕκαστον· ἀποκριναμένου δὲ πάλιν πυθέσθαι, ποῦ δὲ καλοὶ κἀγαθοὶ γίνονται ἄνθρωποι· ἀπορήσαντος δέ, ἕπου τοίνυν, φάναι, καὶ μάνθανε. καὶ τοὐντεῦθεν ἀκροατὴς Σωκράτους ἦν.",
    en: "The story goes that Socrates met him in a narrow passage, and that he stretched out his stick to bar the way, while he inquired where every kind of food was sold. Upon receiving a reply, he put another question, And where do men become good and honourable? Xenophon was fairly puzzled; Then follow me, said Socrates, and learn. From that time onward he was a pupil of Socrates.",
    ref: "2.48",
    involves: "Socrates",
    certainty: "reported",
    framesSaying: "socrates-follow-me-and-learn",
  },
  {
    id: "xenophon-delphi-question",
    philosopher: "Xenophon",
    topic: "piety",
    gloss:
      "Sent by Socrates to consult Delphi about joining Cyrus, Xenophon asks the god not whether he should go but how - earning Socrates' blame, and his blessing.",
    grc:
      "καὶ ὃς ἀπέστειλεν αὐτὸν εἰς Δελφοὺς χρησόμενον τῷ θεῷ. πείθεται Ξενοφῶν· ἥκει παρὰ τὸν θεόν· πυνθάνεται οὐχὶ εἰ χρὴ ἀπιέναι πρὸς Κῦρον, ἀλλʼ ὅπως· ἐφʼ ᾧ καὶ Σωκράτης αὐτὸν ᾐτιάσατο, συνεβούλευσε δὲ ἐξελθεῖν.",
    en: "Xenophon showed this letter to Socrates and asked his advice, which was that he should go to Delphi and consult the oracle. Xenophon complied and came into the presence of the god. He inquired, not whether he should go and seek service with Cyrus, but in what way he should do so. For this Socrates blamed him, yet at the same time he advised him to go.",
    ref: "2.50",
    involves: "Socrates",
    certainty: "asserted",
  },
  {
    id: "xenophon-ephesus-offerings",
    philosopher: "Xenophon",
    topic: "piety",
    gloss:
      "Before marching inland he entrusts half his money to Megabyzus, priest of Artemis at Ephesus - for a statue of the goddess should he not return - and sends the other half in offerings to Delphi.",
    grc:
      "γενόμενος δʼ ἐν Ἐφέσῳ καὶ χρυσίον ἔχων τὸ μὲν ἥμισυ Μεγαβύζῳ δίδωσι τῷ τῆς Ἀρτέμιδος ἱερεῖ φυλάττειν, ἕως ἂν ἐπανέλθοι· εἰ δὲ μή, ἄγαλμα ποιησάμενον ἀναθεῖναι τῇ θεῷ· τοῦ δὲ ἡμίσεος ἔπεμψεν εἰς Δελφοὺς ἀναθήματα.",
    en: "When he was in Ephesus and had a sum of money, he entrusted one half of it to Megabyzus, the priest of Artemis, to keep until his return, or if he should never return, to apply to the erection of a statue in honour of the goddess. But the other half he sent in votive offerings to Delphi.",
    ref: "2.51",
    certainty: "asserted",
  },
  // --- Aeschines ---
  {
    id: "aeschines-never-quits-socrates",
    philosopher: "Aeschines",
    topic: "encounter",
    gloss:
      "Industrious from birth, the sausage-maker's son never leaves Socrates' side - earning the master's remark that only he knows how to honour him.",
    grc:
      "Αἰσχίνης Χαρίνου τοῦ ἀλλαντοποιοῦ, οἱ δὲ Λυσανίου, Ἀθηναῖος, ἐκ νέου φιλόπονος· διὸ καὶ Σωκράτους οὐκ ἀπέστη. ὅθεν ἔλεγε, μόνος ἡμᾶς οἶδε τιμᾶν ὁ τοῦ ἀλλαντοποιοῦ.",
    en: "He was a citizen of Athens, industrious from his birth up. For this reason he never quitted Socrates; hence Socrates’ remark, Only the sausage-maker’s son knows how to honour me.",
    ref: "2.60",
    involves: "Socrates",
    certainty: "asserted",
    framesSaying: "socrates-sausage-makers-son",
  },
  {
    id: "aeschines-sicily-want",
    philosopher: "Aeschines",
    topic: "encounter",
    gloss:
      "Driven by poverty to the court of Dionysius, he is ignored by Plato, introduced by Aristippus, and paid in gifts for his dialogues.",
    grc:
      "Φασὶ δʼ αὐτὸν διʼ ἀπορίαν ἐλθεῖν εἰς Σικελίαν πρὸς Διονύσιον, καὶ ὑπὸ μὲν Πλάτωνος παροφθῆναι, ὑπὸ δʼ Ἀριστίππου συστῆναι· δόντα τέ τινας τῶν διαλόγων δῶρα λαβεῖν.",
    en: "They say that want drove him to Sicily to the court of Dionysius, and that Plato took no notice of him, but he was introduced to Dionysius by Aristippus, and on presenting certain dialogues received gifts from him.",
    ref: "2.61",
    involves: "Aristippus",
    certainty: "reported",
  },
  {
    id: "aeschines-megara-thief",
    philosopher: "Aeschines",
    topic: "wit",
    gloss:
      "Reading one of his dialogues at Megara, Aeschines is rallied by Aristippus, who suspects its genuineness: where did you get that, you thief?",
    grc:
      "τούτου τοὺς διαλόγους καὶ Ἀρίστιππος ὑπώπτευεν. ἐν γοῦν Μεγάροις ἀναγινώσκοντος αὐτοῦ φασι σκῶψαι εἰπόντα, πόθεν σοι, λῃστά, ταῦτα;",
    en: "Aristippus among others had suspicions of the genuineness of his dialogues. At all events, as he was reading one at Megara, Aristippus rallied him by asking, Where did you get that, you thief?",
    ref: "2.62",
    involves: "Aristippus",
    certainty: "asserted",
    framesSaying: "aristippus-you-thief",
  },
  // --- Aristippus ---
  {
    id: "aristippus-fees-returned",
    philosopher: "Aristippus",
    topic: "encounter",
    gloss:
      "First of the Socratics to charge fees, he sends twenty minae to his master - and Socrates returns them, his supernatural sign forbidding the gift.",
    grc:
      "οὗτος σοφιστεύσας, ὥς φησι φανίας ὁ περιπατητικὸς ὁ Ἐρέσιος, πρῶτος τῶν Σωκρατικῶν μισθοὺς εἰσεπράξατο καὶ ἀπέστειλε χρήματα τῷ διδασκάλῳ. καί ποτε πέμψας αὐτῷ μνᾶς εἴκοσι παλινδρόμους ἀπέλαβεν, εἰπόντος Σωκράτους τὸ δαιμόνιον αὐτῷ μὴ ἐπιτρέπειν· ἐδυσχέραινε γὰρ ἐπὶ τούτῳ.",
    en: "Having come forward as a lecturer or sophist, as Phanias of Eresus, the Peripatetic, informs us, he was the first of the followers of Socrates to charge fees and to send money to his master. And on one occasion the sum of twenty minae which he had sent was returned to him, Socrates declaring that the supernatural sign would not let him take it; the very offer, in fact, annoyed him.",
    ref: "2.65",
    involves: "Socrates",
    certainty: "reported",
    accordingTo: "Phanias",
  },
  {
    id: "aristippus-three-courtesans",
    philosopher: "Aristippus",
    topic: "shamelessness",
    gloss:
      "Given his choice of three courtesans by Dionysius, he carries off all three - Paris paid dearly for choosing one - and lets them go at the porch.",
    grc:
      "Διονυσίου δέ ποτε τριῶν ἑταιρῶν οὐσῶν μίαν ἐκλέξασθαι κελεύσαντος, τὰς τρεῖς ἀπήγαγεν εἰπών, οὐδὲ τῷ Πάριδι συνήνεγκε μίαν προκρῖναι· ἀπαγαγὼν μέντοι, φασίν, αὐτὰς ἄχρι τοῦ θυρῶνος ἀπέλυσεν. οὕτως ἦν καὶ ἑλέσθαι καὶ καταφρονῆσαι πολύς.",
    en: "And when Dionysius gave him his choice of three courtesans, he carried off all three, saying, Paris paid dearly for giving the preference to one out of three. And when he had brought them as far as the porch, he let them go. To such lengths did he go both in choosing and in disdaining.",
    ref: "2.67",
    involves: "Dionysius",
    certainty: "asserted",
    framesSaying: "aristippus-paris-three-courtesans",
  },
  {
    id: "aristippus-bears-spittle",
    philosopher: "Aristippus",
    topic: "shamelessness",
    gloss:
      "He bears it when Dionysius spits on him: fishermen let themselves be drenched with sea-water for a gudgeon - should he not be wetted with negus to take a blenny?",
    grc:
      "Διονυσίου δὲ προσπτύσαντος αὐτῷ ἠνέσχετο. μεμψαμένου δέ τινος, εἶτα οἱ μὲν ἁλιεῖς, εἶπεν, ὑπομένουσι ῥαίνεσθαι τῇ θαλάττῃ, ἵνα κωβιὸν θηράσωσιν· ἐγὼ δὲ μὴ ἀνάσχωμαι κράματι ῥανθῆναι, ἵνα βλέννοι λάβω;",
    en: "He bore with Dionysius when he spat on him, and to one who took him to task he replied, If the fishermen let themselves be drenched with sea-water in order to catch a gudgeon, ought I not to endure to be wetted with negus in order to take a blenny?",
    ref: "2.67",
    involves: "Dionysius",
    certainty: "asserted",
    framesSaying: "aristippus-gudgeon-and-blenny",
  },
  {
    id: "aristippus-servant-money",
    philosopher: "Aristippus",
    topic: "asceticism",
    gloss:
      "When his servant finds the money he is carrying too heavy, Aristippus tells him to pour away the greater part and carry no more than he can manage.",
    grc:
      "τοῦ δὲ θεράποντος ἐν ὁδῷ βαστάζοντος ἀργύριον καὶ βαρυνομένου, ὥς φασιν οἱ περὶ τὸν Βίωνα ἐν ταῖς Διατριβαῖς, ἀπόχεε, ἔφη, τὸ πλέον καὶ ὅσον δύνασαι βάσταζε.",
    en: "When his servant was carrying money and found the load too heavy—the story is told by Bion in his Lectures —Aristippus cried, Pour away the greater part, and carry no more than you can manage.",
    ref: "2.77",
    certainty: "reported",
    accordingTo: "Bion",
    framesSaying: "aristippus-throw-off-load",
  },
  {
    id: "aristippus-pirates-money",
    philosopher: "Aristippus",
    topic: "wit",
    gloss:
      "Discovering his ship is manned by pirates, he counts out his money, lets it fall into the sea as if by accident, and laments - better the money perish on account of Aristippus than Aristippus on account of the money.",
    grc:
      "πλέων ποτὲ ἐπεὶ τὸ σκάφος ἔγνω πειρατικόν, λαβὼν τὸ χρυσίον ἠρίθμει· ἔπειτα εἰς θάλατταν ὡς μὴ θέλων παρακατέβαλε καὶ δῆθεν ἀνῴμωξεν. οἱ δὲ καὶ ἐπειπεῖν φασιν αὐτὸν ὡς ἄμεινον ταῦτα διʼ Ἀρίστιππον ἢ διὰ ταῦτα Ἀρίστιππον ἀπολέσθαι.",
    en: "Being once on a voyage, as soon as he discovered the vessel to be manned by pirates, he took out his money and began to count it, and then, as if by inadvertence, he let the money fall into the sea, and naturally broke out into lamentation. Another version of the story attributes to him the further remark that it was better for the money to perish on account of Aristippus than for Aristippus to perish on account of the money.",
    ref: "2.77",
    certainty: "asserted",
  },
  {
    id: "aristippus-purple-dance",
    philosopher: "Aristippus",
    topic: "wit",
    gloss:
      "Commanded by Dionysius to put on purple and dance, Plato declines to stoop to women's robes; Aristippus puts on the dress - true modesty will not be put to shame even amid the Bacchic revelry.",
    grc:
      "καί ποτε παρὰ πότον κελεύσαντος Διονυσίου ἕκαστον ἐν πορφυρᾷ ἐσθῆτι ὀρχήσασθαι, τὸν μὲν Πλάτωνα μὴ προσέσθαι, εἰπόντα· οὐκ ἂν δυναίμην θῆλυν ἐνδῦναι στολήν· τὸν δʼ Ἀρίστιππον λαβόντα καὶ μέλλοντα ὀρχήσασθαι εὐστόχως εἰπεῖν· καὶ γὰρ ἐν βακχεύμασιν οὖσʼ ἥ γε σώφρων οὐ διαφθαρήσεται.",
    en: "One day Dionysius over the wine commanded everybody to put on purple and dance. Plato declined, quoting the line : I could not stoop to put on women’s robes. Aristippus, however, put on the dress and, as he was about to dance, was ready with the repartee: Even amid the Bacchic revelry True modesty will not be put to shame.",
    ref: "2.78",
    involves: "Plato",
    certainty: "asserted",
  },
  {
    id: "aristippus-falls-at-feet",
    philosopher: "Aristippus",
    topic: "shamelessness",
    gloss:
      "Failing to win a request for a friend, he falls at Dionysius' feet - and answers the jeers: it is not I who am to blame, but Dionysius who has his ears in his feet.",
    grc:
      "Δεόμενός ποτε ὑπὲρ φίλου Διονυσίου καὶ μὴ ἐπιτυγχάνων εἰς τοὺς πόδας αὐτοῦ ἔπεσε· πρὸς οὖν τὸν ἐπισκώψαντα, οὐκ ἐγώ, φησίν, αἴτιος, ἀλλὰ Διονύσιος ὁ ἐν τοῖς ποσὶ τὰς ἀκοὰς ἔχων.",
    en: "He made a request to Dionysius on behalf of a friend and, failing to obtain it, fell down at his feet. And when some one jeered at him, he made reply, It is not I who am to blame, but Dionysius who has his ears in his feet.",
    ref: "2.79",
    involves: "Dionysius",
    certainty: "asserted",
    framesSaying: "aristippus-ears-in-his-feet",
  },
  {
    id: "aristippus-artaphernes-prisoner",
    philosopher: "Aristippus",
    topic: "capture",
    gloss:
      "Taken prisoner in Asia by the satrap Artaphernes and asked whether he can be cheerful now, he answers: when should I be more cheerful than now that I am about to converse with Artaphernes?",
    grc:
      "διατρίβων ἐν Ἀσίᾳ καὶ ληφθεὶς ὑπὸ Ἀρταφέρνου τοῦ σατράπου πρὸς τὸν εἰπόντα, καὶ ὧδε θαρρεῖς, πότε γάρ, εἶπεν, ὦ μάταιε, θαρρήσαιμι ἀν μᾶλλον ἢ νῦν, ὅτε μέλλω Ἀρταφέρνῃ διαλέξεσθαι;",
    en: "He was once staying in Asia and was taken prisoner by Artaphernes, the satrap. Can you be cheerful under these circumstances? some one asked. Yes, you simpleton, was the reply, for when should I be more cheerful than now that I am about to converse with Artaphernes?",
    ref: "2.79",
    involves: "Artaphernes",
    certainty: "asserted",
    framesSaying: "aristippus-converse-with-artaphernes",
  },
  // --- Phaedo ---
  {
    id: "phaedo-ransomed-for-philosophy",
    philosopher: "Phaedo",
    topic: "conversion",
    gloss:
      "Taken captive at the fall of Elis and consigned to a house of ill-fame, Phaedo contrives to join Socrates' circle - and Socrates has him ransomed into philosophy and freedom.",
    grc:
      "Φαίδων Ἠλεῖος, τῶν εὐπατριδῶν, συνεάλω τῇ πατρίδι καὶ ἠναγκάσθη στῆναι ἐπʼ οἰκήματος· ἀλλὰ τὸ θύριον προστιθεὶς μετεῖχε Σωκράτους, ἕως αὐτὸν λυτρώσασθαι τοὺς περὶ Ἀλκιβιάδην ἢ Κρίτωνα προὔτρεψε· καὶ τοὐντεῦθεν ἐλευθερίως ἐφιλοσόφει.",
    en: "Phaedo was a native of Elis, of noble family, who on the fall of that city was taken captive and forcibly consigned to a house of ill-fame. But he would close the door and so contrive to join Socrates’ circle, and in the end Socrates induced Alcibiades or Crito with their friends to ransom him; from that time onwards he studied philosophy as became a free man.",
    ref: "2.105",
    involves: "Socrates",
    certainty: "asserted",
    note: "The same incident is noticed in Socrates' Life (2.31), where Crito alone is named as the ransomer.",
  },
  // --- Euclides ---
  {
    id: "euclides-megara-refuge",
    philosopher: "Euclides",
    topic: "exile",
    gloss:
      "After the death of Socrates, Plato and the other philosophers take refuge with Euclides at Megara, alarmed at the cruelty of the tyrants.",
    grc:
      "πρὸς τοῦτόν φησιν ὁ Ἑρμόδωρος ἀφικέσθαι Πλάτωνα καὶ τοὺς λοιποὺς φιλοσόφους μετὰ τὴν τοῦ Σωκράτους τελευτήν, δείσαντας τὴν ὠμότητα τῶν τυράννων.",
    en: "Hermodorus tells us that, after the death of Socrates, Plato and the rest of the philosophers came to him, being alarmed at the cruelty of the tyrants.",
    ref: "2.106",
    involves: "Plato",
    certainty: "reported",
    accordingTo: "Hermodorus",
  },
  // --- Stilpo ---
  {
    id: "stilpo-declines-ptolemy",
    philosopher: "Stilpo",
    topic: "asceticism",
    gloss:
      "When Ptolemy Soter takes Megara, offers him money and invites him to Egypt, Stilpo accepts only a moderate sum, declines the journey, and waits on Aegina until the king sails.",
    grc:
      "Ἀπεδέχετο δʼ αὐτόν, φασί, καὶ Πτολεμαῖος ὁ Ζωτήρ. καὶ ἐγκρατὴς Μεγάρων γενόμενος ἐδίδου τε ἀργύριον αὐτῷ καὶ παρεκάλει εἰς Αἴγυπτον συμπλεῖν· ὁ δὲ μέτριον μέν τι τἀργυριδίου προσήκατο, ἀρνησάμενος δὲ τὴν ὁδὸν μετῆλθεν εἰς Αἴγιναν, ἕως ἐκεῖνος ἀπέπλευσεν.",
    en: "Ptolemy Soter, they say, made much of him, and when he had got possession of Megara, offered him a sum of money and invited him to return with him to Egypt. But Stilpo would only accept a very moderate sum, and he declined the proposed journey, and removed to Aegina until Ptolemy set sail.",
    ref: "2.115",
    involves: "Ptolemy Soter",
    certainty: "reported",
  },
  {
    id: "stilpo-lost-nothing-demetrius",
    philosopher: "Stilpo",
    topic: "defiance",
    gloss:
      "Demetrius, having taken Megara, orders Stilpo's plundered property restored - and Stilpo denies having lost anything that was really his: no one has taken away his learning.",
    grc:
      "ἀλλὰ καὶ Δημήτριος ὁ Ἀντιγόνου καταλαβὼν τὰ Μέγαρα τήν τε οἰκίαν αὐτῷ φυλαχθῆναι καὶ πάντα τὰ ἁρπασθέντα προὐνόησεν ἀποδοθῆναι. ὅτε καὶ βουλομένῳ παρʼ αὐτοῦ τῶν ἀπολωλότων ἀναγραφὴν λαβεῖν ἔφη μηδὲν τῶν οἰκείων ἀπολωλεκέναι· παιδείαν γὰρ μηδένα ἐξενηνοχέναι, τόν τε λόγον ἔχειν καὶ τὴν ἐπιστήμην.",
    en: "Again, when Demetrius, the son of Antigonus, had taken Megara, he took measures that Stilpo’s house should be preserved and all his plundered property restored to him. But when he requested that a schedule of the lost property should be drawn up, Stilpo denied that he had lost anything which really belonged to him, for no one had taken away his learning, while he still had his eloquence and knowledge.",
    ref: "2.115",
    involves: "Demetrius",
    certainty: "asserted",
    framesSaying: "stilpo-lost-nothing",
  },
  {
    id: "stilpo-areopagus-athena",
    philosopher: "Stilpo",
    topic: "piety",
    gloss:
      "His syllogism that the Athena of Phidias is no god brings him before the Areopagus; he stands by the reasoning - she is no god but a goddess - and the Areopagites order him out of the city.",
    grc:
      "τοῦτόν φασιν περὶ τῆς Ἀθηνᾶς τῆς τοῦ Φειδίου τοιοῦτόν τινα λόγον ἐρωτῆσαι· ἆρά γε ἡ τοῦ Διὸς Ἀθηνᾶ θεός ἐστι; φήσαντος δέ, ναί, αὕτη δέ γε, εἶπεν, οὐκ ἔστι Διός, ἀλλὰ Φειδίου· συγχωρουμένου δέ, οὐκ ἄρα, εἶπε, θεός ἐστιν. ἐφʼ ᾧ καὶ εἰς Ἄρειον πάγον προσκληθέντα μὴ ἀρνήσασθαι, φάσκειν δʼ ὀρθῶς διειλέχθαι· μὴ γὰρ εἶναι αὐτὴν θεόν, ἀλλὰ θεάν· θεοὺς δὲ εἶναι τοὺς ἄρρενας. καὶ μέντοι τοὺς Ἀρεοπαγίτας εὐθέως αὐτὸν κελεῦσαι τῆς πόλεως ἐξελθεῖν. ὅτε καὶ Θεόδωρον τὸν ἐπίκλην θεὸν ἐπισκώπτοντα εἰπεῖν, πόθεν δὲ τοῦτʼ ᾔδει Στίλπων; ἢ ἀνασύρας αὐτῆς τὸν κῆπον ἐθεάσατο;",
    en: "There is a story that he once used the following argument concerning the Athena of Phidias: Is it not Athena the daughter of Zeus who is a goddess? And when the other said Yes, he went on, But this at least is not by Zeus but by Phidias, and, this being granted, he concluded, This then is not a god. For this he was summoned before the Areopagus; he did not deny the charge, but contended that the reasoning was correct, for that Athena was no god but a goddess; it was the male divinities who were gods. However, the story goes that the Areopagites ordered him to quit the city, and that thereupon Theodorus, whose nickname was Θεός , said in derision, Whence did Stilpo learn this? and how could he tell whether she was a god or a goddess?",
    ref: "2.116",
    involves: "Theodorus",
    certainty: "reported",
    framesSaying: "stilpo-athena-not-a-god",
  },
  {
    id: "stilpo-eats-the-fig",
    philosopher: "Stilpo",
    topic: "wit",
    gloss:
      "Crates holds out a fig along with a question; Stilpo eats the fig - and the question with it, for which the fig was payment in advance.",
    grc:
      "ἀλλὰ καὶ ἰσχάδα προτείναντος αὐτῷ ποτε καὶ ἐρώτημα, δεξάμενον καταφαγεῖν· τοῦ δέ, ὦ Ἡράκλεις, εἰπόντος, ἀπολώλεκα τὴν ἰσχάδα· οὐ μόνον, ἔφη, ἀλλὰ καὶ τὸ ἐρώτημα, οὗ ἦν ἀρραβὼν ἡ ἰσχάς.",
    en: "And once when Crates held out a fig to him when putting a question, he took the fig and ate it. Upon which the other exclaimed, O Heracles, I have lost the fig, and Stilpo remarked, Not only that but your question as well, for which the fig was payment in advance.",
    ref: "2.118",
    involves: "Crates",
    certainty: "asserted",
    framesSaying: "stilpo-fig-in-advance",
  },
  {
    id: "stilpo-workshop-crowds",
    philosopher: "Stilpo",
    topic: "wit",
    gloss:
      "At Athens the people run together from the workshops to look at him; stared at like some strange creature, he answers that they stare at a genuine man.",
    grc:
      "Λέγεται δʼ οὕτως Ἀθήνησιν ἐπιστρέψαι τοὺς ἀνθρώπους, ὥστʼ ἀπὸ τῶν ἐργαστηρίων συνθεῖν ἵνα αὐτὸν θεάσαιντο. καί τινος εἰπόντος, Στίλπων, θαυμάζουσί σε ὡς θηρίον, οὐ μὲν οὖν, εἰπεῖν, ἀλλʼ ὡς ἄνθρωπον ἀληθινόν.",
    en: "It is said that at Athens he so attracted the public that people would run together from the workshops to look at him. And when some one said, Stilpo, they stare at you as if you were some strange creature. No, indeed, said he, but as if I were a genuine man.",
    ref: "2.119",
    certainty: "reported",
    framesSaying: "stilpo-genuine-man",
  },
  {
    id: "stilpo-leaves-for-fish",
    philosopher: "Stilpo",
    topic: "wit",
    gloss:
      "In the middle of an argument with Crates he hurries off to buy fish - he keeps the argument, which will remain, but the fish will soon be sold.",
    grc:
      "φασὶ δʼ αὐτὸν ὁμιλοῦντα Κράτητι μετάξὺ σπεῦσαι ἰχθῦς πρίασθαι· τοῦ δʼ ἐπισπωμένου καὶ φάσκοντος, καταλείπεις τὸν λόγον; οὐκ ἔγωγε, ἔφη, ἀλλὰ τὸν μὲν λόγον ἔχω, σὲ δὲ καταλείπω· ὁ μὲν γὰρ λόγος περιμενεῖ, τὸ δʼ ὄψον πεπράσεται.",
    en: "The story goes that while in the middle of an argument with Crates he hurried off to buy fish, and, when Crates tried to detain him and urged that he was leaving the argument, his answer was, Not I. I keep the argument though I am leaving you; for the argument will remain, but the fish will soon be sold.",
    ref: "2.119",
    involves: "Crates",
    certainty: "reported",
    framesSaying: "stilpo-argument-remains",
  },
  {
    id: "stilpo-wine-death",
    philosopher: "Stilpo",
    topic: "death",
    gloss:
      "Hermippus has Stilpo die at a great age after taking wine to hasten his end.",
    grc:
      "γηραιὸν δὲ τελευτῆσαί φησιν Ἕρμιππος, οἶνον προσενεγκάμενον ὅπως θᾶττον ἀποθάνοι.",
    en: "Hermippus that Stilpo died at a great age after taking wine to hasten his end.",
    ref: "2.120",
    certainty: "reported",
    accordingTo: "Hermippus",
  },
  // --- Simon ---
  {
    id: "simon-leathern-dialogues",
    philosopher: "Simon",
    topic: "teaching",
    gloss:
      "When Socrates converses in his cobbler's workshop, Simon makes notes of all he can remember - hence his dialogues are called leathern.",
    grc:
      "οὗτος ἐρχομένου Σωκράτους ἐπὶ τὸ ἐργαστήριον καὶ διαλεγομένου τινά, ὧν ἐμνημόνευεν ὑποσημειώσεις ἐποιεῖτο· ὅθεν σκυτικοὺς αὐτοῦ τοὺς διαλόγους καλοῦσιν.",
    en: "When Socrates came to his workshop and began to converse, he used to make notes of all that he could remember. And this is why people apply the term leathern to his dialogues.",
    ref: "2.122",
    involves: "Socrates",
    certainty: "asserted",
  },
  // --- Menedemus of Eretria ---
  {
    id: "menedemus-twig-picture",
    philosopher: "Menedemus of Eretria",
    topic: "wit",
    gloss:
      "When a young gallant takes liberties with him, he says nothing - but draws an insulting picture on the ground with a twig until all eyes are drawn to it and the young man makes off.",
    grc:
      "μειρακίου γοῦν καταθρασυνομένου εἶπε μὲν οὐδέν· λαβὼν δὲ κάρφος διέγραφεν εἰς τοὔδαφος περαινομένου σχῆμα· ἕως ὁρώντων πάντων συνὲν τὸ μειράκιον τὴν ὕβριν ἀπηλλάγη.",
    en: "When a young gallant would have taken liberties with him, he said not a word but picked up a twig and drew an insulting picture on the ground, until all eyes were attracted and the young man, perceiving the insult, made off.",
    ref: "2.127",
    certainty: "asserted",
  },
  {
    id: "menedemus-nicocreon-feast",
    philosopher: "Menedemus of Eretria",
    topic: "defiance",
    gloss:
      "At Nicocreon's monthly feast on Cyprus he tells the king that if gathering such men is good it should happen every day - if not, it is superfluous now; only a flute-player's help gets him and Asclepiades away alive.",
    grc:
      "διὰ δὴ οὖν τὸ παρρησιαστικὸν τοῦτο μικροῦ καὶ ἐκινδύνευσεν ἐν Κύπρῳ παρὰ Νικοκρέοντι σὺν Ἀσκληπιάδῃ τῷ φίλῳ. τοῦ γάρ τοι βασιλέως ἐπιμήνιον ἑορτὴν τελοῦντος καὶ καλέσαντος καὶ τούτους ὥσπερ τοὺς ἄλλους φιλοσόφους, τὸν Μενέδημον εἰπεῖν ὡς εἰ καλὸν ἦν ἡ τῶν τοιούτων ἀνδρῶν συναγωγή, καθʼ ἑκάστην ἡμέραν ἔδει γίνεσθαι τὴν ἑορτήν· εἰ δʼ οὔ, περιττῶς καὶ νῦν.",
    en: "However, on account of this freedom of speech he was in great peril in Cyprus with his friend Asclepiades when staying at the court of Nicocreon. For when the king held the usual monthly feast and invited these two along with the other philosophers, we are told that Menedemus said that, if the gathering of such men was a good thing, the feast ought to have been held every day; if not, then it was superfluous even on the present occasion.",
    ref: "2.129",
    involves: "Asclepiades",
    certainty: "reported",
    note: "The sequel (2.130): pressing the point still more stubbornly during the feast, they would have been put to death had a flute-player not got them away; in the storm at sea Asclepiades says the flute-player's good playing proved their salvation where Menedemus' free speech had been their undoing.",
  },
  {
    id: "menedemus-olive-rebuke",
    philosopher: "Menedemus of Eretria",
    topic: "asceticism",
    gloss:
      "Unable to curb an extravagant host, he says nothing when invited - and rebukes him tacitly at table by confining himself to olives.",
    grc:
      "μὴ δυνάμενος δὲ τῶν καλούντων ἐπὶ δεῖπνόν τινος περιελεῖν τὴν πολυτέλειαν, κληθείς ποτε οὐδὲν μὲν εἶπε· σιωπῶν δʼ αὐτὸν ἐνουθέτησε μόνας ἐλαίας προσενεγκάμενος.",
    en: "Not being able to curb the extravagance of some one who had invited him to dinner, he said nothing when he was invited, but rebuked his host tacitly by confining himself to olives.",
    ref: "2.129",
    certainty: "asserted",
  },
  {
    id: "menedemus-crates-locked-up",
    philosopher: "Menedemus of Eretria",
    topic: "encounter",
    gloss:
      "Attacked by Crates for meddling in politics, he has him locked up - and Crates, undeterred, watches for him on tiptoe and calls him a pocket Agamemnon.",
    grc:
      "καί ποτε Κράτητος περιισταμένου αὐτὸν καὶ καθαπτομένου εἰς τὸ ὅτι πολιτεύεται, ἐκέλευσέ τισιν εἰς τὸ δεσμωτήριον αὐτὸν ἐμβαλεῖν· τὸν δὲ μηδὲν ἧττον τηρεῖν παριόντα καὶ ὑπερκύπτοντα Ἀγαμεμνόνειόν τε καὶ Ἡγησίπολιν ἀποκαλεῖν.",
    en: "And once, when Crates stood about him and attacked him for meddling in politics, he ordered certain men to have Crates locked up. But Crates none the less watched him as he went by and, standing on tiptoe, called him a pocket Agamemnon and Hegesipolis.",
    ref: "2.131",
    involves: "Crates",
    certainty: "asserted",
  },
  {
    id: "menedemus-tainted-meat",
    philosopher: "Menedemus of Eretria",
    topic: "eccentricity",
    gloss:
      "At an inn he inadvertently eats meat that had been thrown away and turns sick and pale on learning it - until Asclepiades points out that it is not the meat but his suspicion of it that disturbs him.",
    grc:
      "σὺν γοῦν Ἀσκληπιάδῃ κατʼ ἄγνοιαν ἐν πανδοκείῳ ποτὲ κρεάτων ῥιπτουμένων φαγών, ἐπειδὴ μάθοι, ἐναυτία τε καὶ ὠχρία· ἕως Ἀσκληπιάδης ἐπετίμησεν αὐτῷ ὡς οὐδὲν [εἰπὼν] ἠνώχλησεν αὐτὸν τὰ κρέα, ἀλλʼ ἡ περὶ τούτων ὑπόνοια.",
    en: "At all events once, when he was at an inn with Asclepiades and had inadvertently eaten some meat which had been thrown away, he turned sick and pale when he learnt the fact, until Asclepiades rebuked him, saying that it was not the meat which disturbed him but merely his suspicion of it.",
    ref: "2.132",
    involves: "Asclepiades",
    certainty: "asserted",
  },
  {
    id: "menedemus-door-still-open",
    philosopher: "Menedemus of Eretria",
    topic: "encounter",
    gloss:
      "After Asclepiades' death, when the pupils refuse his old favourite admittance to a party, Menedemus orders them to let him in: even under the earth, Asclepiades opens the door for him.",
    grc:
      "ὅτε καὶ μετὰ χρόνον ἐλθόντος ἐπὶ κῶμον ἐρωμένου τοῦ Ἀσκληπιάδου καὶ τῶν νεανίσκων ἀποκλειόντων αὐτόν, ὁ Μενέδημος ἐκέλευσεν εἰσδέξασθαι, εἰπὼν ὅτι Ἀσκληπιάδης αὐτῷ καὶ κατὰ γῆς ὢν τὰς θύρας ἀνοίγει.",
    en: "Some time afterwards a favourite of Asclepiades, having come to a party and being refused admittance by the pupils, Menedemus ordered them to admit him, saying that even now, when under the earth, Asclepiades opened the door for him.",
    ref: "2.138",
    involves: "Asclepiades",
    certainty: "asserted",
    framesSaying: "menedemus-asclepiades-door",
  },
  {
    id: "menedemus-tribute-reduced",
    philosopher: "Menedemus of Eretria",
    topic: "legacy",
    gloss:
      "Entrusted with the government of Eretria and honoured as envoy to the kings, he persuades Demetrius to cut the city's yearly tribute of two hundred talents by fifty.",
    grc:
      "ἐπρέσβευσε δὲ καὶ πρὸς Πτολεμαῖον καὶ Λυσίμαχον, τιμώμενος πανταχοῦ· οὐ μὴν ἀλλὰ καὶ πρὸς Δημήτριον. καὶ τῆς πόλεως διακόσια τάλαντα τελούσης πρὸς ἔτος αὐτῷ, τὰ πεντήκοντα ἀφεῖλε·",
    en: "He was sent as envoy to Ptolemy and to Lysimachus, being honoured wherever he went. He was, moreover, envoy to Demetrius, and he caused the yearly tribute of two hundred talents which the city used to pay Demetrius to be reduced by fifty talents.",
    ref: "2.140",
    involves: "Demetrius",
    certainty: "asserted",
  },
  {
    id: "menedemus-death-accounts",
    philosopher: "Menedemus of Eretria",
    topic: "death",
    gloss:
      "Suspected of betraying Eretria to Antigonus and driven from the temple at Oropus over missing golden goblets, he comes to Antigonus' court and dies of a broken heart - so Hermippus; Heraclides has him starve himself in seven days.",
    grc:
      "Διὰ ταῦτα δὴ καὶ τὴν ἄλλην φιλίαν ὑποπτευθεὶς προδιδόναι τὴν πόλιν αὐτῷ, διαβάλλοντος Ἀριστοδήμου ὑπεξῆλθε· καὶ διέτριβεν ἐν Ὠρωπῷ ἐν τῷ τοῦ Ἀμφιάρεω ἱερῷ· ἔνθα χρυσῶν ποτηρίων ἀπολομένων, καθά φησιν Ἕρμιππος, δόγματι κοινῷ τῶν Βοιωτῶν ἐκελεύσθη μετελθεῖν. ἐντεῦθεν ἀθυμήσας λαθραίως παρεισδὺς εἰς τὴν πατρίδα καὶ τήν τε γυναῖκα καὶ τὰς θυγατέρας παραλαβὼν πρὸς Ἀντίγονον ἐλθὼν ἀθυμίᾳ τὸν βίον κατέστρεψε.",
    en: "On these grounds, then, and from his friendship for him in other matters, he was suspected of betraying the city to Antigonus, and, being denounced by Aristodemus, withdrew from Eretria and stayed awhile in Oropus in the temple of Amphiaraus. And, because some golden goblets were missing from the temple, he was ordered to depart by a general vote of the Boeotians, as is stated by Hermippus; and thereupon in despair, after a secret visit to his native city, he took with him his wife and daughters and came to the court of Antigonus, where he died of a broken heart.",
    ref: "2.142",
    involves: "Antigonus",
    certainty: "disputed",
    accordingTo: "Hermippus",
    note: "Heraclides (2.143) tells quite another story: falsely accused after more than once saving the city from tyranny, he went to Antigonus to win back his country's freedom and, failing, ended his life by abstaining from food for seven days; Antigonus of Carystus gives a similar account.",
  },
];
