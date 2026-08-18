/**
 * Pins the row count of every competency question's SPARQL query.
 *
 * The /competency page runs each question's SELECT against the in-process
 * oxigraph store (the same graph + ontology Turtle the /api/lod/sparql
 * endpoint loads). A graph re-curation or a query edit could make one
 * question silently return zero rows: the sidebar would show a "0" badge
 * but nothing would fail. This validator boots the same store, runs each
 * question's query with the runtime LOD_BASE/ONT, and compares the live
 * row count against the pinned table below. Failure names the question
 * id, the pinned count, and the live count.
 *
 * After a deliberate curation change, update EXPECTED_ROW_COUNTS to the
 * new counts printed in the failure output.
 *
 * Two further pins guard the readable-label contract:
 * - school-doctrines coverage: its row count must equal the number of
 *   lo:School nodes carrying lo:principalDoctrine in the live graph. The
 *   question joins each doctrine to its @en rdfs:label, so a doctrine
 *   node shipped without an English label would silently drop its
 *   school's row from the Query Results table; this check names the
 *   schools that fell out of the join.
 * - school-doctrines pairing: the exact school -> doctrine label pairs
 *   are pinned in EXPECTED_SCHOOL_DOCTRINES. A curation edit that swaps
 *   a school's principalDoctrine target or rewords a doctrine label
 *   keeps the row count and label shapes intact, so only this pin
 *   catches it; failure names the school and shows pinned vs live text.
 * - projected columns: each question's projected variable list (SPARQL
 *   JSON head.vars, the exact source the /api/competency route serves as
 *   `variables`, which the Query Results table renders as its headers)
 *   is pinned in EXPECTED_COLUMNS, in order. A query edit that renames a
 *   variable (?philosopher -> ?p), drops one, adds one, or reorders the
 *   projection keeps every row count intact while the table's headers
 *   change or lose a column; failure names the question and the
 *   missing/extra/reordered variable names.
 * - answer-set fingerprint: each question's full result rows (sorted,
 *   order-insensitive) are pinned in EXPECTED_ANSWER_ROWS
 *   (competency-answer-pins.ts). A curation change that swaps one
 *   answer for another (a different philosopher joins a roster while
 *   one drops out) keeps the row count identical, so only this pin
 *   catches it; failure names the question id and lists the added and
 *   removed row values.
 * - no duplicate rows: no question's serialized result rows may contain
 *   exact duplicates. A query edit that drops a DISTINCT or duplicates a
 *   join path can serve the same row twice while the row-count pin is
 *   updated to match "the new number", so the Query Results table shows
 *   repeated lines. Failure names the question id and the duplicated row
 *   text. Deliberate duplicates can be whitelisted in
 *   ALLOWED_DUPLICATE_ROWS below.
 * - term-type pin: each pinned answer-row value that reaches the
 *   Entities-card extra-terms classifier (classifyExtraTerm in
 *   routes/competency.ts) is re-classified against the live lookup
 *   tables and compared to EXPECTED_TERM_TYPES
 *   (competency-answer-pins.ts). A curation change (a name added to
 *   PLACE_TYPES, a person losing its LOD typing) could silently
 *   rebucket a chip — a person rendered as a doctrine chip — while
 *   every pin above stays green; failure names the question, the
 *   value, and the pinned vs live type.
 * - no URI-shaped cells: no bound cell in any question's results may be
 *   a raw IRI (a named node, or a literal that looks like http(s)://...).
 *   The Query Results table renders cell values verbatim, so a query
 *   that regresses to projecting the node instead of its label would
 *   show full web addresses to readers.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-competency-counts
 */
import path from "node:path";
import { Store } from "oxigraph";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { COMPETENCY_QUESTIONS, getDroppedSeeds } = await import(
  "../../artifacts/api-server/src/lib/competency"
);
const { graphAsTurtle, ontologyAsTurtle, LOD_BASE, ONT } = await import(
  "../../artifacts/api-server/src/lib/lod"
);
const { MAX_QUERY_LENGTH } = await import(
  "../../artifacts/api-server/src/routes/sparql"
);
const {
  EXPECTED_ANSWER_ROWS,
  EXPECTED_GREEK_FORMS,
  EXPECTED_EXTRA_TERM_GREEK_FORMS,
  EXPECTED_TERM_TYPES,
  EXPECTED_SCHOOL_GREEK_FORMS,
  EXPECTED_DROPPED_SEED_GREEK_FORMS,
} = await import("./competency-answer-pins");
const { classifyExtraTerm } = await import(
  "../../artifacts/api-server/src/routes/competency"
);
const { getKnowledgeGraph, MOVEMENTS } = await import(
  "../../artifacts/api-server/src/lib/kg"
);
const { greekNameSpec, greekWorkTitleSpec, greekSchoolGrc } = await import(
  "../../artifacts/api-server/src/lib/greek-names"
);
const { PLACE_TYPES } = await import(
  "../../artifacts/api-server/src/lib/place-ontology"
);
const { WORK_FACETS } = await import(
  "../../artifacts/api-server/src/lib/work-ontology"
);

/** Pinned row counts per question id (as of July 2026 curation). */
const EXPECTED_ROW_COUNTS: Record<string, number> = {
  "stoa-members": 7,
  "academy-members": 11,
  "school-founders": 14,
  "cynic-line": 9,
  "peripatos-members": 6,
  "garden-members": 8,
  "socrates-students": 12,
  "aristotle-teachers": 1,
  "marriages": 1,
  "eleatic-atomist-chain": 9,
  "born-in-athens": 11,
  "died-in-athens": 2,
  "plato-works": 36,
  "aristotle-works": 147,
  "epicurus-works": 23,
  "school-doctrines": 7,
  "homonymy-proper-names": 96,
};

/**
 * Pinned projected variable names per question id, in projection order
 * (as of July 2026 curation). These are the SPARQL JSON head.vars, the
 * exact list the /api/competency route serves as `variables` and the
 * Query Results table renders as its column headers. After a deliberate
 * query change, update the drifted entry to the live list printed in
 * the failure output.
 */
const EXPECTED_COLUMNS: Record<string, string[]> = {
  "stoa-members": ["name"],
  "academy-members": ["name"],
  "school-founders": ["name", "school"],
  "cynic-line": ["name"],
  "peripatos-members": ["name"],
  "garden-members": ["name"],
  "socrates-students": ["name"],
  "aristotle-teachers": ["name"],
  "marriages": ["a", "b"],
  "eleatic-atomist-chain": ["from", "to"],
  "born-in-athens": ["name", "birthplace"],
  "died-in-athens": ["name"],
  "plato-works": ["title"],
  "aristotle-works": ["title"],
  "epicurus-works": ["title"],
  "school-doctrines": ["school", "doctrine"],
  "homonymy-proper-names": ["form", "name1", "name2"],
};

/**
 * Pinned school -> principal doctrine label pairs for the
 * school-doctrines question (as of July 2026 curation). Keys and values
 * are the exact @en rdfs:label texts the question projects. After a
 * deliberate curation change, update this table to the live pairs
 * printed in the failure output.
 */
