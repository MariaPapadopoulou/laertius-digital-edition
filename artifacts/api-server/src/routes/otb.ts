/**
 * OTB ontoterminology endpoints: the TEDI-compatible modelling of the
 * corpus (overview, concept inventory, object browser, proper names and
 * the RDF/XML export). Everything derives from the cached in-memory model
 * in lib/otb; per-endpoint caches hold the validated JSON.
 */
import { Router, type IRouter } from "express";
import {
  GetOtbOverviewResponse,
  ListOtbConceptsResponse,
  ListOtbObjectsQueryParams,
  ListOtbObjectsResponse,
  GetOtbObjectResponse,
  ListOtbNamesQueryParams,
  ListOtbNamesResponse,
} from "@workspace/api-zod";
import { getOtbModel, OTB_BASE, OTB_META } from "../lib/otb/build";
import { getOtbRdf } from "../lib/otb/emit";
import {
  getOtbDictionaryHtml,
  getOtbProperNamesDictionaryHtml,
} from "../lib/otb/dictionary";
import { getOtbViewerHtml } from "../lib/otb/viewer";
import { conceptCategory } from "../lib/otb/inventory";

const router: IRouter = Router();

let overviewCache: unknown = null;
let conceptsCache: unknown = null;

/**
 * The exact (pre-Zod) overview payload /otb/overview serves, exported so
 * validate-page-contracts can compare the inline categoryCounts and
 * conceptCounts rows of the OpenAPI OtbOverview schema against the
 * served shape before response validation strips undeclared keys.
 */
export function buildOtbOverview() {
  const m = getOtbModel();
  const byCategory = new Map<string, number>();
  const byConcept = new Map<string, number>();
  for (const o of m.objects) {
    byCategory.set(o.category, (byCategory.get(o.category) ?? 0) + 1);
    byConcept.set(o.concept, (byConcept.get(o.concept) ?? 0) + 1);
  }
  return {
        title: OTB_META.title,
        author: OTB_META.author,
        publisher: OTB_META.publisher,
        description: OTB_META.description,
        base: OTB_BASE,
        exportDate: OTB_META.exportDate,
        counts: {
          categories: m.categories.length,
          concepts: m.concepts.length,
          relations: m.relations.length,
          attributes: m.attributes.length,
          terms: m.terms.length,
          objects: m.objects.length,
          properNames: m.properNames.length,
          assertions: byConcept.get("Assertion") ?? 0,
        },
        categoryCounts: [...byCategory.entries()]
          .map(([id, count]) => ({ id, count }))
          .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)),
        conceptCounts: [...byConcept.entries()]
          .map(([id, count]) => ({ id, category: conceptCategory(id), count }))
          .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)),
    extensions: m.extensions,
  };
}

router.get("/otb/overview", (req, res) => {
  try {
    if (!overviewCache) {
      overviewCache = GetOtbOverviewResponse.parse(buildOtbOverview());
    }
    res.json(overviewCache);
  } catch (err) {
    req.log.error({ err }, "Failed to build OTB overview");
    res.status(500).json({ error: "Failed to build OTB overview" });
  }
});

/**
 * The exact (pre-Zod) concept rows /otb/concepts serves, exported so
 * validate-page-contracts can compare the inline relations/terms/examples
 * rows of the OpenAPI OtbConcept schema against the served shape before
 * response validation strips undeclared keys.
 */
export function buildOtbConcepts() {
  const m = getOtbModel();
  const byConcept = new Map<string, number>();
  for (const o of m.objects) {
    byConcept.set(o.concept, (byConcept.get(o.concept) ?? 0) + 1);
  }
  const byId = new Map(m.concepts.map((c) => [c.id, c]));
  const objectById = new Map(m.objects.map((o) => [o.id, o]));
  const chain = (id: string): string[] => {
    const out = [id];
    let cur = byId.get(id);
    while (cur?.isA) {
      out.push(cur.isA);
      cur = byId.get(cur.isA);
    }
    return out;
  };
  return m.concepts.map((c) => {
    const ancestry = chain(c.id);
    return {
      id: c.id,
      category: conceptCategory(c.id),
      ...(c.isA ? { isA: c.isA } : {}),
      ...(c.shortName ? { shortName: c.shortName } : {}),
      ...(c.definition ? { definition: c.definition } : {}),
      ...(c.related ? { related: c.related } : {}),
      relations: m.relations
        .filter(
          (r) => r.axiomatized && r.domain.some((d) => ancestry.includes(d)),
        )
        .map((r) => ({ id: r.id, ranges: r.range })),
      attributes: m.attributes
        .filter((a) => a.domain.some((d) => ancestry.includes(d)))
        .map((a) => a.id),
      terms: m.terms
        .filter((t) => t.concept === c.id)
        .map((t) => ({ id: t.id, name: t.name, lang: t.lang })),
      ...(c.examples
        ? {
            examples: c.examples.map((id) => ({
              id,
              label: objectById.get(id)?.label ?? id,
            })),
          }
        : {}),
      objectCount: byConcept.get(c.id) ?? 0,
    };
  });
}

