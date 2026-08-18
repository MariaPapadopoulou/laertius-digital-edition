/**
 * Validates that the Map API contract (lib/api-spec/openapi.yaml) and the
 * shapes map.ts actually serves stay in lockstep.
 *
 * Why: the route's Zod response validation strips unknown keys, so a field
 * added only to map.ts (but not to the OpenAPI schema) silently never
 * reaches the served payload, and the bundle smoke test's itinerary guard
 * cannot see it until the schema catches up. Conversely, a field declared
 * in the spec but never populated ships silently as an always-missing
 * property. This validator fails on drift in either direction, at source
 * level and against a live sample:
 *
 * 1. Spec vs interfaces: for each Map schema (MapPlace, MapPlaceEvent,
 *    MapPlaceMention, MapDeathAccount, MapItineraryStop, MapItinerary),
 *    the OpenAPI property list must exactly match the field list of the
 *    same-named interface in artifacts/api-server/src/lib/map.ts, and the
 *    spec's `required` list must exactly match the interface's
 *    non-optional fields.
 * 2. Spec vs live sample: every key present on the objects that
 *    getMapPlaces() and getItineraries() actually build (the exact
 *    builders /api/map and /api/map/itineraries serve) must be declared
 *    in the spec, and every spec property must be populated on at least
 *    one served object, so a declared-but-never-populated field (or a
 *    populated-but-stripped field) fails here, not in production.
 *
 * A deliberate shape change requires editing openapi.yaml and map.ts
 * together (and re-running the api-spec codegen).
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-map-contract
 */
import path from "node:path";
import { readFileSync } from "node:fs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SPEC_PATH = path.join(ROOT, "lib/api-spec/openapi.yaml");
const MAP_TS_PATH = path.join(ROOT, "artifacts/api-server/src/lib/map.ts");

process.env["LAERTIUS_DATA_DIR"] ??= path.join(
  ROOT,
  "artifacts/api-server/data",
);

const SCHEMAS = [
  "MapPlace",
  "MapPlaceEvent",
  "MapPlaceMention",
  "MapDeathAccount",
  "MapItineraryStop",
  "MapItinerary",
] as const;
type SchemaName = (typeof SCHEMAS)[number];

const errors: string[] = [];

/* ------------------------------------------------------------------ */
/* 1. Parse the OpenAPI schemas (indentation-based, no yaml dep).      */
/* ------------------------------------------------------------------ */

interface SpecShape {
  properties: string[];
  required: string[];
}

function parseSpecSchemas(specText: string): Map<SchemaName, SpecShape> {
  const lines = specText.split("\n");
  const out = new Map<SchemaName, SpecShape>();
  for (const name of SCHEMAS) {
    const startIdx = lines.findIndex((l) => l === `    ${name}:`);
    if (startIdx < 0) {
      errors.push(`spec: schema ${name} not found in openapi.yaml`);
      continue;
    }
    // The schema body is everything indented deeper than 4 spaces until
    // the next 4-space-indented key.
    const body: string[] = [];
    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.trim() === "") continue;
      if (/^ {4}\S/.test(line)) break;
      body.push(line);
    }
    // required: [a, b, c]
    const required: string[] = [];
    const reqLine = body.find((l) => /^ {6}required:/.test(l));
    if (reqLine) {
      const m = reqLine.match(/\[([^\]]*)\]/);
      if (m) {
        for (const f of m[1]!.split(",")) {
          const t = f.trim();
          if (t) required.push(t);
        }
      } else {
        errors.push(
          `spec: ${name} has a required list not in [a, b] form; update the parser or the spec`,
        );
      }
    }
    // properties: keys are the 8-space-indented "name:" lines that follow
    // the "      properties:" line.
    const properties: string[] = [];
    const propIdx = body.findIndex((l) => /^ {6}properties:/.test(l));
    if (propIdx < 0) {
      errors.push(`spec: ${name} has no properties block`);
    } else {
      for (let i = propIdx + 1; i < body.length; i++) {
        const line = body[i]!;
        if (/^ {6}\S/.test(line)) break; // next 6-space key ends properties
        const m = line.match(/^ {8}([A-Za-z_][A-Za-z0-9_]*):/);
        if (m) properties.push(m[1]!);
      }
    }
    if (properties.length === 0) {
      errors.push(`spec: parsed zero properties for ${name} (parser drift?)`);
    }
    out.set(name, { properties, required });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 2. Parse the map.ts interfaces.                                     */
/* ------------------------------------------------------------------ */

interface TsShape {
  fields: string[];
  requiredFields: string[];
}

