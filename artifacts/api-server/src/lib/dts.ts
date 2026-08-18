/**
 * Distributed Text Services (DTS) 1.0 read-only API layer.
 *
 * Implements the four DTS endpoints (Entry, Collection, Navigation,
 * Document) over the single corpus this server carries: Diogenes Laertius,
 * Lives of Eminent Philosophers, aligned to the Perseus CTS edition
 * urn:cts:greekLit:tlg0004.tlg001.perseus-grc2.
 *
 * Spec: https://distributed-text-services.github.io/specifications/
 * (v1.0, published 2026-02). The Collection and Navigation endpoints return
 * JSON-LD (application/ld+json); the Document endpoint returns TEI/XML
 * (application/tei+xml) by default.
 *
 * Citation tree (two levels):
 *   level 1  book       identifier "1".."10"          citeType "book"
 *   level 2  section    identifier "<book>.<section>" citeType "section"
 *
 * The Perseus citation for this work is book.section (e.g. "1.22" for
 * Thales). A handful of section numbers recur across chapter boundaries
 * within a book (so book.section is not globally unique); where that
 * happens the fully-qualified corpus id (book.chapter.section, e.g.
 * "1.1.22") is used as the CitableUnit identifier instead, keeping every
 * identifier unique within the tree as the spec requires. The Document and
 * Navigation resolvers accept either form.
 */
import { corpus, type CorpusSection } from "./corpus";

/**
 * The Resource identifier: the Perseus CTS edition URN shared by every
 * passage in the store (they all carry it as the work-level prefix of
 * their per-passage URN).
 */
export const DTS_RESOURCE_ID = "urn:cts:greekLit:tlg0004.tlg001.perseus-grc2";

/** DTS 1.0 JSON-LD context and version stamp. */
export const DTS_CONTEXT = "https://dtsapi.org/context/v1.0.json";
export const DTS_VERSION = "1.0";

/** Media type the Document endpoint serves by default. */
export const TEI_MEDIA_TYPE = "application/tei+xml";
export const JSONLD_MEDIA_TYPE = "application/ld+json";

/** Work title in the source language (grc) and English. */
const WORK_TITLE_GRC = "Βίοι καὶ γνῶμαι τῶν ἐν φιλοσοφίᾳ εὐδοκιμησάντων";
const WORK_TITLE_EN = "Lives of Eminent Philosophers";
const WORK_CREATOR = "Diogenes Laertius";

/**
 * A CitableUnit at level 2 (a section). identifier is the reference the
 * client uses; ref is the canonical corpus id it resolves to.
 */
interface SectionUnit {
  identifier: string;
  section: CorpusSection;
}

/**
 * Books in document order, each with its ordered sections and the
 * level-2 identifier chosen for every section (book.section when that is
 * unique within the book, else the fully-qualified corpus id).
 */
interface BookNode {
  book: number;
  sections: SectionUnit[];
}

let bookNodesCache: BookNode[] | null = null;

/**
 * Assign a level-2 identifier to every section, applying the canonical
 * collision policy: the FIRST section (in corpus/document order) carrying a
 * given book.section shorthand keeps that shorthand; every SUBSEQUENT
 * section sharing the shorthand falls back to its fully-qualified
 * book.chapter.section id. Identifiers are therefore unique across the whole
 * work, and the common Perseus refs (e.g. 1.22) stay in their shorthand
 * form. The scan runs over `corpus` in document order so "first" is stable.
 */
function buildBookNodes(): BookNode[] {
  const usedShorthand = new Set<string>();
  const unitBySectionId = new Map<string, SectionUnit>();
  const byBook = new Map<number, SectionUnit[]>();
  for (const s of corpus) {
    const short = `${s.book}.${s.section}`;
    // First writer of a shorthand keeps it; later collisions use the full id.
    const identifier = usedShorthand.has(short) ? s.id : short;
    if (!usedShorthand.has(short)) usedShorthand.add(short);
    const unit: SectionUnit = { identifier, section: s };
    unitBySectionId.set(s.id, unit);
    const list = byBook.get(s.book);
    if (list) list.push(unit);
    else byBook.set(s.book, [unit]);
  }
  const books = [...byBook.keys()].sort((a, b) => a - b);
  const nodes: BookNode[] = [];
  for (const book of books) {
    nodes.push({ book, sections: byBook.get(book)! });
  }
  return nodes;
}

function bookNodes(): BookNode[] {
  if (!bookNodesCache) bookNodesCache = buildBookNodes();
  return bookNodesCache;
}

