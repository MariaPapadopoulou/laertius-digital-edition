/**
 * Generalizes validate-map-contract to the other high-traffic served
 * shapes: Graph nodes/edges/movements/associates, Timeline philosophers
 * and events, the Entities index, and the per-philosopher claims panel.
 *
 * Why: every route's Zod response validation strips keys not declared in
 * lib/api-spec/openapi.yaml, so a field added only server-side silently
 * never reaches the browser, and a spec field never populated ships dead.
 * This validator fails on drift in either direction:
 *
 * 1. Spec vs source interfaces: for schemas whose served shape IS the
 *    interface ("exact" mode: KgEdge, TimelineEvent, TimelinePhilosopher,
 *    GreekNameBearer, EntityCrossRef, SchoolAssociate/GraphAssociate),
 *    properties and required lists must match the interface exactly, like
 *    validate-map-contract. For schemas the route enriches with extra
 *    fields ("subset" mode: KgNode, AnnotatedEntity/EntityOccurrenceSummary,
 *    Claim/KgClaim, ChainLink), every interface field must still be in
 *    the spec (an interface-only field would be stripped); the enrichment
 *    fields are covered by the live check instead.
 * 2. Spec vs live sample, using the exact exported builders the routes
 *    serve (graphWithOntology, getTimeline, buildAnnotatedEntities,
 *    buildPhilosopherClaims):
 *    - every served key must be declared in the spec (else Zod strips it);
 *    - every spec property must be populated on at least one served
 *      object (else it is declared but dead), except documented
 *      cross-endpoint fields listed in allowUnpopulated;
 *    - every spec-required property must be present on EVERY served
 *      object (else the response fails Zod validation in production).
 *
 * 3. Inline nested object items: the flat property check above only sees
 *    a schema's top-level properties, so a schema whose array property
 *    declares its items as an INLINE object (e.g. EntityOccurrences'
 *    sections rows) would leave those rows unchecked - a field added only
 *    server-side to the rows would still be silently stripped by Zod.
 *    Every inline-object-items occurrence in openapi.yaml is enumerated
 *    automatically and must have a nested live check (NESTED_CONFIGS)
 *    sampling the exact pre-Zod builder the route serves, in both
 *    directions (stripped-key and declared-but-dead) plus the
 *    required-on-every check. A new inline items object added to the spec
 *    without a nested config fails the sweep.
 *
 * 4. Inline nested NON-ARRAY objects: schemas also nest inline object
 *    properties directly (type: object with inline properties, no $ref),
 *    e.g. DetailedStats' claims/entities/works wrappers and
 *    OtbOverview.counts. The flat check only sees the wrapper key itself,
 *    so a field added only server-side INSIDE such a sub-object would
 *    still be silently stripped by Zod, and a spec-only field there would
 *    ship dead. Every inline nested object property in openapi.yaml is
 *    enumerated automatically and must have a live check
 *    (nestedObjectSamples) sampling the exact pre-Zod builder the route
 *    serves, in both directions plus the required-on-every check. A new
 *    inline nested object added to the spec without a sample fails the
 *    sweep.
 *
 * A deliberate shape change requires editing openapi.yaml and the server
 * source together (and re-running the api-spec codegen).
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-page-contracts
 */
import path from "node:path";
import { readFileSync, readdirSync } from "node:fs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SPEC_PATH = path.join(ROOT, "lib/api-spec/openapi.yaml");
const API_LIB = path.join(ROOT, "artifacts/api-server/src/lib");
const API_ROUTES = path.join(ROOT, "artifacts/api-server/src/routes");

process.env["LAERTIUS_DATA_DIR"] ??= path.join(
  ROOT,
  "artifacts/api-server/data",
);

interface SchemaConfig {
  /** Schema name in openapi.yaml components. */
  schema: string;
  /** Source file holding the interface, when one exists. */
  tsFile?: string;
  /** Interface name when it differs from the schema name. */
  tsInterface?: string;
  /**
   * exact  = spec properties/required must equal the interface exactly
   *          (the served shape IS the interface);
   * subset = every interface field must be in the spec, but the route
   *          adds extra fields, so spec-side extras and required lists
   *          are checked against the live sample only.
   */
  mode?: "exact" | "subset";
  /**
   * Spec properties legitimately never populated by THIS builder because
   * the schema is shared with another endpoint that populates them.
   */
  allowUnpopulated?: string[];
}

