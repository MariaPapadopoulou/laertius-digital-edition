import { useMemo } from "react";
import { hierarchy, tree, type HierarchyPointNode } from "d3-hierarchy";
import { KgNode, KgEdge } from "@workspace/api-client-react";
import { MOVEMENT_COLORS } from "./movement-colors";

interface TreeDatum {
  name: string;
  children: TreeDatum[];
}

interface Props {
  nodes: KgNode[];
  edges: KgEdge[];
  selected: string | null;
  onSelect: (name: string | null) => void;
}

const ROW = 32;
const COL = 190;
const MARGIN_X = 70;
const LABEL_SPACE = 170;

function linkPath(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

export default function SuccessionTree({
  nodes,
  edges,
  selected,
  onSelect,
}: Props) {
  const nodeByName = useMemo(
    () => new Map(nodes.map((n) => [n.name, n])),
    [nodes],
  );

  const {
    placed,
    primaryLinks,
    secondaryLinks,
    influenceLinks,
    childParents,
    outside,
    width,
    height,
  } = useMemo(() => {
      const teacherEdges = edges.filter((e) => e.type === "teacherOf");
      const influenceEdges = edges.filter((e) => e.type === "influenced");

      // First teacher listed wins as the tree parent; the rest become
      // dashed overlay links so no relation is lost.
      const primaryParent = new Map<string, string>();
      const secondary: KgEdge[] = [];
      for (const e of teacherEdges) {
        if (!primaryParent.has(e.to) && e.from !== e.to) {
          primaryParent.set(e.to, e.from);
        } else {
          secondary.push(e);
        }
      }

      // A philosopher with no reported teacher joins the tree under their
      // first-listed influencer (dotted link), so figures like Epicurus
      // (shaped by Democritus' books, D.L. 10.2, no direct teacher named)
      // are not stranded outside the successions.
      const influenceParent = new Map<string, string>();
      for (const e of influenceEdges) {
        if (
          !primaryParent.has(e.to) &&
          !influenceParent.has(e.to) &&
          e.from !== e.to
        ) {
          influenceParent.set(e.to, e.from);
        }
      }

      const childrenOf = new Map<string, string[]>();
      for (const parentMap of [primaryParent, influenceParent]) {
        for (const [child, parent] of parentMap) {
          const arr = childrenOf.get(parent) ?? [];
          arr.push(child);
          childrenOf.set(parent, arr);
        }
      }

      const involved = new Set<string>();
      for (const e of teacherEdges) {
        involved.add(e.from);
        involved.add(e.to);
      }
      for (const [child, parent] of influenceParent) {
        involved.add(child);
        involved.add(parent);
      }

      const roots = [...involved].filter(
        (n) => !primaryParent.has(n) && !influenceParent.has(n),
      );

      const build = (name: string, path: Set<string>): TreeDatum => {
        const next = new Set(path).add(name);
        return {
          name,
          children: (childrenOf.get(name) ?? [])
            .filter((c) => !next.has(c))
            .map((c) => build(c, next)),
        };
      };

      const rootDatum: TreeDatum = {
        name: "",
        children: roots.map((r) => build(r, new Set())),
      };

      const layout = tree<TreeDatum>().nodeSize([ROW, COL]);
      const root = layout(hierarchy(rootDatum));

      const descendants = root
        .descendants()
        .filter((d) => d.depth > 0) as HierarchyPointNode<TreeDatum>[];

      let minX = Infinity;
      let maxX = -Infinity;
      let maxDepth = 0;
      for (const d of descendants) {
        if (d.x < minX) minX = d.x;
        if (d.x > maxX) maxX = d.x;
        if (d.depth > maxDepth) maxDepth = d.depth;
      }
      if (!isFinite(minX)) {
        minX = 0;
        maxX = 0;
      }

      const offsetX = MARGIN_X; // depth 1 starts at x = MARGIN_X
      const offsetY = 20 - minX;

      const pos = new Map<string, { x: number; y: number }>();
      for (const d of descendants) {
        pos.set(d.data.name, {
          x: offsetX + (d.depth - 1) * COL,
          y: offsetY + d.x,
        });
      }

      const primaryLinks: {
        from: string;
        to: string;
        ref?: string | undefined;
      }[] = [];
      for (const [child, parent] of primaryParent) {
        if (pos.has(child) && pos.has(parent)) {
          const e = teacherEdges.find(
            (t) => t.from === parent && t.to === child,
          );
          primaryLinks.push({ from: parent, to: child, ref: e?.ref });
        }
      }

      const secondaryLinks = secondary.filter(
        (e) => pos.has(e.from) && pos.has(e.to),
      );

      // All influence edges between placed nodes render dotted, whether
      // they anchored a placement or merely overlay one.
      const influenceLinks = influenceEdges.filter(
        (e) => pos.has(e.from) && pos.has(e.to),
      );

      // Anything not placed in the tree (no teacherOf or anchoring influence
      // edge, or - defensively - a node lost to a hypothetical parent cycle)
      // gets a pill instead.
      const outside = nodes.map((n) => n.name).filter((n) => !pos.has(n));

      return {
        placed: pos,
        primaryLinks,
        secondaryLinks,
        influenceLinks,
        childParents: new Set(childrenOf.keys()),
        outside,
        width: MARGIN_X + (maxDepth - 1) * COL + LABEL_SPACE,
        height: maxX - minX + 40,
      };
    }, [nodes, edges]);

  const neighborhood = useMemo(() => {
    const set = new Set<string>();
    if (selected) {
      set.add(selected);
      for (const e of edges) {
        if (e.type !== "teacherOf" && e.type !== "influenced") continue;
        if (e.from === selected) set.add(e.to);
        if (e.to === selected) set.add(e.from);
      }
    }
    return set;
  }, [selected, edges]);

  const hasChildren = childParents;

  return (
    <div>
      {/* Render at natural size inside a horizontal scroller instead of
          shrinking the whole tree to fit - keeps the labels readable. */}
      <div className="overflow-x-auto">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block select-none"
          role="img"
          aria-label="Succession tree of philosophers"
          onClick={() => onSelect(null)}
        >
        <defs>
          <marker
            id="tree-arrow"
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
        {primaryLinks.map((l, i) => {
          const a = placed.get(l.from);
          const b = placed.get(l.to);
          if (!a || !b) return null;
          const inFocus =
            !selected || l.from === selected || l.to === selected;
          return (
            <path
              key={`p${i}`}
              d={linkPath(a.x + 6, a.y, b.x - 8, b.y)}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.4}
              opacity={inFocus ? 0.35 : 0.07}
              markerEnd="url(#tree-arrow)"
            />
          );
        })}
        {secondaryLinks.map((e, i) => {
          const a = placed.get(e.from);
          const b = placed.get(e.to);
          if (!a || !b) return null;
          const inFocus =
            !selected || e.from === selected || e.to === selected;
          return (
            <path
              key={`s${i}`}
              d={linkPath(a.x + 6, a.y, b.x - 8, b.y)}
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={inFocus ? 0.3 : 0.05}
              markerEnd="url(#tree-arrow)"
            />
          );
        })}
        {influenceLinks.map((e, i) => {
          const a = placed.get(e.from);
          const b = placed.get(e.to);
          if (!a || !b) return null;
          const inFocus =
            !selected || e.from === selected || e.to === selected;
          return (
            <path
              key={`i${i}`}
              d={linkPath(a.x + 6, a.y, b.x - 8, b.y)}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.1}
              strokeDasharray="1.5 3.5"
              strokeLinecap="round"
              opacity={inFocus ? 0.32 : 0.06}
              markerEnd="url(#tree-arrow)"
            />
          );
        })}
        {[...placed.entries()].map(([name, p]) => {
          const n = nodeByName.get(name);
          if (!n) return null;
          const dim = selected !== null && !neighborhood.has(name);
          const color = MOVEMENT_COLORS[n.movement] ?? "#71717a";
          const r = 4 + Math.min(6, Math.sqrt(n.sectionCount));
          const leaf = !hasChildren.has(name);
          return (
            <g
              key={name}
              transform={`translate(${p.x},${p.y})`}
              className="cursor-pointer"
              opacity={dim ? 0.18 : 1}
              onClick={(ev) => {
                ev.stopPropagation();
                onSelect(name === selected ? null : name);
              }}
            >
              <circle
                r={r}
                fill={color}
                stroke={selected === name ? "currentColor" : "white"}
                strokeWidth={selected === name ? 2.5 : 1.2}
              />
              <text
                x={leaf ? r + 5 : 0}
                y={leaf ? 0 : -r - 4}
                dominantBaseline={leaf ? "middle" : undefined}
                textAnchor={leaf ? "start" : "middle"}
                className="fill-foreground"
                fontSize={n.sectionCount > 40 ? 13.5 : 12}
                fontWeight={n.sectionCount > 40 ? 600 : 400}
              >
                {name}
              </text>
            </g>
          );
        })}
        </svg>
      </div>
      <div className="border-t border-border px-4 py-3 space-y-2 text-[11px] text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 border-t border-foreground/50" />{" "}
            teacher → pupil (tree parent = first teacher named)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 border-t border-dashed border-foreground/50" />{" "}
            additional teacher
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 border-t border-dotted border-foreground/60" />{" "}
            influence (anchors philosophers with no teacher named, e.g.
            Epicurus via Democritus' books, 10.2)
          </span>
        </div>
        {outside.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold uppercase tracking-wide">
              Outside the successions:
            </span>
            {outside.map((name) => {
              const n = nodeByName.get(name);
              return (
                <button
                  key={name}
                  onClick={() => onSelect(name === selected ? null : name)}
                  className={`px-1.5 py-0.5 border transition-colors text-[10px] uppercase font-semibold tracking-wider ${
                    selected === name
                      ? "border-foreground text-foreground"
                      : "border-border hover:text-foreground"
                  }`}
                  style={{
                    color:
                      selected === name
                        ? undefined
                        : (MOVEMENT_COLORS[n?.movement ?? "other"] ??
                          "#71717a"),
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
