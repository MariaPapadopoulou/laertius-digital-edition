import { Router, type IRouter } from "express";
import {
  GetSectionAnnotationsResponse,
  ListAnnotatedEntitiesResponse,
  ListEntitySectionsQueryParams,
  ListEntitySectionsResponse,
} from "@workspace/api-zod";
import { sectionById } from "../lib/corpus";
import {
  annotateSection,
  getIndexEntries,
  sectionsForEntity,
} from "../lib/annotate";
import {
  doctrineConceptsForTerm,
  otbObjectIdForEntity,
} from "../lib/otb-entity-links";

const router: IRouter = Router();

const SNIPPET_RADIUS = 90;

/**
 * Short English excerpt centered on the first English tag occurrence of
 * the entity; falls back to the opening of the English text when the
 * entity is only tagged in the Greek (or, for catalogue-backed works,
 * not tagged in the section at all). Returns undefined when the section
 * has no English translation.
 */
export function buildSnippet(
  textEn: string | null,
  enAnnotations: { start: number; end: number }[],
): { snippet: string; snippetStart?: number; snippetEnd?: number } | undefined {
  if (!textEn) return undefined;
  const hit = enAnnotations[0];
  if (!hit) {
    if (textEn.length <= SNIPPET_RADIUS * 2) return { snippet: textEn };
    let cut = textEn.lastIndexOf(" ", SNIPPET_RADIUS * 2);
    if (cut < SNIPPET_RADIUS) cut = SNIPPET_RADIUS * 2;
    return { snippet: `${textEn.slice(0, cut).trimEnd()}\u2026` };
  }
  let from = hit.start - SNIPPET_RADIUS;
  let to = hit.end + SNIPPET_RADIUS;
  if (from <= 0) from = 0;
  else {
    const sp = textEn.lastIndexOf(" ", from);
    from = sp > 0 ? sp + 1 : from;
  }
  if (to >= textEn.length) to = textEn.length;
  else {
    const sp = textEn.indexOf(" ", to);
    to = sp > 0 ? sp : to;
  }
  const prefix = from > 0 ? "\u2026" : "";
  const suffix = to < textEn.length ? "\u2026" : "";
  const body = textEn.slice(from, to);
  return {
    snippet: `${prefix}${body}${suffix}`,
    snippetStart: prefix.length + (hit.start - from),
    snippetEnd: prefix.length + (hit.end - from),
  };
}

router.get("/sections/:id/annotations", (req, res) => {
  const section = sectionById.get(req.params.id);
  if (!section) {
    res.status(404).json({ error: `Unknown section: ${req.params.id}` });
    return;
  }
  res.json(
    GetSectionAnnotationsResponse.parse({
      sectionId: section.id,
      annotations: annotateSection(section),
    }),
  );
});

/**
 * The exact entities payload /annotations/entities serves, exported so
 * validate-page-contracts can compare the live shape against the OpenAPI
 * AnnotatedEntity schema.
 */
export function buildAnnotatedEntities() {
  return getIndexEntries().map((e) => {
    const otbObjectId = otbObjectIdForEntity(e.kind, e.label);
    const denotedConcepts =
      e.kind === "term" ? doctrineConceptsForTerm(e.label) : undefined;
    return {
      ...e,
      ...(otbObjectId ? { otbObjectId } : {}),
      ...(denotedConcepts && denotedConcepts.length > 0
        ? { denotedConcepts }
        : {}),
    };
  });
}

router.get("/annotations/entities", (req, res) => {
  res.json(ListAnnotatedEntitiesResponse.parse(buildAnnotatedEntities()));
});

router.get("/annotations/sections", (req, res) => {
  const raw = req.query["entity"];
  if (typeof raw !== "string" || raw.trim() === "") {
    res.status(400).json({ error: "Missing required query parameter: entity" });
    return;
  }
  const parsed = ListEntitySectionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }
  const { entity } = parsed.data;
  const built = buildEntitySections(entity);
  if (!built) {
    res.status(404).json({ error: `Entity never tagged: ${entity}` });
    return;
  }
  const summary = getIndexEntries().find((e) => e.entityUri === entity);
  res.json(
    ListEntitySectionsResponse.parse({
      entityUri: entity,
      label: summary?.label ?? entity,
      kind: summary?.kind ?? "term",
      ...(summary?.altTitle ? { altTitle: summary.altTitle } : {}),
      sections: built,
    }),
  );
});

/**
 * The exact (pre-Zod) per-section rows /annotations/sections serves for
 * an entity, exported so validate-page-contracts can compare the inline
 * sections items of the OpenAPI EntityOccurrences schema against the
 * served shape before response validation strips undeclared keys.
 * Returns undefined when the entity was never tagged.
 */
export function buildEntitySections(entity: string) {
  const sectionIds = sectionsForEntity(entity);
  if (!sectionIds) return undefined;
  return sectionIds.map((id) => {
    const section = sectionById.get(id)!;
    const tagged = annotateSection(section).filter(
      (a) => a.entityUri === entity,
    );
    const enHits = tagged
      .filter((a) => a.lang === "en")
      .sort((a, b) => a.start - b.start);
    return {
      id,
      book: section.book,
      philosopher: section.philosopher,
      // Catalogue-backed works (double-titled dialogues) carry no tags in
      // the section; the catalogue line itself is the one occurrence.
      occurrences: tagged.length > 0 ? tagged.length : 1,
      ...buildSnippet(section.textEn, enHits),
    };
  });
}

export default router;
