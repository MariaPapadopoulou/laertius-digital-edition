/**
 * Direct answers to biography-style questions from the curated claims
 * layer, surfaced above passage retrieval. Detects question intent
 * (teachers, birth, death, writings, doctrines, ...) via keyword cues and
 * returns the matching cited claims - including rival accounts linked via
 * conflictsWith - for each philosopher named in the query.
 */
import { getClaims, type ClaimProperty, type KgClaim } from "./kg-claims";
import { corpus } from "./corpus";
import { normalizeGreek } from "./greek";

/** All corpus sections sharing a bare book.section ref, in reading order. */
let refCandidates: Map<string, { id: string; philosopher: string }[]> | null =
  null;

/**
 * book.section (Hicks) -> corpus section id. Hicks numbering restarts
 * across chapter boundaries, so a bare ref is occasionally ambiguous
 * (e.g. 2.124 belongs to Simon, Glaucon AND Simmias). When a `subject`
 * is given (the claim's philosopher), the section owned by that subject
 * wins, falling back to first-match, mirroring doxaSectionIdFor in
 * doxai.ts. Without a subject, first occurrence wins. Every consumer of
 * a claim's ref must pass the claim's subject, or Greek excerpts can be
 * validated against (and links can point to) another philosopher's
 * section.
 */
export function sectionIdForRef(
  ref: string,
  subject?: string,
): string | undefined {
  if (!refCandidates) {
    refCandidates = new Map();
    for (const s of corpus) {
      const parts = s.id.split(".");
      const key = `${parts[0]}.${parts[parts.length - 1]}`;
      let list = refCandidates.get(key);
      if (!list) {
        list = [];
        refCandidates.set(key, list);
      }
      list.push({ id: s.id, philosopher: s.philosopher });
    }
  }
  const candidates = refCandidates.get(ref);
  if (!candidates || candidates.length === 0) return undefined;
  if (subject) {
    const owned = candidates.find((c) => c.philosopher === subject);
    if (owned) return owned.id;
  }
  return candidates[0]!.id;
}

/**
 * ALL corpus section ids a bare book.section ref could denote, in reading
 * order. For consumers with no owner in scope (e.g. the sources-index
 * citation rows, which cite a source author rather than a Life's subject),
 * linking every candidate is the only correct resolution of an ambiguous
 * ref - picking the first would silently cite the wrong philosopher's
 * passage.
 */
export function sectionIdsForRef(ref: string): string[] {
  // Populate the candidate map via the single-id resolver.
  sectionIdForRef(ref);
  return (refCandidates!.get(ref) ?? []).map((c) => c.id);
}

interface IntentDef {
  topic: string;
  properties: ClaimProperty[];
  /** For these philosopher-valued properties, also match claims where the
   * named philosopher is the value (e.g. "who were Socrates' pupils"). */
  reverseProperties?: ClaimProperty[];
  pattern: RegExp;
  /**
   * Greek intent cues, matched as word-start stems on the normalized
   * query. JS \b never matches Greek letters, so these cannot live in
   * `pattern`; they are tested separately via startsWith on each word.
   */
  greekStems: string[];
}

