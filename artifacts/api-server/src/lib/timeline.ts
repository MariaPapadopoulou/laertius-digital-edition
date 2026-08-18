/**
 * Chronology of the philosophers, derived deterministically from the
 * curated birthDate/deathDate claims (kg-claims.ts). No modern reference
 * dates are injected: a philosopher appears on the timeline only when a
 * dated claim carries D.L.'s own Olympiad reckoning with its modern-year
 * gloss ("(640/639 BCE)"), exactly as curated in the claim text.
 *
 * Judgment calls:
 * - Years are parsed ONLY from the parenthetical BCE glosses already in
 *   the claim values; Olympiad spans keep their first (earliest) year.
 *   Internally BCE years are negative integers (640 BCE = -640).
 * - Claims whose text mixes an age at death with a floruit gloss
 *   ("Died at seventy … floruit in the 84th Olympiad (444/441 BCE)")
 *   contribute the year to the floruit, never to the death year.
 * - When one endpoint is missing, it is derived from a stated age at
 *   death (birth + age, or death - age) and flagged approximate. Ages
 *   above 110 (Epimenides' legendary lifespans) are never used for
 *   derivation - the claims still appear in the event list.
 * - Rival dated claims are all kept as events; the bar endpoints use the
 *   best-certainty dated claim per kind (asserted > reported > disputed
 *   > conjectured, curated order breaking ties).
 */
import { getClaims, type Certainty, type KgClaim } from "./kg-claims";
import { getKnowledgeGraph, type MovementId } from "./kg";
import { greekSchoolGrc } from "./greek-names";
import { sectionIdForRef } from "./claims-answer";

export type TimelineEventKind = "born" | "died" | "flourished";

export interface TimelineEvent {
  kind: TimelineEventKind;
  /** Negative = BCE, parsed from the claim's own parenthetical gloss. */
  year?: number;
  /** Later bound of an Olympiad span gloss ("640/639 BCE"). */
  endYear?: number;
  /** Age stated in the claim text, when one is given. */
  age?: number;
  value: string;
  ref: string;
  sectionId?: string;
  certainty: Certainty;
  accordingTo?: string;
}

export interface TimelinePhilosopher {
  name: string;
  book: number;
  movement: string;
  movementLabel: string;
  /** Greek display form of `movementLabel` (greek-names.ts curated map);
   *  absent for the Unaffiliated bucket, which stays English-only. */
  movementGrc?: string;
  birthYear?: number;
  deathYear?: number;
  floruitYear?: number;
  /** True when the endpoint is derived from a stated age, not attested. */
  approxBirth?: boolean;
  approxDeath?: boolean;
  events: TimelineEvent[];
}

const UNITS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};

const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
  seventh: 7, eighth: 8, ninth: 9, tenth: 10, twentieth: 20,
  thirtieth: 30, fortieth: 40, fiftieth: 50, sixtieth: 60,
  seventieth: 70, eightieth: 80, ninetieth: 90,
};

/** One token of a spelled-out number ("eighty", "fifty-third", "72"). */
function tokenValue(token: string): number | undefined {
  if (/^\d{1,3}$/.test(token)) return Number(token);
  if (token.includes("-")) {
    const [a, b] = token.split("-");
    const tens = TENS[a];
    const unit = UNITS[b] ?? ORDINALS[b];
    if (tens !== undefined && unit !== undefined && unit < 10) return tens + unit;
    return undefined;
  }
  return UNITS[token] ?? TENS[token] ?? ORDINALS[token];
}

/**
 * Spelled-out cardinal/ordinal to number ("one hundred and fifty-four"
 * → 154, "fifty-third" → 53). Undefined when a token is not numeric.
 */
function wordsToNumber(tokens: string[]): number | undefined {
  let total = 0;
  let current = 0;
  let matched = false;
  for (const t of tokens) {
    if (t === "and") continue;
    if (t === "hundred") {
      current = (current || 1) * 100;
      matched = true;
      continue;
    }
    const v = tokenValue(t);
    if (v === undefined) return undefined;
    current += v;
    matched = true;
  }
  return matched ? total + current : undefined;
}