function parseTsInterfaces(tsText: string): Map<SchemaName, TsShape> {
  const out = new Map<SchemaName, TsShape>();
  for (const name of SCHEMAS) {
    const re = new RegExp(
      `export interface ${name} \\{([\\s\\S]*?)\\n\\}`,
      "m",
    );
    const m = tsText.match(re);
    if (!m) {
      errors.push(`map.ts: interface ${name} not found`);
      continue;
    }
    const fields: string[] = [];
    const requiredFields: string[] = [];
    for (const line of m[1]!.split("\n")) {
      const fm = line.match(/^ {2}([A-Za-z_][A-Za-z0-9_]*)(\?)?:/);
      if (!fm) continue;
      fields.push(fm[1]!);
      if (!fm[2]) requiredFields.push(fm[1]!);
    }
    if (fields.length === 0) {
      errors.push(`map.ts: parsed zero fields for ${name} (parser drift?)`);
    }
    out.set(name, { fields, requiredFields });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Comparison helpers.                                                 */
/* ------------------------------------------------------------------ */

function diff(a: string[], b: string[]): string[] {
  const bs = new Set(b);
  return a.filter((x) => !bs.has(x));
}

const specShapes = parseSpecSchemas(readFileSync(SPEC_PATH, "utf8"));
const tsShapes = parseTsInterfaces(readFileSync(MAP_TS_PATH, "utf8"));

for (const name of SCHEMAS) {
  const spec = specShapes.get(name);
  const ts = tsShapes.get(name);
  if (!spec || !ts) continue;
  for (const f of diff(spec.properties, ts.fields)) {
    errors.push(
      `${name}: property "${f}" is declared in openapi.yaml but missing from the map.ts interface (declared-but-never-populated risk)`,
    );
  }
  for (const f of diff(ts.fields, spec.properties)) {
    errors.push(
      `${name}: field "${f}" exists in the map.ts interface but not in openapi.yaml - the route's Zod validation will silently strip it from the served payload`,
    );
  }
  for (const f of diff(spec.required, ts.requiredFields)) {
    errors.push(
      `${name}: "${f}" is required in openapi.yaml but optional (or absent) in map.ts`,
    );
  }
  for (const f of diff(ts.requiredFields, spec.required)) {
    errors.push(
      `${name}: "${f}" is non-optional in map.ts but not listed as required in openapi.yaml`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* 3. Live sample: keys actually serialized by the builders.           */
/* ------------------------------------------------------------------ */

const { getMapPlaces, getItineraries } = await import(
  "../../artifacts/api-server/src/lib/map"
);

function collectKeys(objs: Record<string, unknown>[]): Set<string> {
  const keys = new Set<string>();
  for (const o of objs) {
    for (const [k, v] of Object.entries(o)) {
      if (v !== undefined) keys.add(k);
    }
  }
  return keys;
}

function checkLive(name: SchemaName, objs: Record<string, unknown>[]): void {
  const spec = specShapes.get(name);
  if (!spec) return;
  if (objs.length === 0) {
    errors.push(`live: no ${name} objects served, cannot verify coverage`);
    return;
  }
  const served = collectKeys(objs);
  for (const k of served) {
    if (!spec.properties.includes(k)) {
      errors.push(
        `live ${name}: served key "${k}" is not declared in openapi.yaml - Zod will strip it from the response`,
      );
    }
  }
  for (const p of spec.properties) {
    if (!served.has(p)) {
      errors.push(
        `live ${name}: spec property "${p}" is never populated on any served object (declared but dead)`,
      );
    }
  }
}

const places = getMapPlaces() as unknown as Record<string, unknown>[];
const itineraries = getItineraries() as unknown as Record<string, unknown>[];

const events = places.flatMap(
  (p) => p["events"] as Record<string, unknown>[],
);
const mentions = places.flatMap(
  (p) => p["mentions"] as Record<string, unknown>[],
);
const deathAccounts = events.flatMap(
  (e) => (e["deathAccounts"] as Record<string, unknown>[] | undefined) ?? [],
);
const stops = itineraries.flatMap(
  (i) => i["stops"] as Record<string, unknown>[],
);

checkLive("MapPlace", places);
checkLive("MapPlaceEvent", events);
checkLive("MapPlaceMention", mentions);
checkLive("MapDeathAccount", deathAccounts);
checkLive("MapItineraryStop", stops);
checkLive("MapItinerary", itineraries);

/* ------------------------------------------------------------------ */
/* Report.                                                             */
/* ------------------------------------------------------------------ */

if (errors.length > 0) {
  console.error(`validate-map-contract: ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `validate-map-contract: OK - ${SCHEMAS.length} schemas in lockstep ` +
    `(spec vs map.ts interfaces, required lists, and live coverage over ` +
    `${places.length} places / ${itineraries.length} itineraries: ` +
    `${events.length} events, ${mentions.length} mention rows, ` +
    `${deathAccounts.length} death accounts, ${stops.length} stops)`,
);
