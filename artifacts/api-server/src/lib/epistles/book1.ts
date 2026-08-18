import type { Epistle } from "../epistles";

/**
 * The letters of the Seven Sages (and their correspondents) quoted at the
 * chapter ends of Book 1. The entire book-1 correspondence is Hellenistic
 * epistolary fiction (pseudepigrapha) - a scholarly consensus reflected in
 * `authenticity: "spurious"` throughout; D.L. himself hedges several of them
 * ("a short letter is also ascribed to him").
 */
export const BOOK1_EPISTLES: Epistle[] = [
  {
    id: "thales-to-pherecydes",
    sender: "Thales",
    to: "Pherecydes",
    ref: "1.1.43",
    grc: "Πυνθάνομαί σε πρῶτον Ἰώνων μέλλειν λόγους ἀμφὶ τῶν θείων χρημάτων ἐς τοὺς Ἕλληνας φαίνειν.",
    en: "I hear that you intend to be the first Ionian to expound theology to the Greeks. And perhaps it was a wise decision to make the book common property without taking advice, instead of entrusting it to any particular persons whatsoever, a course which has no advantages.",
    gloss:
      "Thales offers to discuss Pherecydes' forthcoming book on the gods, and to sail to Syros with Solon to do so.",
    topic: "writings",
    authenticity: "spurious",
  },
  {
    id: "thales-to-solon",
    sender: "Thales",
    to: "Solon",
    ref: "1.1.44",
    grc: "Ὑπαποστὰς ἐξ Ἀθηνέων δοκέεις ἄν μοι ἁρμοδιώτατα ἐν Μιλήτῳ οἶκον ποιέεσθαι παρὰ τοῖς ἀποίκοις ὑμέων·",
    en: "If you leave Athens, it seems to me that you could most conveniently set up your abode at Miletus, which is an Athenian colony; for there you incur no risk.",
    gloss:
      "Thales invites the self-exiled Solon to settle at Miletus - or, if he prefers Priene, promises to come live beside him.",
    topic: "invitation",
    authenticity: "spurious",
  },
  {
    id: "pisistratus-to-solon",
    sender: "Pisistratus",
    to: "Solon",
    ref: "1.2.53",
    grc: "Οὔτε μόνος Ἑλλήνων τυραννίδι ἐπεθέμην, οὔτε οὐ προσῆκόν μοι, γένους ὄντι τῶν Κοδριδῶν.",
    en: "I am not the only man who has aimed at a tyranny in Greece, nor am I, a descendant of Codrus, unfitted for the part.",
    gloss:
      "The tyrant defends his rule as lawful restoration, swears Solon will come to no harm, and invites him home to Athens.",
    topic: "politics",
    authenticity: "spurious",
  },
  {
    id: "solon-to-periander",
    sender: "Solon",
    to: "Periander",
    ref: "1.2.64",
    grc: "Ἀπαγγέλλεις μοι πολλούς τοι ἐπιβουλεύειν. σὺ δὲ εἰ μὲν μέλλεις ἐκποδὼν ἅπαντας ποιήσεσθαι, οὐκ ἂν φθάνοις.",
    en: "You tell me that many are plotting against you. You must lose no time if you want to get rid of them all.",
    gloss:
      "Solon tells the tyrant that plots are the price of tyranny: the best course is to resign power, the second-best a mercenary force stronger than the city's.",
    topic: "politics",
    authenticity: "spurious",
  },
  {
    id: "solon-to-epimenides",
    sender: "Solon",
    to: "Epimenides",
    ref: "1.2.64",
    grc: "Οὔτε οἱ ἐμοὶ θεσμοὶ ἄρα Ἀθηναίους ἐπιπολὺ ὀνήσειν ἔμελλον, οὔτε σὺ καθήρας τὴν πόλιν ὤνησας.",
    en: "It seems that after all I was not to confer much benefit on Athenians by my laws, any more than you by purifying the city.",
    gloss:
      "Solon reflects bitterly that neither his laws nor Epimenides' purification saved Athens from Pisistratus, and recounts the tyrant's rise (the letter runs on through 1.65–66).",
    topic: "politics",
    authenticity: "spurious",
  },
  {
    id: "solon-to-pisistratus",
    sender: "Solon",
    to: "Pisistratus",
    ref: "1.2.66",
    grc: "Πιστεύω μηδὲν κακὸν ἐκ σοῦ πείσεσθαι. καὶ γὰρ πρὸ τῆς τυραννίδος φίλος σοὶ ἦν,",
    en: "I am sure that I shall suffer no harm at your hands; for before you became tyrant I was your friend, and now I have no quarrel with you beyond that of every Athenian who disapproves of tyranny.",
    gloss:
      "Solon declines the tyrant's invitation to return: the best of tyrants is still a tyrant, and coming home would look like approval.",
    topic: "politics",
    authenticity: "spurious",
  },
  {
    id: "solon-to-croesus",
    sender: "Solon",
    to: "Croesus",
    ref: "1.2.67",
    grc: "Ἄγαμαί σε τῆς περὶ ἡμᾶς φιλοφροσύνης·",
    en: "I admire you for your kindness to me; and, by Athena, if I had not been anxious before all things to live in a democracy, I would rather have fixed my abode in your palace than at Athens, where Pisistratus is setting up a rule of violence.",
    gloss:
      "Solon accepts Croesus' invitation to Sardis - while insisting he would still rather live where all have equal rights.",
    topic: "invitation",
    authenticity: "spurious",
  },
  {
    id: "chilon-to-periander",
    sender: "Chilon",
    to: "Periander",
    ref: "1.3.73",
    grc: "Ἐπιστέλλεις ἐμὶν ἐκστρατείαν ἐπὶ ἐκδάμως, ὡς αὐτός κα ἐξέρποις·",
    en: "You tell me of an expedition against foreign enemies, in which you yourself will take the field. In my opinion affairs at home are not too safe for an absolute ruler; and I deem the tyrant happy who dies a natural death in his own house.",
    gloss:
      "Chilon warns the tyrant against campaigning abroad: for an absolute ruler even home is unsafe. D.L. notes the letter is merely 'ascribed to him'.",
    topic: "politics",
    authenticity: "spurious",
    note: "Written in literary Doric; D.L. introduces it with a hedge - 'a short letter is also ascribed to him'.",
  },
  {
    id: "pittacus-to-croesus",
    sender: "Pittacus",
    to: "Croesus",
    ref: "1.4.81",
    grc: "Κέλεαί με ἱκνέεσθαι ἐς Λυδίην, ὅπως σοι τὸν ὄλβον ἴδοιμι·",
    en: "You bid me come to Lydia in order to see your prosperity: but without seeing it I can well believe that the son of Alyattes is the most opulent of kings. There will be no advantage to me in a journey to Sardis, for I am not in want of money, and my possessions are sufficient for my friends as well as myself.",
    gloss:
      "Pittacus needs no proof of Croesus' gold and wants none of it - but will come anyway, for the company. D.L. marks the letter as 'ascribed to him'.",
    topic: "invitation",
    authenticity: "spurious",
    note: "D.L. introduces it with a hedge - 'the following short letter is ascribed to him'.",
  },
  {
    id: "cleobulus-to-solon",
    sender: "Cleobulus",
    to: "Solon",
    ref: "1.6.93",
    grc: "Πολλοὶ μέν τιν ἔασιν ἕταροι καὶ οἶκος πάντη·",
    en: "You have many friends and a home wherever you go; but the most suitable for Solon will, say I, be Lindus, which is governed by a democracy. The island lies on the high seas, and one who lives here has nothing to fear from Pisistratus.",
    gloss:
      "Cleobulus bids for the exiled Solon: democratic, sea-girt Lindus is beyond Pisistratus' reach.",
    topic: "invitation",
    authenticity: "spurious",
  },
  {
    id: "periander-to-the-wise-men",
    sender: "Periander",
    to: "the Wise Men",
    ref: "1.7.99",
    grc: "Πολλὰ χάρις τῷ Πυθοῖ Ἀπόλλωνι τοῦ εἰς ἓν ἐλθόντας εὑρεῖν.",
    en: "Very grateful am I to the Pythian Apollo that I found you gathered together; and my letters will also bring you to Corinth, where, as you know, I will give you a thoroughly popular reception.",
    gloss:
      "Periander summons the assembled Sages to Corinth for a second gathering, the year after their meeting at the Lydian court.",
    topic: "invitation",
    authenticity: "spurious",
    dramaticDate:
      "the year after the Sages' gathering at the Lydian court in Sardis (so the letter itself: 'I learn that last year you met in Sardis')",
  },
  {
    id: "periander-to-procles",
    sender: "Periander",
    to: "Procles",
    ref: "1.7.100",
    grc: "Ἐμὶν μὲν ἀκούσιον τᾶς δάμαρτος τὸ ἄγος·",
    en: "The murder of my wife was unintentional; but yours is deliberate guilt when you set my son’s heart against me. Either therefore put an end to my son’s harsh treatment, or I will revenge myself on you.",
    gloss:
      "Periander threatens his father-in-law Procles for turning his son against him over his wife's death.",
    topic: "family",
    authenticity: "spurious",
  },
  {
    id: "thrasybulus-to-periander",
    sender: "Thrasybulus",
    to: "Periander",
    ref: "1.7.100",
    grc: "Τῷ μὲν κήρυκι σεῦ οὐδὲν ὑπεκρινάμην·",
    en: "I made no answer to your herald; but I took him into a cornfield, and with a staff smote and cut off the over-grown ears of corn, while he accompanied me. And if you ask him what he heard and what he saw, he will give his message.",
    gloss:
      "The tyrant of Miletus answers Periander's herald in mime - lop off the tallest ears of corn: kill the pre-eminent citizens, friend and foe alike.",
    topic: "politics",
    authenticity: "spurious",
  },
  {
    id: "anacharsis-to-croesus",
    sender: "Anacharsis",
    to: "Croesus",
    ref: "1.8.105",
    grc: "Ἐγώ, βασιλεῦ Λυδῶν, ἀφῖγμαι εἰς τὴν τῶν Ἑλλήνων, διδαθησόμενος ἤθη τὰ τούτων καὶ ἐπιτηδεύματα.",
    en: "I have come, O King of the Lydians, to the land of the Greeks to be instructed in their manners and pursuits. And I am not even in quest of gold, but am well content to return to Scythia a better man.",
    gloss:
      "The Scythian announces himself at Sardis: he seeks Greek learning, not Lydian gold. D.L. notes the letter is merely 'attributed' to him.",
    topic: "invitation",
    authenticity: "spurious",
    note: "D.L. introduces it with a hedge - 'to him is attributed the following letter'.",
  },
  {
    id: "epimenides-to-solon",
    sender: "Epimenides",
    to: "Solon",
    ref: "1.10.113",
    grc: "Θάρρει, ὦ ἑταῖρε.",
    en: "Courage, my friend. For if Pisistratus had attacked the Athenians while they were still serfs and before they had good laws, he would have secured power in perpetuity by the enslavement of the citizens.",
    gloss:
      "Epimenides consoles the exiled Solon - Pisistratus' tyranny cannot outlast men raised free under good laws - and invites him to safety in Crete.",
    topic: "invitation",
    authenticity: "spurious",
  },
  {
    id: "pherecydes-to-thales",
    sender: "Pherecydes",
    to: "Thales",
    ref: "1.11.122",
    grc: "Εὖ θνήσκοις ὅταν τοι τὸ χρεὼν ἥκῃ· νοῦσός με καταλελάβηκε δεδεγμένον τὰ παρὰ σέο γράμματα.",
    en: "May yours be a happy death when your time comes. Since I received your letter, I have been attacked by disease. I am infested with vermin and subject to a violent fever with shivering fits. I have therefore given instructions to my servants to carry my writing to you after they have buried me.",
    gloss:
      "Dying of his disease, Pherecydes bequeaths his book to Thales - to be published only if the sages approve, 'for mine is all guess-work'.",
    topic: "death",
    authenticity: "spurious",
  },
];
