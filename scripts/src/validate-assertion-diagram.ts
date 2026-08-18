/**
 * Keeps the About page's interactive Assertion-model diagram in sync with
 * the reference model (the OTB inventory).
 *
 * The diagram hand-encodes the reference schema in a data module
 * (assertion-model-data.ts): card ids, row names/types, and arrow
 * endpoints are plain strings. Two silent-failure modes are guarded:
 *
 *   1. Wiring: every arrow `from`/`to` and every row `targets` entry must
 *      refer to a declared card/row id; a typo would make hover
 *      highlighting silently skip that connection. Ref arrows must start
 *      at a row whose `targets` include the arrow's destination card.
 *   2. Drift: the Assertion/Document relation and attribute rows shown in
 *      the diagram must still match the relations the OTB inventory names
 *      for those concepts (assertedBy, assertedIn, hasTopic, hasContent,
 *      confidence, isRelatedTo), with the ranges the inventory declares.
 *      The subtype branches (Person/Document/Topic children) must still
 *      match the inventory's isA tree, modulo an explicit allowlist of
 *      concepts the drawing deliberately omits or that exist only in the
 *      curator's reference export.
 *
 * Prints positive counts of what it verified; a run that checks nothing
 * fails.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-assertion-diagram
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CARDS, ARROWS, HEADER_H, ROW_H } from "../../artifacts/laertius/src/components/assertion-model-data";
import { CONCEPTS, RELATIONS, ATTRIBUTES } from "../../artifacts/api-server/src/lib/otb/inventory";

let failures = 0;
function check(cond: boolean, msg: string): void {
  if (!cond) {
    failures += 1;
    console.error(`FAIL: ${msg}`);
  }
}

/**
 * Diagram card id -> OTB inventory concept id. `null` marks cards the
 * inventory does not model as concepts: NonPhilosopher exists only in the
 * curator's reference export, and Value is the diagram's bucket for
 * literal attribute values. Every card must appear here so a new card
 * cannot ship unmapped.
 */
const CARD_CONCEPT: Record<string, string | null> = {
  assertion: "Assertion",
  person: "Person",
  philosopher: "Philosopher",
  nonphilosopher: null,
  document: "Document",
  anecdote: "Anecdotes",
  doxa: "Opinions",
  letter: "Epistle",
  testament: "Testament",
  topic: "Topic",
  birth: "TopicBirth",
  death: "TopicDeath",
  text: "Text",
  value: null,
};

/**
 * Inventory concepts the diagram deliberately leaves out of its subtype
 * branches, to keep the drawing legible. If the inventory gains a new
 * child of Person/Document/Topic that is neither drawn nor listed here,
 * the drift check fails and the diagram (or this list) must be updated.
 */
/**
 * OMITTED_SUBTYPES entries whose recorded justification is "extension
 * beyond the reference inventory". The diagram draws the reference model
 * only, so extension concepts are legitimately absent — but ONLY while
 * they stay extensions. If one is promoted into the reference export
 * (extension flag dropped in the OTB inventory), the justification is
 * stale and the drawing decision must be revisited; the check below fails
 * in that case instead of silently keeping the concept hidden.
 */
const OMITTED_AS_EXTENSION = new Set([
  "Saying",
  "TopicSoul",
  "TopicKnowledge",
  // The doctrinal topic battery added for the doxai (arche, telos, hedone
  // etc.) — all our extensions beyond the reference export, omitted on the
  // same grounds.
  "TopicFirstPrinciple",
  "TopicNature",
  "TopicCosmos",
  "TopicPleasure",
  "TopicGod",
  "TopicFate",
  "TopicReason",
]);

const OMITTED_SUBTYPES: Record<string, string[]> = {
  Person: [],
  Document: [
    "Verse", // and its child Epigram, drawn as neither box
    "Saying", // extension beyond the reference inventory
    "CitedSource",
  ],
  Topic: [
    "TopicMannerOfDeath", // reference concept, but a third Death-adjacent box adds clutter without new structure
    // Deliberate decision (not an oversight): TopicSoul and TopicKnowledge are
    // `extension: true` in the inventory — our doctrinal additions beyond the
    // curator's reference export. The diagram draws the reference model only
    // (extension concepts like Saying are omitted on the same grounds), so
    // these stay off the drawing. If either is ever promoted into the
    // reference export (extension flag dropped), draw it then.
    "TopicSoul",
    "TopicKnowledge",
    // Same rationale for the doctrinal topic battery (arche, telos, hedone
    // etc.) added for the doxai — all `extension: true`.
    "TopicFirstPrinciple",
    "TopicNature",
    "TopicCosmos",
    "TopicPleasure",
    "TopicGod",
    "TopicFate",
    "TopicReason",
  ],
};

