/**
 * OTB model builder: assembles the ontoterminological knowledge base of the
 * full corpus, mirroring the curator's TEDI 4.1 reference export.
 *
 * Sourcing rules (same discipline as the main LOD layer):
 *   - Individual-level relations carry ASSERTED facts only; hedged material
 *     (reported/disputed/conjectured) lives exclusively in Assertion objects
 *     with their confidence and certainty values.
 *   - No new knowledge is minted: every object comes from an existing
 *     curated layer (KG nodes, claims, sources index, works, documents).
 *   - Proper names are never guessed; Greek names come from the
 *     curated GREEK_NAMES table and the sources workbook respectively.
 *
 * Fragment scheme (one hash namespace, collisions are a build error):
 *   persons/philosophers/schools/sages  lowerCamel(label)   (reference style)
 *   places       place-<slug>          works        work-<slug>
 *   sources      src-<Camel>           documents    testament-/epistle-/
 *                                                   verse-/saying-/anecdote-/
 *                                                   opinion-<id>
 *   assertions   assert-<claimId>      texts        txt-<claimId>
 */
import { getKnowledgeGraph, MOVEMENTS, type MovementId } from "../kg";
import { getClaims, type KgClaim } from "../kg-claims";
import { MENTION_PERSONS } from "../person-mentions";
import { MENTION_PLACES } from "../place-mentions";
import { sectionIdForRef } from "../claims-answer";
import { getSourcesIndex } from "../sources-index";
import { SOURCE_WORKS } from "../source-works";
import { PERSON_WORKS } from "../person-works";
import { GREEK_NAMES } from "../greek-names";
import { SUCCESSION_LINKS } from "../succession-links";
import { SCHOOL_MEMBERS } from "../school-members";
import { PLACE_COORDS } from "../place-coords";
import { getTimeline } from "../timeline";
import { getTestaments } from "../testaments";
import { getEpistles } from "../epistles";
import { verses } from "../verses";
import { getSayings } from "../sayings";
import { getAnecdotes } from "../anecdotes";
import { getDoxai } from "../doxai";
import {
  CATEGORIES,
  CONCEPTS,
  RELATIONS,
  ATTRIBUTES,
  TOPICS,
  TERMS,
  PROPERTY_TOPIC,
  DOXA_DOMAIN_TOPIC,
  conceptCategory,
  type OtbConceptDef,
  type OtbRelationDef,
  type OtbAttributeDef,
  type OtbTermDef,
} from "./inventory";

/** Base URI of the curator's TEDI project; exports merge into it. */
export const OTB_BASE =
  "http://www.ontologia.fr/OTB/diogenes_laertius_22_07_26#";
/** Export metadata, pinned so the file is reproducible. */
export const OTB_META = {
  title: "Diogenes Laertius",
  author: "Maria Papadopoulou",
  publisher: "University of Crete - Philographia & TALOS Lab",
  creationDate: "19/07/2026",
  exportDate: "22/07/2026",
  description:
    "Ontoterminology of Diogenes Laertius' Lives and Opinions of Eminent Philosophers: persons, schools, places, works, embedded textual genres and cited assertions of the full corpus.",
};

export interface OtbObject {
  id: string;
  label: string;
  concept: string;
  category: string;
  note?: string;
  literals: { attr: string; value: string; lang?: string }[];
  relations: { rel: string; target: string }[];
  /** ProperName fragment ids denoting this object. */
  names: string[];
}

export interface OtbProperName {
  id: string;
  name: string;
  lang: string;
  object: string;
  allonyms: string[];
}

export interface OtbModel {
  base: string;
  meta: typeof OTB_META;
  categories: string[];
  concepts: OtbConceptDef[];
  relations: OtbRelationDef[];
  attributes: OtbAttributeDef[];
  terms: OtbTermDef[];
  objects: OtbObject[];
  properNames: OtbProperName[];
  /** Human-readable notes on every deviation from the reference export. */
  extensions: string[];
}

const CONFIDENCE: Record<KgClaim["certainty"], "high" | "medium" | "low"> = {
  asserted: "high",
  reported: "medium",
  disputed: "low",
  conjectured: "low",
};

