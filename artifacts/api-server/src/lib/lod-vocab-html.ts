/**
 * FaBiO-style human-readable vocabulary documentation for the Laertius
 * ontology (the assertion model's TBox).
 *
 * Modeled on the SPAR ontology documentation pages (e.g.
 * https://sparontologies.github.io/fabio/current/fabio.html, produced by
 * LODE): a metadata header, a table of contents, then one documented
 * entry per class, object property and data property, each with its IRI,
 * label, textual definition, hierarchy links, domain/range and
 * external-ontology alignments.
 *
 * The page is generated from ontologyAsTurtle() itself — the same TBox
 * served at /api/lod/ontology.ttl — so the documentation can never drift
 * from the published vocabulary. The result is cached: the ontology is
 * static per process.
 */

import { Parser as N3Parser, type Quad } from "n3";

import { ontologyAsTurtle, ONT, LOD_BASE } from "./lod";

const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const OWL = "http://www.w3.org/2002/07/owl#";
const DCTERMS = "http://purl.org/dc/terms/";
const SKOS = "http://www.w3.org/2004/02/skos/core#";

type Section = "class" | "objectProperty" | "dataProperty" | "individual";

const SECTION_META: Record<
  Section,
  { title: string; marker: string; anchor: string }
> = {
  class: { title: "Classes", marker: "c", anchor: "classes" },
  objectProperty: {
    title: "Object properties",
    marker: "op",
    anchor: "object-properties",
  },
  dataProperty: {
    title: "Data properties",
    marker: "dp",
    anchor: "data-properties",
  },
  individual: {
    title: "Named individuals",
    marker: "ni",
    anchor: "individuals",
  },
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Parse the @prefix lines of the generated Turtle (we emit them ourselves). */
function parsePrefixes(ttl: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const m of ttl.matchAll(/^@prefix\s+([\w-]*):\s+<([^>]+)>\s*\./gm)) {
    out.push([m[1]!, m[2]!]);
  }
  if (out.length === 0) {
    throw new Error("lod-vocab-html: no @prefix lines found in ontology Turtle");
  }
  return out;
}

interface TermDoc {
  readonly iri: string;
  readonly section: Section;
  readonly label: string;
  readonly comments: string[];
  /** predicate IRI -> object terms, in document order. */
  readonly props: Map<string, Quad["object"][]>;
}