/**
 * Relations the diagram deliberately does not draw on a card even though
 * the inventory's domain includes that card's concept, because that domain
 * membership is our widening beyond the reference export (the reference
 * restricts hasTopic to Assertion; we widened it so doxai can point at
 * their doctrinal subject — see the note in inventory.ts). The diagram
 * draws the reference model, so the widened leg stays off the drawing.
 *
 * Each entry is cross-checked below against the inventory's machine-readable
 * `widenedDomain` marker: the exemption is valid only while the inventory
 * still records that domain member as our widening. If the marker is dropped
 * (the reference adopts the widened domain, or the widening is reverted),
 * the check fails and the drawing decision must be revisited.
 */
const UNDRAWN_WIDENED_DOMAINS: Record<string, string[]> = {
  document: ["hasTopic"],
};

// ------------------------------------------------------------ id wiring
const cardIds = new Set<string>();
const rowIds = new Set<string>();
for (const c of CARDS) {
  check(!cardIds.has(c.id), `duplicate card id ${c.id}`);
  cardIds.add(c.id);
  for (const r of c.rows ?? []) {
    check(!rowIds.has(r.id), `duplicate row id ${r.id}`);
    rowIds.add(r.id);
    check(
      r.id === `${c.id}.${r.id.split(".").slice(1).join(".")}` && r.id.startsWith(`${c.id}.`),
      `row id ${r.id} is not scoped under its card ${c.id}`,
    );
  }
}
check(!new Set([...cardIds]).size || [...rowIds].every((r) => !cardIds.has(r)), "row id collides with a card id");

const isDeclared = (id: string) => cardIds.has(id) || rowIds.has(id);

let arrowEndpoints = 0;
const arrowIds = new Set<string>();
const rowById = new Map(CARDS.flatMap((c) => (c.rows ?? []).map((r) => [r.id, r] as const)));
for (const a of ARROWS) {
  check(!arrowIds.has(a.id), `duplicate arrow id ${a.id}`);
  arrowIds.add(a.id);
  check(isDeclared(a.from), `arrow ${a.id}: from "${a.from}" is not a declared card/row id`);
  check(cardIds.has(a.to), `arrow ${a.id}: to "${a.to}" is not a declared card id`);
  arrowEndpoints += 2;
  if (a.kind === "ref") {
    const row = rowById.get(a.from);
    check(!!row, `ref arrow ${a.id} must start at a row, got "${a.from}"`);
    if (row) {
      check(
        (row.targets ?? []).includes(a.to),
        `ref arrow ${a.id}: row ${row.id} targets [${row.targets ?? []}] do not include "${a.to}"`,
      );
    }
  } else {
    check(cardIds.has(a.from), `sub arrow ${a.id} must start at a card, got "${a.from}"`);
  }
}

let targetEntries = 0;
for (const c of CARDS) {
  for (const r of c.rows ?? []) {
    for (const t of r.targets ?? []) {
      targetEntries += 1;
      check(cardIds.has(t), `row ${r.id}: target "${t}" is not a declared card id`);
    }
  }
}

// ------------------------------------------------- arrow path geometry
// The `d` strings are hand-written; a moved card or a typo'd coordinate can
// draw an arrow to the wrong box while all id checks stay green. Parse each
// path's start/end point and assert it lies on (or within a small marker-gap
// tolerance of) the bounding box of the `from` element and the `to` card.
const GEOM_TOL = 8; // px: marker gap + hand-drawn slack

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 0 when the point is inside; otherwise distance to the nearest edge. */
function distToRect(px: number, py: number, r: Rect): number {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
  const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
  return Math.hypot(dx, dy);
}

const cardById = new Map(CARDS.map((c) => [c.id, c]));

