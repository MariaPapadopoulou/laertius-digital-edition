/**
 * Data behind the About page's interactive Assertion-model diagram
 * (assertion-model-diagram.tsx): concept cards, their relation/attribute
 * rows, and the arrows between them. Kept in a plain module (no JSX) so
 * the validate-assertion-diagram script can import it and cross-check the
 * ids and relation names against the OTB inventory (the reference model).
 */

export interface RowDef {
  id: string;
  name: string;
  type: string;
  /** Dotted underline (attribute with a literal value) vs solid (relation). */
  attr?: boolean;
  /** Concept cards this row refers to (highlighted even without an arrow). */
  targets?: string[];
}

export interface CardDef {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  /** x offset of the type column within the card. */
  typeCol?: number;
  rows?: RowDef[];
  /** App route this card navigates to (click / Enter). */
  href?: string;
}

export type ArrowKind = "ref" | "sub";

export interface ArrowDef {
  id: string;
  kind: ArrowKind;
  /** Source element: a card id or a row id (`card.row`). */
  from: string;
  to: string;
  d: string;
}

export const HEADER_H = 30;
export const ROW_H = 23;

export function cardH(rowCount: number): number {
  return HEADER_H + rowCount * ROW_H + 7;
}

export const CARDS: CardDef[] = [
  {
    id: "assertion",
    x: 40,
    y: 42,
    w: 300,
    h: cardH(5),
    title: "<Assertion>",
    typeCol: 130,
    rows: [
      { id: "assertion.assertedBy", name: "assertedBy", type: "aPerson", targets: ["person"] },
      { id: "assertion.assertedIn", name: "assertedIn", type: "aDocument", targets: ["document"] },
      { id: "assertion.hasTopic", name: "hasTopic", type: "aTopic", targets: ["topic"] },
      {
        id: "assertion.hasContent",
        name: "hasContent",
        type: "aText | anAssertion",
        targets: ["text", "assertion"],
      },
      {
        id: "assertion.confidence",
        name: "confidence",
        type: "\u2208 { low, medium, high }",
        attr: true,
        targets: ["value"],
      },
    ],
  },
  { id: "person", x: 700, y: 44, w: 166, h: 36, title: "<Person>" },
  {
    id: "philosopher",
    href: "/browse",
    x: 552,
    y: 140,
    w: 300,
    h: cardH(4),
    title: "<Philosopher>",
    typeCol: 136,
    rows: [
      { id: "philosopher.influencedBy", name: "influencedBy", type: "aPhilosopher" },
      { id: "philosopher.isFounderOf", name: "isFounderOf", type: "aPhilosophicalSchool" },
      { id: "philosopher.isMemberOf", name: "isMemberOf", type: "aPhilosophicalSchool" },
      { id: "philosopher.isTeacherPupilOf", name: "isTeacher/PupilOf", type: "aPhilosopher" },
    ],
  },
  { id: "nonphilosopher", x: 864, y: 140, w: 126, h: 36, title: "<NonPhilosopher>" },
  {
    id: "document",
    x: 40,
    y: 308,
    w: 250,
    h: cardH(2),
    title: "<Document>",
    typeCol: 118,
    rows: [
      { id: "document.isRelatedTo", name: "isRelatedTo", type: "aPerson", targets: ["person"] },
      { id: "document.hasContent", name: "hasContent", type: "aText", targets: ["text"] },
    ],
  },
  { id: "anecdote", href: "/anecdotes", x: 26, y: 470, w: 112, h: 34, title: "<Anecdote>" },
  { id: "doxa", href: "/doxography", x: 152, y: 470, w: 84, h: 34, title: "<Doxa>" },
  { id: "letter", href: "/letters", x: 250, y: 470, w: 88, h: 34, title: "<Letter>" },
  { id: "testament", href: "/testaments", x: 352, y: 470, w: 118, h: 34, title: "<Testament>" },
  // Topic subtypes: only the reference-model children are drawn. The
  // inventory's TopicSoul and TopicKnowledge are extension concepts
  // (`extension: true` — our doctrinal additions beyond the curator's
  // reference export), so they are deliberately left off the diagram, like
  // the other extension concepts (e.g. Saying under Document). They are
  // allowlisted in validate-assertion-diagram.ts (OMITTED_SUBTYPES).
  { id: "topic", x: 490, y: 430, w: 104, h: 36, title: "<Topic>" },
  { id: "birth", x: 452, y: 540, w: 86, h: 34, title: "<Birth>" },
  { id: "death", x: 562, y: 540, w: 90, h: 34, title: "<Death>" },
  {
    id: "text",
    x: 700,
    y: 330,
    w: 264,
    h: cardH(2),
    title: "<Text>",
    typeCol: 72,
    rows: [
      { id: "text.text", name: "text", type: "\u201C\u2026\u201D", attr: true },
      { id: "text.cts", name: "cts", type: "URL https://\u2026", attr: true },
    ],
  },
  {
    id: "value",
    x: 700,
    y: 458,
    w: 264,
    h: cardH(3),
    title: "<Value>",
    typeCol: 108,
    rows: [
      { id: "value.beginDate", name: "beginDate", type: "value", attr: true },
      { id: "value.endDate", name: "endDate", type: "value", attr: true },
      { id: "value.confidence", name: "confidence", type: "value", attr: true },
    ],
  },
];