const CTS_PREFIX =
  "https://scaife.perseus.org/reader/urn:cts:greekLit:tlg0004.tlg001.perseus-grc2:";

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** lowerCamel fragment from a label ("Zeno of Citium" -> zenoOfCitium). */
export function lowerCamel(label: string): string {
  const words = stripDiacritics(label)
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  if (words.length === 0) throw new Error(`otb: empty fragment for "${label}"`);
  return words
    .map((w, i) =>
      i === 0
        ? w.charAt(0).toLowerCase() + w.slice(1)
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join("");
}

/** UpperCamel, for ProperName fragments (`ZenoOfCitium_en`). */
export function upperCamel(label: string): string {
  const c = lowerCamel(label);
  return c.charAt(0).toUpperCase() + c.slice(1);
}

/** NCName-safe id suffix: keeps letters, digits, '.', '-', '_'. */
function safeId(id: string): string {
  return id.replace(/[^A-Za-z0-9._-]+/g, "-");
}

function slug(label: string): string {
  return stripDiacritics(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

class ModelBuilder {
  objects = new Map<string, OtbObject>();
  properNames = new Map<string, OtbProperName>();
  /** label -> object fragment, per broad kind, for lookups. */
  personByLabel = new Map<string, string>();
  schoolByMovement = new Map<string, string>();
  placeByLabel = new Map<string, string>();

  addObject(o: Omit<OtbObject, "category" | "literals" | "relations" | "names"> &
    Partial<Pick<OtbObject, "literals" | "relations" | "names">>): OtbObject {
    const existing = this.objects.get(o.id);
    if (existing) {
      if (existing.concept !== o.concept || existing.label !== o.label) {
        throw new Error(
          `otb: fragment collision on #${o.id}: ` +
            `${existing.concept} "${existing.label}" vs ${o.concept} "${o.label}"`,
        );
      }
      return existing;
    }
    const full: OtbObject = {
      ...o,
      category: conceptCategory(o.concept),
      literals: o.literals ?? [],
      relations: o.relations ?? [],
      names: o.names ?? [],
    };
    this.objects.set(o.id, full);
    return full;
  }

  relate(objId: string, rel: string, target: string): void {
    const o = this.objects.get(objId);
    const t = this.objects.get(target);
    if (!o || !t) return;
    if (o.relations.some((r) => r.rel === rel && r.target === target)) return;
    o.relations.push({ rel, target });
  }

  literal(objId: string, attr: string, value: string): void {
    const o = this.objects.get(objId);
    if (!o) return;
    if (o.literals.some((l) => l.attr === attr)) return;
    o.literals.push({ attr, value });
  }

  /**
   * Attach a proper name to an object. Fragment `<UpperCamelBase>_<lang>`;
   * the en-derived base keeps Greek/French fragments unique across the
   * corpus' shared Greek name forms. Skips silently when another object
   * already owns the fragment (alt labels may repeat a primary name).
   */
  name(objId: string, base: string, value: string, lang: string): string | null {
    const id = `${upperCamel(base)}_${lang}`;
    const existing = this.properNames.get(id);
    if (existing) {
      return existing.object === objId ? id : null;
    }
    this.properNames.set(id, { id, name: value, lang, object: objId, allonyms: [] });
    const o = this.objects.get(objId);
    if (o && !o.names.includes(id)) o.names.push(id);
    return id;
  }

  /** Mark two proper names of the same object as allonyms of each other. */
  allonym(a: string | null, b: string | null): void {
    if (!a || !b || a === b) return;
    const na = this.properNames.get(a);
    const nb = this.properNames.get(b);
    if (!na || !nb || na.object !== nb.object) return;
    if (!na.allonyms.includes(b)) na.allonyms.push(b);
    if (!nb.allonyms.includes(a)) nb.allonyms.push(a);
  }

  /** Person object by label, minting a plain Person when absent. */
  ensurePerson(label: string): string {
    const known = this.personByLabel.get(label);
    if (known) return known;
    const id = lowerCamel(label);
    this.addObject({ id, label, concept: "Person" });
    this.personByLabel.set(label, id);
    this.name(id, label, label, "en");
    const grc = GREEK_NAMES[label]?.grc;
    if (grc) this.name(id, `${label} grc`, grc, "grc");
    return id;
  }
}

let cached: OtbModel | null = null;

export function getOtbModel(): OtbModel {
  if (cached) return cached;
  const b = new ModelBuilder();
  const kg = getKnowledgeGraph();

  // ---------------------------------------------------------- anchors
  const DL = "diogenesLaertius";
  b.addObject({
    id: DL,
    label: "Diogenes Laertius",
    concept: "Person",
    note: "Author of the Lives and Opinions of Eminent Philosophers; default asserting voice of every assertion he does not attribute.",
  });
  b.personByLabel.set("Diogenes Laertius", DL);
  b.name(DL, "Diogenes Laertius", "Diogenes Laertius", "en");
  const grcDL = GREEK_NAMES["Diogenes Laertius"]?.grc;
  if (grcDL) b.name(DL, "Diogenes Laertius grc", grcDL, "grc");

  const LIVES = "livesOfEminentPhilosophers";
  b.addObject({
    id: LIVES,
    label: "Lives and Opinions of Eminent Philosophers",
    concept: "CitedSource",
    note: "The work itself (Perseus urn:cts:greekLit:tlg0004.tlg001.perseus-grc2); every assertion of this knowledge base is asserted in it.",
  });
  b.relate(DL, "wrote", LIVES);

  const SAGES = "groupOfSages";
  b.addObject({
    id: SAGES,
    label: "Group of Sages",
    concept: "GroupOfSages",
    note: "The canon of the Sages of Book 1; Diogenes Laertius reports seventeen candidates for the Seven (1.41-42).",
  });

  // ---------------------------------------------------------- schools
  for (const m of MOVEMENTS) {
    if (m.id === "seven-sages" || m.id === "other") continue;
    const id = lowerCamel(m.label);
    b.addObject({ id, label: m.label, concept: "PhilosophicalSchool" });
    b.schoolByMovement.set(m.id, id);
    b.name(id, m.label, m.label, "en");
  }

  // ---------------------------------------------------------- places
  for (const label of Object.keys(PLACE_COORDS)) {
    const id = `place-${slug(label)}`;
    b.addObject({ id, label, concept: "Place" });
    b.placeByLabel.set(label, id);
    b.name(id, `${label} place`, label, "en");
    const grc = GREEK_NAMES[label]?.grc;
    if (grc) b.name(id, `${label} place grc`, grc, "grc");
  }
  // Curated mention places (named in the text, no itinerary of their own).
  for (const p of MENTION_PLACES) {
    if (b.placeByLabel.has(p.label)) continue;
    const id = `place-${slug(p.label)}`;
    b.addObject({ id, label: p.label, concept: "Place" });
    b.placeByLabel.set(p.label, id);
    b.name(id, `${p.label} place`, p.label, "en");
    const grc = GREEK_NAMES[p.label]?.grc;
    if (grc) b.name(id, `${p.label} place grc`, grc, "grc");
  }

  // ------------------------------------------------------ philosophers
  const timeline = new Map(getTimeline().map((t) => [t.name, t]));
  for (const node of kg.nodes) {
    const id = lowerCamel(node.name);
    b.addObject({
      id,
      label: node.name,
      concept: "Philosopher",
      note: `Life of ${node.name}: book ${node.book}, D.L. ${node.firstId}.`,
    });
    b.personByLabel.set(node.name, id);
    b.name(id, node.name, node.name, "en");
    const grc = GREEK_NAMES[node.name]?.grc;
    if (grc) b.name(id, `${node.name} grc`, grc, "grc");

    if (node.movement === "seven-sages") {
      b.relate(id, "isMemberOf", SAGES);
    } else if (node.movement !== "other") {
      const school = b.schoolByMovement.get(node.movement);
      if (school) b.relate(id, "isMemberOf", school);
    }
    if (node.founderOf) {
      const school = b.schoolByMovement.get(node.founderOf);
      if (school) {
        b.relate(id, "isFounderOf", school);
        b.relate(school, "foundedBy", id);
      }
    }
    const t = timeline.get(node.name);
    if (t?.birthYear !== undefined && !t.approxBirth) {
      b.literal(id, "hasBirthDate", String(t.birthYear));
    }
    if (t?.deathYear !== undefined && !t.approxDeath) {
      b.literal(id, "hasDeathDate", String(t.deathYear));
    }
  }

  // ------------------------------------------ persons (curated mentions)
  // Before the sources index and later ensurePerson callers, so those
  // reuse these richer nodes (comment as note) instead of minting bare
  // Person objects for the same label.
  for (const p of MENTION_PERSONS) {
    if (b.personByLabel.has(p.label)) continue;
    const id = lowerCamel(p.label);
    b.addObject({ id, label: p.label, concept: "Person", note: p.comment });
    b.personByLabel.set(p.label, id);
    b.name(id, p.label, p.label, "en");
    const grc = GREEK_NAMES[p.label]?.grc;
    if (grc) b.name(id, `${p.label} grc`, grc, "grc");
  }

  // -------------------------------------------- persons (sources index)
  for (const g of getSourcesIndex().groups) {
    let id: string;
    if (g.kind === "philosopher" && b.personByLabel.has(g.label)) {
      id = b.personByLabel.get(g.label)!;
    } else {
      id = b.ensurePerson(g.label);
    }
    const primary = `${upperCamel(g.label)}_en`;
    for (const alt of g.altLabels) {
      const altId = b.name(id, alt, alt, "en");
      b.allonym(primary, altId);
    }
    if (g.nameGrc) b.name(id, `${g.label} grc`, g.nameGrc, "grc");
  }

  // -------------------------------------- teacher/pupil (asserted only)
  for (const e of kg.edges) {
    if (e.type !== "teacherOf") continue;
    const teacher = b.personByLabel.get(e.from);
    const pupil = b.personByLabel.get(e.to);
    if (!teacher || !pupil) continue;
    b.relate(teacher, "isTeacherOf", pupil);
    b.relate(pupil, "isPupilOf", teacher);
  }
  for (const link of SUCCESSION_LINKS) {
    if (!link.asserted) continue;
    const teacher = b.ensurePerson(link.teacher.label);
    const pupil = b.ensurePerson(link.pupil.label);
    b.relate(teacher, "isTeacherOf", pupil);
    b.relate(pupil, "isPupilOf", teacher);
  }

  // ------------------------------------ school members (asserted only)
  for (const m of SCHOOL_MEMBERS) {
    if (!m.asserted) continue;
    const school = b.schoolByMovement.get(m.school);
    if (!school) continue;
    const person = b.ensurePerson(m.label);
    b.relate(person, "isMemberOf", school);
  }

  // ---------------------------------------------------------- works
  for (const w of SOURCE_WORKS) {
    const id = `src-${upperCamel(`${w.source} ${w.title}`)}`;
    b.addObject({
      id,
      label: `${w.source}, ${w.title}`,
      concept: "CitedSource",
      note: w.comment,
    });
    const author = b.ensurePerson(w.source);
    b.relate(author, "wrote", id);
  }
  for (const w of PERSON_WORKS) {
    const id = `work-${slug(`${w.person} ${w.title}`)}`;
    b.addObject({
      id,
      label: `${w.person}, ${w.title}`,
      concept: "Work",
      note: w.comment,
    });
    const author = b.ensurePerson(w.person);
    b.relate(author, "wrote", id);
  }

  // ---------------------------------------------------------- topics
  // Must precede the claims loop: relate() only links existing objects.
  for (const t of TOPICS) {
    b.addObject({ id: t.id, label: t.id, concept: t.concept });
  }

  // ---------------------------------------------------------- claims
  for (const c of getClaims()) {
    const subject = b.personByLabel.get(c.subject);

    // Asserted facts surface as individual-level relations and objects.
    if (c.certainty === "asserted" && subject) {
      if (c.property === "birthPlace" && c.valueType === "place") {
        const place = b.placeByLabel.get(c.value);
        if (place) {
          b.relate(subject, "hasBirthPlace", place);
          b.relate(place, "isBirthPlaceOf", subject);
        }
      }
      if (
        (c.property === "wrote" || c.property === "writings") &&
        c.valueType === "work"
      ) {
        const id = `work-${slug(`${c.subject} ${c.value}`)}`;
        b.addObject({
          id,
          label: `${c.subject}, ${c.value}`,
          concept: "Work",
          note: `Attributed to ${c.subject} at D.L. ${c.ref}.`,
        });
        b.relate(subject, "wrote", id);
      }
    }

    // Every claim, whatever its certainty, becomes an Assertion + Text.
    const cid = safeId(c.id);
    const txtId = `txt-${cid}`;
    const sectionId = sectionIdForRef(c.ref, c.subject) ?? c.ref;
    const txtLiterals: OtbObject["literals"] = [
      { attr: "cts", value: `${CTS_PREFIX}${sectionId}/` },
    ];
    if (c.grc) txtLiterals.push({ attr: "text", value: c.grc, lang: "grc" });
    b.addObject({
      id: txtId,
      label: txtId,
      concept: "Text",
      literals: txtLiterals,
    });

    const assertId = `assert-${cid}`;
    const asserter = c.accordingTo ? b.ensurePerson(c.accordingTo) : DL;
    const noteParts = [`${c.subject} ${c.property}: ${c.value} (D.L. ${c.ref})`];
    if (c.note) noteParts.push(c.note);
    const a = b.addObject({
      id: assertId,
      label: `${c.subject} ${c.property}: ${c.value}`,
      concept: "Assertion",
      note: noteParts.join(" - "),
      literals: [
        { attr: "confidence", value: CONFIDENCE[c.certainty] },
        { attr: "certainty", value: c.certainty },
      ],
    });
    void a;
    b.relate(assertId, "assertedBy", asserter);
    b.relate(assertId, "assertedIn", LIVES);
    b.relate(assertId, "hasContent", txtId);
    const topic = PROPERTY_TOPIC[c.property];
    if (topic) b.relate(assertId, "hasTopic", topic);
    if (subject) b.relate(assertId, "isAbout", subject);
  }

  // -------------------------------------------------------- documents
  // Every embedded document carries its verbatim excerpt as a Text
  // object (txt-<document id>) linked via hasContent, with language-
  // tagged Greek and English literals; the cts anchor points at the
  // document's primary D.L. citation.
  const addDocText = (
    docId: string,
    sectionId: string,
    texts: { value: string; lang: string }[],
  ): void => {
    const literals: OtbObject["literals"] = [
      { attr: "cts", value: `${CTS_PREFIX}${sectionId}/` },
    ];
    for (const t of texts) {
      if (t.value.trim().length === 0) continue;
      literals.push({ attr: "text", value: t.value, lang: t.lang });
    }
    const txtId = `txt-${docId}`;
    b.addObject({ id: txtId, label: txtId, concept: "Text", literals });
    b.relate(docId, "hasContent", txtId);
  };

  for (const t of getTestaments()) {
    const id = `testament-${safeId(t.id)}`;
    b.addObject({
      id,
      label: `Testament of ${t.philosopher}`,
      concept: "Testament",
      note: `${t.gloss} (D.L. ${t.ref})`,
    });
    const p = b.personByLabel.get(t.philosopher);
    if (p) b.relate(id, "isRelatedTo", p);
    addDocText(id, t.ref, [
      { value: t.grc, lang: "grc" },
      { value: t.en, lang: "en" },
    ]);
  }
  for (const e of getEpistles()) {
    const id = `epistle-${safeId(e.id)}`;
    b.addObject({
      id,
      label: `Epistle: ${e.sender} to ${e.to}`,
      concept: "Epistle",
      note: `${e.gloss} (D.L. ${e.ref})`,
    });
    const sender = b.personByLabel.get(e.sender);
    if (sender) b.relate(id, "isRelatedTo", sender);
    const addressee = b.personByLabel.get(e.to);
    if (addressee) b.relate(id, "isRelatedTo", addressee);
    addDocText(id, e.ref, [
      ...(e.grc ? [{ value: e.grc, lang: "grc" }] : []),
      { value: e.en, lang: "en" },
    ]);
  }
  for (const v of verses) {
    const id = `verse-${safeId(v.id)}`;
    const concept = v.genre === "epigram" ? "Epigram" : "Verse";
    const attribution = v.author ? `, attributed to ${v.author}` : "";
    b.addObject({
      id,
      label: `Verses at D.L. ${v.sectionId}${attribution}`,
      concept,
      note: v.linesGrc[0],
    });
    const owner = b.personByLabel.get(v.philosopher);
    if (owner) b.relate(id, "isRelatedTo", owner);
    if (v.author && v.author !== v.philosopher) {
      const author = b.personByLabel.get(v.author);
      if (author) b.relate(id, "isRelatedTo", author);
    }
    addDocText(id, v.sectionId, [
      { value: v.linesGrc.join("\n"), lang: "grc" },
      ...(v.linesEn ? [{ value: v.linesEn.join("\n"), lang: "en" }] : []),
    ]);
  }
  for (const s of getSayings()) {
    const id = `saying-${safeId(s.id)}`;
    b.addObject({
      id,
      label: `Saying of ${s.philosopher}: ${s.gloss}`,
      concept: "Saying",
      note: `${s.en} (D.L. ${s.ref})`,
    });
    const p = b.personByLabel.get(s.philosopher);
    if (p) b.relate(id, "isRelatedTo", p);
    addDocText(id, sectionIdForRef(s.ref, s.philosopher) ?? s.ref, [
      ...(s.grc ? [{ value: s.grc, lang: "grc" }] : []),
      { value: s.en, lang: "en" },
    ]);
  }
  for (const a of getAnecdotes()) {
    const id = `anecdote-${safeId(a.id)}`;
    b.addObject({
      id,
      label: `Anecdote of ${a.philosopher}: ${a.gloss}`,
      concept: "Anecdotes",
      note: `${a.gloss} (D.L. ${a.ref})`,
    });
    const p = b.personByLabel.get(a.philosopher);
    if (p) b.relate(id, "isRelatedTo", p);
    addDocText(id, sectionIdForRef(a.ref, a.philosopher) ?? a.ref, [
      ...(a.grc ? [{ value: a.grc, lang: "grc" }] : []),
      { value: a.en, lang: "en" },
    ]);
  }
  for (const d of getDoxai()) {
    const id = `opinion-${safeId(d.id)}`;
    b.addObject({
      id,
      label: `Opinion of ${d.philosopher}: ${d.gloss}`,
      concept: "Opinions",
      note: `${d.gloss} (D.L. ${d.ref})`,
    });
    const p = b.personByLabel.get(d.philosopher);
    if (p) b.relate(id, "isRelatedTo", p);
    b.relate(id, "hasTopic", DOXA_DOMAIN_TOPIC[d.domain] ?? "doctrine");
    addDocText(id, sectionIdForRef(d.ref, d.philosopher) ?? d.ref, [
      ...(d.grc ? [{ value: d.grc, lang: "grc" }] : []),
      { value: d.en, lang: "en" },
    ]);
  }

  cached = {
    base: OTB_BASE,
    meta: OTB_META,
    categories: CATEGORIES,
    concepts: CONCEPTS,
    relations: RELATIONS,
    attributes: ATTRIBUTES,
    terms: TERMS,
    objects: [...b.objects.values()],
    properNames: [...b.properNames.values()],
    extensions: [
      "Concept Saying (isA Document): home of the 637 curated apophthegmata; the reference export models Anecdotes, Opinions and Verse but no Saying concept.",
      "Relation isAbout (Assertion to Person): makes the assertion subject navigable; the reference leaves it implicit in the text excerpt.",
      "Relation wrote (Person to Work or CitedSource): authorship for the curated source works and person works.",
      "Relation isRelatedTo axiomatized (Document to Person): the reference declares it without axioms; here it anchors every embedded document to its philosopher.",
      "Attribute certainty (Assertion): preserves the corpus' four-valued certainty next to the reference's high/medium/low confidence.",
      "Topic objects for the remaining claim properties (residence, travel, parentage, authorship, education, affiliation, praise, criticism, doctrine, successionTopic) and the corrected spelling accidentalDeath.",
      "Relation hasContent widened (domain Assertion or Document): every embedded testament, epistle, verse, saying, anecdote and opinion carries its verbatim excerpt as a Text object; the reference restricts hasContent to Assertion.",
      "Relation hasTopic widened (domain Assertion or Document): every doxa points at its doctrinal subject (arche, physis, kosmos, psyche, the divine, knowledge, logos, hedone, heimarmene) where the fit is exact, with the generic doctrine topic as fallback; the reference restricts hasTopic to Assertion.",
      "skos:example on concepts: hand-picked illustrative objects for every instantiated concept; the reference declares no examples.",
      "Language-tagged text literals: Greek and English excerpts carry xml:lang (grc, en); the reference's text attribute is untagged.",
      "Mention persons and mention places catalogued: the curated layers of people and places named in the text without a Life or itinerary of their own join the object inventory.",
      "Concept TopicSoul (isA Topic) with terms ψυχή (preferred) and πνεῦμα (admitted, the Stoic term for the soul's substance): the soul as a doctrinal subject; the reference inventory has no term for it.",
      "Concept TopicKnowledge (isA Topic) with terms γνῶσις (preferred) and ἐπιστήμη (admitted, the Stoics' unshakable apprehension, D.L. 7.47): knowledge as a doctrinal subject; the reference inventory has no term for it.",
    ],
  };
  return cached;
}
