/**
 * Ontology of places: a curated type (closed union) and an optional
 * containing place for every lo:Place node in the graph - the 64
 * claim-value places (place-coords.ts), the 3 coordinate-less compound
 * claim labels, and the 108 mention-only places (place-mentions.ts).
 *
 * Types become rdfs:subClassOf lo:Place classes in the ontology
 * (lo:City, lo:Island, lo:Region, lo:Deme, lo:Landmark,
 * lo:NaturalFeature); every node keeps `a lo:Place` so the gazetteer's
 * kind detection (set membership) is untouched. The base type "place"
 * asserts no subclass - reserved for the compound/uncertain labels
 * where D.L. himself reports rival locations.
 *
 * PLACE_LOCATED_IN targets ONLY labels that are themselves place
 * nodes (lod.ts throws on dangling targets - no new nodes are ever
 * minted here). Deliberately plain, not owl:TransitiveProperty: the
 * SPARQL endpoint does no OWL reasoning, so declared transitivity
 * would be a lie in the queryable data; consumers chain with
 * `lo:locatedIn+`.
 *
 * Classification calls (dominant sense in D.L., one type per label):
 * - Demes: only labels whose D.L. usage is demotic/residential
 *   (Alopece, Acharnae, Anaphlystus, Collytus, Colonus, Gargettus,
 *   Myrrhinus, Paeania, Phalerum, Thria, Xypete). Marathon, Eleusis
 *   and Piraeus were Attic demes too, but D.L. uses them as towns or
 *   battle/cult sites - typed city.
 * - Landmark = sanctuary, gymnasium, urban district or other named
 *   non-polis site: Academy, Lyceum, Cynosarges, Ceramicus, Munichia,
 *   Delphi, Olympia, Nemea.
 * - naturalFeature: Etna, Nile, Ida (the Cretan mountain, per
 *   place-mentions.ts), Hellespont, Propontis, Aegospotami (the
 *   river/battle coast), Isthmus (of Corinth), and Bosporus - the
 *   curated QID/coords are the Cimmerian strait, not a city.
 * - Borysthenes is the CITY (Olbia - the curated coords confirm),
 *   not the river; no containing region asserted (Scythian coast is
 *   a judgment call D.L. does not make).
 * - Islands that double as poleis or regions take island as the
 *   dominant type: Delos, Salamis, Samos, Chios, Cos, Rhodes, Crete,
 *   Euboea, Sicily, Cyprus, Aegina, Corcyra…
 * - Elis and Pisa are typed city (Pyrrho "of Elis" the town; Pisa
 *   the Olympian town), both located in the Peloponnesus.
 * - Peloponnesus, Attica, Ionia, Laconia … are lo:Region; region-in-
 *   region containment only where uncontroversial (Arcadia, Laconia,
 *   Messenia → Peloponnesus). Attica/Ionia get no parent - Greece
 *   and Asia are deliberately not nodes (too generic to map).
 *
 * Containment policy (never guess): asserted only where the
 * association is textbook-unambiguous (Athens → Attica, Miletus →
 * Ionia, Syracuse → Sicily, Sidon → Phoenicia, Troy → Troas …).
 * Sinope → Pontus follows D.L.'s own usage (Diogenes the Pontic
 * Sinopean; cf. "Heraclea in the Pontus"), though the city is
 * classically Paphlagonian and joined the Pontic kingdom only in
 * 183 BC.
 * Deliberately unasserted, with reasons:
 * - Thracian cities (Abdera, Maroneia, Aenus, Perinthus): Thrace is
 *   not a node;
 * - Bithynian/Carian/Aeolian/Mysian/Pamphylian cities (Chalcedon,
 *   Byzantium, Nicaea, Nicomedia, Halicarnassus, Cnidos, Iasus,
 *   Tralles, Stratonicea, Cyme, Pitane, Atarneus, Pergamum,
 *   Aspendus, Lampsacus): their regions are not nodes (Lampsacus
 *   sits on the Hellespont edge of the Troad - too debatable);
 * - Oropus: the Attica/Boeotia border town changed hands too often;
 * - Megara, Salamis, Isthmus: Megarid/Saronic positions are not
 *   containment in any node;
 * - Amphipolis, Potidaea, Olynthus: Thracian/Chalcidic foundations
 *   only later Macedonian - Stagira alone is asserted (Aristotle's
 *   birthplace is universally "Stagira in Macedonia");
 * - Babylon, Seleucia, Callatis, Amastris, Larissa, Pharsalus,
 *   Ambracia, Rome, Carthage, Byzantium: no suitable region node.
 */

