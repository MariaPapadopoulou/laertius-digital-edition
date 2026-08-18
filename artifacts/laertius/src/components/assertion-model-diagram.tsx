import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ARROWS, CARDS, HEADER_H, ROW_H } from "./assertion-model-data";

/**
 * An interactive rendering of the reference schema's Assertion model: each
 * card is a concept, its rows are the relations (solid underline) and
 * attributes (dotted underline) the model gives it. Amber arrows point from
 * an attribute row to the concept whose instances fill it; grey arrows
 * branch a concept into its subtypes. Hovering or focusing a row or card
 * highlights its connections and dims the rest, so the reference arrows can
 * be read one at a time. Content cross-checked against the OTB inventory
 * (the curator's TEDI reference export).
 */

const REF_STROKE = "stroke-amber-700 dark:stroke-amber-500";
const REF_FILL = "fill-amber-700 dark:fill-amber-500";

function cardOf(id: string): string {
  return id.includes(".") ? id.slice(0, id.indexOf(".")) : id;
}

interface ActiveSets {
  arrows: Set<string>;
  cards: Set<string>;
  rows: Set<string>;
}

function computeActive(activeId: string | null): ActiveSets | null {
  if (!activeId) return null;
  const isRow = activeId.includes(".");
  const baseCard = cardOf(activeId);
  const arrows = new Set<string>();
  const cards = new Set<string>([baseCard]);
  const rows = new Set<string>(isRow ? [activeId] : []);

  for (const a of ARROWS) {
    const fromCard = cardOf(a.from);
    const hit = isRow
      ? a.from === activeId
      : fromCard === activeId || a.to === activeId;
    if (!hit) continue;
    arrows.add(a.id);
    cards.add(fromCard);
    cards.add(a.to);
    if (a.from.includes(".")) rows.add(a.from);
  }

  for (const c of CARDS) {
    for (const r of c.rows ?? []) {
      if (!r.targets) continue;
      const rowActive = isRow ? r.id === activeId : c.id === activeId;
      if (rowActive) {
        rows.add(r.id);
        for (const t of r.targets) cards.add(t);
      } else if (!isRow && r.targets.includes(activeId)) {
        // Hovering a card that this row refers to: light the row up too.
        rows.add(r.id);
        cards.add(c.id);
      }
    }
  }
  return { arrows, cards, rows };
}