const AGE_PATTERNS: RegExp[] = [
  /\bage of\s+(?:about\s+|nearly\s+|more than\s+)?([a-z0-9\- ,.;]+)/,
  /\baged\s+(?:about\s+|nearly\s+|more than\s+)?([a-z0-9\- ,.;]+)/,
  /\bin his\s+([a-z0-9\- ,.;]+)/,
  /^lived\s+(?:to be\s+)?(?:about\s+|nearly\s+)?([a-z0-9\- ,.;]+)/,
  /^died at\s+(?:about\s+|nearly\s+)?([a-z0-9\- ,.;]+)/,
  /^was\s+([a-z0-9\- ,.;]+)/,
];

/**
 * Age stated in the claim text ("aged 72", "age of eighty-five",
 * "in his fifty-third year", "Died at seventy", "Lived one hundred and
 * fifty-four years"). Undefined when no parseable age is present.
 */
export function parseAge(value: string): number | undefined {
  const v = value.toLowerCase();
  for (const pattern of AGE_PATTERNS) {
    const m = v.match(pattern);
    if (!m) continue;
    const tokens: string[] = [];
    for (const raw of m[1].split(/\s+/)) {
      const punctuated = /[.,;]$/.test(raw);
      const clean = raw.replace(/[.,;]+$/, "");
      if (
        clean === "and" ||
        clean === "hundred" ||
        tokenValue(clean) !== undefined
      ) {
        tokens.push(clean);
        if (punctuated) break;
      } else {
        break;
      }
    }
    const n = wordsToNumber(tokens);
    if (n !== undefined) return n;
  }
  return undefined;
}

/** First BCE year of the parenthetical gloss, negative; plus span end. */
export function parseYear(
  value: string,
): { year: number; endYear?: number } | undefined {
  const m = value.match(/\((?:c\.\s*)?(\d{2,4})(?:[/\u2013-](\d{2,4}))?\s*BCE\)/);
  if (!m) return undefined;
  const year = -Number(m[1]);
  const endYear = m[2] !== undefined ? -Number(m[2]) : undefined;
  return endYear !== undefined && endYear !== year ? { year, endYear } : { year };
}

/**
 * Anchors that date a moment in the philosopher's active life, not a
 * birth: floruit statements, "old man at" observations, headship
 * successions, and dated arrivals ("Came to Athens in the ...
 * Olympiad"). All are treated as floruit so a headship or arrival year
 * is never presented as a literal birth year.
 */
const FLORUIT_ANCHOR =
  /^(Flourish|Lived in the|Was (already )?an old man|Became head|Was head of the school|Succeeded .* head of the school|Rose to be head|Assumed the headship|Presided over the school|Came to Athens)/;

function classify(c: KgClaim): TimelineEventKind {
  if (FLORUIT_ANCHOR.test(c.value)) {
    return "flourished";
  }
  if (/^Was\b/.test(c.value) && /\bdied\b/i.test(c.value)) return "died";
  return c.property === "birthDate" ? "born" : "died";
}

/**
 * Which endpoint the parsed year informs. A death notice whose gloss
 * belongs to a floruit statement must not set the death year, and an
 * age-at-date observation ("Was sixty-four in the … Olympiad (547/546
 * BCE)") dates neither endpoint directly - both are derived from it.
 */
function yearRole(
  c: KgClaim,
  kind: TimelineEventKind,
): TimelineEventKind | "observation" {
  if (kind === "flourished") return "flourished";
  if (isObservation(c.value)) return "observation";
  if (/floruit|flourish/i.test(c.value)) {
    return "flourished";
  }
  return kind;
}

/** "Was AGE in the … Olympiad" - an age at a dated moment, not a birth. */
function isObservation(value: string): boolean {
  return /^was\s/i.test(value) && !/^was an old man/i.test(value);
}

