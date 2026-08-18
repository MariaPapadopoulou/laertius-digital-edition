/**
 * Builds the Graph page's satellite "associates" list from the cited
 * school rosters (school-members.ts) and the succession chains
 * (succession-links.ts). Extracted from routes/graph.ts so the
 * validate-graph-associates script checks the exact code path the
 * /api/graph endpoint serves: the associates are joined at runtime by
 * label (roster label -> founder anchor via PHILOSOPHER_META.founderOf,
 * pupil label -> teacher label), so a roster edit or a label rename
 * that breaks a join would otherwise silently drop satellites from the
 * Graph page with no failing check.
 *
 * Join rules (all deliberate):
 * - Every member's school must have a KG founder (founderOf in
 *   PHILOSOPHER_META); a missing founder throws rather than dropping
 *   the school's satellites.
 * - A succession link contributes a teacher leg only when its pupil is
 *   a roster member and its teacher is drawable: a KG node or another
 *   associate. Asserted links win over hedged ones when a pupil has
 *   both (Dioscurides: D.L.'s own voice at 9.114 beats the disputed
 *   9.115 list).
 */

import { getKnowledgeGraph, PHILOSOPHER_META } from "./kg";
import { SCHOOL_MEMBERS } from "./school-members";
import { SUCCESSION_LINKS } from "./succession-links";
import { sectionIdForRef } from "./claims-answer";

export interface GraphAssociate {
  name: string;
  movement: string;
  movementLabel: string;
  anchor: string;
  ref: string;
  sectionId?: string;
  note?: string;
  asserted: boolean;
  teacher?: string;
  teacherAsserted?: boolean;
}

export function buildGraphAssociates(): GraphAssociate[] {
  const g = getKnowledgeGraph();
  const movementLabelById = new Map(g.movements.map((m) => [m.id, m.label]));
  const founderByMovement = new Map<string, string>();
  for (const [name, meta] of Object.entries(PHILOSOPHER_META)) {
    if (meta.founderOf) founderByMovement.set(meta.founderOf, name);
  }
  const memberLabels = new Set(SCHOOL_MEMBERS.map((m) => m.label));
  const kgNames = new Set(g.nodes.map((n) => n.name));
  const teacherByPupil = new Map<
    string,
    { teacher: string; asserted: boolean }
  >();
  for (const link of SUCCESSION_LINKS) {
    if (!memberLabels.has(link.pupil.label)) continue;
    if (
      !kgNames.has(link.teacher.label) &&
      !memberLabels.has(link.teacher.label)
    ) {
      continue;
    }
    const prev = teacherByPupil.get(link.pupil.label);
    if (prev && (prev.asserted || !link.asserted)) continue;
    teacherByPupil.set(link.pupil.label, {
      teacher: link.teacher.label,
      asserted: link.asserted,
    });
  }
  return SCHOOL_MEMBERS.map((m) => {
    const anchor = founderByMovement.get(m.school);
    if (!anchor) {
      throw new Error(`No KG founder for school "${m.school}"`);
    }
    // Owner-aware: ambiguous Hicks refs (chapter-restart numbering) must
    // resolve to the member's own section, not the first bearer of the ref.
    const sectionId = sectionIdForRef(m.ref, m.label);
    const t = teacherByPupil.get(m.label);
    return {
      name: m.label,
      movement: m.school,
      movementLabel: movementLabelById.get(m.school) ?? m.school,
      anchor,
      ref: m.ref,
      ...(sectionId ? { sectionId } : {}),
      ...(m.note ? { note: m.note } : {}),
      asserted: m.asserted,
      ...(t ? { teacher: t.teacher, teacherAsserted: t.asserted } : {}),
    };
  });
}
