/**
 * The live deployment's canonical origin. The site moved from the
 * path-based https://humanisticadigitalia.eu/Laertius to the subdomain
 * root (frontend built with BASE_PATH=/), so every artifact that bakes
 * an absolute live URL (robots.txt's Sitemap line, the post-upload
 * banner) must agree on this one value. A future domain move updates it
 * here and the smoke test fails loudly until robots.txt follows.
 */
export const LAERTIUS_LIVE_ORIGIN = "https://laertius.humanisticadigitalia.eu";

/** Exact Sitemap URL robots.txt must advertise. */
export const LAERTIUS_SITEMAP_URL = `${LAERTIUS_LIVE_ORIGIN}/sitemap.xml`;

/**
 * DECISION (2026-08-02, reaffirmed 2026-08-05): the RDF/LOD entity
 * identifiers deliberately did NOT move with the site. Linked-data URIs
 * are meant to be STABLE identifiers — consumers may already hold Turtle/
 * JSON-LD/RDF-XML exports minted under the original base, and renaming
 * every identifier would silently disconnect their data from future
 * exports. So while pages, sitemap, robots.txt, canonical and Schema.org
 * metadata all live on LAERTIUS_LIVE_ORIGIN, the RDF exports keep minting
 * under the legacy path-based base below (the default of LOD_BASE in
 * artifacts/api-server/src/lib/lod.ts — the two strings must stay equal,
 * enforced by the IONOS bundle smoke test).
 *
 * The contract this buys consumers: legacy identifiers must keep
 * DEREFERENCING on the live host (200 directly, or a redirect chain
 * ending in 200 — e.g. an IONOS rule forwarding /Laertius/* to the
 * subdomain). check-live-ionos probes one representative URI per entity
 * KIND actually minted in the LOD graph (philosopher, work, place,
 * school, …) for exactly that whenever the live site is checked.
 *
 * If the identifiers are ever consciously migrated instead: change this
 * constant AND lod.ts's LOD_BASE default together, re-export every RDF
 * artifact, and publish owl:sameAs bridges from the old URIs.
 */
export const LAERTIUS_LOD_BASE = "https://humanisticadigitalia.eu/Laertius";
