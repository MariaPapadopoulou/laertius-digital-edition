/**
 * Mention-only places: cities, islands, regions, Attic demes, Athens
 * landmarks and natural features that Diogenes Laertius names in the
 * text but that never occur as a claim value (those live in
 * place-coords.ts / entity-links.ts, keyed by claim-value label).
 *
 * Each entry mints an lo:Place node in the LOD graph (lod.ts), which
 * feeds the gazetteer -> the occurrence tagger -> the entities index
 * automatically, and supplies the map's "mentioned" layer (map.ts).
 *
 * Curation policy (same as entity-links.ts): every QID verified at
 * curation time against the Wikidata entity (label + P625 inside the
 * Mediterranean/Near-East frame); never guess a homonym. Modern
 * same-site items are acceptable (Amasra, Izmir, Mangalia, Messina,
 * Corfu, Catania). Runtime stays offline.
 *
 * Coordinate policy: Wikidata P625, rounded to 4 decimals. Manual
 * exceptions are commented inline (missing or visibly wrong P625,
 * whole-river representative points). Bounding-box exceptions: India
 * (Q668, lon 83) and Memphis/Babylon/Susa east-south extremes are
 * genuine D.L. references and simply extend the map frame.
 *
 * Deliberately NOT included (documented skips):
 * - Lamia: of the two occurrences one is the courtesan (5.76) - the
 *   closed-world tagger cannot tell them apart; tagging would
 *   mis-attribute, so the town is left out entirely;
 * - Sparta: the corpus consistently says "Lacedaemon", already a
 *   pinned claim place; adding "Sparta" would duplicate the node;
 * - Heraclea: already a claim place (Heraclea Pontica);
 * - Messene, Apollonia, Halae: ambiguous homonyms (Sicilian vs.
 *   Peloponnesian Messene, several Apollonias/Halaes) with nothing in
 *   the immediate context to disambiguate;
 * - Olympus, Hades: poetic/mythological, not geography;
 * - Greece, Asia, Europe, Italy: too generic to map usefully;
 * - Carystus: every occurrence sits inside the source label
 *   "Antigonus of Carystus", which the longest-match-first tagger
 *   rightly claims whole - the town alone is never named;
 * - Melos: the single English occurrence sits inside "Diagoras of
 *   Melos" (6.59), claimed whole by that person node since the
 *   sayings layer minted it; the Greek text has only the ethnic
 *   Μηλίου, never the island's name - zero taggable occurrences.
 *
 * Ambiguity resolutions baked into the picks (context-verified):
 * Seleucia = on-the-Tigris (10.26 says so), Magnesia = on-the-
 * Maeander, Chersonese = Thracian, Ida = Crete (8.1.3, cave of Ida),
 * Stratonicea = Caria (6.101, 10.9), Cyme = Aeolis.
 */

export interface MentionPlace {
  /** English surface form as it appears in Hicks' translation. */
  label: string;
  /** Verified Wikidata QID; absent when no trustworthy item exists. */
  qid?: string;
  lat: number;
  lon: number;
}

