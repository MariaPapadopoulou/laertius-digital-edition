/**
 * A static diagram of the RDF model behind the published graph: one real
 * subject-predicate-object triple at the centre, onward triples to the
 * right, owl:sameAs links out to external datasets (dashed rings), and a
 * literal value terminating a branch. Every arrow shown is a real triple:
 * each can be looked up in /api/lod/graph.ttl.
 */
export function KgModelDiagram() {
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
          viewBox="0 0 880 620"
          role="img"
          aria-labelledby="kg-model-diagram-title"
          className="mx-auto h-auto w-full min-w-[640px] max-w-[880px] text-muted-foreground"
        >
          <title id="kg-model-diagram-title">
            The triple model of the graph: subject and object nodes joined
            by labelled predicates, external datasets in dashed rings, and
            a literal value ending a branch.
          </title>
          <defs>
            <marker
              id="kg-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          </defs>

          {/* --- Central pair: one cited triple of this edition --- */}
          <rect
            x="222"
            y="222"
            width="424"
            height="104"
            className="fill-secondary/60"
          />
          <text
            x="642"
            y="214"
            textAnchor="end"
            className="fill-muted-foreground text-[10px] font-semibold uppercase tracking-wider"
          >
            this edition&rsquo;s graph
          </text>

          <ellipse
            cx="320"
            cy="274"
            rx="86"
            ry="28"
            className="fill-card stroke-foreground/60"
            strokeWidth="1.5"
          />
          <text
            x="320"
            y="279"
            textAnchor="middle"
            className="fill-foreground font-serif text-[15px]"
          >
            Zeno of Citium
          </text>

          <ellipse
            cx="552"
            cy="274"
            rx="86"
            ry="28"
            className="fill-card stroke-foreground/60"
            strokeWidth="1.5"
          />
          <text
            x="552"
            y="279"
            textAnchor="middle"
            className="fill-foreground font-serif text-[15px]"
          >
            Crates of Thebes
          </text>

          {/* Zeno -> Crates : lo:studentOf */}
          <path
            d="M 406 268 C 426 258, 446 258, 464 267"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            markerEnd="url(#kg-arrow)"
          />
          <text
            x="436"
            y="243"
            textAnchor="middle"
            className={`fill-foreground text-[11.5px] ${predicate}`}
          >
            lo:studentOf
          </text>
          <text
            x="436"
            y="257"
            textAnchor="middle"
            className="fill-muted-foreground text-[10px]"
          >
            D.L. 7.2
          </text>

          {/* --- Wikidata dataset (dashed ring), top left --- */}
          <ellipse
            cx="150"
            cy="100"
            rx="132"
            ry="78"
            fill="none"
            className="stroke-primary/60"
            strokeDasharray="6 5"
            strokeWidth="1.2"
          />
          <text
            x="150"
            y="54"
            textAnchor="middle"
            className="fill-primary text-[13px] font-semibold"
          >
            Wikidata
          </text>
          <ellipse
            cx="150"
            cy="122"
            rx="68"
            ry="23"
            className="fill-card stroke-foreground/60"
            strokeWidth="1.5"
          />
          <text
            x="150"
            y="127"
            textAnchor="middle"
            className={`fill-foreground text-[12px] ${predicate}`}
          >
            wd:Q171303
          </text>

          {/* Zeno -> wd:Q171303 : owl:sameAs */}
          <path
            d="M 268 253 C 212 226, 196 192, 203 148"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            markerEnd="url(#kg-arrow)"
          />
          <text
            x="222"
            y="200"
            textAnchor="start"
            className={`fill-foreground text-[11.5px] ${predicate}`}
          >
            owl:sameAs
          </text>

          {/* --- Onward triples, right side --- */}
          <ellipse
            cx="762"
            cy="158"
            rx="80"
            ry="26"
            className="fill-card stroke-foreground/60"
            strokeWidth="1.5"
          />
          <text
            x="762"
            y="156"
            textAnchor="middle"
            className="fill-foreground font-serif text-[15px]"
          >
            Cynic
          </text>
          <text
            x="762"
            y="171"
            textAnchor="middle"
            className="fill-muted-foreground text-[10px]"
          >
            (school)
          </text>

          {/* Crates -> Cynic school : lo:memberOf */}
          <path
            d="M 614 256 C 662 234, 682 210, 702 180"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            markerEnd="url(#kg-arrow)"
          />
          <text
            x="698"
            y="228"
            textAnchor="middle"
            className={`fill-foreground text-[11.5px] ${predicate}`}
          >
            lo:memberOf
          </text>

          <ellipse
            cx="766"
            cy="390"
            rx="64"
            ry="26"
            className="fill-card stroke-foreground/60"
            strokeWidth="1.5"
          />
          <text
            x="766"
            y="395"
            textAnchor="middle"
            className="fill-foreground font-serif text-[15px]"
          >
            Metrocles
          </text>

          {/* Crates -> Metrocles : lo:teacherOf */}
          <path
            d="M 610 292 C 660 316, 686 342, 712 372"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            markerEnd="url(#kg-arrow)"
          />
          <text
            x="692"
            y="322"
            textAnchor="middle"
            className={`fill-foreground text-[11.5px] ${predicate}`}
          >
            lo:teacherOf
          </text>

          {/* --- Place branch down to Pleiades --- */}
          <ellipse
            cx="300"
            cy="452"
            rx="52"
            ry="24"
            className="fill-card stroke-foreground/60"
            strokeWidth="1.5"
          />
          <text
            x="300"
            y="457"
            textAnchor="middle"
            className="fill-foreground font-serif text-[15px]"
          >
            Citium
          </text>

          {/* Zeno -> Citium : lo:bornIn */}
          <path
            d="M 310 303 C 296 344, 293 388, 298 425"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            markerEnd="url(#kg-arrow)"
          />
          <text
            x="286"
            y="372"
            textAnchor="end"
            className={`fill-foreground text-[11.5px] ${predicate}`}
          >
            lo:bornIn
          </text>

          {/* --- Pleiades dataset (dashed ring), bottom left --- */}
          <ellipse
            cx="130"
            cy="545"
            rx="122"
            ry="62"
            fill="none"
            className="stroke-primary/60"
            strokeDasharray="6 5"
            strokeWidth="1.2"
          />
          <text
            x="130"
            y="512"
            textAnchor="middle"
            className="fill-primary text-[13px] font-semibold"
          >
            Pleiades
          </text>
          <ellipse
            cx="130"
            cy="558"
            rx="82"
            ry="22"
            className="fill-card stroke-foreground/60"
            strokeWidth="1.5"
          />
          <text
            x="130"
            y="563"
            textAnchor="middle"
            className={`fill-foreground text-[11.5px] ${predicate}`}
          >
            pleiades:707534
          </text>

          {/* Citium -> pleiades:707534 : owl:sameAs */}
          <path
            d="M 262 468 C 226 492, 204 512, 184 536"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            markerEnd="url(#kg-arrow)"
          />
          <text
            x="238"
            y="510"
            textAnchor="start"
            className={`fill-foreground text-[11.5px] ${predicate}`}
          >
            owl:sameAs
          </text>

          {/* --- Literal branch --- */}
          <rect
            x="462"
            y="432"
            width="200"
            height="42"
            rx="4"
            className="fill-card stroke-foreground/60"
            strokeWidth="1.5"
          />
          <text
            x="562"
            y="458"
            textAnchor="middle"
            className={`fill-foreground text-[12px] ${predicate}`}
          >
            &quot;Zeno of Citium&quot;@en
          </text>

          {/* Zeno -> literal : rdfs:label */}
          <path
            d="M 372 299 C 420 350, 458 388, 496 428"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            markerEnd="url(#kg-arrow)"
          />
          <text
            x="408"
            y="372"
            textAnchor="start"
            className={`fill-foreground text-[11.5px] ${predicate}`}
          >
            rdfs:label
          </text>

          {/* Footnote, reference style */}
          <text
            x="400"
            y="540"
            className="fill-muted-foreground text-[11.5px] italic"
          >
            A literal value (a string, number, or date) ends the graph there:
          </text>
          <text
            x="400"
            y="557"
            className="fill-muted-foreground text-[11.5px] italic"
          >
            it is drawn as a box and can have no properties of its own.
          </text>
          <text
            x="400"
            y="586"
            className="fill-muted-foreground text-[11.5px]"
          >
            Dashed rings are external datasets reached by owl:sameAs; every
          </text>
          <text
            x="400"
            y="603"
            className="fill-muted-foreground text-[11.5px]"
          >
            arrow is a triple that can be looked up in graph.ttl.
          </text>
        </svg>
      </div>
      <figcaption className="mt-2 text-sm text-muted-foreground leading-relaxed">
        The structure of the published graph, illustrated with real triples. At the
        centre, one cited edge of the knowledge graph:{" "}
        <span className="font-mono text-xs">lo:studentOf</span> joining two
        philosopher nodes, from D.L. 7.2. Nodes carry onward triples (school
        membership, pupils, birthplace), plain-text literals such as the{" "}
        <span className="font-mono text-xs">rdfs:label</span>, and{" "}
        <span className="font-mono text-xs">owl:sameAs</span> links into
        external datasets: Wikidata for persons, the Pleiades gazetteer for
        places. Hedged reports are not drawn as direct edges like these; they
        become attributed <span className="font-mono text-xs">lo:Claim</span>{" "}
        nodes citing their source. Every arrow is a triple you can look up
        in the graph exports on the Statistics page.
      </figcaption>
    </figure>
  );
}
