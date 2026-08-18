import placeImg from "@/assets/kg-nodes/place.jpg";
import cityImg from "@/assets/kg-nodes/city.jpg";
import islandImg from "@/assets/kg-nodes/island.jpg";
import athensImg from "@/assets/kg-nodes/athens.jpg";
import citiumImg from "@/assets/kg-nodes/citium.jpg";
import samosImg from "@/assets/kg-nodes/samos.jpg";
import zenoImg from "@/assets/kg-nodes/zeno.jpg";
import melissusImg from "@/assets/kg-nodes/melissus.jpg";

/**
 * A static diagram of classes and individuals in the published ontology,
 * drawn with the Protégé editor's colour convention: gold rings with a
 * round badge for owl:Class nodes, purple rings with a diamond badge for
 * named individuals. Every arrow is a real triple from graph.ttl or
 * ontology.ttl; the images inside the nodes are illustrative vignettes.
 */

type NodeKind = "class" | "individual";

interface DiagramNode {
  id: string;
  kind: NodeKind;
  cx: number;
  cy: number;
  r: number;
  img: string;
  alt: string;
  label: string;
  labelX: number;
  labelY: number;
  anchor: "start" | "middle" | "end";
  badgeAngle: number;
}

const CLASS_COLOR = "#c9971a";
const IND_COLOR = "#8d5a96";

const NODES: DiagramNode[] = [
  {
    id: "place",
    kind: "class",
    cx: 125,
    cy: 175,
    r: 46,
    img: placeImg,
    alt: "Fresco-style map of the Aegean world",
    label: "lo:Place",
    labelX: 68,
    labelY: 113,
    anchor: "start",
    badgeAngle: 135,
  },
  {
    id: "city",
    kind: "class",
    cx: 365,
    cy: 85,
    r: 46,
    img: cityImg,
    alt: "Fresco-style ancient walled city",
    label: "lo:City",
    labelX: 422,
    labelY: 52,
    anchor: "start",
    badgeAngle: 45,
  },
  {
    id: "island",
    kind: "class",
    cx: 415,
    cy: 245,
    r: 46,
    img: islandImg,
    alt: "Fresco-style rocky island in the sea",
    label: "lo:Island",
    labelX: 415,
    labelY: 314,
    anchor: "middle",
    badgeAngle: 45,
  },
  {
    id: "athens",
    kind: "individual",
    cx: 660,
    cy: 85,
    r: 46,
    img: athensImg,
    alt: "The Parthenon on the Acropolis",
    label: ":athens",
    labelX: 716,
    labelY: 52,
    anchor: "start",
    badgeAngle: 45,
  },
  {
    id: "samos",
    kind: "individual",
    cx: 690,
    cy: 260,
    r: 46,
    img: samosImg,
    alt: "Island shore with a ruined column",
    label: ":samos",
    labelX: 746,
    labelY: 230,
    anchor: "start",
    badgeAngle: 45,
  },
  {
    id: "citium",
    kind: "individual",
    cx: 175,
    cy: 370,
    r: 44,
    img: citiumImg,
    alt: "Ancient harbour town with a moored ship",
    label: ":citium",
    labelX: 110,
    labelY: 312,
    anchor: "start",
    badgeAngle: 135,
  },
  {
    id: "zeno",
    kind: "individual",
    cx: 455,
    cy: 405,
    r: 46,
    img: zenoImg,
    alt: "Marble bust of a bearded philosopher",
    label: ":zeno-of-citium",
    labelX: 455,
    labelY: 478,
    anchor: "middle",
    badgeAngle: 45,
  },
  {
    id: "melissus",
    kind: "individual",
    cx: 880,
    cy: 395,
    r: 46,
    img: melissusImg,
    alt: "Marble bust of a philosopher with a headband",
    label: ":melissus",
    labelX: 880,
    labelY: 468,
    anchor: "middle",
    badgeAngle: 45,
  },
];

interface DiagramEdge {
  d: string;
  label: string;
  labelX: number;
  labelY: number;
  anchor?: "start" | "middle" | "end";
}

