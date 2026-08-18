import { usePageTitle } from "@/lib/use-page-title";
import { grcSpans } from "@/lib/grc";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  useListCompetencyQuestions,
  useGetCompetencyQuestion,
  useListAnnotatedEntities,
  useListEntitySections,
  getListAnnotatedEntitiesQueryKey,
  getListEntitySectionsQueryKey,
  type KgNode,
  type KgEdge,
  type KgMovement,
} from "@workspace/api-client-react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import { Search, X, Loader2, Copy, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { MOVEMENT_COLORS } from "../components/movement-colors";
import { SparqlPlayground } from "../components/sparql-playground";
import { resolveCompetencyFocus } from "@/lib/competency-focus";

const CATEGORY_ORDER = [
  "Schools & Membership",
  "Biography",
  "People & Places",
  "Works & Survival",
  "Doctrines & Topics",
  "Homonymy & Identity",
];

const TYPE_LABEL: Record<string, string> = {
  philosopher: "Philosophers",
  sage: "Sages",
  school: "Schools",
  place: "Places",
  work: "Works",
  person: "Persons",
  doctrine: "Doctrines",
};

const TYPE_ORDER = ["philosopher", "sage", "school", "place", "work", "person", "doctrine"];

// Why some person chips carry no passage link (deliberate, not broken).
// The unlinkable labels are documented and pinned server-side in
// scripts/src/validate-competency-person-chip-sweep.ts (KNOWN_UNLINKED);
// the two special cases below are NOT ambiguous-bearer cases, so they
// get their own honest wording. Everything else without a firstId is a
// bare homonym-bearer authority: several bearers share the name, so no
// single passage can be linked without guessing.
const UNLINKED_PERSON_NOTES: Record<string, string> = {
  "Diogenes Laertius":
    "The author never names himself in the Lives, so no passage can be linked. Opens an Index search instead.",
  "Demetrius the epic poet":
    "Named only descriptively inside the homonym list (5.83\u201385), never by this bare name, so no passage can be linked. Opens an Index search instead.",
};
const UNLINKED_PERSON_GENERIC =
  "Several bearers share this name \u2014 no single passage can be linked safely. Opens an Index search instead.";

function unlinkedPersonNote(label: string): string {
  return UNLINKED_PERSON_NOTES[label] ?? UNLINKED_PERSON_GENERIC;
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  node: KgNode;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  edge: KgEdge;
}

const SUB_W = 620;
const SUB_H = 380;

