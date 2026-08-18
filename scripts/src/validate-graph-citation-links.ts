/**
 * Validates the Graph side panel's founder and doctrine passage links,
 * exactly as /api/graph serves them (graphWithOntology in
 * routes/graph.ts). The UI only renders a founder line's "(D.L. <ref>)"
 * or a school doctrine's "(D.L. <ref>)" as a clickable passage link
 * when the payload carries founderSectionId / doctrineSectionId
 * (graph.tsx); a regression in the server-side ref->sectionId join
 * would otherwise ship as a quietly unlinked plain-text citation with
 * no failing check (the e2e only pins Zeno of Citium / Stoa).
 *
 * Asserts, for every served node and movement:
 *
 * 1. Every node carrying a founderRef also carries a founderSectionId,
 *    and that id resolves to a real corpus section whose bare
 *    book.section matches the ref.
 * 2. Every movement carrying a doctrine also carries doctrineRef and a
 *    doctrineSectionId resolving to a real section matching the ref.
 * 3. Positive controls so the check can never go vacuously green: the
 *    known founder citations (Thales 1.122, Plato 2.47 [3.2 chapter],
 *    Epicurus 10.15, Zeno of Citium 6.105) and doctrine citations
 *    (cyrenaic 2.87, cynic 6.104, epicurean 10.131, stoa 7.87) must be
 *    present, and the founder/doctrine counts may not drop below the
 *    curated floor.
 *
 * A deliberate ontology-extras change requires updating the controls.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-graph-citation-links
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { graphWithOntology } = await import(
  "../../artifacts/api-server/src/routes/graph"
);
const { sectionById } = await import(
  "../../artifacts/api-server/src/lib/corpus"
);

const errors: string[] = [];

/** bare book.section of a full corpus section id (book.chapter.section). */
function bareRef(sectionId: string): string {
  const parts = sectionId.split(".");
  return `${parts[0]}.${parts[parts.length - 1]}`;
}

const g = graphWithOntology();

// ---------------------------------------------------------------------
// 1. Every founderRef must carry a resolving founderSectionId.
// ---------------------------------------------------------------------
let founderCount = 0;
const founderSeen = new Map<string, string>();
for (const n of g.nodes as Array<{
  name: string;
  founderRef?: string;
  founderSectionId?: string;
}>) {
  if (!n.founderRef) {
    if (n.founderSectionId) {
      errors.push(`${n.name}: founderSectionId without founderRef`);
    }
    continue;
  }
  founderCount++;
  founderSeen.set(n.name, n.founderRef);
  if (!n.founderSectionId) {
    errors.push(
      `${n.name}: founderRef "${n.founderRef}" lost its founderSectionId (citation renders unlinked)`,
    );
    continue;
  }
  if (!sectionById.has(n.founderSectionId)) {
    errors.push(
      `${n.name}: founderSectionId "${n.founderSectionId}" is not a real corpus section`,
    );
  } else if (bareRef(n.founderSectionId) !== n.founderRef) {
    errors.push(
      `${n.name}: founderSectionId "${n.founderSectionId}" does not match founderRef "${n.founderRef}"`,
    );
  }
}

// ---------------------------------------------------------------------
// 2. Every movement with a doctrine must carry a resolving link.
// ---------------------------------------------------------------------
let doctrineCount = 0;
const doctrineSeen = new Map<string, string>();
for (const m of g.movements as Array<{
  id: string;
  doctrine?: string;
  doctrineRef?: string;
  doctrineSectionId?: string;
}>) {
  if (!m.doctrine && !m.doctrineRef && !m.doctrineSectionId) continue;
  if (!m.doctrineRef) {
    errors.push(`movement ${m.id}: doctrine without doctrineRef`);
    continue;
  }
  doctrineCount++;
  doctrineSeen.set(m.id, m.doctrineRef);
  if (!m.doctrineSectionId) {
    errors.push(
      `movement ${m.id}: doctrineRef "${m.doctrineRef}" lost its doctrineSectionId (citation renders unlinked)`,
    );
    continue;
  }
  if (!sectionById.has(m.doctrineSectionId)) {
    errors.push(
      `movement ${m.id}: doctrineSectionId "${m.doctrineSectionId}" is not a real corpus section`,
    );
  } else if (bareRef(m.doctrineSectionId) !== m.doctrineRef) {
    errors.push(
      `movement ${m.id}: doctrineSectionId "${m.doctrineSectionId}" does not match doctrineRef "${m.doctrineRef}"`,
    );
  }
}

// ---------------------------------------------------------------------
// 3. Positive controls: the check must never go vacuously green.
// ---------------------------------------------------------------------
const FOUNDER_CONTROLS: Record<string, string> = {
  Thales: "1.122",
  Plato: "2.47",
  Epicurus: "10.15",
  "Zeno of Citium": "6.105",
};
for (const [name, ref] of Object.entries(FOUNDER_CONTROLS)) {
  const got = founderSeen.get(name);
  if (got !== ref) {
    errors.push(
      `positive control: expected founderRef "${ref}" on ${name}, got ${got ? `"${got}"` : "none"}`,
    );
  }
}
const DOCTRINE_CONTROLS: Record<string, string> = {
  cyrenaic: "2.87",
  cynic: "6.104",
  epicurean: "10.131",
  stoa: "7.87",
};
for (const [id, ref] of Object.entries(DOCTRINE_CONTROLS)) {
  const got = doctrineSeen.get(id);
  if (got !== ref) {
    errors.push(
      `positive control: expected doctrineRef "${ref}" on movement ${id}, got ${got ? `"${got}"` : "none"}`,
    );
  }
}
if (founderCount < Object.keys(FOUNDER_CONTROLS).length) {
  errors.push(`suspiciously few founder citations served: ${founderCount}`);
}
if (doctrineCount < Object.keys(DOCTRINE_CONTROLS).length) {
  errors.push(`suspiciously few doctrine citations served: ${doctrineCount}`);
}

if (errors.length > 0) {
  console.error(`validate-graph-citation-links: ${errors.length} error(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `validate-graph-citation-links: OK (${founderCount} founder citations, ${doctrineCount} doctrine citations, all resolving to real sections)`,
);