/**
 * Data-derived collision statistics for the citation tree, exported so the
 * smoke/local tests can assert them exhaustively against the store instead
 * of trusting a hard-coded figure.
 */
export interface DtsTreeStats {
  bookCount: number;
  sectionUnitCount: number;
  /** Number of distinct book.section keys carried by more than one section. */
  ambiguousShorthandCount: number;
  /** Total sections sharing an ambiguous shorthand (across all such keys). */
  collidingSectionCount: number;
  /** Sections that fall back to their fully-qualified id (all but the first). */
  fallbackCount: number;
}

export function dtsTreeStats(): DtsTreeStats {
  const shortCounts = new Map<string, number>();
  for (const s of corpus) {
    const short = `${s.book}.${s.section}`;
    shortCounts.set(short, (shortCounts.get(short) ?? 0) + 1);
  }
  let ambiguousShorthandCount = 0;
  let collidingSectionCount = 0;
  let fallbackCount = 0;
  for (const count of shortCounts.values()) {
    if (count > 1) {
      ambiguousShorthandCount += 1;
      collidingSectionCount += count;
      fallbackCount += count - 1;
    }
  }
  let sectionUnitCount = 0;
  for (const node of bookNodes()) sectionUnitCount += node.sections.length;
  return {
    bookCount: bookNodes().length,
    sectionUnitCount,
    ambiguousShorthandCount,
    collidingSectionCount,
    fallbackCount,
  };
}

/** All level-2 identifiers → their corpus section, for reference lookup. */
let refIndexCache: Map<string, CorpusSection> | null = null;

function refIndex(): Map<string, CorpusSection> {
  if (refIndexCache) return refIndexCache;
  const map = new Map<string, CorpusSection>();
  for (const node of bookNodes()) {
    for (const unit of node.sections) {
      // The chosen identifier always resolves.
      map.set(unit.identifier, unit.section);
      // Accept the fully-qualified corpus id too (book.chapter.section),
      // even when the shorthand was used as the canonical identifier.
      map.set(unit.section.id, unit.section);
      // Accept the book.section shorthand as an alias when it is
      // unambiguous (first writer wins for the rare collisions).
      const short = `${unit.section.book}.${unit.section.section}`;
      if (!map.has(short)) map.set(short, unit.section);
    }
  }
  refIndexCache = map;
  return map;
}

/** Is this ref a book-level reference (level 1)? */
function bookByRef(ref: string): BookNode | undefined {
  if (!/^\d+$/.test(ref)) return undefined;
  const book = Number(ref);
  return bookNodes().find((n) => n.book === book);
}

/** Resolve a section-level ref to its corpus section, if any. */
export function resolveSectionRef(ref: string): CorpusSection | undefined {
  return refIndex().get(ref);
}

/** corpus section id → its assigned level-2 CitableUnit. */
let unitBySectionIdCache: Map<string, SectionUnit> | null = null;

function unitForSection(section: CorpusSection): SectionUnit {
  if (!unitBySectionIdCache) {
    unitBySectionIdCache = new Map();
    for (const node of bookNodes()) {
      for (const unit of node.sections) {
        unitBySectionIdCache.set(unit.section.id, unit);
      }
    }
  }
  return (
    unitBySectionIdCache.get(section.id) ?? {
      identifier: section.id,
      section,
    }
  );
}

// ---------------------------------------------------------------------
// URI-template + base-URL helpers
// ---------------------------------------------------------------------

/**
 * Configured canonical public origin for the DTS endpoints. Prefer an
 * explicit env value (DTS_PUBLIC_ORIGIN, e.g.
 * "https://laertius.humanisticadigitalia.eu"); otherwise fall back to the
 * origin the LOD code publishes under (LOD_BASE_URI minus any path). This is
 * operator-configured, NOT attacker-controlled. Returns null when nothing is
 * configured, so the caller can fall back to the (trusted) request origin.
 */
function configuredPublicOrigin(): string | null {
  const explicit = process.env["DTS_PUBLIC_ORIGIN"];
  if (explicit && explicit.trim() !== "") {
    return normaliseOrigin(explicit.trim());
  }
  const lodBase = process.env["LOD_BASE_URI"];
  if (lodBase && lodBase.trim() !== "") {
    try {
      const u = new URL(lodBase.trim());
      if (u.protocol === "http:" || u.protocol === "https:") {
        return `${u.protocol}//${u.host}`;
      }
    } catch {
      // fall through
    }
  }
  return null;
}

