/**
 * Book 4 anecdotes - the Academy after Plato: Speusippus, Xenocrates,
 * Polemo, Crates of Athens, Crantor, Arcesilaus, Bion, Lacydes, and
 * Carneades. Narrated incidents only; bare dicta live in the sayings layer
 * (see the overlap policy in anecdotes.ts). Every `en` is a verbatim Hicks
 * excerpt of the cited section, enforced by validate-anecdotes.
 *
 * Curation notes: Xenocrates returning Alexander's money (4.8) and the
 * suppliant sparrow (4.10) are not re-curated - their whole substance is
 * already the curated sayings xenocrates-alexander-money and
 * xenocrates-suppliant-sparrow, whose excerpts carry the full narrative.
 * Lacydes' late geometry lesson (4.60) stays a saying (no narrative action
 * beyond the exchange). Clitomachus (4.67) has no narrated incident, only
 * biography. Timotheus (On Lives, the matchmaker quip at 4.4) is cited
 * only here and is not otherwise a claim/saying source, so Speusippus'
 * rich-man quip is left uncurated rather than minting a source node.
 * Carneades' parody at Mentor's expense (4.63-64) spans a section
 * boundary mid-verse and cannot be excerpted whole, so it is left out.
 */
import type { Anecdote } from "../anecdotes";