router.get("/otb/concepts", (req, res) => {
  try {
    if (!conceptsCache) {
      conceptsCache = ListOtbConceptsResponse.parse(buildOtbConcepts());
    }
    res.json(conceptsCache);
  } catch (err) {
    req.log.error({ err }, "Failed to build OTB concepts");
    res.status(500).json({ error: "Failed to build OTB concepts" });
  }
});

router.get("/otb/objects", (req, res) => {
  try {
    const params = ListOtbObjectsQueryParams.parse(req.query);
    const m = getOtbModel();
    const q = params.q?.trim().toLowerCase();
    const namesByObject = new Map<string, string[]>();
    if (q) {
      for (const n of m.properNames) {
        const list = namesByObject.get(n.object) ?? [];
        list.push(n.name.toLowerCase());
        namesByObject.set(n.object, list);
      }
    }
    const matches = m.objects.filter((o) => {
      if (params.concept && o.concept !== params.concept) return false;
      if (params.category && o.category !== params.category) return false;
      if (!q) return true;
      if (o.label.toLowerCase().includes(q)) return true;
      if (o.note?.toLowerCase().includes(q)) return true;
      return (namesByObject.get(o.id) ?? []).some((n) => n.includes(q));
    });
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 50;
    res.json(
      ListOtbObjectsResponse.parse({
        total: matches.length,
        items: matches.slice(offset, offset + limit).map((o) => ({
          id: o.id,
          label: o.label,
          concept: o.concept,
          category: o.category,
          ...(o.note ? { note: o.note } : {}),
          nameCount: o.names.length,
          relationCount: o.relations.length,
        })),
      }),
    );
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }
    req.log.error({ err }, "Failed to list OTB objects");
    res.status(500).json({ error: "Failed to list OTB objects" });
  }
});

const INBOUND_CAP = 200;

/**
 * The exact (pre-Zod) object-detail payload /otb/objects/:id serves,
 * exported so validate-page-contracts can compare the inline
 * literals/relations/inbound rows of the OpenAPI OtbObjectDetail schema
 * against the served shape before response validation strips undeclared
 * keys. Returns undefined for an unknown object id.
 */
export function buildOtbObjectDetail(id: string) {
  const m = getOtbModel();
  const byId = new Map(m.objects.map((o) => [o.id, o]));
  const o = byId.get(id);
  if (!o) return undefined;
  const nameById = new Map(m.properNames.map((n) => [n.id, n]));
    const inbound: {
      rel: string;
      source: string;
      sourceLabel: string;
      sourceConcept: string;
    }[] = [];
    let inboundTotal = 0;
    for (const other of m.objects) {
      if (other.id === o.id) continue;
      for (const r of other.relations) {
        if (r.target !== o.id) continue;
        inboundTotal += 1;
        if (inbound.length < INBOUND_CAP) {
          inbound.push({
            rel: r.rel,
            source: other.id,
            sourceLabel: other.label,
            sourceConcept: other.concept,
          });
        }
      }
    }
  return {
    id: o.id,
    label: o.label,
    concept: o.concept,
    category: o.category,
    ...(o.note ? { note: o.note } : {}),
    literals: o.literals,
    relations: o.relations.map((r) => {
      const t = byId.get(r.target);
      return {
        rel: r.rel,
        target: r.target,
        targetLabel: t?.label ?? r.target,
        targetConcept: t?.concept ?? "",
      };
    }),
    inbound,
    inboundTotal,
    names: o.names
      .map((id) => nameById.get(id))
      .filter((n) => n !== undefined)
      .map((n) => ({
        id: n.id,
        name: n.name,
        lang: n.lang,
        object: n.object,
        objectLabel: o.label,
        allonyms: n.allonyms,
      })),
  };
}

router.get("/otb/objects/:id", (req, res) => {
  try {
    const detail = buildOtbObjectDetail(req.params.id);
    if (!detail) {
      res.status(404).json({ error: "Unknown object id" });
      return;
    }
    res.json(GetOtbObjectResponse.parse(detail));
  } catch (err) {
    req.log.error({ err }, "Failed to build OTB object detail");
    res.status(500).json({ error: "Failed to build OTB object detail" });
  }
});