export const MENTION_PLACES: MentionPlace[] = [
  { label: "Acharnae", qid: "Q576319", lat: 38.0833, lon: 23.7333 },
  { label: "Aegospotami", qid: "Q404513", lat: 40.3641, lon: 26.6308 },
  { label: "Aenus", qid: "Q610751", lat: 40.7247, lon: 26.0825 },
  { label: "Alopece", qid: "Q2839314", lat: 37.95, lon: 23.75 },
  { label: "Amastris", qid: "Q455458", lat: 41.7464, lon: 32.3864 },
  { label: "Ambracia", qid: "Q661559", lat: 39.158, lon: 20.987 },
  { label: "Amphipolis", qid: "Q217414", lat: 40.8238, lon: 23.8478 },
  { label: "Anaphlystus", qid: "Q13422911", lat: 37.7273, lon: 23.9508 },
  { label: "Arcadia", qid: "Q12898802", lat: 37.6, lon: 22.2 },
  { label: "Argos", qid: "Q189901", lat: 37.6333, lon: 22.7292 },
  { label: "Aspendus", qid: "Q633757", lat: 36.9389, lon: 31.1722 },
  { label: "Atarneus", qid: "Q194810", lat: 39.0914, lon: 26.9213 },
  { label: "Attica", qid: "Q122443", lat: 38.0027, lon: 23.81 },
  { label: "Babylon", qid: "Q5684", lat: 32.5425, lon: 44.4211 },
  { label: "Boeotia", qid: "Q8257871", lat: 38.44, lon: 22.88 },
  { label: "Byzantium", qid: "Q23725", lat: 41.0134, lon: 28.9836 },
  { label: "Callatis", qid: "Q467498", lat: 43.8172, lon: 28.5828 },
  { label: "Catana", qid: "Q1903", lat: 37.5027, lon: 15.0873 },
  { label: "Ceos", qid: "Q214109", lat: 37.6125, lon: 24.34 },
  { label: "Ceramicus", qid: "Q630974", lat: 37.9783, lon: 23.7186 },
  { label: "Chaeronea", qid: "Q549874", lat: 38.495, lon: 22.8475 },
  { label: "Colchis", qid: "Q183150", lat: 42.2667, lon: 42 },
  { label: "Collytus", qid: "Q1779520", lat: 37.9583, lon: 23.7111 },
  { label: "Colonus", qid: "Q1235930", lat: 37.9958, lon: 23.7153 },
  { label: "Corcyra", qid: "Q121378", lat: 39.6, lon: 19.87 },
  { label: "Cos", qid: "Q187027", lat: 36.8153, lon: 27.1103 },
  { label: "Crete", qid: "Q34374", lat: 35.3097, lon: 24.8933 },
  { label: "Cyme", qid: "Q679305", lat: 38.7592, lon: 26.9364 },
  { label: "Cynosarges", qid: "Q940907", lat: 37.9666, lon: 23.7327 },
  { label: "Cythera", qid: "Q207239", lat: 36.2575, lon: 22.9975 },
  { label: "Delos", qid: "Q173148", lat: 37.3912, lon: 25.2712 },
  { label: "Delphi", qid: "Q75459", lat: 38.4833, lon: 22.5 },
  { label: "Eleusis", qid: "Q11918833", lat: 38.0441, lon: 23.5415 },
  { label: "Epidaurus", qid: "Q233576", lat: 37.5978, lon: 23.0744 },
  { label: "Etna", qid: "Q16990", lat: 37.7508, lon: 14.9932 },
  { label: "Euboea", qid: "Q173096", lat: 38.5, lon: 24 },
  { label: "Gargettus", qid: "Q12874917", lat: 38.0165, lon: 23.8719 },
  { label: "Halicarnassus", qid: "Q5843680", lat: 37.0378, lon: 27.4242 },
  { label: "Hellespont", qid: "Q6514", lat: 40.2, lon: 26.4 },
  // Hermione: Lasos' birthplace (1.42) and Callinus' home town in
  // Theophrastus' will ("Callinus of Hermione", 5.74). Modern same-site
  // item (Ermioni); the Greek text has only the ethnic Ἑρμιονεύς, and
  // ethnics are deferred by policy, so the tags are English-only.
  { label: "Hermione", qid: "Q994564", lat: 37.3833, lon: 23.25 },
  { label: "Iasus", qid: "Q279048", lat: 37.2778, lon: 27.5864 },
  { label: "Ida", qid: "Q83659", lat: 35.2264, lon: 24.7707 },
  { label: "India", qid: "Q668", lat: 22.8, lon: 83 },
  { label: "Ionia", qid: "Q620874", lat: 38.2, lon: 27.5 },
  { label: "Isthmus", qid: "Q215200", lat: 37.9329, lon: 22.9837 },
  { label: "Laconia", qid: "Q11931074", lat: 37, lon: 22.5833 },
  { label: "Larissa", qid: "Q178405", lat: 39.6385, lon: 22.4131 },
  { label: "Lemnos", qid: "Q192483", lat: 39.9167, lon: 25.25 },
  { label: "Leontini", qid: "Q3830644", lat: 37.2814, lon: 15.0039 },
  { label: "Lesbos", qid: "Q128087", lat: 39.21, lon: 26.28 },
  { label: "Libya", qid: "Q2370577", lat: 30.5, lon: 18.0 }, // Ancient Libya has no P625; representative N-African coast point
  { label: "Lyceum", qid: "Q1160664", lat: 37.974, lon: 23.7433 },
  { label: "Lydia", qid: "Q620765", lat: 38.4883, lon: 28.0403 }, // Wikidata P625 (40,30) lies in Bithynia; using the Sardis region point
  { label: "Macedonia", qid: "Q83958", lat: 40.478, lon: 22.3228 },
  { label: "Magnesia", qid: "Q1432674", lat: 37.8527, lon: 27.5271 },
  { label: "Mantinea", qid: "Q1160195", lat: 37.6167, lon: 22.3833 },
  { label: "Marathon", qid: "Q212150", lat: 38.1533, lon: 23.9619 },
  { label: "Megalopolis", qid: "Q823721", lat: 37.4, lon: 22.1333 },
  { label: "Memphis", qid: "Q5715", lat: 29.8447, lon: 31.2509 },
  { label: "Messenia", qid: "Q1247159", lat: 37.25, lon: 21.8333 },
  { label: "Munichia", qid: "Q1611219", lat: 37.9406, lon: 23.6559 },
  { label: "Myrrhinus", qid: "Q1431270", lat: 37.8697, lon: 23.9714 },
  { label: "Nemea", qid: "Q748108", lat: 37.809, lon: 22.7103 },
  { label: "Nicaea", qid: "Q739037", lat: 40.429, lon: 29.7195 },
  { label: "Nicomedia", qid: "Q209349", lat: 40.7625, lon: 29.9175 },
  { label: "Nile", qid: "Q3392", lat: 26.0, lon: 32.7 }, // P625 marks the whole river in Sudan; using the Egyptian stretch D.L. means
  { label: "Olympia", qid: "Q38888", lat: 37.6383, lon: 21.63 },
  { label: "Olynthus", qid: "Q1141669", lat: 40.2927, lon: 23.3545 },
  { label: "Oropus", qid: "Q18073696", lat: 38.3195, lon: 23.79 },
  { label: "Paeania", qid: "Q18015501", lat: 37.9569, lon: 23.8511 }, // deme item has no P625; modern Paiania town centre (same site)
  { label: "Paros", qid: "Q201272", lat: 37.05, lon: 25.1833 },
  { label: "Pergamum", qid: "Q18986", lat: 39.1167, lon: 27.1833 },
  { label: "Perinthus", qid: "Q11815679", lat: 40.9709, lon: 27.9545 },
  { label: "Persia", qid: "Q3746183", lat: 30, lon: 52 },
  { label: "Pharsalus", qid: "Q38281085", lat: 39.2882, lon: 22.3878 },
  { label: "Phoenicia", qid: "Q41642", lat: 34.1167, lon: 35.65 },
  { label: "Phrygia", qid: "Q32579", lat: 39, lon: 31 },
  { label: "Piraeus", qid: "Q58976", lat: 37.943, lon: 23.6469 },
  { label: "Pontus", qid: "Q621672", lat: 40.68, lon: 37.83 },
  { label: "Potidaea", qid: "Q999468", lat: 40.2, lon: 23.3333 },
  { label: "Proconnesus", qid: "Q950908", lat: 40.6225, lon: 27.63 },
  { label: "Propontis", qid: "Q35367", lat: 40.75, lon: 28 }, // Sea of Marmara ("Propontis" is a Wikidata alias); Eudoxus 8.87, Timon 9.110
  { label: "Rhegium", qid: "Q3429952", lat: 38.1093, lon: 15.6439 },
  { label: "Rhodes", qid: "Q43048", lat: 36.17, lon: 27.92 },
  { label: "Rome", qid: "Q220", lat: 41.8931, lon: 12.4828 },
  { label: "Samothrace", qid: "Q203175", lat: 40.45, lon: 25.5875 },
  { label: "Sardis", qid: "Q232615", lat: 38.4883, lon: 28.0403 },
  { label: "Scepsis", qid: "Q2292038", lat: 39.8028, lon: 26.6861 },
  { label: "Seleucia", qid: "Q1136681", lat: 33.1, lon: 44.52 },
  { label: "Selinus", qid: "Q952173", lat: 37.5836, lon: 12.8247 },
  { label: "Sicyon", qid: "Q368628", lat: 37.9841, lon: 22.7111 },
  { label: "Sidon", qid: "Q163490", lat: 33.5606, lon: 35.3758 },
  { label: "Smyrna", qid: "Q1379299", lat: 38.4186, lon: 27.1428 },
  { label: "Stratonicea", qid: "Q1361187", lat: 37.3131, lon: 28.0642 },
  { label: "Susa", qid: "Q180773", lat: 32.1894, lon: 48.2561 },
  { label: "Syria", qid: "Q13415123", lat: 34, lon: 36 },
  { label: "Tanagra", qid: "Q779310", lat: 38.3274, lon: 23.5365 },
  { label: "Thasos", qid: "Q204096", lat: 40.6942, lon: 24.6611 },
  { label: "Thracian Chersonese", qid: "Q3774282", lat: 40.35, lon: 26.4667 },
  { label: "Thria", lat: 38.05, lon: 23.6 }, // Wikidata item for the deme is mislabeled (never guess); Thriasian plain point, QID omitted
  { label: "Thurii", qid: "Q602564", lat: 39.695, lon: 16.4711 },
  { label: "Tralles", qid: "Q462630", lat: 37.86, lon: 27.8355 },
  { label: "Troy", qid: "Q22647", lat: 39.9575, lon: 26.2389 },
  { label: "Tyre", qid: "Q82070", lat: 33.2667, lon: 35.2 },
  { label: "Xypete", qid: "Q13424319", lat: 37.9576, lon: 23.6855 },
  { label: "Zacynthus", qid: "Q144880", lat: 37.8, lon: 20.75 },
  { label: "Zancle", qid: "Q13666", lat: 38.1936, lon: 15.5542 },
];
