// Shared sample-route list for the site audit sweeps (task 818).
// One canonical list of sample paths covering every registered route in
// artifacts/laertius/src/App.tsx, imported by:
//   - e2e-mobile-audit.mts
//   - e2e-full-audit.mts
//   - e2e-a11y-audit.mts
// validate-audit-route-coverage.mts imports this list directly (no source
// regex parsing) and verifies it against the app router, so adding a page
// to the router without adding a sample here fails the coverage check once.
export const SAMPLE_ROUTES: readonly string[] = [
  "/", "/ask", "/search", "/browse", "/verses", "/sayings", "/doxography",
  "/anecdotes", "/letters", "/testaments", "/graph", "/competency",
  "/map", "/timeline", "/entities", "/stats", "/about",
  "/approach", "/accessibility", "/privacy",
  "/section/1.prol.1",
  "/terminology", "/terminology/concepts", "/terminology/objects",
  // /terminology/model and /ontology are redirects to /terminology
  // (old "About the Model" page and ontology-IRI dereferencing).
  "/terminology/objects/diogenesLaertius", "/terminology/names", "/terminology/model",
  "/ontology",
  "/passage/1.prol.1",
  "/legomena", "/legomena/graph", "/legomena/entities",
  "/legomena/entity?uri=" + encodeURIComponent("https://humanisticadigitalia.eu/Laertius/philosopher/plato"),
  "/legomena/reader", "/legomena/reader/1.prol.1", "/legomena/sparql",
];

// Deliberate 404 probe: legitimately produces one failed document request,
// so audits either check it separately (mobile) or tolerate it (full sweep).
export const NOT_FOUND_ROUTE = "/no-such-page-404-check";