export const ARROWS: ArrowDef[] = [
  // Reference arrows: an Assertion attribute row points at the concept
  // whose instances fill it.
  {
    id: "r-assertedBy",
    kind: "ref",
    from: "assertion.assertedBy",
    to: "person",
    d: "M 340 84 C 470 62, 590 48, 695 58",
  },
  {
    id: "r-assertedIn",
    kind: "ref",
    from: "assertion.assertedIn",
    to: "document",
    d: "M 40 107 C 4 165, 34 258, 106 303",
  },
  {
    id: "r-hasTopic",
    kind: "ref",
    from: "assertion.hasTopic",
    to: "topic",
    d: "M 210 194 C 296 282, 408 388, 512 426",
  },
  {
    id: "r-hasContent",
    kind: "ref",
    from: "assertion.hasContent",
    to: "text",
    d: "M 340 153 C 468 300, 578 336, 695 366",
  },
  {
    // hasContent may also point at another assertion: a short loop back
    // into the Assertion card itself.
    id: "r-hasContent-self",
    kind: "ref",
    from: "assertion.hasContent",
    to: "assertion",
    d: "M 340 153 C 396 176, 366 236, 302 196",
  },
  {
    id: "r-confidence",
    kind: "ref",
    from: "assertion.confidence",
    to: "value",
    d: "M 258 194 C 398 330, 560 404, 695 492",
  },
  // Subtype arrows: a concept branches into its kinds.
  { id: "s-phil", kind: "sub", from: "person", to: "philosopher", d: "M 745 80 C 727 99, 710 118, 695 137" },
  {
    id: "s-nonphil",
    kind: "sub",
    from: "person",
    to: "nonphilosopher",
    d: "M 833 80 C 863 98, 896 117, 922 137",
  },
  { id: "s-anecdote", kind: "sub", from: "document", to: "anecdote", d: "M 90 391 C 88 417, 85 441, 83 467" },
  { id: "s-doxa", kind: "sub", from: "document", to: "doxa", d: "M 150 391 C 164 417, 178 441, 191 467" },
  { id: "s-letter", kind: "sub", from: "document", to: "letter", d: "M 210 391 C 238 417, 266 441, 290 467" },
  {
    id: "s-testament",
    kind: "sub",
    from: "document",
    to: "testament",
    d: "M 264 391 C 312 417, 362 441, 405 467",
  },
  { id: "s-birth", kind: "sub", from: "topic", to: "birth", d: "M 527 466 C 517 489, 507 512, 498 537" },
  { id: "s-death", kind: "sub", from: "topic", to: "death", d: "M 557 466 C 573 489, 590 512, 604 537" },
];
