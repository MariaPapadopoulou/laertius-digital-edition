/**
 * HTTP surface. Requests are validated with the generated zod schemas and
 * every response is parsed through its schema before it leaves the
 * process, so the wire contract is exactly lib/api-spec/legomena.yaml.
 */
import { Router, type NextFunction, type Request, type Response } from "express";
import {
  AskOntologyBody,
  AskOntologyResponse,
  GetDatasetStatsResponse,
  GetDerivedGraphResponse,
  GetEntityQueryParams,
  GetEntityResponse,
  GetPassageParams,
  GetPassageResponse,
  HealthCheckResponse,
  ListEntitiesQueryParams,
  ListEntitiesResponse,
  ListPassagesQueryParams,
  ListPassagesResponse,
  ListSparqlExamplesResponse,
  RunSparqlBody,
  RunSparqlResponse,
} from "@workspace/api-zod/legomena";
import { ask, denseAvailable } from "./ask";
import { embedderReady } from "./embedder";
import {
  DERIVATION_DESCRIPTION,
  EDGE_QUERY,
  NODE_QUERY,
  getDerivedGraph,
} from "./derive";
import { sparqlExamples } from "./examples";
import { logger } from "./logger";
import {
  certaintyRank,
  compareSectionIds,
  getModel,
  type AnnotationRec,
  type AssertionRec,
  type PassageRec,
} from "./model";
import { executeSparql, MAX_QUERY_LENGTH, SparqlRejection } from "./sparql-exec";
import { getManifest, getStore, prologue, storeReady, tripleCount } from "./store";

export const router: ReturnType<typeof Router> = Router();

function toAssertion(a: AssertionRec): Record<string, unknown> {
  return {
    uri: a.uri,
    kind: a.kind,
    subjectUri: a.subjectUri,
    subjectLabel: a.subjectLabel,
    predicateUri: a.predicateUri,
    predicateLabel: a.predicateLabel,
    ...(a.objectUri !== undefined ? { objectUri: a.objectUri } : {}),
    ...(a.objectLabel !== undefined ? { objectLabel: a.objectLabel } : {}),
    ...(a.objectValue !== undefined ? { objectValue: a.objectValue } : {}),
    ...(a.objectLang !== undefined ? { objectLang: a.objectLang } : {}),
    certainty: a.certainty,
    ...(a.accordingTo.length > 0 ? { accordingTo: a.accordingTo } : {}),
    ...(a.assertedInWork ? { assertedInWork: a.assertedInWork } : {}),
    ...(a.chain.length > 0 ? { chain: a.chain } : {}),
    ...(a.conflictsWith.length > 0 ? { conflictsWith: a.conflictsWith } : {}),
    citation: a.citation,
    ref: a.ref,
    ...(a.sectionId ? { sectionId: a.sectionId } : {}),
    ...(a.grc ? { grc: a.grc } : {}),
    ...(a.note ? { note: a.note } : {}),
  };
}

function sortAssertions(list: AssertionRec[]): AssertionRec[] {
  return [...list].sort(
    (a, b) =>
      certaintyRank(a.certainty) - certaintyRank(b.certainty) ||
      a.predicateLabel.localeCompare(b.predicateLabel) ||
      a.ref.localeCompare(b.ref),
  );
}

function toAnnotationSpan(ann: AnnotationRec): Record<string, unknown> {
  const model = getModel();
  const entity = model.entityByUri.get(ann.entityUri);
  return {
    annotationUri: ann.annotationUri,
    start: ann.start,
    end: ann.end,
    lang: ann.lang,
    exact: ann.exact,
    entityUri: ann.entityUri,
    ...(model.labelOf(ann.entityUri)
      ? { entityLabel: model.labelOf(ann.entityUri) }
      : {}),
    ...(entity ? { entityKind: entity.kind } : {}),
    ...(ann.nameUri ? { nameUri: ann.nameUri } : {}),
    ...(ann.conceptUris ? { conceptUris: ann.conceptUris } : {}),
  };
}

