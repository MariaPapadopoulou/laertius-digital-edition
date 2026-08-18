/**
 * OTB RDF/XML emitter: serializes the model exactly in the shape of the
 * curator's TEDI 4.1 reference export, section for section:
 *
 *   metadata, SKOS (scheme + concepts), OWL (object properties, data
 *   properties, classes with someValuesFrom restrictions, named
 *   individuals), OntoLex-Lemon, the verbatim OTV vocabulary core, then the
 *   OTV layer (ontoterminology metadata, relations, attributes, categories,
 *   concepts, terms, proper names, objects).
 *
 * Serialization conventions copied from the reference:
 *   - default xmlns is the project base, so individual-level relation
 *     elements are unqualified (`<isMemberOf rdf:resource="#stoa"/>`)
 *   - owl:unionOf domain/range blocks even for single members
 *   - otv:conceptName carries the angle-bracket form (`&lt;Philosopher&gt;`)
 *   - OWL class restrictions restate only the concept's OWN domain
 *     signatures; OTV concept blocks also restate inherited ones
 */
import {
  getOtbModel,
  OTB_BASE,
  type OtbModel,
  type OtbObject,
} from "./build";
import type {
  OtbConceptDef,
  OtbRelationDef,
  OtbAttributeDef,
  OtbTermDef,
} from "./inventory";
import { OTV_CORE } from "./otv-core";

const XSD_STRING = "http://www.w3.org/2001/XMLSchema#string";
/** Base without the trailing '#', used by rdf:about of the project nodes. */
const BASE_NO_HASH = OTB_BASE.slice(0, -1);

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Control characters are illegal in XML 1.0.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");
}

/** Ancestor chain of a concept, nearest first, excluding the concept. */
function ancestors(concepts: OtbConceptDef[], id: string): string[] {
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const out: string[] = [];
  let cur = byId.get(id);
  while (cur?.isA) {
    out.push(cur.isA);
    cur = byId.get(cur.isA);
  }
  return out;
}

/** Relations whose domain names exactly this concept. */
function ownRelations(m: OtbModel, id: string): OtbRelationDef[] {
  return m.relations.filter((r) => r.axiomatized && r.domain.includes(id));
}

/** Relations of the concept and its ancestors (OTV concept blocks). */
function inheritedRelations(m: OtbModel, id: string): OtbRelationDef[] {
  const chain = [id, ...ancestors(m.concepts, id)];
  return m.relations.filter(
    (r) => r.axiomatized && r.domain.some((d) => chain.includes(d)),
  );
}

function ownAttributes(m: OtbModel, id: string): OtbAttributeDef[] {
  return m.attributes.filter((a) => a.domain.includes(id));
}

function inheritedAttributes(m: OtbModel, id: string): OtbAttributeDef[] {
  const chain = [id, ...ancestors(m.concepts, id)];
  return m.attributes.filter((a) => a.domain.some((d) => chain.includes(d)));
}

function unionBlock(tag: "rdfs:domain" | "rdfs:range", ids: string[]): string {
  const members = ids
    .map((c) => `                    <rdf:Description rdf:about="#${c}"/>`)
    .join("\n");
  return [
    `        <${tag}>`,
    `            <owl:Class>`,
    `                <owl:unionOf rdf:parseType="Collection">`,
    members,
    `                </owl:unionOf>`,
    `            </owl:Class>`,
    `        </${tag}>`,
  ].join("\n");
}

function restriction(onProp: string, someFrom: string): string {
  const target = someFrom.startsWith("http")
    ? someFrom
    : `#${someFrom}`;
  return [
    `        <rdfs:subClassOf>`,
    `            <owl:Restriction>`,
    `                <owl:onProperty rdf:resource="#${onProp}"/>`,
    `                <owl:someValuesFrom rdf:resource="${target}"/>`,
    `            </owl:Restriction>`,
    `        </rdfs:subClassOf>`,
  ].join("\n");
}

function sectionBanner(name: string): string {
  return [
    ``,
    `        <!-- `,
    `        //////////////////////////////////////////////////////////`,
    `        //`,
    `        // ${name}`,
    `        //`,
    `        //////////////////////////////////////////////////////////`,
    `        -->`,
    ``,
  ].join("\n");
}

function metadataInner(m: OtbModel): string {
  return [
    `        <dc:title>${esc(m.meta.title)}</dc:title>`,
    `        <dc:description>${esc(m.meta.description)}</dc:description>`,
    `        <dc:issued>July 22, 2026</dc:issued>`,
    `        <dc:modified rdf:datatype="http://www.w3.org/2001/XMLSchema#date">2026-07-22</dc:modified>`,
    `        <dc:creator>${esc(m.meta.author)}</dc:creator>`,
    `        <dc:publisher>${esc(m.meta.publisher)}</dc:publisher>`,
  ].join("\n");
}

