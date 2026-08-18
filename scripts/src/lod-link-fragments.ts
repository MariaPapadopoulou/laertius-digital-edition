/**
 * The single source of truth for the LOD download link href fragments the
 * frontend must render. Two checks consume this list so they cannot drift:
 *
 * 1. validate-lod-links.ts — fast source-level check: each fragment must
 *    appear literally in its owning source file under
 *    artifacts/laertius/src (pages and components). Catches a dropped link
 *    seconds after an edit, no build required.
 * 2. smoke-ionos-bundle.ts (checkFrontendLodLinks) — final safety net: each
 *    fragment must survive minification in the built bundle JS.
 *
 * Fragments are chosen so they stay literal in BOTH the TSX source and the
 * minified bundle (interpolated parts like `${apiBase}` or the section id
 * split the href into literal pieces around them).
 */

export interface LodLinkFragment {
  /** Literal substring that must appear in the page source and the bundle. */
  fragment: string;
  /** Source file (relative to artifacts/laertius/src) that renders it. */
  page: "pages/stats.tsx" | "pages/about.tsx";
}

export const REQUIRED_LOD_LINK_FRAGMENTS: readonly LodLinkFragment[] = [
  // The Statistics page is deliberately the ONLY place in the UI that
  // renders the LOD download panel (graph, annotated graph, ontology,
  // SHACL shapes). The Graph-page row, the per-section downloads, and the
  // KG diagram's graph.ttl link were removed on purpose — do not re-pin
  // them here without re-adding the UI.
  // Stats page downloads: its hrefs are literal `api/lod/...` paths (no
  // leading slash, BASE_URL prefixed at render time), so these pin the
  // Stats page's download panel specifically.
  { fragment: "api/lod/graph.jsonld?download", page: "pages/stats.tsx" },
  { fragment: "api/lod/graph.ttl?download", page: "pages/stats.tsx" },
  { fragment: "api/lod/graph.rdf?download", page: "pages/stats.tsx" },
  { fragment: "api/lod/graph-annotated.jsonld?download", page: "pages/stats.tsx" },
  { fragment: "api/lod/graph-annotated.ttl?download", page: "pages/stats.tsx" },
  { fragment: "api/lod/graph-annotated.rdf?download", page: "pages/stats.tsx" },
  { fragment: "api/lod/ontology.jsonld?download", page: "pages/stats.tsx" },
  { fragment: "api/lod/ontology.ttl?download", page: "pages/stats.tsx" },
  { fragment: "api/lod/ontology.rdf?download", page: "pages/stats.tsx" },
  { fragment: "api/lod/shapes.ttl?download", page: "pages/stats.tsx" },
  // About page: the dataset calling card links the VoID description via
  // `${import.meta.env.BASE_URL}api/lod/void.ttl`, so everything after the
  // interpolation is literal.
  { fragment: "api/lod/void.ttl", page: "pages/about.tsx" },
];
