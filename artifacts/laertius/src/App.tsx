import { lazy, Suspense, useEffect, useRef } from "react";
import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getHealthCheckQueryKey } from "@workspace/api-client-react/legomena";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { useCanonical } from "@/lib/use-canonical";
import Home from "@/pages/home";
import NotFound from "@/pages/not-found";

// Route-based code splitting: every page except Home (the default entry
// route) and NotFound (tiny, and the fallback for any unmatched URL) is a
// lazy chunk so first visits only download the visited page's code.
const AskPage = lazy(() => import("@/pages/ask"));
const SearchPage = lazy(() => import("@/pages/search"));
const BrowsePage = lazy(() => import("@/pages/browse"));
const VersesPage = lazy(() => import("@/pages/verses"));
const SayingsPage = lazy(() => import("@/pages/sayings"));
const DoxographyPage = lazy(() => import("@/pages/doxography"));
const AnecdotesPage = lazy(() => import("@/pages/anecdotes"));
const EpistlesPage = lazy(() => import("@/pages/epistles"));
const TestamentsPage = lazy(() => import("@/pages/testaments"));
const GraphPage = lazy(() => import("@/pages/graph"));
const CompetencyPage = lazy(() => import("@/pages/competency"));
const MapPage = lazy(() => import("@/pages/map"));
const TimelinePage = lazy(() => import("@/pages/timeline"));
const EntitiesPage = lazy(() => import("@/pages/entities"));
const StatsPage = lazy(() => import("@/pages/stats"));
const AboutPage = lazy(() => import("@/pages/about"));
const ApproachPage = lazy(() => import("@/pages/approach"));
const AccessibilityPage = lazy(() => import("@/pages/accessibility"));
const PrivacyPage = lazy(() => import("@/pages/privacy"));
const SectionPage = lazy(() => import("@/pages/section"));
const TerminologyConcepts = lazy(() => import("@/pages/terminology/concepts"));
const TerminologyObjects = lazy(() => import("@/pages/terminology/objects"));
const TerminologyObjectDetail = lazy(() => import("@/pages/terminology/object-detail"));
const TerminologyNames = lazy(() => import("@/pages/terminology/names"));
const TerminologyModel = lazy(() => import("@/pages/terminology/model"));
const LegomenaAsk = lazy(() => import("@/pages/legomena/ask"));
const LegomenaGraph = lazy(() => import("@/pages/legomena/graph"));
const LegomenaEntities = lazy(() => import("@/pages/legomena/entities"));
const LegomenaEntityDetail = lazy(() => import("@/pages/legomena/entity"));
const LegomenaReader = lazy(() => import("@/pages/legomena/reader"));
const LegomenaPassageDetail = lazy(() => import("@/pages/legomena/passage"));
const LegomenaSparql = lazy(() => import("@/pages/legomena/sparql"));

// Kept intentionally minimal (no spinner, no text assertions): existing e2e
// gates assert on page content, and a quiet fallback avoids flashing chrome
// during the brief chunk fetch.
function RouteFallback() {
  return <div className="min-h-[50vh]" aria-hidden="true" />;
}

// When any Legomena API request fails, re-check store health immediately so
// the "Assertion store" pill flips to Unavailable right away instead of
// waiting for its slow 60s background poll. The health query itself is
// excluded to avoid re-triggering on its own failures (its refetchInterval
// already handles retrying).
const LEGOMENA_HEALTH_KEY = getHealthCheckQueryKey()[0];
const LEGOMENA_QUERY_PREFIX = "/legomena/api/";
// Generated Legomena mutation hooks tag themselves with these mutationKeys
// (see lib/api-client-react/src/generated-legomena/legomena.ts). Mutation
// keys are needed because a network-level failure carries no request URL.
const LEGOMENA_MUTATION_KEYS = new Set(["askOntology", "runSparql"]);