const EXPECTED_SCHOOL_DOCTRINES: Record<string, string> = {
  Academy: "The end to aim at is assimilation to God",
  Cynic: "Life according to virtue is the end",
  Cyrenaic: "Bodily pleasure is the end",
  "Epicurean (Garden)": "Pleasure is the end and aim",
  Peripatos: "The one ethical end is the exercise of virtue in a completed life",
  Sceptic:
    "The end to be realized is suspension of judgement, which brings tranquillity in its train",
  Stoa: "Life in agreement with nature is the end",
};

/**
 * Deliberately duplicated result rows, keyed by question id. Each entry
 * maps the exact serialized row text ("var=value | var=value") to the
 * exact multiplicity that row is expected to have in that question's
 * results (must be >= 2). A live count above the pin fails — a row
 * whitelisted as a legitimate 2x duplicate must not quietly become 3x
 * after a join edit — and a live count at or below 1 flags the entry as
 * stale. Empty as of July 2026: no question legitimately serves
 * duplicate rows.
 */
const ALLOWED_DUPLICATE_ROWS: Record<string, Record<string, number>> = {};

const errors: string[] = [];
const summaries: string[] = [];

// Vacuous-check guards: the length cap check below means nothing if the
// cap is bogus or the catalogue exports zero questions.
if (!Number.isFinite(MAX_QUERY_LENGTH) || MAX_QUERY_LENGTH <= 0) {
  console.error(
    `validate-competency-counts FAILED: MAX_QUERY_LENGTH imported from routes/sparql.ts is not a positive number (got ${String(MAX_QUERY_LENGTH)}); the length cap check would be vacuous`,
  );
  process.exit(1);
}
if (COMPETENCY_QUESTIONS.length === 0) {
  console.error(
    `validate-competency-counts FAILED: COMPETENCY_QUESTIONS exports zero questions; every pin in this validator would pass vacuously`,
  );
  process.exit(1);
}

// Length cap: each question's collapsible SPARQL block prefills the
// playground, and running it POSTs to /api/lod/sparql, which rejects
// queries over MAX_QUERY_LENGTH with a 400. Row-count pins would still
// pass for an oversized query, so check the length explicitly.
for (const q of COMPETENCY_QUESTIONS) {
  const query = q.sparqlFn(LOD_BASE, ONT);
  if (query.length > MAX_QUERY_LENGTH) {
    errors.push(
      `question "${q.id}" query is ${query.length} characters, over the live endpoint's ${MAX_QUERY_LENGTH}-character cap (MAX_QUERY_LENGTH in routes/sparql.ts): the playground's "run this query" flow would fail with a 400 for readers`,
    );
  }
}

// Positive control: the pin table and the question list must cover each
// other exactly, so a new or renamed question cannot slip past unpinned.
const liveIds = new Set(COMPETENCY_QUESTIONS.map((q) => q.id));
for (const id of Object.keys(EXPECTED_ROW_COUNTS)) {
  if (!liveIds.has(id)) {
    errors.push(
      `pinned question "${id}" no longer exists in COMPETENCY_QUESTIONS (renamed or removed?); update the pin table`,
    );
  }
}
for (const q of COMPETENCY_QUESTIONS) {
  if (!(q.id in EXPECTED_ROW_COUNTS)) {
    errors.push(
      `question "${q.id}" has no pinned row count; add it to EXPECTED_ROW_COUNTS in validate-competency-counts.ts`,
    );
  }
}
for (const id of Object.keys(ALLOWED_DUPLICATE_ROWS)) {
  if (!liveIds.has(id)) {
    errors.push(
      `duplicate-whitelisted question "${id}" no longer exists in COMPETENCY_QUESTIONS (renamed or removed?); update ALLOWED_DUPLICATE_ROWS`,
    );
  }
}
for (const id of Object.keys(EXPECTED_COLUMNS)) {
  if (!liveIds.has(id)) {
    errors.push(
      `column-pinned question "${id}" no longer exists in COMPETENCY_QUESTIONS (renamed or removed?); update EXPECTED_COLUMNS`,
    );
  }
}
for (const q of COMPETENCY_QUESTIONS) {
  if (!(q.id in EXPECTED_COLUMNS)) {
    errors.push(
      `question "${q.id}" has no pinned column set; add its projected variables to EXPECTED_COLUMNS in validate-competency-counts.ts`,
    );
  }
}
for (const id of Object.keys(EXPECTED_ANSWER_ROWS)) {
  if (!liveIds.has(id)) {
    errors.push(
      `answer-pinned question "${id}" no longer exists in COMPETENCY_QUESTIONS (renamed or removed?); update EXPECTED_ANSWER_ROWS in competency-answer-pins.ts`,
    );
  }
}
for (const q of COMPETENCY_QUESTIONS) {
  if (!(q.id in EXPECTED_ANSWER_ROWS)) {
    errors.push(
      `question "${q.id}" has no pinned answer set; add its sorted rows to EXPECTED_ANSWER_ROWS in competency-answer-pins.ts`,
    );
  }
}

const store = new Store();
store.load(graphAsTurtle(), { format: "text/turtle" });
store.load(ontologyAsTurtle(), { format: "text/turtle" });

