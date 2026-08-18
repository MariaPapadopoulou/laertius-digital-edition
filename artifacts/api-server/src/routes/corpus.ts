import { Router, type IRouter } from "express";
import {
  GetCorpusStatsResponse,
  ListPhilosophersResponse,
  ListSectionsQueryParams,
  ListSectionsResponse,
  GetSectionParams,
  GetSectionResponse,
} from "@workspace/api-zod";
import {
  corpus,
  sectionById,
  philosophers,
  englishCoverage,
  totalGreekWords,
} from "../lib/corpus";
import { denseIndexReady, embeddedSectionCount } from "../lib/dense";
import { externalLinksFor } from "../lib/kg";
import {
  schoolGrcForCorpusLabel,
  displaySchoolLabel,
} from "../lib/greek-names";
import { KG_CLAIMS } from "../lib/kg-claims";
import { verses } from "../lib/verses";
import { getSayings } from "../lib/sayings";
import { getAnecdotes } from "../lib/anecdotes";
import { getEpistles } from "../lib/epistles";
import { getTestaments } from "../lib/testaments";
import { getDoxai } from "../lib/doxai";
import { getEntitySummaries } from "../lib/annotate";
import { getSourcesIndex } from "../lib/sources-index";

const router: IRouter = Router();

router.get("/corpus/stats", (_req, res) => {
  const entities = getEntitySummaries();
  const data = GetCorpusStatsResponse.parse({
    totalSections: corpus.length,
    totalBooks: new Set(corpus.map((s) => s.book)).size,
    totalPhilosophers: philosophers.length,
    englishCoverage,
    indexReady: denseIndexReady(),
    embeddedSections: embeddedSectionCount(),
    totalClaims: KG_CLAIMS.length,
    totalVerses: verses.length,
    totalSayings: getSayings().length,
    totalAnecdotes: getAnecdotes().length,
    totalEpistles: getEpistles().length,
    totalTestaments: getTestaments().length,
    totalDoxai: getDoxai().length,
    taggedEntities: entities.length,
    totalAnnotations: entities.reduce((n, e) => n + e.occurrences, 0),
    sourceCitations: getSourcesIndex().rows.length,
    totalGreekWords,
  });
  res.json(data);
});

/** The enriched Philosopher rows exactly as /philosophers serves them
 * (exported so validate-page-contracts samples the real served shape). */
export function buildPhilosophersList() {
  return philosophers.map((p) => ({
    ...p,
    // Display form (e.g. "Garden (Epicurus)" renders as "Garden"); the
    // Greek lookup keys on the canonical label BEFORE the override.
    school: displaySchoolLabel(p.school),
    // Greek tradition form from the single curated map (greek-names.ts);
    // labels without a curated form (none today) stay English-only.
    schoolGrc: schoolGrcForCorpusLabel(p.school),
    externalLinks: externalLinksFor(p.name),
  }));
}

router.get("/philosophers", (_req, res) => {
  res.json(ListPhilosophersResponse.parse(buildPhilosophersList()));
});

router.get("/sections", (req, res) => {
  const parsed = ListSectionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }
  const { book, philosopher } = parsed.data;
  let results = corpus;
  if (book !== undefined) {
    results = results.filter((s) => s.book === book);
  }
  if (philosopher !== undefined) {
    const needle = philosopher.toLowerCase();
    results = results.filter((s) =>
      s.philosopher.toLowerCase().includes(needle),
    );
  }
  res.json(ListSectionsResponse.parse(results.map(buildSectionListItem)));
});

/** A /sections list row exactly as served (exported for
 * validate-page-contracts). */
export function buildSectionListItem(s: (typeof corpus)[number]) {
  return {
    ...s,
    school: displaySchoolLabel(s.school),
    schoolGrc: schoolGrcForCorpusLabel(s.school),
  };
}

/** A /sections/:id detail payload exactly as served (exported for
 * validate-page-contracts); undefined when the id is unknown. */
export function buildSectionDetail(id: string) {
  const section = sectionById.get(id);
  if (!section) return undefined;
  return {
    ...section,
    school: displaySchoolLabel(section.school),
    schoolGrc: schoolGrcForCorpusLabel(section.school),
    externalLinks: externalLinksFor(section.philosopher),
  };
}

router.get("/sections/:id", (req, res) => {
  const parsed = GetSectionParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid section id" });
    return;
  }
  const section = buildSectionDetail(parsed.data.id);
  if (!section) {
    res.status(404).json({ error: `Section ${parsed.data.id} not found` });
    return;
  }
  res.json(GetSectionResponse.parse(section));
});

export default router;
