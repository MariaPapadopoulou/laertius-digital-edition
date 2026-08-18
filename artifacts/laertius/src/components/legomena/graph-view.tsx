import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import type {
  OntologyGraphEdge,
  OntologyGraphNode,
} from "@workspace/api-client-react/legomena";
import { CertaintyBadge } from "@/components/legomena/shared";

/**
 * Static force-directed layout computed synchronously (82 nodes / 77 edges
 * is tiny), rendered as SVG. No layout library: a seeded simulation keeps
 * the picture deterministic across reloads.
 */

const WIDTH = 960;
const HEIGHT = 680;

// Muted archival ink palette, assigned to schools in order of first
// appearance in the node list (which is D.L. book/chapter order).
const PALETTE = [
  "#1f2937", // ink
  "#9a3412", // burnt sienna
  "#1e40af", // ultramarine
  "#166534", // viridian
  "#7c2d12", // umber
  "#0e7490", // cerulean
  "#6d28d9", // violet ink
  "#b45309", // ochre
  "#be123c", // carmine
  "#374151", // graphite
  "#4d7c0f", // olive
  "#0f766e", // teal
  "#a21caf", // magenta ink
  "#92400e", // raw sienna
  "#3730a3", // indigo
  "#065f46", // deep green
  "#9f1239", // madder
  "#155e75", // prussian
  "#78350f", // sepia
  "#5b21b6", // deep violet
  "#334155", // slate
  "#86198f", // purple ink
];

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface LaidOutNode {
  node: OntologyGraphNode;
  x: number;
  y: number;
  r: number;
  color: string;
}

interface LaidOutEdge {
  edge: OntologyGraphEdge;
  index: number;
  a: LaidOutNode;
  b: LaidOutNode;
  /** SVG path for this edge; parallel edges between the same pair get distinct arcs. */
  d: string;
}

/**
 * Path for an edge, arcing parallel edges apart so overlapping statements
 * between the same pair stay individually visible and clickable.
 * `k` is this edge's position among its parallels, `n` the total count.
 */
export function edgePath(
  a: { x: number; y: number },
  b: { x: number; y: number },
  k: number,
  n: number,
): string {
  if (n <= 1) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  // Symmetric offsets around the straight line: e.g. n=2 → ±1, n=3 → -1,0,+1.
  const spread = k - (n - 1) / 2;
  // Perpendicular offset of the control point; scale with length but clamp.
  const off = spread * Math.min(26, Math.max(12, d * 0.18));
  const mx = (a.x + b.x) / 2 - (dy / d) * off;
  const my = (a.y + b.y) / 2 + (dx / d) * off;
  return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
}

/**
 * Assign each edge its SVG path, arcing parallel edges between the same
 * unordered node pair apart. Geometry is always computed in one canonical
 * orientation (smaller URI first) so that opposite-direction parallels
 * (A→B plus B→A) get distinct arcs rather than collapsing onto one curve.
 */