function recheckLegomenaHealth() {
  void queryClient.invalidateQueries({ queryKey: getHealthCheckQueryKey() });
}

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (_error, query) => {
      const key = query.queryKey[0];
      if (typeof key === "string" && key.startsWith(LEGOMENA_QUERY_PREFIX) && key !== LEGOMENA_HEALTH_KEY) {
        recheckLegomenaHealth();
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (_error, _variables, _context, mutation) => {
      const key = mutation.options.mutationKey?.[0];
      if (typeof key === "string" && LEGOMENA_MUTATION_KEYS.has(key)) {
        recheckLegomenaHealth();
      }
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function Router() {
  // The homepage is a self-contained editorial page with its own header
  // and footer, so it renders outside the shared Layout chrome.
  const [location] = useLocation();
  // Keep <link rel="canonical"> pointing at the live URL of this route.
  useCanonical();
  // SPA accessibility: after a client-side route change, move keyboard focus
  // to the main landmark so screen-reader/keyboard users start reading the
  // new page's content instead of remaining on the header link they clicked,
  // and put the viewport at the top of the new page (clicking a footer link
  // otherwise leaves the reader staring at the NEW page's footer).
  // - Lives here (not in Layout) because Home renders outside Layout but has
  //   its own #main-content, and this component never unmounts.
  // - Skipped on the initial render so the first Tab still lands on the skip
  //   link (see e2e-skip-link.mts).
  // - focus({ preventScroll: true }) plus an explicit scrollTo keeps focus
  //   and scroll decisions separate, so scroll hooks stay authoritative:
  //   the scroll-to-top is skipped for back/forward (popstate) navigations,
  //   where use-scroll-memory restores the reader's saved position (its rAF
  //   enforcement loop would also out-pin us, but don't fight it at all).
  const prevLocationRef = useRef(location);
  const popNavigationRef = useRef(false);
  // Monotonic navigation generation: bumped on every navigation (and on
  // popstate) so delayed scroll re-pins can tell they are stale.
  const scrollPinGenerationRef = useRef(0);
  useEffect(() => {
    const onPop = () => {
      popNavigationRef.current = true;
      // A pop navigation immediately invalidates any pending scroll
      // re-pins from the previous navigation, before its effect runs.
      scrollPinGenerationRef.current++;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    if (prevLocationRef.current === location) return;
    prevLocationRef.current = location;
    const wasPop = popNavigationRef.current;
    popNavigationRef.current = false;
    // "instant" opts out of the global `scroll-behavior: smooth`: a route
    // change is a new page, not an in-page jump, so animating the scroll
    // would read as a visible scroll jump across unrelated content.
    if (!wasPop) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      // The new page renders (and loads data) after this scroll, letting
      // browser scroll anchoring nudge the viewport a few pixels off the
      // top. Re-pin to 0 once the re-render paints — but only while the
      // offset is still anchor-sized, so a reader who already scrolled
      // isn't yanked back up.
      // Guard every delayed callback with the navigation generation so a
      // pin scheduled for THIS navigation can never touch the viewport
      // after a later navigation (e.g. a quick Back whose popstate restore
      // lands below 40px).
      const generation = ++scrollPinGenerationRef.current;
      const pin = () => {
        if (scrollPinGenerationRef.current !== generation) return;
        // A hash navigation (e.g. /about#curated-layers) scrolls to its
        // section, possibly smoothly THROUGH the sub-40px zone; never
        // fight it.
        if (window.location.hash) return;
        if (window.scrollY !== 0 && window.scrollY < 40) {
          window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        }
      };
      requestAnimationFrame(() => requestAnimationFrame(pin));
      setTimeout(pin, 150);
      setTimeout(pin, 400);
    } else {
      // A pop navigation invalidates any still-pending re-pins.
      scrollPinGenerationRef.current++;
    }
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [location]);
  if (location === "/") return <Home />;
  return (
    <Layout>
      <Suspense fallback={<RouteFallback />}>
        <Switch>
        <Route path="/ask" component={AskPage} />
        <Route path="/search" component={SearchPage} />
        <Route path="/browse" component={BrowsePage} />
        <Route path="/verses" component={VersesPage} />
        <Route path="/sayings" component={SayingsPage} />
        <Route path="/doxography" component={DoxographyPage} />
        <Route path="/anecdotes" component={AnecdotesPage} />
        <Route path="/letters" component={EpistlesPage} />
        <Route path="/testaments" component={TestamentsPage} />
        <Route path="/graph" component={GraphPage} />
        <Route path="/competency" component={CompetencyPage} />
        <Route path="/map" component={MapPage} />
        <Route path="/timeline" component={TimelinePage} />
        <Route path="/entities" component={EntitiesPage} />
        <Route path="/stats" component={StatsPage} />
        <Route path="/about" component={AboutPage} />
        <Route path="/approach" component={ApproachPage} />
        <Route path="/accessibility" component={AccessibilityPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/section/:id" component={SectionPage} />
        {/* Passage IRIs in the LOD exports (…/passage/1.prol.1) dereference
            to the section reader page. The IRIs are published in the graph,
            so redirect rather than renaming them. */}
        <Route path="/passage/:id">
          {(params) => (
            <Redirect
              to={`/section/${params.id}${window.location.search}${window.location.hash}`}
              replace
            />
          )}
        </Route>
        <Route path="/terminology" component={TerminologyModel} />
        <Route path="/terminology/concepts" component={TerminologyConcepts} />
        <Route path="/terminology/objects" component={TerminologyObjects} />
        <Route path="/terminology/objects/:id" component={TerminologyObjectDetail} />
        <Route path="/terminology/names" component={TerminologyNames} />
        {/* The old "About the Model" page is now the Overview at /terminology.
            Preserve any query string on bookmarked links. */}
        <Route path="/terminology/model">
          {() => <Redirect to={`/terminology${window.location.search}`} replace />}
        </Route>
        {/* Ontology IRIs (…/ontology#Chapter) dereference to the model
            Overview: the old /ontology page is now /terminology. Preserve
            the fragment so a cited class name stays visible in the URL. */}
        <Route path="/ontology">
          {() => (
            <Redirect
              to={`/terminology${window.location.search}${window.location.hash}`}
              replace
            />
          )}
        </Route>
        <Route path="/legomena" component={LegomenaAsk} />
        <Route path="/legomena/graph" component={LegomenaGraph} />
        <Route path="/legomena/entities" component={LegomenaEntities} />
        <Route path="/legomena/entity" component={LegomenaEntityDetail} />
        <Route path="/legomena/reader" component={LegomenaReader} />
        <Route path="/legomena/reader/:sectionId" component={LegomenaPassageDetail} />
        <Route path="/legomena/sparql" component={LegomenaSparql} />
        <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
