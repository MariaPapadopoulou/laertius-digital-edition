import { usePageTitle } from "@/lib/use-page-title";
import { AboutLink } from "@/components/about-link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import {
  useGetKnowledgeGraph,
  KgNode,
  KgEdge,
  KgMovement,
  SchoolAssociate,
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
import { X } from "lucide-react";
import ClaimsPanel from "../components/claims-panel";
import SayingsPanel from "../components/sayings-panel";
import VersesPanel from "../components/verses-panel";
import SuccessionTree from "../components/succession-tree";
import { MOVEMENT_COLORS } from "../components/movement-colors";
import { useResetOnSamePageNav } from "@/hooks/use-reset-on-same-page-nav";
import { SortableTh, sortRows, useTableSort } from "@/components/sortable-table";

const EDGE_LABEL: Record<string, string> = {
  teacherOf: "teacher of",
  influenced: "influenced",
  spouseOf: "spouse of",
};

interface SimNode extends SimulationNodeDatum {
  id: string;
  node?: KgNode;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  edge?: KgEdge;
}

const WIDTH = 1100;
const HEIGHT = 780;

function formatYear(y: number): string {
  return y < 0 ? `${-y} BCE` : `${y} CE`;
}

function formatYearRange(earliest: number, latest: number): string {
  if (earliest === latest) return formatYear(earliest);
  // Same era: share the suffix ("c. 490 - 420 BCE").
  if (earliest < 0 === latest < 0) {
    return `${Math.abs(earliest)} - ${formatYear(latest)}`;
  }
  return `${formatYear(earliest)} - ${formatYear(latest)}`;
}