export const BOOK4_ANECDOTES: Anecdote[] = [
  // --- Speusippus ---
  {
    id: "speusippus-dog-in-well",
    philosopher: "Speusippus",
    topic: "eccentricity",
    gloss:
      "Prone to anger and pleasure unlike Plato, Speusippus flings his favourite dog into the well in a fit of passion - and travels to Macedonia just for Casander's wedding-feast.",
    en: "In character, however, he was unlike him, being prone to anger and easily overcome by pleasures. At any rate there is a story that in a fit of passion he flung his favourite dog into the well, and that pleasure was the sole motive for his journey to Macedonia to be present at the wedding-feast of Casander.",
    grc: "οὐ μὴν τό γʼ ἦθος διέμεινε τοιοῦτος. καὶ γὰρ ὀργίλος καὶ ἡδονῶν ἥττων ἦν. φασὶ γοῦν αὐτὸν ὑπὸ θυμοῦ τὸ κυνίδιον εἰς τὸ φρέαρ ῥῖψαι καὶ ὑφʼ ἡδονῆς ἐλθεῖν εἰς Μακεδονίαν ἐπὶ τὸν Κασάνδρου γάμον.",
    ref: "4.1",
    certainty: "reported",
  },
  {
    id: "speusippus-diogenes-greeting",
    philosopher: "Speusippus",
    topic: "encounter",
    gloss:
      "Conveyed to the Academy in a tiny carriage, the paralytic Speusippus salutes Diogenes - who declines to return the greeting of a man who endures to live in such a plight.",
    en: "They say that, as he was being conveyed to the Academy in a tiny carriage, he met and saluted Diogenes, who replied, Nay, if you can endure to live in such a plight as this, I decline to return your greeting.",
    grc: "φασὶ δὲ αὐτὸν ἐπʼ ἀμαξίου φερόμενον εἰς τὴν Ἀκαδημείαν συναντῆσαι Διογένει καὶ Χαῖρε εἰπεῖν· τὸν δὲ φάναι, ἀλλὰ μὴ σύ γε, ὅστις ὑπομένεις ζῆν τοιοῦτος ὤν.",
    ref: "4.3",
    involves: "Diogenes",
    certainty: "reported",
  },
  {
    id: "speusippus-despair-suicide",
    philosopher: "Speusippus",
    topic: "death",
    gloss:
      "Crippled and despondent in old age, Speusippus puts an end to his own life - though Plutarch makes his malady morbus pedicularis.",
    en: "At last in old age he became so despondent that he put an end to his life.",
    grc: "καὶ τέλος ὑπὸ ἀθυμίας ἑκὼν τὸν βίον μετήλλαξε γηραιὸς ὤν.",
    ref: "4.3",
    certainty: "disputed",
    note: "Plutarch in the Lives of Lysander and Sulla makes his malady morbus pedicularis, and Timotheus says his body wasted away (4.4).",
  },
  // --- Xenocrates ---
  {
    id: "xenocrates-phryne-statue",
    philosopher: "Xenocrates",
    topic: "asceticism",
    gloss:
      "The courtesan Phryne takes refuge under his roof and shares his one small couch - and retires defeated, saying she quitted not a man but a statue.",
    en: "And that once the notorious Phryne tried to make his acquaintance and, as if she were being chased by some people, took refuge under his roof; that he admitted her out of ordinary humanity and, there being but one small couch in the room, permitted her to share it with him, and at last, after many importunities, she retired without success, telling those who inquired that he whom she quitted was not a man but a statue.",
    grc: "καί ποτε καὶ Φρύνην τὴν ἑταίραν ἐθελῆσαι πειρᾶσαι αὐτόν, καὶ δῆθεν διωκομένην ὑπό τινων καταφυγεῖν εἰς τὸ οἰκίδιον. τὸν δὲ ἕνεκα τοῦ ἀνθρωπίνου εἰσδέξασθαι, καὶ ἑνὸς ὄντος κλινιδίου δεομένῃ μεταδοῦναι τῆς κατακλίσεως· καὶ τέλος πολλὰ ἐκλιπαροῦσαν ἄπρακτον ἀναστῆναι. λέγειν τε πρὸς τοὺς πυνθανομένους ὡς οὐκ ἀπʼ ἀνδρός, ἀλλʼ ἀπʼ ἀνδριάντος ἀνασταίη.",
    ref: "4.7",
    involves: "Phryne",
    certainty: "disputed",
    note: "Another version makes the woman Laïs, sent by his pupils to invade his couch (4.7).",
  },
  {
    id: "xenocrates-crown-on-hermes",
    philosopher: "Xenocrates",
    topic: "piety",
    gloss:
      "Awarded a golden crown for his prowess in drinking at Dionysius' Feast of Pitchers, Xenocrates walks out and places it on the statue of Hermes, as he used to place garlands of flowers.",
    en: "And when he had been honoured at the court of Dionysius with a golden crown as the prize for his prowess in drinking at the Feast of Pitchers, he went out and placed it on the statue of Hermes just as he had been accustomed to place there garlands of flowers.",
    grc: "καὶ χρυσῷ στεφάνῳ τιμηθέντα ἐπάθλῳ πολυποσίας τοῖς Χουσὶ παρὰ Διονυσίῳ ἐξιόντα θεῖναι πρὸς τὸν ἱδρυμένον Ἑρμῆν, ἔνθαπερ τιθέναι καὶ τοὺς ἀνθινοὺς εἰώθει.",
    ref: "4.8",
    certainty: "asserted",
  },
  {
    id: "xenocrates-unbribed-envoy",
    philosopher: "Xenocrates",
    topic: "defiance",
    gloss:
      "Denounced for rendering no service on the embassy to Philip, Xenocrates tells the Athenians that Philip knew he alone could not be bought - and the people pay him double honours.",
    en: "Hence, when the envoys returned to Athens, they complained that Xenocrates had accompanied them without rendering any service. Thereupon the people were ready to fine him. But when he told them that now more than ever they ought to consider the interests of the state— for, said he, Philip knew that the others had accepted his bribes, but that he would never win me over —then the people paid him double honours.",
    grc: "ὅθεν ἐλθόντας τοὺς πρέσβεις εἰς τὰς Ἀθήνας φάσκειν ὡς μάτην αὐτοῖς Ξενοκράτης συνεληλύθοι· καὶ τοὺς ἑτοίμους εἶναι ζημιοῦν αὐτόν. μαθόντας δὲ παρʼ αὐτοῦ ὡς νῦν καὶ μᾶλλον φροντιστέον εἴη τῆς πόλεως αὐτοῖς 〈τοὺς μὲν γὰρ ᾔδει δωροδοκήσαντας ὁ Φίλιππος, ἐμὲ δὲ μηδενὶ λόγῳ ὑπαξόμενοσ〉 φασὶ διπλασίως αὐτὸν τιμῆσαι.",
    ref: "4.9",
    involves: "Philip",
    certainty: "reported",
    framesSaying: "xenocrates-philip-bribe",
    note: "The embassy itself is introduced at 4.8 ('There is a story that, when he was sent, along with others also, on an embassy to Philip, his colleagues, being bribed, accepted Philip's invitations').",
  },
  {
    id: "xenocrates-circe-to-antipater",
    philosopher: "Xenocrates",
    topic: "wit",
    gloss:
      "As envoy pleading for the prisoners of the Lamian war, invited to dine, Xenocrates quotes Odysseus' answer to Circe - and Antipater, delighted, at once releases them.",
    en: "Moreover, when he went as envoy to Antipater to plead for Athenians taken prisoners in the Lamian war, being invited to dine with Antipater, he quoted to him the following lines : O Circe! what righteous man would have the heart to taste meat and drink ere he had redeemed his company and beheld them face to face? and so pleased Antipater with his ready wit that he at once released them.",
    grc: "ἀλλὰ καὶ πρεσβεύων πρὸς Ἀντίπατρον περὶ αἰχμαλώτων Ἀθηναίων κατὰ τὸν Λαμιακὸν πόλεμον, καὶ κληθεὶς ἐπὶ δεῖπνον πρὸς αὐτὸν προηνέγκατο ταυτί· ὦ Κίρκη, τίς γάρ κεν ἀνήρ, ὃς ἐναίσιμος εἴη, πρὶν τλαίη πάσσασθαι ἐδητύος ἠδὲ ποτῆτος, πρὶν λύσασθʼ ἑτάρους καὶ ἐν ὀφθαλμοῖσιν ἰδέσθαι; καὶ τὸν ἀποδεξάμενον τὴν εὐστοχίαν εὐθὺς ἀφεῖναι.",
    ref: "4.9",
    involves: "Antipater",
    certainty: "asserted",
  },
  {
    id: "xenocrates-sold-for-tax",
    philosopher: "Xenocrates",
    topic: "capture",
    gloss:
      "Unable to pay the resident-alien tax, Xenocrates is put up for sale by the Athenians - and Demetrius of Phalerum buys him, restoring liberty to the philosopher and the tax to Athens.",
    en: "Such was his character, and yet, when he was unable to pay the tax levied on resident aliens, the Athenians put him up for sale. And Demetrius of Phalerum purchased him, thereby making twofold restitution, to Xenocrates of his liberty, and to the Athenians of their tax. This we learn from Myronianus of Amastris in the first book of his Chapters on Historical Parallels.",
    grc: "Ἀθηναῖοι δ′ ὅμως αὐτὸν ὄντα τοιοῦτον ἐπίπρασκόν ποτε, τὸ μετοίκιον ἀτονοῦντα θεῖναι. καὶ αὐτὸν ὠνεῖται Δημήτριος ὁ Φαληρεὺς καὶ ἑκάτερον ἀποκατέστησε· Ξενοκράτει μὲν τὴν ἐλευθερίαν, Ἀθηναίοις δὲ τὸ μετοίκιον. τοῦτό φησι Μυρωνιανὸς ὁ Ἀμαστριανὸς ἐν τῷ πρώτῳ τῶν Ἱστορικῶν Ὁμοίων κεφαλαίων.",
    ref: "4.14",
    involves: "Demetrius of Phalerum",
    certainty: "reported",
    accordingTo: "Myronianus",
  },
  {
    id: "xenocrates-fatal-fall",
    philosopher: "Xenocrates",
    topic: "death",
    gloss:
      "Xenocrates dies in his 82nd year from a fall over some utensil in the night.",
    en: "He died in his 82nd year from the effects of a fall over some utensil in the night.",
    grc: "ἐτελεύτα δὲ νυκτὸς λεκάνῃ προσπταίσας, ἔτος ἤδη γεγονὼς δεύτερον καὶ ὀγδοηκοστόν.",
    ref: "4.14",
    certainty: "asserted",
  },
  // --- Polemo ---
  {
    id: "polemo-drunken-conversion",
    philosopher: "Polemo",
    topic: "conversion",
    gloss:
      "The profligate Polemo bursts drunk and garlanded into Xenocrates' lecture on temperance - is caught in its toils, and rises to head the school himself.",
    en: "And one day, by agreement with his young friends, he burst into the school of Xenocrates quite drunk, with a garland on his head. Xenocrates, however, without being at all disturbed, went on with his discourse as before, the subject being temperance. The lad, as he listened, by degrees was taken in the toils. He became so industrious as to surpass all the other scholars, and rose to be himself head of the school in the 116th Olympiad.",
    grc: "καί ποτε συνθέμενος τοῖς νέοις μεθύων καὶ ἐστεφανωμένος εἰς τὴν Ξενοκράτους ᾖξε σχολήν· ὁ δὲ οὐδὲν διατραπεὶς εἶρε τὸν λόγον ὁμοίως· ἦν δὲ περὶ σωφροσύνης. ἀκοῦον δὴ τὸ μειράκιον κατʼ ὀλίγον ἐθηράθη καὶ οὕτως ἐγένετο φιλόπονος ὡς ὑπερβάλλεσθαι τοὺς ἅλλους καὶ αὐτὸς διαδέξασθαι τὴν σχολήν, ἀρξάμενος ἀπὸ τῆς ἕκτης καὶ δεκάτης καὶ ἑκατοστῆς Ὀλυμπιάδος.",
    ref: "4.16",
    involves: "Xenocrates",
    certainty: "asserted",
  },
  {
    id: "polemo-mad-dog-bite",
    philosopher: "Polemo",
    topic: "training",
    gloss:
      "Bitten in the thigh by a mad dog, Polemo does not even turn pale, and stays undisturbed by the clamour that rises in the city at the news.",
    en: "Certain it is that, when a mad dog bit him in the back of his thigh, he did not even turn pale, but remained undisturbed by all the clamour which arose in the city at the news of what had happened.",
    grc: "κυνὸς γοῦν λυττῶντος [καὶ] τὴν ἰγνύαν διασπάσαντος μόνον μὴ ὠχριᾶσαι· καὶ ταραχῆς γενομένης ἐπὶ τῆς πόλεως πυθομένων τὸ γεγονὸς ἄτρεπτον μεῖναι.",
    ref: "4.17",
    certainty: "reported",
    accordingTo: "Antigonus of Carystus",
    note: "The whole account of his unruffled calm after his conversion comes from Antigonus of Carystus in his Biographies (4.17).",
  },
  {
    id: "polemo-unmoved-by-homer",
    philosopher: "Polemo",
    topic: "training",
    gloss:
      "While Crates is deeply affected by Nicostratus' recitation of Homer, Polemo is no more moved than if he had not heard him.",
    en: "For instance, Nicostratus, who was nicknamed Clytemnestra, was once reading to him and Crates something from Homer; and, while Crates was deeply affected, he was no more moved than if he had not heard him.",
    grc: "Νικοστράτου γοῦν ποτε τοῦ ἐπικαλουμένου Κλυταιμνήστρα ἀναγινώσκοντός τι τοῦ ποιητοῦ αὐτῷ τε καὶ Κράτητι, τὸν μὲν συνδιατίθεσθαι, τὸν δʼ ἴσα καὶ μὴ ἀκοῦσαι.",
    ref: "4.18",
    certainty: "asserted",
  },
  // --- Crates of Athens ---
  {
    id: "crates-athens-shared-tomb",
    philosopher: "Crates of Athens",
    topic: "legacy",
    gloss:
      "Crates and Polemo grow more and more alike to their latest breath - and, dying, share the same tomb, celebrated in Antagoras' epitaph.",
    en: "The two were so much attached to each other that they not only shared the same pursuits in life but grew more and more alike to their latest breath, and, dying, shared the same tomb.",
    grc: "καὶ οὕτως ἀλλήλω ἐφιλείτην ὥστε καὶ ζῶντε οὐ μόνον τῶν αὐτῶν ἤστην ἐπιτηδευμάτων, ἀλλὰ καὶ μέχρι σχεδὸν ἀναπνοῆς ἐξωμοιώσθην ἀλλήλοιν καὶ θανόντε τῆς αὐτῆς ταφῆς ἐκοινωνείτην.",
    ref: "4.21",
    involves: "Polemo",
    certainty: "asserted",
  },
  // --- Crantor ---
  {
    id: "crantor-asclepius-crowd",
    philosopher: "Crantor",
    topic: "encounter",
    gloss:
      "Retiring ill to the temple of Asclepius, Crantor is besieged by people convinced he has come to open a school - Arcesilaus among them, seeking an introduction to Polemo.",
    en: "He happened to fall ill, and retired to the temple of Asclepius, where he proceeded to walk about. At once people flocked round him in the belief that he had retired thither, not on account of illness, but in order to open a school. Among them was Arcesilaus, who wished to be introduced by his means to Polemo, notwithstanding the affection which united the two, as will be related in the Life of Arcesilaus.",
    grc: "οὗτος νοσήσας εἰς τὸ Ἀσκληπιεῖον ἀνεχώρησε κἀκεῖ περιεπάτει· οἱ δὲ πανταχόθεν προσῄεσαν αὐτῷ, νομίζοντες οὐ διὰ νόσον, ἀλλὰ βούλεσθαι αὐτόθι σχολὴν συστήσασθαι. ὧν ἦν καὶ Ἀρκεσίλαος θέλων ὑπʼ αὐτοῦ συστῆναι Πολέμωνι, καίπερ ἐρῶντος, ὡς ἐν τῷ περὶ Ἀρκεσιλάου λέξομεν.",
    ref: "4.24",
    involves: "Arcesilaus",
    certainty: "asserted",
  },
  {
    id: "crantor-native-soil-burial",
    philosopher: "Crantor",
    topic: "legacy",
    gloss:
      "Crantor leaves Arcesilaus his property, twelve talents' worth - and, asked where he wishes to be buried, answers with a verse: sweet in some nook of native soil to rest.",
    en: "He is also said to have left Arcesilaus his property, to the value of twelve talents. And when asked by him where he wished to be buried, he answered : Sweet in some nook of native soil to rest.",
    grc: "λέγεται δὲ καὶ τὴν οὐσίαν καταλιπεῖν Ἀρκεσιλάω, ταλάντων οὖσαν δυοκαίδεκα. καὶ ἐρωτηθέντα πρὸς αὐτοῦ ποῦ βούλεται ταφῆναι, εἰπεῖν· ἐν γῆς φίλης μυχοῖσι κρυφθῆναι καλόν.",
    ref: "4.25",
    involves: "Arcesilaus",
    certainty: "reported",
  },
  // --- Arcesilaus ---
  {
    id: "arcesilaus-andromeda-answer",
    philosopher: "Arcesilaus",
    topic: "conversion",
    gloss:
      "Destined by his brother for rhetoric but devoted to philosophy, Arcesilaus answers Crantor's line from the Andromeda with the next verse - and joins him.",
    en: "For while his brother Moereas, who has already been mentioned, wanted to make him a rhetorician, he was himself devoted to philosophy, and Crantor, being enamoured of him, cited the line from the Andromeda of Euripides : O maiden, if I save thee, wilt thou be grateful to me? and was answered with the next line : Take me, stranger, whether for maidservant or for wife.",
    grc: "Μοιρέας μὲν γὰρ ὁ προειρημένος ἀδελφὸς ἦγεν αὐτὸν ἐπὶ ῥητορικήν· ὁ δὲ φιλοσοφίας ἤρα, καὶ αὐτοῦ Κράντωρ ἐρωτικῶς διατεθεὶς ἐπύθετο τὰ ἐξ Ἀνδρομέδας Εὐριπίδου προενεγκάμενος· ὦ παρθένʼ, εἰ σώσαιμί σʼ, εἴσει μοι χάριν; καὶ ὃς τὰ ἐχόμενα· ἄγου μʼ, ὦ ξένʼ, εἴτε δμωΐδʼ ἐθέλεις εἴτʼ ἄλοχον.",
    ref: "4.29",
    involves: "Crantor",
    certainty: "asserted",
  },
  {
    id: "arcesilaus-nurses-hipponicus",
    philosopher: "Arcesilaus",
    topic: "encounter",
    gloss:
      "After jesting that geometry must have flown into the yawning Hipponicus' mouth, Arcesilaus takes the man into his house when his mind gives way, and nurses him back to health.",
    en: "He also attended the lectures of the geometer Hipponicus, at whom he pointed a jest as one who was in all besides a listless, yawning sluggard but yet proficient in his subject. Geometry, he said, must have flown into his mouth while it was agape. When this man’s mind gave way, Arcesilaus took him to his house and nursed him until he was completely restored.",
    grc: "Διήκουσε δὲ καὶ Ἱππονίκου τοῦ γεωμέτρου· ὃν καὶ ἔσκωψε τὰ μὲν ἄλλα νωθρὸν ὄντα καὶ χασμώδη, ἐν δὲ τῇ τέχνῃ τεθεωρημένον, εἰπὼν τὴν γεωμετρίαν αὐτοῦ χάσκοντος εἰς τὸ στόμα ἐμπτῆναι. τοῦτον καὶ παρακόψαντα ἀναλαβὼν οἴκοι ἐς τοσοῦτον ἐθεράπευσεν, ἐς ὅσον ἀποκαταστῆσαι.",
    ref: "4.32",
    certainty: "asserted",
    framesSaying: "arcesilaus-geometry-agape",
  },
  {
    id: "arcesilaus-purse-under-pillow",
    philosopher: "Arcesilaus",
    topic: "encounter",
    gloss:
      "Calling on the sick and destitute Ctesibius, Arcesilaus quietly slips a purse under his pillow - 'This is the joke of Arcesilaus,' says the finder - and later sends him a thousand drachmas.",
    en: "For instance, he once called upon Ctesibius when he was ill and, seeing in what straits he was, quietly put a purse under his pillow. He, when he found it, said, This is the joke of Arcesilaus. Moreover, on another occasion, he sent him 1000 drachmas.",
    grc: "εἰσελθὼν γοῦν ποτὲ πρὸς Κτησίβιον νοσοῦντα καὶ ἰδὼν ἀπορίᾳ θλιβόμενον, κρύφα βαλάντιον ὑπέθηκε τῷ προσκεφαλαίῳ· καὶ ὃς εὑρών, Ἀρκεσιλάου, φησί, τὸ παίγνιον. ἀλλὰ καὶ ἄλλοτε χιλίας ἀπέστειλεν.",
    ref: "4.37",
    certainty: "asserted",
  },
  {
    id: "arcesilaus-silver-plate",
    philosopher: "Arcesilaus",
    topic: "asceticism",
    gloss:
      "When a borrower never returns his silver plate, Arcesilaus pretends it was never borrowed - or, in another version, lends it on purpose and makes it a gift to a poor man.",
    en: "Some one once borrowed his silver plate in order to entertain friends and never brought it back, but Arcesilaus did not ask him for it and pretended it had not been borrowed. Another version of the story is that he lent it on purpose, and, when it was returned, made the borrower a present of it because he was poor.",
    grc: "καί ποτέ τινος ἀργυρώματα λαβόντος εἰς ὑποδοχὴν φίλων καὶ ἀποστεροῦντος οὐκ ἀπῄτησεν οὐδὲ προσεποιήθη. οἱ δέ φασιν ἐπίτηδες χρῆσαι καὶ ἀποδιδόντος, ἐπεὶ πένης ἦν, χαρίσασθαι.",
    ref: "4.38",
    certainty: "disputed",
  },
  {
    id: "arcesilaus-turns-at-the-gates",
    philosopher: "Arcesilaus",
    topic: "defiance",
    gloss:
      "While many court Antigonus, Arcesilaus stays home; urged by his friend Hierocles to pay his respects, he goes as far as the gates - and turns back.",
    en: "And whereas many persons courted Antigonus and went to meet him whenever he came to Athens, Arcesilaus remained at home, not wishing to thrust himself upon his acquaintance. He was on the best of terms with Hierocles, the commandant in Munichia and Piraeus, and at every festival would go down to see him. And though Hierocles joined in urging him to pay his respects to Antigonus, he was not prevailed upon, but, after going as far as the gates, turned back.",
    grc: "Πολλῶν δὲ καὶ τὸν Ἀντίγονον θεραπευόντων καὶ ὁπότε ἥκοι ἀπαντώντων αὐτὸς ἡσύχαζε, μὴ βουλόμενος προεμπίπτειν εἰς γνῶσιν. φίλος τε ἦν μάλιστα Ἱεροκλεῖ τῷ τὴν Μουνιχίαν ἔχοντι καὶ τὸν Πειραιᾶ· ἔν τε ταῖς ἑορταῖς κατῄει πρὸς αὐτὸν ἑκάστοτε. καὶ δὴ καὶ πολλὰ ἐκείνου συμπείθοντος ὥστʼ ἀσπάσασθαι τὸν Ἀντίγονον, οὐκ ἐπείσθη, ἀλλʼ ἕως πυλῶν ἐλθὼν ἀνέστρεψε.",
    ref: "4.39",
    involves: "Antigonus",
    certainty: "asserted",
  },
  {
    id: "arcesilaus-hands-over-pupil",
    philosopher: "Arcesilaus",
    topic: "teaching",
    gloss:
      "When a youth from Chios prefers the lectures of his critic Hieronymus, Arcesilaus himself takes the pupil and introduces him to that philosopher, with an injunction to behave well.",
    en: "And when a certain youth from Chios was not well pleased with his lectures and preferred those of the above-mentioned Hieronymus, Arcesilaus himself took him and introduced him to that philosopher, with an injunction to behave well.",
    grc: "καί τινος Χίου νεανίσκου μὴ εὐαρεστουμένου τῇ διατριβῇ αὐτοῦ, ἀλλʼ Ἱερωνύμου τοῦ προειρημένου, αὐτὸς ἀπαγαγὼν συνέστησε τῷ φιλοσόφῳ, παραινέσας εὐτακτεῖν.",
    ref: "4.42",
    certainty: "asserted",
  },
  {
    id: "arcesilaus-unmixed-wine",
    philosopher: "Arcesilaus",
    topic: "death",
    gloss:
      "Arcesilaus dies at seventy-five through drinking too freely of unmixed wine, which affected his reason - regarded by the Athenians with unparalleled good-will.",
    en: "He died, according to Hermippus, through drinking too freely of unmixed wine which affected his reason; he was already seventy-five and regarded by the Athenians with unparalleled good-will.",
    grc: "Ἐτελεύτησε δέ, ὥς φησιν Ἕρμιππος, ἄκρατον ἐμφορηθεὶς πολὺν καὶ παρακόφας, ἤδη γεγονὼς ἔτος πέμπτον καὶ ἑβδομηκοστόν, ἀποδεχθεὶς πρὸς Ἀθηναίων ὡς οὐδείς.",
    ref: "4.44",
    certainty: "reported",
    accordingTo: "Hermippus",
  },
  // --- Bion ---
  {
    id: "bion-tells-his-parentage",
    philosopher: "Bion",
    topic: "encounter",
    gloss:
      "Asked by King Antigonus who he is and whence, Bion - knowing he has been maligned - tells the whole story plainly: a freedman fish-dealer's son, a mother from a brothel, the family sold, and himself bought by a rhetorician.",
    en: "For, when Antigonus inquired: Who among men, and whence, are you? What is your city and your parents? he, knowing that he had already been maligned to the king, replied, My father was a freedman, who wiped his nose on his sleeve —meaning that he was a dealer in salt fish— a native of Borysthenes, with no face to show, but only the writing on his face, a token of his master’s severity. My mother was such as a man like my father would marry, from a brothel. Afterwards my father, who had cheated the revenue in some way, was sold with all his family. And I, then a not ungraceful youngster, was bought by a certain rhetorician, who on his death left me all he had.",
    grc: "ἐρομένου γὰρ αὐτὸν τίς πόθεν εἶς ἀνδρῶν; πόθι τοι πόλις ἠδὲ τοκῆες; αἰσθόμενος ὅτι προδιαβέβληται, φησὶ πρὸς αὐτόν· ἐμοὶ ὁ πατὴρ μὲν ἦν ἀπελεύθερος, τῷ ἀγκῶνι ἀπομυσσόμενος—διεδήλου δὲ τὸν ταριχέμπορον—γένος Βορυσθενίτης, ἔχων οὐ πρόσωπον, ἀλλὰ συγγραφὴν ἐπὶ τοῦ προσώπου, τῆς τοῦ δεσπότου πικρίας σύμβολον· μήτηρ δὲ οἵαν ὁ τοιοῦτος ἂν γήμαι, ἀπʼ οἰκήματος. ἔπειτα ὁ πατὴρ παρατελωνησάμενός τι πανοίκιος ἐπράθη μεθʼ ἡμῶν. καί με ἀγοράζει τις ῥήτωρ νεώτερον ὄντα καὶ εὔχαριν· ὃς καὶ ἀποθνήσκων κατέλιπέ μοι πάντα.",
    ref: "4.46",
    involves: "Antigonus",
    certainty: "asserted",
  },
  {
    id: "bion-rhodes-procession",
    philosopher: "Bion",
    topic: "eccentricity",
    gloss:
      "At Rhodes Bion persuades the sailors to put on students' garb and follow in his train - and enters the gymnasium with every eye fixed on him.",
    en: "Thus at Rhodes he persuaded the sailors to put on students’ garb and follow in his train. And when, attended by them, he made his way into the gymnasium, all eyes were fixed on him.",
    grc: "ἐν γοῦν Ῥόδῳ τοὺς ναύτας ἔπεισε σχολαστικὰς ἐσθῆτας ἀναλαβεῖν καὶ ἀκολουθῆσαι αὐτῷ· σὺν οἷς εἰσβάλλων εἰς τὸ γυμνάσιον περίβλεπτος ἦν.",
    ref: "4.53",
    certainty: "asserted",
  },
  {
    id: "bion-deathbed-amulet",
    philosopher: "Bion",
    topic: "death",
    gloss:
      "Falling ill at Chalcis, the scoffer at the gods is persuaded to wear an amulet and repent his offences against religion - nursed at last by two servants Antigonus sends, the king following in a litter.",
    en: "Afterwards, when he fell ill (so it was said by the people of Chalcis where he died), he was persuaded to wear an amulet and to repent of his offences against religion. And even for want of nurses he was in a sad plight, until Antigonus sent him two servants. And it is stated by Favorinus in his Miscellaneous History that the king himself followed in a litter.",
    grc: "καὶ ὕστερόν ποτε ἐμπεσὼν εἰς νόσον, ὡς ἔφασκον οἱ ἐν Χαλκίδι—αὐτόθι γὰρ καὶ κατέστρεψε—περίαπτα λαβεῖν ἐπείσθη καὶ μεταγινώσκειν ἐφʼ οἷς ἐπλημμέλησεν εἰς τὸ θεῖον. ἀπορίᾳ δὲ καὶ τῶν νοσοκομούντων δεινῶς διετίθετο, ἕως Ἀντίγονος αὐτῷ δύο θεράποντας ἀπέστειλε. καὶ ἠκολούθει γε αὐτὸς ἐν φορείῳ, καθά φησι Φαβωρῖνος ἐν Παντοδαπῇ ἱστορίᾳ.",
    ref: "4.54",
    involves: "Antigonus",
    certainty: "reported",
    accordingTo: "Favorinus",
  },
  // --- Lacydes ---
  {
    id: "lacydes-signet-ring-storeroom",
    philosopher: "Lacydes",
    topic: "eccentricity",
    gloss:
      "Lacydes seals his store-room and throws the signet-ring back inside through the opening - and his servants, learning the trick, plunder at will and throw the ring in after them.",
    en: "Whenever he brought anything out of the store-room, he would seal the door up again and throw his signet-ring inside through the opening, to ensure that nothing laid up there should be stolen or carried off. So soon, then, as his rogues of servants got to know this, they broke the seal and carried off what they pleased, afterwards throwing the ring in the same way through the opening into the store-room. Nor were they ever detected in this.",
    grc: "ἐπειδὴ γάρ τι προέλοι τοῦ ταμιείου, σφραγισάμενος πάλιν εἴσω τὸν δακτύλιον διὰ τῆς ὀπῆς ἐρρίπτει, ὡς μηδέποτʼ αὐτοῦ περιαιρεθείη τι καὶ βασταχθείη τῶν ἀποκειμένων. μαθόντα δὴ τοῦτο τὰ θεραπόντια ἀπεσφράγιζε καὶ ὅσα ἐβούλετο ἐβάσταζεν· ἔπειτα τὸν δακτύλιον τὸν αὐτὸν τρόπον διὰ τῆς ὀπῆς ἐνίει εἰς τὴν στοάν· καὶ τοῦτο ποιοῦντα οὐδέ ποτʼ ἐφωράθη.",
    ref: "4.59",
    certainty: "reported",
  },
  {
    id: "lacydes-hands-over-school",
    philosopher: "Lacydes",
    topic: "legacy",
    gloss:
      "Alone of the Academy's heads, Lacydes hands over the school in his own lifetime - to Telecles and Evander of Phocaea.",
    en: "He did what none of his predecessors had ever done; in his lifetime he handed over the school to Telecles and Evander, both of Phocaea.",
    grc: "καὶ μόνος τῶν ἀπʼ αἰῶνος ζῶν παρέδωκε τὴν σχολὴν Τηλεκλεῖ καὶ Εὐάνδρῳ τοῖς Φωκαεῦσι.",
    ref: "4.60",
    certainty: "asserted",
  },
  {
    id: "lacydes-palsy-from-drink",
    philosopher: "Lacydes",
    topic: "death",
    gloss:
      "After twenty-six years at the head of the school, Lacydes dies of a palsy brought on by drinking too freely.",
    en: "He assumed the headship of the school in the fourth year of the 134th Olympiad, and at his death he had been head for twenty-six years. His end was a palsy brought on by drinking too freely.",
    grc: "Ἐτελεύτησε δὲ σχολαρχεῖν ἀρξάμενος τῷ τετάρτῳ ἔτει τῆς τετάρτης καὶ τριακοστῆς καὶ ἑκατοστῆς Ὀλυμπιάδος, τῆς σχολῆς ἀφηγησάμενος ἓξ πρὸς τοῖς εἴικοσιν ἔτη· ἡ τελευτὴ δὲ αὐτῷ παράλυσις ἐκ πολυποσίας.",
    ref: "4.61",
    certainty: "asserted",
  },
  // --- Carneades ---
  {
    id: "carneades-voice-in-the-gymnasium",
    philosopher: "Carneades",
    topic: "wit",
    gloss:
      "Asked by the gymnasium keeper not to shout so loud, Carneades demands something to regulate his voice by - and gets the happy answer: you have a regulator in your audience.",
    en: "His voice was extremely powerful, so that the keeper of the gymnasium sent to him and requested him not to shout so loud. To which he replied, Then give me something by which to regulate my voice. Thereupon by a happy hit the man replied in the words, You have a regulator in your audience.",
    grc: "Ἦν δὲ καὶ μεγαλοφωνότατος, ὥστε τὸν γυμνασίαρχον προσπέμψαι αὐτῷ μὴ οὕτω βοᾶν· τὸν δὲ εἰπεῖν, καὶ δὸς μέτρον φωνῆς. ἔνθεν εὐστόχως ἑλόντα ἀμείψασθαι· φάναι γάρ, μέτρον ἔχεις τοὺς ἀκούοντας.",
    ref: "4.63",
    certainty: "asserted",
    framesSaying: "carneades-voice-regulator",
  },
  {
    id: "carneades-honeyed-draught",
    philosopher: "Carneades",
    topic: "death",
    gloss:
      "Moved by the constancy of Antipater's suicide, Carneades cries 'Give it then to me also' - and, asked what: 'A honeyed draught.' At his death the moon is said to have been eclipsed.",
    en: "When he learnt that Antipater committed suicide by drinking a potion, he was greatly moved by the constancy with which he met his end, and exclaimed, Give it then to me also. And when those about him asked What? A honeyed draught, said he. At the time he died the moon is said to have been eclipsed, and one might well say that the brightest luminary in heaven next to the sun thereby gave token of her sympathy.",
    grc: "μαθών τε Ἀντίπατρον φάρμακον πιόντα ἀποθανεῖν, παρωρμήθη πρὸς τὸ εὐθαρσὲς τῆς ἀπαλλαγῆς καί φησι, δότε οὖν κἀμοί· τῶν δὲ εἰπόντων, τί; οἰνόμελι εἶπεν. τελευτῶντος δʼ αὐτοῦ φασιν ἔκλειψιν γενέσθαι σελήνης, συμπάθειαν, ὡς ἂν εἴποι τις, αἰνιττομένου τοῦ μεθʼ ἥλιον καλλίστου τῶν ἄστρων.",
    ref: "4.64",
    involves: "Antipater",
    certainty: "asserted",
    note: "The Antipater is the Stoic scholarch, whose own death by poison D.L. reports at 7.184 in the Successions' chronology.",
  },
  {
    id: "carneades-lamp-for-the-blind",
    philosopher: "Carneades",
    topic: "eccentricity",
    gloss:
      "His eyes gone blind at night without his knowing it, Carneades orders the lamp lit; told 'Here it is,' he answers: 'Then read.'",
    en: "It is said that his eyes went blind at night without his knowing it, and he ordered the slave to light the lamp. The latter brought it and said, Here it is. Then, said Carneades, read.",
    grc: "Λέγεται καὶ τὰς ὄψεις νυκτὸς ὑποχυθῆναι καὶ ἀγνοεῖν· κελεῦσαί τε τὸν παῖδα λύχνον ἅψαι· εἰσκομίσαντος δὲ καὶ εἰπόντος, κεκόμικα, οὐκοῦν, εἰπεῖν, σὺ ἀναγίνωσκε.",
    ref: "4.66",
    certainty: "reported",
  },
];
