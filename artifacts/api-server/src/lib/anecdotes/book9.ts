/**
 * Book 9 anecdotes - Heraclitus, Xenophanes, Parmenides, Zeno of Elea,
 * Democritus, Protagoras, Anaxarchus, Pyrrho, Timon.
 * Narrated incidents only; bare dicta live in the sayings layer (see the
 * overlap policy in anecdotes.ts). Every `en` is a verbatim Hicks excerpt of
 * the cited section, enforced by validate-anecdotes.
 *
 * Curation notes: the Heraclitus–Darius exchange (9.13-14) is NOT curated
 * here - the correspondence is quoted verbatim and already lives in the
 * epistles layer. The Empedocles–Xenophanes exchange (9.20) and the Zeno
 * abuse/praise retort (9.29) are bare dicta with no surrounding narrative
 * and stay in the sayings layer alone. Attributions to Antisthenes of
 * Rhodes ("in his Successions", 9.6, 9.27, 9.38-39) never go into
 * accordingTo - the label would collide with Antisthenes the Cynic; the
 * same holds for Sotion, Demetrius, Athenodorus, Posidonius and
 * Eratosthenes, none of which is an existing source node. Melissus (9.24)
 * and Diogenes of Apollonia (9.57) yield no narrated incident beyond a
 * one-line notice. Leucippus and Parmenides' doxography give nothing
 * narrative; Parmenides contributes only the Ameinias shrine.
 */
import type { Anecdote } from "../anecdotes";