const INTENTS: IntentDef[] = [
  {
    topic: "Teachers & studies",
    properties: ["studiedUnder", "education"],
    reverseProperties: ["studiedUnder"],
    pattern:
      /\b(teacher|teachers|taught|studied|studies|study|pupil|pupils|student|students|master|mentor|disciple|disciples|educated|education|learn(?:ed|t)?)\b/i,
    greekStems: ["μαθητ", "δασκαλ", "διδαξ", "διδαχθηκ", "σπουδασ", "εκπαιδευ"],
  },
  {
    topic: "Birth & origins",
    properties: ["birthPlace", "birthDate", "parentage", "deme"],
    pattern:
      /\b(born|birth|birthplace|native|origin|origins|come from|came from|parents|father|mother|family|son of|daughter of|deme)\b/i,
    greekStems: ["γεννη", "καταγωγ", "καταγοτ", "γονε", "πατερ", "μητερ", "οικογενει", "δημοτ"],
  },
  {
    topic: "Death",
    properties: ["deathPlace", "deathDate", "mannerOfDeath"],
    pattern: /\b(died?|death|dies|dying|killed|perish(?:ed)?|end of (?:his|her) life|passed away)\b/i,
    greekStems: ["πεθαν", "θανατ", "τελευτησ", "σκοτωθηκ"],
  },
  {
    topic: "Writings",
    properties: ["wrote", "writings"],
    pattern:
      /\b(wrote|write|written|writings|works|book|books|treatise|treatises|dialogues?|author(?:ed)?|compose[d]?)\b/i,
    greekStems: ["εγραψ", "γραπτ", "συγγραμ", "συγγραφ", "βιβλι", "πραγματει", "διαλογ"],
  },
  {
    topic: "Doctrines",
    properties: ["heldDoctrine"],
    pattern:
      /\b(doctrine|doctrines|believe[ds]?|beliefs?|held|hold|thought|think|teach(?:ing|ings)?|view|views|philosophy of|say about|says about|said about|maintain(?:ed)?|position on)\b/i,
    greekStems: ["δογμα", "διδασκαλι", "πιστευ", "υποστηριζ", "θεωρι", "αποψ", "δοξασι"],
  },
  {
    topic: "Places & travels",
    properties: ["livedIn", "traveledTo"],
    pattern: /\b(lived?|lives|travel(?:s|ed|led)?|visit(?:ed)?|journey(?:s|ed)?|went to|moved to|resided?)\b/i,
    greekStems: ["εζησ", "ζουσ", "ταξιδ", "επισκεφθηκ", "κατοικ", "εγκατασταθηκ"],
  },
  {
    topic: "School",
    properties: ["affiliatedWith"],
    // Membership/affiliation only: founder/founded ask a different
    // relation than affiliatedWith, so they are deliberately absent.
    pattern: /\b(school|schools|sect|affiliat(?:ed|ion)?|follower)\b/i,
    // "σχολη/σχολες/σχολων" not the bare "σχολ" stem, which would also
    // fire on σχολιάζω (to comment) and misroute commentary questions.
    greekStems: ["σχολη", "σχολες", "σχολων", "αιρεσ"],
  },
];

/** True when a normalized query word starts with one of the intent's Greek stems. */
function matchesGreekStems(intent: IntentDef, query: string): boolean {
  const words = normalizeGreek(query).match(/[\p{L}\p{N}_]+/gu) ?? [];
  return words.some((w) => intent.greekStems.some((s) => w.startsWith(s)));
}

export interface ClaimAnswer {
  philosopher: string;
  topic: string;
  claims: (KgClaim & { sectionId?: string })[];
}

function withSection(c: KgClaim): KgClaim & { sectionId?: string } {
  const sectionId = sectionIdForRef(c.ref, c.subject);
  return sectionId ? { ...c, sectionId } : { ...c };
}

/**
 * Claims answering the query directly, grouped per philosopher and topic.
 * Empty when the question is not biography-style or names no philosopher.
 */
export function claimAnswersFor(
  query: string,
  philosophers: string[],
): ClaimAnswer[] {
  if (philosophers.length === 0) return [];
  const intents = INTENTS.filter(
    (i) => i.pattern.test(query) || matchesGreekStems(i, query),
  );
  if (intents.length === 0) return [];

  const all = getClaims();
  const byId = new Map(all.map((c) => [c.id, c]));
  const answers: ClaimAnswer[] = [];

  for (const name of philosophers) {
    for (const intent of intents) {
      const props = new Set<ClaimProperty>(intent.properties);
      const reverse = new Set<ClaimProperty>(intent.reverseProperties ?? []);
      const picked = new Map<string, KgClaim>();
      for (const c of all) {
        const direct = c.subject === name && props.has(c.property);
        const rev =
          reverse.has(c.property) &&
          c.value === name &&
          c.valueType === "philosopher";
        if (direct || rev) picked.set(c.id, c);
      }
      // Pull in rival accounts even if they were curated under another
      // property or subject, so conflicting reports appear side by side.
      for (const c of [...picked.values()]) {
        for (const otherId of c.conflictsWith ?? []) {
          const other = byId.get(otherId);
          if (other) picked.set(other.id, other);
        }
      }
      if (picked.size === 0) continue;
      answers.push({
        philosopher: name,
        topic: intent.topic,
        claims: [...picked.values()].map(withSection),
      });
    }
  }
  return answers;
}
