/**
 * Occurrence-level OTV tagging of the corpus text.
 *
 * English side: case-sensitive matching of the gazetteer surfaces
 * ("Bias" the sage must never match the common noun "bias"), with
 * letter-boundary lookarounds and longest-match-first overlap
 * resolution. An ambiguous bare philosopher name ("Zeno") is tagged
 * only inside the Life of one of its bearers, resolved to the section
 * owner and flagged `heuristic: "section-owner"`.
 *
 * Greek side: otv:Term lemma occurrences, plus proper names from the
 * curated closed declensions in greek-names.ts (via the gazetteer's
 * Greek form table). Single-word lemmas match a token when it is the
 * exact normalized form, or the derived stem plus a whitelisted nominal
 * ending (conservative - misses some inflections rather than inventing
 * occurrences). Multi-word lemmas match as an exact normalized word
 * sequence. Proper-name forms additionally require the ORIGINAL token
 * to start with an uppercase letter (πρόδικος the adjective must never
 * match Πρόδικος the sophist), and ambiguous philosopher forms (Ζήνων)
 * are tagged only inside the Life of one of their bearers, flagged
 * `heuristic: "section-owner"` - exactly like the English side.
 * Offsets always refer to the ORIGINAL polytonic text, via a
 * normalization offset map.
 */
import { corpus, type CorpusSection } from "./corpus";
import { normalizeGreek } from "./greek";
import { PHILOSOPHY_PAGES } from "./philosophy-pages";
import { ALT_TITLES } from "./kg-ontology";
import { unicodeSlug, getClaims } from "./kg-claims";
import { sectionIdForRef } from "./claims-answer";
// Deferred cycle (annotate -> lod -> annotate): safe because LOD_BASE is
// only read inside functions, after both modules finish initializing.
import {
  LOD_BASE,
  greekHomonymsForLabels,
  GREEK_HOMONYM_CERTIFIED_BEARERS,
} from "./lod";
import { PLACE_PLEIADES } from "./place-pleiades";
import { greekNameSpec } from "./greek-names";
import {
  getGazetteer,
  GREEK_ENDING_SET,
  type EntityKind,
  type GazetteerEntry,
  type GreekNameEntry,
} from "./gazetteer";

export type AnnotationKind = EntityKind | "term";

export interface TextAnnotation {
  /** Codepoint-safe UTF-16 offsets into the section's text/textEn. */
  start: number;
  end: number;
  /** Exactly text.slice(start, end). */
  surface: string;
  lang: "grc" | "en";
  kind: AnnotationKind;
  /** URI of the tagged individual (or otv:Term node). */
  entityUri: string;
  /** Canonical label (entities) or curated lemma (terms). */
  label: string;
  /** otv:ProperName node the surface belongs to, when one exists. */
  nameUri?: string;
  /** Doctrine concepts a term denotes (otv:denotedConcept). */
  conceptUris?: string[];
  /** Present when the match needed the section-owner heuristic. */
  heuristic?: "section-owner";
}

