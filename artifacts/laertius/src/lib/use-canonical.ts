import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Canonical URL of the live edition. Canonical links always point at the
 * production deployment (never the dev host), so search engines index a
 * single URL per page regardless of where a copy is served from.
 */
export const CANONICAL_BASE = "https://laertius.humanisticadigitalia.eu";

/**
 * Keeps the <link rel="canonical"> in the document head (declared in
 * index.html) in sync with the current wouter route. The homepage is
 * canonicalized with a trailing slash; every other route without one.
 * Query strings are deliberately dropped: they hold view state (filters,
 * shared-link params), not distinct documents.
 */
export function useCanonical() {
  // wouter's useLocation strips the query string, which is exactly what
  // canonical URLs want here.
  const [location] = useLocation();
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!link) return;
    link.href =
      location === "/" ? `${CANONICAL_BASE}/` : `${CANONICAL_BASE}${location}`;
  }, [location]);
}