const CONFIGS: SchemaConfig[] = [
  // Graph page (/api/graph)
  { schema: "KgNode", tsFile: "kg.ts", mode: "subset" },
  { schema: "KgEdge", tsFile: "kg.ts", mode: "exact" },
  // movements have no named interface (inline {id,label} enriched in the
  // route), so KgMovement is validated against the live sample only.
  // doctrineNote is now curated for every school in kg-ontology
  // SCHOOL_DOCTRINES, so it needs no allowUnpopulated exemption.
  { schema: "KgMovement" },
  {
    schema: "SchoolAssociate",
    tsFile: "graph-associates.ts",
    tsInterface: "GraphAssociate",
    mode: "exact",
  },
  // Timeline page (/api/timeline)
  { schema: "TimelinePhilosopher", tsFile: "timeline.ts", mode: "exact" },
  { schema: "TimelineEvent", tsFile: "timeline.ts", mode: "exact" },
  // Entities index (/api/annotations/entities)
  {
    schema: "AnnotatedEntity",
    tsFile: "annotate.ts",
    tsInterface: "EntityOccurrenceSummary",
    mode: "subset",
  },
  { schema: "GreekNameBearer", tsFile: "annotate.ts", mode: "exact" },
  { schema: "EntityCrossRef", tsFile: "annotate.ts", mode: "exact" },
  // Claims panel (/api/claims/:philosopher)
  {
    schema: "Claim",
    tsFile: "kg-claims.ts",
    tsInterface: "KgClaim",
    mode: "subset",
    // subject is served by the competency claimAnswers endpoint (reverse
    // matches), never by the per-philosopher panel builder sampled here.
    allowUnpopulated: ["subject"],
  },
  { schema: "ChainLink", tsFile: "kg-claims.ts", mode: "subset" },
  { schema: "PhilosopherClaims" },
  // Corpus list pages. The list routes serve the lib interfaces verbatim
  // (Verse) or the Serialized* view interfaces their serialize() emits
  // (sayings/doxai/anecdotes/epistles/testaments), so "exact" applies.
  // None of these schemas nests inline object items (their arrays hold
  // strings only), so the flat property check covers the whole shape -
  // and the inline-items sweep below proves that claim against the spec
  // instead of trusting this comment.
  { schema: "Verse", tsFile: "verses.ts", mode: "exact" },
  {
    schema: "Saying",
    tsFile: "sayings.ts",
    tsInterface: "SerializedSaying",
    mode: "exact",
  },
  {
    schema: "Doxa",
    tsFile: "doxai.ts",
    tsInterface: "SerializedDoxa",
    mode: "exact",
  },
  {
    schema: "Anecdote",
    tsFile: "anecdotes.ts",
    tsInterface: "SerializedAnecdote",
    mode: "exact",
  },
  {
    schema: "Epistle",
    tsFile: "epistles.ts",
    tsInterface: "SerializedEpistle",
    mode: "exact",
    // accordingTo was DROPPED from the epistle layer (interface, spec, LOD
    // export and epistle-card UI together): D.L. never names an authority
    // for a letter he actually quotes - the only source-attributed letter
    // (Epimenides to Solon, 1.112, discredited by Demetrius of Magnesia)
    // is a hedged report, which the layer's curation rules exclude, and
    // D.L. vouches for the quoted 1.113 letter himself ("I have found
    // another letter"). Authority naming lives in the claims/testaments
    // layers, where it is actually populated.
  },
  {
    schema: "Testament",
    tsFile: "testaments.ts",
    tsInterface: "SerializedTestament",
    mode: "exact",
  },
  // /sections and /philosophers enrich in the route (schoolGrc,
  // externalLinks), so the interface is a subset of the served shape and
  // the enrichment fields are covered by the live sample.
  {
    schema: "Section",
    tsFile: "corpus.ts",
    tsInterface: "CorpusSection",
    mode: "subset",
  },
  {
    schema: "Philosopher",
    tsFile: "corpus.ts",
    tsInterface: "PhilosopherEntry",
    mode: "subset",
  },
];

const errors: string[] = [];

/* ------------------------------------------------------------------ */
/* 1. Parse the OpenAPI schemas (indentation-based, no yaml dep).      */
/* ------------------------------------------------------------------ */

interface SpecShape {
  properties: string[];
  required: string[];
}