/** Bounding box of a card, or the row band of a `card.row` id. */
function elementRect(id: string): { card: Rect; band?: Rect } | null {
  const card = cardById.get(id);
  if (card) return { card };
  const cardId = id.split(".")[0];
  const parent = cardById.get(cardId);
  if (!parent) return null;
  const idx = (parent.rows ?? []).findIndex((r) => r.id === id);
  if (idx < 0) return null;
  return {
    card: parent,
    band: { x: parent.x, y: parent.y + HEADER_H + idx * ROW_H, w: parent.w, h: ROW_H },
  };
}

function parsePathPoints(d: string): { start: [number, number]; end: [number, number] } | null {
  if (!/^M\s/.test(d)) return null;
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  if (nums.length < 4 || nums.length % 2 !== 0) return null;
  return { start: [nums[0], nums[1]], end: [nums[nums.length - 2], nums[nums.length - 1]] };
}

let geometryEndpoints = 0;
for (const a of ARROWS) {
  const pts = parsePathPoints(a.d);
  check(!!pts, `arrow ${a.id}: could not parse path "${a.d}" (expected absolute M ... with coordinate pairs)`);
  if (!pts) continue;

  // Start must touch the `from` element's card box; when it leaves through
  // the left/right edge of a card with rows, it must do so at the row's own
  // vertical band (an arrow drawn from the wrong row fails here).
  const fromEl = elementRect(a.from);
  check(!!fromEl, `arrow ${a.id}: from "${a.from}" has no geometry`);
  if (fromEl) {
    const [sx, sy] = pts.start;
    const dist = distToRect(sx, sy, fromEl.card);
    check(
      dist <= GEOM_TOL,
      `arrow ${a.id}: path starts at (${sx}, ${sy}), ${dist.toFixed(1)}px away from the box of "${a.from}"`,
    );
    if (dist <= GEOM_TOL) geometryEndpoints += 1;
    if (fromEl.band) {
      const onLeft = Math.abs(sx - fromEl.card.x) <= GEOM_TOL;
      const onRight = Math.abs(sx - (fromEl.card.x + fromEl.card.w)) <= GEOM_TOL;
      if (onLeft || onRight) {
        check(
          sy >= fromEl.band.y - GEOM_TOL && sy <= fromEl.band.y + fromEl.band.h + GEOM_TOL,
          `arrow ${a.id}: starts on the card edge at y=${sy}, outside the row band of ${a.from} ` +
            `(${fromEl.band.y}..${fromEl.band.y + fromEl.band.h})`,
        );
      }
    }
  }

  // End must land on (or just short of, for the marker gap) the `to` card.
  const toCard = cardById.get(a.to);
  check(!!toCard, `arrow ${a.id}: to "${a.to}" has no geometry`);
  if (toCard) {
    const [ex, ey] = pts.end;
    const dist = distToRect(ex, ey, toCard);
    check(
      dist <= GEOM_TOL,
      `arrow ${a.id}: path ends at (${ex}, ${ey}), ${dist.toFixed(1)}px away from the "${a.to}" box`,
    );
    if (dist <= GEOM_TOL) geometryEndpoints += 1;
  }
}