function emitSkos(m: OtbModel, out: string[]): void {
  out.push(sectionBanner("SKOS"));
  out.push(`        <!--  SKOS Concept Scheme -->`, ``);
  out.push(
    `    <skos:ConceptScheme rdf:about="${BASE_NO_HASH}">`,
    metadataInner(m),
    `    </skos:ConceptScheme>`,
    ``,
  );
  out.push(`        <!--  SKOS Concepts -->`, ``);
  for (const c of m.concepts) {
    const lines = [`    <skos:Concept rdf:about="#${c.id}">`];
    lines.push(
      `        <skos:inScheme rdf:resource="${BASE_NO_HASH}"/>`,
    );
    if (c.shortName) {
      lines.push(
        `        <rdfs:label xml:lang="en">${esc(c.shortName)}</rdfs:label>`,
        `        <skos:prefLabel xml:lang="en">${esc(c.shortName)}</skos:prefLabel>`,
      );
    }
    if (c.definition) {
      lines.push(
        `        <skos:definition xml:lang="en">${esc(c.definition)}</skos:definition>`,
      );
    }
    if (c.isA) {
      lines.push(`        <skos:broader rdf:resource="#${c.isA}"/>`);
    } else {
      lines.push(
        `        <skos:topConceptOf rdf:resource="${BASE_NO_HASH}"/>`,
      );
    }
    for (const n of m.concepts.filter((x) => x.isA === c.id)) {
      lines.push(`        <skos:narrower rdf:resource="#${n.id}"/>`);
    }
    for (const r of c.related ?? []) {
      lines.push(`        <skos:related rdf:resource="#${r}"/>`);
    }
    for (const ex of c.examples ?? []) {
      lines.push(`        <skos:example rdf:resource="#${ex}"/>`);
    }
    lines.push(`    </skos:Concept>`, ``);
    out.push(lines.join("\n"));
  }
}

function emitOwl(m: OtbModel, out: string[]): void {
  out.push(sectionBanner("OWL"));
  out.push(`        <!--  OWL Object Properties -->`, ``);
  for (const r of m.relations) {
    if (!r.axiomatized) continue;
    out.push(
      [
        `    <owl:ObjectProperty rdf:about="#${r.id}">`,
        `        <rdfs:label>${r.id}</rdfs:label>`,
        unionBlock("rdfs:domain", r.domain),
        unionBlock("rdfs:range", r.range),
        `    </owl:ObjectProperty>`,
        ``,
      ].join("\n"),
    );
  }

  out.push(`        <!--  OWL Data Properties -->`, ``);
  for (const a of m.attributes) {
    out.push(
      [
        `    <owl:DatatypeProperty rdf:about="#${a.id}">`,
        `        <rdfs:label>${a.id}</rdfs:label>`,
        unionBlock("rdfs:domain", a.domain),
        `        <rdfs:range rdf:resource="${XSD_STRING}"/>`,
        `    </owl:DatatypeProperty>`,
        ``,
      ].join("\n"),
    );
  }

  out.push(`        <!--  OWL Classes -->`, ``);
  for (const c of m.concepts) {
    const lines = [`    <owl:Class rdf:about="#${c.id}">`];
    if (c.shortName && c.definition) {
      lines.push(
        `        <rdfs:label xml:lang="en">${esc(c.shortName)}</rdfs:label>`,
        `        <skos:prefLabel xml:lang="en">${esc(c.shortName)}</skos:prefLabel>`,
        `        <skos:definition xml:lang="en">${esc(c.definition)}</skos:definition>`,
      );
    }
    if (c.isA) lines.push(`        <rdfs:subClassOf rdf:resource="#${c.isA}"/>`);
    for (const r of ownRelations(m, c.id)) {
      for (const range of r.range) lines.push(restriction(r.id, range));
    }
    for (const a of ownAttributes(m, c.id)) {
      lines.push(restriction(a.id, XSD_STRING));
    }
    lines.push(`    </owl:Class>`, ``);
    out.push(lines.join("\n"));
  }

  out.push(`        <!--  OWL Individuals -->`, ``);
  for (const o of m.objects) {
    const lines = [
      `    <owl:NamedIndividual rdf:about="#${o.id}">`,
      `        <rdfs:label xml:lang="en">${esc(o.label)}</rdfs:label>`,
      `        <skos:prefLabel xml:lang="en">${esc(o.label)}</skos:prefLabel>`,
      `        <rdf:type rdf:resource="#${o.concept}"/>`,
    ];
    if (o.note) {
      lines.push(`        <skos:note xml:lang="en">${esc(o.note)}</skos:note>`);
    }
    for (const l of o.literals) {
      const lang = l.lang ? ` xml:lang="${l.lang}"` : "";
      lines.push(`        <${l.attr}${lang}>${esc(l.value)}</${l.attr}>`);
    }
    for (const r of o.relations) {
      lines.push(`        <${r.rel} rdf:resource="#${r.target}"/>`);
    }
    lines.push(`    </owl:NamedIndividual>`, ``);
    out.push(lines.join("\n"));
  }
}