for (const q of COMPETENCY_QUESTIONS) {
  const expected = EXPECTED_ROW_COUNTS[q.id];
  if (expected === undefined) continue; // already reported above

  let bindings: unknown;
  try {
    bindings = store.query(q.sparqlFn(LOD_BASE, ONT));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`question "${q.id}" failed to execute: ${message}`);
    continue;
  }
  if (!Array.isArray(bindings)) {
    errors.push(
      `question "${q.id}" did not return SELECT bindings (got ${typeof bindings}); competency queries must stay SELECT queries`,
    );
    continue;
  }
  const live = bindings.length;
  if (live !== expected) {
    errors.push(
      `question "${q.id}" drifted: pinned ${expected} rows, live ${live} rows` +
        (live === 0
          ? " (the sidebar would show a silent \"0\" badge for this question)"
          : ""),
    );
    continue;
  }
  summaries.push(`${q.id}=${live}`);

  // Answer-set fingerprint pin: the row count above can stay identical
  // while a curation change swaps one answer for another (a different
  // philosopher joins a roster while one drops out). Serialize each row
  // as the projected variables in order (name=value joined with " | "),
  // sort the list so ordering never matters, and compare against the
  // pinned rows. Failure names the added and removed values.
  const pinnedRows = EXPECTED_ANSWER_ROWS[q.id];
  if (pinnedRows !== undefined) {
    let liveRows: string[] | undefined;
    try {
      const rawJson = String(
        store.query(q.sparqlFn(LOD_BASE, ONT), { results_format: "json" }),
      );
      const parsed = JSON.parse(rawJson) as {
        head: { vars: string[] };
        results: { bindings: Array<Record<string, { value: string }>> };
      };
      const vars = parsed.head.vars;
      liveRows = parsed.results.bindings
        .map((b) => vars.map((v) => `${v}=${b[v]?.value ?? ""}`).join(" | "))
        .sort();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(
        `question "${q.id}": could not serialize result rows for the answer-set pin: ${message}`,
      );
    }
    if (liveRows !== undefined) {
      const pinnedSorted = [...pinnedRows].sort();
      const same =
        liveRows.length === pinnedSorted.length &&
        liveRows.every((r, i) => r === pinnedSorted[i]);
      if (!same) {
        // Multiset diff so duplicate rows are counted correctly.
        const counts = new Map<string, number>();
        for (const r of pinnedSorted) counts.set(r, (counts.get(r) ?? 0) + 1);
        const added: string[] = [];
        for (const r of liveRows) {
          const n = counts.get(r) ?? 0;
          if (n > 0) counts.set(r, n - 1);
          else added.push(r);
        }
        const removed: string[] = [];
        for (const [r, n] of counts) for (let i = 0; i < n; i++) removed.push(r);
        errors.push(
          `question "${q.id}" answer set drifted (count unchanged at ${live} but the values differ):` +
            (removed.length > 0
              ? ` removed [${removed.join("; ")}]`
              : "") +
            (added.length > 0 ? ` added [${added.join("; ")}]` : "") +
            `; if the curation change is deliberate, update EXPECTED_ANSWER_ROWS in competency-answer-pins.ts`,
        );
      }
    }
  }

  // Column pin: the projected variable list (SPARQL JSON head.vars, the
  // same list the /api/competency route serves as `variables` and the
  // Query Results table renders as headers) must match the pin exactly,
  // including order. A rename, drop, addition, or reorder changes the
  // table's headers while every row-count pin stays green.
  const pinnedColumns = EXPECTED_COLUMNS[q.id];
  if (pinnedColumns !== undefined) {
    let liveColumns: string[] | undefined;
    try {
      const rawJson = String(
        store.query(q.sparqlFn(LOD_BASE, ONT), { results_format: "json" }),
      );
      const parsed = JSON.parse(rawJson) as { head?: { vars?: string[] } };
      liveColumns = parsed.head?.vars;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(
        `question "${q.id}": could not read projected variables (head.vars) for the column pin: ${message}`,
      );
    }
    if (liveColumns !== undefined) {
      if (liveColumns.length === 0) {
        errors.push(
          `question "${q.id}" projects no variables (head.vars is empty); the Query Results table would render with no columns`,
        );
      } else if (
        liveColumns.length !== pinnedColumns.length ||
        liveColumns.some((v, i) => v !== pinnedColumns[i])
      ) {
        const pinnedSet = new Set(pinnedColumns);
        const liveSet = new Set(liveColumns);
        const removed = pinnedColumns.filter((v) => !liveSet.has(v));
        const added = liveColumns.filter((v) => !pinnedSet.has(v));
        const detail =
          removed.length === 0 && added.length === 0
            ? "same variables in a different order"
            : [
                removed.length > 0
                  ? `missing column(s): ?${removed.join(", ?")}`
                  : "",
                added.length > 0
                  ? `unexpected column(s): ?${added.join(", ?")}`
                  : "",
              ]
                .filter(Boolean)
                .join("; ");
        errors.push(
          `question "${q.id}" columns drifted: pinned [?${pinnedColumns.join(", ?")}] but live [?${liveColumns.join(", ?")}] (${detail}); the Query Results table headers changed, update EXPECTED_COLUMNS if the query edit is deliberate`,
        );
      }
    }
  }

  // Every row must bind every projected variable with a non-empty value.
  // A query edit that makes a projected variable OPTIONAL (or a join
  // that stops binding it in some rows) keeps head.vars and the row
  // count intact while whole cells in the Query Results table render
  // empty. SPARQL JSON omits unbound variables from a row's binding
  // map, so read the JSON form and check each projected variable is
  // present and non-empty in every row. Failure names the question,
  // the variable, and the (0-based, sorted-order-independent: query
  // output order) row index.
  try {
    const rawJson = String(
      store.query(q.sparqlFn(LOD_BASE, ONT), { results_format: "json" }),
    );
    const parsed = JSON.parse(rawJson) as {
      head: { vars: string[] };
      results: { bindings: Array<Record<string, { value: string }>> };
    };
    const vars = parsed.head.vars;
    // Duplicate-row pin: no question's serialized rows may contain exact
    // duplicates (unless whitelisted in ALLOWED_DUPLICATE_ROWS). A query
    // edit that drops a DISTINCT or duplicates a join path serves the
    // same row twice while the row-count pin is simply updated to match
    // the new number; only this check catches the repetition itself.
    {
      const allowed = ALLOWED_DUPLICATE_ROWS[q.id] ?? {};
      const rowCounts = new Map<string, number>();
      for (const row of parsed.results.bindings) {
        const serialized = vars
          .map((v) => `${v}=${row[v]?.value ?? ""}`)
          .join(" | ");
        rowCounts.set(serialized, (rowCounts.get(serialized) ?? 0) + 1);
      }
      for (const [serialized, n] of rowCounts) {
        if (n > 1 && !(serialized in allowed)) {
          errors.push(
            `question "${q.id}" serves a duplicate result row ${n} times: [${serialized}]; the Query Results table would show the same line repeatedly (did a query edit drop a DISTINCT or duplicate a join path?); if the duplicate is deliberate, whitelist it with its expected multiplicity in ALLOWED_DUPLICATE_ROWS`,
          );
        }
      }
      // The whitelist must stay honest: a nonsense pin (< 2), a stale
      // entry that no longer duplicates, or a live multiplicity that
      // drifted away from the pin (especially above it — a legitimate
      // 2x row must not quietly become 3x) all fail.
      for (const [serialized, pinnedN] of Object.entries(allowed)) {
        const liveN = rowCounts.get(serialized) ?? 0;
        if (!Number.isInteger(pinnedN) || pinnedN < 2) {
          errors.push(
            `question "${q.id}": ALLOWED_DUPLICATE_ROWS pins [${serialized}] at ${pinnedN}, which is not a duplicate multiplicity (must be an integer >= 2); fix or remove the entry`,
          );
        } else if (liveN <= 1) {
          errors.push(
            `question "${q.id}": ALLOWED_DUPLICATE_ROWS whitelists [${serialized}] (pinned ${pinnedN}x) but the live results no longer duplicate that row (live ${liveN}x); remove the stale whitelist entry`,
          );
        } else if (liveN > pinnedN) {
          errors.push(
            `question "${q.id}" duplicate row [${serialized}] duplicates more than its whitelist allows: pinned ${pinnedN}x but live ${liveN}x (did a join edit multiply the row further?); if the extra duplication is deliberate, update the pinned multiplicity in ALLOWED_DUPLICATE_ROWS`,
          );
        } else if (liveN < pinnedN) {
          errors.push(
            `question "${q.id}" duplicate row [${serialized}] drifted below its whitelist pin: pinned ${pinnedN}x but live ${liveN}x; update the pinned multiplicity in ALLOWED_DUPLICATE_ROWS if the change is deliberate`,
          );
        }
      }
    }

    parsed.results.bindings.forEach((row, rowIndex) => {
      for (const v of vars) {
        const cell = row[v];
        if (cell === undefined) {
          errors.push(
            `question "${q.id}" row ${rowIndex} leaves ?${v} unbound; the Query Results table would render a blank cell (did a query edit make ?${v} OPTIONAL or break its join?)`,
          );
        } else if (cell.value.trim() === "") {
          errors.push(
            `question "${q.id}" row ${rowIndex} binds ?${v} to an empty string; the Query Results table would render a blank cell`,
          );
        }
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(
      `question "${q.id}": could not check per-row variable bindings: ${message}`,
    );
  }

  // No cell in any question's results may be URI-shaped: a named node,
  // or a literal that itself looks like an http(s) IRI. The Query
  // Results table renders values verbatim.
  for (const row of bindings as Array<Map<string, { termType: string; value: string }>>) {
    for (const [variable, term] of row) {
      if (!term) continue;
      const uriShaped =
        term.termType === "NamedNode" || /^https?:\/\/\S+$/.test(term.value);
      if (uriShaped) {
        errors.push(
          `question "${q.id}" binds a URI-shaped value in ?${variable}: "${term.value}" (${term.termType}); project the rdfs:label instead so the results table stays readable`,
        );
      }
    }
  }
}

// Coverage pin for school-doctrines: every lo:School carrying
// lo:principalDoctrine must survive the label join. If a doctrine node
// ships without an @en rdfs:label (or a school loses its @en label),
// its row silently disappears from the results table.
{
  const q = COMPETENCY_QUESTIONS.find(
    (question) => question.id === "school-doctrines",
  );
  if (!q) {
    errors.push(
      `question "school-doctrines" no longer exists; the school-coverage pin has nothing to guard`,
    );
  } else {
    const schoolRows = store.query(
      `PREFIX lo: <${ONT}>\nSELECT DISTINCT ?s WHERE { ?s a lo:School ; lo:principalDoctrine ?d . }`,
    ) as Array<Map<string, { value: string }>>;
    const doctrineRows = store.query(
      q.sparqlFn(LOD_BASE, ONT),
    ) as Array<Map<string, { value: string }>>;
    // The question SELECTs one row per (school, doctrine) pair; compare
    // pair counts so a school with two doctrines cannot mask a dropped one.
    const pairRows = store.query(
      `PREFIX lo: <${ONT}>\nSELECT ?s ?d WHERE { ?s a lo:School ; lo:principalDoctrine ?d . }`,
    ) as Array<Map<string, { value: string }>>;
    if (doctrineRows.length !== pairRows.length) {
      // Name the schools that fell out of the label join.
      const surviving = store.query(
        `PREFIX lo: <${ONT}>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\nSELECT DISTINCT ?s WHERE { ?s a lo:School ; rdfs:label ?school ; lo:principalDoctrine ?d . ?d rdfs:label ?doctrine . FILTER(lang(?school) = "en") FILTER(lang(?doctrine) = "en") }`,
      ) as Array<Map<string, { value: string }>>;
      const survivingSet = new Set(
        surviving.map((row) => row.get("s")?.value ?? ""),
      );
      const dropped = schoolRows
        .map((row) => row.get("s")?.value ?? "")
        .filter((uri) => uri && !survivingSet.has(uri));
      errors.push(
        `school-doctrines dropped rows in the label join: ${pairRows.length} school/doctrine pairs in the graph but the question returns ${doctrineRows.length} rows` +
          (dropped.length > 0
            ? `; schools missing from the results table: ${dropped.join(", ")} (a doctrine or school node lost its @en rdfs:label)`
            : "; a school or doctrine node lost its @en rdfs:label"),
      );
    } else if (pairRows.length === 0) {
      errors.push(
        `school-doctrines coverage pin is vacuous: no lo:School carries lo:principalDoctrine in the live graph`,
      );
    } else {
      summaries.push(
        `school-doctrines covers all ${pairRows.length} school/doctrine pairs (${schoolRows.length} schools)`,
      );
    }

    // Exact pairing pin: which school shows which doctrine text. A
    // curation edit that swaps a school's principalDoctrine target or
    // rewords a doctrine label keeps the counts and label shapes intact,
    // so only this comparison catches it.
    const liveBySchool = new Map<string, string[]>();
    for (const row of doctrineRows) {
      const school = row.get("school")?.value;
      const doctrine = row.get("doctrine")?.value;
      if (school === undefined || doctrine === undefined) {
        errors.push(
          `school-doctrines returned a row without ?school/?doctrine bindings; the pairing pin needs both variables projected`,
        );
        continue;
      }
      const list = liveBySchool.get(school) ?? [];
      list.push(doctrine);
      liveBySchool.set(school, list);
    }
    for (const [school, pinned] of Object.entries(EXPECTED_SCHOOL_DOCTRINES)) {
      const live = liveBySchool.get(school);
      if (!live) {
        errors.push(
          `school-doctrines pairing drifted: pinned school "${school}" is missing from the live results (pinned doctrine: "${pinned}")`,
        );
      } else if (!live.includes(pinned)) {
        errors.push(
          `school-doctrines pairing drifted for "${school}": pinned doctrine "${pinned}" but live doctrine "${live.join('" / "')}"; if the curation change is deliberate, update EXPECTED_SCHOOL_DOCTRINES`,
        );
      }
    }
    for (const [school, live] of liveBySchool) {
      if (!(school in EXPECTED_SCHOOL_DOCTRINES)) {
        errors.push(
          `school-doctrines pairing has an unpinned school "${school}" (live doctrine: "${live.join('" / "')}"); add it to EXPECTED_SCHOOL_DOCTRINES`,
        );
      } else if (live.length > 1) {
        errors.push(
          `school-doctrines shows ${live.length} doctrine rows for "${school}" ("${live.join('" / "')}"); the pairing pin expects one doctrine per school, extend EXPECTED_SCHOOL_DOCTRINES if a second doctrine is deliberate`,
        );
      }
    }
    if (
      errors.length === 0 ||
      !errors.some((e) => e.startsWith("school-doctrines pairing"))
    ) {
      summaries.push(
        `school-doctrines pairs match all ${Object.keys(EXPECTED_SCHOOL_DOCTRINES).length} pinned doctrines`,
      );
    }
  }
}

// Greek-form pin: the /competency page's Entities card shows each
// philosopher answer with a Greek form built by a SEPARATE assembly in
// routes/competency.ts (KG-node row values -> greekNameSpec(name)?.grc),
// which none of the pins above see: a drifted or deleted curated Greek
// form keeps every row count, column, and answer-set pin green while
// the card's Greek text silently changes. Re-derive the terms-payload
// Greek form for every philosopher name appearing in a pinned answer
// row (a row value that is a knowledge-graph node, exactly the route's
// philosopher-term criterion) and compare it against
// EXPECTED_GREEK_FORMS in competency-answer-pins.ts. Failure names the
// question, the name, and the drifted or missing Greek form.
{
  const kgNodeNames = new Set(getKnowledgeGraph().nodes.map((n) => n.name));
  const seenPinnedNames = new Set<string>();
  let checkedNames = 0;
  for (const [qid, rows] of Object.entries(EXPECTED_ANSWER_ROWS)) {
    const reportedHere = new Set<string>();
    for (const row of rows) {
      for (const seg of row.split(" | ")) {
        const eq = seg.indexOf("=");
        if (eq < 0) continue;
        const val = seg.slice(eq + 1);
        if (!kgNodeNames.has(val) || reportedHere.has(val)) continue;
        reportedHere.add(val);
        seenPinnedNames.add(val);
        checkedNames++;
        const liveGrc = greekNameSpec(val)?.grc;
        const pinnedGrc = EXPECTED_GREEK_FORMS[val];
        if (pinnedGrc === undefined) {
          errors.push(
            `question "${qid}": philosopher answer "${val}" has no pinned Greek form; add it to EXPECTED_GREEK_FORMS in competency-answer-pins.ts (live form: ${liveGrc === undefined ? "none" : `"${liveGrc}"`})`,
          );
        } else if (liveGrc === undefined) {
          errors.push(
            `question "${qid}": philosopher answer "${val}" lost its Greek form (pinned "${pinnedGrc}", but greekNameSpec now returns none); the Entities card would ship this answer without its Greek name`,
          );
        } else if (liveGrc !== pinnedGrc) {
          errors.push(
            `question "${qid}": philosopher answer "${val}" Greek form drifted: pinned "${pinnedGrc}" but live "${liveGrc}"; the Entities card's Greek text changed — if the curation change is deliberate, update EXPECTED_GREEK_FORMS in competency-answer-pins.ts`,
          );
        }
      }
    }
  }
  // Positive controls: the pin table and the pinned answer rows must
  // cover each other, and the check must actually have matched names.
  for (const name of Object.keys(EXPECTED_GREEK_FORMS)) {
    if (!seenPinnedNames.has(name)) {
      errors.push(
        `EXPECTED_GREEK_FORMS pins "${name}" but no pinned answer row contains it as a knowledge-graph node value (renamed or removed answer?); remove or update the entry`,
      );
    }
  }
  if (checkedNames === 0) {
    errors.push(
      `Greek-form pin is vacuous: no pinned answer row value matched a knowledge-graph node name; the terms-payload check matched nothing (did KG node names or the row serialization change?)`,
    );
  } else {
    summaries.push(
      `Greek forms stable for ${seenPinnedNames.size} pinned philosopher answers`,
    );
  }
}

// Extra-term Greek-form pin: the /competency terms payload also ships
// Greek forms for pinned answer-row values that are NOT knowledge-graph
// nodes — homonym bearers ("Zeno of Tarsus"), places, and work titles —
// via the extraTerms classifier in routes/competency.ts
// (greekNameSpec for person/place, greekWorkTitleSpec for work). None of
// the pins above see that payload, so a drifted or deleted curated form
// for those chips would still ship silently. Re-run the route's
// classification over every pinned answer-row value and compare each
// classified person/place/work term's live Greek form against
// EXPECTED_EXTRA_TERM_GREEK_FORMS (grc: null pins a deliberately
// formless term). Failure names the question, the term, its type, and
// the drifted or missing Greek form.
{
  const kgNodeNames = new Set(getKnowledgeGraph().nodes.map((n) => n.name));
  const movementLabels = new Set(MOVEMENTS.map((m) => m.label));
  const placeNames = new Set(Object.keys(PLACE_TYPES));
  const workTitles = new Set(Object.keys(WORK_FACETS));
  const GREEK_SCRIPT = /[\u0370-\u03FF\u1F00-\u1FFF]/;
  const URI_SHAPED = /^https?:\/\//i;

  // Mirror of isPersonLabel in routes/competency.ts: does a person-typed
  // LOD node bear this @en label? Catches person terms whose name is
  // deliberately formless (no greekNameSpec entry).
  const isPersonLabel = (label: string): boolean => {
    const lit = label.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const rawJson = String(
      store.query(
        `ASK { ?s <http://www.w3.org/2000/01/rdf-schema#label> "${lit}"@en ; a ?t . FILTER(?t IN (<${ONT}Person>, <${ONT}Philosopher>, <${ONT}Sage>, <${ONT}Source>)) }`,
        { results_format: "json" },
      ),
    );
    return (JSON.parse(rawJson) as { boolean?: boolean }).boolean === true;
  };

  const hintsByQid = new Map(
    COMPETENCY_QUESTIONS.map((q) => [q.id, q.personTermHints]),
  );
  const seenPinnedTerms = new Set<string>();
  let checkedTerms = 0;
  for (const [qid, rows] of Object.entries(EXPECTED_ANSWER_ROWS)) {
    const personHints = hintsByQid.get(qid);
    const reportedHere = new Set<string>();
    for (const row of rows) {
      for (const seg of row.split(" | ")) {
        const eq = seg.indexOf("=");
        if (eq < 0) continue;
        const val = seg.slice(eq + 1);
        if (
          !val ||
          kgNodeNames.has(val) ||
          reportedHere.has(val) ||
          URI_SHAPED.test(val) ||
          GREEK_SCRIPT.test(val) ||
          movementLabels.has(val)
        )
          continue;
        reportedHere.add(val);

        // Same classification order as routes/competency.ts extraTerms:
        // per-question person hint first (personTermHints — the person
        // sense wins over a colliding place/work name when the label
        // verifies as a person), then place, then work, then person;
        // anything else is a doctrine chip and carries no Greek form.
        let type: "person" | "place" | "work" | undefined;
        let liveGrc: string | undefined;
        if (
          personHints?.includes(val) &&
          (greekNameSpec(val) || isPersonLabel(val))
        ) {
          type = "person";
          liveGrc = greekNameSpec(val)?.grc;
        } else if (placeNames.has(val)) {
          type = "place";
          liveGrc = greekNameSpec(val)?.grc;
        } else if (workTitles.has(val)) {
          type = "work";
          liveGrc = greekWorkTitleSpec(val)?.grc;
        } else if (greekNameSpec(val) || isPersonLabel(val)) {
          type = "person";
          liveGrc = greekNameSpec(val)?.grc;
        }
        if (type === undefined) continue;

        seenPinnedTerms.add(val);
        checkedTerms++;
        const pinned = EXPECTED_EXTRA_TERM_GREEK_FORMS[val];
        if (pinned === undefined) {
          errors.push(
            `question "${qid}": ${type} term "${val}" has no pinned Greek form; add it to EXPECTED_EXTRA_TERM_GREEK_FORMS in competency-answer-pins.ts (live form: ${liveGrc === undefined ? "none" : `"${liveGrc}"`})`,
          );
          continue;
        }
        if (pinned.type !== type) {
          errors.push(
            `question "${qid}": term "${val}" is pinned as a ${pinned.type} term but now classifies as a ${type} term; update EXPECTED_EXTRA_TERM_GREEK_FORMS if the ontology change is deliberate`,
          );
        }
        if (pinned.grc === null) {
          if (liveGrc !== undefined) {
            errors.push(
              `question "${qid}": ${type} term "${val}" was pinned without a Greek form but now has one ("${liveGrc}"); if the new curated form is deliberate, update EXPECTED_EXTRA_TERM_GREEK_FORMS in competency-answer-pins.ts`,
            );
          }
        } else if (liveGrc === undefined) {
          errors.push(
            `question "${qid}": ${type} term "${val}" lost its Greek form (pinned "${pinned.grc}", but the live spec now returns none); the Entities card would ship this chip without its Greek form`,
          );
        } else if (liveGrc !== pinned.grc) {
          errors.push(
            `question "${qid}": ${type} term "${val}" Greek form drifted: pinned "${pinned.grc}" but live "${liveGrc}"; the Entities card's Greek text changed — if the curation change is deliberate, update EXPECTED_EXTRA_TERM_GREEK_FORMS in competency-answer-pins.ts`,
          );
        }
      }
    }
  }
  // Positive controls: every pin must still be reachable from a pinned
  // answer row, and the check must actually have matched terms.
  for (const name of Object.keys(EXPECTED_EXTRA_TERM_GREEK_FORMS)) {
    if (!seenPinnedTerms.has(name)) {
      errors.push(
        `EXPECTED_EXTRA_TERM_GREEK_FORMS pins "${name}" but no pinned answer row classifies it as an extra person/place/work term (renamed or removed answer, or it became a KG node?); remove or update the entry`,
      );
    }
  }
  if (checkedTerms === 0) {
    errors.push(
      `extra-term Greek-form pin is vacuous: no pinned answer row value classified as an extra person/place/work term (did the classification sets or the row serialization change?)`,
    );
  } else {
    summaries.push(
      `Greek forms stable for ${seenPinnedTerms.size} pinned extra person/place/work terms`,
    );
  }
}

// School Greek-form pin: the /competency page's Entities card also
// shows a chip for every school reachable from a question — the
// movements of the question's seed-subgraph nodes (schoolTerms in
// routes/competency.ts: seedLabels plus KG-node row values -> node
// movement -> greekSchoolGrc(m.label)) and any answer-row value that
// classifies as a movement label (the extraTerms "school" branch, also
// greekSchoolGrc). None of the pins above see those payloads: a
// drifted or deleted entry in GREEK_SCHOOL_NAMES (greek-names.ts)
// would silently change or drop a school chip's Greek sect name while
// every other pin stays green. Re-derive the reachable school labels
// from the pinned answer rows and the live seed subgraphs, and compare
// each label's live greekSchoolGrc form against
// EXPECTED_SCHOOL_GREEK_FORMS in competency-answer-pins.ts (grc: null
// pins a deliberately English-only school chip, e.g. Unaffiliated).
// Failure names the question, the school label, and the drifted or
// missing Greek form.
{
  const graph = getKnowledgeGraph();
  const nodesByName = new Map(graph.nodes.map((n) => [n.name, n]));
  const movementById = new Map(MOVEMENTS.map((m) => [m.id, m]));
  const movementLabels = new Set(MOVEMENTS.map((m) => m.label));
  const seenSchoolLabels = new Set<string>();
  let checkedSchools = 0;

  for (const q of COMPETENCY_QUESTIONS) {
    const rows = EXPECTED_ANSWER_ROWS[q.id] ?? [];

    // School labels this question's Entities card can ship: movements
    // of the seed subgraph (seed labels + KG-node answer values), plus
    // answer values that classify as movement labels directly.
    const labels = new Set<string>();
    const subgraphNames = new Set<string>(q.seedLabels);
    for (const row of rows) {
      for (const seg of row.split(" | ")) {
        const eq = seg.indexOf("=");
        if (eq < 0) continue;
        const val = seg.slice(eq + 1);
        if (nodesByName.has(val)) subgraphNames.add(val);
        else if (movementLabels.has(val)) labels.add(val);
      }
    }
    for (const name of subgraphNames) {
      const node = nodesByName.get(name);
      if (!node) continue;
      const movement = movementById.get(node.movement);
      if (movement) labels.add(movement.label);
    }

    for (const label of labels) {
      seenSchoolLabels.add(label);
      checkedSchools++;
      const liveGrc = greekSchoolGrc(label);
      const pinned = EXPECTED_SCHOOL_GREEK_FORMS[label];
      if (pinned === undefined) {
        errors.push(
          `question "${q.id}": school chip "${label}" has no pinned Greek sect name; add it to EXPECTED_SCHOOL_GREEK_FORMS in competency-answer-pins.ts (live form: ${liveGrc === undefined ? "none" : `"${liveGrc}"`})`,
        );
      } else if (pinned === null) {
        if (liveGrc !== undefined) {
          errors.push(
            `question "${q.id}": school chip "${label}" was pinned as deliberately English-only but GREEK_SCHOOL_NAMES now curates a form ("${liveGrc}"); if the new curated form is deliberate, update EXPECTED_SCHOOL_GREEK_FORMS in competency-answer-pins.ts`,
          );
        }
      } else if (liveGrc === undefined) {
        errors.push(
          `question "${q.id}": school chip "${label}" lost its Greek sect name (pinned "${pinned}", but GREEK_SCHOOL_NAMES no longer has an entry); the Entities card would ship this school chip English-only`,
        );
      } else if (liveGrc !== pinned) {
        errors.push(
          `question "${q.id}": school chip "${label}" Greek sect name drifted: pinned "${pinned}" but live "${liveGrc}"; the Entities card's Greek text changed — if the curation change is deliberate, update EXPECTED_SCHOOL_GREEK_FORMS in competency-answer-pins.ts`,
        );
      }
    }
  }

  // Positive controls: no stale pins (every pinned label must still be
  // reachable from some question), and the check must actually have
  // matched school labels, or it passed vacuously.
  for (const label of Object.keys(EXPECTED_SCHOOL_GREEK_FORMS)) {
    if (!seenSchoolLabels.has(label)) {
      errors.push(
        `EXPECTED_SCHOOL_GREEK_FORMS pins "${label}" but no question's seed subgraph or pinned answer row reaches that school anymore (renamed movement, removed seed, or removed answer?); remove or update the entry in competency-answer-pins.ts`,
      );
    }
  }
  if (checkedSchools === 0) {
    errors.push(
      `school Greek-form pin is vacuous: no question reached any school label (did MOVEMENTS labels, seedLabels, or the row serialization change?)`,
    );
  } else {
    summaries.push(
      `Greek sect names stable for ${seenSchoolLabels.size} reachable school chips`,
    );
  }
}

// Term-type pin: the Entities card buckets each pinned answer-row value
// that is not a philosopher KG node into a school/place/work/person/
// doctrine chip via classifyExtraTerm (routes/competency.ts). Re-run
// the exact same classification against the live lookup tables and
// compare each resulting label's type to EXPECTED_TERM_TYPES in
// competency-answer-pins.ts. A curation change (a name added to
// PLACE_TYPES, a person losing its LOD typing) could silently rebucket
// a chip while every pin above stays green; failure names the
// question, the value, and the pinned vs live type.
{
  const kgNodeNames = new Set(getKnowledgeGraph().nodes.map((n) => n.name));
  const hintsByQid = new Map(
    COMPETENCY_QUESTIONS.map((q) => [q.id, q.personTermHints]),
  );
  const seenPinnedLabels = new Set<string>();
  let checkedValues = 0;
  for (const [qid, rows] of Object.entries(EXPECTED_ANSWER_ROWS)) {
    const personHints = hintsByQid.get(qid);
    const reportedHere = new Set<string>();
    for (const row of rows) {
      for (const seg of row.split(" | ")) {
        const eq = seg.indexOf("=");
        if (eq < 0) continue;
        const val = seg.slice(eq + 1);
        if (!val || kgNodeNames.has(val) || reportedHere.has(val)) continue;
        reportedHere.add(val);
        const classified = classifyExtraTerm(store, val, personHints);
        // null = the value never ships as a chip (Greek-script proper-name
        // form, or an unresolvable URI-shaped value); nothing to pin
        if (!classified) continue;
        checkedValues++;
        seenPinnedLabels.add(classified.label);
        const pinnedType = EXPECTED_TERM_TYPES[classified.label];
        if (pinnedType === undefined) {
          errors.push(
            `question "${qid}": answer value "${classified.label}" reaches the Entities-card classifier with no pinned term type (live type: "${classified.type}"); add it to EXPECTED_TERM_TYPES in competency-answer-pins.ts`,
          );
        } else if (pinnedType !== classified.type) {
          errors.push(
            `question "${qid}": answer chip "${classified.label}" silently switched category: pinned type "${pinnedType}" but live type "${classified.type}"; the Entities card would rebucket this chip — if the curation change is deliberate, update EXPECTED_TERM_TYPES in competency-answer-pins.ts`,
          );
        }
      }
    }
  }
  // Positive controls: no stale pins, and the check must have matched
  // values, or a serialization/classifier change made it vacuous.
  for (const label of Object.keys(EXPECTED_TERM_TYPES)) {
    if (!seenPinnedLabels.has(label)) {
      errors.push(
        `EXPECTED_TERM_TYPES pins "${label}" but no pinned answer row value classifies to that label anymore (renamed or removed answer?); remove or update the entry in competency-answer-pins.ts`,
      );
    }
  }
  if (checkedValues === 0) {
    errors.push(
      `term-type pin is vacuous: no pinned answer row value reached the Entities-card classifier (did the row serialization or classifyExtraTerm change?)`,
    );
  } else {
    summaries.push(
      `term types stable for ${seenPinnedLabels.size} pinned answer chips`,
    );
  }
}

// Lookup-table disjointness: classifyExtraTerm buckets a value by
// consulting its source tables in a fixed precedence order — movement
// labels, then PLACE_TYPES, then WORK_FACETS, then the person checks.
// If a curation edit lands the same name in two tables (a work title
// that is also a place name, a new movement named after a landmark),
// the earlier table silently wins and the chip rebuckets without any
// pin noticing unless that exact value happens to appear in a pinned
// answer row. Assert the tables are pairwise disjoint, naming each
// colliding name and the two tables it sits in. The person side is the
// set of LOD person-typed @en labels (lo:Person/Philosopher/Sage/
// Source — exactly what isPersonLabel matches), minus KG node names,
// which the route filters out before the classifier ever runs.
// GREEK_NAMES is deliberately NOT treated as a person table here: it
// is the shared bilingual-forms table and curates Greek forms for
// places and work-title namesakes too, so its keys overlap the earlier
// tables by design; the LOD typing is the authoritative person signal.
//
// Known deliberate collisions are whitelisted below with the table
// that wins by precedence; each entry is stale-checked, so a resolved
// collision must be removed from the whitelist.
{
  const kgNodeNames = new Set(getKnowledgeGraph().nodes.map((n) => n.name));
  const rawPersons = String(
    store.query(
      `SELECT DISTINCT ?l WHERE { ?s <http://www.w3.org/2000/01/rdf-schema#label> ?l ; a ?t .
         FILTER(?t IN (<${ONT}Person>, <${ONT}Philosopher>, <${ONT}Sage>, <${ONT}Source>))
         FILTER(lang(?l) = "en") }`,
      { results_format: "json" },
    ),
  );
  const personLabels = new Set(
    (
      JSON.parse(rawPersons) as {
        results: { bindings: Array<{ l?: { value: string } }> };
      }
    ).results.bindings
      .map((b) => b.l?.value ?? "")
      .filter((l) => l !== "" && !kgNodeNames.has(l)),
  );
  // Positive control: an empty person set means the SPARQL above no
  // longer matches the graph's typing and the person-side checks below
  // would pass vacuously.
  if (personLabels.size === 0) {
    errors.push(
      `table-disjointness check is vacuous: the LOD person-label query matched zero non-KG person labels (did the ontology's person typing or namespace change?)`,
    );
  }

  // In classifier precedence order; the earlier table wins a collision.
  const tables: Array<[string, ReadonlySet<string>]> = [
    ["movement labels (MOVEMENTS in kg.ts)", new Set(MOVEMENTS.map((m) => m.label))],
    ["PLACE_TYPES (place-ontology.ts)", new Set(Object.keys(PLACE_TYPES))],
    ["WORK_FACETS (work-ontology.ts)", new Set(Object.keys(WORK_FACETS))],
    ["LOD person labels (isPersonLabel typing)", personLabels],
  ];

  // name -> [winning table index, losing table index] plus the reason
  // the collision is deliberate. As of July 2026:
  const ALLOWED_TABLE_COLLISIONS: Record<
    string,
    { tables: [number, number]; reason: string }
  > = {
    Academy: {
      tables: [0, 1],
      reason:
        "the Academy school and the Academy landmark share the name; school precedence deliberately wins, the gymnasium chip never ships from the classifier",
    },
    Croton: {
      tables: [1, 3],
      reason:
        "the city of Croton and the person Croton (Pythagoras' homonym roster) share the name; place precedence wins by default, and the homonymy question's personTermHints flips it to a person chip where the rows denote the person",
    },
    Telauges: {
      tables: [2, 3],
      reason:
        "the dialogue title Telauges and the person Telauges (Pythagoras' son) share the name; work precedence wins by default, and the homonymy question's personTermHints flips it to a person chip where the rows denote the person",
    },
  };

  const seenAllowed = new Set<string>();
  let collisionPairsChecked = 0;
  for (let i = 0; i < tables.length; i++) {
    for (let j = i + 1; j < tables.length; j++) {
      collisionPairsChecked++;
      const [nameA, a] = tables[i]!;
      const [nameB, b] = tables[j]!;
      for (const name of a) {
        if (!b.has(name)) continue;
        const allowed = ALLOWED_TABLE_COLLISIONS[name];
        if (allowed && allowed.tables[0] === i && allowed.tables[1] === j) {
          seenAllowed.add(name);
          continue;
        }
        errors.push(
          `classifier lookup-table collision: "${name}" appears in both ${nameA} and ${nameB}; classifyExtraTerm's precedence makes ${nameA} silently win, so the chip would never bucket as the later category — remove the name from one table, or whitelist the collision with a reason in ALLOWED_TABLE_COLLISIONS`,
        );
      }
    }
  }
  // Stale-whitelist control: every whitelisted collision must still
  // exist in exactly the two tables it names.
  for (const [name, allowed] of Object.entries(ALLOWED_TABLE_COLLISIONS)) {
    if (seenAllowed.has(name)) continue;
    const [i, j] = allowed.tables;
    errors.push(
      `ALLOWED_TABLE_COLLISIONS whitelists "${name}" as a ${tables[i]?.[0] ?? `#${i}`} × ${tables[j]?.[0] ?? `#${j}`} collision, but the name no longer appears in both tables; remove the stale whitelist entry`,
    );
  }
  // Hint-honesty control: every personTermHints entry on a question must
  // (a) verify as a person (curated Greek name or LOD person typing) —
  // an unverifiable hint is silently ignored by classifyExtraTerm, so
  // the chip would still ship as place/work; (b) actually appear in that
  // question's pinned answer rows — otherwise the hint is stale; and
  // (c) actually be shadowed by an earlier classifier table — otherwise
  // the hint is redundant and should be removed.
  const earlierTables = tables.slice(0, 3);
  for (const q of COMPETENCY_QUESTIONS) {
    for (const hint of q.personTermHints ?? []) {
      if (!greekNameSpec(hint) && !personLabels.has(hint)) {
        errors.push(
          `question "${q.id}" hints "${hint}" as a person term, but the label no longer verifies as a person (no curated Greek name and no LOD person typing); the hint is dead and the chip would still ship as a place/work chip — fix the curation or remove the hint`,
        );
      }
      const rows = EXPECTED_ANSWER_ROWS[q.id] ?? [];
      if (!rows.some((r) => r.split(" | ").some((seg) => seg.slice(seg.indexOf("=") + 1) === hint))) {
        errors.push(
          `question "${q.id}" hints "${hint}" as a person term, but the value no longer appears in the question's pinned answer rows; remove the stale personTermHints entry`,
        );
      }
      if (!earlierTables.some(([, t]) => t.has(hint))) {
        errors.push(
          `question "${q.id}" hints "${hint}" as a person term, but the label is not shadowed by any earlier classifier table (movements, PLACE_TYPES, WORK_FACETS); the hint is redundant — remove it`,
        );
      }
    }
  }

  if (collisionPairsChecked !== 6) {
    errors.push(
      `table-disjointness check compared ${collisionPairsChecked} table pairs, expected 6 (four classifier tables pairwise); did a table get dropped from the check?`,
    );
  } else {
    summaries.push(
      `classifier tables pairwise disjoint (${seenAllowed.size} whitelisted collisions)`,
    );
  }
}

// Dropped-seed Greek-form pin: the /competency Entities card also shows
// each question's "dropped seeds" — curated anchors without a Life
// chapter (KNOWN_DROPPED_SEEDS / getDroppedSeeds in lib/competency.ts),
// shipped by routes/competency.ts as { en: name, grc:
// greekNameSpec(name)?.grc }. Those names have no KG node and no answer
// row, so none of the pins above see that payload: a drifted or deleted
// GREEK_NAMES entry for a dropped seed would silently change or drop
// its Greek form while every existing pin stays green. Re-derive each
// dropped seed's live Greek form and compare it against
// EXPECTED_DROPPED_SEED_GREEK_FORMS in competency-answer-pins.ts
// (grc: null pins a deliberately formless seed). Failure names the
// question, the seed name, and the drifted or missing Greek form.
{
  const seenPins = new Set<string>(); // "qid\u0000name"
  let checkedSeeds = 0;
  for (const q of COMPETENCY_QUESTIONS) {
    const dropped = getDroppedSeeds(q.id);
    const pinsForQ = EXPECTED_DROPPED_SEED_GREEK_FORMS[q.id];
    for (const name of dropped) {
      checkedSeeds++;
      seenPins.add(`${q.id}\u0000${name}`);
      const liveGrc = greekNameSpec(name)?.grc;
      const pinned = pinsForQ?.[name];
      if (pinned === undefined) {
        errors.push(
          `question "${q.id}": dropped seed "${name}" has no pinned Greek form; add it to EXPECTED_DROPPED_SEED_GREEK_FORMS in competency-answer-pins.ts (live form: ${liveGrc === undefined ? "none" : `"${liveGrc}"`})`,
        );
      } else if (pinned === null) {
        if (liveGrc !== undefined) {
          errors.push(
            `question "${q.id}": dropped seed "${name}" was pinned without a Greek form but greekNameSpec now returns "${liveGrc}"; if the new curated form is deliberate, update EXPECTED_DROPPED_SEED_GREEK_FORMS in competency-answer-pins.ts`,
          );
        }
      } else if (liveGrc === undefined) {
        errors.push(
          `question "${q.id}": dropped seed "${name}" lost its Greek form (pinned "${pinned}", but greekNameSpec now returns none); the Entities card would ship this dropped-seed anchor without its Greek name`,
        );
      } else if (liveGrc !== pinned) {
        errors.push(
          `question "${q.id}": dropped seed "${name}" Greek form drifted: pinned "${pinned}" but live "${liveGrc}"; the Entities card's Greek text changed — if the curation change is deliberate, update EXPECTED_DROPPED_SEED_GREEK_FORMS in competency-answer-pins.ts`,
        );
      }
    }
  }
  // Positive controls: every pinned (question, seed) pair must still be
  // a live dropped seed (stale pins fail loudly), and the sweep must
  // actually have matched seeds, or it passed vacuously.
  for (const [qid, pins] of Object.entries(EXPECTED_DROPPED_SEED_GREEK_FORMS)) {
    if (!liveIds.has(qid)) {
      errors.push(
        `EXPECTED_DROPPED_SEED_GREEK_FORMS pins question "${qid}" but it no longer exists in COMPETENCY_QUESTIONS (renamed or removed?); update the pin table in competency-answer-pins.ts`,
      );
      continue;
    }
    for (const name of Object.keys(pins)) {
      if (!seenPins.has(`${qid}\u0000${name}`)) {
        errors.push(
          `EXPECTED_DROPPED_SEED_GREEK_FORMS pins "${name}" for question "${qid}" but getDroppedSeeds no longer lists it as a dropped seed (curation changed?); remove or update the entry in competency-answer-pins.ts`,
        );
      }
    }
  }
  if (checkedSeeds === 0) {
    errors.push(
      `dropped-seed Greek-form pin is vacuous: getDroppedSeeds returned no seeds for any question (did KNOWN_DROPPED_SEEDS empty out?); if no question legitimately has dropped seeds anymore, remove this pin table deliberately`,
    );
  } else {
    summaries.push(
      `Greek forms stable for ${checkedSeeds} dropped-seed anchors`,
    );
  }
}

if (errors.length > 0) {
  console.error(
    `validate-competency-counts FAILED (${errors.length} problem${errors.length === 1 ? "" : "s"}): a competency question's answer set drifted from its pin`,
  );
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}

console.log(
  `✓ all ${COMPETENCY_QUESTIONS.length} competency questions match their pinned row counts (${summaries.join(", ")})`,
);
