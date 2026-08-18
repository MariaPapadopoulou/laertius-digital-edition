/**
 * Validates the hand-verified Wikidata lexeme links of the OTB terminology:
 *
 *   1. Collects every `wikidata` URI from the term inventory
 *      (artifacts/api-server/src/lib/otb/inventory.ts) and asserts a sane
 *      positive count so a vacuous pass is visible.
 *   2. Fetches all L-ids in batched wbgetentities calls (max 45 ids per
 *      call, descriptive User-Agent per Wikidata curation etiquette).
 *   3. For each lexeme asserts:
 *        - the entity still exists (not deleted),
 *        - the entity was not merged/redirected away from the recorded L-id,
 *        - its lexical language is still Ancient Greek (Q35497),
 *        - its grc lemma still matches the inventory term's name exactly.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-wikidata-lexemes
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { TERMS } = await import("../../artifacts/api-server/src/lib/otb/inventory");

const ANCIENT_GREEK = "Q35497";
const BATCH_SIZE = 45;
const USER_AGENT =
  "LaertiusValidator/1.0 (https://humanisticadigitalia.eu/Laertius; scholarly KG link check)";

/**
 * Terms whose inventory name is intentionally NOT the lexeme's lemma.
 * Wikidata lexemes are lemmatized in the singular; the corpus term for
 * the doxographic genre is the plural. The link is still to the right
 * word, so the validator pins the expected lemma explicitly instead of
 * requiring name equality.
 */
const EXPECTED_LEMMA_OVERRIDES: Record<string, string> = {
  doxai_grc: "\u03B4\u03CC\u03BE\u03B1", // δόξα (term name is the plural δόξαι)
};

let failures = 0;
function check(cond: boolean, msg: string): void {
  if (!cond) {
    failures += 1;
    console.error(`FAIL: ${msg}`);
  }
}

interface Linked {
  lid: string;
  termId: string;
  lemma: string;
}

const linked: Linked[] = [];
for (const t of TERMS) {
  if (!t.wikidata) continue;
  const m = /^https?:\/\/www\.wikidata\.org\/entity\/(L\d+)$/.exec(t.wikidata);
  if (!m || !m[1]) {
    check(false, `term ${t.id}: wikidata URI is not a lexeme entity URI: ${t.wikidata}`);
    continue;
  }
  check(t.lang === "grc", `term ${t.id}: wikidata lexeme link on a non-Greek term`);
  linked.push({ lid: m[1], termId: t.id, lemma: EXPECTED_LEMMA_OVERRIDES[t.id] ?? t.name });
}

// Positive control: the inventory carries a known set of hand-verified links.
check(linked.length >= 20, `expected >=20 wikidata lexeme links in the inventory, got ${linked.length}`);
const dupes = linked.map((l) => l.lid).filter((id, i, a) => a.indexOf(id) !== i);
check(dupes.length === 0, `duplicate L-ids in inventory: ${[...new Set(dupes)].join(", ")}`);

interface WbLexeme {
  id?: string;
  missing?: string;
  type?: string;
  language?: string;
  lemmas?: Record<string, { language: string; value: string }>;
}

/**
 * Failure-path simulation (used by the throttle/block dry run, task docs):
 *   WD_LEXEMES_SIMULATE=429       every request answers HTTP 429
 *   WD_LEXEMES_SIMULATE=403       every request answers HTTP 403
 *   WD_LEXEMES_SIMULATE=maxlag    every request answers a maxlag error payload
 *   WD_LEXEMES_SIMULATE=429-once  first request answers HTTP 429, then real
 *                                 fetches (proves the single retry recovers)
 */
const SIMULATE = process.env["WD_LEXEMES_SIMULATE"];
let simulatedOnce = false;