export function assignEdgePaths(
  edges: OntologyGraphEdge[],
  byUri: Map<string, LaidOutNode>,
): LaidOutEdge[] {
  const pairKey = (e: OntologyGraphEdge) =>
    e.fromUri < e.toUri ? `${e.fromUri}|${e.toUri}` : `${e.toUri}|${e.fromUri}`;
  const pairCount = new Map<string, number>();
  for (const e of edges) {
    const k = pairKey(e);
    pairCount.set(k, (pairCount.get(k) ?? 0) + 1);
  }
  const pairSeen = new Map<string, number>();
  const lines: LaidOutEdge[] = [];
  edges.forEach((e, index) => {
    const a = byUri.get(e.fromUri);
    const b = byUri.get(e.toUri);
    if (!a || !b) return;
    const key = pairKey(e);
    const n = pairCount.get(key) ?? 1;
    const k = pairSeen.get(key) ?? 0;
    pairSeen.set(key, k + 1);
    // Canonical orientation: endpoint with the smaller URI first, for every
    // edge of the pair, regardless of the edge's own direction.
    const [p, q] = e.fromUri < e.toUri ? [a, b] : [b, a];
    lines.push({ edge: e, index, a, b, d: edgePath(p, q, k, n) });
  });
  return lines;
}
function computeLayout(
  nodes: OntologyGraphNode[],
  edges: OntologyGraphEdge[],
): { placed: LaidOutNode[]; lines: LaidOutEdge[]; schoolColor: Map<string, string> } {
  const schoolColor = new Map<string, string>();
  for (const n of nodes) {
    if (!schoolColor.has(n.school)) {
      schoolColor.set(n.school, PALETTE[schoolColor.size % PALETTE.length]);
    }
  }

  const rand = mulberry32(hashSeed(nodes.map((n) => n.uri).join("|")));
  const idx = new Map(nodes.map((n, i) => [n.uri, i]));

  // Seed positions clustered by school so related figures start together.
  const schools = [...schoolColor.keys()];
  const x = new Float64Array(nodes.length);
  const y = new Float64Array(nodes.length);
  nodes.forEach((n, i) => {
    const s = schools.indexOf(n.school);
    const angle = (s / Math.max(1, schools.length)) * Math.PI * 2;
    x[i] = WIDTH / 2 + Math.cos(angle) * 220 + (rand() - 0.5) * 120;
    y[i] = HEIGHT / 2 + Math.sin(angle) * 160 + (rand() - 0.5) * 90;
  });

  const links = edges
    .map((e) => [idx.get(e.fromUri), idx.get(e.toUri)] as const)
    .filter((p): p is readonly [number, number] => p[0] !== undefined && p[1] !== undefined);

  const ITER = 320;
  for (let it = 0; it < ITER; it++) {
    const cool = 1 - it / ITER;
    // Repulsion (O(n^2) is fine at this size).
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        let dx = x[i] - x[j];
        let dy = y[i] - y[j];
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          dx = rand() - 0.5;
          dy = rand() - 0.5;
          d2 = 1;
        }
        const d = Math.sqrt(d2);
        const f = (2600 / d2) * cool;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        x[i] += fx;
        y[i] += fy;
        x[j] -= fx;
        y[j] -= fy;
      }
    }
    // Springs along edges.
    for (const [a, b] of links) {
      const dx = x[b] - x[a];
      const dy = y[b] - y[a];
      const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const f = ((d - 90) / d) * 0.06 * cool;
      x[a] += dx * f;
      y[a] += dy * f;
      x[b] -= dx * f;
      y[b] -= dy * f;
    }
    // Gentle pull to center.
    for (let i = 0; i < nodes.length; i++) {
      x[i] += (WIDTH / 2 - x[i]) * 0.012 * cool;
      y[i] += (HEIGHT / 2 - y[i]) * 0.012 * cool;
    }
  }

  // Fit into the viewport with a margin.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < nodes.length; i++) {
    minX = Math.min(minX, x[i]);
    maxX = Math.max(maxX, x[i]);
    minY = Math.min(minY, y[i]);
    maxY = Math.max(maxY, y[i]);
  }
  const M = 46;
  const sx = (WIDTH - 2 * M) / Math.max(1, maxX - minX);
  const sy = (HEIGHT - 2 * M) / Math.max(1, maxY - minY);

  const placed: LaidOutNode[] = nodes.map((n, i) => ({
    node: n,
    x: M + (x[i] - minX) * sx,
    y: M + (y[i] - minY) * sy,
    r: 4 + Math.sqrt(n.claimCount) * 1.35,
    color: schoolColor.get(n.school) ?? PALETTE[0],
  }));
  const byUri = new Map(placed.map((p) => [p.node.uri, p]));
  const lines = assignEdgePaths(edges, byUri);
  return { placed, lines, schoolColor };
}

