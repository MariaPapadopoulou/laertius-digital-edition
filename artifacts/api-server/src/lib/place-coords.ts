/**
 * Curated coordinates for the place labels used as claim values,
 * keyed by the exact claim-value label (same keys as PLACE_QIDS in
 * entity-links.ts).
 *
 * Curation pipeline: fetched once from Wikidata P625 (coordinate
 * location) for each curated PLACE_QID at curation time - the runtime
 * never calls Wikidata. Every coordinate was sanity-checked against a
 * Mediterranean/Near-East bounding box (lat 18–55, lon −12–55).
 *
 * Deliberately unmapped (same as PLACE_QIDS - compound/uncertain
 * labels, never guess):
 *   - "Abdera, or, according to some, Miletus"
 *   - "Elea, but some say Abdera and others Miletus"
 *   - "Chen (a village in the district of Oeta or Laconia)"
 *
 * Notes: "Heraclea" and "Heraclea in the Pontus" intentionally share
 * Heraclea Pontica's coordinates (same QID). Regions (Egypt, Italy,
 * Sicily, Scythia, Cilicia, Peloponnesus, Cyprus, Troas) carry
 * Wikidata's representative point for the region.
 */
export interface PlaceCoord {
  lat: number;
  lon: number;
}

export const PLACE_COORDS: Record<string, PlaceCoord> = {
  Abdera: { lat: 40.9814, lon: 24.9518 },
  Academy: { lat: 37.9924, lon: 23.7081 },
  Aegina: { lat: 37.73, lon: 23.49 },
  "Agrigentum (Acragas)": { lat: 37.2923, lon: 13.5936 },
  Alexandria: { lat: 31.1975, lon: 29.8925 },
  Assos: { lat: 39.4906, lon: 26.3367 },
  Astypalaea: { lat: 36.5808, lon: 26.3756 },
  Athens: { lat: 37.9842, lon: 23.7281 },
  Borysthenes: { lat: 46.7, lon: 31.9 },
  Bosporus: { lat: 45.26, lon: 37.04 },
  Carthage: { lat: 36.8526, lon: 10.3235 },
  Chalcedon: { lat: 40.9833, lon: 29.0333 },
  Chalcis: { lat: 38.4624, lon: 23.5971 },
  Chios: { lat: 38.4, lon: 26.0167 },
  Cilicia: { lat: 36.985, lon: 35.12 },
  Citium: { lat: 34.9233, lon: 33.6305 },
  Clazomenae: { lat: 38.3582, lon: 26.7676 },
  Cnidos: { lat: 36.6858, lon: 27.375 },
  "Cnossos in Crete": { lat: 35.298, lon: 25.1632 },
  Colophon: { lat: 38.1156, lon: 27.1422 },
  Corinth: { lat: 37.9058, lon: 22.8787 },
  Croton: { lat: 39.0812, lon: 17.128 },
  Cyprus: { lat: 35, lon: 33 },
  Cyrene: { lat: 32.8167, lon: 21.85 },
  Cyzicus: { lat: 40.3878, lon: 27.8706 },
  Egypt: { lat: 27, lon: 29 },
  Elea: { lat: 40.1594, lon: 15.1544 },
  Elis: { lat: 37.6667, lon: 21.5 },
  Ephesus: { lat: 37.9397, lon: 27.3486 },
  Eresus: { lat: 39.1699, lon: 25.9338 },
  Eretria: { lat: 38.3971, lon: 23.7902 },
  Gela: { lat: 37.0667, lon: 14.25 },
  Heraclea: { lat: 41.2847, lon: 31.4147 },
  "Heraclea in the Pontus": { lat: 41.2847, lon: 31.4147 },
  Italy: { lat: 42.5, lon: 12.5 },
  Lacedaemon: { lat: 37.0819, lon: 22.4236 },
  Lampsacus: { lat: 40.3439, lon: 26.6836 },
  Lindus: { lat: 36.0914, lon: 28.0881 },
  Maroneia: { lat: 40.9, lon: 25.5167 },
  Megara: { lat: 37.9944, lon: 23.3385 },
  Metapontum: { lat: 40.4161, lon: 16.8168 },
  Miletus: { lat: 37.5311, lon: 27.2756 },
  Mitylene: { lat: 39.1114, lon: 26.5621 },
  Peloponnesus: { lat: 37.4, lon: 22.3 },
  Phalerum: { lat: 37.9333, lon: 23.7 },
  Phlius: { lat: 37.8455, lon: 22.6463 },
  Pisa: { lat: 37.644, lon: 21.654 },
  Pitane: { lat: 38.9333, lon: 26.9333 },
  Priene: { lat: 37.6597, lon: 27.2978 },
  Salamis: { lat: 37.9381, lon: 23.4853 },
  Samos: { lat: 37.6908, lon: 26.9383 },
  Scillus: { lat: 37.6, lon: 21.6833 },
  Scythia: { lat: 44.9428, lon: 34.1206 },
  Sicily: { lat: 37.6, lon: 14.0167 },
  Sinope: { lat: 42.025, lon: 35.143 },
  Soli: { lat: 36.7419, lon: 34.54 },
  Stagira: { lat: 40.5908, lon: 23.7942 },
  Syracuse: { lat: 37.0833, lon: 15.2833 },
  Syros: { lat: 37.45, lon: 24.9 },
  Tarentum: { lat: 40.476, lon: 17.228 },
  Tarsus: { lat: 36.9167, lon: 34.9 },
  Teos: { lat: 38.1772, lon: 26.785 },
  Thebes: { lat: 38.3239, lon: 23.3172 },
  Troas: { lat: 39.9266, lon: 26.499 },
};