export function AssertionModelDiagram() {
  const [, navigate] = useLocation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = useMemo(() => computeActive(activeId), [activeId]);

  const cardDim = (id: string) => (active ? !active.cards.has(id) : false);
  const arrowDim = (id: string) => (active ? !active.arrows.has(id) : false);

  const zoneProps = (id: string, label: string, href?: string) => ({
    tabIndex: 0,
    role: href ? ("link" as const) : ("group" as const),
    "aria-label": label,
    onMouseEnter: () => setActiveId(id),
    onMouseLeave: () => setActiveId((cur) => (cur === id ? null : cur)),
    onFocus: () => setActiveId(id),
    onBlur: () => setActiveId((cur) => (cur === id ? null : cur)),
    ...(href
      ? {
          onClick: () => navigate(href),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter") {
              e.preventDefault();
              navigate(href);
            }
          },
        }
      : {}),
    className: href ? "outline-none cursor-pointer" : "outline-none",
  });

  return (
    <figure className="my-6">
      <div
        className="overflow-x-auto rounded-md border border-card-border bg-card/50 p-4"
        tabIndex={0}
        role="region"
        aria-label="Scrollable diagram"
      >
        <svg
          viewBox="0 0 1000 668"
          role="group"
          aria-labelledby="assertion-model-diagram-title"
          className="mx-auto h-auto w-full min-w-[720px] max-w-[1000px] text-muted-foreground"
        >
          <title id="assertion-model-diagram-title">
            The Assertion model: concept cards with attribute rows. Amber
            arrows point from the assertion&rsquo;s rows to Person, Document,
            Topic, Text, and Value; grey arrows branch Person, Document, and
            Topic into their subtypes.
          </title>
          <defs>
            <marker
              id="am-arrow-sub"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
            <marker
              id="am-arrow-ref"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className={REF_FILL} />
            </marker>
          </defs>

          {/* Arrows under the cards */}
          {ARROWS.map((a) => {
            const dim = arrowDim(a.id);
            const hot = active ? active.arrows.has(a.id) : false;
            return (
              <g
                key={a.id}
                className={`transition-opacity duration-150 ${dim ? "opacity-15" : "opacity-100"}`}
              >
                <path
                  d={a.d}
                  fill="none"
                  className={a.kind === "ref" ? REF_STROKE : undefined}
                  stroke={a.kind === "sub" ? "currentColor" : undefined}
                  strokeWidth={hot ? 2.4 : a.kind === "ref" ? 1.6 : 1.4}
                  markerEnd={`url(#am-arrow-${a.kind})`}
                />
              </g>
            );
          })}

          {/* Concept cards */}
          {CARDS.map((c) => {
            const dim = cardDim(c.id);
            const lit = active ? active.cards.has(c.id) : false;
            const hasRows = (c.rows?.length ?? 0) > 0;
            const headerH = hasRows ? HEADER_H : c.h;
            return (
              <g
                key={c.id}
                className={`transition-opacity duration-150 ${dim ? "opacity-20" : "opacity-100"}`}
              >
                <g
                  {...zoneProps(
                    c.id,
                    `${c.title}${hasRows ? `, with ${c.rows!.length} rows` : ""}${c.href ? `, opens the ${c.href.slice(1)} page` : ""}`,
                    c.href,
                  )}
                >
                  <rect
                    x={c.x}
                    y={c.y}
                    width={c.w}
                    height={c.h}
                    className={`fill-card ${lit ? "stroke-foreground" : "stroke-foreground/60"}`}
                    strokeWidth={lit ? 2 : 1.5}
                  />
                </g>
                <text
                  x={c.x + c.w / 2}
                  y={c.y + headerH / 2 + 5}
                  textAnchor="middle"
                  className={`fill-foreground font-serif text-[14.5px] pointer-events-none ${
                    c.href && lit ? "underline" : ""
                  }`}
                >
                  {c.title}
                  {c.href && (
                    <tspan className="fill-muted-foreground text-[10px]" dx="4">
                      {"\u2197"}
                    </tspan>
                  )}
                </text>
                {hasRows && (
                  <line
                    x1={c.x}
                    y1={c.y + HEADER_H - 0.5}
                    x2={c.x + c.w}
                    y2={c.y + HEADER_H - 0.5}
                    className="stroke-foreground/25 pointer-events-none"
                    strokeWidth="1"
                  />
                )}
                {c.rows?.map((r, i) => {
                  const rowY = c.y + HEADER_H + i * ROW_H;
                  const hotRow = active ? active.rows.has(r.id) : false;
                  const rowClass = !active
                    ? "opacity-100"
                    : hotRow
                      ? "opacity-100"
                      : active.cards.has(c.id)
                        ? "opacity-40"
                        : "opacity-100";
                  const nameW = Math.min(
                    r.name.length * 6.6,
                    (c.typeCol ?? 120) - 14,
                  );
                  return (
                    <g
                      key={r.id}
                      className={`transition-opacity duration-150 ${rowClass}`}
                    >
                      <g {...zoneProps(r.id, `${r.name} : ${r.type}`)}>
                        <rect
                          x={c.x + 1.5}
                          y={rowY}
                          width={c.w - 3}
                          height={ROW_H}
                          className={
                            hotRow
                              ? "fill-amber-700/10 dark:fill-amber-500/15"
                              : "fill-transparent"
                          }
                        />
                      </g>
                      <text
                        x={c.x + 12}
                        y={rowY + 15}
                        className="fill-foreground font-mono text-[11px] pointer-events-none"
                      >
                        {r.name}
                      </text>
                      <line
                        x1={c.x + 12}
                        y1={rowY + 17.5}
                        x2={c.x + 12 + nameW}
                        y2={rowY + 17.5}
                        className="stroke-foreground/45 pointer-events-none"
                        strokeWidth="1"
                        strokeDasharray={r.attr ? "2 2.5" : undefined}
                      />
                      <text
                        x={c.x + (c.typeCol ?? 120)}
                        y={rowY + 15}
                        className="fill-muted-foreground font-mono text-[11px] pointer-events-none"
                      >
                        : {r.type}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Legend */}
          <g>
            <path
              d="M 26 598 L 64 598"
              fill="none"
              className={REF_STROKE}
              strokeWidth="1.6"
              markerEnd="url(#am-arrow-ref)"
            />
            <text x={74} y={602} className="fill-foreground text-[11px]">
              reference: an attribute row points at the concept that fills it
            </text>
            <path
              d="M 460 598 L 498 598"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              markerEnd="url(#am-arrow-sub)"
            />
            <text x={508} y={602} className="fill-foreground text-[11px]">
              subtype: a concept branches into its kinds
            </text>
            <text x={26} y={630} className="fill-foreground font-mono text-[11px]">
              {"confidence \u2208 { low, medium, high }"}
            </text>
            <text
              x={460}
              y={630}
              className="fill-muted-foreground italic text-[11px]"
            >
              {"Hover or tab to trace links; cards marked \u2197 open their pages."}
            </text>
          </g>
        </svg>
      </div>
      <figcaption className="mt-2 text-sm text-muted-foreground leading-relaxed">
        The assertion model behind the curated layers, redrawn from the
        project&rsquo;s reference schema. Each card is a concept; its rows are
        the relations (solid underline) and attributes (dotted underline) the
        model gives it. Amber arrows read a row into the concept that fills
        it: an assertion is <span className="font-mono text-xs">assertedBy</span>{" "}
        a person, <span className="font-mono text-xs">assertedIn</span> a
        document, <span className="font-mono text-xs">hasTopic</span> a topic;
        its <span className="font-mono text-xs">hasContent</span> is a text or
        another assertion (the small loop); its{" "}
        <span className="font-mono text-xs">confidence</span> is graded low,
        medium, or high. Grey arrows branch a concept into its subtypes:
        persons into philosophers and non-philosophers, documents into the
        anecdotes, doxai, letters, and testaments curated above, topics into
        birth and death. Each document is anchored to its philosopher (
        <span className="font-mono text-xs">isRelatedTo</span>) and carries its
        verbatim excerpt as a text with its{" "}
        <span className="font-mono text-xs">cts</span> citation. Alongside the
        three confidence grades the corpus keeps its finer four-valued
        certainty (asserted, reported, disputed, conjectured). Hover or tab
        through rows and cards to follow one link at a time; the cards marked
        with an arrow (&#x2197;) link to the pages where the matching curated
        layer lives.
      </figcaption>
    </figure>
  );
}