// ------------------------------------------- rendered geometry derivation
// The row-band checks above assume the component draws rows exactly at
// c.y + HEADER_H + i * ROW_H. If assertion-model-diagram.tsx ever replaced
// those constants with tweaked literals (a padding nudge in the JSX only),
// the validator's bands would silently drift from the rendered pixels. Pin
// the component source to the shared constants: it must import them and use
// the canonical expressions, with no numeric literal standing in for a row
// offset or row height.
let renderDerivationChecks = 0;
{
  const diagramPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../artifacts/laertius/src/components/assertion-model-diagram.tsx",
  );
  const src = readFileSync(diagramPath, "utf8");
  const derive = (cond: boolean, msg: string) => {
    renderDerivationChecks += 1;
    check(cond, `diagram render: ${msg}`);
  };

  derive(
    /import\s*\{[^}]*\bHEADER_H\b[^}]*\}\s*from\s*["']\.\/assertion-model-data["']/.test(src) &&
      /import\s*\{[^}]*\bROW_H\b[^}]*\}\s*from\s*["']\.\/assertion-model-data["']/.test(src),
    "assertion-model-diagram.tsx must import HEADER_H and ROW_H from assertion-model-data",
  );
  // The one canonical row y derivation the validator's elementRect() mirrors.
  derive(
    src.includes("c.y + HEADER_H + i * ROW_H"),
    "row y must be computed as `c.y + HEADER_H + i * ROW_H` (the expression the validator's row bands assume)",
  );
  // Row hit-band height must be the same ROW_H constant.
  derive(
    /height=\{ROW_H\}/.test(src),
    "row rect height must be `height={ROW_H}`, not a literal",
  );
  // Header divider and title centring must derive from HEADER_H too.
  derive(
    src.includes("c.y + HEADER_H - 0.5"),
    "header divider y must derive from HEADER_H (`c.y + HEADER_H - 0.5`)",
  );
  // No literal may stand in for the constants in vertical layout
  // expressions: `c.y + <number>`, `i * <number>`, or a numeric row-rect
  // height would mean the JSX drifted from the shared constants.
  const literalOffsets = src.match(/c\.y\s*\+\s*\d/g) ?? [];
  derive(
    literalOffsets.length === 0,
    `found literal offsets added to c.y (${literalOffsets.join(", ")}); use HEADER_H/ROW_H`,
  );
  const literalRowSteps = src.match(/i\s*\*\s*\d/g) ?? [];
  derive(
    literalRowSteps.length === 0,
    `found literal per-row steps (${literalRowSteps.join(", ")}); use ROW_H`,
  );
  const literalRectHeights = src.match(/height=\{\s*\d/g) ?? [];
  derive(
    literalRectHeights.length === 0,
    "found a numeric rect height in JSX braces; row/card heights must come from the data module",
  );
  // And the raw constant values must not be hiding as bare numbers in any
  // y/height expression (e.g. `rowY + 30` restyled by hand).
  for (const [name, value] of [
    ["HEADER_H", HEADER_H],
    ["ROW_H", ROW_H],
  ] as const) {
    const bare = new RegExp(`[+\\-*(=\\s]${value}(?![.\\d])`, "g");
    const hits = (src.match(bare) ?? []).length;
    derive(
      hits === 0,
      `the literal value ${value} (${name}) appears ${hits}x in the JSX; derive from the constant instead`,
    );
  }
}

// -------------------------------------------------- inventory cross-check
const conceptById = new Map(CONCEPTS.map((c) => [c.id, c]));
for (const c of CARDS) {
  check(c.id in CARD_CONCEPT, `card ${c.id} has no CARD_CONCEPT mapping (add it here)`);
  const concept = CARD_CONCEPT[c.id];
  if (concept != null) {
    check(conceptById.has(concept), `card ${c.id} maps to unknown concept ${concept}`);
  }
}
for (const mapped of Object.keys(CARD_CONCEPT)) {
  check(cardIds.has(mapped), `CARD_CONCEPT maps "${mapped}" but the diagram has no such card`);
}

const relById = new Map(RELATIONS.map((r) => [r.id, r]));
const attrById = new Map(ATTRIBUTES.map((a) => [a.id, a]));

/**
 * The diagram draws the reference model, so extension relations/attributes
 * (our additions beyond the curator's export) are expected to be absent —
 * except isRelatedTo, which the reference itself declares (we only add the
 * OWL axioms) and which the diagram shows.
 */
const DRAWN_EXTENSIONS = new Set(["isRelatedTo"]);

let relationRows = 0;
for (const cardId of ["assertion", "document"] as const) {
  const card = CARDS.find((c) => c.id === cardId)!;
  const concept = CARD_CONCEPT[cardId]!;

  // Every drawn row must be an inventory relation/attribute with this
  // concept in its domain, and its targets must match the declared range.
  for (const r of card.rows ?? []) {
    relationRows += 1;
    const def = r.attr ? attrById.get(r.name) : relById.get(r.name);
    check(!!def, `${r.id}: "${r.name}" is not a declared inventory ${r.attr ? "attribute" : "relation"}`);
    if (!def) continue;
    check(def.domain.includes(concept), `${r.id}: inventory domain [${def.domain}] does not include ${concept}`);
    if (!r.attr) {
      const range: string[] = relById.get(r.name)?.range ?? [];
      const targetConcepts = (r.targets ?? [])
        .map((t) => CARD_CONCEPT[t])
        .filter((x): x is string => x != null)
        .sort();
      if (cardId === "assertion") {
        // On the Assertion card the drawn targets must equal the range.
        check(
          JSON.stringify(targetConcepts) === JSON.stringify([...range].sort()),
          `${r.id}: diagram targets map to [${targetConcepts}] but inventory range is [${range}]`,
        );
      } else {
        // Elsewhere (document.hasContent) the inventory range is the union
        // over all domains, so the drawn targets need only be a non-empty
        // subset of it.
        check(
          targetConcepts.length > 0 && targetConcepts.every((t) => range.includes(t)),
          `${r.id}: diagram targets [${targetConcepts}] are not within inventory range [${range}]`,
        );
      }
    }
  }

  // And every non-extension inventory relation/attribute on this concept
  // must be drawn: a renamed/added relation fails here.
  const drawnNames = new Set((card.rows ?? []).map((r) => r.name));
  for (const rel of RELATIONS) {
    if (!rel.domain.includes(concept)) continue;
    if (rel.extension && !DRAWN_EXTENSIONS.has(rel.id)) continue;
    if ((UNDRAWN_WIDENED_DOMAINS[cardId] ?? []).includes(rel.id)) continue;
    relationRows += 0;
    check(drawnNames.has(rel.id), `inventory relation ${rel.id} (domain ${concept}) is missing from the ${cardId} card`);
  }
  for (const attr of ATTRIBUTES) {
    if (!attr.domain.includes(concept) || attr.extension) continue;
    check(drawnNames.has(attr.id), `inventory attribute ${attr.id} (domain ${concept}) is missing from the ${cardId} card`);
  }
}

