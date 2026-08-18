/**
 * An ontoterminology view of the domain of the Lives, drawn in the manner
 * of classical ontoterminology domain diagrams: concepts (boxes, labelled
 * in angle brackets) are built from a genus by specific differences (the
 * italic labels along the arrows), and the quoted Greek and English terms
 * designate them along the dashed links. The divisions are the ones
 * Diogenes himself draws: the sages of the age of the Seven versus the
 * philosophers after Pythagoras coined the word (1.12), the Ionian and
 * Italian successions (1.13), and the schools within them (the Sceptic
 * branch reaches the Italian line through the Democritean chain from
 * Anaxarchus to Pyrrho, 9.61). Every quoted Greek term is used by
 * Diogenes in the text.
 */

const CONCEPT_BOX = "fill-primary/5 stroke-primary/50";
const CONCEPT_TEXT = "fill-foreground font-serif text-[13.5px]";
const DIFF_TEXT = "fill-muted-foreground font-serif italic text-[11px]";
const TERM_GRC = "fill-primary font-serif text-[14px]";
const TERM_EN = "fill-primary font-serif italic text-[12px]";
const DESIGNATES = "fill-muted-foreground font-mono text-[9.5px]";

interface School {
  x: number;
  cx: number;
  line1: string;
  line2: string;
  grc: string;
  en: string;
}

const SCHOOLS: School[] = [
  {
    x: 40,
    cx: 147,
    line1: "<Ionian philosopher",
    line2: "teaching in the Porch>",
    grc: "\u201C\u03A3\u03C4\u03C9\u03CA\u03BA\u03CC\u03C2\u201D",
    en: "\u201CStoic\u201D",
  },
  {
    x: 285,
    cx: 392,
    line1: "<Ionian philosopher",
    line2: "teaching in the Academy>",
    grc: "\u201C\u1F08\u03BA\u03B1\u03B4\u03B7\u03BC\u03B1\u03CA\u03BA\u03CC\u03C2\u201D",
    en: "\u201CAcademic\u201D",
  },
  {
    x: 540,
    cx: 647,
    line1: "<Italian philosopher",
    line2: "suspending judgement>",
    grc: "\u201C\u03A3\u03BA\u03B5\u03C0\u03C4\u03B9\u03BA\u03CC\u03C2\u201D",
    en: "\u201CSceptic\u201D",
  },
  {
    x: 780,
    cx: 887,
    line1: "<Italian philosopher taking",
    line2: "pleasure as the end>",
    grc: "\u201C\u1F18\u03C0\u03B9\u03BA\u03BF\u03CD\u03C1\u03B5\u03B9\u03BF\u03C2\u201D",
    en: "\u201CEpicurean\u201D",
  },
];