/** Strip any path/trailing slash and require an http(s) origin. */
function normaliseOrigin(value: string): string | null {
  try {
    const u = new URL(value);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/**
 * Absolute base URL the DTS endpoints live under (no trailing slash),
 * ending in "/dts".
 *
 * Base-URL policy (no attacker-controlled host may enter published links):
 *   1. Use the operator-configured canonical origin if present.
 *   2. Otherwise, ONLY when Express "trust proxy" is enabled, trust
 *      req.protocol / req.get('host') — which Express derives from the
 *      proxy-validated X-Forwarded-* headers. We never read X-Forwarded-*
 *      ourselves.
 *   3. The scheme must be http/https, else default to https.
 *
 * On a direct (untrusted) connection a hostile Host header cannot reach a
 * published link because "trust proxy" governs whether req.host honours it,
 * and in the deployed topology a canonical origin is always configured.
 */
export function dtsBase(req: {
  protocol: string;
  get: (name: string) => string | undefined;
  app?: { get: (name: string) => unknown };
}): string {
  const configured = configuredPublicOrigin();
  if (configured) return `${configured}/dts`;

  const trustProxy = req.app?.get("trust proxy");
  const proxied = trustProxy !== undefined && trustProxy !== false;

  // req.protocol / req.get('host') already respect X-Forwarded-* ONLY when
  // "trust proxy" is set; on a direct connection they reflect the socket and
  // the raw Host header, which we do not want in published links unless a
  // proxy is trusted.
  const rawProto = (req.protocol || "https").toLowerCase();
  const proto = rawProto === "http" || rawProto === "https" ? rawProto : "https";
  const host = proxied ? (req.get("host") ?? "").trim() : "";

  // Validate the host is a plausible authority (no scheme, no path, no
  // whitespace, no comma-joined X-Forwarded-Host list leaking through).
  const hostOk = host !== "" && /^[A-Za-z0-9.\-:[\]]+$/.test(host);
  if (proxied && hostOk) return `${proto}://${host}/dts`;

  // Nothing trustworthy to build an absolute origin from: emit root-relative
  // URIs (still valid per the spec's static-website examples) so no
  // attacker-controlled or bogus host is ever reflected.
  return "/dts";
}

/** URI templates (RFC 6570) advertised by the entry point and resources. */
export function collectionTemplate(base: string): string {
  return `${base}/collection{?id,page,nav}`;
}
export function navigationTemplate(base: string): string {
  return `${base}/navigation{?resource,ref,start,end,down,tree,page}`;
}
export function documentTemplate(base: string): string {
  return `${base}/document{?resource,ref,start,end,tree,mediaType}`;
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

export function entryPoint(base: string): object {
  return {
    "@context": DTS_CONTEXT,
    dtsVersion: DTS_VERSION,
    "@id": `${base}/`,
    "@type": "EntryPoint",
    collection: collectionTemplate(base),
    navigation: navigationTemplate(base),
    document: documentTemplate(base),
  };
}

// ---------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------

/** The single CitationTree shared by the work. */
function citationTrees(): object[] {
  return [
    {
      "@type": "CitationTree",
      citeStructure: [
        {
          "@type": "CiteStructure",
          citeType: "book",
          citeStructure: [
            {
              "@type": "CiteStructure",
              citeType: "section",
            },
          ],
        },
      ],
    },
  ];
}

/** dublinCore metadata block for the work Resource. */
function workDublinCore(): object {
  return {
    title: [
      { lang: "grc", value: WORK_TITLE_GRC },
      { lang: "en", value: WORK_TITLE_EN },
    ],
    creator: [{ lang: "en", value: WORK_CREATOR }],
    language: ["grc"],
    type: ["http://chs.harvard.edu/xmlns/cts#edition"],
    source: [DTS_RESOURCE_ID],
  };
}

/** The work as a DTS Resource object (used both nested and standalone). */
function workResource(base: string): object {
  return {
    "@id": DTS_RESOURCE_ID,
    "@type": "Resource",
    dtsVersion: DTS_VERSION,
    title: WORK_TITLE_EN,
    description:
      "Diogenes Laertius, Lives of Eminent Philosophers — ten books, aligned to the Perseus CTS edition.",
    totalParents: 1,
    totalChildren: 0,
    dublinCore: workDublinCore(),
    collection: collectionTemplate(base),
    navigation: `${base}/navigation?resource=${encodeURIComponent(DTS_RESOURCE_ID)}{&ref,start,end,down,tree,page}`,
    document: `${base}/document?resource=${encodeURIComponent(DTS_RESOURCE_ID)}{&ref,start,end,tree,mediaType}`,
    mediaTypes: [TEI_MEDIA_TYPE, JSONLD_MEDIA_TYPE],
    citationTrees: citationTrees(),
  };
}

/**
 * The root Collection describing the corpus: one Resource member (the
 * work). Requesting ?id=<resource> returns the Resource object itself.
 */
export function collection(base: string, id?: string): object | undefined {
  if (id !== undefined && id !== "" && id !== "root" && id !== "general") {
    if (id === DTS_RESOURCE_ID) return workResource(base);
    return undefined;
  }
  const memberResource = workResource(base);
  return {
    "@context": DTS_CONTEXT,
    dtsVersion: DTS_VERSION,
    "@id": "root",
    "@type": "Collection",
    title: WORK_TITLE_EN,
    description:
      "Digital text collection of Diogenes Laertius' Lives of Eminent Philosophers.",
    totalParents: 0,
    totalChildren: 1,
    dublinCore: {
      title: [
        { lang: "grc", value: WORK_TITLE_GRC },
        { lang: "en", value: WORK_TITLE_EN },
      ],
      creator: [{ lang: "en", value: WORK_CREATOR }],
      language: ["grc"],
    },
    collection: collectionTemplate(base),
    member: [memberResource],
  };
}

// ---------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------

/** The nested Resource object the Navigation response carries. */
function navigationResource(base: string): object {
  return {
    "@id": DTS_RESOURCE_ID,
    "@type": "Resource",
    collection: collectionTemplate(base),
    navigation: `${base}/navigation?resource=${encodeURIComponent(DTS_RESOURCE_ID)}{&ref,down,start,end,tree,page}`,
    document: `${base}/document?resource=${encodeURIComponent(DTS_RESOURCE_ID)}{&ref,start,end,tree,mediaType}`,
    citationTrees: citationTrees(),
  };
}

function bookCitableUnit(node: BookNode): object {
  return {
    identifier: String(node.book),
    "@type": "CitableUnit",
    level: 1,
    parent: null,
    citeType: "book",
    dublinCore: {
      title: [{ lang: "en", value: `Book ${node.book}` }],
    },
  };
}

function sectionCitableUnit(unit: SectionUnit): object {
  const s = unit.section;
  return {
    identifier: unit.identifier,
    "@type": "CitableUnit",
    level: 2,
    parent: String(s.book),
    citeType: "section",
    dublinCore: {
      title: [{ lang: "en", value: `${s.philosopher} ${s.book}.${s.section}` }],
    },
  };
}

export interface NavigationParams {
  ref?: string;
  down?: string;
}

export type NavigationResult =
  | { ok: true; body: object }
  | { ok: false; status: 400 | 404; error: string };

/**
 * Build a Navigation response. Supports the `ref` + `down` subset of the
 * spec's parameter matrix (Level-0 server: no start/end ranges here).
 *
 * The response `@id` is rebuilt exclusively from the VALIDATED resource,
 * ref and down values — never from the raw request URL — so no
 * request-derived text can be reflected into the body.
 */
export function navigation(
  base: string,
  params: NavigationParams,
): NavigationResult {
  const { ref, down } = params;
  const hasDown = down !== undefined && down !== "";
  const downNum = hasDown ? Number(down) : undefined;
  if (hasDown && !Number.isInteger(downNum)) {
    return { ok: false, status: 400, error: "Invalid down value" };
  }

  // absent ref + absent down → 400 (per the spec parameter matrix).
  if (ref === undefined && !hasDown) {
    return {
      ok: false,
      status: 400,
      error:
        "A Navigation request must provide either a ref or a down parameter.",
    };
  }

  // Resolve the ref (book-level or section-level) if provided.
  let refBook: BookNode | undefined;
  let refSection: CorpusSection | undefined;
  let refUnit: object | undefined;
  // The canonical (validated) ref identifier used to rebuild @id.
  let canonicalRef: string | undefined;
  if (ref !== undefined) {
    refBook = bookByRef(ref);
    if (refBook) {
      refUnit = bookCitableUnit(refBook);
      canonicalRef = String(refBook.book);
    } else {
      refSection = resolveSectionRef(ref);
      if (!refSection) {
        return { ok: false, status: 404, error: "Unknown reference" };
      }
      // Use the SectionUnit so the emitted identifier matches the tree.
      const unit = unitForSection(refSection);
      refUnit = sectionCitableUnit(unit);
      canonicalRef = unit.identifier;
    }
  }

  // Rebuild the self identifier from validated values only.
  const query: string[] = [
    `resource=${encodeURIComponent(DTS_RESOURCE_ID)}`,
  ];
  if (canonicalRef !== undefined) {
    query.push(`ref=${encodeURIComponent(canonicalRef)}`);
  }
  if (hasDown) query.push(`down=${downNum}`);
  const base400 = {
    "@context": DTS_CONTEXT,
    dtsVersion: DTS_VERSION,
    "@type": "Navigation",
    "@id": `${base}/navigation?${query.join("&")}`,
    resource: navigationResource(base),
  };

  const member: object[] = [];

  if (!hasDown) {
    // ref present, down absent → info about the CitableUnit only, no member.
    return {
      ok: true,
      body: { ...base400, ref: refUnit },
    };
  }

  // down present. Compute the subtree.
  const bottom = downNum === -1 ? Number.MAX_SAFE_INTEGER : (downNum as number);

  if (ref === undefined) {
    // From the root: level 1 (books) always; level 2 (sections) if depth ≥ 2.
    for (const node of bookNodes()) {
      member.push(bookCitableUnit(node));
      if (bottom >= 2) {
        for (const unit of node.sections) member.push(sectionCitableUnit(unit));
      }
    }
    return { ok: true, body: { ...base400, member } };
  }

  if (refBook) {
    // From a book: the book plus its sections (relative depth 1 = sections).
    if (downNum === 0) {
      // down=0 with a book ref → siblings (all books) including this one.
      for (const node of bookNodes()) member.push(bookCitableUnit(node));
    } else {
      for (const unit of refBook.sections) member.push(sectionCitableUnit(unit));
    }
    return { ok: true, body: { ...base400, ref: refUnit, member } };
  }

  // From a section (leaf): down=0 → siblings within the same book;
  // down>0 → nothing deeper, so just the unit itself.
  if (refSection) {
    if (downNum === 0) {
      const node = bookNodes().find((n) => n.book === refSection!.book);
      if (node) for (const unit of node.sections) member.push(sectionCitableUnit(unit));
    } else if (refUnit) {
      member.push(refUnit);
    }
    return { ok: true, body: { ...base400, ref: refUnit, member } };
  }

  return { ok: true, body: { ...base400, ref: refUnit, member } };
}

// ---------------------------------------------------------------------
// Document (TEI/XML)
// ---------------------------------------------------------------------

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Ordered list of sections a book-level ref expands to. */
function sectionsForBook(book: number): CorpusSection[] {
  const node = bookNodes().find((n) => n.book === book);
  return node ? node.sections.map((u) => u.section) : [];
}

/** Ordered list of sections in an inclusive [start,end] range. */
function sectionsInRange(
  start: CorpusSection,
  end: CorpusSection,
): CorpusSection[] | undefined {
  const startIdx = corpus.findIndex((s) => s.id === start.id);
  const endIdx = corpus.findIndex((s) => s.id === end.id);
  if (startIdx === -1 || endIdx === -1) return undefined;
  const [a, b] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
  return corpus.slice(a, b + 1);
}

/**
 * A valid XML NCName for the section's xml:id. An NCName MUST NOT start with
 * a digit, so the corpus id (e.g. "1.1.22") cannot be used verbatim. We
 * prefix with "section-" and replace the dot separators with hyphens
 * (both '-' and '.' are legal NCName characters after the first, but hyphens
 * are used to keep the identifier unambiguous). Any residual illegal
 * character is dropped. The human-facing refs stay on n= and corresp=.
 */
function sectionXmlId(s: CorpusSection): string {
  const body = s.id.replace(/\./g, "-").replace(/[^A-Za-z0-9._-]/g, "");
  return `section-${body}`;
}

/** One TEI <div type="textpart"> block for a corpus section. */
function sectionTeiDiv(s: CorpusSection): string {
  const ref = `${s.book}.${s.section}`;
  // NFC-normalise the Greek so combining marks are canonical in the output.
  const text = s.text.normalize("NFC");
  return [
    `      <div type="textpart" subtype="section" n="${xmlEscape(ref)}" xml:id="${xmlEscape(sectionXmlId(s))}" corresp="${xmlEscape(s.urn)}">`,
    `        <p>${xmlEscape(text)}</p>`,
    `      </div>`,
  ].join("\n");
}

export interface DocumentParams {
  ref?: string;
  start?: string;
  end?: string;
}

export type DocumentResult =
  | { ok: true; tei: string }
  | { ok: false; status: 400 | 404; error: string };

/**
 * Build a TEI/XML document response for a ref (single passage or a whole
 * book) or a start/end range. The requested passages are wrapped in a
 * <dts:wrapper> as the spec requires for partial documents.
 */
export function documentTei(params: DocumentParams): DocumentResult {
  const { ref, start, end } = params;

  if (ref !== undefined && (start !== undefined || end !== undefined)) {
    return {
      ok: false,
      status: 400,
      error: "ref cannot be combined with start/end.",
    };
  }
  if ((start === undefined) !== (end === undefined)) {
    return {
      ok: false,
      status: 400,
      error: "start and end must be provided together.",
    };
  }

  let sections: CorpusSection[];
  let wrapperAttrs: string;

  // The <dts:wrapper> attributes are rebuilt from CANONICAL, validated
  // identifiers (never the raw request text) so no request-derived string is
  // reflected into the response body.
  if (ref !== undefined) {
    const asBook = bookByRef(ref);
    if (asBook) {
      sections = sectionsForBook(asBook.book);
      wrapperAttrs = ` ref="${xmlEscape(String(asBook.book))}"`;
    } else {
      const s = resolveSectionRef(ref);
      if (!s) return { ok: false, status: 404, error: "Unknown reference" };
      sections = [s];
      wrapperAttrs = ` ref="${xmlEscape(unitForSection(s).identifier)}"`;
    }
  } else if (start !== undefined && end !== undefined) {
    const startSection = resolveSectionRef(start);
    const endSection = resolveSectionRef(end);
    if (!startSection) return { ok: false, status: 404, error: "Unknown start reference" };
    if (!endSection) return { ok: false, status: 404, error: "Unknown end reference" };
    const range = sectionsInRange(startSection, endSection);
    if (!range) return { ok: false, status: 404, error: "Range could not be resolved." };
    sections = range;
    const startId = xmlEscape(unitForSection(startSection).identifier);
    const endId = xmlEscape(unitForSection(endSection).identifier);
    wrapperAttrs = ` start="${startId}" end="${endId}"`;
  } else {
    // No ref/start/end → the entire work.
    sections = corpus;
    wrapperAttrs = "";
  }

  const divs = sections.map(sectionTeiDiv).join("\n");
  const tei = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<TEI xmlns="http://www.tei-c.org/ns/1.0">`,
    `  <teiHeader>`,
    `    <fileDesc>`,
    `      <titleStmt>`,
    `        <title xml:lang="grc">${xmlEscape(WORK_TITLE_GRC)}</title>`,
    `        <title xml:lang="en">${xmlEscape(WORK_TITLE_EN)}</title>`,
    `        <author>${xmlEscape(WORK_CREATOR)}</author>`,
    `      </titleStmt>`,
    `      <publicationStmt>`,
    `        <p>Aligned to the Perseus CTS edition ${xmlEscape(DTS_RESOURCE_ID)}.</p>`,
    `      </publicationStmt>`,
    `      <sourceDesc>`,
    `        <p>${xmlEscape(DTS_RESOURCE_ID)}</p>`,
    `      </sourceDesc>`,
    `    </fileDesc>`,
    `  </teiHeader>`,
    `  <text xml:lang="grc">`,
    `    <body>`,
    `      <dts:wrapper xmlns:dts="https://w3id.org/api/dts#"${wrapperAttrs}>`,
    divs,
    `      </dts:wrapper>`,
    `    </body>`,
    `  </text>`,
    `</TEI>`,
  ].join("\n");

  return { ok: true, tei };
}

/**
 * A JSON-LD serialization of a single passage (offered when the Document
 * endpoint is queried with mediaType=application/ld+json). TEI is the
 * required default; this is a convenience alternative.
 */
export function documentJsonLd(ref: string): object | undefined {
  const s = resolveSectionRef(ref);
  if (!s) return undefined;
  return {
    "@context": DTS_CONTEXT,
    dtsVersion: DTS_VERSION,
    "@id": s.urn,
    "@type": "dts:Document",
    resource: DTS_RESOURCE_ID,
    // Canonical (data-derived) identifier, not the raw request ref.
    ref: unitForSection(s).identifier,
    passage: s.text.normalize("NFC"),
  };
}
