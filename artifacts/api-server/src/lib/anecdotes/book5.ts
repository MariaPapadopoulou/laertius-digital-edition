/**
 * Book 5 anecdotes - the Peripatetics: Aristotle, Theophrastus, Strato,
 * Lyco, Demetrius of Phalerum, and Heraclides Ponticus. Narrated incidents
 * only; bare dicta live in the sayings layer (see the overlap policy in
 * anecdotes.ts). Every `en` is a verbatim Hicks excerpt of the cited
 * section, enforced by validate-anecdotes.
 *
 * Curation notes: the Diogenes-and-the-dried-figs exchange (5.18) is not
 * re-curated - its whole substance is already the curated saying
 * aristotle-diogenes-figs, whose excerpt carries the full narrative.
 * Eumelus (aconite, 5.6) and Demetrius of Magnesia (the pet snake, 5.89)
 * are cited only here and are not otherwise claim/saying sources, so
 * their attributions stay in notes rather than minting source nodes.
 * Antigonus' apple compliment on Lyco's eloquence (5.65) is left out as a
 * remark about him rather than an incident. The Sophocles forgery is
 * curated twice deliberately: once for Heraclides' credulity (5.92) and
 * once, cross-attributed, for Dionysius the Renegade's acrostic exposure
 * (5.93) - the trap belongs to the book-7 renegade's biography.
 */
import type { Anecdote } from "../anecdotes";