export function OtvDiagram() {
  return (
    <figure className="my-6" id="otv-domain">
      <div
        className="overflow-x-auto rounded-md border border-card-border bg-card/50 p-4"
        tabIndex={0}
        role="region"
        aria-label="Scrollable diagram"
      >
        <svg
          viewBox="0 0 1000 615"
          role="img"
          aria-labelledby="otv-diagram-title"
          className="mx-auto h-auto w-full min-w-[720px] max-w-[1000px] text-muted-foreground"
        >
          <title id="otv-diagram-title">
            The domain of the Lives as an ontoterminology: a tree of concepts
            built by specific differences, with the Greek and English terms
            that designate them attached by dashed links.
          </title>
          <defs>
            <marker
              id="otv-arrow"
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

          {/* Legend, top left */}
          <text x="28" y="30" className="fill-muted-foreground text-[10.5px]">
            &lt;concept&gt; defined by its differences
          </text>
          <text
            x="28"
            y="47"
            className="fill-muted-foreground font-serif italic text-[10.5px]"
          >
            /specific difference/
          </text>
          <text x="28" y="64" className={`${TERM_EN} text-[10.5px]`}>
            &ldquo;term&rdquo; on a dashed designates link
          </text>

          {/* Root: virtual concept, no term of its own */}
          <rect
            x="380"
            y="22"
            width="240"
            height="44"
            rx="8"
            className={CONCEPT_BOX}
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
          <text
            x="500"
            y="49"
            textAnchor="middle"
            className="fill-foreground font-serif text-[15px]"
          >
            &lt;Seeker of wisdom&gt;
          </text>
          <text
            x="640"
            y="38"
            className="fill-muted-foreground text-[10px]"
          >
            a virtual concept:
          </text>
          <text
            x="640"
            y="52"
            className="fill-muted-foreground text-[10px]"
          >
            the text has no single term for it
          </text>

          {/* Level 1: sage and philosopher */}
          <rect
            x="80"
            y="140"
            width="290"
            height="58"
            rx="8"
            className={CONCEPT_BOX}
            strokeWidth="1.5"
          />
          <text x="225" y="164" textAnchor="middle" className={CONCEPT_TEXT}>
            &lt;Seeker of wisdom reputed
          </text>
          <text x="225" y="184" textAnchor="middle" className={CONCEPT_TEXT}>
            wise in the age of the Seven&gt;
          </text>

          <rect
            x="555"
            y="140"
            width="310"
            height="58"
            rx="8"
            className={CONCEPT_BOX}
            strokeWidth="1.5"
          />
          <text x="710" y="164" textAnchor="middle" className={CONCEPT_TEXT}>
            &lt;Seeker of wisdom professing
          </text>
          <text x="710" y="184" textAnchor="middle" className={CONCEPT_TEXT}>
            love of wisdom&gt;
          </text>

          {/* Level 1 edges up to the root */}
          <path
            d="M 225 140 L 440 68"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            markerEnd="url(#otv-arrow)"
          />
          <text x="345" y="98" textAnchor="end" className={DIFF_TEXT}>
            /reputed wise in the age of the Seven/
          </text>
          <path
            d="M 710 140 L 565 68"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            markerEnd="url(#otv-arrow)"
          />
          <text x="655" y="98" className={DIFF_TEXT}>
            /professing love of wisdom/
          </text>

          {/* Sage terms, below the sage box */}
          <path
            d="M 225 240 L 225 202"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeDasharray="4 4"
            markerEnd="url(#otv-arrow)"
          />
          <text x="233" y="226" className={DESIGNATES}>
            designates
          </text>
          <text x="225" y="262" textAnchor="middle" className={TERM_GRC} lang="grc">
            &ldquo;&sigma;&omicron;&phi;ό&sigmaf;&rdquo;
          </text>
          <text x="225" y="280" textAnchor="middle" className={TERM_EN}>
            &ldquo;sage&rdquo;
          </text>

          {/* Philosopher terms, to the right of the box */}
          <path
            d="M 902 168 L 869 168"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeDasharray="4 4"
            markerEnd="url(#otv-arrow)"
          />
          <text x="935" y="158" textAnchor="middle" className={TERM_GRC} lang="grc">
            &ldquo;&phi;&iota;&lambda;ό&sigma;&omicron;&phi;&omicron;&sigmaf;&rdquo;
          </text>
          <text x="935" y="177" textAnchor="middle" className={TERM_EN}>
            &ldquo;philosopher&rdquo;
          </text>
          <text x="885" y="188" textAnchor="middle" className={DESIGNATES}>
            designates
          </text>

          {/* Level 2: the two successions */}
          <rect
            x="380"
            y="300"
            width="250"
            height="58"
            rx="8"
            className={CONCEPT_BOX}
            strokeWidth="1.5"
          />
          <text x="505" y="324" textAnchor="middle" className={CONCEPT_TEXT}>
            &lt;Philosopher in the
          </text>
          <text x="505" y="344" textAnchor="middle" className={CONCEPT_TEXT}>
            succession from Thales&gt;
          </text>

          <rect
            x="680"
            y="300"
            width="260"
            height="58"
            rx="8"
            className={CONCEPT_BOX}
            strokeWidth="1.5"
          />
          <text x="810" y="324" textAnchor="middle" className={CONCEPT_TEXT}>
            &lt;Philosopher in the
          </text>
          <text x="810" y="344" textAnchor="middle" className={CONCEPT_TEXT}>
            succession from Pythagoras&gt;
          </text>

          {/* Level 2 edges up to the philosopher */}
          <path
            d="M 505 300 L 637 202"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            markerEnd="url(#otv-arrow)"
          />
          <text x="560" y="248" textAnchor="end" className={DIFF_TEXT}>
            /in the succession from Thales/
          </text>
          <path
            d="M 810 300 L 783 202"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            markerEnd="url(#otv-arrow)"
          />
          <text x="795" y="258" textAnchor="end" className={DIFF_TEXT}>
            /in the succession from Pythagoras/
          </text>

          {/* Ionian terms, left of the box */}
          <path
            d="M 352 330 L 376 330"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeDasharray="4 4"
            markerEnd="url(#otv-arrow)"
          />
          <text x="315" y="325" textAnchor="middle" className={TERM_GRC} lang="grc">
            &ldquo;&#x1F38;&omega;&nu;&iota;&kappa;ή&rdquo;
          </text>
          <text x="315" y="343" textAnchor="middle" className={TERM_EN}>
            &ldquo;Ionian&rdquo;
          </text>

          {/* Italian terms, above right */}
          <path
            d="M 968 288 L 938 302"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeDasharray="4 4"
            markerEnd="url(#otv-arrow)"
          />
          <text x="968" y="262" textAnchor="middle" className={TERM_GRC} lang="grc">
            &ldquo;&#x1F38;&tau;&alpha;&lambda;&iota;&kappa;ή&rdquo;
          </text>
          <text x="968" y="280" textAnchor="middle" className={TERM_EN}>
            &ldquo;Italian&rdquo;
          </text>

          {/* Level 3: the schools */}
          {SCHOOLS.map((s) => (
            <g key={s.en}>
              <rect
                x={s.x}
                y="440"
                width="215"
                height="58"
                rx="8"
                className={CONCEPT_BOX}
                strokeWidth="1.5"
              />
              <text
                x={s.cx}
                y="464"
                textAnchor="middle"
                className={CONCEPT_TEXT}
              >
                {s.line1}
              </text>
              <text
                x={s.cx}
                y="484"
                textAnchor="middle"
                className={CONCEPT_TEXT}
              >
                {s.line2}
              </text>
              <path
                d={`M ${s.cx} 545 L ${s.cx} 502`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeDasharray="4 4"
                markerEnd="url(#otv-arrow)"
              />
              <text
                x={s.cx}
                y="567"
                textAnchor="middle"
                className={TERM_GRC}
                lang="grc"
              >
                {s.grc}
              </text>
              <text x={s.cx} y="586" textAnchor="middle" className={TERM_EN}>
                {s.en}
              </text>
            </g>
          ))}
          <text x="155" y="528" className={DESIGNATES}>
            designates
          </text>

          {/* Level 3 edges up to the successions */}
          <path
            d="M 147 440 L 436 362"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            markerEnd="url(#otv-arrow)"
          />
          <text x="280" y="395" textAnchor="end" className={DIFF_TEXT}>
            /teaching in the Porch/
          </text>
          <path
            d="M 392 440 L 566 362"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            markerEnd="url(#otv-arrow)"
          />
          <text x="470" y="414" className={DIFF_TEXT}>
            /teaching in the Academy/
          </text>
          <path
            d="M 647 440 L 747 362"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            markerEnd="url(#otv-arrow)"
          />
          <text x="690" y="395" textAnchor="end" className={DIFF_TEXT}>
            /suspending judgement/
          </text>
          <path
            d="M 887 440 L 868 362"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            markerEnd="url(#otv-arrow)"
          />
          <text x="860" y="380" textAnchor="end" className={DIFF_TEXT}>
            /taking pleasure as the end/
          </text>
        </svg>
      </div>
      <figcaption className="mt-2 text-sm text-muted-foreground leading-relaxed">
        The domain of the <em>Lives</em> read as an ontoterminology, following
        divisions Diogenes himself draws. Each concept (box) is built from
        its parent by a specific difference (the italic label on the arrow):
        the sages reputed wise in the age of the Seven against the
        philosophers after Pythagoras coined the word (1.12), the Ionian
        succession from Thales and the Italian from Pythagoras (1.13), and
        within them the schools, named from their regular meeting places (Academy, Stoa),
        from their teacher (Epicureans), or from their suspension of
        judgement (Sceptics; 1.16&ndash;17). The Sceptics stand on the
        Italian side through the Democritean line that leads through
        Anaxarchus to Pyrrho (9.61). The quoted Greek and English terms
        designate the concepts along the dashed links; each Greek term is
        Diogenes&rsquo; own. The dashed box is a virtual concept: the text
        never names it with a term of its own.
      </figcaption>
    </figure>
  );
}