function parseSpecSchemas(specText: string): Map<string, SpecShape> {
  const lines = specText.split("\n");
  const out = new Map<string, SpecShape>();
  for (const { schema: name } of CONFIGS) {
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
    // required: [a, b] on one line, or a multi-line bracketed list.
    const required: string[] = [];
    const reqIdx = body.findIndex((l) => /^ {6}required:/.test(l));
    if (reqIdx >= 0) {
      let reqText = body[reqIdx]!;
      if (!reqText.includes("]")) {
        for (let i = reqIdx + 1; i < body.length; i++) {
          reqText += ` ${body[i]!.trim()}`;
          if (body[i]!.includes("]")) break;
        }
      }
      const m = reqText.match(/\[([^\]]*)\]/);
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

/**
 * Enumerate every array property in components.schemas whose items are an
 * INLINE object (items: / type: object), with the parsed nested shape.
 * $ref'd items are covered by their own named schema and are skipped.
 */
interface InlineItemsOccurrence {
  schema: string;
  prop: string;
  shape: SpecShape;
}

function parseInlineItemOccurrences(specText: string): InlineItemsOccurrence[] {
  const lines = specText.split("\n");
  const out: InlineItemsOccurrence[] = [];
  let schema = "";
  const schemasIdx = lines.findIndex((l) => l === "  schemas:");
  for (let i = schemasIdx + 1; i < lines.length; i++) {
    const line = lines[i]!;
    const schemaMatch = line.match(/^ {4}([A-Za-z_][A-Za-z0-9_]*):\s*$/);
    if (schemaMatch) schema = schemaMatch[1]!;
    const itemsMatch = line.match(/^( +)items:\s*$/);
    if (!itemsMatch) continue;
    const itemsIndent = itemsMatch[1]!.length;
    // Find the first non-empty line after items:
    let j = i + 1;
    while (j < lines.length && lines[j]!.trim() === "") j++;
    if (lines[j] !== `${" ".repeat(itemsIndent + 2)}type: object`) continue;
    // The array property name is the nearest shallower "name:" line above.
    let prop = "";
    for (let k = i - 1; k >= 0; k--) {
      const m = lines[k]!.match(/^( +)([A-Za-z_][A-Za-z0-9_]*):\s*$/);
      if (m && m[1]!.length < itemsIndent) {
        prop = m[2]!;
        break;
      }
    }
    // Parse the items block: everything indented deeper than items:.
    const body: string[] = [];
    for (let k = i + 1; k < lines.length; k++) {
      const l = lines[k]!;
      if (l.trim() === "") continue;
      const indent = l.match(/^ */)![0].length;
      if (indent <= itemsIndent) break;
      body.push(l);
    }
    const required: string[] = [];
    const reqLine = body.find(
      (l) => l.startsWith(`${" ".repeat(itemsIndent + 2)}required:`),
    );
    if (reqLine) {
      const m = reqLine.match(/\[([^\]]*)\]/);
      if (m) {
        for (const f of m[1]!.split(",")) {
          const t = f.trim();
          if (t) required.push(t);
        }
      } else {
        errors.push(
          `spec: inline items of ${schema}.${prop} has a required list not in [a, b] form; update the parser or the spec`,
        );
      }
    }
    const properties: string[] = [];
    const propsIdx = body.findIndex(
      (l) => l === `${" ".repeat(itemsIndent + 2)}properties:`,
    );
    if (propsIdx < 0) {
      errors.push(`spec: inline items of ${schema}.${prop} has no properties block`);
    } else {
      const keyRe = new RegExp(
        `^ {${itemsIndent + 4}}([A-Za-z_][A-Za-z0-9_]*):`,
      );
      for (let k = propsIdx + 1; k < body.length; k++) {
        const l = body[k]!;
        const indent = l.match(/^ */)![0].length;
        if (indent <= itemsIndent + 2) break;
        const m = l.match(keyRe);
        if (m) properties.push(m[1]!);
      }
    }
    if (properties.length === 0) {
      errors.push(
        `spec: parsed zero properties for inline items of ${schema}.${prop} (parser drift?)`,
      );
    }
    out.push({ schema, prop, shape: { properties, required } });
  }
  return out;
}

/**
 * Enumerate every inline NON-ARRAY nested object property in
 * components.schemas: a property whose value is `type: object` with an
 * inline properties block. $ref'd properties are covered by their own
 * named schema and never match (they have no inline `type: object`
 * line); array items objects are covered by the inline-items sweep
 * above (the owner key `items` is skipped here).
 */
interface InlineObjectOccurrence {
  /** Dotted path from the schema name, e.g. "DetailedStats.claims". */
  path: string;
  shape: SpecShape;
}

function parseInlineObjectOccurrences(
  specText: string,
): InlineObjectOccurrence[] {
  const lines = specText.split("\n");
  const out: InlineObjectOccurrence[] = [];
  const schemasIdx = lines.findIndex((l) => l === "  schemas:");
  // Stack of open mapping keys (indent + name), maintained line by line.
  const stack: { indent: number; key: string }[] = [];
  for (let i = schemasIdx + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim() === "") continue;
    const indent = line.match(/^ */)![0].length;
    const typeMatch = line.match(/^( +)type: object\s*$/);
    if (typeMatch) {
      const ownerIndent = indent - 2;
      const owner = [...stack]
        .reverse()
        .find((s) => s.indent === ownerIndent);
      // Skip the schema's own top-level `type: object` (indent 6) and
      // array items objects (owner key `items`, swept separately).
      if (owner && ownerIndent > 4 && owner.key !== "items") {
        const pathKeys = stack
          .filter((s) => s.indent < indent && s.key !== "properties")
          .map((s) => s.key);
        const pathStr = pathKeys.join(".");
        // Parse the sub-object block: everything deeper than the owner.
        const body: string[] = [];
        for (let k = i; k < lines.length; k++) {
          const l = lines[k]!;
          if (l.trim() === "") continue;
          const bi = l.match(/^ */)![0].length;
          if (bi <= ownerIndent) break;
          body.push(l);
        }
        const required: string[] = [];
        const reqIdx = body.findIndex((l) =>
          l.startsWith(`${" ".repeat(indent)}required:`),
        );
        if (reqIdx >= 0) {
          let reqText = body[reqIdx]!;
          if (!reqText.includes("]")) {
            for (let k = reqIdx + 1; k < body.length; k++) {
              reqText += ` ${body[k]!.trim()}`;
              if (body[k]!.includes("]")) break;
            }
          }
          const m = reqText.match(/\[([^\]]*)\]/);
          if (m) {
            for (const f of m[1]!.split(",")) {
              const t = f.trim();
              if (t) required.push(t);
            }
          } else {
            errors.push(
              `spec: inline object ${pathStr} has a required list not in [a, b] form; update the parser or the spec`,
            );
          }
        }
        const properties: string[] = [];
        const propsIdx = body.findIndex(
          (l) => l === `${" ".repeat(indent)}properties:`,
        );
        if (propsIdx < 0) {
          errors.push(
            `spec: inline object ${pathStr} has no inline properties block`,
          );
        } else {
          const keyRe = new RegExp(
            `^ {${indent + 2}}([A-Za-z_][A-Za-z0-9_]*):`,
          );
          for (let k = propsIdx + 1; k < body.length; k++) {
            const l = body[k]!;
            const bi = l.match(/^ */)![0].length;
            if (bi <= indent) break;
            const m = l.match(keyRe);
            if (m) properties.push(m[1]!);
          }
        }
        if (properties.length === 0) {
          errors.push(
            `spec: parsed zero properties for inline object ${pathStr} (parser drift?)`,
          );
        }
        out.push({ path: pathStr, shape: { properties, required } });
      }
    }
    const keyMatch = line.match(/^( +)([A-Za-z_][A-Za-z0-9_]*):/);
    if (keyMatch) {
      const ki = keyMatch[1]!.length;
      while (stack.length > 0 && stack[stack.length - 1]!.indent >= ki) {
        stack.pop();
      }
      stack.push({ indent: ki, key: keyMatch[2]! });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 2. Parse the server interfaces.                                     */
/* ------------------------------------------------------------------ */

interface TsShape {
  fields: string[];
  requiredFields: string[];
  /** Non-optional but nullable fields (`x: T | null`): always serialized
   * (as null when absent), but the spec is not consistent about listing
   * them as required, so the required-list comparison tolerates either. */
  nullableFields: string[];
}

const tsFileCache = new Map<string, string>();
function tsFileText(file: string): string {
  let text = tsFileCache.get(file);
  if (text === undefined) {
    text = readFileSync(path.join(API_LIB, file), "utf8");
    tsFileCache.set(file, text);
  }
  return text;
}

function parseTsInterface(file: string, name: string): TsShape | undefined {
  const re = new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`, "m");
  const m = tsFileText(file).match(re);
  if (!m) {
    errors.push(`${file}: interface ${name} not found`);
    return undefined;
  }
  const fields: string[] = [];
  const requiredFields: string[] = [];
  const nullableFields: string[] = [];
  for (const line of m[1]!.split("\n")) {
    const fm = line.match(/^ {2}([A-Za-z_][A-Za-z0-9_]*)(\?)?:/);
    if (!fm) continue;
    fields.push(fm[1]!);
    if (!fm[2]) {
      requiredFields.push(fm[1]!);
      if (/\|\s*null\s*;?\s*$/.test(line)) nullableFields.push(fm[1]!);
    }
  }
  if (fields.length === 0) {
    errors.push(`${file}: parsed zero fields for ${name} (parser drift?)`);
    return undefined;
  }
  return { fields, requiredFields, nullableFields };
}

function diff(a: string[], b: string[]): string[] {
  const bs = new Set(b);
  return a.filter((x) => !bs.has(x));
}

const specShapes = parseSpecSchemas(readFileSync(SPEC_PATH, "utf8"));

for (const cfg of CONFIGS) {
  if (!cfg.tsFile) continue;
  const spec = specShapes.get(cfg.schema);
  const iface = cfg.tsInterface ?? cfg.schema;
  const ts = parseTsInterface(cfg.tsFile, iface);
  if (!spec || !ts) continue;
  for (const f of diff(ts.fields, spec.properties)) {
    errors.push(
      `${cfg.schema}: field "${f}" exists in the ${cfg.tsFile} interface ${iface} but not in openapi.yaml - the route's Zod validation will silently strip it from the served payload`,
    );
  }
  if (cfg.mode === "exact") {
    for (const f of diff(spec.properties, ts.fields)) {
      errors.push(
        `${cfg.schema}: property "${f}" is declared in openapi.yaml but missing from the ${cfg.tsFile} interface ${iface} (declared-but-never-populated risk)`,
      );
    }
    for (const f of diff(spec.required, ts.requiredFields)) {
      errors.push(
        `${cfg.schema}: "${f}" is required in openapi.yaml but optional (or absent) in ${cfg.tsFile} ${iface}`,
      );
    }
    for (const f of diff(ts.requiredFields, spec.required)) {
      // Nullable non-optional fields are always serialized (as null), so
      // declaring them required in the spec is optional tightening.
      if (ts.nullableFields.includes(f)) continue;
      errors.push(
        `${cfg.schema}: "${f}" is non-optional in ${cfg.tsFile} ${iface} but not listed as required in openapi.yaml`,
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/* 3. Live sample: keys actually serialized by the route builders.     */
/* ------------------------------------------------------------------ */

type Obj = Record<string, unknown>;

function collectKeys(objs: Obj[]): Set<string> {
  const keys = new Set<string>();
  for (const o of objs) {
    for (const [k, v] of Object.entries(o)) {
      if (v !== undefined) keys.add(k);
    }
  }
  return keys;
}

function checkLive(schema: string, objs: Obj[]): void {
  const cfg = CONFIGS.find((c) => c.schema === schema)!;
  const spec = specShapes.get(schema);
  if (!spec) return;
  if (objs.length === 0) {
    errors.push(`live: no ${schema} objects served, cannot verify coverage`);
    return;
  }
  const served = collectKeys(objs);
  for (const k of served) {
    if (!spec.properties.includes(k)) {
      errors.push(
        `live ${schema}: served key "${k}" is not declared in openapi.yaml - Zod will strip it from the response`,
      );
    }
  }
  const allowed = new Set(cfg.allowUnpopulated ?? []);
  for (const p of spec.properties) {
    if (!served.has(p) && !allowed.has(p)) {
      errors.push(
        `live ${schema}: spec property "${p}" is never populated on any served object (declared but dead)`,
      );
    }
  }
  for (const r of spec.required) {
    for (const o of objs) {
      if (o[r] === undefined) {
        errors.push(
          `live ${schema}: required property "${r}" is missing on a served object - the response would fail Zod validation`,
        );
        break;
      }
    }
  }
}

const { graphWithOntology, buildPhilosopherClaims } = await import(
  path.join(API_ROUTES, "graph")
);
const { buildAnnotatedEntities } = await import(
  path.join(API_ROUTES, "annotations")
);
const { getTimeline } = await import(path.join(API_LIB, "timeline"));

const { listVerses } = await import(path.join(API_LIB, "verses.ts"));
const graph = graphWithOntology() as {
  nodes: Obj[];
  edges: Obj[];
  movements: Obj[];
  associates: Obj[];
};
checkLive("KgNode", graph.nodes);
checkLive("KgEdge", graph.edges);
checkLive("KgMovement", graph.movements);
checkLive("SchoolAssociate", graph.associates);

const timeline = getTimeline() as Obj[];
const timelineEvents = timeline.flatMap((p) => p["events"] as Obj[]);
checkLive("TimelinePhilosopher", timeline);
checkLive("TimelineEvent", timelineEvents);

const entities = buildAnnotatedEntities() as Obj[];
checkLive("AnnotatedEntity", entities);
checkLive(
  "GreekNameBearer",
  entities.flatMap((e) => (e["sharesGreekNameWith"] as Obj[]) ?? []),
);
checkLive(
  "EntityCrossRef",
  entities.flatMap((e) => (e["homonyms"] as Obj[]) ?? []),
);

const philosopherClaims = graph.nodes.map((n) => ({
  philosopher: n["name"],
  claims: buildPhilosopherClaims(n["name"] as string) as Obj[],
}));
const claims = philosopherClaims.flatMap((p) => p.claims);
const chainLinks = claims.flatMap((c) => (c["chain"] as Obj[]) ?? []);

const versesList = listVerses({}) as Obj[];

const { listSayings } = await import(path.join(API_LIB, "sayings.ts"));
const { listDoxai } = await import(path.join(API_LIB, "doxai.ts"));
const { listAnecdotes } = await import(path.join(API_LIB, "anecdotes.ts"));
const { listEpistles } = await import(path.join(API_LIB, "epistles.ts"));
const { listTestaments } = await import(path.join(API_LIB, "testaments.ts"));
const { corpus } = await import(path.join(API_LIB, "corpus.ts"));
const { buildPhilosophersList, buildSectionListItem, buildSectionDetail } =
  await import(path.join(API_ROUTES, "corpus"));

const sayingsList = listSayings({}) as Obj[];
const doxaiList = listDoxai({}) as Obj[];
const anecdotesList = listAnecdotes({}) as Obj[];
const epistlesList = listEpistles({}) as Obj[];
const testamentsList = listTestaments() as Obj[];
const philosophersList = buildPhilosophersList() as Obj[];
const sectionsSample = [
  ...(corpus as { id: string }[]).map((s) => buildSectionListItem(s) as Obj),
  ...(philosophersList
    .map((p) => buildSectionDetail(p["firstId"] as string))
    .filter(Boolean) as Obj[]),
];

checkLive("Verse", versesList);
checkLive("Saying", sayingsList);
checkLive("Doxa", doxaiList);
checkLive("Anecdote", anecdotesList);
checkLive("Epistle", epistlesList);
checkLive("Testament", testamentsList);
checkLive("Philosopher", philosophersList);
checkLive("Section", sectionsSample);

/* ------------------------------------------------------------------ */
/* 4. Inline nested object items: sweep + live checks.                 */
/* ------------------------------------------------------------------ */

// Live check for a nested inline-items shape: both directions plus the
// required-on-every check, exactly like the flat schemas.
function checkShapeLive(
  label: string,
  shape: SpecShape,
  objs: Obj[],
  allowUnpopulated: string[] = [],
): void {
  if (objs.length === 0) {
    errors.push(`live: no ${label} rows served, cannot verify coverage`);
    return;
  }
  const served = collectKeys(objs);
  for (const k of served) {
    if (!shape.properties.includes(k)) {
      errors.push(
        `live ${label}: served key "${k}" is not declared in openapi.yaml - Zod will strip it from the response`,
      );
    }
  }
  const allowed = new Set(allowUnpopulated);
  for (const p of shape.properties) {
    if (!served.has(p) && !allowed.has(p)) {
      errors.push(
        `live ${label}: spec property "${p}" is never populated on any served row (declared but dead)`,
      );
    }
  }
  for (const r of shape.required) {
    for (const o of objs) {
      if (o[r] === undefined) {
        errors.push(
          `live ${label}: required property "${r}" is missing on a served row - the response would fail Zod validation`,
        );
        break;
      }
    }
  }
}

const { buildEntitySections } = await import(path.join(API_ROUTES, "annotations"));
const { computeStats } = await import(path.join(API_ROUTES, "stats"));
const { buildCompetencyAnswer } = await import(
  path.join(API_ROUTES, "competency")
);
const { COMPETENCY_QUESTIONS } = await import(path.join(API_LIB, "competency"));
const { buildOtbOverview, buildOtbConcepts, buildOtbObjectDetail } =
  await import(path.join(API_ROUTES, "otb"));
const { getOtbModel } = await import(path.join(API_LIB, "otb/build.ts"));
const {
  listSnapshots,
  snapshotByBook,
  listPools,
  poolCoverage,
  poolAgreement,
  poolDisagreements,
} = await import(path.join(API_LIB, "eval/store.ts"));
const { sanitizeCitations } = await import(
  path.join(API_LIB, "generate-answer.ts")
);

/**
 * Collect EVERY row the builder can serve - no early exit. The
 * stripped-key and required-on-every checks are only sound over the full
 * population: a key conditionally emitted (or a required key
 * conditionally missing) on a late entity/object would escape any
 * truncated sample.
 */
function allRows(batches: Iterable<Obj[]>): Obj[] {
  const rows: Obj[] = [];
  for (const batch of batches) rows.push(...batch);
  return rows;
}

const inlineOccurrences = parseInlineItemOccurrences(
  readFileSync(SPEC_PATH, "utf8"),
);
const occByKey = new Map(
  inlineOccurrences.map((o) => [`${o.schema}.${o.prop}`, o]),
);

// Every inline-items occurrence must be sampled here with the exact
// pre-Zod builder its route serves. The sweep below fails on any
// occurrence missing from this map (and on any stale entry).
const statsFull = computeStats() as Obj;
const stats = statsFull as unknown as {
  entities: { byKind: Obj[]; topEntities: Obj[] };
  works: { byCentury: Obj[] };
};
const competencyAnswers = (
  COMPETENCY_QUESTIONS as { id: string }[]
).map((q) => buildCompetencyAnswer(q) as Obj);
const otbConcepts = buildOtbConcepts() as Obj[];
const otbOverview = buildOtbOverview() as Obj;
const otbObjectIds = (getOtbModel() as { objects: { id: string }[] }).objects
  .map((o) => o.id);

function* entitySectionBatches(): Generator<Obj[]> {
  for (const e of entities) {
    const rows = buildEntitySections(e["entityUri"] as string) as
      | Obj[]
      | undefined;
    if (rows) yield rows;
  }
}
// Build every object detail exactly once (the inbound computation scans
// all objects per call, so re-building per nested prop would triple an
// already quadratic pass).
let otbDetailsCache: Obj[] | null = null;
function otbDetails(): Obj[] {
  if (!otbDetailsCache) {
    otbDetailsCache = otbObjectIds.map((id) => buildOtbObjectDetail(id) as Obj);
  }
  return otbDetailsCache;
}
function* otbDetailBatches(
  prop: "literals" | "relations" | "inbound",
): Generator<Obj[]> {
  for (const detail of otbDetails()) {
    yield (detail[prop] as Obj[]) ?? [];
  }
}

// Eval store rows: sample the exact pre-Zod builders the eval routes
// serve, over every snapshot/pool on disk.
const evalSnapshots = listSnapshots() as { id: string }[];
const evalPools = listPools() as {
  items: { topicId: string }[];
}[];
// The pool detail route builds depthPerTopic inline from pool.items;
// replicate that exact pre-Zod construction here.
function poolDepthPerTopic(pool: { items: { topicId: string }[] }): Obj[] {
  const depth = new Map<string, number>();
  for (const item of pool.items) {
    depth.set(item.topicId, (depth.get(item.topicId) ?? 0) + 1);
  }
  return [...depth.entries()].map(([topicId, poolSize]) => ({
    topicId,
    poolSize,
  }));
}

const nestedSamples = new Map<string, () => Obj[]>([
  ["EntityOccurrences.sections", () => allRows(entitySectionBatches())],
  ["DetailedStats.byKind", () => stats.entities.byKind],
  ["DetailedStats.topEntities", () => stats.entities.topEntities],
  ["DetailedStats.byCentury", () => stats.works.byCentury],
  [
    "CompetencyQuestionResult.terms",
    () => competencyAnswers.flatMap((a) => a["terms"] as Obj[]),
  ],
  [
    "CompetencyQuestionResult.passages",
    () => competencyAnswers.flatMap((a) => a["passages"] as Obj[]),
  ],
  [
    "CompetencyQuestionResult.droppedSeeds",
    () => competencyAnswers.flatMap((a) => (a["droppedSeeds"] as Obj[]) ?? []),
  ],
  ["OtbOverview.categoryCounts", () => otbOverview["categoryCounts"] as Obj[]],
  ["OtbOverview.conceptCounts", () => otbOverview["conceptCounts"] as Obj[]],
  [
    "OtbConcept.relations",
    () => otbConcepts.flatMap((c) => c["relations"] as Obj[]),
  ],
  ["OtbConcept.terms", () => otbConcepts.flatMap((c) => c["terms"] as Obj[])],
  [
    "OtbConcept.examples",
    () => otbConcepts.flatMap((c) => (c["examples"] as Obj[]) ?? []),
  ],
  [
    "EvalSnapshotDetail.byBook",
    () =>
      evalSnapshots.flatMap(
        (s) => (snapshotByBook(s.id) as Obj[] | null) ?? [],
      ),
  ],
  ["EvalPoolDetail.depthPerTopic", () => evalPools.flatMap(poolDepthPerTopic)],
  [
    "EvalPoolCoverage.items",
    () =>
      evalPools.flatMap((p) => (poolCoverage(p) as { items: Obj[] }).items),
  ],
  [
    "EvalAgreementReport.perTask",
    () =>
      evalPools.flatMap(
        (p) => (poolAgreement(p) as { perTask: Obj[] }).perTask,
      ),
  ],
  [
    "EvalAgreementReport.pairwise",
    () =>
      evalPools.flatMap(
        (p) => (poolAgreement(p) as { pairwise: Obj[] }).pairwise,
      ),
  ],
  [
    "EvalDisagreement.grades",
    () =>
      evalPools
        .flatMap((p) => poolDisagreements(p) as Obj[])
        .flatMap((d) => d["grades"] as Obj[]),
  ],
  [
    "GeneratedAnswer.citations",
    // The Ask generative endpoint builds citations exclusively through
    // sanitizeCitations (generate-answer.ts) — every row is {sectionId,
    // label}. Sample that exact pre-Zod builder over a representative
    // raw answer so a server-side field added to citation rows is caught.
    () =>
      (
        sanitizeCitations(
          "Answer text [D.L. 2.5.21] and [D.L. 7.4.166].",
          new Set(["2.5.21", "7.4.166"]),
        ) as { citations: Obj[] }
      ).citations,
  ],
  ["OtbObjectDetail.literals", () => allRows(otbDetailBatches("literals"))],
  ["OtbObjectDetail.relations", () => allRows(otbDetailBatches("relations"))],
  ["OtbObjectDetail.inbound", () => allRows(otbDetailBatches("inbound"))],
]);

// Optional spec fields that are legitimately absent from the current
// on-disk sample (they are populated only when annotators supply them),
// keyed by the same "<Schema>.<prop>" occurrence keys.
const nestedAllowUnpopulated = new Map<string, string[]>([
  // notes/flag ride along on a judgment only when the annotator entered
  // them; the current judgment uploads carry flags but no notes.
  ["EvalDisagreement.grades", ["notes"]],
]);

// Sweep: no inline-items occurrence may go unchecked, and no sample may
// point at an occurrence the spec no longer has.
if (inlineOccurrences.length === 0) {
  errors.push(
    "spec: parsed zero inline-object-items occurrences (parser drift? EntityOccurrences.sections alone should match)",
  );
}
// Agreement/disagreement rows only exist once judgments have been
// ingested. A freshly created pool (judgments dir empty) is a legitimate
// lifecycle state, not a coverage regression — skip the empty-rows error
// for exactly these keys in that state, but keep failing if judgments
// exist yet the builders serve zero rows.
const judgmentIngests = readdirSync(
  path.join(ROOT, "artifacts/api-server/data/eval/judgments"),
).filter((f) => f.endsWith(".json"));
const judgmentDependentKeys = new Set([
  "EvalAgreementReport.perTask",
  "EvalAgreementReport.pairwise",
  "EvalDisagreement.grades",
]);

for (const occ of inlineOccurrences) {
  const key = `${occ.schema}.${occ.prop}`;
  const sample = nestedSamples.get(key);
  if (!sample) {
    errors.push(
      `sweep: ${key} declares INLINE object items in openapi.yaml but has no nested live check here - a field added only server-side to those rows would be silently stripped by Zod; add a pre-Zod builder sample to nestedSamples`,
    );
    continue;
  }
  if (
    judgmentDependentKeys.has(key) &&
    judgmentIngests.length === 0 &&
    sample().length === 0
  ) {
    console.log(
      `note: ${key} skipped - no judgment ingests on disk yet (data/eval/judgments is empty), so zero rows is the expected lifecycle state`,
    );
    continue;
  }
  checkShapeLive(
    `${occ.schema}.${occ.prop} items`,
    occ.shape,
    sample(),
    nestedAllowUnpopulated.get(key) ?? [],
  );
}
for (const key of nestedSamples.keys()) {
  if (!occByKey.has(key)) {
    errors.push(
      `sweep: nested sample "${key}" matches no inline-object-items occurrence in openapi.yaml (renamed or now $ref'd? update nestedSamples)`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* 5. Inline nested NON-ARRAY objects: sweep + live checks.            */
/* ------------------------------------------------------------------ */

const inlineObjectOccurrences = parseInlineObjectOccurrences(
  readFileSync(SPEC_PATH, "utf8"),
);
const objOccByPath = new Map(inlineObjectOccurrences.map((o) => [o.path, o]));

// Every inline nested object property must be sampled here with the exact
// pre-Zod builder its route serves (the sub-object is a single row, so
// the checks run over a one-element sample). The sweep below fails on
// any occurrence missing from this map (and on any stale entry).
const nestedObjectSamples = new Map<string, () => Obj[]>([
  // DetailedStats' wrappers, all served by computeStats() (routes/stats.ts).
  ["DetailedStats.claims", () => [statsFull["claims"] as Obj]],
  ["DetailedStats.verses", () => [statsFull["verses"] as Obj]],
  ["DetailedStats.sayings", () => [statsFull["sayings"] as Obj]],
  ["DetailedStats.anecdotes", () => [statsFull["anecdotes"] as Obj]],
  ["DetailedStats.epistles", () => [statsFull["epistles"] as Obj]],
  ["DetailedStats.testaments", () => [statsFull["testaments"] as Obj]],
  ["DetailedStats.entities", () => [statsFull["entities"] as unknown as Obj]],
  ["DetailedStats.works", () => [statsFull["works"] as unknown as Obj]],
  ["DetailedStats.places", () => [statsFull["places"] as Obj]],
  ["DetailedStats.sources", () => [statsFull["sources"] as Obj]],
  ["DetailedStats.lod", () => [statsFull["lod"] as Obj]],
  // OtbOverview.counts, served by buildOtbOverview() (routes/otb.ts).
  ["OtbOverview.counts", () => [otbOverview["counts"] as Obj]],
]);

// Sweep: no inline nested object may go unchecked, and no sample may
// point at an occurrence the spec no longer has.
if (inlineObjectOccurrences.length === 0) {
  errors.push(
    "spec: parsed zero inline nested object occurrences (parser drift? DetailedStats.claims alone should match)",
  );
}
for (const occ of inlineObjectOccurrences) {
  const sample = nestedObjectSamples.get(occ.path);
  if (!sample) {
    errors.push(
      `sweep: ${occ.path} declares an INLINE nested object in openapi.yaml but has no live check here - a field added only server-side inside it would be silently stripped by Zod; add a pre-Zod builder sample to nestedObjectSamples`,
    );
    continue;
  }
  checkShapeLive(occ.path, occ.shape, sample());
}
for (const key of nestedObjectSamples.keys()) {
  if (!objOccByPath.has(key)) {
    errors.push(
      `sweep: nested object sample "${key}" matches no inline nested object occurrence in openapi.yaml (renamed or now $ref'd? update nestedObjectSamples)`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Report.                                                             */
/* ------------------------------------------------------------------ */

if (errors.length > 0) {
  console.error(`validate-page-contracts: ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `validate-page-contracts: OK - ${CONFIGS.length} schemas in lockstep ` +
    `(spec vs server interfaces and live coverage over ` +
    `${graph.nodes.length} nodes, ${graph.edges.length} edges, ` +
    `${graph.movements.length} movements, ${graph.associates.length} associates, ` +
    `${timeline.length} timeline philosophers / ${timelineEvents.length} events, ` +
    `${entities.length} index entities, ${claims.length} claims, ` +
    `${chainLinks.length} chain links, ${versesList.length} verses, ` +
    `${sayingsList.length} sayings, ${doxaiList.length} doxai, ` +
    `${anecdotesList.length} anecdotes, ${epistlesList.length} epistles, ` +
    `${testamentsList.length} testaments, ${philosophersList.length} ` +
    `philosophers, ${sectionsSample.length} section samples; ` +
    `${inlineOccurrences.length} inline-items shapes and ` +
    `${inlineObjectOccurrences.length} inline nested objects swept)`,
);