export interface SectionAnnotations {
  sectionId: string;
  annotations: TextAnnotation[];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface Matcher {
  regex: RegExp;
  bySurface: Map<string, GazetteerEntry[]>;
}

let matcher: Matcher | null = null;

/**
 * One combined alternation, longest surface first (= longest match wins).
 * A surface can carry several entries (a section-scoped source-mention
 * entry plus an unscoped one for another bearer - "Croton" the authority
 * vs. the city); scoped entries come first so the section check below
 * picks the curated bearer inside its sections and falls through to the
 * unscoped bearer everywhere else.
 */
function getMatcher(): Matcher {
  if (matcher) return matcher;
  const g = getGazetteer();
  const bySurface = new Map<string, GazetteerEntry[]>();
  for (const e of g.entries) {
    const bucket = bySurface.get(e.surface);
    if (bucket) bucket.push(e);
    else bySurface.set(e.surface, [e]);
  }
  for (const bucket of bySurface.values()) {
    bucket.sort((a, b) => (a.onlySections ? 0 : 1) - (b.onlySections ? 0 : 1));
  }
  const alternation = [...bySurface.keys()]
    .sort((a, b) => b.length - a.length)
    .map((s) => escapeRegExp(s))
    .join("|");
  matcher = {
    regex: new RegExp(`(?<!\\p{L})(?:${alternation})(?!\\p{L})`, "gu"),
    bySurface,
  };
  return matcher;
}

/**
 * Normalized text with an offset map back into the original string.
 * map[i] / mapEnd[i] give the original start / end (UTF-16 offsets) of
 * the character that produced normalized position i.
 */
export function normalizedWithMap(text: string): {
  norm: string;
  map: number[];
  mapEnd: number[];
} {
  let norm = "";
  const map: number[] = [];
  const mapEnd: number[] = [];
  let i = 0;
  for (const ch of text) {
    const n = normalizeGreek(ch);
    for (let k = 0; k < n.length; k++) {
      map.push(i);
      mapEnd.push(i + ch.length);
    }
    norm += n;
    i += ch.length;
  }
  return { norm, map, mapEnd };
}

interface NormToken {
  token: string;
  start: number; // normalized offset
  end: number;
}

function normTokens(norm: string): NormToken[] {
  const out: NormToken[] = [];
  for (const m of norm.matchAll(/\p{L}+/gu)) {
    out.push({ token: m[0], start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/** Overlap resolution: earliest start, then longest, then non-heuristic. */
function resolveOverlaps(anns: TextAnnotation[]): TextAnnotation[] {
  const sorted = [...anns].sort(
    (a, b) =>
      a.start - b.start ||
      b.end - a.end ||
      (a.heuristic ? 1 : 0) - (b.heuristic ? 1 : 0),
  );
  const out: TextAnnotation[] = [];
  let lastEnd = -1;
  for (const a of sorted) {
    if (a.start < lastEnd) continue;
    out.push(a);
    lastEnd = a.end;
  }
  return out;
}

function annotateEnglish(section: CorpusSection): TextAnnotation[] {
  const text = section.textEn;
  if (!text) return [];
  const g = getGazetteer();
  const { regex, bySurface } = getMatcher();
  const anns: TextAnnotation[] = [];

  regex.lastIndex = 0;
  for (const m of text.matchAll(regex)) {
    const bucket = bySurface.get(m[0]);
    if (!bucket) continue;
    // Multi-bearer names (Aristodemus): curator-pinned section scope.
    // Scoped entries sort first, so inside a curated scope the scoped
    // bearer wins; outside it the unscoped bearer (if any) still tags.
    const e = bucket.find(
      (c) => !c.onlySections || c.onlySections.includes(section.id),
    );
    if (!e) continue;
    anns.push({
      start: m.index,
      end: m.index + m[0].length,
      surface: m[0],
      lang: "en",
      kind: e.kind,
      entityUri: e.entityUri,
      label: e.label,
      ...(e.nameUri ? { nameUri: e.nameUri } : {}),
    });
  }

  // Section-owner heuristic: an ambiguous bare name ("Zeno") is safe
  // inside the Life of one of its bearers - it names the Life's subject.
  const ownerFirst = section.philosopher.split(/\s+/)[0]!;
  const ambiguous = g.ambiguousPhilosopherNames.get(ownerFirst);
  if (ambiguous) {
    const owner = ambiguous.find(
      (u) => g.labelByUri.get(u) === section.philosopher,
    );
    if (owner) {
      const re = new RegExp(
        `(?<!\\p{L})${escapeRegExp(ownerFirst)}(?!\\p{L})`,
        "gu",
      );
      for (const m of text.matchAll(re)) {
        anns.push({
          start: m.index,
          end: m.index + ownerFirst.length,
          surface: ownerFirst,
          lang: "en",
          kind: "philosopher",
          entityUri: owner,
          label: g.labelByUri.get(owner) ?? section.philosopher,
          heuristic: "section-owner",
        });
      }
    }
  }

  return resolveOverlaps(anns);
}

function annotateGreek(section: CorpusSection): TextAnnotation[] {
  const g = getGazetteer();
  const { norm, map, mapEnd } = normalizedWithMap(section.text);
  const tokens = normTokens(norm);
  const anns: TextAnnotation[] = [];

  for (const t of g.terms) {
    if (t.words.length === 1) {
      const lemma = t.normalized;
      for (const tok of tokens) {
        let hit = tok.token === lemma;
        if (!hit && t.stem && tok.token.startsWith(t.stem)) {
          hit = GREEK_ENDING_SET.has(tok.token.slice(t.stem.length));
        }
        if (!hit) continue;
        const start = map[tok.start]!;
        const end = mapEnd[tok.end - 1]!;
        anns.push({
          start,
          end,
          surface: section.text.slice(start, end),
          lang: "grc",
          kind: "term",
          entityUri: t.termUri,
          label: t.lemma,
          ...(t.conceptUris.length > 0 ? { conceptUris: t.conceptUris } : {}),
        });
      }
    } else {
      // Exact normalized word-sequence match for multi-word lemmas.
      for (let i = 0; i + t.words.length <= tokens.length; i++) {
        let ok = true;
        for (let k = 0; k < t.words.length; k++) {
          if (tokens[i + k]!.token !== t.words[k]) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        const start = map[tokens[i]!.start]!;
        const end = mapEnd[tokens[i + t.words.length - 1]!.end - 1]!;
        anns.push({
          start,
          end,
          surface: section.text.slice(start, end),
          lang: "grc",
          kind: "term",
          entityUri: t.termUri,
          label: t.lemma,
          ...(t.conceptUris.length > 0 ? { conceptUris: t.conceptUris } : {}),
        });
      }
    }
  }

  // ---------------------------------------- Greek proper names & titles
  // The original token must start with an uppercase letter: normalized
  // matching alone would let common words shadow names (πολιτεία the
  // constitution vs. Πολιτεία the Republic).
  const capitalizedAt = (normStart: number): boolean => {
    const cp = section.text.codePointAt(map[normStart]!);
    return cp !== undefined && /\p{Lu}/u.test(String.fromCodePoint(cp));
  };
  const pushName = (
    e: GreekNameEntry,
    start: number,
    end: number,
    heuristic?: "section-owner",
  ): void => {
    anns.push({
      start,
      end,
      surface: section.text.slice(start, end),
      lang: "grc",
      kind: e.kind,
      entityUri: e.entityUri,
      label: e.label,
      ...(e.nameUri ? { nameUri: e.nameUri } : {}),
      ...(heuristic ? { heuristic } : {}),
    });
  };

  // Entries with a curator-pinned section scope (homonymous work titles,
  // the 7.38 Stoic pupils) are only considered inside their own sections;
  // in-scope single-word scoped entries outrank unscoped bearers of the
  // same form (Posidonius of Alexandria over the Apamea source at 7.38)
  // and pre-empt the section-owner heuristic (Zeno of Sidon over the
  // owner Zeno of Citium); everything else keeps the ordinary
  // single-token / multi-word split.
  const singleByForm = new Map<string, GreekNameEntry>();
  const scopedSingleByForm = new Map<string, GreekNameEntry>();
  const multiWord: GreekNameEntry[] = [];
  for (const e of g.greekEntries) {
    if (e.onlySections && !e.onlySections.includes(section.id)) continue;
    if (e.words.length === 1) {
      if (e.onlySections) scopedSingleByForm.set(e.form, e);
      else singleByForm.set(e.form, e);
    } else multiWord.push(e);
  }

  for (const tok of tokens) {
    if (!capitalizedAt(tok.start)) continue;
    const start = map[tok.start]!;
    const end = mapEnd[tok.end - 1]!;
    const e = scopedSingleByForm.get(tok.token) ?? singleByForm.get(tok.token);
    if (e) {
      pushName(e, start, end);
      continue;
    }
    // Section-owner heuristic: an ambiguous form (Ζήνων) is safe inside
    // the Life of one of its bearers - it names the Life's subject.
    const ambiguous = g.ambiguousGreekPhilosopherForms.get(tok.token);
    if (!ambiguous) continue;
    const owner = ambiguous.find(
      (u) => g.labelByUri.get(u) === section.philosopher,
    );
    if (!owner) continue;
    anns.push({
      start,
      end,
      surface: section.text.slice(start, end),
      lang: "grc",
      kind: "philosopher",
      entityUri: owner,
      label: g.labelByUri.get(owner) ?? section.philosopher,
      heuristic: "section-owner",
    });
  }

  // Multi-word forms (Αἰγὸς ποταμοί): exact normalized word sequence,
  // capitalization checked on the first word only.
  for (const e of multiWord) {
    for (let i = 0; i + e.words.length <= tokens.length; i++) {
      let ok = true;
      for (let k = 0; k < e.words.length; k++) {
        if (tokens[i + k]!.token !== e.words[k]) {
          ok = false;
          break;
        }
      }
      if (!ok || !capitalizedAt(tokens[i]!.start)) continue;
      const start = map[tokens[i]!.start]!;
      const end = mapEnd[tokens[i + e.words.length - 1]!.end - 1]!;
      pushName(e, start, end);
    }
  }

  return resolveOverlaps(anns);
}

const cache = new Map<string, TextAnnotation[]>();

/** All annotations for one section (Greek terms + English names), sorted. */
export function annotateSection(section: CorpusSection): TextAnnotation[] {
  const hit = cache.get(section.id);
  if (hit) return hit;
  const anns = [...annotateGreek(section), ...annotateEnglish(section)].sort(
    (a, b) => (a.lang < b.lang ? -1 : a.lang > b.lang ? 1 : a.start - b.start),
  );
  cache.set(section.id, anns);
  return anns;
}

export interface EntityOccurrenceSummary {
  entityUri: string;
  label: string;
  kind: AnnotationKind;
  occurrences: number;
  sectionCount: number;
  /** Philosophy Pages site path (philosophypages.com), e.g. "dy/t.htm#telos". */
  philosophyPages?: string;
  /** Curated Pleiades gazetteer id (place-pleiades.ts), place entities only. */
  pleiades?: string;
  /** Alternate title D.L. reports for a work (kg-ontology ALT_TITLES). */
  altTitle?: string;
  /** Hicks ref (book.section) where D.L. records the double title. */
  altTitleRef?: string;
  /** Corpus section id resolving altTitleRef, for linking. */
  altTitleSectionId?: string;
  /** Other work entries in the index sharing a title with this one, so
   * homonymous works (e.g. two dialogues both subtitled "On Philosophy",
   * or a dialogue subtitle matching another author's tagged work) are
   * never confused. */
  homonyms?: EntityCrossRef[];
  /** Curated Greek nominative (greek-names.ts), so a reader pasting a
   * Greek name that is NOT a shared homonym form (e.g. a form of
   * Socrates, Ἀθῆναι, or Φαβωρῖνος) still finds the entry: the Index
   * filter and closest-names fallback compare against it. Philosophers
   * always carry it (collisions get grcHomonymForm notes); place,
   * person and source entries carry it only when the nominative is
   * unique across the differently-labelled index bearers, or the entry
   * is a certified bearer whose collision the grcHomonymForm notes
   * disambiguate, so a shared form never surfaces one bearer while
   * silently hiding another. Exception: when NO bearer of a shared form
   * would surface it (no philosopher and no certified bearer), all
   * bearers keep grc — hiding every bearer would strand the reader on
   * an empty Index, and showing all hides nobody. */
  grc?: string;
  /** The curated Greek nominative this person-like entry (philosopher,
   * person or source) shares with at least one other bearer (for
   * certified pairs, the form behind the owl:differentFrom axioms in
   * the LOD graph). */
  grcHomonymForm?: string;
  /** Other person-like bearers of the same Greek nominative; certified
   * pairs carry owl:differentFrom in the LOD graph, uncertified
   * same-form bearers (grcHomonymUncertified) carry no such axiom. */
  sharesGreekNameWith?: GreekNameBearer[];
  /** True when this bearer's shared form is fully withheld from
   * certification (no philosopher or certified bearer in the group):
   * the namesake note is softer, because certification is a curatorial
   * claim and no owl:differentFrom axiom is asserted — the bearers may
   * or may not be distinct individuals. */
  grcHomonymUncertified?: boolean;
}

export interface GreekNameBearer {
  label: string;
  /** The other bearer's own tagged index entry, when it is itself tagged. */
  entityUri?: string;
}

export interface EntityCrossRef {
  entityUri: string;
  label: string;
  /** The title both entries share, e.g. "On Philosophy". */
  sharedTitle: string;
  /**
   * Author of the other work, when the claims layer records exactly one
   * unconflicting `wrote` attribution for it. Omitted otherwise, so the
   * cross-note never guesses between rival attributions.
   */
  author?: string;
  /**
   * Entity URI of the author's own tagged index entry, when the author's
   * name is itself a tagged philosopher, so readers can jump to it.
   */
  authorEntityUri?: string;
}

/** work label -> ALT_TITLES entry, for the work entities in the index. */
const altByWork = new Map(ALT_TITLES.map((a) => [a.work, a]));

let summaries: EntityOccurrenceSummary[] | null = null;
let sectionsByEntity: Map<string, Set<string>> | null = null;

function buildIndex(): void {
  if (summaries && sectionsByEntity) return;
  const occ = new Map<
    string,
    { label: string; kind: AnnotationKind; n: number; sections: Set<string> }
  >();
  for (const s of corpus) {
    for (const a of annotateSection(s)) {
      let e = occ.get(a.entityUri);
      if (!e) {
        e = { label: a.label, kind: a.kind, n: 0, sections: new Set() };
        occ.set(a.entityUri, e);
      }
      e.n += 1;
      e.sections.add(s.id);
    }
  }
  sectionsByEntity = new Map(
    [...occ.entries()].map(([uri, e]) => [uri, e.sections]),
  );
  // Distinct entry labels per curated Greek nominative slug, over every
  // index kind that can carry one. A slug shared by two or more
  // differently-labelled bearers (the place Ἐλευσίς and the source
  // "Eleusis (author uncertain)", the many bare Δημήτριοι) is ambiguous:
  // a non-philosopher entry only gets grc for such a form when it is a
  // certified bearer, so the grcHomonymForm notes disambiguate it.
  // Same-labelled bearers (the place and the man both labelled "Croton")
  // do not count as a collision: the English filter already surfaces
  // both entries for that label, and the Greek form must behave the same.
  const labelsByGrcSlug = new Map<string, Set<string>>();
  // Slugs with at least one bearer that surfaces the form regardless of
  // the guard: a philosopher (always carries grc) or a certified homonym
  // bearer. When a shared slug has NO such bearer, withholding grc from
  // every bearer would strand a reader pasting the form (e.g. Ζεῦξις)
  // on a truly empty Index; those fully-withheld forms instead surface
  // ALL their bearers, so no bearer is hidden while another shows.
  const surfacedGrcSlugs = new Set<string>();
  for (const e of occ.values()) {
    if (
      e.kind !== "philosopher" &&
      e.kind !== "person" &&
      e.kind !== "place" &&
      e.kind !== "source"
    )
      continue;
    const spec = greekNameSpec(e.label);
    if (!spec) continue;
    const slug = unicodeSlug(spec.grc);
    const set = labelsByGrcSlug.get(slug) ?? new Set<string>();
    set.add(e.label);
    labelsByGrcSlug.set(slug, set);
    if (
      e.kind === "philosopher" ||
      GREEK_HOMONYM_CERTIFIED_BEARERS.has(e.label)
    ) {
      surfacedGrcSlugs.add(slug);
    }
  }
  summaries = [...occ.entries()]
    .map(([entityUri, e]) => {
      const s: EntityOccurrenceSummary = {
        entityUri,
        label: e.label,
        kind: e.kind,
        occurrences: e.n,
        sectionCount: e.sections.size,
      };
      if (e.kind === "philosopher" || e.kind === "term") {
        const pp = PHILOSOPHY_PAGES[e.label];
        if (pp) s.philosophyPages = pp;
      }
      if (e.kind === "philosopher") {
        const spec = greekNameSpec(e.label);
        if (spec) s.grc = spec.grc;
      }
      if (e.kind === "person" || e.kind === "place" || e.kind === "source") {
        const spec = greekNameSpec(e.label);
        if (spec) {
          const slug = unicodeSlug(spec.grc);
          const bearers = labelsByGrcSlug.get(slug);
          const shared = (bearers?.size ?? 0) > 1;
          if (
            !shared ||
            GREEK_HOMONYM_CERTIFIED_BEARERS.has(e.label) ||
            // Fully-withheld form: no philosopher or certified bearer
            // surfaces it, so hide nothing — every bearer keeps grc and
            // a pasted form lists them all instead of an empty Index.
            !surfacedGrcSlugs.has(slug)
          ) {
            s.grc = spec.grc;
          }
        }
      }
      if (e.kind === "place") {
        const pl = PLACE_PLEIADES[e.label];
        if (pl) s.pleiades = pl;
      }
      if (e.kind === "work") {
        const alt = altByWork.get(e.label);
        if (alt) {
          s.altTitle = alt.altTitle;
          s.altTitleRef = alt.ref;
          // Resolve subject-aware against the record's own owner (today
          // always Plato's Book 3 catalogue), mirroring the owner-aware
          // resolution the claims/sayings/anecdotes layers use.
          const sid = sectionIdForRef(alt.ref, alt.owner);
          if (sid) s.altTitleSectionId = sid;
        }
      }
      return s;
    })
    .sort(
      (a, b) => b.occurrences - a.occurrences || a.label.localeCompare(b.label),
    );
}

/** Every tagged entity with occurrence counts, most frequent first. */
export function getEntitySummaries(): EntityOccurrenceSummary[] {
  buildIndex();
  return summaries!;
}

let catalogueEntries: EntityOccurrenceSummary[] | null = null;
let catalogueSections: Map<string, string[]> | null = null;

/**
 * Double-titled dialogues from the ontology layer (ALT_TITLES) that never
 * occur as tagged surfaces: their catalogue labels ("Phaedo, or On the
 * Soul") fail the gazetteer's title filter by design, so they are absent
 * from the tag-derived summaries. They join the reader-facing index as
 * catalogue-backed entries pointing at the catalogue section itself
 * (3.58-3.60, 3.62), WITHOUT touching the annotation layer, so the pinned
 * tag set is unchanged and a lookup by either title lands on the work.
 */
function buildCatalogueEntries(): void {
  if (catalogueEntries && catalogueSections) return;
  buildIndex();
  const taggedUris = new Set(summaries!.map((s) => s.entityUri));
  const entries: EntityOccurrenceSummary[] = [];
  const sections = new Map<string, string[]>();
  for (const a of ALT_TITLES) {
    const uri = `${LOD_BASE}/work/${unicodeSlug(a.work)}`;
    if (taggedUris.has(uri) || sections.has(uri)) continue;
    const sectionId = sectionIdForRef(a.ref, a.owner);
    if (!sectionId) {
      throw new Error(
        `annotate: alt-title ref "${a.ref}" (${a.work}) resolves to no section`,
      );
    }
    entries.push({
      entityUri: uri,
      label: a.work,
      kind: "work",
      occurrences: 1,
      sectionCount: 1,
      altTitle: a.altTitle,
      altTitleRef: a.ref,
      altTitleSectionId: sectionId,
    });
    sections.set(uri, [sectionId]);
  }
  catalogueEntries = entries;
  catalogueSections = sections;
  linkHomonyms([...summaries!, ...catalogueEntries]);
  linkGreekHomonyms(summaries!);
}

/**
 * Attach the shared Greek nominative to the person-like entries
 * (philosophers, mention persons, source authorities) whose curated Greek
 * forms collide (the same pairs that carry owl:differentFrom axioms in the
 * LOD graph), so the index shows the same disambiguation as the Graph side
 * panel. Same-individual label pairs (two English renderings of one man)
 * are excluded inside greekHomonymsForLabels. The Graph side panel stays
 * philosopher-only: it only ever shows KG nodes.
 *
 * A second, softer pass covers the fully-withheld shared forms (no
 * philosopher and no certified bearer in the group, e.g. Ζεῦξις): the
 * grc guard surfaces ALL those bearers so a pasted form is never a dead
 * end, so without a note a reader would see two cards with the same
 * Greek form and no explanation. Such bearers get the same
 * grcHomonymForm/sharesGreekNameWith note flagged grcHomonymUncertified:
 * the wording stays softer because no owl:differentFrom axiom is
 * asserted — the bearers are not curator-certified distinct. Mixed
 * groups (a philosopher or certified bearer plus uncertified ones) are
 * deliberately NOT annotated on the uncertified side: those bearers'
 * grc is withheld, so they never surface for a pasted Greek form.
 */
function linkGreekHomonyms(entries: EntityOccurrenceSummary[]): void {
  const personLike = entries.filter(
    (e) =>
      e.kind === "philosopher" || e.kind === "person" || e.kind === "source",
  );
  const bearers = personLike.filter(
    (e) =>
      e.kind === "philosopher" ||
      GREEK_HOMONYM_CERTIFIED_BEARERS.has(e.label),
  );
  const certifiedLabels = new Set(bearers.map((e) => e.label));
  const uriByLabel = new Map(personLike.map((e) => [e.label, e.entityUri]));
  const homonyms = greekHomonymsForLabels(bearers.map((e) => e.label));
  for (const e of bearers) {
    const h = homonyms.get(e.label);
    if (!h) continue;
    e.grcHomonymForm = h.grc;
    e.sharesGreekNameWith = h.others.map((label) => {
      const uri = uriByLabel.get(label);
      return uri ? { label, entityUri: uri } : { label };
    });
  }
  // Uncertified pass: fully-withheld shared forms only. Whether a form
  // is fully withheld is a property of the whole slug group, so mark
  // every slug with a philosopher/certified bearer — checking h.others
  // alone would miss a certified group member hidden by the
  // same-individual exclusion (the Renegade behind the Stoic).
  const allHomonyms = greekHomonymsForLabels(personLike.map((e) => e.label));
  const certifiedSlugs = new Set<string>();
  for (const [label, h] of allHomonyms) {
    if (certifiedLabels.has(label)) certifiedSlugs.add(unicodeSlug(h.grc));
  }
  for (const e of personLike) {
    if (e.grcHomonymForm !== undefined) continue;
    const h = allHomonyms.get(e.label);
    if (!h) continue;
    // The whole group must lack a philosopher/certified bearer,
    // otherwise the form is not fully withheld and this bearer never
    // surfaces it (its grc is withheld).
    if (certifiedLabels.has(e.label) || certifiedSlugs.has(unicodeSlug(h.grc)))
      continue;
    e.grcHomonymForm = h.grc;
    e.grcHomonymUncertified = true;
    e.sharesGreekNameWith = h.others.map((label) => {
      const uri = uriByLabel.get(label);
      return uri ? { label, entityUri: uri } : { label };
    });
  }
}

/**
 * Cross-link homonymous work entries: whenever one entry's alternate title
 * equals another work entry's label or alternate title (e.g. the dialogues
 * "The Rivals, or On Philosophy" and "Theages, or On Philosophy", or a
 * dialogue subtitle matching another author's separately tagged work), both
 * entries get a `homonyms` cross-reference so readers never conflate them.
 * Pure label collisions are impossible (labels are the entity URI key), so
 * every collision involves at least one alternate title.
 */
function linkHomonyms(entries: EntityOccurrenceSummary[]): void {
  // Work label -> its author per the claims layer, only where exactly one
  // philosopher is recorded as having written it (rival attributions of
  // the same title to different subjects would make the note misleading).
  const authorByWork = new Map<string, string | null>();
  for (const c of getClaims()) {
    if (c.property !== "wrote") continue;
    const prev = authorByWork.get(c.value);
    if (prev === undefined) authorByWork.set(c.value, c.subject);
    else if (prev !== c.subject) authorByWork.set(c.value, null);
  }
  // Philosopher label -> its tagged entity URI, so an author named in a
  // cross-note can link to that philosopher's own index entry.
  const uriByPhilosopher = new Map<string, string>();
  for (const e of entries) {
    if (e.kind === "philosopher") uriByPhilosopher.set(e.label, e.entityUri);
  }
  const byTitle = new Map<string, EntityOccurrenceSummary[]>();
  for (const e of entries) {
    if (e.kind !== "work") continue;
    const titles = e.altTitle ? [e.label, e.altTitle] : [e.label];
    for (const t of titles) {
      const arr = byTitle.get(t);
      if (arr) arr.push(e);
      else byTitle.set(t, [e]);
    }
  }
  for (const [title, group] of byTitle) {
    if (group.length < 2) continue;
    for (const e of group) {
      for (const other of group) {
        if (other === e) continue;
        const ref: EntityCrossRef = {
          entityUri: other.entityUri,
          label: other.label,
          sharedTitle: title,
        };
        const author = authorByWork.get(other.label);
        if (author) {
          ref.author = author;
          const authorUri = uriByPhilosopher.get(author);
          if (authorUri) ref.authorEntityUri = authorUri;
        }
        (e.homonyms ??= []).push(ref);
      }
    }
  }
  for (const e of entries) {
    if (e.homonyms) {
      e.homonyms.sort(
        (a, b) =>
          a.label.localeCompare(b.label) ||
          a.sharedTitle.localeCompare(b.sharedTitle),
      );
    }
  }
}

/**
 * The reader-facing index: every tagged entity plus the catalogue-backed
 * double-titled dialogues, in the same most-frequent-first order.
 */
export function getIndexEntries(): EntityOccurrenceSummary[] {
  buildCatalogueEntries();
  return [...summaries!, ...catalogueEntries!].sort(
    (a, b) => b.occurrences - a.occurrences || a.label.localeCompare(b.label),
  );
}

/** Section ids in corpus order where the entity occurs, or null. */
export function sectionsForEntity(entityUri: string): string[] | null {
  buildCatalogueEntries();
  const set = sectionsByEntity!.get(entityUri);
  if (set) return corpus.filter((s) => set.has(s.id)).map((s) => s.id);
  return catalogueSections!.get(entityUri) ?? null;
}