/**
 * The role a claim's parsed year plays (validator entry point): the
 * classification pipeline (classify + yearRole) exposed as one call so
 * validate-timeline can pin how every dated claim is interpreted.
 */
export function timelineRoleFor(
  c: KgClaim,
): TimelineEventKind | "observation" {
  return yearRole(c, classify(c));
}

const CERTAINTY_RANK: Record<Certainty, number> = {
  asserted: 0,
  reported: 1,
  disputed: 2,
  conjectured: 3,
};

/** Highest ceiling for using a stated age to derive a missing endpoint. */
const MAX_PLAUSIBLE_AGE = 110;

/**
 * Members D.L. dates only RELATIVE to a chapter subject's own dated
 * claims (school-members.ts roster, no claims of their own). Both years
 * still come from D.L.'s reckoning: the offset and the age are his, and
 * the anchor year is the anchor's already-curated gloss year, so no
 * modern reference date enters the timeline. Everything derived here is
 * flagged approximate. The other Garden members carry NO date
 * information anywhere in D.L. and stay off the timeline deliberately.
 */
interface RelativeDatedMember {
  name: string;
  book: number;
  movement: MovementId;
  /** Verbatim Hicks text grounding the relative date. */
  value: string;
  ref: string;
  certainty: Certainty;
  /** "N years before ANCHOR" - anchor must resolve to a dated death. */
  diedYearsBefore: { anchor: string; years: number };
  /** Stated age at death, for deriving the birth year. */
  ageAtDeath?: number;
}

const RELATIVE_DATED_MEMBERS: RelativeDatedMember[] = [
  {
    name: "Metrodorus",
    book: 10,
    movement: "epicurean",
    value:
      "He died, we learn, seven years before Epicurus in his fiftythird year",
    ref: "10.23",
    certainty: "reported",
    diedYearsBefore: { anchor: "Epicurus", years: 7 },
    ageAtDeath: 53,
  },
];

type YearRole = TimelineEventKind | "observation";

function bestYear(
  events: { role: YearRole; year?: number; certainty: Certainty }[],
  role: YearRole,
): number | undefined {
  let best: { year: number; rank: number } | undefined;
  for (const e of events) {
    if (e.role !== role || e.year === undefined) continue;
    const rank = CERTAINTY_RANK[e.certainty];
    if (!best || rank < best.rank) best = { year: e.year, rank };
  }
  return best?.year;
}

let cached: TimelinePhilosopher[] | null = null;