function emitOntolex(m: OtbModel, out: string[]): void {
  out.push(sectionBanner("OntoLex-Lemon"));
  for (const t of m.terms) {
    const lines = [
      `    <ontolex:LexicalEntry rdf:about="#${t.id}">`,
      `        <ontolex:lexicalForm>`,
      `            <ontolex:Form rdf:about="#form_${t.id}">`,
      `                <ontolex:writtenRep xml:lang="${t.lang}">${esc(t.name)}</ontolex:writtenRep>`,
      `            </ontolex:Form>`,
      `        </ontolex:lexicalForm>`,
      `        <ontolex:evokes>`,
      `            <ontolex:LexicalConcept rdf:about="#lexical_concept_${t.id}">`,
      `                <ontolex:isEvokedBy rdf:resource="#${t.id}"/>`,
    ];
    if (t.definition) {
      lines.push(
        `                <skos:definition xml:lang="${t.lang}">${esc(t.definition)}</skos:definition>`,
      );
    }
    lines.push(
      `            </ontolex:LexicalConcept>`,
      `        </ontolex:evokes>`,
      `        <ontolex:denotes rdf:resource="#${t.concept}"/>`,
      `    </ontolex:LexicalEntry>`,
      ``,
    );
    out.push(lines.join("\n"));
  }
}

function emitOtv(m: OtbModel, out: string[]): void {
  out.push(sectionBanner("OTV"));
  out.push(
    [
      `<!-- ONTOTERMINOLOGY`,
      ``,
      `        Ontoterminology: ${m.meta.title}`,
      `        Author: ${m.meta.author}`,
      `        Creation date: July 19, 2026`,
      `        Export date: July 22, 2026`,
      `        TEDI 4.1 compatible export, generated from the Laertius corpus layers`,
      `        http://ontoterminology.com/tedi -->`,
      ``,
      `        <!--  Ontoterminology Metadata -->`,
      ``,
      `    <otv:Ontoterminology rdf:about="${BASE_NO_HASH}">`,
      `        <dc:title>${esc(m.meta.title)}</dc:title>`,
      `        <dc:description>${esc(m.meta.description)}</dc:description>`,
      `        <dc:date rdf:datatype="http://www.w3.org/2001/XMLSchema#date">2026-07-19</dc:date>`,
      `        <dc:modified rdf:datatype="http://www.w3.org/2001/XMLSchema#date">2026-07-22</dc:modified>`,
      `        <dc:issued>July 22, 2026</dc:issued>`,
      `        <dc:creator>${esc(m.meta.author)}</dc:creator>`,
      `        <dc:publisher>${esc(m.meta.publisher)}</dc:publisher>`,
      `    </otv:Ontoterminology>`,
      ``,
    ].join("\n"),
  );

  out.push(`        <!--  OTV Relations -->`);
  for (const r of m.relations) {
    out.push(`    <otv:Relation rdf:about="#${r.id}"/>`);
  }
  out.push(``, `        <!--  OTV Attributes -->`);
  for (const a of m.attributes) {
    out.push(`    <otv:Attribute rdf:about="#${a.id}"/>`);
  }
  out.push(``, `        <!--  OTV Categories -->`);
  for (const c of m.categories) {
    out.push(`    <otv:Category rdf:about="#${c}"/>`);
  }

  out.push(``, `        <!--  OTV Concepts -->`);
  for (const c of m.concepts) {
    const lines = [
      `    <otv:Concept rdf:about="#${c.id}">`,
      `        <otv:conceptName>${esc(`<${c.id}>`)}</otv:conceptName>`,
    ];
    if (c.shortName) {
      lines.push(`        <otv:shortConceptName>${esc(c.shortName)}</otv:shortConceptName>`);
    }
    if (c.isA) lines.push(`        <otv:isA rdf:resource="#${c.isA}"/>`);
    for (const r of inheritedRelations(m, c.id)) {
      for (const range of r.range) {
        lines.push(`        <${r.id} rdf:resource="#${range}"/>`);
      }
    }
    for (const a of inheritedAttributes(m, c.id)) {
      lines.push(`        <otv:attribute rdf:resource="#${a.id}"/>`);
    }
    for (const t of m.terms.filter((t) => t.concept === c.id)) {
      lines.push(`        <otv:denotedByTerm rdf:resource="#${t.id}"/>`);
    }
    lines.push(`    </otv:Concept>`, ``);
    out.push(lines.join("\n"));
  }

  out.push(`        <!--  OTV Terms -->`, ``);
  for (const t of m.terms) {
    const lines = [
      `    <otv:Term rdf:about="#${t.id}">`,
      `        <rdfs:label xml:lang="${t.lang}">${esc(t.name)}</rdfs:label>`,
      `        <otv:termName>${esc(t.name)}</otv:termName>`,
      `        <otv:language>${t.lang}</otv:language>`,
      `        <otv:denotedConcept rdf:resource="#${t.concept}"/>`,
      `        <otv:termStatus>${t.status}</otv:termStatus>`,
      `        <otv:partOfSpeech>${t.partOfSpeech}</otv:partOfSpeech>`,
      `        <otv:gender>${t.gender}</otv:gender>`,
    ];
    if (t.definition) {
      lines.push(
        `        <otv:termDefinition>${esc(t.definition)}</otv:termDefinition>`,
        `        <skos:definition xml:lang="${t.lang}">${esc(t.definition)}</skos:definition>`,
      );
    }
    if (t.lsj) {
      lines.push(`        <rdfs:seeAlso rdf:resource="${esc(t.lsj)}"/>`);
    }
    if (t.wikidata) {
      lines.push(`        <rdfs:seeAlso rdf:resource="${esc(t.wikidata)}"/>`);
    }
    lines.push(`    </otv:Term>`, ``);
    out.push(lines.join("\n"));
  }

  out.push(`        <!--  OTV Proper Names -->`, ``);
  for (const n of m.properNames) {
    const lines = [
      `    <otv:ProperName rdf:about="#${n.id}">`,
      `        <otv:properName>${esc(n.name)}</otv:properName>`,
      `        <otv:language>${n.lang}</otv:language>`,
      `        <otv:denotedObject rdf:resource="#${n.object}"/>`,
    ];
    for (const a of n.allonyms) {
      lines.push(`        <otv:allonym rdf:resource="#${a}"/>`);
    }
    lines.push(`    </otv:ProperName>`, ``);
    out.push(lines.join("\n"));
  }

  out.push(`        <!--  OTV Individuals -->`, ``);
  for (const o of m.objects) {
    const lines = [
      `    <otv:Object rdf:about="#${o.id}">`,
      `        <otv:instanceOf rdf:resource="#${o.concept}"/>`,
      `        <otv:memberOfCategory rdf:resource="#${o.category}"/>`,
    ];
    for (const n of o.names) {
      lines.push(`        <otv:denotedByProperName rdf:resource="#${n}"/>`);
    }
    lines.push(`    </otv:Object>`, ``);
    out.push(lines.join("\n"));
  }
}