// ---------------------------------------------------------- subtype sets
let subtypeChecks = 0;
for (const [parentCard, parentConcept] of [
  ["person", "Person"],
  ["document", "Document"],
  ["topic", "Topic"],
] as const) {
  const drawnChildren = ARROWS.filter((a) => a.kind === "sub" && a.from === parentCard)
    .map((a) => CARD_CONCEPT[a.to])
    .filter((x): x is string => x != null);
  for (const child of drawnChildren) {
    subtypeChecks += 1;
    check(
      conceptById.get(child)?.isA === parentConcept,
      `diagram branches ${parentConcept} into ${child}, but inventory says ${child} isA ${conceptById.get(child)?.isA ?? "(nothing)"}`,
    );
  }
  const inventoryChildren = CONCEPTS.filter((c) => c.isA === parentConcept).map((c) => c.id);
  const accounted = new Set([...drawnChildren, ...(OMITTED_SUBTYPES[parentConcept] ?? [])]);
  for (const child of inventoryChildren) {
    subtypeChecks += 1;
    check(
      accounted.has(child),
      `inventory child ${child} of ${parentConcept} is neither drawn in the diagram nor listed in OMITTED_SUBTYPES`,
    );
  }
}

// ------------------------------------------- extension-justified omissions
// Every omission justified as "extension concept" must still BE an
// extension in the inventory; a promotion into the reference export must
// force a fresh drawing decision instead of staying silently hidden.
let extensionJustificationChecks = 0;
const allOmitted = new Set(Object.values(OMITTED_SUBTYPES).flat());
for (const id of OMITTED_AS_EXTENSION) {
  extensionJustificationChecks += 1;
  check(
    allOmitted.has(id),
    `OMITTED_AS_EXTENSION lists ${id} but it is not in OMITTED_SUBTYPES (stale entry — remove it)`,
  );
  const concept = conceptById.get(id);
  check(!!concept, `OMITTED_AS_EXTENSION lists ${id} but the inventory has no such concept`);
  if (concept) {
    check(
      concept.extension === true,
      `${id} is omitted from the diagram as an extension concept, but the inventory no longer flags it ` +
        `extension: true — it has been promoted into the reference export. Revisit the drawing decision: ` +
        `either draw it or re-justify the omission (and update OMITTED_AS_EXTENSION).`,
    );
  }
}
// The converse: any omitted subtype that IS an extension must carry the
// extension justification, so the set above cannot rot by omission.
for (const id of allOmitted) {
  const concept = conceptById.get(id);
  if (concept?.extension && !OMITTED_AS_EXTENSION.has(id)) {
    extensionJustificationChecks += 1;
    check(
      false,
      `${id} is an extension concept omitted from the diagram but is not listed in OMITTED_AS_EXTENSION; ` +
        `add it so a future promotion is caught`,
    );
  }
}