function passageSummary(p: PassageRec): Record<string, unknown> {
  const model = getModel();
  return {
    id: p.id,
    citation: p.citation,
    book: p.book,
    chapter: p.chapter,
    section: p.section,
    ...(p.lifeOf ? { lifeOf: p.lifeOf } : {}),
    ...(p.lifeOfUri ? { lifeOfUri: p.lifeOfUri } : {}),
    hasEnglish: p.englishText !== undefined,
    annotationCount: p.annotations.length,
    assertionCount: model.assertionsBySection.get(p.id)?.length ?? 0,
  };
}

router.get("/healthz", (_req: Request, res: Response) => {
  res.json(
    HealthCheckResponse.parse({
      status: "ok",
      storeReady: storeReady(),
      tripleCount: tripleCount(),
      denseIndexReady: denseAvailable(),
      // The model is warmed up at startup; deployment checks can poll this
      // to wait until the first dense search will answer instantly.
      modelReady: embedderReady(),
    }),
  );
});

router.get("/dataset/stats", (_req: Request, res: Response) => {
  const model = getModel();
  const manifest = getManifest();
  const kindCounts = new Map<string, number>();
  for (const e of model.entities) {
    kindCounts.set(e.kind, (kindCounts.get(e.kind) ?? 0) + 1);
  }
  const certaintyCounts = new Map<string, number>();
  for (const a of [...model.claims, ...model.statements]) {
    certaintyCounts.set(
      a.certainty,
      (certaintyCounts.get(a.certainty) ?? 0) + 1,
    );
  }
  const predicateCounts = new Map<string, number>();
  for (const c of model.claims) {
    predicateCounts.set(
      c.predicateLabel,
      (predicateCounts.get(c.predicateLabel) ?? 0) + 1,
    );
  }
  const named = (m: Map<string, number>): { name: string; count: number }[] =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  const passages = model.passagesOrdered;
  res.json(
    GetDatasetStatsResponse.parse({
      generatedAt: manifest.generatedAt,
      files: manifest.files.map((f) => ({
        name: f.name,
        sha256: f.sha256,
        bytes: f.bytes,
        triples: f.quads,
      })),
      totalTriples: tripleCount(),
      entityCounts: named(kindCounts),
      assertions: {
        claims: model.claims.length,
        relationStatements: model.statements.length,
        byCertainty: named(certaintyCounts),
        byPredicate: named(predicateCounts),
      },
      passages: {
        total: passages.length,
        withEnglish: passages.filter((p) => p.englishText !== undefined)
          .length,
        annotated: passages.filter((p) => p.annotations.length > 0).length,
        annotations: passages.reduce((n, p) => n + p.annotations.length, 0),
      },
    }),
  );
});

router.get("/graph", (_req: Request, res: Response) => {
  const { nodes, edges } = getDerivedGraph();
  res.json(
    GetDerivedGraphResponse.parse({
      nodes: nodes.map((n) => ({
        uri: n.uri,
        name: n.name,
        ...(n.grcName ? { grcName: n.grcName } : {}),
        school: n.school,
        schoolUri: n.schoolUri,
        schoolLabel: n.schoolLabel,
        book: n.book,
        chapter: n.chapter,
        claimCount: n.claimCount,
        ...(n.sage ? { sage: true } : {}),
      })),
      edges: edges.map((e) => ({
        from: e.from,
        to: e.to,
        fromUri: e.fromUri,
        toUri: e.toUri,
        type: e.type,
        predicateUri: e.predicateUri,
        ref: e.ref,
        citation: e.citation,
        certainty: e.certainty,
        attribution: e.attribution,
        ...(e.sectionId ? { sectionId: e.sectionId } : {}),
      })),
      derivation: {
        description: DERIVATION_DESCRIPTION,
        nodeQuery: `${prologue()}\n\n${NODE_QUERY}`,
        edgeQuery: `${prologue()}\n\n${EDGE_QUERY}`,
      },
    }),
  );
});

const ENTITY_LIST_CAP = 500;