let cachedRdf: string | null = null;

/** The complete TEDI-compatible RDF/XML export, built once and cached. */
export function getOtbRdf(): string {
  if (cachedRdf) return cachedRdf;
  const m = getOtbModel();
  const out: string[] = [];
  out.push(
    [
      `<?xml version="1.0" encoding="utf-8"?>`,
      `<!-- Ontoterminology: ${m.meta.title} -->`,
      `<!-- Author: ${m.meta.author} -->`,
      `<!-- Creation date: July 19, 2026 -->`,
      `<!-- Export date: July 22, 2026 -->`,
      `<!-- TEDI 4.1 compatible export, generated from the Laertius corpus layers -->`,
      `<!-- http://ontoterminology.com/tedi -->`,
      `<rdf:RDF xmlns="${OTB_BASE}"`,
      `    xml:base="${BASE_NO_HASH}"`,
      `    xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"`,
      `    xmlns:owl="http://www.w3.org/2002/07/owl#"`,
      `    xmlns:skos="http://www.w3.org/2004/02/skos/core#"`,
      `    xmlns:foaf="http://xmlns.com/foaf/0.1/"`,
      `    xmlns:dc="http://purl.org/dc/elements/1.1/"`,
      `    xmlns:xml="http://www.w3.org/XML/1998/namespace"`,
      `    xmlns:xsd="http://www.w3.org/2001/XMLSchema#"`,
      `    xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"`,
      `    xmlns:otv="http://www.ontologia.fr/OTB/otv#"`,
      `    xmlns:ontolex="http://www.w3.org/ns/lemon/ontolex#">`,
      ``,
      `        <!--  METADATA -->`,
      ``,
      `    <owl:Ontology rdf:about="${BASE_NO_HASH}">`,
      metadataInner(m),
      `    </owl:Ontology>`,
      ``,
    ].join("\n"),
  );
  emitSkos(m, out);
  emitOwl(m, out);
  emitOntolex(m, out);
  out.push(``, OTV_CORE, ``);
  emitOtv(m, out);
  out.push(`</rdf:RDF>`, ``);
  cachedRdf = out.join("\n");
  return cachedRdf;
}