function SubgraphViz({
  nodes,
  edges,
  movements,
  focused,
  onNodeClick,
}: {
  nodes: KgNode[];
  edges: KgEdge[];
  movements: KgMovement[];
  focused: string | null;
  onNodeClick: (name: string) => void;
}) {
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }> | null>(null);
  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null);

  useEffect(() => {
    if (!nodes.length) return;
    const simNodes: SimNode[] = nodes.map((n) => ({ id: n.name, node: n }));
    const nameSet = new Set(nodes.map((n) => n.name));
    const simLinks: SimLink[] = edges
      .filter((e) => nameSet.has(e.from) && nameSet.has(e.to))
      .map((e) => ({ source: e.from, target: e.to, edge: e }));

    const sim = forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance(80).strength(0.6),
      )
      .force("charge", forceManyBody().strength(-180))
      .force("center", forceCenter(SUB_W / 2, SUB_H / 2))
      .force("x", forceX(SUB_W / 2).strength(0.08))
      .force("y", forceY(SUB_H / 2).strength(0.1))
      .force("collide", forceCollide(34))
      .stop();

    sim.tick(280);

    setPositions(
      new Map(
        simNodes.map((n) => [
          n.id,
          {
            x: Math.max(32, Math.min(SUB_W - 32, n.x ?? SUB_W / 2)),
            y: Math.max(24, Math.min(SUB_H - 24, n.y ?? SUB_H / 2)),
          },
        ]),
      ),
    );
    simRef.current = sim;
    return () => { sim.stop(); };
  }, [nodes, edges]);

  if (!positions) {
    return <div className="h-[380px] bg-muted/40 rounded-lg animate-pulse" />;
  }

  const usedMovements = movements.filter((m) =>
    nodes.some((n) => n.movement === m.id),
  );

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <svg
        viewBox={`0 0 ${SUB_W} ${SUB_H}`}
        className="w-full h-auto select-none"
        aria-label="Knowledge subgraph"
      >
        <defs>
          <marker
            id="sub-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L8,4 L0,8 z" fill="currentColor" opacity="0.35" />
          </marker>
        </defs>

        {edges.map((e, i) => {
          const a = positions.get(e.from);
          const b = positions.get(e.to);
          if (!a || !b) return null;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="currentColor"
              strokeWidth={e.type === "teacherOf" ? 1.4 : 1}
              strokeDasharray={
                e.type === "influenced"
                  ? "4 3"
                  : e.type === "spouseOf"
                    ? "1.5 2.5"
                    : undefined
              }
              opacity={0.35}
              markerEnd={e.type !== "spouseOf" ? "url(#sub-arrow)" : undefined}
            />
          );
        })}

        {nodes.map((n) => {
          const p = positions.get(n.name);
          if (!p) return null;
          const color = MOVEMENT_COLORS[n.movement] ?? "#71717a";
          const r = 5 + Math.min(8, Math.sqrt(n.sectionCount));
          const isFocused = focused === n.name;
          return (
            <g
              key={n.name}
              transform={`translate(${p.x},${p.y})`}
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label={`Show source passages for ${n.name}`}
              onClick={() => onNodeClick(n.name)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onNodeClick(n.name);
                }
              }}
            >
              <title>
                {`${n.name} - ${n.movementLabel}, ${n.sectionCount} section${n.sectionCount === 1 ? "" : "s"}. Click to view source passages.`}
              </title>
              {isFocused && (
                <circle
                  r={r + 4}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  opacity={0.55}
                />
              )}
              <circle
                r={r}
                fill={color}
                stroke="white"
                strokeWidth={1.2}
              />
              <text
                y={-r - 4}
                textAnchor="middle"
                className="fill-foreground"
                fontSize={10}
                fontWeight={isFocused ? 600 : 400}
              >
                {n.name}
              </text>
            </g>
          );
        })}
      </svg>

      {usedMovements.length > 0 && (
        <div className="border-t border-border px-4 py-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
          {usedMovements.map((m) => (
            <span key={m.id} className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: MOVEMENT_COLORS[m.id] ?? "#71717a" }}
              />
              {m.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5 ml-auto">
            <span className="inline-block w-4 border-t border-foreground/50" /> teacher
            <span className="inline-block w-4 border-t border-dashed border-foreground/50 ml-1" /> influence
            <span className="inline-block w-4 border-t border-dotted border-foreground/50 ml-1" /> marriage
          </span>
        </div>
      )}
    </div>
  );
}