export default function GraphPage() {
  const { data: graph, isLoading } = useGetKnowledgeGraph();
  const [selected, setSelected] = useState<string | null>(() => {
    const p = new URLSearchParams(window.location.search).get("p");
    return p || null;
  });
  usePageTitle(selected ? `${selected} - Graph` : "Graph");
  const [view, setView] = useState<"network" | "tree" | "list">(() => {
    const v = new URLSearchParams(window.location.search).get("view");
    return v === "tree" ? "tree" : v === "list" ? "list" : "network";
  });
  const [positions, setPositions] = useState<Map<
    string,
    { x: number; y: number }
  > | null>(null);
  // Movement filter driven by the legend chips: empty set = show all.
  const philSort = useTableSort<"name" | "school" | "sections" | "relations">();
  const edgeSort = useTableSort<"from" | "relation" | "to" | "citation">();
  const [movementFilter, setMovementFilter] = useState<Set<string>>(
    () => new Set(),
  );
  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(
    null,
  );

  // Clicking the "Graph" nav link while already here starts fresh: back to
  // the network view with no philosopher selected. (Links carrying ?p= or
  // ?view= have a query string and are not affected.)
  useResetOnSamePageNav(() => {
    setSelected(null);
    setView("network");
    setMovementFilter(new Set());
  });

  // When the search string changes from outside this page's own sync effect
  // (nav link back to /graph, browser back/forward, a link with ?p=), adopt
  // the URL's values so the selection always matches what the URL says.
  const search = useSearch();
  useEffect(() => {
    const params = new URLSearchParams(search);
    const p = params.get("p") || null;
    const rawView = params.get("view");
    const v =
      rawView === "tree" ? "tree" : rawView === "list" ? "list" : "network";
    setSelected((cur) => (cur === p ? cur : p));
    setView((cur) => (cur === v ? cur : v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Keep the URL in sync so the current view and selection can be copied
  // and shared: opening the link restores exactly what the reader sees.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selected) url.searchParams.set("p", selected);
    else url.searchParams.delete("p");
    if (view === "tree") url.searchParams.set("view", "tree");
    else if (view === "list") url.searchParams.set("view", "list");
    else url.searchParams.delete("view");
    if (url.href !== window.location.href) {
      window.history.replaceState(null, "", url);
    }
  }, [selected, view]);

  useEffect(() => {
    if (!graph) return;
    const simNodes: SimNode[] = graph.nodes.map((n) => ({
      id: n.name,
      node: n,
    }));
    const simLinks: SimLink[] = graph.edges.map((e) => ({
      source: e.from,
      target: e.to,
      edge: e,
    }));
    // School members (satellite nodes): join the layout hanging from
    // their cited teacher when the succession names one (so the Sceptic
    // chain of 9.116 renders as a chain), else orbiting the school's
    // founder; guarded against any name collision with a KG node.
    const kgNames = new Set(graph.nodes.map((n) => n.name));
    const assocs = (graph.associates ?? []).filter(
      (a) => !kgNames.has(a.name),
    );
    const drawable = new Set([...kgNames, ...assocs.map((a) => a.name)]);
    for (const a of assocs) {
      simNodes.push({ id: a.name });
      const parent =
        a.teacher && drawable.has(a.teacher) ? a.teacher : a.anchor;
      simLinks.push({ source: parent, target: a.name });
    }
    const sim = forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(70)
          .strength(0.5),
      )
      .force("charge", forceManyBody().strength(-140))
      .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
      .force("x", forceX(WIDTH / 2).strength(0.07))
      .force("y", forceY(HEIGHT / 2).strength(0.1))
      .force("collide", forceCollide(30))
      .stop();
    sim.tick(300);
    setPositions(
      new Map(
        simNodes.map((n) => [
          n.id,
          {
            x: Math.max(30, Math.min(WIDTH - 30, n.x ?? WIDTH / 2)),
            y: Math.max(30, Math.min(HEIGHT - 30, n.y ?? HEIGHT / 2)),
          },
        ]),
      ),
    );
    simRef.current = sim;
    return () => {
      sim.stop();
    };
  }, [graph]);

  const selectedNode = useMemo(
    () => graph?.nodes.find((n) => n.name === selected) ?? null,
    [graph, selected],
  );

  // Cited school members beyond the 82 chapter subjects, drawn as
  // satellite nodes. Names colliding with a KG node are dropped so the
  // simulation and selection stay unambiguous.
  const associates = useMemo(() => {
    if (!graph) return [] as SchoolAssociate[];
    const kgNames = new Set(graph.nodes.map((n) => n.name));
    return (graph.associates ?? []).filter((a) => !kgNames.has(a.name));
  }, [graph]);

  const selectedAssociate = useMemo(
    () => associates.find((a) => a.name === selected) ?? null,
    [associates, selected],
  );

  // Movement of every drawn node (KG nodes and satellite associates),
  // used to dim edges whose endpoints fall outside the legend filter.
  const movementOf = useMemo(() => {
    const map = new Map<string, string>();
    if (graph) for (const n of graph.nodes) map.set(n.name, n.movement);
    for (const a of associates) {
      if (!map.has(a.name)) map.set(a.name, a.movement);
    }
    return map;
  }, [graph, associates]);

  // Count of edges (teacher, influence, marriage) touching each node name,
  // the text equivalent of a node's visible connectedness in the network.
  const connectionCount = useMemo(() => {
    const map = new Map<string, number>();
    if (graph) {
      for (const e of graph.edges) {
        map.set(e.from, (map.get(e.from) ?? 0) + 1);
        map.set(e.to, (map.get(e.to) ?? 0) + 1);
      }
    }
    return map;
  }, [graph]);

  // Philosopher nodes grouped by movement, so the color coding of the
  // network has a full text equivalent (movements in curated order, each
  // with its members sorted by name).
  const nodesByMovement = useMemo(() => {
    if (!graph) return [] as { movement: KgMovement; nodes: KgNode[] }[];
    return graph.movements
      .map((m) => ({
        movement: m,
        nodes: graph.nodes
          .filter((n) => n.movement === m.id)
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter((g) => g.nodes.length > 0);
  }, [graph]);

  const filterActive = movementFilter.size > 0;
  const passesFilter = (name: string) =>
    !filterActive || movementFilter.has(movementOf.get(name) ?? "");

  const toggleMovement = (id: string) => {
    setMovementFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedEdges = useMemo(() => {
    if (!graph || !selected) return [];
    return graph.edges.filter((e) => e.from === selected || e.to === selected);
  }, [graph, selected]);

  const neighborhood = useMemo(() => {
    const set = new Set<string>();
    if (selected) {
      set.add(selected);
      for (const e of selectedEdges) {
        set.add(e.from);
        set.add(e.to);
      }
      for (const a of associates) {
        if (a.anchor === selected || a.teacher === selected) set.add(a.name);
        if (a.name === selected) {
          set.add(a.anchor);
          if (a.teacher) set.add(a.teacher);
        }
      }
    }
    return set;
  }, [selected, selectedEdges, associates]);

  const selectedMovement = useMemo(
    () =>
      graph && selectedNode
        ? (graph.movements.find((m) => m.id === selectedNode.movement) ?? null)
        : null,
    [graph, selectedNode],
  );

  // Movement record for a selected satellite associate, for its Greek
  // school form (the same curated map the legend uses).
  const selectedAssociateMovement = useMemo(
    () =>
      graph && selectedAssociate
        ? (graph.movements.find((m) => m.id === selectedAssociate.movement) ??
          null)
        : null,
    [graph, selectedAssociate],
  );

  const apiBase = `${import.meta.env.BASE_URL}api`;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="space-y-2 mb-6">
        <h1 className="text-3xl font-serif font-bold text-foreground">
          Knowledge Graph of the Successions
        </h1>
        <p className="text-muted-foreground max-w-3xl">
          The successions (<span className="italic">diadochai</span>) of the
          philosophers as reported by Diogenes Laertius: teacher–pupil
          relations, doctrinal influence and marriage. Click a philosopher to
          inspect their relations.
        </p>
        <AboutLink anchor="knowledge-graph" label="About the knowledge graph" />
      </div>

      {isLoading || !graph || !positions ? (
        <div className="h-[70vh] bg-muted rounded-xl animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-9 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
            <div
              className="inline-flex rounded-lg border border-border bg-card p-0.5 text-sm"
              role="group"
              aria-label="Graph view"
            >
              <button
                aria-pressed={view === "network"}
                onClick={() => setView("network")}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  view === "network"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Network
              </button>
              <button
                aria-pressed={view === "tree"}
                onClick={() => setView("tree")}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  view === "tree"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Tree
              </button>
              <button
                data-testid="graph-view-list"
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  view === "list"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                List
              </button>
            </div>
            </div>
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            {view === "tree" ? (
              <SuccessionTree
                nodes={graph.nodes}
                edges={graph.edges}
                selected={selected}
                onSelect={setSelected}
              />
            ) : view === "list" ? (
              <div
                className="p-4 sm:p-5 space-y-8 max-h-[80vh] overflow-y-auto"
                data-testid="graph-list-view"
              >
                <p className="text-sm text-muted-foreground max-w-3xl">
                  A text equivalent of the network. Every philosopher is
                  listed with their school, the length of their Life in
                  sections and the number of relations (teacher, pupil,
                  influence and marriage links) that touch them. The tables
                  are grouped by school, so the color coding of the graph is
                  fully spelled out here. Cited school members who are not
                  among the 82 subjects of the Lives are listed as
                  associates under their school.
                </p>
                {nodesByMovement.map(({ movement, nodes }) => {
                  const sortedNodes = sortRows(nodes, philSort.sort, {
                    name: (n) => n.name,
                    school: (n) => n.movementLabel,
                    sections: (n) => n.sectionCount,
                    relations: (n) => connectionCount.get(n.name) ?? 0,
                  });
                  const schoolAssociates = sortRows(
                    associates
                      .filter((a) => a.movement === movement.id)
                      .sort((a, b) => a.name.localeCompare(b.name)),
                    philSort.sort,
                    {
                      name: (a) => a.name,
                      school: (a) => a.movementLabel,
                      sections: () => undefined,
                      relations: (a) => connectionCount.get(a.name) ?? 0,
                    },
                  );
                  return (
                    <section
                      key={movement.id}
                      className="space-y-4"
                      aria-labelledby={`list-school-${movement.id}`}
                    >
                      <h2
                        id={`list-school-${movement.id}`}
                        className="flex items-center gap-2 text-lg font-serif font-bold text-foreground"
                      >
                        <span
                          className="w-3 h-3 rounded-full inline-block shrink-0"
                          style={{
                            backgroundColor:
                              MOVEMENT_COLORS[movement.id] ?? "#71717a",
                          }}
                          aria-hidden="true"
                        />
                        {movement.label}
                      </h2>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <caption className="sr-only">
                            Philosophers of the {movement.label} school:
                            name, school, number of text sections and number
                            of relations.
                          </caption>
                          <thead>
                            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                              <SortableTh
                                label="Philosopher"
                                sortKey="name"
                                sort={philSort.sort}
                                onToggle={philSort.toggle}
                                className="py-2 pr-3"
                                testId={`sort-phil-name-${movement.id}`}
                              />
                              <SortableTh
                                label="School"
                                sortKey="school"
                                sort={philSort.sort}
                                onToggle={philSort.toggle}
                                className="py-2 pr-3"
                                testId={`sort-phil-school-${movement.id}`}
                              />
                              <SortableTh
                                label="Sections"
                                sortKey="sections"
                                sort={philSort.sort}
                                onToggle={philSort.toggle}
                                className="py-2 pr-3 text-right"
                                numeric
                                testId={`sort-phil-sections-${movement.id}`}
                              />
                              <SortableTh
                                label="Relations"
                                sortKey="relations"
                                sort={philSort.sort}
                                onToggle={philSort.toggle}
                                className="py-2 pr-3 text-right"
                                numeric
                                testId={`sort-phil-relations-${movement.id}`}
                              />
                            </tr>
                          </thead>
                          <tbody>
                            {sortedNodes.map((n) => (
                              <tr
                                key={n.name}
                                className="border-b border-border/60 align-top"
                              >
                                <th
                                  scope="row"
                                  className="py-2 pr-3 font-medium text-left"
                                >
                                  <button
                                    type="button"
                                    data-testid={`list-node-${n.name}`}
                                    className="text-primary hover:underline text-left"
                                    onClick={() => setSelected(n.name)}
                                  >
                                    {n.name}
                                  </button>
                                  <span className="block text-xs text-muted-foreground font-normal">
                                    Book {n.book}, ch. {n.chapter}{" "}
                                    <Link
                                      href={`/section/${n.firstId}`}
                                      data-testid={`list-node-life-${n.name}`}
                                      className="text-primary hover:underline"
                                    >
                                      Read the Life
                                    </Link>
                                  </span>
                                </th>
                                <td className="py-2 pr-3 text-muted-foreground">
                                  {n.movementLabel}
                                </td>
                                <td className="py-2 pr-3 text-right tabular-nums">
                                  {n.sectionCount}
                                </td>
                                <td className="py-2 pr-3 text-right tabular-nums">
                                  {connectionCount.get(n.name) ?? 0}
                                </td>
                              </tr>
                            ))}
                            {schoolAssociates.map((a) => (
                              <tr
                                key={`assoc-${a.name}`}
                                className="border-b border-border/60 align-top bg-muted/30"
                              >
                                <th
                                  scope="row"
                                  className="py-2 pr-3 font-medium text-left"
                                >
                                  <button
                                    type="button"
                                    data-testid={`list-associate-${a.name}`}
                                    className="text-primary hover:underline text-left"
                                    onClick={() => setSelected(a.name)}
                                  >
                                    {a.name}
                                  </button>
                                  <span className="block text-xs text-muted-foreground font-normal">
                                    Associate, cited member of the school of{" "}
                                    {a.anchor}
                                    {a.sectionId ? (
                                      <>
                                        {" "}
                                        <Link
                                          href={`/section/${a.sectionId}`}
                                          data-testid={`list-associate-passage-${a.name}`}
                                          className="text-primary hover:underline"
                                        >
                                          (D.L. {a.ref})
                                        </Link>
                                      </>
                                    ) : (
                                      <> (D.L. {a.ref})</>
                                    )}
                                    {!a.asserted && " (hedged)"}
                                  </span>
                                </th>
                                <td className="py-2 pr-3 text-muted-foreground">
                                  {a.movementLabel}{" "}
                                  <span className="text-xs">(associate)</span>
                                </td>
                                <td className="py-2 pr-3 text-right text-muted-foreground">
                                  n/a
                                </td>
                                <td className="py-2 pr-3 text-right tabular-nums">
                                  {connectionCount.get(a.name) ?? 0}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  );
                })}

                <section className="space-y-4" aria-labelledby="list-relations">
                  <h2
                    id="list-relations"
                    className="text-lg font-serif font-bold text-foreground"
                  >
                    Relations
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <caption className="sr-only">
                        Every curated relation between philosophers: the
                        relation type, its source and its target.
                      </caption>
                      <thead>
                        <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <SortableTh
                            label="From"
                            sortKey="from"
                            sort={edgeSort.sort}
                            onToggle={edgeSort.toggle}
                            className="py-2 pr-3"
                            testId="sort-edge-from"
                          />
                          <SortableTh
                            label="Relation"
                            sortKey="relation"
                            sort={edgeSort.sort}
                            onToggle={edgeSort.toggle}
                            className="py-2 pr-3"
                            testId="sort-edge-relation"
                          />
                          <SortableTh
                            label="To"
                            sortKey="to"
                            sort={edgeSort.sort}
                            onToggle={edgeSort.toggle}
                            className="py-2 pr-3"
                            testId="sort-edge-to"
                          />
                          <SortableTh
                            label="Citation"
                            sortKey="citation"
                            sort={edgeSort.sort}
                            onToggle={edgeSort.toggle}
                            className="py-2 pr-3"
                            testId="sort-edge-citation"
                          />
                        </tr>
                      </thead>
                      <tbody>
                        {sortRows(
                          graph.edges.map((e, idx) => ({ ...e, idx })),
                          edgeSort.sort,
                          {
                            from: (e) => e.from,
                            relation: (e) => EDGE_LABEL[e.type] ?? e.type,
                            to: (e) => e.to,
                            citation: (e) => e.ref || undefined,
                          },
                        ).map((e) => {
                          const i = e.idx;
                          return (
                          <tr
                            key={`edge-${i}`}
                            className="border-b border-border/60"
                          >
                            <th
                              scope="row"
                              className="py-2 pr-3 font-medium text-left"
                            >
                              <button
                                type="button"
                                data-testid={`list-edge-from-${i}`}
                                className="text-primary hover:underline text-left"
                                onClick={() => setSelected(e.from)}
                              >
                                {e.from}
                              </button>
                            </th>
                            <td className="py-2 pr-3 text-muted-foreground">
                              {EDGE_LABEL[e.type] ?? e.type}
                            </td>
                            <td className="py-2 pr-3">
                              <button
                                type="button"
                                data-testid={`list-edge-to-${i}`}
                                className="text-primary hover:underline text-left"
                                onClick={() => setSelected(e.to)}
                              >
                                {e.to}
                              </button>
                            </td>
                            <td className="py-2 pr-3 text-xs text-muted-foreground">
                              {e.ref ? `D.L. ${e.ref}` : ""}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            ) : (
            <>
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="w-full h-auto select-none"
              role="img"
              aria-label="Knowledge graph of philosophers"
              onClick={() => setSelected(null)}
            >
              <defs>
                <marker
                  id="arrow"
                  viewBox="0 0 8 8"
                  refX="7"
                  refY="4"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M0,0 L8,4 L0,8 z" fill="currentColor" opacity="0.35" />
                </marker>
              </defs>
              {graph.edges.map((e, i) => {
                const a = positions.get(e.from);
                const b = positions.get(e.to);
                if (!a || !b) return null;
                const inFocus =
                  (!selected || e.from === selected || e.to === selected) &&
                  passesFilter(e.from) &&
                  passesFilter(e.to);
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
                    opacity={inFocus ? 0.35 : 0.06}
                    markerEnd={e.type !== "spouseOf" ? "url(#arrow)" : undefined}
                  />
                );
              })}
              {associates.map((a) => {
                // The satellite leg follows the cited succession when one
                // exists (teacher may be a KG node or another associate),
                // else the school's founder; a hedged teacher link (the
                // disputed 9.115 pupil list) gets the sparser dash.
                const parent =
                  a.teacher && positions.has(a.teacher) ? a.teacher : a.anchor;
                const hedgedLeg = a.teacher
                  ? a.teacherAsserted === false
                  : !a.asserted;
                const p = positions.get(a.name);
                const q = positions.get(parent);
                if (!p || !q) return null;
                const inFocus =
                  (!selected || a.name === selected || parent === selected) &&
                  passesFilter(a.name) &&
                  passesFilter(parent);
                return (
                  <line
                    key={`assoc-edge-${a.name}`}
                    x1={q.x}
                    y1={q.y}
                    x2={p.x}
                    y2={p.y}
                    stroke="currentColor"
                    strokeWidth={0.9}
                    strokeDasharray={hedgedLeg ? "1 3.5" : "2 3"}
                    opacity={inFocus ? 0.3 : 0.05}
                  />
                );
              })}
              {associates.map((a) => {
                const p = positions.get(a.name);
                if (!p) return null;
                const dim =
                  (selected !== null && !neighborhood.has(a.name)) ||
                  !passesFilter(a.name);
                const color = MOVEMENT_COLORS[a.movement] ?? "#71717a";
                return (
                  <g
                    key={`assoc-node-${a.name}`}
                    transform={`translate(${p.x},${p.y})`}
                    className="cursor-pointer"
                    opacity={dim ? 0.18 : 1}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setSelected(a.name === selected ? null : a.name);
                    }}
                  >
                    <circle
                      r={4}
                      fill={color}
                      fillOpacity={a.asserted ? 0.85 : 0.45}
                      stroke={selected === a.name ? "currentColor" : "white"}
                      strokeWidth={selected === a.name ? 2 : 1}
                      strokeDasharray={
                        a.asserted || selected === a.name ? undefined : "2 2"
                      }
                    />
                    <text
                      y={-8}
                      textAnchor="middle"
                      className="fill-muted-foreground"
                      fontSize={9}
                    >
                      {a.name}
                    </text>
                  </g>
                );
              })}
              {graph.nodes.map((n) => {
                const p = positions.get(n.name);
                if (!p) return null;
                const dim =
                  (selected !== null && !neighborhood.has(n.name)) ||
                  !passesFilter(n.name);
                const color = MOVEMENT_COLORS[n.movement] ?? "#71717a";
                const r = 5 + Math.min(9, Math.sqrt(n.sectionCount));
                return (
                  <g
                    key={n.name}
                    transform={`translate(${p.x},${p.y})`}
                    className="cursor-pointer"
                    opacity={dim ? 0.18 : 1}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setSelected(n.name === selected ? null : n.name);
                    }}
                  >
                    <circle
                      r={r}
                      fill={color}
                      stroke={selected === n.name ? "currentColor" : "white"}
                      strokeWidth={selected === n.name ? 2.5 : 1.2}
                    />
                    <text
                      y={-r - 4}
                      textAnchor="middle"
                      className="fill-foreground"
                      fontSize={n.sectionCount > 40 ? 12 : 10}
                      fontWeight={n.sectionCount > 40 ? 600 : 400}
                    >
                      {n.name}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="border-t border-border px-4 py-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
              {graph.movements
                .filter(
                  (m) =>
                    graph.nodes.some((n) => n.movement === m.id) ||
                    associates.some((a) => a.movement === m.id),
                )
                .map((m) => {
                  const active =
                    movementFilter.size === 0 || movementFilter.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMovement(m.id)}
                      aria-pressed={movementFilter.has(m.id)}
                      title={`Toggle ${m.label}`}
                      className={`flex items-center gap-1.5 rounded-full px-1.5 py-1 min-h-6 transition-colors hover:bg-muted hover:text-foreground ${
                        active ? "" : "opacity-40"
                      } ${movementFilter.has(m.id) ? "bg-muted text-foreground" : ""}`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{
                          backgroundColor: MOVEMENT_COLORS[m.id] ?? "#71717a",
                        }}
                      />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              {filterActive && (
                <button
                  type="button"
                  onClick={() => setMovementFilter(new Set())}
                  className="rounded-full px-1.5 py-0.5 -my-0.5 underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  show all
                </button>
              )}
              <span className="flex items-center gap-1.5 ml-auto">
                <span className="inline-block w-5 border-t border-foreground/50" />{" "}
                teacher
                <span className="inline-block w-5 border-t border-dashed border-foreground/50 ml-2" />{" "}
                influence
                <span className="inline-block w-5 border-t border-dotted border-foreground/50 ml-2" />{" "}
                marriage
                <span className="inline-block w-2 h-2 rounded-full border border-foreground/50 ml-2" />{" "}
                school member
              </span>
            </div>
            </>
            )}
            </div>
          </div>

          <div className="lg:col-span-3 lg:sticky lg:top-24">
            {selectedNode ? (
              <div className="bg-card border border-border/60 rounded-xl p-5 space-y-4 animate-in fade-in duration-300">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-serif font-bold">
                      {selectedNode.name}
                    </h2>
                    <span className="inline-flex items-center gap-1.5 mt-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            MOVEMENT_COLORS[selectedNode.movement] ?? "#71717a",
                        }}
                      />
                      {selectedNode.movementLabel}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {selectedNode.earliestYear != null &&
                  selectedNode.latestYear != null && (
                    <p className="text-sm text-muted-foreground">
                      <span className="text-foreground font-medium">
                        {formatYearRange(
                          selectedNode.earliestYear,
                          selectedNode.latestYear,
                        )}
                      </span>
                      {selectedNode.approximateDates && (
                        <span
                          className="ml-1.5 inline-block align-middle px-1.5 py-px font-semibold uppercase tracking-wider text-[10px] leading-4 text-muted-foreground border-border"
                          title="Dating hedged in the text (e.g. Olympiad flourished about ...)"
                        >
                          approximate
                        </span>
                      )}
                      {selectedNode.dateRefs &&
                        selectedNode.dateRefs.length > 0 && (
                          <span className="ml-1.5 text-xs">
                            (D.L. {selectedNode.dateRefs.join(", ")})
                          </span>
                        )}
                    </p>
                  )}

                {selectedNode.founderOf && (
                  <p className="text-sm text-muted-foreground">
                    Founder of the{" "}
                    <span className="text-foreground font-medium">
                      {selectedNode.founderOf}
                    </span>{" "}
                    school.
                    {selectedNode.founderRef &&
                      (selectedNode.founderSectionId ? (
                        <Link
                          href={`/section/${selectedNode.founderSectionId}`}
                          className="ml-1 text-xs text-primary hover:underline whitespace-nowrap"
                          title="Read this passage"
                        >
                          (D.L. {selectedNode.founderRef})
                        </Link>
                      ) : (
                        <span className="ml-1 text-xs">
                          (D.L. {selectedNode.founderRef})
                        </span>
                      ))}
                  </p>
                )}

                {selectedMovement?.doctrine && (
                  <div className="text-sm">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      School doctrine
                    </span>
                    <p className="text-foreground mt-0.5">
                      {selectedMovement.doctrine}
                      {selectedMovement.doctrineRef &&
                        (selectedMovement.doctrineSectionId ? (
                          <Link
                            href={`/section/${selectedMovement.doctrineSectionId}`}
                            className="ml-1 text-xs text-primary hover:underline whitespace-nowrap"
                            title="Read this passage"
                          >
                            (D.L. {selectedMovement.doctrineRef})
                          </Link>
                        ) : (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (D.L. {selectedMovement.doctrineRef})
                          </span>
                        ))}
                    </p>
                    {selectedMovement.doctrineNote && (
                      <p className="text-xs text-muted-foreground italic mt-0.5">
                        {selectedMovement.doctrineNote}
                      </p>
                    )}
                  </div>
                )}

                <div className="text-sm text-muted-foreground">
                  Book {selectedNode.book}, ch. {selectedNode.chapter} -{" "}
                  {selectedNode.sectionCount} sections
                </div>

                {selectedNode.grcHomonymForm &&
                  selectedNode.sharesGreekNameWith &&
                  selectedNode.sharesGreekNameWith.length > 0 && (
                    <div className="space-y-1.5">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Shares Greek name
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        <span lang="grc" className="font-serif text-foreground">
                          {selectedNode.grcHomonymForm}
                        </span>{" "}
                        also names:
                      </p>
                      <ul className="space-y-1 text-sm">
                        {selectedNode.sharesGreekNameWith.map((other) => (
                          <li key={other}>
                            <button
                              className="font-medium text-primary hover:underline"
                              onClick={() => setSelected(other)}
                            >
                              {other}
                            </button>
                          </li>
                        ))}
                      </ul>
                      <p
                        className="text-[11px] text-muted-foreground italic"
                        title="Each pair carries an owl:differentFrom axiom in the linked-data graph"
                      >
                        Distinct individuals: the linked-data graph asserts
                        owl:differentFrom for each pair.
                      </p>
                    </div>
                  )}

                {selectedEdges.length > 0 && (
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Relations
                    </h3>
                    <ul className="space-y-1 text-sm">
                      {selectedEdges.map((e, i) => {
                        const other =
                          e.from === selectedNode.name ? e.to : e.from;
                        const label =
                          e.type === "spouseOf"
                            ? "spouse of"
                            : e.from === selectedNode.name
                              ? EDGE_LABEL[e.type]
                              : e.type === "teacherOf"
                                ? "pupil of"
                                : "influenced by";
                        return (
                          <li key={i} className="flex flex-wrap gap-x-1">
                            <span className="text-muted-foreground">
                              {label}
                            </span>
                            <button
                              className="font-medium text-primary hover:underline"
                              onClick={() => setSelected(other)}
                            >
                              {other}
                            </button>
                            {e.ref && (
                              <span className="text-xs text-muted-foreground self-center">
                                (D.L. {e.ref})
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {associates.some((a) => a.anchor === selectedNode.name) && (
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      School members
                    </h3>
                    <ul className="space-y-1 text-sm">
                      {associates
                        .filter((a) => a.anchor === selectedNode.name)
                        .map((a) => (
                          <li key={a.name} className="flex flex-wrap gap-x-1">
                            <button
                              className="font-medium text-primary hover:underline"
                              onClick={() => setSelected(a.name)}
                            >
                              {a.name}
                            </button>
                            {!a.asserted && (
                              <span
                                className="px-1.5 font-semibold uppercase tracking-wider text-[10px] leading-4 self-center text-foreground border-border"
                                title="D.L. names him in the roster, but the identification of this exact bearer is hedged"
                              >
                                hedged
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground self-center">
                              (D.L. {a.ref})
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                {associates.some((a) => a.teacher === selectedNode.name) && (
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Pupils in the succession
                    </h3>
                    <ul className="space-y-1 text-sm">
                      {associates
                        .filter((a) => a.teacher === selectedNode.name)
                        .map((a) => (
                          <li key={a.name} className="flex flex-wrap gap-x-1">
                            <button
                              className="font-medium text-primary hover:underline"
                              onClick={() => setSelected(a.name)}
                            >
                              {a.name}
                            </button>
                            {a.teacherAsserted === false && (
                              <span
                                className="px-1.5 font-semibold uppercase tracking-wider text-[10px] leading-4 self-center text-foreground border-border"
                                title="The teacher link is reported, not asserted: D.L. opposes the pupil list to a conflicting report"
                              >
                                reported
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground self-center">
                              (D.L. {a.ref})
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                <ClaimsPanel
                  key={selectedNode.name}
                  philosopher={selectedNode.name}
                />

                <SayingsPanel
                  key={`sayings-${selectedNode.name}`}
                  philosopher={selectedNode.name}
                />

                <VersesPanel
                  key={`verses-${selectedNode.name}`}
                  philosopher={selectedNode.name}
                />

                <div className="flex flex-col gap-2 pt-1 text-sm">
                  <Link
                    href={`/section/${selectedNode.firstId}`}
                    className="text-primary hover:underline"
                  >
                    Read the Life
                  </Link>
                  {selectedNode.qid && (
                    <a
                      href={`https://www.wikidata.org/wiki/${selectedNode.qid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Wikidata ({selectedNode.qid})
                    </a>
                  )}
                  {selectedNode.enwiki && (
                    <a
                      href={`https://dbpedia.org/resource/${selectedNode.enwiki.replace(/ /g, "_")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground hover:underline"
                    >
                      DBpedia
                    </a>
                  )}
                  {selectedNode.enwiki && (
                    <a
                      href={`https://en.wikipedia.org/wiki/${selectedNode.enwiki.replace(/ /g, "_")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Wikipedia
                    </a>
                  )}
                  {selectedNode.viaf && (
                    <a
                      href={`https://viaf.org/viaf/${selectedNode.viaf}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground hover:underline"
                    >
                      VIAF ({selectedNode.viaf})
                    </a>
                  )}
                  {selectedNode.britannica && (
                    <a
                      href={`https://www.britannica.com/${selectedNode.britannica}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Britannica
                    </a>
                  )}
                  {selectedNode.inpho && (
                    <a
                      href={`https://www.inphoproject.org/${selectedNode.inpho}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground hover:underline"
                    >
                      InPhO
                    </a>
                  )}
                  {selectedNode.philosophyPages && (
                    <a
                      href={`https://www.philosophypages.com/${selectedNode.philosophyPages}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Philosophy Pages
                    </a>
                  )}
                </div>
              </div>
            ) : selectedAssociate ? (
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4 animate-in fade-in duration-300">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-serif font-bold">
                      {selectedAssociate.name}
                    </h2>
                    <span
                      className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider text-white"
                      style={{
                        backgroundColor:
                          MOVEMENT_COLORS[selectedAssociate.movement] ??
                          "#71717a",
                      }}
                    >
                      {selectedAssociate.movementLabel}
                    </span>
                    {!selectedAssociate.asserted && (
                      <span
                        className="ml-1.5 inline-block mt-1 px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wider bg-amber-50 text-amber-800 border-amber-200"
                        title="D.L. names him in the roster, but the identification of this exact bearer is hedged"
                      >
                        hedged
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {selectedAssociate.teacher && (
                  <p className="text-sm text-muted-foreground">
                    {selectedAssociate.teacherAsserted === false
                      ? "Reported pupil of"
                      : "Pupil of"}{" "}
                    <button
                      className="font-medium text-primary hover:underline"
                      onClick={() =>
                        setSelected(selectedAssociate.teacher ?? null)
                      }
                    >
                      {selectedAssociate.teacher}
                    </button>
                    {selectedAssociate.teacherAsserted === false && (
                      <span
                        className="ml-1.5 px-1.5 rounded-full border text-[10px] leading-4 bg-amber-50 text-amber-800 border-amber-200"
                        title="The teacher link is reported, not asserted: D.L. opposes the pupil list to a conflicting report"
                      >
                        reported
                      </span>
                    )}
                  </p>
                )}

                {associates.some(
                  (a) => a.teacher === selectedAssociate.name,
                ) && (
                  <p className="text-sm text-muted-foreground">
                    Taught{" "}
                    {associates
                      .filter((a) => a.teacher === selectedAssociate.name)
                      .map((a, i, arr) => (
                        <span key={a.name}>
                          <button
                            className="font-medium text-primary hover:underline"
                            onClick={() => setSelected(a.name)}
                          >
                            {a.name}
                          </button>
                          {i < arr.length - 1 ? ", " : ""}
                        </span>
                      ))}
                  </p>
                )}

                <p className="text-sm text-muted-foreground">
                  Cited member of the school of{" "}
                  <button
                    className="font-medium text-primary hover:underline"
                    onClick={() => setSelected(selectedAssociate.anchor)}
                  >
                    {selectedAssociate.anchor}
                  </button>
                  {selectedAssociate.sectionId ? (
                    <Link
                      href={`/section/${selectedAssociate.sectionId}`}
                      className="ml-1 text-xs text-primary hover:underline whitespace-nowrap"
                      title="Read this passage"
                    >
                      (D.L. {selectedAssociate.ref})
                    </Link>
                  ) : (
                    <span className="ml-1 text-xs">
                      (D.L. {selectedAssociate.ref})
                    </span>
                  )}
                </p>

                {selectedAssociate.note && (
                  <p className="text-sm text-foreground">
                    {selectedAssociate.note}
                  </p>
                )}

                <p className="text-xs text-muted-foreground italic">
                  Not one of the 82 subjects of the Lives: known from the
                  cited school roster, so there is no separate Life to read.
                </p>
              </div>
            ) : selected ? (
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3 animate-in fade-in duration-300">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    No one in the graph is named &ldquo;{selected}&rdquo;.
                    They are mentioned in the text but are neither one of
                    the 82 subjects of the Lives nor a cited school member,
                    so there is no node to highlight.
                  </p>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                    aria-label="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">
                  <Link
                    href={`/entities?q=${encodeURIComponent(selected)}`}
                    className="font-medium text-primary hover:underline"
                  >
                    Look them up in the Index
                  </Link>{" "}
                  to see where the text mentions them.
                </p>
              </div>
            ) : (
              <div className="bg-card border border-border border-dashed rounded-xl p-6 text-center text-sm text-muted-foreground">
                Select a philosopher in the graph to see their teachers,
                pupils and influences, with citations to the text.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
