/**
 * TEDI OTV standalone ontology viewer, third HTML export of the OTB layer.
 *
 * Fills the reference shell (viewer-template.ts) with data built from the
 * OTB model: the full concept tree (isA view) and, in the combined view,
 * the COMPLETE object inventory of the model, every object grouped under
 * its own concept (7574 objects at the time of writing; the counts live
 * in validate-otb). The preloaded data mirrors the shapes the reference
 * page expects (Map-serialized arrays restored by restoreMaps): concepts,
 * isaRelations, objects, instanceOfRelations, objectAttributes,
 * conceptAttributes.
 *
 * Deliberate choices, kept small and documented:
 *   - Object nodes carry the model label ("Epicurus"), not the fragment id
 *     the reference tool fell back to; the tooltip still shows the id.
 *   - A concept's "attribute" and "denotedByTerm" lines join multiple
 *     values with ", " instead of silently keeping the last one.
 *   - Place objects get latitude/longitude attributes from the curated
 *     PLACE_COORDS table (viewer-only, not part of the RDF model), which
 *     activates the shell's Leaflet tooltip map.
 *   - Each object hangs under exactly its own concept (the reference's
 *     skos:example grouping could duplicate an object under an ancestor;
 *     with the full inventory that would double every node).
 *   - The shell collapses the combined view initially (a one-line,
 *     documented deviation in viewer-template.ts): with thousands of
 *     instances per concept, auto-expanding everything would render the
 *     whole inventory at once; a click on a concept unfolds its objects.
 *
 * Output is deterministic: the title is the static human-readable
 * "Diogenes Laertius Ontology" (the dated fragment namespace stays in the
 * RDF exports), so the smoke test can require byte-equality with the
 * bundle.
 */
import { getOtbModel, type OtbObject } from "./build";
import { CONCEPTS, RELATIONS, ATTRIBUTES, TERMS } from "./inventory";
import { PLACE_COORDS } from "../place-coords";
import { OTB_DEPICTIONS } from "./depictions";
import { OTV_VIEWER_TEMPLATE } from "./viewer-template";

let viewerCache: string | null = null;

export function getOtbViewerHtml(): string {
  if (viewerCache === null) viewerCache = buildViewerHtml();
  return viewerCache;
}

type Pairs = [string, unknown][];

function buildViewerHtml(): string {
  const m = getOtbModel();

  const concepts: Pairs = CONCEPTS.map((c) => [
    c.id,
    { id: c.id, name: c.id, type: "concept", children: {}, parent: null },
  ]);

  const isaRelations: Pairs = CONCEPTS.filter((c) => c.isA !== undefined).map(
    (c) => [c.id, [c.isA]],
  );

  // The combined view carries the complete inventory: every model object
  // hangs under its own concept, in model order (deterministic). Concepts
  // without direct instances simply have no instanceOf entry.
  const byConcept = new Map<string, string[]>();
  for (const o of m.objects) {
    const list = byConcept.get(o.concept) ?? [];
    list.push(o.id);
    byConcept.set(o.concept, list);
  }
  const instanceOfRelations: Pairs = CONCEPTS.filter((c) =>
    byConcept.has(c.id),
  ).map((c) => [c.id, byConcept.get(c.id)]);

  const objects: Pairs = m.objects.map((o) => [
    o.id,
    { id: o.id, name: o.label, type: "object", concept: o.concept, attributes: {} },
  ]);

  const objectAttributes: Pairs = m.objects.map((o) => [
    o.id,
    buildObjectAttributes(o),
  ]);

  const conceptAttributes: Pairs = CONCEPTS.map((c) => {
    const attrs: Record<string, string> = { conceptName: `<${c.id}>` };
    for (const r of RELATIONS.filter(
      (r) => r.axiomatized && r.domain.includes(c.id),
    ).sort((a, b) => a.id.localeCompare(b.id, "en"))) {
      attrs[r.id] = r.range.join(", ");
    }
    const attrIds = ATTRIBUTES.filter((a) => a.domain.includes(c.id)).map(
      (a) => a.id,
    );
    if (attrIds.length > 0) attrs.attribute = attrIds.join(", ");
    const termIds = TERMS.filter((t) => t.concept === c.id).map((t) => t.id);
    if (termIds.length > 0) attrs.denotedByTerm = termIds.join(", ");
    return [c.id, attrs];
  });

  const data = {
    concepts,
    objects,
    isaRelations,
    instanceOfRelations,
    objectAttributes,
    conceptAttributes,
  };

  // Human-readable title (the dated fragment namespace stays in the RDF
  // exports; the viewer heading reads "Diogenes Laertius Ontology").
  const title = "Diogenes Laertius Ontology";
  const stats = `${concepts.length} concepts, ${objects.length} objects (preloaded)`;
  // "<" is escaped so no literal "</script>" can terminate the inline
  // script; the replacement uses a callback so "$" in the data is literal.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return OTV_VIEWER_TEMPLATE.replace(/__OTV_TITLE__/g, () => title)
    .replace("__OTV_STATS__", () => stats)
    .replace("__OTV_DATA__", () => json);
}

function buildObjectAttributes(o: OtbObject): Record<string, string> {
  const attrs: Record<string, string> = { label: o.label, prefLabel: o.label };
  if (o.note !== undefined) attrs.note = o.note;

  // Literals: a repeated attribute (e.g. the two language versions of a
  // Text's text) gets a language-suffixed key so nothing is dropped.
  const byAttr = new Map<string, typeof o.literals>();
  for (const l of o.literals) {
    const list = byAttr.get(l.attr) ?? [];
    list.push(l);
    byAttr.set(l.attr, list);
  }
  for (const [attr, list] of byAttr) {
    if (list.length === 1) {
      attrs[attr] = list[0].value;
    } else {
      for (const l of list) {
        const key = l.lang !== undefined ? `${attr} (${l.lang})` : attr;
        if (key in attrs) {
          attrs[key] = `${attrs[key]} | ${l.value}`;
        } else {
          attrs[key] = l.value;
        }
      }
    }
  }

  // Relations: rel -> target fragment ids, joined when there are several.
  const byRel = new Map<string, string[]>();
  for (const r of o.relations) {
    const list = byRel.get(r.rel) ?? [];
    list.push(r.target);
    byRel.set(r.rel, list);
  }
  for (const [rel, targets] of byRel) attrs[rel] = targets.join(", ");

  // Viewer-only enrichment: curated coordinates make the shell render its
  // Leaflet map in the tooltip of Place examples.
  if (o.concept === "Place") {
    const coord = PLACE_COORDS[o.label];
    if (coord) {
      attrs.latitude = String(coord.lat);
      attrs.longitude = String(coord.lon);
    }
  }
  // Viewer-only enrichment: the curated Wikimedia Commons depiction
  // (Wikidata P18) activates the shell's tooltip image; the credit link
  // renders as a clickable tooltip-link to the Commons file page, with
  // the license short name in the attribute key so CC images carry
  // their license context in the tooltip itself.
  const dep = OTB_DEPICTIONS[o.id];
  if (dep) {
    attrs.depiction = dep.url;
    attrs[`image credit (${dep.license})`] = dep.page;
  }
  return attrs;
}