router.get("/otb/names", (req, res) => {
  try {
    const params = ListOtbNamesQueryParams.parse(req.query);
    const m = getOtbModel();
    const labelByObject = new Map(m.objects.map((o) => [o.id, o.label]));
    const q = params.q?.trim().toLowerCase();
    const matches = m.properNames.filter((n) => {
      if (params.lang && n.lang !== params.lang) return false;
      if (!q) return true;
      if (n.name.toLowerCase().includes(q)) return true;
      return (labelByObject.get(n.object) ?? "").toLowerCase().includes(q);
    });
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 50;
    res.json(
      ListOtbNamesResponse.parse({
        total: matches.length,
        items: matches.slice(offset, offset + limit).map((n) => ({
          id: n.id,
          name: n.name,
          lang: n.lang,
          object: n.object,
          objectLabel: labelByObject.get(n.object) ?? n.object,
          allonyms: n.allonyms,
        })),
      }),
    );
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }
    req.log.error({ err }, "Failed to list OTB names");
    res.status(500).json({ error: "Failed to list OTB names" });
  }
});

router.get("/otb/dictionary.html", (req, res) => {
  try {
    res
      .type("text/html; charset=utf-8")
      .setHeader(
        "Content-Disposition",
        'inline; filename="diogenes_laertius_term_dictionary.html"',
      )
      .send(getOtbDictionaryHtml());
  } catch (err) {
    req.log.error({ err }, "Failed to build OTB term dictionary");
    res.status(500).json({ error: "Failed to build OTB term dictionary" });
  }
});

router.get("/otb/dictionary.en.html", (req, res) => {
  try {
    res
      .type("text/html; charset=utf-8")
      .setHeader(
        "Content-Disposition",
        'inline; filename="diogenes_laertius_term_dictionary_en.html"',
      )
      .send(getOtbDictionaryHtml("en"));
  } catch (err) {
    req.log.error({ err }, "Failed to build OTB term dictionary (en)");
    res
      .status(500)
      .json({ error: "Failed to build OTB term dictionary (en)" });
  }
});

router.get("/otb/dictionary.grc.html", (req, res) => {
  try {
    res
      .type("text/html; charset=utf-8")
      .setHeader(
        "Content-Disposition",
        'inline; filename="diogenes_laertius_term_dictionary_grc.html"',
      )
      .send(getOtbDictionaryHtml("grc"));
  } catch (err) {
    req.log.error({ err }, "Failed to build OTB term dictionary (grc)");
    res
      .status(500)
      .json({ error: "Failed to build OTB term dictionary (grc)" });
  }
});

for (const pnLang of ["en", "grc"] as const) {
  router.get(`/otb/proper-names.${pnLang}.html`, (req, res) => {
    try {
      res
        .type("text/html; charset=utf-8")
        .setHeader(
          "Content-Disposition",
          `inline; filename="diogenes_laertius_proper_name_dictionary_${pnLang}.html"`,
        )
        .send(getOtbProperNamesDictionaryHtml(pnLang));
    } catch (err) {
      req.log.error(
        { err },
        `Failed to build OTB proper name dictionary (${pnLang})`,
      );
      res.status(500).json({
        error: `Failed to build OTB proper name dictionary (${pnLang})`,
      });
    }
  });
}

router.get("/otb/proper-names.html", (req, res) => {
  try {
    res
      .type("text/html; charset=utf-8")
      .setHeader(
        "Content-Disposition",
        'inline; filename="diogenes_laertius_proper_name_dictionary.html"',
      )
      .send(getOtbProperNamesDictionaryHtml());
  } catch (err) {
    req.log.error({ err }, "Failed to build OTB proper name dictionary");
    res
      .status(500)
      .json({ error: "Failed to build OTB proper name dictionary" });
  }
});

router.get("/otb/viewer.html", (req, res) => {
  try {
    res
      .type("text/html; charset=utf-8")
      .setHeader(
        "Content-Disposition",
        'inline; filename="diogenes_laertius_ontology_viewer.html"',
      )
      .send(getOtbViewerHtml());
  } catch (err) {
    req.log.error({ err }, "Failed to build OTB ontology viewer");
    res.status(500).json({ error: "Failed to build OTB ontology viewer" });
  }
});

router.get("/otb/ontoterminology.rdf", (req, res) => {
  try {
    res
      .type("application/rdf+xml")
      .setHeader(
        "Content-Disposition",
        'attachment; filename="diogenes_laertius_ontoterminology.rdf"',
      )
      .send(getOtbRdf());
  } catch (err) {
    req.log.error({ err }, "Failed to serialize OTB RDF/XML");
    res.status(500).json({ error: "Failed to serialize OTB RDF/XML" });
  }
});

export default router;