// --------------------------------------- widened-domain-justified omissions
// Every UNDRAWN_WIDENED_DOMAINS entry must still be justified by the
// inventory: the relation must exist, its domain must still include the
// card's concept (otherwise the exemption is unused — the missing-relation
// check would not fire anyway), and the inventory's widenedDomain marker
// must still record that domain member as our widening beyond the reference
// export. If the reference adopts the widened domain (marker dropped) or the
// widening is reverted (domain member gone), the entry is stale and fails.
let widenedDomainChecks = 0;
for (const [cardId, relIds] of Object.entries(UNDRAWN_WIDENED_DOMAINS)) {
  check(cardIds.has(cardId), `UNDRAWN_WIDENED_DOMAINS keys card "${cardId}" but the diagram has no such card`);
  const concept = CARD_CONCEPT[cardId];
  check(
    concept != null,
    `UNDRAWN_WIDENED_DOMAINS keys card "${cardId}" which maps to no inventory concept`,
  );
  for (const relId of relIds) {
    widenedDomainChecks += 1;
    const rel = relById.get(relId);
    check(!!rel, `UNDRAWN_WIDENED_DOMAINS lists ${relId} but the inventory has no such relation`);
    if (!rel || concept == null) continue;
    check(
      rel.domain.includes(concept),
      `UNDRAWN_WIDENED_DOMAINS exempts ${cardId} from drawing ${relId}, but the inventory domain ` +
        `[${rel.domain}] no longer includes ${concept} — the widening was reverted; remove the stale entry`,
    );
    check(
      (rel.widenedDomain ?? []).includes(concept),
      `UNDRAWN_WIDENED_DOMAINS exempts ${cardId} from drawing ${relId} as "our widening", but the ` +
        `inventory's widenedDomain marker [${rel.widenedDomain ?? []}] no longer records ${concept} — ` +
        `the reference export has adopted the widened domain. Revisit the drawing decision: either draw ` +
        `the relation on the ${cardId} card or re-justify the omission (and update UNDRAWN_WIDENED_DOMAINS).`,
    );
    // An exemption for a relation that IS drawn on the card is unused.
    const card = cardById.get(cardId);
    check(
      !(card?.rows ?? []).some((r) => r.name === relId),
      `UNDRAWN_WIDENED_DOMAINS exempts ${cardId} from drawing ${relId}, but the diagram draws it — ` +
        `unused entry, remove it`,
    );
  }
}
// Sanity on the marker itself: every widenedDomain member must be a real
// domain member, or the marker is meaningless.
for (const rel of RELATIONS) {
  for (const w of rel.widenedDomain ?? []) {
    widenedDomainChecks += 1;
    check(
      rel.domain.includes(w),
      `inventory relation ${rel.id} marks widenedDomain "${w}" which is not in its domain [${rel.domain}]`,
    );
  }
}

// ---------------------------------------------------------------- report
console.log(
  `verified ${CARDS.length} cards, ${rowIds.size} rows, ${ARROWS.length} arrows ` +
    `(${arrowEndpoints} endpoints), ${targetEntries} row targets, ` +
    `${relationRows} Assertion/Document rows against the inventory, ${subtypeChecks} subtype links, ` +
    `${geometryEndpoints} arrow path endpoints against box geometry, ` +
    `${renderDerivationChecks} render-derivation checks on assertion-model-diagram.tsx, ` +
    `${extensionJustificationChecks} extension-justified omissions against the inventory's extension flags, ` +
    `${widenedDomainChecks} widened-domain exemption checks against the inventory's widenedDomain markers`,
);
check(
  extensionJustificationChecks >= 3,
  "positive controls: extension-justification checks did not run",
);
check(
  widenedDomainChecks >= 3,
  "positive controls: widened-domain exemption checks did not run " +
    "(expected at least the hasTopic exemption plus the hasTopic/hasContent marker sanity checks)",
);
check(
  renderDerivationChecks >= 9,
  "positive controls: render-derivation checks did not run",
);
check(
  CARDS.length > 0 && ARROWS.length > 0 && relationRows >= 7 && subtypeChecks >= 8,
  "positive controls: diagram data looks empty or barely populated",
);
// Every arrow contributes two verified endpoints unless one already failed
// above; a parse that silently checks nothing would trip this.
check(
  failures > 0 || geometryEndpoints === 2 * ARROWS.length,
  `positive controls: expected ${2 * ARROWS.length} geometrically verified endpoints, got ${geometryEndpoints}`,
);

if (failures > 0) {
  console.error(`${failures} failure(s)`);
  process.exit(1);
}
console.log("OK");
