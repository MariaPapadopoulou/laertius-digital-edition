/**
 * Validates the OTB ontoterminology layer (the TEDI 4.1 compatible export):
 *
 *   1. getOtbModel() builds without fragment collisions and with sane
 *      positive counts (philosophers, schools, places, assertions, names).
 *   2. Referential closure: every relation target, proper-name object,
 *      topic link and term concept resolves inside the model.
 *   3. getOtbRdf() parses as RDF/XML (oxigraph Store.load) and the parsed
 *      graph answers positive-control counts: otv:Object instances,
 *      otv:ProperName links, Assertion individuals, OTV core classes.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-otb
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getOtbModel } = await import("../../artifacts/api-server/src/lib/otb/build");
const { getClaims } = await import("../../artifacts/api-server/src/lib/kg-claims");
const { getOtbRdf } = await import("../../artifacts/api-server/src/lib/otb/emit");
const { CONCEPTS, RELATIONS, ATTRIBUTES, TOPICS, DOXA_DOMAIN_TOPIC, PROPERTY_TOPIC } = await import(
  "../../artifacts/api-server/src/lib/otb/inventory"
);
const { getDoxai } = await import("../../artifacts/api-server/src/lib/doxai");
const oxigraph = await import("oxigraph");

let failures = 0;
function check(cond: boolean, msg: string): void {
  if (!cond) {
    failures += 1;
    console.error(`FAIL: ${msg}`);
  }
}

const model = getOtbModel();

// ---------------------------------------------------------------- counts
const byConcept = new Map<string, number>();
for (const o of model.objects) {
  byConcept.set(o.concept, (byConcept.get(o.concept) ?? 0) + 1);
}
const count = (c: string) => byConcept.get(c) ?? 0;

const claimCount = getClaims().length;
// Every embedded textual genre item (testament, epistle, verse, saying, anecdote,
// opinion) carries a txt-<docId> Text with its verbatim excerpt, on top
// of the one-per-claim assertion texts.
const docTextCount =
  count("Testament") + count("Epistle") + count("Verse") + count("Epigram") +
  count("Saying") + count("Anecdotes") + count("Opinions");
check(count("Philosopher") >= 80, `expected >=80 Philosopher objects, got ${count("Philosopher")}`);
check(count("PhilosophicalSchool") >= 10, `expected >=10 schools, got ${count("PhilosophicalSchool")}`);
check(count("Place") >= 150, `expected >=150 places (curated coordinates + mention places), got ${count("Place")}`);
check(count("Person") >= 250, `expected >=250 Person objects (incl. curated mention persons), got ${count("Person")}`);
check(count("Assertion") === claimCount, `expected ${claimCount} assertions (one per claim), got ${count("Assertion")}`);
check(count("Text") === claimCount + docTextCount,
  `expected ${claimCount + docTextCount} texts (${claimCount} claim + ${docTextCount} document), got ${count("Text")}`);
check(count("Testament") === 6, `expected 6 testaments, got ${count("Testament")}`);
check(count("Epistle") === 31, `expected 31 epistles, got ${count("Epistle")}`);
check(count("Saying") === 637, `expected 637 sayings, got ${count("Saying")}`);
check(count("Anecdotes") === 334, `expected 334 anecdotes, got ${count("Anecdotes")}`);
check(count("Opinions") === 169, `expected 169 opinions, got ${count("Opinions")}`);
check(count("Verse") + count("Epigram") === 340,
  `expected 340 verse+epigram objects, got ${count("Verse") + count("Epigram")}`);
check(count("Work") >= 100, `expected >=100 works, got ${count("Work")}`);
check(count("CitedSource") >= 3, `expected >=3 cited sources (the Lives + curated source works), got ${count("CitedSource")}`);
check(model.properNames.length >= 300, `expected >=300 proper names, got ${model.properNames.length}`);
const grcNames = model.properNames.filter((n) => n.lang === "grc").length;
check(grcNames >= 80, `expected >=80 Greek proper names, got ${grcNames}`);

// ------------------------------------------------------ referential closure
const objIds = new Set(model.objects.map((o) => o.id));
const nameIds = new Set(model.properNames.map((n) => n.id));
const conceptIds = new Set(CONCEPTS.map((c) => c.id));
const relationIds = new Set(RELATIONS.map((r) => r.id));
const attributeIds = new Set(ATTRIBUTES.map((a) => a.id));

for (const c of CONCEPTS) {
  if (c.isA) check(conceptIds.has(c.isA), `concept ${c.id}: dangling isA ${c.isA}`);
  for (const r of c.related ?? []) {
    check(conceptIds.has(r), `concept ${c.id}: dangling related ${r}`);
  }
}
for (const r of RELATIONS) {
  for (const d of [...r.domain, ...r.range]) {
    check(conceptIds.has(d), `relation ${r.id}: dangling concept ${d}`);
  }
}
for (const a of ATTRIBUTES) {
  for (const d of a.domain) {
    check(conceptIds.has(d), `attribute ${a.id}: dangling concept ${d}`);
  }
}
for (const t of model.terms) {
  check(conceptIds.has(t.concept), `term ${t.id}: dangling concept ${t.concept}`);
}
for (const o of model.objects) {
  check(conceptIds.has(o.concept), `object ${o.id}: unknown concept ${o.concept}`);
  for (const rel of o.relations) {
    check(relationIds.has(rel.rel), `object ${o.id}: unknown relation ${rel.rel}`);
    check(objIds.has(rel.target), `object ${o.id}: dangling ${rel.rel} -> ${rel.target}`);
  }
  for (const l of o.literals) {
    check(attributeIds.has(l.attr), `object ${o.id}: unknown attribute ${l.attr}`);
  }
  for (const n of o.names) {
    check(nameIds.has(n), `object ${o.id}: dangling proper name ${n}`);
  }
}
for (const n of model.properNames) {
  check(objIds.has(n.object), `proper name ${n.id}: dangling object ${n.object}`);
  for (const a of n.allonyms) {
    check(nameIds.has(a), `proper name ${n.id}: dangling allonym ${a}`);
  }
}
const topicIds = new Set(TOPICS.map((t) => t.id));
for (const t of TOPICS) {
  check(objIds.has(t.id), `topic ${t.id} missing from objects`);
}
for (const o of model.objects) {
  if (o.concept !== "Assertion") continue;
  const topics = o.relations.filter((r) => r.rel === "hasTopic");
  check(topics.length === 1, `assertion ${o.id}: expected 1 topic, got ${topics.length}`);
  for (const t of topics) {
    check(topicIds.has(t.target), `assertion ${o.id}: non-canonical topic ${t.target}`);
  }
}

// ------------------------------------------------- doxa topic positive control
// Doxai must link to their SPECIFIC doctrinal topics via DOXA_DOMAIN_TOPIC,
// with the generic 'doctrine' topic reserved for the documented fallback
// domains. If the mapping table were emptied or a domain string drifted,
// every doxa would silently collapse onto 'doctrine'; assert exact per-topic
// counts derived from the doxa corpus itself.
// The mapping and fallback set are PINNED here, independently of the
// inventory, so an edit to DOXA_DOMAIN_TOPIC (collapse to 'doctrine',
// dropped/renamed domain, fallback domain quietly mapped) cannot move the
// expectation with it. Changing the mapping must consciously update BOTH.
const EXPECTED_DOXA_DOMAIN_TOPIC: Record<string, string> = {
  "first-principles": "firstPrinciple",
  cosmology: "cosmosTopic",
  physics: "physisTopic",
  soul: "soulTopic",
  gods: "theDivine",
  epistemology: "knowledgeTopic",
  logic: "logosTopic",
  pleasure: "pleasureTopic",
  fate: "fateTopic",
};
const DOXA_FALLBACK_DOMAINS = new Set(["ethics", "politics", "death"]);
{
  const expectedKeys = Object.keys(EXPECTED_DOXA_DOMAIN_TOPIC).sort();
  const actualKeys = Object.keys(DOXA_DOMAIN_TOPIC).sort();
  check(JSON.stringify(actualKeys) === JSON.stringify(expectedKeys),
    `DOXA_DOMAIN_TOPIC domains drifted from the pinned expectation: ` +
    `expected [${expectedKeys.join(", ")}], got [${actualKeys.join(", ")}]`);
  for (const [domain, topic] of Object.entries(EXPECTED_DOXA_DOMAIN_TOPIC)) {
    check(DOXA_DOMAIN_TOPIC[domain] === topic,
      `DOXA_DOMAIN_TOPIC["${domain}"] should map to ${topic}, got ${DOXA_DOMAIN_TOPIC[domain]}`);
  }
  for (const domain of DOXA_FALLBACK_DOMAINS) {
    check(!(domain in DOXA_DOMAIN_TOPIC),
      `fallback domain "${domain}" must NOT be in DOXA_DOMAIN_TOPIC (it belongs to the 'doctrine' fallback)`);
  }
}
const expectedTopicCounts = new Map<string, number>();
let expectedDoctrineCount = 0;
for (const d of getDoxai()) {
  const mapped = EXPECTED_DOXA_DOMAIN_TOPIC[d.domain];
  if (mapped) {
    expectedTopicCounts.set(mapped, (expectedTopicCounts.get(mapped) ?? 0) + 1);
  } else if (DOXA_FALLBACK_DOMAINS.has(d.domain)) {
    expectedDoctrineCount += 1;
  } else {
    check(false,
      `doxa ${d.id}: domain "${d.domain}" is neither in DOXA_DOMAIN_TOPIC nor in the ` +
      `documented fallback set (${[...DOXA_FALLBACK_DOMAINS].join("/")}); map it or ` +
      `extend the fallback set consciously`);
  }
}
check(Object.keys(DOXA_DOMAIN_TOPIC).length > 0, "DOXA_DOMAIN_TOPIC is empty");
for (const domain of Object.keys(EXPECTED_DOXA_DOMAIN_TOPIC)) {
  check((expectedTopicCounts.get(EXPECTED_DOXA_DOMAIN_TOPIC[domain]!) ?? 0) > 0,
    `DOXA_DOMAIN_TOPIC domain "${domain}" matches no doxa; the mapping key drifted from the corpus`);
}
for (const topic of Object.values(EXPECTED_DOXA_DOMAIN_TOPIC)) {
  check(topicIds.has(topic), `DOXA_DOMAIN_TOPIC maps to non-canonical topic ${topic}`);
}
const actualTopicCounts = new Map<string, number>();
for (const o of model.objects) {
  if (o.concept !== "Opinions") continue;
  for (const r of o.relations) {
    if (r.rel !== "hasTopic") continue;
    actualTopicCounts.set(r.target, (actualTopicCounts.get(r.target) ?? 0) + 1);
  }
}
for (const [topic, expected] of expectedTopicCounts) {
  const actual = actualTopicCounts.get(topic) ?? 0;
  check(expected > 0 && actual === expected,
    `doxa topic ${topic}: expected ${expected} Opinions hasTopic links, got ${actual}`);
}
const actualDoctrine = actualTopicCounts.get("doctrine") ?? 0;
check(actualDoctrine === expectedDoctrineCount,
  `doxa fallback topic 'doctrine': expected exactly ${expectedDoctrineCount} ` +
  `(ethics+politics+death doxai), got ${actualDoctrine}`);
for (const [topic, n] of actualTopicCounts) {
  if (topic === "doctrine" || expectedTopicCounts.has(topic)) continue;
  check(false, `Opinions carry ${n} hasTopic link(s) to unexpected topic ${topic}`);
}

// ------------------------------------------ claim topic positive control
// Every claim becomes an Assertion, but build.ts only emits hasTopic when
// the claim's property key is present in PROPERTY_TOPIC; a renamed claim
// property or a trimmed mapping would silently strip topic links while the
// assertion-topic closure above stays green (it only checks links that
// exist). Guard the sibling mapping the same way as DOXA_DOMAIN_TOPIC:
// the mapping is PINNED here, independently of the inventory, and every
// claim property must be mapped unless it is on the documented
// "intentionally untopiced" list below (currently empty: all 18 corpus
// properties carry a topic).
const EXPECTED_PROPERTY_TOPIC: Record<string, string> = {
  birthPlace: "birthPlace",
  deathPlace: "deathPlace",
  livedIn: "residence",
  traveledTo: "travel",
  birthDate: "birthDate",
  deathDate: "deathDate",
  mannerOfDeath: "mannerOfDeath",
  parentage: "parentage",
  wrote: "authorship",
  writings: "authorship",
  studiedUnder: "education",
  education: "education",
  affiliatedWith: "affiliation",
  praised: "praise",
  criticized: "criticism",
  heldDoctrine: "doctrine",
  succession: "successionTopic",
  oldAge: "oldAge",
  deme: "birthPlace",
};
const UNTOPICED_PROPERTIES = new Set<string>([]);
{
  const expectedKeys = Object.keys(EXPECTED_PROPERTY_TOPIC).sort();
  const actualKeys = Object.keys(PROPERTY_TOPIC).sort();
  check(JSON.stringify(actualKeys) === JSON.stringify(expectedKeys),
    `PROPERTY_TOPIC keys drifted from the pinned expectation: ` +
    `expected [${expectedKeys.join(", ")}], got [${actualKeys.join(", ")}]`);
  for (const [prop, topic] of Object.entries(EXPECTED_PROPERTY_TOPIC)) {
    check(PROPERTY_TOPIC[prop] === topic,
      `PROPERTY_TOPIC["${prop}"] should map to ${topic}, got ${PROPERTY_TOPIC[prop]}`);
    check(topicIds.has(topic), `PROPERTY_TOPIC maps to non-canonical topic ${topic}`);
  }
  for (const prop of UNTOPICED_PROPERTIES) {
    check(!(prop in EXPECTED_PROPERTY_TOPIC),
      `property "${prop}" is both mapped and on the untopiced list; pick one`);
  }
}
// Every claim property in the corpus is either mapped or documented as
// intentionally untopiced; and expected per-topic Assertion hasTopic
// counts are derived from the claims corpus itself, mirroring the doxa
// control above.
const expectedClaimTopicCounts = new Map<string, number>();
let expectedUntopicedClaims = 0;
const claimPropsSeen = new Set<string>();
for (const c of getClaims()) {
  claimPropsSeen.add(c.property);
  const topic = EXPECTED_PROPERTY_TOPIC[c.property];
  if (topic) {
    expectedClaimTopicCounts.set(topic, (expectedClaimTopicCounts.get(topic) ?? 0) + 1);
  } else if (UNTOPICED_PROPERTIES.has(c.property)) {
    expectedUntopicedClaims += 1;
  } else {
    check(false,
      `claim ${c.id}: property "${c.property}" is neither in PROPERTY_TOPIC nor on ` +
      `the documented untopiced list; its assertions silently lose their hasTopic ` +
      `link - map it or add it to UNTOPICED_PROPERTIES consciously`);
  }
}
check(claimPropsSeen.size >= 15,
  `expected >=15 distinct claim properties in the corpus (positive control), got ${claimPropsSeen.size}`);
for (const prop of Object.keys(EXPECTED_PROPERTY_TOPIC)) {
  check(claimPropsSeen.has(prop),
    `PROPERTY_TOPIC property "${prop}" matches no claim; the mapping key drifted from the corpus`);
}
const actualClaimTopicCounts = new Map<string, number>();
let actualUntopicedAssertions = 0;
for (const o of model.objects) {
  if (o.concept !== "Assertion") continue;
  const topics = o.relations.filter((r) => r.rel === "hasTopic");
  if (topics.length === 0) actualUntopicedAssertions += 1;
  for (const r of topics) {
    actualClaimTopicCounts.set(r.target, (actualClaimTopicCounts.get(r.target) ?? 0) + 1);
  }
}
for (const [topic, expected] of expectedClaimTopicCounts) {
  const actual = actualClaimTopicCounts.get(topic) ?? 0;
  check(expected > 0 && actual === expected,
    `claim topic ${topic}: expected ${expected} Assertion hasTopic links, got ${actual}`);
}
check(actualUntopicedAssertions === expectedUntopicedClaims,
  `expected ${expectedUntopicedClaims} untopiced assertions (documented untopiced ` +
  `properties only), got ${actualUntopicedAssertions}`);
for (const [topic, n] of actualClaimTopicCounts) {
  if (expectedClaimTopicCounts.has(topic)) continue;
  check(false, `Assertions carry ${n} hasTopic link(s) to unexpected topic ${topic}`);
}
console.log(
  `validate-otb: claim topic control: ${claimPropsSeen.size} properties over ` +
  `${expectedClaimTopicCounts.size} topics, ${expectedUntopicedClaims} untopiced claim(s)`,
);

// Every embedded textual genre item carries exactly one hasContent to a Text whose
// text literals are language-tagged (grc/en); cts is never tagged.
const objById = new Map(model.objects.map((o) => [o.id, o]));
const DOC_CONCEPTS = new Set([
  "Testament", "Epistle", "Verse", "Epigram", "Saying", "Anecdotes", "Opinions",
]);
for (const o of model.objects) {
  if (!DOC_CONCEPTS.has(o.concept)) continue;
  const contents = o.relations.filter((r) => r.rel === "hasContent");
  check(contents.length === 1, `document ${o.id}: expected 1 hasContent, got ${contents.length}`);
  const txt = contents[0] ? objById.get(contents[0].target) : undefined;
  check(txt?.concept === "Text", `document ${o.id}: hasContent target is not a Text`);
  if (txt) {
    const textLits = txt.literals.filter((l) => l.attr === "text");
    check(textLits.length >= 1, `document ${o.id}: ${txt.id} carries no text literal`);
    for (const l of txt.literals) {
      if (l.attr === "text") {
        check(l.lang === "grc" || l.lang === "en",
          `document ${o.id}: ${txt.id} text literal lacks a grc/en language tag`);
      } else {
        check(l.lang === undefined, `document ${o.id}: ${txt.id} ${l.attr} literal is language-tagged`);
      }
    }
  }
}

// Concept examples resolve to objects of the concept or a descendant.
const conceptById = new Map(CONCEPTS.map((c) => [c.id, c]));
function conceptIsA(candidate: string, ancestor: string): boolean {
  let cur: string | undefined = candidate;
  while (cur) {
    if (cur === ancestor) return true;
    cur = conceptById.get(cur)?.isA;
  }
  return false;
}
for (const c of CONCEPTS) {
  for (const ex of c.examples ?? []) {
    const o = objById.get(ex);
    if (!o) {
      check(false, `concept ${c.id}: dangling example ${ex}`);
      continue;
    }
    check(conceptIsA(o.concept, c.id),
      `concept ${c.id}: example ${ex} is a ${o.concept}, not a ${c.id} descendant`);
  }
}

// Every widenedDomain marker in the inventory is actually exercised by the
// corpus: at least one object in the widened concept's subtree uses the
// relation. A widening no instance ever uses signals the marker (and the
// widening itself) should be reverted rather than kept.
let widenedMembersChecked = 0;
for (const r of RELATIONS) {
  for (const w of r.widenedDomain ?? []) {
    widenedMembersChecked += 1;
    let uses = 0;
    for (const o of model.objects) {
      if (!conceptIsA(o.concept, w)) continue;
      uses += o.relations.filter((rel) => rel.rel === r.id).length;
    }
    check(uses > 0,
      `relation ${r.id}: widenedDomain member ${w} has no instance triple in the corpus; ` +
      `revert the widening (and the marker) or fix the data`);
    console.log(
      `validate-otb: widened domain ${r.id} <- ${w}: ${uses} instance triple(s)`,
    );
  }
}
check(widenedMembersChecked >= 2,
  `expected >=2 widenedDomain members to exercise (positive control), got ${widenedMembersChecked}`);

// Every `extension: true` entry in the inventory is actually exercised by
// the corpus, same rot rule as widenedDomain: an extension-flagged concept
// must have at least one object in its subtree, an extension relation at
// least one instance triple, and an extension attribute at least one
// literal. An extension no data ever uses should be reverted (removed from
// the inventory and from TEDI's review surface), not silently kept.
let extensionEntriesChecked = 0;
for (const c of CONCEPTS) {
  if (!c.extension) continue;
  extensionEntriesChecked += 1;
  let uses = 0;
  for (const o of model.objects) {
    if (conceptIsA(o.concept, c.id)) uses += 1;
  }
  check(uses > 0,
    `extension concept ${c.id}: no object in its subtree; ` +
    `revert the extension (and its terms) or fix the data`);
  console.log(`validate-otb: extension concept ${c.id}: ${uses} object(s)`);
}
for (const r of RELATIONS) {
  if (!r.extension) continue;
  extensionEntriesChecked += 1;
  let uses = 0;
  for (const o of model.objects) {
    uses += o.relations.filter((rel) => rel.rel === r.id).length;
  }
  check(uses > 0,
    `extension relation ${r.id}: no instance triple in the corpus; ` +
    `revert the extension or fix the data`);
  console.log(`validate-otb: extension relation ${r.id}: ${uses} instance triple(s)`);
}
for (const a of ATTRIBUTES) {
  if (!a.extension) continue;
  extensionEntriesChecked += 1;
  let uses = 0;
  for (const o of model.objects) {
    uses += o.literals.filter((l) => l.attr === a.id).length;
  }
  check(uses > 0,
    `extension attribute ${a.id}: no literal in the corpus; ` +
    `revert the extension or fix the data`);
  console.log(`validate-otb: extension attribute ${a.id}: ${uses} literal(s)`);
}
// Positive control: the inventory is known to carry the Saying concept,
// isAbout/wrote/isRelatedTo relations and the certainty attribute as
// extensions; if fewer entries were exercised, the extension flags were
// dropped without updating this check.
check(extensionEntriesChecked >= 5,
  `expected >=5 extension-flagged entries to exercise (positive control), got ${extensionEntriesChecked}`);

// Fragment uniqueness across objects, names, concepts, properties, terms.
const seen = new Map<string, string>();
function claimFragment(id: string, kind: string): void {
  const prev = seen.get(id);
  check(!prev, `fragment #${id} claimed by both ${prev} and ${kind}`);
  seen.set(id, kind);
}
for (const c of CONCEPTS) claimFragment(c.id, "concept");
for (const r of RELATIONS) claimFragment(r.id, "relation");
for (const a of ATTRIBUTES) claimFragment(a.id, "attribute");
for (const t of model.terms) claimFragment(t.id, "term");
for (const o of model.objects) claimFragment(o.id, "object");
for (const n of model.properNames) claimFragment(n.id, "properName");

// Authored strings never carry an em dash (user preference); verbatim
// corpus excerpts (Text.text, notes quoting Hicks/Greek) are exempt as
// source-internal quotations.
const authored: string[] = [
  model.meta.title, model.meta.description,
  ...model.extensions,
  ...model.concepts.flatMap((c) => [c.id, c.shortName ?? "", c.definition ?? ""]),
  ...model.terms.flatMap((t) => [t.name, t.definition ?? ""]),
  ...model.relations.map((r) => r.id),
  ...model.attributes.map((a) => a.id),
  ...model.objects.map((o) => o.label),
];
for (const s of authored) {
  if (s.includes("\u2014")) {
    check(false, `authored string contains an em dash: ${s.slice(0, 80)}`);
    break;
  }
}

// ---------------------------------------------------------------- RDF/XML
const rdf = getOtbRdf();
const store = new oxigraph.Store();
try {
  store.load(rdf, {
    format: "application/rdf+xml",
    base_iri: "http://www.ontologia.fr/OTB/diogenes_laertius_22_07_26",
  });
} catch (e) {
  failures += 1;
  console.error(`FAIL: RDF/XML does not parse: ${String(e)}`);
}

if (store.size > 0) {
  const OTV = "http://www.ontologia.fr/OTB/otv#";
  const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
  const typed = (cls: string) =>
    store.match(
      null,
      oxigraph.namedNode(RDF_TYPE),
      oxigraph.namedNode(cls),
      null,
    ).length;
  const otvObjects = typed(`${OTV}Object`);
  const otvNames = typed(`${OTV}ProperName`);
  const otvConcepts = typed(`${OTV}Concept`);
  const otvTerms = typed(`${OTV}Term`);
  check(otvObjects === model.objects.length,
    `otv:Object triples ${otvObjects} != model objects ${model.objects.length}`);
  check(otvNames === model.properNames.length,
    `otv:ProperName triples ${otvNames} != model names ${model.properNames.length}`);
  check(otvConcepts === CONCEPTS.length,
    `otv:Concept triples ${otvConcepts} != inventory concepts ${CONCEPTS.length}`);
  check(otvTerms === model.terms.length,
    `otv:Term triples ${otvTerms} != model terms ${model.terms.length}`);
  // OTV core vocabulary present exactly once.
  const otvCoreClass = store.match(
    oxigraph.namedNode(`${OTV}Ontoterminology`),
    null, null, null,
  ).length;
  check(otvCoreClass > 0, "OTV core vocabulary block missing");
  console.log(
    `validate-otb: ${model.objects.length} objects ` +
    `(${count("Philosopher")} philosophers, ${count("Assertion")} assertions, ` +
    `${count("Place")} places), ${model.properNames.length} proper names ` +
    `(${grcNames} grc), ${model.terms.length} terms, ${store.size} triples parsed`,
  );
}

if (failures > 0) {
  console.error(`validate-otb: ${failures} failure(s)`);
  process.exit(1);
}
console.log("validate-otb: OK");