export type PlaceType =
  | "city"
  | "island"
  | "region"
  | "deme"
  | "landmark"
  | "naturalFeature"
  | "place";

/** rdfs:subClassOf lo:Place - the base "place" adds no subclass. */
export const PLACE_CLASS: Record<Exclude<PlaceType, "place">, string> = {
  city: "City",
  island: "Island",
  region: "Region",
  deme: "Deme",
  landmark: "Landmark",
  naturalFeature: "NaturalFeature",
};

export const PLACE_TYPES: Record<string, PlaceType> = {
  // ---- claim-value places (place-coords.ts keys) ----
  Abdera: "city",
  Academy: "landmark",
  Aegina: "island",
  "Agrigentum (Acragas)": "city",
  Alexandria: "city",
  Assos: "city",
  Astypalaea: "island",
  Athens: "city",
  Borysthenes: "city",
  Bosporus: "naturalFeature",
  Carthage: "city",
  Chalcedon: "city",
  Chalcis: "city",
  Chios: "island",
  Cilicia: "region",
  Citium: "city",
  Clazomenae: "city",
  Cnidos: "city",
  "Cnossos in Crete": "city",
  Colophon: "city",
  Corinth: "city",
  Croton: "city",
  Cyprus: "island",
  Cyrene: "city",
  Cyzicus: "city",
  Egypt: "region",
  Elea: "city",
  Elis: "city",
  Ephesus: "city",
  Eresus: "city",
  Eretria: "city",
  Gela: "city",
  Heraclea: "city",
  "Heraclea in the Pontus": "city",
  Italy: "region",
  Lacedaemon: "city",
  Lampsacus: "city",
  Lindus: "city",
  Maroneia: "city",
  Megara: "city",
  Metapontum: "city",
  Miletus: "city",
  Mitylene: "city",
  Peloponnesus: "region",
  Phalerum: "deme",
  Phlius: "city",
  Pisa: "city",
  Pitane: "city",
  Priene: "city",
  Salamis: "island",
  Samos: "island",
  Scillus: "city",
  Scythia: "region",
  Sicily: "island",
  Sinope: "city",
  Soli: "city",
  Stagira: "city",
  Syracuse: "city",
  Syros: "island",
  Tarentum: "city",
  Tarsus: "city",
  Teos: "city",
  Thebes: "city",
  Troas: "region",
  // ---- compound/uncertain claim labels (no coordinates, no subclass) ----
  "Abdera, or, according to some, Miletus": "place",
  "Elea, but some say Abdera and others Miletus": "place",
  "Chen (a village in the district of Oeta or Laconia)": "place",
  // ---- mention-only places (place-mentions.ts labels) ----
  Acharnae: "deme",
  Aegospotami: "naturalFeature",
  Aenus: "city",
  Alopece: "deme",
  Amastris: "city",
  Ambracia: "city",
  Amphipolis: "city",
  Anaphlystus: "deme",
  Arcadia: "region",
  Argos: "city",
  Aspendus: "city",
  Atarneus: "city",
  Attica: "region",
  Babylon: "city",
  Boeotia: "region",
  Byzantium: "city",
  Callatis: "city",
  Catana: "city",
  Ceos: "island",
  Ceramicus: "landmark",
  Chaeronea: "city",
  Colchis: "region",
  Collytus: "deme",
  Colonus: "deme",
  Corcyra: "island",
  Cos: "island",
  Crete: "island",
  Cyme: "city",
  Cynosarges: "landmark",
  Cythera: "island",
  Delos: "island",
  Delphi: "landmark",
  Eleusis: "city",
  Epidaurus: "city",
  Etna: "naturalFeature",
  Euboea: "island",
  Gargettus: "deme",
  Halicarnassus: "city",
  Hellespont: "naturalFeature",
  Hermione: "city",
  Iasus: "city",
  Ida: "naturalFeature",
  India: "region",
  Ionia: "region",
  Isthmus: "naturalFeature",
  Laconia: "region",
  Larissa: "city",
  Lemnos: "island",
  Leontini: "city",
  Lesbos: "island",
  Libya: "region",
  Lyceum: "landmark",
  Lydia: "region",
  Macedonia: "region",
  Magnesia: "city",
  Mantinea: "city",
  Marathon: "city",
  Megalopolis: "city",
  Memphis: "city",
  Messenia: "region",
  Munichia: "landmark",
  Myrrhinus: "deme",
  Nemea: "landmark",
  Nicaea: "city",
  Nicomedia: "city",
  Nile: "naturalFeature",
  Olympia: "landmark",
  Olynthus: "city",
  Oropus: "city",
  Paeania: "deme",
  Paros: "island",
  Pergamum: "city",
  Perinthus: "city",
  Persia: "region",
  Pharsalus: "city",
  Phoenicia: "region",
  Phrygia: "region",
  Piraeus: "city",
  Pontus: "region",
  Potidaea: "city",
  Proconnesus: "island",
  Propontis: "naturalFeature",
  Rhegium: "city",
  Rhodes: "island",
  Rome: "city",
  Samothrace: "island",
  Sardis: "city",
  Scepsis: "city",
  Seleucia: "city",
  Selinus: "city",
  Sicyon: "city",
  Sidon: "city",
  Smyrna: "city",
  Stratonicea: "city",
  Susa: "city",
  Syria: "region",
  Tanagra: "city",
  Thasos: "island",
  "Thracian Chersonese": "region",
  Thria: "deme",
  Thurii: "city",
  Tralles: "city",
  Troy: "city",
  Tyre: "city",
  Xypete: "deme",
  Zacynthus: "island",
  Zancle: "city",
};