export const BOOK5_ANECDOTES: Anecdote[] = [
  // --- Aristotle ---
  {
    id: "aristotle-secedes-from-academy",
    philosopher: "Aristotle",
    topic: "defiance",
    gloss:
      "Aristotle secedes from the Academy while Plato is still alive - drawing the master's remark that he spurns him as colts kick out at the mother who bore them.",
    grc:
      "Ἀπέστη δὲ Πλάτωνος ἔτι περιόντος· ὥστε φασὶν ἐκεῖνον εἰπεῖν, Ἀριστοτέλης ἡμᾶς ἀπελάκτισε, καθαπερεὶ τὰ πωλάρια γεννηθέντα τὴν μητέρα.",
    en: "He seceded from the Academy while Plato was still alive. Hence the remark attributed to the latter: Aristotle spurns me, as colts kick out at the mother who bore them.",
    ref: "5.2",
    involves: "Plato",
    certainty: "reported",
  },
  {
    id: "aristotle-lyceum-walk",
    philosopher: "Aristotle",
    topic: "teaching",
    gloss:
      "Returning from Philip's court to find Xenocrates heading the Academy, Aristotle chooses a public walk in the Lyceum and philosophizes pacing up and down - hence the name Peripatetic.",
    grc:
      "φησὶ δʼ Ἕρμιππος ἐν τοῖς Βίοις ὅτι πρεσβεύοντος αὐτοῦ πρὸς Φίλιππον ὑπὲρ Ἀθηναίων σχολάρχης ἐγένετο τῆς ἐν Ἀκαδημείᾳ σχολῆς Ξενοκράτης· ἐλθόντα δὴ αὐτὸν καὶ θεασάμενον ὑπʼ ἄλλῳ τὴν σχολήν, ἑλέσθαι περίπατον τὸν ἐν Λυκείῳ καὶ μέχρι μὲν ἀλείμματος ἀνακάμπτοντα τοῖς μαθηταῖς συμφιλοσοφεῖν· ὅθεν περιπατητικὸν προσαγορευθῆναι. οἱ δʼ, ὅτι ἐκ νόσου περιπατοῦντι Ἀλεξάνδρῳ συμπαρὼν διελέγετο ἄττα.",
    en: "Hermippus in his Lives mentions that he was absent as Athenian envoy at the court of Philip when Xenocrates became head of the Academy, and that on his return, when he saw the school under a new head, he made choice of a public walk in the Lyceum where he would walk up and down discussing philosophy with his pupils until it was time to rub themselves with oil. Hence the name Peripatetic. But others say that it was given to him because, when Alexander was recovering from an illness and taking daily walks, Aristotle joined him and talked with him on certain matters.",
    ref: "5.2",
    certainty: "disputed",
    accordingTo: "Hermippus",
    note: "Others derive the name from his walks with the convalescent Alexander (5.2).",
  },
  {
    id: "aristotle-warns-callisthenes",
    philosopher: "Aristotle",
    topic: "teaching",
    gloss:
      "When Callisthenes speaks too freely to Alexander, Aristotle rebukes him with a Homeric line - 'Short-lived, I ween, wilt thou be, my child, by what thou sayest' - and so indeed it falls out.",
    grc:
      "ὃν καὶ παρρησιαστικώτερον λαλοῦντα τῷ βασιλεῖ καὶ μὴ πειθόμενον αὐτῷ φασιν ἐπιπλήξαντα εἰπεῖν· ὠκύμορος δή μοι, τέκος, ἔσσεαι, οἷʼ ἀγορεύεις. καὶ δὴ καὶ ἐγένετο. δόξας γὰρ Ἑρμολάῳ συμμετεσχηκέναι τῆς εἰς Ἀλέξανδρον ἐπιβουλῆς ἐν σιδηρᾷ περιήγετο γαλεάγρᾳ, φθειριῶν καὶ ἀκόμιστος· καὶ τέλος λέοντι παραβληθείς, οὕτω κατέστρεψεν.",
    en: "But when Callisthenes talked with too much freedom to the king and disregarded his own advice, Aristotle is said to have rebuked him by citing the line : Short-lived, I ween, wilt thou be, my child, by what thou sayest. And so indeed it fell out. For he, being suspected of complicity in the plot of Hermolaus against the life of Alexander, was confined in an iron cage and carried about until he became infested with vermin through lack of proper attention; and finally he was thrown to a lion and so met his end.",
    ref: "5.5",
    involves: "Callisthenes",
    certainty: "reported",
  },
  {
    id: "aristotle-impiety-withdrawal",
    philosopher: "Aristotle",
    topic: "exile",
    gloss:
      "After thirteen years at the head of his school, Aristotle withdraws to Chalcis when indicted for impiety over his hymn to Hermias - by Eurymedon the hierophant, or by Demophilus.",
    grc:
      "Ὁ δʼ οὖν Ἀριστοτέλης ἐλθὼν εἰς τὰς Ἀθήνας καὶ τρία πρὸς τοῖς δέκα τῆς σχολῆς ἀφηγησάμενος ἔτη ὑπεξῆλθεν εἰς Χαλκίδα, Εὐρυμέδοντος αὐτὸν τοῦ ἱεροφάντου δίκην ἀσεβείας γραψαμένου, ἢ Δημοφίλου, ὥς φησι Φαβωρῖνος ἐν Παντοδαπῇ ἱστορίᾳ, ἐπειδήπερ τὸν ὕμνον ἐποίησεν εἰς τὸν",
    en: "To return to Aristotle: he came to Athens, was head of his school for thirteen years, and then withdrew to Chalcis because he was indicted for impiety by Eurymedon the hierophant, or, according to Favorinus in his Miscellaneous History, by Demophilus, the ground of the charge being the hymn he composed to the aforesaid Hermias,",
    ref: "5.5",
    certainty: "disputed",
  },
  {
    id: "aristotle-aconite-death",
    philosopher: "Aristotle",
    topic: "death",
    gloss:
      "At Chalcis, by Eumelus' account, Aristotle dies by drinking aconite at seventy - but D.L. corrects him: the philosopher lived to sixty-three and died a natural death.",
    grc:
      "Ἐνταῦθα δὴ πιὼν ἀκόνιτον ἐτελεύτησεν, ὥς φησιν Εὔμηλος ἐν τῇ πέμπτῃ τῶν Ἱστοριῶν, βιοὺς ἔτη ἑβδομήκοντα.",
    en: "At Chalcis he died, according to Eumelus in the fifth book of his Histories, by drinking aconite, at the age of seventy.",
    ref: "5.6",
    certainty: "disputed",
    note: "Eumelus is cited only here and mints no source node. D.L. rejects the account: Aristotle lived to be sixty-three and died a natural death in the archonship of Philocles (5.10).",
  },
  {
    id: "aristotle-alexanders-displeasure",
    philosopher: "Aristotle",
    topic: "encounter",
    gloss:
      "Having introduced Callisthenes to Alexander, Aristotle falls from favour - and the king, to annoy him, honours Anaximenes and sends presents to Xenocrates.",
    grc:
      "λέγεται δὲ διὰ τὴν Καλλισθένους πρὸς Ἀλέξανδρον σύστασιν προσκροῦσαι τῷ βασιλεῖ· κἀκεῖνον ἐπὶ τῷ τοῦτον λυπῆσαι Ἀναξιμένην μὲν αὐξῆσαι, πέμψαι δὲ καὶ Ξενοκράτει δῶρα.",
    en: "It is said that he incurred the king’s displeasure because he had introduced Callisthenes to him, and that Alexander, in order to cause him annoyance, honoured Anaximenes and sent presents to Xenocrates.",
    ref: "5.10",
    involves: "Alexander",
    certainty: "reported",
  },
  {
    id: "aristotle-bronze-ball",
    philosopher: "Aristotle",
    topic: "eccentricity",
    gloss:
      "Aristotle sleeps with a bronze ball in his hand over a vessel, so that its fall will wake him - and bathes in warm oil, then sells the oil.",
    grc:
      "λέγεται δὲ καὶ λοπάδας αὐτοῦ πλείστας εὑρῆσθαι· καὶ Λύκωνα λέγειν ὡς ἐν πυέλῳ θερμοῦ ἐλαίου λούοιτο καὶ τοὔλαιον διαπωλοῖτο. ἔνιοι δὲ καὶ ἀσκίον θερμοῦ ἐλαίου ἐπιτιθέναι αὐτὸν τῷ στομάχῳ φασί· καὶ ὁπότε κοιμῷτο, σφαῖραν χαλκῆν βάλλεσθαι αὐτῷ εἰς τὴν χεῖρα λεκάνης ὑποκειμένης, ἵνʼ ἐκπεσούσης τῆς σφαίρας εἰς τὴν λεκάνην ὑπὸ τοῦ ψόφου ἐξέγροιτο.",
    en: "It is said that a very large number of dishes belonging to him were found, and that Lyco mentioned his bathing in a bath of warm oil and then selling the oil. Some relate that he placed a skin of warm oil on his stomach, and that, when he went to sleep, a bronze ball was placed in his hand with a vessel under it, in order that, when the ball dropped from his hand into the vessel, he might be waked up by the sound.",
    ref: "5.16",
    certainty: "reported",
  },
  // --- Theophrastus ---
  {
    id: "theophrastus-renamed-by-aristotle",
    philosopher: "Theophrastus",
    topic: "teaching",
    gloss:
      "Born Tyrtamus, he is re-named Theophrastus - 'divine of speech' - by Aristotle himself, on account of his graceful style.",
    grc:
      "τοῦτον Τύρταμον λεγόμενον Θεόφραστον διὰ τὸ τῆς φράσεως θεσπέσιον Ἀριστοτέλης μετωνόμασεν·",
    en: "He bore the name of Tyrtamus, and it was Aristotle who re-named him Theophrastus on account of his graceful style.",
    ref: "5.38",
    involves: "Aristotle",
    certainty: "asserted",
  },
  {
    id: "theophrastus-sophocles-law-exile",
    philosopher: "Theophrastus",
    topic: "exile",
    gloss:
      "When Sophocles' law makes heading a school without leave a capital offence, Theophrastus leaves Athens with all the philosophers - and within a year the law is repealed, its proposer fined, and the philosophers recalled.",
    grc:
      "Τοιοῦτος δʼ ὤν, ὅμως ἀπεδήμησε πρὸς ὀλίγον καὶ οὗτος καὶ πάντες οἱ λοιποὶ φιλόσοφοι, Σοφοκλέους τοῦ Ἀμφικλείδου νόμον εἰσενεγκόντος, μηδένα τῶν φιλοσόφων σχολῆς ἀφηγεῖσθαι, ἂν μὴ τῇ βουλῇ καὶ τῷ δήμῳ δόξῃ· εἰ δὲ μή, θάνατον εἶναι τὴν ζημίαν. ἀλλʼ αὖθις ἐπανῆλθον εἰς νέωτα, Φίλωνος τὸν Σοφοκλέα γραψαμένου παρανόμων. ὅτε καὶ τὸν νόμον μὲν ἄκυρον ἐποίησαν Ἀθηναῖοι, τὸν δὲ Σοφοκλέα πέντε ταλάντοις ἐζημίωσαν κάθοδόν τε τοῖς φιλοσόφοις ἐψηφίσαντο, ἵνα καὶ Θεόφραστος κατέλθοι καὶ ἐν τοῖς ὁμοίοις εἴη.",
    en: "Although his reputation stood so high, nevertheless for a short time he had to leave the country with all the other philosophers, when Sophocles the son of Amphiclides proposed a law that no philosopher should preside over a school except by permission of the Senate and the people, under penalty of death. The next year, however, the philosophers returned, as Philo had prosecuted Sophocles for making an illegal proposal. Whereupon the Athenians repealed the law, fined Sophocles five talents, and voted the recall of the philosophers, in order that Theophrastus also might return and live there as before.",
    ref: "5.38",
    certainty: "asserted",
  },
  {
    id: "theophrastus-bridle-and-goad",
    philosopher: "Theophrastus",
    topic: "teaching",
    gloss:
      "Aristotle applies to Theophrastus and Callisthenes what Plato had said of Xenocrates and himself: the one needs a bridle, the other a goad - such was the excess of his pupil's cleverness.",
    grc:
      "λέγεται δʼ ἐπʼ αὐτοῦ τε καὶ Καλλισθένους τὸ ὅμοιον εἰπεῖν Ἀριστοτέλην, ὅπερ Πλάτωνα, καθὰ προείρηται, φασὶν εἰπεῖν ἐπί τε Ξενοκράτους καὶ αὐτοῦ τούτου· φάναι γάρ, τοῦ μὲν Θεοφράστου καθʼ ὑπερβολὴν ὀξύτητος πᾶν τὸ νοηθὲν ἐξερμηνεύοντος, τοῦ δὲ νωθροῦ τὴν φύσιν ὑπάρχοντος, ὡς τῷ μὲν χαλινοῦ δέοι, τῷ δὲ κέντρου.",
    en: "It is said that Aristotle applied to him and Callisthenes what Plato had said of Xenocrates and himself (as already related), namely, that the one needed a bridle and the other a goad; for Theophrastus interpreted all his meaning with an excess of cleverness, whereas the other was naturally backward.",
    ref: "5.39",
    involves: "Aristotle",
    certainty: "reported",
  },
  {
    id: "theophrastus-garden-of-the-school",
    philosopher: "Theophrastus",
    topic: "legacy",
    gloss:
      "After Aristotle's death, Theophrastus becomes owner of a garden of his own - the Peripatos - through the intervention of his friend Demetrius of Phalerum.",
    grc:
      "λέγεται δʼ αὐτὸν καὶ ἴδιον κῆπον σχεῖν μετὰ τὴν Ἀριστοτέλους τελευτήν, Δημητρίου τοῦ Φαληρέως, ὃς ἦν καὶ γνώριμος αὐτῷ, τοῦτο συμπράξαντος.",
    en: "He is said to have become the owner of a garden of his own after Aristotle’s death, through the intervention of his friend Demetrius of Phalerum.",
    ref: "5.39",
    involves: "Demetrius of Phalerum",
    certainty: "reported",
  },
  {
    id: "theophrastus-last-message",
    philosopher: "Theophrastus",
    topic: "death",
    gloss:
      "Asked by his disciples for a last message, the dying Theophrastus answers that many of the pleasures which life boasts are but in the seeming.",
    grc:
      "Φασὶ δʼ αὐτὸν ἐρωτηθέντα ὑπὸ τῶν μαθητῶν εἴ τι ἐπισκήπτει, εἰπεῖν, ἐπισκήπτειν μὲν ἔχειν οὐδέν, πλὴν ὅτι πολλὰ τῶν ἡδέων ὁ βίος διὰ τὴν δόξαν καταλαζονεύεται.",
    en: "It is said that his disciples asked him if he had any last message for them, to which he replied: Nothing else but this, that many of the pleasures which life boasts are but in the seeming.",
    ref: "5.40",
    certainty: "reported",
    framesSaying: "theophrastus-pleasures-seeming",
  },
  {
    id: "theophrastus-athens-on-foot",
    philosopher: "Theophrastus",
    topic: "legacy",
    gloss:
      "With his dying words spoken, Theophrastus breathes his last - and all the Athenians, out of respect for the man, escort his bier on foot.",
    grc:
      "ταῦτα, φασίν, εἰπὼν ἀπέπνευσε· καὶ αὐτόν, ὡς ὁ λόγος, Ἀθηναῖοι πανδημεὶ παρέπεμψαν ποσί, τὸν ἄνδρα τιμήσαντες.",
    en: "With these words, they say, he breathed his last. And according to the story all the Athenians, out of respect for the man, escorted his bier on foot.",
    ref: "5.41",
    certainty: "reported",
  },
  // --- Strato ---
  {
    id: "strato-teaches-ptolemy",
    philosopher: "Strato",
    topic: "teaching",
    gloss:
      "The physicist Strato teaches Ptolemy Philadelphus - and receives, it is said, eighty talents from him.",
    grc:
      "ἀλλὰ καὶ καθηγήσατο Πτολεμαίου τοῦ Φιλαδέλφου καὶ ἔλαβε, φασί, παρʼ αὐτοῦ τάλαντα ὀγδοήκοντα·",
    en: "Moreover, he taught Ptolemy Philadelphus and received, it is said, 80 talents from him.",
    ref: "5.58",
    involves: "Ptolemy",
    certainty: "reported",
  },
  {
    id: "strato-wasted-to-nothing",
    philosopher: "Strato",
    topic: "death",
    gloss:
      "Strato grows so thin that he feels nothing when his end comes - dying, as D.L.'s epigram has it, or ever he felt the hand of death.",
    grc:
      "Τοῦτόν φασιν οὕτω γενέσθαι λεπτὸν ὡς ἀναισθήτως τελευτῆσαι.",
    en: "Strato is said to have grown so thin that he felt nothing when his end came.",
    ref: "5.60",
    certainty: "reported",
  },
  // --- Lyco ---
  {
    id: "lyco-athletes-body",
    philosopher: "Lyco",
    topic: "eccentricity",
    gloss:
      "The eloquent Lyco keeps an athlete's habit of body - battered ears, skin begrimed with oil - wrestling and playing the ball game of his native Ilium.",
    grc:
      "ἀλλὰ καὶ γυμναστικώτατος ἐγένετο καὶ εὐέκτης τὸ σῶμα τήν τε πᾶσαν σχέσιν ἀθλητικὴν ἐπιφαίνων, ὠτοθλαδίας καὶ ἐμπινὴς ὤν, καθά φησιν Ἀντίγονος ὁ Καρύστιος· διὰ τοῦτο δὲ καὶ παλαῖσαι λέγεται τά τʼ ἐν τῇ πατρίδι Ἰλίεια καὶ σφαιρίσαι.",
    en: "Furthermore, he was well practised in gymnastics and kept himself in condition, displaying all an athlete’s habit of body, with battered ears and skin begrimed with oil, so we are told by Antigonus of Carystus. Hence it is said that he not only wrestled but played the game of ball common in his birthplace of Ilium.",
    ref: "5.67",
    certainty: "reported",
    accordingTo: "Antigonus of Carystus",
  },
  {
    id: "lyco-shuns-hieronymus",
    philosopher: "Lyco",
    topic: "defiance",
    gloss:
      "So hostile is Lyco to Hieronymus the Peripatetic that he alone declines to meet him on the anniversary gathering mentioned in the Life of Arcesilaus.",
    grc:
      "οὕτω δʼ ἦν ἐχθρὸς Ἱερωνύμῳ τῷ περιπατητικῷ, ὡς μόνος μὴ ἀπαντᾶν πρὸς αὐτὸν εἰς τὴν ἐτήσιον ἡμέραν, περὶ ἧς ἐν τῷ Ἀρκεσιλάου βίῳ διειλέγμεθα.",
    en: "He was so hostile to Hieronymus the Peripatetic that he alone declined to meet him on the anniversary which we have mentioned in the Life of Arcesilaus.",
    ref: "5.68",
    certainty: "asserted",
  },
  {
    id: "lyco-dies-of-gout",
    philosopher: "Lyco",
    topic: "death",
    gloss:
      "After forty-four years over the school, Lyco dies at seventy-four of severe gout - he who, as D.L.'s epitaph jokes, could walk only with the feet of others, yet traversed the long road to Hades in a single night.",
    grc:
      "ἐτελεύτησε δὲ γεγονὼς ἔτος τέταρτον καὶ ἑβδομηκοστόν, νόσῳ ποδαγρικῇ καταπονηθείς.",
    en: "He died at the age of seventy-four after severe sufferings from gout.",
    ref: "5.68",
    certainty: "asserted",
  },
  // --- Demetrius of Phalerum ---
  {
    id: "demetrius-360-statues",
    philosopher: "Demetrius of Phalerum",
    topic: "legacy",
    gloss:
      "Ruling Athens for ten years by his speeches, Demetrius is decreed 360 bronze statues - completed in less than 300 days, so much is he esteemed.",
    grc:
      "οὗτος ἤκουσε μὲν Θεοφράστου· δημηγορῶν δὲ παρʼ Ἀθηναίοις τῆς πόλεως ἐξηγήσατο ἔτη δέκα, καὶ εἰκόνων ἠξιώθη χαλκῶν ἑξήκοντα πρὸς ταῖς τριακοσίαις, ὧν αἱ πλείους ἐφʼ ἵππων ἦσαν καὶ ἁρμάτων καὶ συνωρίδων, συντελεσθεῖσαι ἐν οὐδὲ τριακοσίαις ἡμέραις· τοσοῦτον ἐσπουδάσθη.",
    en: "He was a pupil of Theophrastus, but by his speeches in the Athenian assembly he held the chief power in the State for ten years and was decreed 360 bronze statues, most of them representing him either on horseback or else driving a chariot or a pair of horses. And these statues were completed in less than 300 days, so much was he esteemed.",
    ref: "5.75",
    certainty: "asserted",
  },
  {
    id: "demetrius-sight-restored-by-sarapis",
    philosopher: "Demetrius of Phalerum",
    topic: "piety",
    gloss:
      "Losing his sight in Alexandria, Demetrius recovers it by the gift of Sarapis - and composes the paeans sung to this day.",
    grc:
      "λέγεται δʼ ἀποβαλόντα αὐτὸν τὰς ὄψεις ἐν Ἀλεξανδρείᾳ, κομίσασθαι αὖθις παρὰ τοῦ Σαράπιδος· ὅθεν καὶ τοὺς παιᾶνας ποιῆσαι τοὺς μέχρι νῦν ᾀδομένους.",
    en: "He is said to have lost his sight when in Alexandria and to have recovered it by the gift of Sarapis; whereupon he composed the paeans which are sung to this day.",
    ref: "5.76",
    certainty: "reported",
  },
  {
    id: "demetrius-statues-torn-down",
    philosopher: "Demetrius of Phalerum",
    topic: "exile",
    gloss:
      "Indicted on a capital charge, Demetrius lets judgement go by default - and his accusers, unable to seize his person, tear down his bronze statues: sold, sunk in the sea, or broken up for bedroom-utensils, one only surviving on the Acropolis.",
    grc:
      "ἐπιβουλευθεὶς γὰρ ὑπό τινων δίκην θανάτου οὐ παρὼν ὦφλεν. οὐ μὴν ἐκυρίευσαν τοῦ σώματος αὐτοῦ, ἀλλὰ τὸν ἰὸν ἀπήρυγον εἰς τὸν χαλκόν, κατασπάσαντες αὐτοῦ τὰς εἰκόνας καὶ τὰς μὲν ἀποδόμενοι, τὰς δὲ βυθίσαντες, τὰς δὲ κατακόψαντες εἰς ἀμίδας· λέγεται γὰρ καὶ τοῦτο. μία δὲ μόνη σώζεται ἐν ἀκροπόλει.",
    en: "Having been indicted by some persons on a capital charge, he let judgement go by default; and, when his accusers could not get hold of his person, they disgorged their venom on the bronze of his statues. These they tore down from their pedestals; some were sold, some cast into the sea, and others were even, it is said, broken up to make bedroom-utensils. Only one is preserved in the Acropolis.",
    ref: "5.77",
    certainty: "asserted",
    note: "Favorinus in his Miscellaneous History adds that the Athenians did this at the bidding of King Demetrius (5.77). His retort - that they could not destroy the merits which caused the statues to be erected - is the curated saying demetrius-statues-merits (5.82).",
  },
  {
    id: "demetrius-menander-nearly-tried",
    philosopher: "Demetrius of Phalerum",
    topic: "encounter",
    gloss:
      "When Demetrius is under attack in Athens, Menander the comic poet is very nearly brought to trial for no other crime than being his friend - until Telesphorus begs him off.",
    grc:
      "ὁπηνίκα δʼ ἐσυκοφαντεῖτο ἐν ταῖς Ἀθήναισ—μανθάνω γὰρ καὶ τοῦτο—Μένανδρος ὁ κωμικὸς παρʼ ὀλίγον ἦλθε κριθῆναι διʼ οὐδὲν ἄλλο ἢ ὅτι φίλος ἦν αὐτῷ· ἀλλʼ αὐτὸν παρῃτήσατο Τελεσφόρος ὁ ἀνεψιὸς τοῦ Δημητρίου.",
    en: "At the time when he was being continually attacked in Athens, Menander, the Comic poet, as I have also learnt, was very nearly brought to trial for no other cause than that he was a friend of Demetrius. However, Telesphorus, the nephew of Demetrius, begged him off.",
    ref: "5.79",
    involves: "Menander",
    certainty: "asserted",
  },
  {
    id: "demetrius-asp-in-egypt",
    philosopher: "Demetrius of Phalerum",
    topic: "death",
    gloss:
      "Fleeing to Ptolemy Soter after Casander's death, Demetrius backs the wrong heir - and, detained in the country by the new king, dies in dejection of an asp-bite received in his sleep.",
    grc:
      "Φησὶ δʼ αὐτὸν Ἕρμιππος μετὰ τὸν Κασάνδρου θάνατον φοβηθέντα Ἀντίγονον παρὰ Πτολεμαῖον ἐλθεῖν τὸν Σωτῆρα· κἀκεῖ χρόνον ἱκανὸν διατρίβοντα συμβουλεύειν τῷ Πτολεμαίῳ πρὸς τοῖς ἄλλοις καὶ τὴν βασιλείαν τοῖς ἐξ Εὐρυδίκης περιθεῖναι παισί. τοῦ δὲ οὐ πεισθέντος, ἀλλὰ παραδόντος τὸ διάδημα τῷ ἐκ Βερενίκης, μετὰ τὴν ἐκείνου τελευτὴν ἀξιωθῆναι πρὸς τούτου παραφυλάττεσθαι ἐν τῇ χώρᾳ μέχρι τι δόξει περὶ αὐτοῦ. ἐνταῦθα ἀθυμότερον διῆγε· καί πως ὑπνώττων ὑπʼ ἀσπίδος τὴν χεῖρα δηχθεὶς τὸν βίον μεθῆκε. καὶ τέθαπται ἐν τῷ Βουσιρίτῃ νομῷ πλησίον Διοσπόλεως.",
    en: "Hermippus tells us that upon the death of Casander, being in fear of Antigonus, he fled to Ptolemy Soter. There he spent a considerable time and advised Ptolemy, among other things, to invest with sovereign power his children by Eurydice. To this Ptolemy would not agree, but bestowed the diadem on his son by Berenice, who, after Ptolemy’s death, thought fit to detain Demetrius as a prisoner in the country until some decision should be taken concerning him. There he lived in great dejection, and somehow, in his sleep, received an asp-bite on the hand which proved fatal. He is buried in the district of Busiris near Diospolis.",
    ref: "5.78",
    involves: "Ptolemy",
    certainty: "reported",
    accordingTo: "Hermippus",
  },
  // --- Heraclides Ponticus ---
  {
    id: "heraclides-snake-on-the-bier",
    philosopher: "Heraclides Ponticus",
    topic: "death",
    gloss:
      "At the point of death Heraclides orders a trusted attendant to hide his corpse and place his pet snake on the bier, that he might seem to have departed to the gods.",
    grc:
      "θρέψαι αὐτὸν δράκοντα ἐκ νέου καὶ αὐξηθέντα, ἐπειδὴ τελευτᾶν ἔμελλε, κελεῦσαί τινι τῶν πιστῶν αὑτοῦ τὸ σῶμα κατακρύψαι, τὸν δὲ δράκοντα ἐπὶ τῆς κλίνης θεῖναι, ἵνα δόξειεν εἰς θεοὺς μεταβεβηκέναι .",
    en: "As a boy, and when he grew up, he kept a pet snake, and, being at the point of death, he ordered a trusted attendant to conceal the corpse but to place the snake on his bier, that he might seem to have departed to the gods.",
    ref: "5.89",
    certainty: "reported",
    note: "Told by Demetrius of Magnesia (cited only here; no source node). The trick fails: in the midst of the procession the snake pops out of the shroud, and Heraclides is seen not as he appeared but as he really was (5.90).",
  },
  {
    id: "heraclides-forged-oracle",
    philosopher: "Heraclides Ponticus",
    topic: "death",
    gloss:
      "Heraclides bribes the sacred envoys and the Pythian priestess to proclaim him a golden-crowned hero - and is seized with apoplexy at his crowning, while the envoys are stoned and the priestess dies of a snake-bite.",
    grc:
      "Ἕρμιππος δὲ λιμοῦ κατασχόντος τὴν χώραν φησὶν αἰτεῖν τοὺς Ἡρακλεώτας τὴν Πυθίαν λύσιν. τὸν δὲ Ἡρακλείδην διαφθεῖραι χρήμασι τούς τε θεωροὺς καὶ τὴν προειρημένην, ὥστʼ ἀνειπεῖν ἀπαλλαγήσεσθαι τοῦ κακοῦ, εἰ ζῶν μὲν Ἡρακλείδης ὁ Εὐθύφρονος χρυσῷ στεφάνῳ στεφανωθείη πρὸς αὐτῶν, ἀποθανὼν δὲ ὡς ἥρως τιμῷτο. ἐκομίσθη ὁ δῆθεν χρησμὸς καὶ οὐδὲν ὤναντο οἱ πλάσαντες αὐτόν. αὐτίκα γὰρ ἐν τῷ θεάτρῳ στεφανούμενος ὁ Ἡρακλείδης ἀπόπληκτος ἐγένετο, οἵ τε θεωροὶ καταλευσθέντες διεφθάρησαν. ἀλλὰ καὶ ἡ Πυθία τὴν αὐτὴν ὥραν κατιοῦσα ἐς τὸ ἄδυτον καὶ ἐπιστᾶσα ἑνὶ τῶν δρακόντων δηχθεῖσα παραχρῆμα ἀπέπνευσε. καὶ τὰ μὲν περὶ τὸν θάνατον αὐτοῦ τοσαῦτα.",
    en: "Hermippus relates that, when their territory was visited by famine, the people of Heraclea besought the Pythian priestess for relief, but Heraclides bribed the sacred envoys as well as the aforesaid priestess to reply that they would be rid of the calamity if Heraclides, the son of Euthyphro, were crowned with a crown of gold in his lifetime and after his death received heroic honours. The pretended oracle was brought home, but its forgers got nothing by it. For directly Heraclides was crowned in the theatre, he was seized with apoplexy, whereupon the envoys to the oracle were stoned to death. Moreover, at the very same time the Pythian priestess, after she had gone down to the shrine and taken her seat, was bitten by one of the snakes and died instantly. Such are the tales told about his death.",
    ref: "5.91",
    certainty: "disputed",
    accordingTo: "Hermippus",
    note: "A rival to the pet-snake account of his death (5.89-90); D.L. closes with 'Such are the tales told about his death.'",
  },
  {
    id: "heraclides-duped-by-forgery",
    philosopher: "Heraclides Ponticus",
    topic: "encounter",
    gloss:
      "When Dionysius the Renegade forges the Parthenopaeus under Sophocles' name, the credulous Heraclides cites the play as Sophoclean evidence in one of his own works.",
    grc:
      "ἔτι καὶ Διονύσιος ὁ Μεταθέμενος 〈ἢ Σπίνθαρος, ὡς ἔνιοι〉 γράψας τὸν Παρθενοπαῖον ἐπέγραψε Σοφοκλέους. ὁ δὲ πιστεύσας εἴς τι τῶν ἰδίων συγγραμμάτων ἐχρῆτο μαρτυρίοις ὡς Σοφοκλέους.",
    en: "Again, Dionysius the Renegade, or, as some people call him, the Spark, when he wrote the Parthenopaeus, entitled it a play of Sophocles; and Heraclides, such was his credulity, in one of his own works drew upon this forged play as Sophoclean evidence.",
    ref: "5.92",
    involves: "Dionysius the Renegade",
    certainty: "asserted",
  },
  {
    id: "dionysius-parthenopaeus-acrostic",
    philosopher: "Dionysius the Renegade",
    topic: "wit",
    gloss:
      "Confessing his Sophoclean forgery to the unbelieving Heraclides, Dionysius points to the acrostic of his beloved Pancalus - and, still doubted, to the verses: 'An old monkey is not caught by a trap. Oh yes, he's caught at last, but it takes time.'",
    grc:
      "αἰσθόμενος δʼ ὁ Διονύσιος ἐμήνυσεν αὐτῷ τὸ γεγονός· τοῦ δʼ ἀρνουμένου καὶ ἀπιστοῦντος ἐπέστειλεν ἰδεῖν τὴν παραστιχίδα· καὶ εἶχε Πάγκαλος. οὗτος δʼ ἦν ἐρώμενος Διονυσίου· ὡς δʼ ἔτι ἀπιστῶν ἔλεγε κατὰ τὴν τύχην ἐνδέχεσθαι οὕτως ἔχειν, πάλιν ἀντεπέστειλεν ὁ Διονύσιος ὅτι καὶ ταῦτα εὑρήσεις· Α. γέρων πίθηκος οὐχ ἁλίσκεται πάγῃ· Β. ἁλίσκεται μέν, μετὰ χρόνον δʼ ἁλίσκεται. καὶ πρὸς τούτοις· Ἡρακλείδης γράμματα οὐκ ἐπίσταται οὐδʼ ᾐσχύνθη.",
    en: "Dionysius, on perceiving this, confessed what he had done; and, when the other denied the fact and would not believe him, called his attention to the acrostic which gave the name of Pancalus, of whom Dionysius was very fond. Heraclides was still unconvinced. Such a thing, he said, might very well happen by chance. To this Dionysius, You will also find these lines: a. An old monkey is not caught by a trap. b. Oh yes, he’s caught at last, but it takes time. And this besides: Heraclides is ignorant of letters and not ashamed of his ignorance.",
    ref: "5.93",
    involves: "Heraclides",
    certainty: "asserted",
    crossAttributed: true,
    note: "Recorded in the life of Heraclides Ponticus; the forger is the book-7 Stoic apostate Dionysius the Renegade.",
  },
];
