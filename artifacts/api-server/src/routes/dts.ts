/**
 * Distributed Text Services (DTS) 1.0 endpoints.
 *
 * A read-only standards API mounted at /dts (outside the /api router and
 * its OpenAPI/Zod machinery, the same way the LOD and sitemap endpoints are
 * mounted directly on the app). Public: GET is allowed from anywhere via the
 * app-wide CORS middleware, exactly as the LOD endpoints rely on it.
 *
 *   GET /dts            EntryPoint (application/ld+json)
 *   GET /dts/collection Collection / Resource (application/ld+json)
 *   GET /dts/navigation Navigation citation tree (application/ld+json)
 *   GET /dts/document   TEI/XML passage (application/tei+xml, default)
 */
import { Router, type IRouter } from "express";
import {
  DTS_RESOURCE_ID,
  JSONLD_MEDIA_TYPE,
  TEI_MEDIA_TYPE,
  collection,
  dtsBase,
  documentJsonLd,
  documentTei,
  entryPoint,
  navigation,
} from "../lib/dts";

const router: IRouter = Router();

function firstQuery(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

// Entry point.
router.get("/dts", (req, res) => {
  const base = dtsBase(req);
  res.type(JSONLD_MEDIA_TYPE).send(JSON.stringify(entryPoint(base), null, 2));
});

// Collection endpoint. ?id selects a specific Collection/Resource.
router.get("/dts/collection", (req, res) => {
  const base = dtsBase(req);
  const id = firstQuery(req.query["id"]);
  const doc = collection(base, id);
  if (!doc) {
    res.status(404).json({ error: "Unknown collection or resource" });
    return;
  }
  res.type(JSONLD_MEDIA_TYPE).send(JSON.stringify(doc, null, 2));
});

// Navigation endpoint. ?resource (required) & optional ref, down.
router.get("/dts/navigation", (req, res) => {
  const base = dtsBase(req);
  const resource = firstQuery(req.query["resource"]);
  if (resource === undefined) {
    res.status(400).json({ error: "The resource parameter is required." });
    return;
  }
  if (resource !== DTS_RESOURCE_ID) {
    res.status(404).json({ error: "Unknown resource" });
    return;
  }
  const start = firstQuery(req.query["start"]);
  const end = firstQuery(req.query["end"]);
  if (start !== undefined || end !== undefined) {
    // Range navigation (start/end) is not offered; the citation tree is
    // navigated with ref + down.
    res.status(400).json({
      error:
        "Range navigation with start/end is not supported; use ref and down.",
    });
    return;
  }
  const result = navigation(base, {
    ref: firstQuery(req.query["ref"]),
    down: firstQuery(req.query["down"]),
  });
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.type(JSONLD_MEDIA_TYPE).send(JSON.stringify(result.body, null, 2));
});

// Document endpoint. ?resource (required) & ref | start/end. TEI by default.
router.get("/dts/document", (req, res) => {
  const base = dtsBase(req);
  const resource = firstQuery(req.query["resource"]);
  if (resource === undefined) {
    res.status(400).json({ error: "The resource parameter is required." });
    return;
  }
  if (resource !== DTS_RESOURCE_ID) {
    res.status(404).json({ error: "Unknown resource" });
    return;
  }
  const ref = firstQuery(req.query["ref"]);
  const start = firstQuery(req.query["start"]);
  const end = firstQuery(req.query["end"]);
  const mediaType = firstQuery(req.query["mediaType"]);

  // Link back to the Collection endpoint for this Resource (spec header).
  res.setHeader(
    "Link",
    `<${base}/collection?id=${encodeURIComponent(DTS_RESOURCE_ID)}>; rel="collection"`,
  );

  // Optional JSON-LD alternative for a single passage.
  if (mediaType === JSONLD_MEDIA_TYPE) {
    if (ref === undefined) {
      res.status(400).json({
        error: "A ref is required for the application/ld+json media type.",
      });
      return;
    }
    const doc = documentJsonLd(ref);
    if (!doc) {
      res.status(404).json({ error: "Unknown reference" });
      return;
    }
    res.type(JSONLD_MEDIA_TYPE).send(JSON.stringify(doc, null, 2));
    return;
  }
  if (
    mediaType !== undefined &&
    mediaType !== TEI_MEDIA_TYPE &&
    mediaType !== "application/xml" &&
    mediaType !== "text/xml"
  ) {
    res.status(400).json({ error: "Invalid mediaType" });
    return;
  }

  const result = documentTei({ ref, start, end });
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.type(TEI_MEDIA_TYPE).send(result.tei);
});

export default router;