export function GraphView({
  nodes,
  edges,
}: {
  nodes: OntologyGraphNode[];
  edges: OntologyGraphEdge[];
}) {
  const [, navigate] = useLocation();
  const [hoverUri, setHoverUri] = useState<string | null>(null);
  const [selected, setSelected] = useState<LaidOutEdge | null>(null);

  const { placed, lines, schoolColor } = useMemo(
    () => computeLayout(nodes, edges),
    [nodes, edges],
  );

  const neighborUris = useMemo(() => {
    if (!hoverUri) return null;
    const s = new Set<string>([hoverUri]);
    for (const l of lines) {
      if (l.edge.fromUri === hoverUri) s.add(l.edge.toUri);
      if (l.edge.toUri === hoverUri) s.add(l.edge.fromUri);
    }
    return s;
  }, [hoverUri, lines]);

  const sel = selected?.edge;

  return (
    <div className="border border-border/60 bg-card">
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-auto select-none"
          role="img"
          aria-label="Philosopher relation network"
          onClick={() => setSelected(null)}
        >
          {lines.map((l) => {
            const isSel = selected?.index === l.index;
            const dimmed =
              (neighborUris &&
                !(neighborUris.has(l.edge.fromUri) && neighborUris.has(l.edge.toUri))) ||
              (selected && !isSel);
            return (
              <g key={l.index}>
                {/* Wide invisible hit area so thin edges stay clickable. */}
                <path
                  d={l.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={12}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(l);
                  }}
                />
                <path
                  data-testid="graph-edge"
                  d={l.d}
                  fill="none"
                  stroke="currentColor"
                  className={
                    isSel ? "text-primary" : "text-foreground/40 pointer-events-none"
                  }
                  strokeWidth={isSel ? 2.25 : 1}
                  strokeDasharray={l.edge.certainty === "asserted" ? undefined : "3 3"}
                  opacity={dimmed ? 0.12 : isSel ? 1 : 0.75}
                />
              </g>
            );
          })}
          {placed.map((p) => {
            const dimmed = neighborUris && !neighborUris.has(p.node.uri);
            const isEndpoint =
              sel && (sel.fromUri === p.node.uri || sel.toUri === p.node.uri);
            return (
              <g
                key={p.node.uri}
                transform={`translate(${p.x},${p.y})`}
                className="cursor-pointer"
                opacity={dimmed && !isEndpoint ? 0.18 : 1}
                onMouseEnter={() => setHoverUri(p.node.uri)}
                onMouseLeave={() => setHoverUri(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/legomena/entity?uri=${encodeURIComponent(p.node.uri)}`);
                }}
              >
                {p.node.sage && (
                  <circle
                    r={p.r + 3}
                    fill="none"
                    stroke={p.color}
                    strokeWidth={0.75}
                    opacity={0.7}
                  />
                )}
                <circle data-testid="graph-node" r={p.r} fill={p.color} />
                <text
                  y={-(p.r + 5)}
                  textAnchor="middle"
                  pointerEvents="none"
                  className="font-mono fill-foreground"
                  fontSize={hoverUri === p.node.uri || isEndpoint ? 12 : 9.5}
                  fontWeight={hoverUri === p.node.uri || isEndpoint ? 600 : 400}
                  paintOrder="stroke"
                  stroke="hsl(var(--background))"
                  strokeWidth={3}
                >
                  {p.node.name}
                </text>
              </g>
            );
          })}
        </svg>

        {sel && (
          <div className="absolute bottom-3 right-3 w-[280px] max-w-[calc(100%-1.5rem)] bg-background border border-border shadow-sm p-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-start justify-between gap-2 mb-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {sel.type.replace(/([A-Z])/g, " $1").trim()}
              </span>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close edge detail"
                className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
            <div className="text-sm font-medium leading-snug mb-3">
              {sel.from} <span className="text-muted-foreground font-normal">→</span>{" "}
              {sel.to}
            </div>
            <div className="flex items-center gap-2 mb-3">
              <CertaintyBadge certainty={sel.certainty} />
              <span
                className="text-xs text-muted-foreground truncate"
                title={sel.attribution}
              >
                {sel.attribution}
              </span>
            </div>
            {sel.sectionId ? (
              <Link
                href={`/legomena/reader/${sel.sectionId}`}
                className="font-mono text-xs hover:underline decoration-primary/30 underline-offset-4"
              >
                {sel.citation}
              </Link>
            ) : (
              <span className="font-mono text-xs text-muted-foreground">
                {sel.citation}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border/40 px-4 py-3 flex flex-wrap gap-x-4 gap-y-1.5 items-center">
        {[...schoolColor.entries()].map(([school, color]) => (
          <span key={school} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {school.replace(/-/g, " ")}
            </span>
          </span>
        ))}
        <span className="ml-auto text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          solid asserted · dashed reported · node size = claims
        </span>
      </div>
    </div>
  );
}