function FocusedEntityPanel({
  name,
  onClose,
}: {
  name: string;
  onClose: () => void;
}) {
  const { data: entities } = useListAnnotatedEntities({
    query: { queryKey: getListAnnotatedEntitiesQueryKey() },
  });

  // Resolve the KG node name to its tagged-entity URI (philosopher kind first,
  // then any label match) so we can reuse the annotations/sections endpoint
  const entity = useMemo(() => {
    if (!entities) return undefined;
    return (
      entities.find((e) => e.label === name && e.kind === "philosopher") ??
      entities.find((e) => e.label === name)
    );
  }, [entities, name]);

  const sectionParams = { entity: entity?.entityUri ?? "" };
  const { data: detail, isLoading } = useListEntitySections(sectionParams, {
    query: {
      queryKey: getListEntitySectionsQueryKey(sectionParams),
      enabled: !!entity,
    },
  });

  return (
    <div className="bg-card border border-primary/30 rounded-lg p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Passages naming {name}
          </h3>
          {detail && (
            <span className="text-[11px] text-muted-foreground">
              {detail.sections.length} passage{detail.sections.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={`/graph?p=${encodeURIComponent(name)}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            View in graph
          </Link>
          {entity && (
            <Link
              href={`/entities?entity=${encodeURIComponent(entity.entityUri)}`}
              className="text-xs font-medium text-primary hover:underline"
            >
              Open in Index
            </Link>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close passage panel"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {entities && !entity ? (
        <p className="text-sm text-muted-foreground">
          No tagged passages found for {name}.
        </p>
      ) : isLoading || !detail ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : detail.sections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No tagged passages found for {name}.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
          {detail.sections.map((s) => (
            <Link
              key={s.id}
              href={`/section/${s.id}`}
              className="flex items-baseline justify-between gap-2 border border-border/60 rounded-lg px-3 py-2 hover:border-primary/40 hover:bg-muted/30 transition-colors"
            >
              <span className="min-w-0">
                <span className="block text-xs font-mono text-primary">
                  {s.id}
                </span>
                <span className="block text-xs text-muted-foreground truncate">
                  Life of {s.philosopher}
                </span>
                {s.snippet && (
                  <span className="block text-[11px] leading-snug text-muted-foreground/90 mt-1 line-clamp-2">
                    {s.snippetStart !== undefined &&
                    s.snippetEnd !== undefined ? (
                      <>
                        {grcSpans(s.snippet.slice(0, s.snippetStart))}
                        <mark className="bg-primary/15 text-foreground rounded-sm px-0.5">
                          {grcSpans(s.snippet.slice(s.snippetStart, s.snippetEnd))}
                        </mark>
                        {grcSpans(s.snippet.slice(s.snippetEnd))}
                      </>
                    ) : (
                      grcSpans(s.snippet)
                    )}
                  </span>
                )}
              </span>
              {s.occurrences > 1 && (
                <span className="text-[10px] text-muted-foreground shrink-0">
                  ×{s.occurrences}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CompetencyPage() {
  const [, navigate] = useLocation();
  const search = useSearch();

  const { activeId, focusedEntity, urlFilter } = useMemo(() => {
    const params = new URLSearchParams(search);
    const q = params.get("q") ?? null;
    return {
      activeId: q,
      // The drill-down panel only makes sense with an active question
      focusedEntity: q ? (params.get("focus") ?? null) : null,
      // The sidebar filter is shareable too: a reader who filters, selects
      // a question, and copies the link should hand over the same view.
      urlFilter: params.get("f") ?? "",
    };
  }, [search]);

  // The input is controlled by local state (seeded from ?f= so a shared
  // link cold-loads with the filter applied) and mirrored back to the URL
  // on every change so copying the address bar always captures it.
  const [filter, setFilter] = useState(urlFilter);

  // Keep the box in sync when the URL changes underneath us (back/forward
  // navigation). No-op while typing, since typing updates the URL itself.
  useEffect(() => {
    setFilter(urlFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFilter]);

  // Single builder so every in-page navigation preserves the full shareable
  // state (q, focus, f) — a selection must not silently drop the filter.
  const buildUrl = (opts: {
    q?: string | null;
    focus?: string | null;
    f?: string;
  }) => {
    const params = new URLSearchParams();
    if (opts.q) params.set("q", opts.q);
    if (opts.focus) params.set("focus", opts.focus);
    if (opts.f && opts.f.trim()) params.set("f", opts.f);
    const qs = params.toString();
    return qs ? `/competency?${qs}` : "/competency";
  };

  const handleFilterChange = (value: string) => {
    setFilter(value);
    // replace, not push: each keystroke must not add a history entry
    navigate(
      buildUrl({ q: activeId, focus: focusedEntity, f: value }),
      { replace: true },
    );
  };

  // The notice's explicit "Clear filter" is a discrete action (unlike
  // keystrokes), so it PUSHES a history entry: pressing Back afterwards
  // restores ?f= — and the effect above re-syncs the box — bringing the
  // filtered sidebar and the hidden-question notice back. Pinned by
  // e2e-competency-badges.
  const handleClearFilter = () => {
    setFilter("");
    navigate(buildUrl({ q: activeId, focus: focusedEntity, f: "" }));
  };

  // Update the URL so the drill-down selection is shareable and survives reloads
  const setFocusedEntity = (name: string | null) => {
    if (!activeId) return;
    navigate(buildUrl({ q: activeId, focus: name, f: filter }));
  };

  usePageTitle(activeId ? `Competency: ${activeId}` : "Competency Questions");

  const {
    data: catalogue,
    isLoading: catalogueLoading,
    isError: catalogueError,
  } = useListCompetencyQuestions();
  const {
    data: result,
    isLoading: resultLoading,
    isError: resultError,
  } = useGetCompetencyQuestion(
    activeId ?? "",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: !!activeId, staleTime: 30 * 60 * 1000 } as any },
  );

  const questions = catalogue?.questions ?? [];

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return questions;
    return questions.filter(
      (q) =>
        q.question.toLowerCase().includes(f) ||
        q.category.toLowerCase().includes(f) ||
        (q.greekTerm?.toLowerCase().includes(f) ?? false),
    );
  }, [questions, filter]);

  // Decided behavior for a shared link where ?f= hides ?q= (a reader can
  // select a question, then type a filter that excludes it, and copy the
  // URL): the results panel KEEPS showing the chosen question — a shared
  // link must never silently lose its payload — and the sidebar stays
  // filtered exactly as shared. The mismatch is surfaced explicitly with
  // a notice under the filter box offering to clear the filter, so a
  // cold-loading reader understands why the shown question is not in the
  // list. Pinned by e2e-competency-badges.
  const activeHiddenByFilter =
    !!activeId &&
    questions.some((q) => q.id === activeId) &&
    !filtered.some((q) => q.id === activeId);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const q of filtered) {
      const arr = map.get(q.category) ?? [];
      arr.push(q);
      map.set(q.category, arr);
    }
    return [...map.entries()].filter(([, qs]) => qs.length > 0);
  }, [filtered]);

  const handleSelect = (id: string) => {
    navigate(buildUrl({ q: id, f: filter }));
  };

  const rows = result?.rows ?? [];
  const variables = result?.variables ?? [];
  const nodes = result?.nodes ?? [];
  const edges = result?.edges ?? [];
  const movements = result?.movements ?? [];
  const terms = result?.terms ?? [];
  const passages = result?.passages ?? [];
  const droppedSeeds = result?.droppedSeeds ?? [];
  const sparqlQuery = result?.sparql ?? null;

  const hasRows = rows.length > 0;
  const hasNodes = nodes.length > 0;

  const [sparqlOpen, setSparqlOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Close the SPARQL block when the user switches questions so the embedded
  // playground always opens fresh with the correct query.
  useEffect(() => {
    setSparqlOpen(false);
    setCopied(false);
  }, [activeId]);

  function handleCopySparql() {
    if (!sparqlQuery) return;
    void navigator.clipboard.writeText(sparqlQuery).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  // Group bilingual terms by entity type (type-ordered)
  const termsByType = useMemo(() => {
    const map = new Map<string, typeof terms>(TYPE_ORDER.map((k) => [k, []]));
    for (const t of terms) {
      const arr = map.get(t.type) ?? [];
      arr.push(t);
      map.set(t.type, arr);
    }
    return TYPE_ORDER
      .map((k) => [k, map.get(k) ?? []] as [string, typeof terms])
      .filter(([, ts]) => ts.length > 0);
  }, [terms]);

  const hasTerms = termsByType.length > 0;
  const hasPassages = passages.length > 0;

  // A shared link can carry any focus value; only honor it if the name is
  // actually a node of the loaded subgraph, otherwise show a brief notice.
  // The decision lives in the pure resolveCompetencyFocus predicate so
  // validate-competency-focus can pin it.
  const { validFocusedEntity, staleFocus } = resolveCompetencyFocus({
    focusedEntity,
    nodeNames: nodes.map((n) => n.name),
    resultLoading,
    hasResult: !!result,
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="space-y-2 mb-6">
        <h1 className="text-3xl font-serif font-bold text-foreground">
          Competency Questions
        </h1>
        <p className="text-muted-foreground max-w-3xl">
          Scholarly questions the knowledge graph is designed to answer, drawn
          from the successions and doctrinal reports in Diogenes Laertius.
          Select a question to see the relevant subgraph, entities, and
          source passages.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left panel: question list */}
        <div className="lg:col-span-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              value={filter}
              onChange={(e) => handleFilterChange(e.target.value)}
              placeholder="Filter questions..."
              aria-label="Filter competency questions"
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {activeHiddenByFilter && (
            <div
              data-testid="active-hidden-by-filter"
              className="flex items-start gap-2 border border-border bg-muted/40 rounded-lg px-3 py-2.5 text-xs text-muted-foreground"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                The selected question is hidden by this filter. Its results
                stay open on the right.{" "}
                <button
                  type="button"
                  onClick={handleClearFilter}
                  className="font-medium text-primary hover:underline"
                >
                  Clear filter
                </button>
              </span>
            </div>
          )}

          <div className="space-y-4">
            {catalogueError && (
              <div className="flex items-start gap-2 border border-destructive/40 bg-destructive/5 rounded-lg px-3 py-2.5 text-sm text-foreground">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <span>
                  The question catalogue could not be loaded. The server
                  returned an error.
                </span>
              </div>
            )}
            {catalogueLoading && !catalogueError && (
              <div className="space-y-2" aria-hidden="true">
                <div className="h-9 bg-muted/40 rounded-lg animate-pulse" />
                <div className="h-9 bg-muted/40 rounded-lg animate-pulse" />
                <div className="h-9 bg-muted/40 rounded-lg animate-pulse" />
              </div>
            )}
            {grouped.map(([cat, qs]) => (
              <div key={cat}>
                <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 px-1">
                  {cat}
                </h2>
                <div className="space-y-0.5">
                  {qs.map((q) => {
                    const active = q.id === activeId;
                    return (
                      <button
                        key={q.id}
                        onClick={() => handleSelect(q.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-secondary/60 text-foreground"
                        }`}
                      >
                        <span className="flex-1 leading-snug">
                          {q.question}
                          {q.greekTerm && (
                            <span
                              lang="grc"
                              className={`ml-1.5 font-serif text-xs ${
                                active ? "text-primary-foreground/70" : "text-muted-foreground"
                              }`}
                            >
                              ({q.greekTerm})
                            </span>
                          )}
                          <span
                            className={`ml-1.5 inline-block align-middle px-1.5 py-0.5 rounded text-[10px] font-medium tabular-nums ${
                              active
                                ? "bg-primary-foreground/20 text-primary-foreground"
                                : q.rowCount === 0
                                  ? "bg-muted text-muted-foreground/60 border border-dashed border-border"
                                  : "bg-secondary text-muted-foreground"
                            }`}
                            title={`${q.rowCount} result row${q.rowCount === 1 ? "" : "s"}`}
                          >
                            {q.rowCount}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {grouped.length === 0 && !catalogueLoading && !catalogueError && (
              <p className="text-sm text-muted-foreground px-1">No questions match.</p>
            )}
          </div>
        </div>

        {/* Right panel: results */}
        <div className="lg:col-span-8 space-y-5">
          {!activeId ? (
            <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground space-y-3 bg-muted/30 rounded-xl border border-dashed border-border">
              <p className="text-sm">Select a question on the left to explore the knowledge graph.</p>
            </div>
          ) : resultLoading ? (
            <div className="space-y-4">
              <div className="h-[380px] bg-muted/40 rounded-xl animate-pulse" />
              <div className="h-20 bg-muted/30 rounded-xl animate-pulse" />
              <div className="h-16 bg-muted/30 rounded-xl animate-pulse" />
            </div>
          ) : resultError ? (
            <div className="flex items-start gap-3 px-4 py-3 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-900 rounded-lg text-sm text-red-700 dark:text-red-400">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                This question could not be answered. The server returned an error.
              </span>
            </div>
          ) : (
            <>
              {/* Active question header */}
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {result?.category}
                </p>
                <h2 className="text-xl font-serif font-semibold text-foreground">
                  {result?.question}
                  {result?.greekTerm && (
                    <span className="ml-2 text-base text-muted-foreground font-normal font-serif">
                      (<span lang="grc">{result.greekTerm}</span>)
                    </span>
                  )}
                </h2>
              </div>

              {/* SPARQL query block */}
              {sparqlQuery && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setSparqlOpen((o) => !o)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/70 text-left transition-colors"
                  >
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      SPARQL query
                    </span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="text-[10px] hidden sm:inline">
                        endpoint: <code className="font-mono">/api/lod/sparql</code>
                      </span>
                      {sparqlOpen ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </button>
                  {sparqlOpen && (
                    <div className="px-4 pt-3 pb-4 space-y-3 bg-card">
                      <div className="relative">
                        <pre className="text-[11px] font-mono leading-relaxed bg-muted/40 border border-border rounded-md p-3 overflow-x-auto max-h-72 overflow-y-auto whitespace-pre pr-10">
                          <code>{sparqlQuery}</code>
                        </pre>
                        <button
                          type="button"
                          onClick={handleCopySparql}
                          title="Copy query"
                          aria-label="Copy SPARQL query"
                          className="absolute top-2 right-2 p-1.5 rounded-md bg-background border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        {copied && (
                          <span className="absolute top-2 right-9 text-[10px] text-primary bg-background border border-border rounded px-1.5 py-0.5">
                            Copied
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Public read-only endpoint:{" "}
                        <code className="font-mono">/api/lod/sparql</code>
                        {" "}(GET with <code className="font-mono">?query=</code> or POST as{" "}
                        <code className="font-mono">application/sparql-query</code>)
                      </p>
                      <SparqlPlayground initialQuery={sparqlQuery} />
                    </div>
                  )}
                </div>
              )}

              {/* Zone A: subgraph */}
              {hasNodes ? (
                <SubgraphViz
                  nodes={nodes}
                  edges={edges}
                  movements={movements}
                  focused={validFocusedEntity}
                  onNodeClick={(name) =>
                    setFocusedEntity(validFocusedEntity === name ? null : name)
                  }
                />
              ) : (
                <div className="h-32 flex items-center justify-center bg-muted/20 rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                  No philosopher nodes in this subgraph.
                </div>
              )}

              {/* Reviewed curation note: anchors deliberately absent from the
                  subgraph because they have no Life chapter (and thus no
                  knowledge-graph node). Without this the reader just sees
                  fewer anchors than curated, looking like an omission. */}
              {droppedSeeds.length > 0 && (
                <p className="px-4 py-2.5 bg-muted/30 border border-dashed border-border rounded-lg text-sm text-muted-foreground">
                  Also discussed, but without a Life of their own (so not shown
                  in the subgraph):{" "}
                  {droppedSeeds.map((d, i) => (
                    <span key={d.en} className="text-foreground">
                      {i > 0 && <span className="text-muted-foreground">, </span>}
                      {d.en}
                      {d.grc && (
                        <span className="ml-1 font-serif text-muted-foreground">
                          ({d.grc})
                        </span>
                      )}
                    </span>
                  ))}
                </p>
              )}

              {/* Zone A2: drill-down passages for the clicked node */}
              {staleFocus && (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-muted/30 border border-dashed border-border rounded-lg text-sm text-muted-foreground">
                  <span>
                    "{focusedEntity}" is not in this question's subgraph, so no
                    panel was opened.
                  </span>
                  <button
                    onClick={() => setFocusedEntity(null)}
                    className="text-xs shrink-0 underline underline-offset-2 hover:text-foreground"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              {validFocusedEntity && (
                <FocusedEntityPanel
                  name={validFocusedEntity}
                  onClose={() => setFocusedEntity(null)}
                />
              )}

              {/* Zone B: SPARQL answer rows */}
              {result && variables.length > 0 && (
                <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Query Results
                    </h3>
                    <span className="text-[11px] text-muted-foreground">
                      {rows.length} {rows.length === 1 ? "row" : "rows"}
                    </span>
                  </div>
                  {hasRows ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            {variables.map((v) => (
                              <th
                                key={v}
                                className="text-left py-1.5 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                              >
                                {v}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, i) => (
                            <tr key={i} className="border-b border-border/50 last:border-0">
                              {row.map((cell, j) => (
                                <td key={j} className="py-1.5 pr-4 text-foreground">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      This query returned no results.
                    </p>
                  )}
                </div>
              )}

              {/* Zone C: bilingual terms panel grouped by entity type */}
              {hasTerms && (
                <div className="bg-card border border-border rounded-lg p-4 space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Entities
                  </h3>
                  <div className="space-y-4">
                    {termsByType.map(([type, ts]) => {
                      // Homonym rosters: when several persons share a Greek
                      // form, group them under that form (shown once) instead
                      // of repeating it after every chip.
                      const grcGroups =
                        type === "person"
                          ? (() => {
                              const byGrc = new Map<string, typeof ts>();
                              for (const t of ts) {
                                if (!t.grc) continue;
                                const arr = byGrc.get(t.grc) ?? [];
                                arr.push(t);
                                byGrc.set(t.grc, arr);
                              }
                              const shared = [...byGrc.entries()].filter(
                                ([, arr]) => arr.length > 1,
                              );
                              return shared.length > 0
                                ? shared.sort((a, b) => a[0].localeCompare(b[0], "el"))
                                : null;
                            })()
                          : null;
                      const groupedSet = grcGroups
                        ? new Set(grcGroups.flatMap(([, arr]) => arr))
                        : null;
                      const ungrouped = groupedSet
                        ? ts.filter((t) => !groupedSet.has(t))
                        : ts;
                      const renderChip = (t: (typeof ts)[number], hideGrc: boolean) => (
                        <div key={t.en} className="inline-flex flex-col">
                          {type === "school" ? (
                            <span className="text-xs font-medium text-foreground uppercase tracking-wider">
                              <span>{t.en}</span>
                              {t.grc && (
                                <span lang="grc" className="ml-1.5 font-serif text-muted-foreground">
                                  {t.grc}
                                </span>
                              )}
                            </span>
                          ) : type === "person" && !t.firstId ? (
                            // Deliberately unlinked person chip: no single
                            // passage can name THIS bearer safely (see
                            // unlinkedPersonNote). Explain on hover/tap and
                            // offer the Index search for the name instead of
                            // a dead graph link.
                            <div className="flex items-baseline gap-1">
                              <Link
                                href={`/search?q=${encodeURIComponent(t.en)}`}
                                title={unlinkedPersonNote(t.en)}
                                aria-label={`${t.en} \u2014 ${unlinkedPersonNote(t.en)}`}
                                className="text-xs px-2.5 py-1 rounded-full border border-dashed border-border bg-transparent text-muted-foreground hover:bg-secondary/60 hover:text-secondary-foreground transition-colors"
                              >
                                {t.en}
                              </Link>
                              <span
                                aria-hidden="true"
                                title={unlinkedPersonNote(t.en)}
                                className="text-[10px] text-muted-foreground align-super cursor-help"
                              >
                                ?
                              </span>
                              {t.grc && !hideGrc && (
                                <span lang="grc" className="text-xs font-serif text-muted-foreground">
                                  {t.grc}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-baseline gap-1">
                              <Link
                                href={
                                  t.firstId
                                    ? `/section/${t.firstId}`
                                    : `/graph?p=${encodeURIComponent(t.en)}`
                                }
                                className="text-xs font-medium text-foreground uppercase tracking-wider hover:bg-secondary/80 transition-colors"
                              >
                                {t.en}
                              </Link>
                              {t.grc && !hideGrc && (
                                <span lang="grc" className="text-xs font-serif text-muted-foreground">
                                  {t.grc}
                                </span>
                              )}
                              {t.firstId && (
                                <Link
                                  href={`/graph?p=${encodeURIComponent(t.en)}`}
                                  className="text-[10px] text-muted-foreground hover:text-primary transition-colors ml-0.5"
                                  title="View in graph"
                                >
                                  &#8599;
                                </Link>
                              )}
                            </div>
                          )}
                        </div>
                      );
                      return (
                        <div key={type}>
                          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                            {TYPE_LABEL[type] ?? type}
                          </h4>
                          {grcGroups ? (
                            <div className="space-y-2.5">
                              {grcGroups.map(([grc, group]) => (
                                <div
                                  key={grc}
                                  className="border border-border/60 rounded-lg px-3 py-2"
                                >
                                  <div className="flex items-baseline gap-2 mb-1.5">
                                    <span className="text-sm font-serif text-foreground">
                                      {grc}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {group.length} bearers
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {group.map((t) => renderChip(t, true))}
                                  </div>
                                </div>
                              ))}
                              {ungrouped.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-0.5">
                                  {ungrouped.map((t) => renderChip(t, false))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {ts.map((t) => renderChip(t, false))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Zone D: bilingual passage snippets */}
              {hasPassages && (
                <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Source Passages
                  </h3>
                  <div className="space-y-3">
                    {passages.map((p) => (
                      <div
                        key={p.id}
                        className="border border-border/60 rounded-lg overflow-hidden"
                      >
                        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border/60">
                          <Link
                            href={`/section/${p.id}`}
                            className="text-xs font-mono text-primary hover:underline"
                          >
                            {p.id}
                          </Link>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
                          {p.en && (
                            <p className="px-3 py-2 text-xs text-foreground leading-relaxed">
                              {p.en}
                            </p>
                          )}
                          {p.grc && (
                            <p lang="grc" className="px-3 py-2 text-xs font-serif text-muted-foreground leading-relaxed">
                              {p.grc}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