router.get("/entities", (req: Request, res: Response) => {
  const params = ListEntitiesQueryParams.parse(req.query);
  const model = getModel();
  const q = params.q?.trim().toLowerCase();
  let list = model.entities;
  if (params.kind) list = list.filter((e) => e.kind === params.kind);
  if (q && q.length > 0) {
    list = list.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        (e.grcName ?? "").toLowerCase().includes(q) ||
        e.properNames.some((p) => p.form.toLowerCase().includes(q)),
    );
  }
  res.json(
    ListEntitiesResponse.parse({
      entities: list.slice(0, ENTITY_LIST_CAP).map((e) => ({
        uri: e.uri,
        label: e.label,
        kind: e.kind,
        ...(e.grcName ? { grcName: e.grcName } : {}),
        claimCount: e.claimCount,
        annotationCount: e.annotationCount,
      })),
      total: list.length,
    }),
  );
});

router.get("/entity", (req: Request, res: Response) => {
  const { uri } = GetEntityQueryParams.parse(req.query);
  const model = getModel();
  const e = model.entityByUri.get(uri);
  if (!e) {
    res.status(404).json({ error: `No entity in the dataset: ${uri}` });
    return;
  }
  const relations = getDerivedGraph().edges.filter(
    (edge) => edge.fromUri === uri || edge.toUri === uri,
  );
  const sectionAgg = new Map<string, number>();
  for (const { sectionId } of model.annotationsByEntity.get(uri) ?? []) {
    sectionAgg.set(sectionId, (sectionAgg.get(sectionId) ?? 0) + 1);
  }
  const annotatedSections = [...sectionAgg.entries()]
    .sort((a, b) => compareSectionIds(a[0], b[0]))
    .map(([sectionId, count]) => {
      const p = model.passageById.get(sectionId);
      return {
        sectionId,
        citation: p?.citation ?? sectionId,
        ...(p?.lifeOf ? { lifeOf: p.lifeOf } : {}),
        count,
      };
    });
  res.json(
    GetEntityResponse.parse({
      uri: e.uri,
      label: e.label,
      kinds: e.kinds,
      ...(e.grcName ? { grcName: e.grcName } : {}),
      ...(e.book !== undefined ? { book: e.book } : {}),
      ...(e.chapter !== undefined ? { chapter: e.chapter } : {}),
      ...(e.schoolUri ? { schoolUri: e.schoolUri } : {}),
      ...(e.schoolLabel ? { schoolLabel: e.schoolLabel } : {}),
      ...(e.founderOf ? { founderOf: e.founderOf } : {}),
      properNames: e.properNames,
      sameAs: e.sameAs,
      seeAlso: e.seeAlso,
      assertions: sortAssertions(
        model.assertionsBySubject.get(uri) ?? [],
      ).map(toAssertion),
      mentions: sortAssertions(model.assertionsByObject.get(uri) ?? []).map(
        toAssertion,
      ),
      relations: relations.map((r) => ({
        from: r.from,
        to: r.to,
        fromUri: r.fromUri,
        toUri: r.toUri,
        type: r.type,
        predicateUri: r.predicateUri,
        ref: r.ref,
        citation: r.citation,
        certainty: r.certainty,
        attribution: r.attribution,
        ...(r.sectionId ? { sectionId: r.sectionId } : {}),
      })),
      annotatedSections,
    }),
  );
});

router.get("/sections", (req: Request, res: Response) => {
  const params = ListPassagesQueryParams.parse(req.query);
  const model = getModel();
  let list = model.passagesOrdered;
  if (params.book !== undefined) {
    list = list.filter((p) => p.book === params.book);
  }
  res.json(
    ListPassagesResponse.parse({ sections: list.map(passageSummary) }),
  );
});

router.get("/sections/:id", (req: Request, res: Response) => {
  const { id } = GetPassageParams.parse(req.params);
  const model = getModel();
  const p = model.passageById.get(id);
  if (!p) {
    res.status(404).json({ error: `No section in the dataset: ${id}` });
    return;
  }
  const idx = model.passagesOrdered.indexOf(p);
  const prev = idx > 0 ? model.passagesOrdered[idx - 1] : undefined;
  const next =
    idx >= 0 && idx < model.passagesOrdered.length - 1
      ? model.passagesOrdered[idx + 1]
      : undefined;
  res.json(
    GetPassageResponse.parse({
      id: p.id,
      citation: p.citation,
      urn: p.urn,
      book: p.book,
      chapter: p.chapter,
      section: p.section,
      ...(p.lifeOf ? { lifeOf: p.lifeOf } : {}),
      ...(p.lifeOfUri ? { lifeOfUri: p.lifeOfUri } : {}),
      greekText: p.greekText,
      englishText: p.englishText ?? null,
      annotations: p.annotations.map(toAnnotationSpan),
      assertions: sortAssertions(
        model.assertionsBySection.get(p.id) ?? [],
      ).map(toAssertion),
      ...(prev ? { prevId: prev.id } : {}),
      ...(next ? { nextId: next.id } : {}),
    }),
  );
});

