/**
 * Validates the discoverability layer of the edition (task: sitemap,
 * canonical URLs, Dublin Core, Schema.org, DCAT):
 *
 * 1. Route coverage — every wouter route declared in the web app's App.tsx
 *    (plus "/", rendered outside the Switch) is accounted for by exactly
 *    one of the sitemap module's three lists (static, expanded from data,
 *    or deliberately excluded), and vice versa: no phantom routes.
 * 2. sitemap.xml — generates the real sitemap from the api-server module,
 *    checks it is well-formed XML, that every static route URL appears,
 *    that each expanded pattern contributed at least one URL (positive
 *    controls — an empty expansion would be vacuously green otherwise),
 *    and that every <loc> stays under the live base URL.
 * 3. index.html head — canonical link, the required Dublin Core meta
 *    tags, and a Schema.org JSON-LD block that parses and contains both a
 *    CreativeWork and a Dataset with Turtle/JSON-LD/zip distributions.
 * 4. Canonical wiring — the useCanonical hook exists and is mounted in
 *    App.tsx, so the canonical URL tracks the route at runtime.
 * 5. DCAT — dcatAsTurtle() parses as Turtle (n3), declares the catalog,
 *    the four datasets, and distributions covering Turtle, JSON-LD,
 *    RDF/XML and the source zip.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-discovery-metadata
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { Parser as N3Parser, type Quad } from "n3";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const webDir = path.resolve(import.meta.dirname, "../../artifacts/laertius");
const appTsx = readFileSync(path.join(webDir, "src/App.tsx"), "utf8");
const indexHtml = readFileSync(path.join(webDir, "index.html"), "utf8");

const errors: string[] = [];
function fail(msg: string) {
  errors.push(msg);
}

const {
  STATIC_READER_ROUTES,
  EXPANDED_ROUTE_PATTERNS,
  EXCLUDED_ROUTE_PATTERNS,
  sitemapXml,
  SITE_BASE,
} = await import("../../artifacts/api-server/src/lib/sitemap");
const { LOD_BASE, dcatAsTurtle } = await import(
  "../../artifacts/api-server/src/lib/lod"
);

// ---------------------------------------------------------------- 1. routes
const routeMatches = [...appTsx.matchAll(/<Route path="([^"]+)"/g)].map(
  (m) => m[1] as string,
);
// "/" renders outside the Switch (home short-circuit), so add it manually.
const appRoutes = new Set<string>(["/", ...routeMatches]);
if (routeMatches.length < 10) {
  fail(
    `positive control failed: only ${routeMatches.length} <Route path> matches found in App.tsx — extraction regex is broken`,
  );
}

const accounted = new Map<string, string>();
for (const [list, name] of [
  [STATIC_READER_ROUTES, "STATIC_READER_ROUTES"],
  [EXPANDED_ROUTE_PATTERNS, "EXPANDED_ROUTE_PATTERNS"],
  [EXCLUDED_ROUTE_PATTERNS, "EXCLUDED_ROUTE_PATTERNS"],
] as const) {
  for (const r of list) {
    if (accounted.has(r)) {
      fail(`route ${r} appears in both ${accounted.get(r)} and ${name}`);
    }
    accounted.set(r, name);
  }
}
for (const r of appRoutes) {
  if (!accounted.has(r)) {
    fail(
      `App.tsx route ${r} is not covered by the sitemap module (add it to STATIC_READER_ROUTES, EXPANDED_ROUTE_PATTERNS or EXCLUDED_ROUTE_PATTERNS in artifacts/api-server/src/lib/sitemap.ts)`,
    );
  }
}
for (const r of accounted.keys()) {
  if (!appRoutes.has(r)) {
    fail(`sitemap module lists route ${r}, but App.tsx no longer declares it`);
  }
}

// --------------------------------------------------------------- 2. sitemap
const xml = sitemapXml();
if (!xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
  fail("sitemap.xml is missing the XML declaration");
}
// Well-formedness: every <url><loc>...</loc></url> line, balanced urlset.
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (m) => m[1] as string,
);
const urlOpens = (xml.match(/<url>/g) ?? []).length;
const urlCloses = (xml.match(/<\/url>/g) ?? []).length;
if (
  urlOpens !== urlCloses ||
  urlOpens !== locs.length ||
  !xml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">') ||
  !xml.trimEnd().endsWith("</urlset>")
) {
  fail("sitemap.xml is not well-formed (unbalanced url/urlset/loc elements)");
}
const locSet = new Set(locs);
if (locSet.size !== locs.length) {
  fail("sitemap.xml contains duplicate <loc> entries");
}
for (const loc of locs) {
  if (!loc.startsWith(`${SITE_BASE}/`)) {
    fail(`sitemap <loc> escapes the live base URL: ${loc}`);
  }
}
for (const r of STATIC_READER_ROUTES) {
  const expected = r === "/" ? `${SITE_BASE}/` : `${SITE_BASE}${r}`;
  if (!locSet.has(expected)) {
    fail(`sitemap.xml is missing static route URL ${expected}`);
  }
}
// Positive controls for the expanded patterns.
for (const pattern of EXPANDED_ROUTE_PATTERNS) {
  const prefix = `${SITE_BASE}${pattern.replace(/:.*$/, "")}`;
  const count = locs.filter(
    (l) => l.startsWith(prefix) && l.length > prefix.length,
  ).length;
  if (count === 0) {
    fail(`sitemap.xml expanded zero URLs for pattern ${pattern}`);
  } else {
    console.log(`  pattern ${pattern}: ${count} URLs`);
  }
}
console.log(`sitemap.xml: ${locs.length} URLs total`);

// lastmod: every <url> must carry a <lastmod> that parses as an ISO date.
const lastmods = [...xml.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)].map(
  (m) => m[1] as string,
);
if (lastmods.length !== locs.length) {
  fail(
    `sitemap.xml has ${locs.length} <loc> but only ${lastmods.length} <lastmod> — every URL must carry a lastmod date`,
  );
}
const badDates = new Set<string>();
for (const d of lastmods) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) {
    badDates.add(d);
  }
}
if (badDates.size > 0) {
  fail(
    `sitemap.xml <lastmod> values do not parse as ISO dates: ${[...badDates].slice(0, 5).join(", ")}`,
  );
} else if (lastmods.length > 0) {
  console.log(
    `sitemap.xml lastmod: ${new Set(lastmods).size} distinct ISO dates across ${lastmods.length} URLs`,
  );
}

// The lastmod manifest must match the current data content hashes; a stale
// manifest means the sitemap silently reports today's date instead of a
// committed, stable one.
const {
  currentGroupHashes,
  readLastmodManifest,
  currentSectionHashes,
  readSectionLastmodManifest,
} = await import("../../artifacts/api-server/src/lib/sitemap-lastmod");
const manifest = readLastmodManifest();
for (const [group, hash] of Object.entries(currentGroupHashes())) {
  const entry = manifest[group];
  if (!entry) {
    fail(
      `sitemap-lastmod.json has no entry for group "${group}" — run: pnpm --filter @workspace/scripts run update-sitemap-lastmod`,
    );
  } else if (entry.hash !== hash) {
    fail(
      `sitemap-lastmod.json is stale for group "${group}" (content hash changed) — run: pnpm --filter @workspace/scripts run update-sitemap-lastmod and commit the result`,
    );
  }
}

// Per-section manifest: every corpus section must have a committed
// hash+date entry that matches the current content, and no orphan entries
// for sections that no longer exist.
const sectionManifest = readSectionLastmodManifest();
const sectionHashes = currentSectionHashes();
const sectionIds = Object.keys(sectionHashes);
if (sectionIds.length === 0) {
  fail(
    "positive control failed: currentSectionHashes() returned zero sections — the per-section lastmod check is vacuous",
  );
}
let missingSections = 0;
let staleSections = 0;
for (const [id, hash] of Object.entries(sectionHashes)) {
  const entry = sectionManifest[id];
  if (!entry) missingSections++;
  else if (entry.hash !== hash) staleSections++;
}
let orphanSections = 0;
for (const id of Object.keys(sectionManifest)) {
  if (!(id in sectionHashes)) orphanSections++;
}
if (missingSections + staleSections + orphanSections > 0) {
  fail(
    `sitemap-lastmod-sections.json is stale (${missingSections} missing, ${staleSections} hash-changed, ${orphanSections} orphaned section entries) — run: pnpm --filter @workspace/scripts run update-sitemap-lastmod and commit the result`,
  );
} else {
  console.log(
    `sitemap-lastmod-sections.json: ${sectionIds.length} sections, all hashes current`,
  );
}

// ------------------------------------------------------------ 3. HTML head
if (
  !/<link rel="canonical" href="https:\/\/laertius\.humanisticadigitalia\.eu\/" \/>/.test(
    indexHtml,
  )
) {
  fail("index.html is missing the canonical link to the live edition");
}
for (const name of [
  "DC.title",
  "DC.creator",
  "DC.publisher",
  "DC.description",
  "DC.language",
  "DC.source",
  "DC.identifier",
  "DC.rights",
  "DCTERMS.license",
]) {
  if (!indexHtml.includes(`<meta name="${name}"`)) {
    fail(`index.html is missing the Dublin Core meta tag ${name}`);
  }
}
const ldMatch = indexHtml.match(
  /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
);
if (!ldMatch) {
  fail("index.html is missing the Schema.org JSON-LD script");
} else {
  try {
    const ld = JSON.parse(ldMatch[1] as string) as {
      "@context"?: string;
      "@graph"?: { "@type"?: string; distribution?: { encodingFormat?: string; contentUrl?: string }[] }[];
    };
    if (ld["@context"] !== "https://schema.org") {
      fail("JSON-LD @context is not https://schema.org");
    }
    const graph = ld["@graph"] ?? [];
    const types = graph.map((n) => n["@type"]);
    if (!types.includes("CreativeWork")) {
      fail("JSON-LD is missing a schema:CreativeWork node");
    }
    const dataset = graph.find((n) => n["@type"] === "Dataset");
    if (!dataset) {
      fail("JSON-LD is missing a schema:Dataset node");
    } else {
      const formats = (dataset.distribution ?? []).map(
        (d) => d.encodingFormat,
      );
      for (const f of ["text/turtle", "application/ld+json", "application/zip"]) {
        if (!formats.includes(f)) {
          fail(`JSON-LD Dataset is missing a ${f} distribution`);
        }
      }
    }
  } catch (e) {
    fail(`JSON-LD in index.html does not parse: ${String(e)}`);
  }
}

// The static robots.txt shipped in the frontend build must carry the same
// Sitemap directive the dynamic Node handler serves: on a static/CDN host
// the public file wins, and without the directive crawlers never find the
// sitemap there.
const robots = readFileSync(path.join(webDir, "public/robots.txt"), "utf8");
if (!robots.includes(`Sitemap: ${SITE_BASE}/sitemap.xml`)) {
  fail(
    `public/robots.txt is missing "Sitemap: ${SITE_BASE}/sitemap.xml" — static hosting would serve a robots.txt that never points crawlers at the sitemap`,
  );
}

// --------------------------------------------------- 4. canonical wiring
const hookSrc = readFileSync(
  path.join(webDir, "src/lib/use-canonical.ts"),
  "utf8",
);
if (!hookSrc.includes('link[rel="canonical"]')) {
  fail("use-canonical.ts no longer updates the canonical link element");
}
if (!appTsx.includes("useCanonical()")) {
  fail("App.tsx no longer mounts the useCanonical hook");
}

// ------------------------------------------------------------------ 5. DCAT
const DCAT = "http://www.w3.org/ns/dcat#";
const dcatTtl = dcatAsTurtle();
let quads: Quad[] = [];
try {
  quads = new N3Parser().parse(dcatTtl);
} catch (e) {
  fail(`dcat.ttl does not parse as Turtle: ${String(e)}`);
}
if (quads.length > 0) {
  const ofType = (t: string) =>
    quads.filter(
      (q) =>
        q.predicate.value ===
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#type" &&
        q.object.value === `${DCAT}${t}`,
    );
  const catalogs = ofType("Catalog");
  const datasets = ofType("Dataset");
  const dists = ofType("Distribution");
  if (catalogs.length !== 1) {
    fail(`dcat.ttl declares ${catalogs.length} dcat:Catalog (expected 1)`);
  }
  if (datasets.length < 5) {
    fail(
      `dcat.ttl declares only ${datasets.length} dcat:Dataset (expected the plain graph, annotated graph, ontology, SHACL shapes and source archive)`,
    );
  }
  const downloadUrls = quads
    .filter((q) => q.predicate.value === `${DCAT}downloadURL`)
    .map((q) => q.object.value);
  for (const suffix of [
    "/api/lod/graph.ttl",
    "/api/lod/graph.jsonld",
    "/api/lod/graph.rdf",
    "/api/lod/shapes.ttl",
    "/api/exports/laertius-full-source.zip",
  ]) {
    if (!downloadUrls.some((u) => u === `${LOD_BASE}${suffix}`)) {
      fail(`dcat.ttl has no distribution with downloadURL ${LOD_BASE}${suffix}`);
    }
  }
  // Shapes advertisement: both the plain graph dataset and the annotated
  // graph dataset (whose dump provably passes the shapes — validate-shapes
  // runs pySHACL over annotatedGraphAsTurtle()) must carry
  // dcterms:conformsTo pointing at the shapes URL, pinned per subject.
  const conformsTo = quads.filter(
    (q) => q.predicate.value === "http://purl.org/dc/terms/conformsTo",
  );
  for (const subject of [
    `${LOD_BASE}/dcat#graph`,
    `${LOD_BASE}/dcat#graph-annotated`,
  ]) {
    if (
      !conformsTo.some(
        (q) =>
          q.subject.value === subject &&
          q.object.value === `${LOD_BASE}/api/lod/shapes.ttl`,
      )
    ) {
      fail(
        `dcat.ttl: <${subject}> carries no dcterms:conformsTo <${LOD_BASE}/api/lod/shapes.ttl>`,
      );
    }
  }
  if (dists.length !== downloadUrls.length) {
    fail(
      `dcat.ttl: ${dists.length} dcat:Distribution nodes but ${downloadUrls.length} dcat:downloadURL triples — a distribution is missing its download link`,
    );
  }
  console.log(
    `dcat.ttl: ${quads.length} triples, ${datasets.length} datasets, ${dists.length} distributions`,
  );
}

if (errors.length > 0) {
  console.error("\nvalidate-discovery-metadata FAILED:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("validate-discovery-metadata passed.");

export {};