const EDGES: DiagramEdge[] = [
  {
    d: "M 319 92 Q 240 105, 174 146",
    label: "rdfs:subClassOf",
    labelX: 240,
    labelY: 92,
    anchor: "middle",
  },
  {
    d: "M 369 236 Q 280 218, 175 193",
    label: "rdfs:subClassOf",
    labelX: 278,
    labelY: 240,
    anchor: "middle",
  },
  {
    d: "M 614 80 Q 512 62, 415 78",
    label: "rdf:type",
    labelX: 514,
    labelY: 95,
    anchor: "middle",
  },
  {
    d: "M 644 253 Q 555 232, 464 240",
    label: "rdf:type",
    labelX: 552,
    labelY: 222,
    anchor: "middle",
  },
  {
    d: "M 484 369 C 560 290, 615 195, 648 134",
    label: "lo:livedIn",
    labelX: 554,
    labelY: 308,
    anchor: "start",
  },
  {
    d: "M 409 396 Q 310 393, 222 379",
    label: "lo:bornIn",
    labelX: 310,
    labelY: 378,
    anchor: "middle",
  },
  {
    d: "M 843 366 Q 775 320, 727 292",
    label: "lo:bornIn",
    labelX: 800,
    labelY: 318,
    anchor: "start",
  },
];

function badgePos(node: DiagramNode): { x: number; y: number } {
  const rad = (node.badgeAngle * Math.PI) / 180;
  return {
    x: node.cx + (node.r + 1) * Math.cos(rad),
    y: node.cy - (node.r + 1) * Math.sin(rad),
  };
}

export function KgOntologyDiagram() {
  const predicate = "font-mono";

  return (
    <figure className="my-6">
      <div
        className="overflow-x-auto rounded-md border border-card-border bg-card/50 p-4"
        tabIndex={0}
        role="region"
        aria-label="Scrollable diagram"
      >
        <svg
          viewBox="0 0 1000 500"
          role="img"
          aria-labelledby="kg-ontology-diagram-title"
          className="mx-auto h-auto w-full min-w-[640px] max-w-[880px] text-muted-foreground"
        >
          <title id="kg-ontology-diagram-title">
            Classes and individuals of the ontology in the Protégé colour
            convention: gold rings for classes, purple rings for named
            individuals, joined by subclass, type, and property arrows.
          </title>
          <defs>
            <marker
              id="kg-ont-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
            {NODES.map((n) => (
              <clipPath key={n.id} id={`kg-ont-clip-${n.id}`}>
                <circle cx={n.cx} cy={n.cy} r={n.r - 2} />
              </clipPath>
            ))}
          </defs>

          {EDGES.map((e) => (
            <g key={e.label + e.labelX}>
              <path
                d={e.d}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                markerEnd="url(#kg-ont-arrow)"
              />
              <text
                x={e.labelX}
                y={e.labelY}
                textAnchor={e.anchor ?? "middle"}
                className={`fill-foreground text-[12.5px] ${predicate}`}
              >
                {e.label}
              </text>
            </g>
          ))}

          {NODES.map((n) => {
            const color = n.kind === "class" ? CLASS_COLOR : IND_COLOR;
            const badge = badgePos(n);
            return (
              <g key={n.id}>
                <image
                  href={n.img}
                  x={n.cx - n.r}
                  y={n.cy - n.r}
                  width={n.r * 2}
                  height={n.r * 2}
                  clipPath={`url(#kg-ont-clip-${n.id})`}
                  preserveAspectRatio="xMidYMid slice"
                >
                  <title>{n.alt}</title>
                </image>
                <circle
                  cx={n.cx}
                  cy={n.cy}
                  r={n.r}
                  fill="none"
                  stroke={color}
                  strokeWidth="3.5"
                />
                {n.kind === "class" ? (
                  <circle cx={badge.x} cy={badge.y} r={8} fill={color} />
                ) : (
                  <rect
                    x={badge.x - 7}
                    y={badge.y - 7}
                    width={14}
                    height={14}
                    fill={color}
                    transform={`rotate(45 ${badge.x} ${badge.y})`}
                  />
                )}
                <text
                  x={n.labelX}
                  y={n.labelY}
                  textAnchor={n.anchor}
                  className={`fill-foreground text-[13px] ${predicate}`}
                >
                  {n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="mt-2 text-sm text-muted-foreground leading-relaxed">
        The same graph seen through the ontology, in the colour convention
        of the Protégé editor: gold rings with a round badge are classes (
        <span className="font-mono text-xs">owl:Class</span>), purple rings
        with a diamond badge are named individuals. Place types such as{" "}
        <span className="font-mono text-xs">lo:City</span> and{" "}
        <span className="font-mono text-xs">lo:Island</span> are subclasses
        of <span className="font-mono text-xs">lo:Place</span>; individuals
        are typed by <span className="font-mono text-xs">rdf:type</span> and
        joined by object properties like{" "}
        <span className="font-mono text-xs">lo:bornIn</span> and{" "}
        <span className="font-mono text-xs">lo:livedIn</span>. Every arrow
        is a real triple: Zeno of Citium was born in Citium and lived in
        Athens; Melissus was born on Samos. The pictures inside the nodes
        are illustrative vignettes, not data.
      </figcaption>
    </figure>
  );
}