async function rawFetch(url: string): Promise<Response> {
  if (SIMULATE === "429" || SIMULATE === "403" || (SIMULATE === "429-once" && !simulatedOnce)) {
    simulatedOnce = true;
    const status = SIMULATE === "403" ? 403 : 429;
    return new Response("simulated", {
      status,
      statusText: status === 429 ? "Too Many Requests" : "Forbidden",
      headers: status === 429 ? { "Retry-After": "1" } : {},
    });
  }
  if (SIMULATE === "maxlag") {
    return new Response(
      JSON.stringify({ error: { code: "maxlag", info: "Waiting for a database server: 6 seconds lagged." } }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  return fetch(url, { headers: { "User-Agent": USER_AGENT } });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface WbResponse {
  entities?: Record<string, WbLexeme>;
  error?: { code?: string; info?: string };
}

async function fetchBatch(ids: string[]): Promise<Record<string, WbLexeme>> {
  const url =
    "https://www.wikidata.org/w/api.php?action=wbgetentities&format=json" +
    `&ids=${ids.join("|")}&props=info|lemmas` +
    "&formatversion=2";
  // Wikidata etiquette: retry ONCE with backoff on transient throttling
  // (HTTP 429 or a maxlag error payload); anything else fails immediately.
  for (let attempt = 0; ; attempt += 1) {
    const res = await rawFetch(url);
    if (res.status === 429 && attempt === 0) {
      const retryAfter = Number(res.headers.get("retry-after")) || 5;
      console.error(
        `WARN: wbgetentities HTTP 429 (throttled); retrying once in ${retryAfter}s per Wikidata etiquette`,
      );
      await sleep(retryAfter * 1000);
      continue;
    }
    if (!res.ok) {
      throw new Error(
        `wbgetentities HTTP ${res.status} (${res.statusText}) for batch of ${ids.length} ids` +
        (res.status === 429 ? " — still throttled after one retry" : "") +
        (res.status === 403 ? " — Wikidata is blocking this client (check User-Agent / IP reputation)" : ""),
      );
    }
    const body = (await res.json()) as WbResponse;
    if (body.error?.code === "maxlag" && attempt === 0) {
      console.error(
        `WARN: wbgetentities maxlag (${body.error.info}); retrying once in 5s per Wikidata etiquette`,
      );
      await sleep(5000);
      continue;
    }
    if (body.error) {
      throw new Error(`wbgetentities error: ${body.error.code}: ${body.error.info}`);
    }
    if (!body.entities) throw new Error("wbgetentities returned no entities block");
    return body.entities;
  }
}

const entities: Record<string, WbLexeme> = {};
try {
  for (let i = 0; i < linked.length; i += BATCH_SIZE) {
    const batch = linked.slice(i, i + BATCH_SIZE).map((l) => l.lid);
    Object.assign(entities, await fetchBatch(batch));
  }
} catch (err) {
  console.error(`FAIL: validate-wikidata-lexemes: could not query Wikidata: ${(err as Error).message}`);
  console.error("validate-wikidata-lexemes: FAILED (Wikidata unreachable/blocked — no lexeme was verified)");
  process.exit(1);
}

let checked = 0;
for (const { lid, termId, lemma } of linked) {
  const ent = entities[lid];
  if (!ent) {
    // wbgetentities keys redirected (merged) lexemes under the TARGET id,
    // so the requested id vanishing from the response means a redirect.
    const target = Object.values(entities).find(
      (e) => e.id && !linked.some((l) => l.lid === e.id),
    );
    check(false,
      `term ${termId}: ${lid} not returned under its own id (merged/redirected` +
      `${target?.id ? `, possibly to ${target.id}` : ""}); re-verify the link`);
    continue;
  }
  if (ent.missing !== undefined) {
    check(false, `term ${termId}: lexeme ${lid} has been deleted from Wikidata`);
    continue;
  }
  check(ent.id === lid, `term ${termId}: ${lid} resolved to a different entity id ${ent.id} (merge); re-verify`);
  check(ent.type === "lexeme", `term ${termId}: ${lid} is a ${ent.type}, not a lexeme`);
  check(ent.language === ANCIENT_GREEK,
    `term ${termId}: ${lid} lexical language is ${ent.language}, expected Ancient Greek (${ANCIENT_GREEK})`);
  const grcLemma = ent.lemmas?.["grc"]?.value;
  check(grcLemma !== undefined, `term ${termId}: ${lid} carries no grc lemma`);
  if (grcLemma !== undefined) {
    check(grcLemma === lemma,
      `term ${termId}: ${lid} grc lemma "${grcLemma}" no longer matches inventory lemma "${lemma}"`);
  }
  checked += 1;
}

console.log(
  `validate-wikidata-lexemes: checked ${checked}/${linked.length} lexemes ` +
  `against Wikidata (language ${ANCIENT_GREEK}, exact grc lemma match)`,
);

if (failures > 0) {
  console.error(`validate-wikidata-lexemes: ${failures} failure(s)`);
  process.exit(1);
}
console.log("validate-wikidata-lexemes: OK");

export {};