router.post("/ask", async (req: Request, res: Response) => {
  const body = AskOntologyBody.parse(req.body);
  const model = getModel();
  const result = await ask(model, body.question, body.topK ?? 8);
  res.json(
    AskOntologyResponse.parse({
      question: body.question,
      mode: result.mode,
      lines: result.lines.map((l) => ({
        text: l.text,
        assertion: toAssertion(l.assertion),
        ...(l.passageRank !== undefined
          ? { passageRank: l.passageRank }
          : {}),
      })),
      passages: result.retrieved.map((r) => {
        const en = r.passage.englishText;
        const raw = en ?? r.passage.greekText;
        const snippet =
          raw.length > 220 ? `${raw.slice(0, 220).trimEnd()}…` : raw;
        return {
          sectionId: r.passage.id,
          citation: r.passage.citation,
          rank: r.rank,
          score: Math.round(r.score * 1e6) / 1e6,
          ...(r.passage.lifeOf ? { lifeOf: r.passage.lifeOf } : {}),
          snippet,
          snippetLang: en ? "en" : "grc",
          annotationCount: r.passage.annotations.length,
        };
      }),
      entities: result.entities.map((e) => ({
        uri: e.uri,
        ...(e.label ? { label: e.label } : {}),
      })),
      ...(result.notice ? { notice: result.notice } : {}),
    }),
  );
});

router.post("/sparql", (req: Request, res: Response) => {
  // Body problems get plain-language 400s here (the console banner shows
  // { error } verbatim), instead of falling through to the generic
  // ZodError formatting in the error middleware.
  const parsed = RunSparqlBody.safeParse(req.body);
  if (!parsed.success) {
    const q = (req.body as { query?: unknown } | undefined)?.query;
    let message: string;
    if (typeof q !== "string" || q.length === 0) {
      message =
        'The request body must be JSON with a non-empty "query" string';
    } else if (q.length > MAX_QUERY_LENGTH) {
      message = `The query is too long: ${q.length.toLocaleString("en-US")} characters (the limit is ${MAX_QUERY_LENGTH.toLocaleString("en-US")})`;
    } else {
      message = parsed.error.issues
        .map((i) => (i.path.length > 0 ? `${i.path.join(".")}: ${i.message}` : i.message))
        .join("; ");
    }
    res.status(400).json({ error: message });
    return;
  }
  const body = parsed.data;
  try {
    const outcome = executeSparql(getStore(), body.query);
    res.json(
      RunSparqlResponse.parse({
        form: outcome.form,
        ...(outcome.columns ? { columns: outcome.columns } : {}),
        ...(outcome.rows ? { rows: outcome.rows } : {}),
        ...(outcome.boolean !== undefined
          ? { boolean: outcome.boolean }
          : {}),
        ...(outcome.turtle !== undefined ? { turtle: outcome.turtle } : {}),
        rowCount: outcome.rowCount,
        elapsedMs: outcome.elapsedMs,
      }),
    );
  } catch (err) {
    if (err instanceof SparqlRejection) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.get("/sparql/examples", (_req: Request, res: Response) => {
  res.json(ListSparqlExamplesResponse.parse({ examples: sparqlExamples() }));
});

// Zod rejections (bad params/body) become 400s; everything else is a 500.
router.use(
  (err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    if (err instanceof Error && err.name === "ZodError") {
      res.status(400).json({ error: err.message });
      return;
    }
    logger.error({ err }, "Unhandled route error");
    res.status(500).json({ error: "Internal error" });
  },
);
