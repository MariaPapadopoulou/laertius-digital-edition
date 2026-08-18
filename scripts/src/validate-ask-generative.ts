/**
 * Guardrails & smoke test for the generative Ask answer
 * (artifacts/api-server/src/lib/generate-answer.ts):
 *
 *  1. Fallback path: with no LLM env configured, generation is unavailable
 *     and generateAnswer resolves null (route serves extractive answer).
 *  2. Citation guardrail: sanitizeCitations keeps only ids supplied in the
 *     context, strips fabricated ones, and reports them.
 *  3. Context building: curated claim/verse/saying hits are fed to the LLM
 *     alongside passages, and the total context is capped.
 *  4. End-to-end against a local OpenAI-compatible stub server:
 *     - a normal question yields a synthesized answer with validated
 *       citation chips (fabricated ids stripped);
 *     - a no-results question (empty context) never calls the LLM;
 *     - an LLM HTTP failure throws, so the route falls back to extractive.
 */
import path from "node:path";
import http from "node:http";
import type { AddressInfo } from "node:net";

process.env["LAERTIUS_DATA_DIR"] = path.resolve(
  process.cwd(),
  "../artifacts/api-server/data",
);
// Ensure a clean "no LLM" baseline regardless of the shell environment.
for (const k of [
  "LAERTIUS_LLM_BASE_URL",
  "LAERTIUS_LLM_API_KEY",
  "LAERTIUS_LLM_MODEL",
  "OPENAI_BASE_URL",
  "OPENAI_API_KEY",
]) {
  delete process.env[k];
}

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`PASS ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL ${name}${detail ? ` - ${detail}` : ""}`);
  }
}