/**
 * Containing place, keyed by place label; every value MUST itself be
 * a place label (lod.ts throws otherwise). One level only - chains
 * (Munichia → Piraeus → Attica) are traversed by SPARQL property
 * paths, not materialized.
 */
export const PLACE_LOCATED_IN: Record<string, string> = {
  // Attica and Athens
  Athens: "Attica",
  Piraeus: "Attica",
  Eleusis: "Attica",
  Marathon: "Attica",
  Acharnae: "Attica",
  Alopece: "Attica",
  Anaphlystus: "Attica",
  Collytus: "Attica",
  Colonus: "Attica",
  Gargettus: "Attica",
  Myrrhinus: "Attica",
  Paeania: "Attica",
  Phalerum: "Attica",
  Thria: "Attica",
  Xypete: "Attica",
  Academy: "Athens",
  Lyceum: "Athens",
  Cynosarges: "Athens",
  Ceramicus: "Athens",
  Munichia: "Piraeus",
  // Peloponnesus
  Arcadia: "Peloponnesus",
  Laconia: "Peloponnesus",
  Messenia: "Peloponnesus",
  Corinth: "Peloponnesus",
  Argos: "Peloponnesus",
  Epidaurus: "Peloponnesus",
  Hermione: "Peloponnesus",
  Sicyon: "Peloponnesus",
  Phlius: "Peloponnesus",
  Elis: "Peloponnesus",
  Pisa: "Peloponnesus",
  Scillus: "Peloponnesus",
  Olympia: "Peloponnesus",
  Nemea: "Peloponnesus",
  Lacedaemon: "Laconia",
  Mantinea: "Arcadia",
  Megalopolis: "Arcadia",
  // Boeotia
  Thebes: "Boeotia",
  Chaeronea: "Boeotia",
  Tanagra: "Boeotia",
  // Euboea
  Chalcis: "Euboea",
  Eretria: "Euboea",
  // Ionia
  Miletus: "Ionia",
  Ephesus: "Ionia",
  Colophon: "Ionia",
  Clazomenae: "Ionia",
  Priene: "Ionia",
  Teos: "Ionia",
  Smyrna: "Ionia",
  // islands
  "Cnossos in Crete": "Crete",
  Ida: "Crete",
  Eresus: "Lesbos",
  Mitylene: "Lesbos",
  Lindus: "Rhodes",
  Citium: "Cyprus",
  // Sicily and Italy
  Syracuse: "Sicily",
  Gela: "Sicily",
  "Agrigentum (Acragas)": "Sicily",
  Catana: "Sicily",
  Leontini: "Sicily",
  Selinus: "Sicily",
  Zancle: "Sicily",
  Etna: "Sicily",
  Elea: "Italy",
  Croton: "Italy",
  Metapontum: "Italy",
  Tarentum: "Italy",
  Thurii: "Italy",
  Rhegium: "Italy",
  // Pontus
  Sinope: "Pontus",
  Heraclea: "Pontus",
  "Heraclea in the Pontus": "Pontus",
  // Cilicia
  Tarsus: "Cilicia",
  Soli: "Cilicia",
  // Troas
  Troy: "Troas",
  Assos: "Troas",
  Scepsis: "Troas",
  // Thracian Chersonese
  Aegospotami: "Thracian Chersonese",
  // Lydia
  Sardis: "Lydia",
  // Egypt
  Alexandria: "Egypt",
  Memphis: "Egypt",
  Nile: "Egypt",
  // Phoenicia
  Sidon: "Phoenicia",
  Tyre: "Phoenicia",
  // Libya
  Cyrene: "Libya",
  // Macedonia
  Stagira: "Macedonia",
  // Persia
  Susa: "Persia",
};