export const BOOK9_ANECDOTES: Anecdote[] = [
  {
    id: "heraclitus-refuses-lawgiving",
    philosopher: "Heraclitus",
    topic: "defiance",
    gloss:
      "Requested by the Ephesians to make laws for them, Heraclitus scorns the request - the state is already in the grip of a bad constitution.",
    grc:
      "ἀξιούμενος δὲ καὶ νόμους θεῖναι πρὸς αὐτῶν ὑπερεῖδε διὰ τὸ ἤδη κεκρατῆσθαι τῇ πονηρᾷ πολιτείᾳ τὴν πόλιν.",
    en: "And when he was requested by them to make laws, he scorned the request because the state was already in the grip of a bad constitution.",
    ref: "9.2",
    certainty: "asserted",
    note: "The same chapter preserves his fury at the banishment of his friend Hermodorus, 'the worthiest man among them' (9.2).",
  },
  {
    id: "heraclitus-knucklebones-retirement",
    philosopher: "Heraclitus",
    topic: "defiance",
    gloss:
      "Heraclitus retires to the temple of Artemis to play knuckle-bones with the boys - and when the Ephesians stand round staring, asks why they are astonished: is this not better than taking part in their civil life?",
    grc:
      "ἀναχωρήσας δʼ εἰς τὸ ἱερὸν τῆς Ἀρτέμιδος μετὰ τῶν παίδων ἠστραγάλιζε· περιστάντων δʼ αὐτὸν τῶν Ἐφεσίων, τί, ὦ κάκιστοι, θαυμάζετε; εἶπεν· ἢ οὐ κρεῖττον τοῦτο ποιεῖν ἢ μεθʼ ὑμῶν πολιτεύεσθαι;",
    en: "He would retire to the temple of Artemis and play at knuckle-bones with the boys; and when the Ephesians stood round him and looked on, Why, you rascals, he said, are you astonished? Is it not better to do this than to take part in your civil life?",
    ref: "9.3",
    certainty: "asserted",
    framesSaying: "heraclitus-knucklebones",
  },
  {
    id: "heraclitus-cowshed-death",
    philosopher: "Heraclitus",
    topic: "death",
    gloss:
      "Grown a hater of his kind, Heraclitus lives on the mountains on grass and herbs until dropsy drives him back; when the physicians cannot solve his riddle - can they create a drought after heavy rain? - he buries himself in a cowshed, hoping the manure's warmth will draw the humour out, and dies at sixty.",
    grc:
      "Καὶ τέλος μισανθρωπήσας καὶ ἐκπατήσας ἐν τοῖς ὄρεσι διητᾶτο, πόας σιτούμενος καὶ βοτάνας. καὶ μέντοι καὶ διὰ τοῦτο περιτραπεὶς εἰς ὕδερον κατῆλθεν εἰς ἄστυ καὶ τῶν ἰατρῶν αἰνιγματωδῶς ἐπυνθάνετο εἰ δύναιντʼ ἐξ ἐπομβρίας αὐχμὸν ποιῆσαι· τῶν δὲ μὴ συνιέντων, αὑτὸν εἰς βουστάσιον κατορύξας τῇ τῶν βολίτων ἀλέᾳ ἤλπισεν ἐξατμισθήσεσθαι. οὐδὲν δʼ ἀνύων οὐδʼ οὕτως, ἐτελεύτα βιοὺς ἔτη ἑξήκοντα.",
    en: "Finally, he became a hater of his kind and wandered on the mountains, and there he continued to live, making his diet of grass and herbs. However, when this gave him dropsy, he made his way back to the city and put this riddle to the physicians, whether they were competent to create a drought after heavy rain. They could make nothing of this, whereupon he buried himself in a cowshed, expecting that the noxious damp humour would be drawn out of him by the warmth of the manure. But, as even this was of no avail, he died at the age of sixty.",
    ref: "9.3",
    certainty: "asserted",
    note: "Rival versions: Hermippus has him plastered with cow-dung in the sun, dying the next day (9.4); Neanthes of Cyzicus has him devoured by dogs, unrecognizable under the dung (9.4); Ariston says he was cured of the dropsy and died of another disease (9.5).",
  },
  {
    id: "heraclitus-renounces-kingship",
    philosopher: "Heraclitus",
    topic: "asceticism",
    gloss:
      "As proof of his magnanimity, Heraclitus renounces his claim to the kingship in favour of his brother.",
    grc:
      "σημεῖον δʼ αὐτοῦ τῆς μεγαλοφροσύνης Ἀντισθένης φησὶν ἐν Διαδοχαῖς· ἐκχωρῆσαι γὰρ τἀδελφῷ τῆς βασιλείας.",
    en: "As a proof of his magnanimity Antisthenes in his Successions of Philosophers cites the fact that he renounced his claim to the kingship in favour of his brother.",
    ref: "9.6",
    certainty: "reported",
    note: "Antisthenes here is the Successions author (of Rhodes), not the Cynic; the attribution stays in the excerpt.",
  },
  {
    id: "xenophanes-banished-from-colophon",
    philosopher: "Xenophanes",
    topic: "exile",
    gloss:
      "Banished from his native Colophon, Xenophanes lives at Zancle in Sicily, joins the colony planted at Elea and teaches there, and lives also in Catana.",
    grc:
      "οὗτος ἐκπεσὼν τῆς πατρίδος ἐν Ζάγκλῃ τῆς Σικελίας * * * διέτριβε δὲ καὶ ἐν Κατάνῃ.",
    en: "He was banished from his native city and lived at Zancle in Sicily [and having joined the colony planted at Elea taught there]. He also lived in Catana.",
    ref: "9.18",
    certainty: "asserted",
  },
  {
    id: "xenophanes-sold-into-slavery",
    philosopher: "Xenophanes",
    topic: "capture",
    gloss:
      "Xenophanes is believed to have been sold into slavery - and set free by the Pythagoreans Parmeniscus and Orestades.",
    grc:
      "δοκεῖ δὲ πεπρᾶσθαι ὑπὸ * * 〈καὶ λελύσθαι ὑπὸ〉 τῶν Πυθαγορικῶν Παρμενίσκου καὶ Ὀρεστάδου, καθά φησι Φαβωρῖνος ἐν Ἀπομνημονευμάτων πρώτῳ.",
    en: "He is believed to have been sold into slavery by [... and to have been set free by] the Pythagoreans Parmeniscus and Orestades: so Favorinus in the first book of his Memorabilia.",
    ref: "9.20",
    certainty: "reported",
    accordingTo: "Favorinus",
    note: "The same section has him burying his sons with his own hands, like Anaxagoras (9.20).",
  },
  {
    id: "parmenides-shrine-to-ameinias",
    philosopher: "Parmenides",
    topic: "conversion",
    gloss:
      "Parmenides, of illustrious birth and great wealth, follows the poor Pythagorean Ameinias rather than Xenophanes - and on Ameinias' death builds a shrine to him, for it was Ameinias who led him to adopt the peaceful life of a student.",
    grc:
      "ἐκοινώνησε δὲ καὶ Ἀμεινίᾳ Διοχαίτα τῷ Πυθαγορικῷ, ὡς ἔφη Σωτίων, ἀνδρὶ πένητι μέν, καλῷ δὲ καὶ ἀγαθῷ. ᾧ καὶ μᾶλλον ἠκολούθησε καὶ ἀποθανόντος ἡρῷον ἱδρύσατο γένους τε ὑπάρχων λαμπροῦ καὶ πλούτου, καὶ ὑπʼ Ἀμεινίου ἀλλʼ οὐχ ὑπὸ Ξενοφάνους εἰς ἡσυχίαν προετράπη.",
    en: "According to Sotion he also associated with Ameinias the Pythagorean, who was the son of Diochaetas and a worthy gentleman though poor. This Ameinias he was more inclined to follow, and on his death he built a shrine to him, being himself of illustrious birth and possessed of great wealth; moreover it was Ameinias and not Xenophanes who led him to adopt the peaceful life of a student.",
    ref: "9.21",
    involves: "Ameinias",
    certainty: "reported",
    note: "Sotion is not an existing source node; the attribution stays in the excerpt.",
  },
  {
    id: "zeno-elea-bites-ear",
    philosopher: "Zeno of Elea",
    topic: "death",
    gloss:
      "Arrested for plotting to overthrow the tyrant Nearchus, Zeno denounces the tyrant's own friends, then - saying he has something for his private ear - seizes it with his teeth and does not let go until stabbed to death.",
    grc:
      "καθελεῖν δὲ θελήσας Νέαρχον τὸν τύραννον—οἱ δὲ Διομέδοντα—συνελήφθη, καθά φησιν Ἡρακλείδης ἐν τῇ Σατύρου ἐπιτομῇ. ὅτε καὶ ἐξεταζόμενος τοὺς συνειδότας καὶ περὶ τῶν ὅπλων ὧν ἦγεν εἰς Λιπάραν, πάντας ἐμήνυσεν αὐτοῦ τοὺς φίλους, βουλόμενος αὐτὸν ἔρημον καταστῆσαι· εἶτα περί τινων εἰπεῖν ἔχειν τινα 〈ἔφη〉 αὐτῷ πρὸς τὸ οὖς καὶ δακὼν οὐκ ἀνῆκεν ἕως ἀπεκεντήθη, ταὐτὸν Ἀριστογείτονι τῷ τυραννοκτόνῳ παθών.",
    en: "he plotted to overthrow Nearchus the tyrant (or, according to others, Diomedon) but was arrested: so Heraclides in his epitome of Satyrus. On that occasion he was crossexamined as to his accomplices and about the arms which he was conveying to Lipara; he denounced all the tyrant’s own friends, wishing to make him destitute of supporters. Then, saying that he had something to tell him about certain people in his private ear, he laid hold of it with his teeth and did not let go until stabbed to death, meeting the same fate as Aristogiton the tyrannicide.",
    ref: "9.26",
    involves: "Nearchus",
    certainty: "reported",
    accordingTo: "Heraclides",
    note: "Heraclides Lembus, in his epitome of Satyrus. Demetrius says it was the nose, not the ear, that he bit off (9.27).",
  },
  {
    id: "zeno-elea-bites-off-tongue",
    philosopher: "Zeno of Elea",
    topic: "defiance",
    gloss:
      "Asked by the tyrant whether anyone else is in the plot, Zeno answers 'Yes, you, the curse of the city!', shames the bystanders for their cowardice, and at last bites off his tongue and spits it at him - whereupon the citizens stone the tyrant to death.",
    grc:
      "Ἀντισθένης δὲ ἐν ταῖς Διαδοχαῖς φησι μετὰ τὸ μηνῦσαι τοὺς φίλους ἐρωτηθῆναι πρὸς τοῦ τυράννου εἴ τις ἄλλος εἴη· τὸν δὲ εἰπεῖν, σὺ ὁ τῆς πόλεως ἀλιτήριος. πρός τε τοὺς παρεστῶτας φάναι· θαυμάζω ὑμῶν τὴν δειλίαν, εἰ τούτων ἕνεκεν ὧν νῦν ἐγὼ ὑπομένω, δουλεύετε τῷ τυράννῳ· καὶ τέλος ἀποτραγόντα τὴν γλῶτταν προσπτύσαι αὐτῷ· τοὺς δὲ πολίτας παρορμηθέντας αὐτίκα τὸν τύραννον καταλεῦσαι.",
    en: "According to Antisthenes in his Successions of Philosophers, after informing against the tyrant’s friends, he was asked by the tyrant whether there was anyone else in the plot; whereupon he replied, Yes, you, the curse of the city! ; and to the bystanders he said, I marvel at your cowardice, that, for fear of any of those things which I am now enduring, you should be the tyrant’s slaves. And at last he bit off his tongue and spat it at him; and his fellow-citizens were so worked upon that they forthwith stoned the tyrant to death.",
    ref: "9.27",
    certainty: "disputed",
    note: "Antisthenes of Rhodes, the Successions author. In this version most authors nearly agree, but Hermippus says Zeno was cast into a mortar and beaten to death (9.27) - the fate D.L.'s own epigram adopts (9.28).",
  },
  {
    id: "democritus-ox-in-study",
    philosopher: "Democritus",
    topic: "training",
    gloss:
      "So great is Democritus' industry that he shuts himself up in a little room in the garden - and when his father ties an ox there for sacrifice, he does not notice it for a considerable time, until his father rouses him.",
    grc:
      "λέγει δʼ ὅτι τοσοῦτον ἦν φιλόπονος ὥστε τοῦ περικήπου δωμάτιόν τι ἀποτεμόμενος κατάκλειστος ἦν· καί ποτε τοῦ πατρὸς αὐτοῦ πρὸς θυσίαν βοῦν ἀγαγόντος καὶ αὐτόθι προσδήσαντος, ἱκανὸν χρόνον μὴ γνῶναι, ἕως αὐτὸν ἐκεῖνος διαναστήσας προφάσει τῆς θυσίας καὶ τὰ περὶ τὸν βοῦν διηγήσατο.",
    en: "His industry, says the same author, was so great that he cut off a little room in the garden round the house and shut himself up there. One day his father brought an ox to sacrifice and tied it there, and he was not aware of it for a considerable time, until his father roused him to attend the sacrifice and told him about the ox.",
    ref: "9.36",
    certainty: "reported",
    note: "Told by Demetrius in his book on Men of the Same Name (9.35-36); not an existing source node, so the attribution stays in the text.",
  },
  {
    id: "democritus-athens-incognito",
    philosopher: "Democritus",
    topic: "asceticism",
    gloss:
      "Democritus goes to Athens and is not anxious to be recognized, because he despises fame - he knows of Socrates, but is not known to Socrates: 'I came to Athens and no one knew me.'",
    grc:
      "δοκεῖ δέ, φησί, καὶ Ἀθήναζε ἐλθεῖν καὶ μὴ σπουδάσαι γνωσθῆναι, δόξης καταφρονῶν. καὶ εἰδέναι μὲν Σωκράτη, ἀγνοεῖσθαι δὲ ὑπʼ αὐτοῦ· ἦλθον γάρ, φησίν, εἰς Ἀθήνας καὶ οὔτις με ἔγνωκεν.",
    en: "Demetrius goes on: It would seem that he also went to Athens and was not anxious to be recognized, because he despised fame, and that while he knew of Socrates, he was not known to Socrates, his words being, I came to Athens and no one knew me.",
    ref: "9.36",
    involves: "Socrates",
    certainty: "reported",
    framesSaying: "democritus-athens-unknown",
    note: "Demetrius of Phalerum, by contrast, affirms that he did not even visit Athens (9.37).",
  },
  {
    id: "democritus-frequenting-tombs",
    philosopher: "Democritus",
    topic: "training",
    gloss:
      "Democritus trains himself to test his sense-impressions by going at times into solitude and frequenting tombs.",
    grc:
      "Ἤσκει δέ, φησὶν ὁ Ἀντισθένης, καὶ ποικίλως δοκιμάζειν τὰς φαντασίας, ἐρημάζων ἐνίοτε καὶ τοῖς τάφοις ἐνδιατρίβων.",
    en: "He would train himself, says Antisthenes, by a variety of means to test his sense-impressions by going at times into solitude and frequenting tombs.",
    ref: "9.38",
    certainty: "reported",
    note: "Antisthenes of Rhodes, the Successions author, not the Cynic.",
  },
  {
    id: "democritus-diacosmos-reading",
    philosopher: "Democritus",
    topic: "legacy",
    gloss:
      "Fearing the law that no squanderer of his patrimony may be buried in his native city, Democritus reads aloud to the people the Great Diacosmos, best of all his works - and is rewarded with 500 talents, bronze statues, and at death a public funeral.",
    grc:
      "νόμου δʼ ὄντος τὸν ἀναλώσαντα τὴν πατρῴαν οὐσίαν μὴ ἀξιοῦσθαι ταφῆς ἐν τῇ πατρίδι, φησὶν ὁ Ἀντισθένης συνέντα, μὴ ὑπεύθυνος γενηθείη πρός τινων φθονούντων καὶ συκοφαντούντων, ἀναγνῶναι αὐτοῖς τὸν Μέγαν διάκοσμον, ὃς ἁπάντων αὐτοῦ τῶν συγγραμμάτων προέχει· καὶ πεντακοσίοις ταλάντοις τιμηθῆναι· μὴ μόνον δέ, ἀλλὰ καὶ χαλκαῖς εἰκόσι· καὶ τελευτήσαντʼ αὐτὸν δημοσίᾳ ταφῆναι, βιώσαντα ὑπὲρ τὰ ἑκατὸν ἔτη.",
    en: "There was a law, says Antisthenes, that no one who had squandered his patrimony should be buried in his native city. Democritus, understanding this, and fearing lest he should be at the mercy of any envious or unscrupulous prosecutors, read aloud to the people his treatise, the Great Diacosmos , the best of all his works; and then he was rewarded with 500 talents; and, more than that, with bronze statues as well; and when he died, he received a public funeral after a lifetime of more than a century.",
    ref: "9.39",
    certainty: "reported",
    note: "Demetrius says it was his relatives who read it and the award was only 100 talents, with which account Hippobotus agrees (9.40).",
  },
  {
    id: "democritus-plato-burn-books",
    philosopher: "Democritus",
    topic: "legacy",
    gloss:
      "Plato wishes to burn all the writings of Democritus he can collect, but the Pythagoreans Amyclas and Clinias prevent him - the books are already widely circulated; and Plato, who mentions almost all the early philosophers, never once alludes to Democritus.",
    grc:
      "Ἀριστόξενος δʼ ἐν τοῖς Ἱστορικοῖς ὑπομνήμασί φησι Πλάτωνα θελῆσαι συμφλέξαι τὰ Δημοκρίτου συγγράμματα, ὁπόσα ἐδυνήθη συναγαγεῖν, Ἀμύκλαν δὲ καὶ Κλεινίαν τοὺς Πυθαγορικοὺς κωλῦσαι αὐτόν, ὡς οὐδὲν ὄφελος· παρὰ πολλοῖς γὰρ εἶναι ἤδη τὰ βιβλία.",
    en: "Aristoxenus in his Historical Notes affirms that Plato wished to burn all the writings of Democritus that he could collect, but that Amyclas and Clinias the Pythagoreans prevented him, saying that there was no advantage in doing so, for already the books were widely circulated.",
    ref: "9.40",
    involves: "Plato",
    certainty: "reported",
    accordingTo: "Aristoxenus",
  },
  {
    id: "democritus-black-goat-milk",
    philosopher: "Democritus",
    topic: "wit",
    gloss:
      "When Hippocrates comes to see him, Democritus pronounces the milk brought to be from a black she-goat with her first kid - and greets Hippocrates' maidservant on the first day with 'Good morning, maiden', the next with 'Good morning, woman'.",
    grc:
      "Φησὶ δʼ Ἀθηνόδωρος ἐν ὀγδόῃ Περιπάτων, ἐλθόντος Ἱπποκράτους πρὸς αὐτόν, κελεῦσαι κομισθῆναι γάλα· καὶ θεασάμενον τὸ γάλα εἰπεῖν εἶναι αἰγὸς πρωτοτόκου καὶ μελαίνης· ὅθεν τὴν ἀκρίβειαν αὐτοῦ θαυμάσαι τὸν Ἱπποκράτην. ἀλλὰ καὶ κόρης ἀκολουθούσης τῷ Ἱπποκράτει, τῇ μὲν πρώτῃ ἡμέρᾳ ἀσπάσασθαι οὕτω χαῖρε κόρη, τῇ δʼ ἐχομένῃ χαῖρε γύναι · καὶ ἦν ἡ κόρη τῆς νυκτὸς διεφθαρμένη.",
    en: "Athenodorus in the eighth book of his Walks relates that, when Hippocrates came to see him, he ordered milk to be brought, and, having inspected it, pronounced it to be the milk of a black she-goat which had produced her first kid; which made Hippocrates marvel at the accuracy of his observation. Moreover, Hippocrates being accompanied by a maidservant, on the first day Democritus greeted her with Good morning, maiden, but the next day with Good morning, woman, As a matter of fact the girl had been seduced in the night.",
    ref: "9.42",
    involves: "Hippocrates",
    certainty: "reported",
  },
  {
    id: "democritus-hot-loaves-death",
    philosopher: "Democritus",
    topic: "death",
    gloss:
      "Very old and near his end, Democritus outlives the Thesmophoria for his sister's sake by applying hot loaves to his nostrils - and as soon as the three festival days pass, lets his life go from him without pain, at one hundred and nine.",
    grc:
      "ἤδη ὑπέργηρων ὄντα πρὸς τῷ καταστρέφειν εἶναι. τὴν οὖν ἀδελφὴν λυπεῖσθαι ὅτι ἐν τῇ τῶν θεσμοφόρων ἑορτῇ μέλλοι τεθνήξεσθαι καὶ τῇ θεῷ τὸ καθῆκον αὐτὴ οὐ ποιήσειν τὸν δὲ θαρρεῖν εἰπεῖν καὶ κελεῦσαι αὑτῷ προσφέρειν ἄρτους θερμοὺς ὁσημέραι. τούτους δὴ ταῖς ῥισὶ προσφέρων διεκράτησεν αὑτὸν τὴν ἑορτήν· ἐπειδὴ δὲ παρῆλθον αἱ ἡμέραι, τρεῖς δʼ ἦσαν, ἀλυπότατα τὸν βίον προήκατο, ὥς φησιν ὁ Ἵππαρχος, ἐννέα πρὸς τοῖς ἑκατὸν ἔτη βιούς.",
    en: "When he was now very old and near his end, his sister was vexed that he seemed likely to die during the festival of Thesmophoria and she would be prevented from paying the fitting worship to the goddess. He bade her be of good cheer and ordered hot loaves to be brought to him every day. By applying these to his nostrils he contrived to outlive the festival; and as soon as the three festival days were passed he let his life go from him without pain, having then, according to Hipparchus, attained his one hundred and ninth year.",
    ref: "9.43",
    certainty: "reported",
    accordingTo: "Hermippus",
    note: "D.L.'s own epigram admires the feat: 'When Death was near, for three days he kept him in his house and regaled him with the steam of hot loaves' (9.43).",
  },
  {
    id: "protagoras-books-burned",
    philosopher: "Protagoras",
    topic: "exile",
    gloss:
      "For the agnostic opening of his book On the Gods, the Athenians expel Protagoras - and burn his works in the market-place, after sending round a herald to collect them from all who had copies.",
    grc:
      "διὰ ταύτην δὲ τὴν ἀρχὴν τοῦ συγγράμματος ἐξεβλήθη πρὸς Ἀθηναίων· καὶ τὰ βιβλίʼ αὐτοῦ κατέκαυσαν ἐν τῇ ἀγορᾷ, ὑπὸ κήρυκι ἀναλεξάμενοι παρʼ ἑκάστου τῶν κεκτημένων.",
    en: "For this introduction to his book the Athenians expelled him; and they burnt his works in the market-place, after sending round a herald to collect them from all who had copies in their possession.",
    ref: "9.52",
    certainty: "asserted",
    note: "The introduction in question is the curated saying protagoras-gods-unknowable (9.51). Philochorus adds that his ship went down on the voyage to Sicily (9.55).",
  },
  {
    id: "protagoras-porter-of-abdera",
    philosopher: "Protagoras",
    topic: "conversion",
    gloss:
      "Protagoras, once a porter who invented the shoulder-pad on which porters carry their burdens, is taken up by Democritus - who sees how skilfully his bundles of wood are tied.",
    grc:
      "καὶ πρῶτος τὴν καλουμένην τύλην, ἐφʼ ἧς τὰ φορτία βαστάζουσιν, εὗρεν, ὥς φησιν Ἀριστοτέλης ἐν τῷ Περὶ παιδείας· φορμοφόρος γὰρ ἦν, ὡς καὶ Ἐπίκουρός πού φησι. καὶ τοῦτον τὸν τρόπον ἤρθη πρὸς Δημοκρίτου ξύλα δεδεκὼς ὀφθείς.",
    en: "He too invented the shoulder-pad on which porters carry their burdens, so we are told by Aristotle in his treatise On Education ; for he himself had been a porter, says Epicurus somewhere. This was how he was taken up by Democritus, who saw how skilfully his bundles of wood were tied.",
    ref: "9.53",
    involves: "Democritus",
    certainty: "reported",
  },
  {
    id: "protagoras-euathlus-fee",
    philosopher: "Protagoras",
    topic: "wit",
    gloss:
      "Asking his disciple Euathlus for his fee and told 'But I have not won a case yet', Protagoras replies: if I win this case against you I must have the fee for winning it; if you win, I must have it because you win it.",
    grc:
      "Λέγεται δέ ποτʼ αὐτὸν ἀπαιτοῦντα τὸν μισθὸν Εὔαθλον τὸν μαθητήν, ἐκείνου εἰπόντος, ἀλλʼ οὐδέπω νίκην νενίκηκα, εἰπεῖν, ἀλλʼ ἐγὼ μὲν ἂν νικήσω, ὅτι ἐγὼ ἐνίκησα, λαβεῖν με δεῖ· ἐὰν δὲ σύ, ὅτι σύ.",
    en: "The story is told that once, when he asked Euathlus his disciple for his fee, the latter replied, But I have not won a case yet. Nay, said Protagoras, if I win this case against you I must have the fee, for winning it; if you win, I must have it, because you win it.",
    ref: "9.56",
    involves: "Euathlus",
    certainty: "reported",
  },
  {
    id: "anaxarchus-satraps-head-banquet",
    philosopher: "Anaxarchus",
    topic: "defiance",
    gloss:
      "At a banquet, asked by Alexander how he likes the feast, Anaxarchus answers that only one thing is lacking - that the head of some satrap should be served up at table: a hit at Nicocreon, tyrant of Cyprus, who never forgets it.",
    grc:
      "καὶ εἶχεν ἐχθρὸν Νικοκρέοντα τὸν Κύπρου τύραννον· καί ποτʼ ἐν συμποσίῳ τοῦ Ἀλεξάνδρου ἐρωτήσαντος αὐτὸν τί ἄρα δοκεῖ τὸ δεῖπνον, εἰπεῖν φασιν, ὦ βασιλεῦ, πάντα πολυτελῶς· ἔδει δὲ λοιπὸν κεφαλὴν σατράπου τινὸς παρατεθεῖσθαι·",
    en: "He made an enemy of Nicocreon, tyrant of Cyprus. Once at a banquet, when asked by Alexander how he liked the feast, he is said to have answered, Everything, O king, is magnificent; there is only one thing lacking, that the head of some satrap should be served up at table.",
    ref: "9.58",
    involves: "Alexander",
    certainty: "reported",
    framesSaying: "anaxarchus-satraps-head",
  },
  {
    id: "anaxarchus-mortar-death",
    philosopher: "Anaxarchus",
    topic: "death",
    gloss:
      "Forced against his will to land in Cyprus after Alexander's death, Anaxarchus is seized by Nicocreon and pounded to death in a mortar with iron pestles - making light of it: 'Pound, pound the pouch containing Anaxarchus; ye pound not Anaxarchus' - and when his tongue is to be cut out, bites it off and spits it at him.",
    grc:
      "ὁ δὲ μνησικακήσας μετὰ τὴν τελευτὴν τοῦ βασιλέως ὅτε πλέων ἀκουσίως προσηνέχθη τῇ Κύπρῳ ὁ Ἀνάξαρχος, συλλαβὼν αὐτὸν καὶ εἰς ὅλμον βαλὼν ἐκέλευσε τύπτεσθαι σιδηροῖς ὑπέροις. τὸν δʼ οὐ φροντίσαντα τῆς τιμωρίας εἰπεῖν ἐκεῖνο δὴ τὸ περιφερόμενον, πτίσσε τὸν Ἀναξάρχου θύλακον, Ἀνάξαρχον δὲ οὐ πτίσσεις. κελεύσαντος δὲ τοῦ Νικοκρέοντος καὶ τὴν γλῶτταν αὐτοῦ ἐκτμηθῆναι, λόγος ἀποτραγόντα προσπτύσαι αὐτῷ.",
    en: "when after the king’s death Anaxarchus was forced against his will to land in Cyprus, he seized him and, putting him in a mortar, ordered him to be pounded to death with iron pestles. But he, making light of the punishment, made that well-known speech, Pound, pound the pouch containing Anaxarchus; ye pound not Anaxarchus. And when Nicocreon commanded his tongue to be cut out, they say he bit it off and spat it at him.",
    ref: "9.59",
    involves: "Nicocreon",
    certainty: "asserted",
    framesSaying: "anaxarchus-pound-the-pouch",
  },
  {
    id: "anaxarchus-diverts-alexander",
    philosopher: "Anaxarchus",
    topic: "wit",
    gloss:
      "When Alexander begins to think himself a god, Anaxarchus points to the blood running from the king's wound: 'See, there is blood and not Ichor which courses in the veins of the blessed gods.'",
    grc:
      "τὸν γοῦν Ἀλέξανδρον οἰόμενον εἶναι θεὸν ἐπέστρεψεν· ἐπειδὴ γὰρ ἔκ τινος πληγῆς εἶδεν αὐτῷ καταρρέον αἷμα, δείξας τῇ χειρὶ πρὸς αὐτόν φησι, τουτὶ μὲν αἷμα καὶ οὐκ ἰχὼρ οἷός πέρ τε ῥέει μακάρεσσι θεοῖσι.",
    en: "At all events he succeeded in diverting Alexander when he had begun to think himself a god; for, seeing blood running from a wound he had sustained, he pointed to him with his finger and said, See, there is blood and not Ichor which courses in the veins of the blessed gods.",
    ref: "9.60",
    involves: "Alexander",
    certainty: "disputed",
    framesSaying: "anaxarchus-blood-not-ichor",
    note: "Plutarch reports this as spoken by Alexander himself to his friends (9.60).",
  },
  {
    id: "pyrrho-heedless-of-dangers",
    philosopher: "Pyrrho",
    topic: "eccentricity",
    gloss:
      "Living out his suspension of judgement, Pyrrho goes out of his way for nothing and takes no precaution - facing carts, precipices and dogs as they come, kept out of harm's way only by the friends who follow close after him.",
    grc:
      "Ἀκόλουθος δʼ ἦν καὶ τῷ βίῳ, μηδὲν ἐκτρεπόμενος μηδὲ φυλαττόμενος, ἅπαντα ὑφιστάμενος, ἁμάξας, εἰ τύχοι, καὶ κρημνοὺς καὶ κύνας καὶ ὅλως μηδὲν ταῖς αἰσθήσεσιν ἐπιτρέπων. σώζεσθαι μέντοι, καθά φασιν οἱ περὶ τὸν Καρύστιον Ἀντίγονον, ὑπὸ τῶν γνωρίμων παρακολουθούντων.",
    en: "He led a life consistent with this doctrine, going out of his way for nothing, taking no precaution, but facing all risks as they came, whether carts, precipices, dogs or what not, and, generally, leaving nothing to the arbitrament of the senses; but he was kept out of harm’s way by his friends who, as Antigonus of Carystus tells us, used to follow close after him.",
    ref: "9.62",
    certainty: "reported",
    accordingTo: "Antigonus of Carystus",
    note: "Aenesidemus counters that only his philosophy rested on suspension of judgement - in his everyday acts he did not lack foresight (9.62).",
  },
  {
    id: "pyrrho-indian-rebuke-solitude",
    philosopher: "Pyrrho",
    topic: "asceticism",
    gloss:
      "Pyrrho withdraws from the world and lives in solitude, rarely showing himself to his relatives - because he heard an Indian reproach Anaxarchus that he would never teach others what is good while dancing attendance on kings in their courts.",
    grc:
      "ἐκπατεῖν τʼ αὐτὸν καὶ ἐρημάζειν, σπανίως ποτʼ ἐπιφαινόμενον τοῖς οἴκοι. τοῦτο δὲ ποιεῖν ἀκούσαντα Ἰνδοῦ τινος ὀνειδίζοντος Ἀναξάρχῳ ὡς οὐκ ἂν ἕτερόν τινα διδάξαι οὗτος ἀγαθόν, αὐτὸς αὐλὰς βασιλικὰς θεραπεύων.",
    en: "He would withdraw from the world and live in solitude, rarely showing himself to his relatives; this he did because he had heard an Indian reproach Anaxarchus, telling him that he would never be able to teach others what is good while he himself danced attendance on kings in their courts.",
    ref: "9.63",
    involves: "Anaxarchus",
    certainty: "reported",
    note: "From Antigonus of Carystus' book on Pyrrho (9.62).",
  },
  {
    id: "pyrrho-passes-anaxarchus-slough",
    philosopher: "Pyrrho",
    topic: "eccentricity",
    gloss:
      "When Anaxarchus falls into a slough, Pyrrho passes by without helping; others blame him - but Anaxarchus himself praises his indifference and sang-froid.",
    grc:
      "καί ποτʼ Ἀναξάρχου εἰς τέλμα ἐμπεσόντος, παρῆλθεν οὐ βοηθήσας· τινῶν δὲ αἰτιωμένων, αὐτὸς Ἀνάξαρχος ἐπῄνει τὸ ἀδιάφορον καὶ ἄστοργον αὐτοῦ.",
    en: "And once, when Anaxarchus fell into a slough, he passed by without giving him any help, and, while others blamed him, Anaxarchus himself praised his indifference and sang-froid.",
    ref: "9.63",
    involves: "Anaxarchus",
    certainty: "reported",
  },
  {
    id: "pyrrho-high-priest-of-elis",
    philosopher: "Pyrrho",
    topic: "legacy",
    gloss:
      "So respected is Pyrrho by his native city that they make him high priest - and on his account vote that all philosophers should be exempt from taxation.",
    grc:
      "οὕτω δʼ αὐτὸν ὑπὸ τῆς πατρίδος τιμηθῆναι ὥστε καὶ ἀρχιερέα καταστῆσαι αὐτὸν καὶ διʼ ἐκεῖνον πᾶσι τοῖς φιλοσόφοις ἀτέλειαν ψηφίσασθαι.",
    en: "he was so respected by his native city that they made him high priest, and on his account they voted that all philosophers should be exempt from taxation.",
    ref: "9.64",
    certainty: "reported",
  },
  {
    id: "pyrrho-sister-market",
    philosopher: "Pyrrho",
    topic: "asceticism",
    gloss:
      "Pyrrho lives in fraternal piety with his sister, a midwife - now and then taking poultry or pigs to market for sale, dusting the things in the house, quite indifferent to what he does, even washing a porker.",
    grc:
      "εὐσεβῶς δὲ καὶ τῇ ἀδελφῇ συνεβίω μαίᾳ οὔσῃ, καθά φησιν Ἐρατοσθένης ἐν τῷ Περὶ πλούτου καὶ πενίας, ὅτε καὶ αὐτὸς φέρων εἰς τὴν ἀγορὰν ἐπίπρασκεν ὀρνίθια, εἰ τύχοι, καὶ χοιρίδια, καὶ τὰ ἐπὶ τῆς οἰκίας ἐκάθαιρεν ἀδιαφόρως. λέγεται δὲ καὶ δέλφακα λούειν αὐτὸς ὑπʼ ἀδιαφορίας.",
    en: "He lived in fraternal piety with his sister, a midwife, so says Eratosthenes in his essay On Wealth and Poverty , now and then even taking things for sale to market, poultry perchance or pigs, and he would dust the things in the house, quite indifferent as to what he did. They say he showed his indifference by washing a porker.",
    ref: "9.66",
    certainty: "reported",
    note: "Eratosthenes is not an existing source node; the attribution stays in the excerpt. The same section has his rage in his sister Philista's cause - the frame of the curated saying pyrrho-strip-human-weakness.",
  },
  {
    id: "pyrrho-pig-in-storm-frame",
    philosopher: "Pyrrho",
    topic: "teaching",
    gloss:
      "When his fellow-passengers are unnerved by a storm at sea, Pyrrho stays calm and points to a little pig on board that goes on eating - such is the unperturbed state in which the wise man should keep himself.",
    grc:
      "Ποσειδώνιος δὲ καὶ τοιοῦτόν τι διέξεισι περὶ αὐτοῦ. τῶν γὰρ συμπλεόντων αὐτῷ ἐσκυθρωπακότων ὑπὸ χειμῶνος, αὐτὸς γαληνὸς ὢν ἀνέρρωσε τὴν ψυχήν, δείξας ἐν τῷ πλοίῳ χοιρίδιον ἐσθίον καὶ εἰπὼν ὡς χρὴ τὸν σοφὸν ἐν τοιαύτῃ καθεστάναι ἀταραξίᾳ.",
    en: "Posidonius, too, relates of him a story of this sort. When his fellow-passengers on board a ship were all unnerved by a storm, he kept calm and confident, pointing to a little pig in the ship that went on eating, and telling them that such was the unperturbed state in which the wise man should keep himself.",
    ref: "9.68",
    certainty: "reported",
    framesSaying: "pyrrho-pig-in-storm",
    note: "Posidonius is not an existing source node; the attribution stays in the excerpt.",
  },
  {
    id: "pyrrho-swims-alpheus",
    philosopher: "Pyrrho",
    topic: "eccentricity",
    gloss:
      "Once in Elis, so hard pressed by his pupils' questions, Pyrrho strips and swims across the Alpheus.",
    grc:
      "καὶ ἐν Ἤλιδι καταπονούμενος ὑπὸ τῶν ζητούντων ἐν τοῖς λόγοις, ἀπορρίψας θοιμάτιον διενήξατο [πέραν] τὸν Ἀλφειόν.",
    en: "Once in Elis he was so hard pressed by his pupils’ questions that he stripped and swam across the Alpheus.",
    ref: "9.69",
    certainty: "asserted",
  },
  {
    id: "timon-stage-dancer-conversion",
    philosopher: "Timon",
    topic: "conversion",
    gloss:
      "Orphaned young, Timon becomes a stage-dancer, then takes a dislike to the pursuit and goes abroad to Megara to stay with Stilpo - and after returning home and marrying, goes with his wife to Pyrrho at Elis.",
    grc:
      "νέον δὲ καταλειφθέντα χορεύειν, ἔπειτα καταγνόντα ἀποδημῆσαι εἰς Μέγαρα πρὸς Στίλπωνα· κἀκείνῳ συνδιατρίψαντα αὖθις ἐπανελθεῖν οἴκαδε καὶ γῆμαι. εἶτα πρὸς Πύρρωνα εἰς Ἦλιν ἀποδημῆσαι μετὰ τῆς γυναικὸς κἀκεῖ διατρίβειν ἕως αὐτῷ παῖδες ἐγένοντο",
    en: "Losing his parents when young, he became a stage-dancer, but later took a dislike to that pursuit and went abroad to Megara to stay with Stilpo; then after some time he returned home and married. After that he went to Pyrrho at Elis with his wife, and lived there until his children were born",
    ref: "9.109",
    involves: "Stilpo",
    certainty: "reported",
    note: "From Apollonides of Nicaea's commentary On the Silli (9.109).",
  },
  {
    id: "timon-careless-poems",
    philosopher: "Timon",
    topic: "eccentricity",
    gloss:
      "Reading his poems to Zopyrus the orator, Timon turns over the pages and recites whatever comes handy - discovering only halfway through the piece he had been looking for in vain; so careless is he that he would readily go without his dinner.",
    grc:
      "ὥστε καὶ Ζωπύρῳ τῷ ῥήτορι ἀναγινώσκοντά τι ἐπιτυλίττειν καὶ κατὰ τὸ ἐπελθὸν διεξιέναι· ἐλθόντα τʼ ἐφʼ ἡμισείας, οὕτως εὑρεῖν τὸ ἀπόσπασμα τέως ἀγνοοῦντα. τοσοῦτον ἦν ἀδιάφορος. ἀλλὰ καὶ εὔρους · ὡς μηδʼ ἀριστᾶν συγχωρεῖν.",
    en: "when he came to read parts of them to Zopyrus the orator, he would turn over the pages and recite whatever came handy; then, when he was half through, he would discover the piece which he had been looking for in vain, so careless was he. Furthermore, he was so easy-going that he would readily go without his dinner.",
    ref: "9.114",
    involves: "Zopyrus",
    certainty: "asserted",
    note: "He used to let his own poems lie about, sometimes half eaten away (9.113).",
  },
  {
    id: "timon-knaves-market",
    philosopher: "Timon",
    topic: "wit",
    gloss:
      "Seeing Arcesilaus passing through the knaves-market, Timon asks: 'What business have you to come here, where we are all free men?'",
    grc:
      "φασὶ δʼ αὐτὸν Ἀρκεσίλαον θεασάμενον διὰ τῶν Κερκώπων ἰόντα, εἰπεῖν, τί σὺ δεῦρο, ἔνθαπερ ἡμεῖς οἱ ἐλεύθεροι;",
    en: "They say that once, when he saw Arcesilaus passing through the knaves-market, he said, What business have you to come here, where we are all free men?",
    ref: "9.114",
    involves: "Arcesilaus",
    certainty: "reported",
    note: "Yet while attacking Arcesilaus in his Silli, he praised him in the Funeral Banquet of Arcesilaus (9.115).",
  },
];