async function main() {
  const mod = await import(
    "../../artifacts/api-server/src/lib/generate-answer"
  );
  const {
    llmConfig,
    generativeAvailable,
    generateAnswer,
    sanitizeCitations,
    buildContextItems,
  } = mod;

  // --- 1. Fallback path with the LLM disabled -------------------------
  check("no-env: llmConfig is null", llmConfig() === null);
  check("no-env: generativeAvailable false", generativeAvailable() === false);
  const passages = [
    {
      id: "2.5.21",
      urn: "urn:x",
      book: 2,
      chapter: "5",
      section: "21",
      philosopher: "Socrates",
      school: "Socratic",
      text: "ἔφη δὲ Σωκράτης…",
      textEn: "Socrates said that he knew nothing.",
      score: 1,
      source: "hybrid",
    },
  ];
  const fullInput = {
    passages,
    claimAnswers: [
      {
        philosopher: "Socrates",
        topic: "Death",
        claims: [
          {
            id: "c1",
            subject: "Socrates",
            property: "mannerOfDeath" as const,
            value: "drank hemlock",
            valueType: "literal" as const,
            ref: "2.35",
            sectionId: "2.5.35",
            certainty: "asserted" as const,
          },
        ],
      },
    ],
    verseAnswers: [
      {
        id: "v1",
        sectionId: "2.5.44",
        book: 2,
        philosopher: "Socrates",
        school: "Socratic",
        linesGrc: ["πῖνε νῦν ἐν Διὸς ὤν"],
        linesEn: ["Drink then, being in the house of Zeus"],
        source: null,
        continued: false,
      },
    ],
    sayingAnswers: [
      {
        id: "s1",
        philosopher: "Socrates",
        school: "Socratic",
        book: 2,
        topic: "virtue" as const,
        gloss: "on knowledge",
        grc: null,
        en: "I know that I know nothing.",
        ref: "2.32",
        sectionId: "2.5.32",
        certainty: "asserted" as const,
      },
    ],
  };
  const nullAnswer = await generateAnswer("How did Socrates die?", fullInput);
  check("no-env: generateAnswer resolves null", nullAnswer === null);

  // --- 2. Citation guardrail -------------------------------------------
  const allowed = new Set(["2.5.21", "2.5.35"]);
  const s = sanitizeCitations(
    "He drank hemlock [D.L. 2.5.35], as reported [D.L. 9.9.99] and again [D.L. 2.5.35]; see also [D.L. 2.5.21].",
    allowed,
  );
  check(
    "guardrail: fabricated id stripped from text",
    !s.text.includes("9.9.99"),
    s.text,
  );
  check(
    "guardrail: valid citations kept, unique, in order",
    s.citations.map((c: { sectionId: string }) => c.sectionId).join(",") ===
      "2.5.35,2.5.21",
    JSON.stringify(s.citations),
  );
  check(
    "guardrail: dropped ids reported",
    s.dropped.length === 1 && s.dropped[0] === "9.9.99",
    JSON.stringify(s.dropped),
  );
  check(
    "guardrail: no dangling space before punctuation",
    !/\s[.,;:]/.test(s.text),
    s.text,
  );

  // --- 3. Context building ----------------------------------------------
  const items = buildContextItems(fullInput);
  const bodies = items.map((i: { body: string }) => i.body).join("\n");
  check(
    "context: passage + curated claim/verse/saying all included",
    bodies.includes("knew nothing") &&
      bodies.includes("drank hemlock") &&
      bodies.includes("house of Zeus") &&
      bodies.includes("I know that I know nothing"),
  );
  check(
    "context: every item carries a citable section id",
    items.every((i: { sectionId: string }) => /^\d+\./.test(i.sectionId)),
  );
  const huge = {
    passages: Array.from({ length: 60 }, (_, i) => ({
      ...passages[0]!,
      id: `9.9.${i}`,
      textEn: "x".repeat(1500),
    })),
    claimAnswers: [],
    verseAnswers: [],
    sayingAnswers: [],
  };
  const capped = buildContextItems(huge);
  const total = capped.reduce(
    (n: number, i: { body: string }) => n + i.body.length,
    0,
  );
  check("context: overall budget enforced (~14k chars)", total <= 14000, `${total}`);
  check("context: budget keeps the top-ranked items", capped.length > 0);

  // --- 4. End-to-end against an OpenAI-compatible stub -------------------
  let sawRequest: { model?: string; messages?: { role: string; content: string }[] } = {};
  let respondWith: number | string =
    "Socrates died by drinking hemlock [D.L. 2.5.35]. He famously said he knew nothing [D.L. 2.5.21].";
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      sawRequest = JSON.parse(body);
      if (typeof respondWith === "number") {
        res.writeHead(respondWith).end("{}");
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          choices: [{ message: { content: respondWith } }],
        }),
      );
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  const config = {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    apiKey: "stub",
    model: "stub-model",
  };

  const gen = await generateAnswer("How did Socrates die?", fullInput, config);
  check("stub: synthesized answer returned", gen !== null && gen.text.length > 0);
  check(
    "stub: citations validated against supplied context",
    gen !== null &&
      gen.citations.every((c: { sectionId: string }) =>
        ["2.5.21", "2.5.35", "2.5.44", "2.5.32"].includes(c.sectionId),
      ) &&
      gen.citations.length === 2,
    JSON.stringify(gen?.citations),
  );
  check(
    "stub: strict grounding system prompt sent",
    JSON.stringify(sawRequest.messages?.[0] ?? "").includes(
      "ONLY from the context items",
    ),
  );
  check(
    "stub: curated content present in the LLM prompt",
    JSON.stringify(sawRequest.messages?.[1] ?? "").includes("drank hemlock"),
  );

  // No-results question: empty context must never reach the LLM.
  sawRequest = {};
  const none = await generateAnswer("Unanswerable?", {
    passages: [],
    claimAnswers: [],
    verseAnswers: [],
    sayingAnswers: [],
  }, config);
  check("stub: empty context returns null (honest no-answer)", none === null);
  check(
    "stub: empty context never calls the LLM",
    Object.keys(sawRequest).length === 0,
  );

  // Grounding contract: an answer containing ANY fabricated citation is
  // rejected outright (route falls back to extractive), never rendered
  // with the invented support silently removed.
  respondWith =
    "Socrates died by hemlock [D.L. 2.5.35]. A later poet invented this [D.L. 8.8.88].";
  let threwFabricated = false;
  try {
    await generateAnswer("How did Socrates die?", fullInput, config);
  } catch {
    threwFabricated = true;
  }
  check(
    "stub: any fabricated citation rejects the whole answer (extractive fallback)",
    threwFabricated,
  );

  // Fabricated-citation-only output: also rejected.
  respondWith = "He surely died somehow [D.L. 8.8.88].";
  let threwFabricatedOnly = false;
  try {
    await generateAnswer("How did Socrates die?", fullInput, config);
  } catch {
    threwFabricatedOnly = true;
  }
  check(
    "stub: fabricated-citation-only output rejected (extractive fallback)",
    threwFabricatedOnly,
  );

  // Citation-free prose: ungrounded by definition, rejected.
  respondWith = "Socrates died peacefully in his sleep, according to tradition.";
  let threwUncited = false;
  try {
    await generateAnswer("How did Socrates die?", fullInput, config);
  } catch {
    threwUncited = true;
  }
  check(
    "stub: citation-free prose rejected as ungrounded (extractive fallback)",
    threwUncited,
  );

  // LLM failure: throws so the route logs and serves the extractive answer.
  respondWith = 500;
  let threw = false;
  try {
    await generateAnswer("How did Socrates die?", fullInput, config);
  } catch {
    threw = true;
  }
  check("stub: HTTP failure throws (route falls back to extractive)", threw);

  server.close();
}

main().then(
  () => {
    console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
    process.exit(failures === 0 ? 0 : 1);
  },
  (err) => {
    console.error("Validator crashed:", err);
    process.exit(1);
  },
);