export function getTimeline(): TimelinePhilosopher[] {
  if (cached) return cached;

  const nodeByName = new Map(
    getKnowledgeGraph().nodes.map((n) => [n.name, n]),
  );

  const bySubject = new Map<string, KgClaim[]>();
  for (const c of getClaims()) {
    if (c.property !== "birthDate" && c.property !== "deathDate") continue;
    const list = bySubject.get(c.subject);
    if (list) list.push(c);
    else bySubject.set(c.subject, [c]);
  }

  const out: TimelinePhilosopher[] = [];
  for (const [name, claims] of bySubject) {
    const node = nodeByName.get(name);
    if (!node) continue;

    const events = claims.map((c) => {
      const kind = classify(c);
      const parsed = parseYear(c.value);
      const age = parseAge(c.value);
      const event: TimelineEvent = {
        kind,
        year: parsed?.year,
        endYear: parsed?.endYear,
        age,
        value: c.value,
        ref: c.ref,
        sectionId: sectionIdForRef(c.ref, c.subject),
        certainty: c.certainty,
        accordingTo: c.accordingTo,
      };
      return { event, role: yearRole(c, kind) };
    });

    const roleEvents = events.map(({ event, role }) => ({
      role,
      year: event.year,
      certainty: event.certainty,
    }));

    let birthYear = bestYear(roleEvents, "born");
    let deathYear = bestYear(roleEvents, "died");
    const floruitYear = bestYear(roleEvents, "flourished");
    let approxBirth: boolean | undefined;
    let approxDeath: boolean | undefined;

    // Derive a missing endpoint from a stated age at death, best
    // certainty first, ignoring legendary lifespans.
    const agedDeaths = events
      .filter(
        ({ event }) =>
          event.kind === "died" &&
          event.age !== undefined &&
          event.age <= MAX_PLAUSIBLE_AGE,
      )
      .sort(
        (a, b) =>
          CERTAINTY_RANK[a.event.certainty] - CERTAINTY_RANK[b.event.certainty],
      );
    const age = agedDeaths[0]?.event.age;
    if (age !== undefined) {
      if (deathYear === undefined && birthYear !== undefined) {
        deathYear = birthYear + age;
        approxDeath = true;
      } else if (birthYear === undefined && deathYear !== undefined) {
        birthYear = deathYear - age;
        approxBirth = true;
      }
    }

    // Age-at-date observations ("Was sixty-four in the … Olympiad
    // (547/546 BCE), and died not long afterwards"): derive both
    // endpoints from the dated age when nothing attested exists.
    for (const { event, role } of events) {
      if (role !== "observation") continue;
      if (event.year === undefined || event.age === undefined) continue;
      if (event.age > MAX_PLAUSIBLE_AGE) continue;
      if (birthYear === undefined) {
        birthYear = event.year - event.age;
        approxBirth = true;
      }
      if (deathYear === undefined && /\bdied\b/i.test(event.value)) {
        deathYear = event.year;
        approxDeath = true;
      }
    }

    if (
      birthYear === undefined &&
      deathYear === undefined &&
      floruitYear === undefined
    ) {
      continue;
    }

    out.push({
      name,
      book: node.book,
      movement: node.movement,
      movementLabel: node.movementLabel,
      movementGrc: greekSchoolGrc(node.movementLabel),
      birthYear,
      deathYear,
      floruitYear,
      approxBirth,
      approxDeath,
      events: events.map((e) => e.event),
    });
  }

  // Relative-dated school members: resolved AFTER the main loop so the
  // anchor's death year is the same best-certainty value the anchor's
  // own bar uses. An undated anchor keeps the member off the timeline.
  const movementLabelById = new Map(
    getKnowledgeGraph().movements.map((m) => [m.id, m.label]),
  );
  for (const r of RELATIVE_DATED_MEMBERS) {
    const anchor = out.find((p) => p.name === r.diedYearsBefore.anchor);
    if (anchor?.deathYear === undefined) continue;
    const deathYear = anchor.deathYear - r.diedYearsBefore.years;
    const birthYear =
      r.ageAtDeath !== undefined && r.ageAtDeath <= MAX_PLAUSIBLE_AGE
        ? deathYear - r.ageAtDeath
        : undefined;
    out.push({
      name: r.name,
      book: r.book,
      movement: r.movement,
      movementLabel: movementLabelById.get(r.movement) ?? r.movement,
      movementGrc: greekSchoolGrc(
        movementLabelById.get(r.movement) ?? r.movement,
      ),
      birthYear,
      deathYear,
      approxBirth: birthYear !== undefined ? true : undefined,
      approxDeath: true,
      events: [
        {
          kind: "died",
          year: deathYear,
          age: r.ageAtDeath,
          value: r.value,
          ref: r.ref,
          sectionId: sectionIdForRef(r.ref, r.name),
          certainty: r.certainty,
        },
      ],
    });
  }

  out.sort((a, b) => sortKey(a) - sortKey(b));
  cached = out;
  return cached;
}

/** Earliest plausible anchor: birth, else floruit - 40, else death - 70. */
function sortKey(p: TimelinePhilosopher): number {
  if (p.birthYear !== undefined) return p.birthYear;
  if (p.floruitYear !== undefined) return p.floruitYear - 40;
  if (p.deathYear !== undefined) return p.deathYear - 70;
  return 0;
}
