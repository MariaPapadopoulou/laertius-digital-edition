/**
 * sitemap.xml for the reader-facing edition, generated from the same data
 * modules the pages themselves read: every static wouter route of the web
 * app, every text section (/section/:id) and every ontoterminology object
 * page (/terminology/objects/:id). All URLs are minted under LOD_BASE so
 * the sitemap points at the live deployment subpath, mirroring how the
 * LOD exports mint their own links.
 *
 * validate-discovery-metadata compares STATIC_READER_ROUTES against the
 * routes actually declared in the web app's App.tsx, so a new page that
 * is not added here fails validation instead of silently missing from
 * the sitemap.
 */
import { LOD_BASE } from "./lod";
import { corpus } from "./corpus";
import { getOtbModel } from "./otb/build";
import { lastmodFor } from "./sitemap-lastmod";

/**
 * Reader-facing static routes of the web app (wouter paths in
 * artifacts/laertius/src/App.tsx). Parameterised routes are expanded from
 * data below; routes that only make sense with client-side state
 * (/legomena/entity needs a ?uri= query) are excluded.
 */
export const STATIC_READER_ROUTES: string[] = [
  "/",
  "/ask",
  "/search",
  "/browse",
  "/verses",
  "/sayings",
  "/doxography",
  "/anecdotes",
  "/letters",
  "/testaments",
  "/graph",
  "/competency",
  "/map",
  "/timeline",
  "/entities",
  "/stats",
  "/about",
  "/approach",
  "/accessibility",
  "/privacy",
  "/terminology",
  "/terminology/concepts",
  "/terminology/objects",
  "/terminology/names",
  "/legomena",
  "/legomena/graph",
  "/legomena/entities",
  "/legomena/reader",
  "/legomena/sparql",
];

/**
 * Parameterised route patterns the sitemap expands from data, and the
 * patterns it deliberately leaves out. The validator checks every route
 * in App.tsx is accounted for by exactly one of the three lists.
 */
export const EXPANDED_ROUTE_PATTERNS: string[] = [
  "/section/:id",
  "/terminology/objects/:id",
  "/legomena/reader/:sectionId",
];
export const EXCLUDED_ROUTE_PATTERNS: string[] = [
  // Needs a ?uri= query parameter to render anything.
  "/legomena/entity",
  // Redirect-only: the old "About the Model" page is now the Overview at
  // /terminology itself.
  "/terminology/model",
];

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Every reader-facing path (static + expanded), site-relative. */
export function sitemapPaths(): string[] {
  const paths: string[] = [...STATIC_READER_ROUTES];
  for (const s of corpus) {
    paths.push(`/section/${s.id}`);
    paths.push(`/legomena/reader/${s.id}`);
  }
  for (const o of getOtbModel().objects) {
    paths.push(`/terminology/objects/${o.id}`);
  }
  return paths;
}

let cache: string | null = null;

/**
 * Public base URL of the live site (where pages are actually served).
 * Env-overridable independently of LOD_BASE, but by default it matches the
 * canonical published address (per the editor's decision, all public
 * metadata stays on this address regardless of where a copy is served).
 */
export const SITE_BASE =
  process.env["SITE_BASE"] ?? "https://laertius.humanisticadigitalia.eu";

export function sitemapXml(): string {
  if (cache) return cache;
  const urls = sitemapPaths()
    .map((p) => {
      // "/" maps to SITE_BASE itself with a trailing slash.
      const loc = p === "/" ? `${SITE_BASE}/` : `${SITE_BASE}${p}`;
      return `  <url><loc>${xmlEscape(loc)}</loc><lastmod>${lastmodFor(p)}</lastmod></url>`;
    })
    .join("\n");
  cache = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return cache;
}