function buildHtml(): string {
  const ttl = ontologyAsTurtle();
  const prefixes = parsePrefixes(ttl);
  const quads = new N3Parser().parse(ttl);

  const qname = (iri: string): string => {
    for (const [p, ns] of prefixes) {
      if (iri.startsWith(ns) && iri.length > ns.length) {
        return `${p}:${iri.slice(ns.length)}`;
      }
    }
    return iri;
  };

  // Group quads by subject, keeping document order.
  const bySubject = new Map<string, Quad[]>();
  const subjectOrder: string[] = [];
  for (const q of quads) {
    if (q.subject.termType !== "NamedNode") continue;
    let arr = bySubject.get(q.subject.value);
    if (!arr) {
      arr = [];
      bySubject.set(q.subject.value, arr);
      subjectOrder.push(q.subject.value);
    }
    arr.push(q);
  }

  const ontologyIri = `${LOD_BASE}/ontology`;
  const header = bySubject.get(ontologyIri) ?? [];
  const headerValue = (pred: string): string | null => {
    const q = header.find((x) => x.predicate.value === pred);
    return q ? q.object.value : null;
  };

  const terms: TermDoc[] = [];
  const termByIri = new Map<string, TermDoc>();
  for (const iri of subjectOrder) {
    if (!iri.startsWith(ONT)) continue;
    const qs = bySubject.get(iri)!;
    const types = qs
      .filter((q) => q.predicate.value === `${RDF}type`)
      .map((q) => q.object.value);
    let section: Section | null = null;
    if (types.includes(`${OWL}Class`)) section = "class";
    else if (types.includes(`${OWL}ObjectProperty`)) section = "objectProperty";
    else if (types.includes(`${OWL}DatatypeProperty`)) section = "dataProperty";
    else if (types.length > 0) section = "individual";
    if (!section) continue;

    const props = new Map<string, Quad["object"][]>();
    const comments: string[] = [];
    let label = qname(iri).replace(/^lo:/, "");
    for (const q of qs) {
      const pred = q.predicate.value;
      if (pred === `${RDFS}label`) {
        label = q.object.value;
        continue;
      }
      if (pred === `${RDFS}comment`) {
        comments.push(q.object.value);
        continue;
      }
      let arr = props.get(pred);
      if (!arr) {
        arr = [];
        props.set(pred, arr);
      }
      arr.push(q.object);
    }
    const term: TermDoc = { iri, section, label, comments, props };
    terms.push(term);
    termByIri.set(iri, term);
  }

  if (terms.length === 0) {
    throw new Error("lod-vocab-html: no lo: terms found in ontology Turtle");
  }

  // Inverse indexes: subclasses, sub-properties, in-domain-of, in-range-of.
  const inverse = {
    subClassOf: new Map<string, string[]>(),
    subPropertyOf: new Map<string, string[]>(),
    domainOf: new Map<string, string[]>(),
    rangeOf: new Map<string, string[]>(),
  };
  const pushInv = (map: Map<string, string[]>, key: string, val: string) => {
    const arr = map.get(key);
    if (arr) arr.push(val);
    else map.set(key, [val]);
  };
  for (const t of terms) {
    for (const o of t.props.get(`${RDFS}subClassOf`) ?? []) {
      if (o.termType === "NamedNode") pushInv(inverse.subClassOf, o.value, t.iri);
    }
    for (const o of t.props.get(`${RDFS}subPropertyOf`) ?? []) {
      if (o.termType === "NamedNode")
        pushInv(inverse.subPropertyOf, o.value, t.iri);
    }
    for (const o of t.props.get(`${RDFS}domain`) ?? []) {
      if (o.termType === "NamedNode") pushInv(inverse.domainOf, o.value, t.iri);
    }
    for (const o of t.props.get(`${RDFS}range`) ?? []) {
      if (o.termType === "NamedNode") pushInv(inverse.rangeOf, o.value, t.iri);
    }
  }

  const anchorFor = (t: TermDoc): string =>
    `${SECTION_META[t.section].marker}-${t.iri.slice(ONT.length)}`;

  /** Render an RDF term as HTML: local terms cross-link, external open the IRI. */
  const renderTerm = (o: Quad["object"]): string => {
    if (o.termType === "Literal") {
      return `<span class="lit">"${escapeHtml(o.value)}"${
        o.language ? `@${o.language}` : ""
      }</span>`;
    }
    if (o.termType !== "NamedNode") return escapeHtml(o.value);
    const local = termByIri.get(o.value);
    if (local) {
      return `<a href="#${anchorFor(local)}">${escapeHtml(qname(o.value))}</a>`;
    }
    return `<a class="ext" href="${escapeHtml(o.value)}" rel="noopener">${escapeHtml(
      qname(o.value),
    )}</a>`;
  };
  const renderLocalList = (iris: string[] | undefined): string | null =>
    iris && iris.length > 0
      ? iris
          .map((iri) =>
            renderTerm({ termType: "NamedNode", value: iri } as Quad["object"]),
          )
          .join(", ")
      : null;

  // Facts we present with curated row labels, in a fixed order; anything
  // else the TBox carries is still shown generically so nothing is hidden.
  const KNOWN_ROWS: Array<[string, string]> = [
    [`${RDF}type`, "type"],
    [`${RDFS}subClassOf`, "subclass of"],
    [`${RDFS}subPropertyOf`, "subproperty of"],
    [`${OWL}equivalentClass`, "equivalent to"],
    [`${OWL}equivalentProperty`, "equivalent to"],
    [`${RDFS}domain`, "domain"],
    [`${RDFS}range`, "range"],
    [`${SKOS}exactMatch`, "exact match"],
    [`${SKOS}closeMatch`, "close match"],
    [`${RDFS}seeAlso`, "see also"],
  ];
  const knownPreds = new Set(KNOWN_ROWS.map(([p]) => p));

  const renderEntry = (t: TermDoc): string => {
    const rows: string[] = [];
    const addRow = (label: string, html: string | null) => {
      if (html) rows.push(`<tr><th>${label}</th><td>${html}</td></tr>`);
    };
    addRow("IRI", `<code>${escapeHtml(t.iri)}</code>`);
    for (const [pred, label] of KNOWN_ROWS) {
      const objects = t.props.get(pred);
      if (!objects || objects.length === 0) continue;
      const shown =
        pred === `${RDF}type`
          ? objects.filter(
              (o) =>
                o.termType !== "NamedNode" ||
                ![`${OWL}Class`, `${OWL}ObjectProperty`, `${OWL}DatatypeProperty`].includes(
                  o.value,
                ),
            )
          : objects;
      if (shown.length === 0) continue;
      addRow(label, shown.map(renderTerm).join(", "));
    }
    addRow("has subclasses", renderLocalList(inverse.subClassOf.get(t.iri)));
    addRow(
      "has subproperties",
      renderLocalList(inverse.subPropertyOf.get(t.iri)),
    );
    addRow("is in domain of", renderLocalList(inverse.domainOf.get(t.iri)));
    addRow("is in range of", renderLocalList(inverse.rangeOf.get(t.iri)));
    for (const [pred, objects] of t.props) {
      if (knownPreds.has(pred)) continue;
      addRow(escapeHtml(qname(pred)), objects.map(renderTerm).join(", "));
    }
    const comments = t.comments
      .map((c) => `<p class="def">${escapeHtml(c)}</p>`)
      .join("\n");
    return [
      `<section class="entry" id="${escapeHtml(anchorFor(t))}">`,
      `<h3>${escapeHtml(t.label)} <sup class="marker" title="${
        SECTION_META[t.section].title
      }">${SECTION_META[t.section].marker}</sup></h3>`,
      comments,
      `<table class="facts">${rows.join("")}</table>`,
      `</section>`,
    ].join("\n");
  };

  const sections: Section[] = [
    "class",
    "objectProperty",
    "dataProperty",
    "individual",
  ];
  const bySection = new Map<Section, TermDoc[]>();
  for (const s of sections) bySection.set(s, []);
  for (const t of terms) bySection.get(t.section)!.push(t);
  for (const s of sections) {
    bySection.get(s)!.sort((a, b) => a.label.localeCompare(b.label, "en"));
  }

  const toc = sections
    .filter((s) => bySection.get(s)!.length > 0)
    .map((s) => {
      const items = bySection
        .get(s)!
        .map(
          (t) =>
            `<li><a href="#${escapeHtml(anchorFor(t))}">${escapeHtml(t.label)}</a></li>`,
        )
        .join("");
      return `<div class="toc-block"><h3><a href="#${SECTION_META[s].anchor}">${SECTION_META[s].title}</a></h3><ul>${items}</ul></div>`;
    })
    .join("\n");

  const body = sections
    .filter((s) => bySection.get(s)!.length > 0)
    .map((s) => {
      const entries = bySection.get(s)!.map(renderEntry).join("\n");
      return `<h2 id="${SECTION_META[s].anchor}">${SECTION_META[s].title}</h2>\n${entries}`;
    })
    .join("\n");

  const nsRows = prefixes
    .map(
      ([p, ns]) =>
        `<tr><td><code>${escapeHtml(p)}</code></td><td><code>${escapeHtml(
          ns,
        )}</code></td></tr>`,
    )
    .join("");

  const label = headerValue(`${RDFS}label`) ?? "Laertius Ontology";
  const description = headerValue(`${DCTERMS}description`) ?? "";
  const source = headerValue(`${DCTERMS}source`);
  const counts = sections
    .filter((s) => bySection.get(s)!.length > 0)
    .map(
      (s) =>
        `${bySection.get(s)!.length} ${SECTION_META[s].title.toLowerCase()} (${SECTION_META[s].marker})`,
    )
    .join(", ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(label)} — vocabulary documentation</title>
<style>
  :root { color-scheme: light; }
  body { font-family: sans-serif; margin: 0; color: rgb(15,15,15); background: #fff; }
  main { max-width: 60rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
  header.doc { margin-bottom: 1.5rem; }
  h1, h2, h3 { color: #005A9C; background: #fff; text-align: left; }
  h1 { font-size: 170%; margin: 0 0 .25rem; font-weight: bold; }
  .subtitle { color: gray; font-style: italic; margin: 0 0 1rem; }
  h2 { font-size: 140%; margin-top: 40px; border-bottom: 0; padding-bottom: .25rem; }
  h3 { font-size: 120%; margin: 0 0 .35rem; padding-bottom: 5px; border-bottom: 1px solid navy; }
  code { font-family: monospace; font-size: .9em; background: #F9F9F9; padding: .1em .3em; overflow-wrap: anywhere; }
  a:link { color: #00c; }
  a:visited { color: #609; }
  a:active { color: #c00; }
  a:hover { background: #ffa; }
  sup.marker { color: purple; font-family: sans-serif; font-size: .6em; font-weight: bold; letter-spacing: .05em; }
  .meta th { text-align: left; padding: .15rem .75rem .15rem 0; vertical-align: top; white-space: nowrap; font-weight: bold; }
  .meta td { padding: .15rem 0; }
  .abstract { line-height: 1.55; }
  .ns td { padding: .12rem .9rem .12rem 0; }
  .toc-block { break-inside: avoid; }
  .toc { columns: 2; column-gap: 2.5rem; }
  .toc h3 { margin-top: .8rem; border-bottom: 0; }
  .toc ul { margin: .25rem 0 .75rem; padding-left: 1.1rem; }
  .toc li { margin: .1rem 0; }
  section.entry { border-top: 1px dashed gray; border-bottom: 1px dashed gray; background: rgb(242,243,244); padding: .6rem 1rem .8rem; margin: 1rem 0; }
  section.entry h3 { border-bottom: 0; margin-top: .2rem; color: #005A9C; background: transparent; }
  .def { margin: .3rem 0 .6rem; line-height: 1.5; }
  table.facts { border-collapse: collapse; width: 100%; font-size: .92em; }
  table.facts th { text-align: left; padding: .18rem .8rem .18rem 0; vertical-align: top; white-space: nowrap; color: rgb(15,15,15); font-weight: bold; }
  table.facts td { padding: .18rem 0; overflow-wrap: anywhere; }
  @media (max-width: 40rem) { .toc { columns: 1; } table.facts th { white-space: normal; } }
</style>
</head>
<body>
<main>
<header class="doc">
<h1>${escapeHtml(label)}</h1>
<p class="subtitle">Vocabulary documentation for the assertion model of Diogenes Laertius' <em>Lives of Eminent Philosophers</em>.</p>
<table class="meta">
<tr><th>Ontology IRI</th><td><code>${escapeHtml(ontologyIri)}</code></td></tr>
<tr><th>Machine-readable</th><td><a href="ontology.ttl">Turtle</a> · <a href="ontology.rdf">RDF/XML</a> · <a href="ontology.jsonld">JSON-LD</a></td></tr>
${source ? `<tr><th>Corpus</th><td><code>${escapeHtml(source)}</code></td></tr>` : ""}
<tr><th>Contents</th><td>${escapeHtml(counts)}</td></tr>
<tr><th>License</th><td><a class="ext" href="https://creativecommons.org/licenses/by-nc-sa/4.0/" rel="noopener">CC BY-NC-SA 4.0</a></td></tr>
</table>
</header>
<h2 id="abstract">Abstract</h2>
<p class="abstract">${escapeHtml(description)}</p>
<h2 id="namespaces">Namespace declarations</h2>
<table class="ns">${nsRows}</table>
<h2 id="toc">Table of contents</h2>
<div class="toc">
${toc}
</div>
${body}
</main>
</body>
</html>`;
}

let cached: string | null = null;

/** The FaBiO-style HTML vocabulary page, cached per process. */
export function ontologyAsHtml(): string {
  if (!cached) cached = buildHtml();
  return cached;
}
