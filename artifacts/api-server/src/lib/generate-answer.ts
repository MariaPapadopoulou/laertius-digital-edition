/**
 * LLM answer generation for the Ask feature (generative RAG).
 *
 * Takes the question, the retrieved passages, and the curated
 * claim/verse/saying hits and prompts an OpenAI-compatible chat-completions
 * endpoint to synthesize a grounded answer with inline [D.L. <section-id>]
 * citations. The endpoint is entirely env-driven so offline deployments
 * (the IONOS bundle) simply run without it:
 *
 *   LAERTIUS_LLM_BASE_URL / LAERTIUS_LLM_API_KEY / LAERTIUS_LLM_MODEL
 *   fall back to OPENAI_BASE_URL / OPENAI_API_KEY
 *
 * When no key is configured, generateAnswer() resolves to null and the
 * route serves the extractive answer unchanged.
 */
import type { RankedPassage } from "./rag";
import type { ClaimAnswer } from "./claims-answer";
import type { Verse } from "./verses";
import type { SerializedSaying } from "./sayings";
import { logger } from "./logger";

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function llmConfig(): LlmConfig | null {
  const env = process.env;
  const baseUrl =
    env["LAERTIUS_LLM_BASE_URL"] ??
    env["OPENAI_BASE_URL"] ??
    (env["OPENAI_API_KEY"] ? "https://api.openai.com/v1" : undefined);
  const apiKey =
    env["LAERTIUS_LLM_API_KEY"] ??
    env["OPENAI_API_KEY"];
  if (!baseUrl || !apiKey) return null;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    model: env["LAERTIUS_LLM_MODEL"] ?? "gpt-5.6-terra",
  };
}

export function generativeAvailable(): boolean {
  return llmConfig() !== null;
}

export interface GeneratedCitation {
  /** Corpus section id (book.chapter.section) the chip deep-links to. */
  sectionId: string;
  /** Human-readable D.L. reference shown on the chip. */
  label: string;
}

export interface GeneratedAnswer {
  /** Synthesized answer; inline citations appear as [D.L. <section-id>]. */
  text: string;
  /** Unique cited section ids, in order of first appearance. */
  citations: GeneratedCitation[];
  model: string;
}

interface ContextItem {
  sectionId: string;
  body: string;
}

/** Total character budget for the passage/curated context block. */
const CONTEXT_CHAR_BUDGET = 14000;
const PASSAGE_CHAR_CAP = 1600;

function clip(text: string, cap: number): string {
  if (text.length <= cap) return text;
  const cut = text.slice(0, cap);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : cap)} …`;
}

export interface AskContextInput {
  passages: RankedPassage[];
  claimAnswers: ClaimAnswer[];
  verseAnswers: Verse[];
  sayingAnswers: SerializedSaying[];
}

/**
 * Flatten passages plus curated hits into citable context items. Every item
 * carries the corpus section id the model must cite; items without a
 * resolvable section id are skipped (they could not be linked anyway).
 */
export function buildContextItems(input: AskContextInput): ContextItem[] {
  const items: ContextItem[] = [];

  for (const p of input.passages) {
    const grc = clip(p.text, PASSAGE_CHAR_CAP);
    const en = p.textEn ? clip(p.textEn, PASSAGE_CHAR_CAP) : null;
    items.push({
      sectionId: p.id,
      body:
        `Passage ${p.id} — ${p.philosopher} (${p.school}):\n` +
        (en ? `EN: ${en}\nGRC: ${grc}` : `GRC: ${grc}`),
    });
  }

  for (const ca of input.claimAnswers) {
    for (const c of ca.claims) {
      if (!c.sectionId) continue;
      const bits = [
        `Curated claim about ${c.subject ?? ca.philosopher} (${ca.topic}): ${c.property} = ${c.value}`,
        c.certainty !== "asserted" ? `certainty: ${c.certainty}` : null,
        c.accordingTo ? `according to ${c.accordingTo}` : null,
        c.note ? `note: ${c.note}` : null,
      ].filter(Boolean);
      items.push({ sectionId: c.sectionId, body: `[${c.sectionId}] ${bits.join("; ")}` });
    }
  }

  for (const v of input.verseAnswers) {
    const lines = (v.linesEn ?? v.linesGrc).join(" / ");
    items.push({
      sectionId: v.sectionId,
      body: `Curated verse on ${v.philosopher} [${v.sectionId}]: ${clip(lines, 600)}`,
    });
  }

  for (const s of input.sayingAnswers) {
    if (!s.sectionId) continue;
    items.push({
      sectionId: s.sectionId,
      body: `Curated saying of ${s.philosopher} [${s.sectionId}] (${s.topic}): ${clip(s.en, 600)}`,
    });
  }

  // Enforce the overall context budget, keeping earlier (higher-ranked) items.
  const kept: ContextItem[] = [];
  let used = 0;
  for (const item of items) {
    if (used + item.body.length > CONTEXT_CHAR_BUDGET) continue;
    used += item.body.length;
    kept.push(item);
  }
  return kept;
}

const SYSTEM_PROMPT = `You are the answer writer for a digital edition of Diogenes Laertius' "Lives of Eminent Philosophers" (R.D. Hicks translation).
Rules, in order of priority:
1. Answer ONLY from the context items provided by the user. Never use outside knowledge, and never invent facts, dates, or quotations.
2. If the context does not contain material relevant to the question, reply with a single short sentence saying the Lives passages retrieved do not answer the question. Do not speculate.
3. Cite every factual statement with the section id of its supporting context item, written exactly as [D.L. <id>] (e.g. [D.L. 2.5.21]). Use only ids that appear in the context; a claim you cannot cite must be omitted.
4. Where the sources conflict, report the rival accounts side by side, each with its citation.
5. ALWAYS answer in the language the question was asked in (e.g. a Greek question gets a Greek answer, a French question a French answer), translating the cited material as needed; keep the [D.L. <id>] citations unchanged. Quote ancient Greek only when the question asks for it.
6. Write 1-3 short paragraphs of plain prose (no headings, no bullet lists).`;

/** Matches [D.L. 2.5.21]-style inline citations. */
const CITATION_RE = /\[\s*D\.?L\.?\s+([0-9]+(?:\.[0-9a-zA-Z-]+)+)\s*\]/g;

/**
 * Guardrail: keep only citations whose section id was actually supplied in
 * the context. Unknown ids are stripped from the text (the sentence keeps
 * its prose) and reported so the route can log them.
 */
export function sanitizeCitations(
  text: string,
  allowedIds: ReadonlySet<string>,
): { text: string; citations: GeneratedCitation[]; dropped: string[] } {
  const citations: GeneratedCitation[] = [];
  const seen = new Set<string>();
  const dropped: string[] = [];
  const cleaned = text.replace(CITATION_RE, (whole, id: string) => {
    if (!allowedIds.has(id)) {
      dropped.push(id);
      return "";
    }
    if (!seen.has(id)) {
      seen.add(id);
      citations.push({ sectionId: id, label: `D.L. ${id}` });
    }
    return whole;
  });
  return {
    text: cleaned.replace(/[ \t]+([.,;:!?])/g, "$1").replace(/[ \t]{2,}/g, " ").trim(),
    citations,
    dropped,
  };
}

const LLM_TIMEOUT_MS = 45_000;

/**
 * Generate a grounded answer, or null when no LLM is configured or the
 * context is empty (nothing retrieved: the extractive no-results message is
 * the honest answer). Throws on transport/HTTP errors so the caller can log
 * and fall back.
 */
export async function generateAnswer(
  query: string,
  input: AskContextInput,
  config: LlmConfig | null = llmConfig(),
): Promise<GeneratedAnswer | null> {
  if (!config) return null;
  const items = buildContextItems(input);
  if (items.length === 0) return null;

  const userPrompt =
    `Question: ${query.slice(0, 1000)}\n\nContext items:\n\n` +
    items.map((i) => i.body).join("\n\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        max_completion_tokens: 1024,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) {
    throw new Error(`LLM request failed: HTTP ${resp.status}`);
  }
  const payload = (await resp.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  const raw = payload.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error("LLM returned an empty answer");

  const allowed = new Set(items.map((i) => i.sectionId));
  const { text, citations, dropped } = sanitizeCitations(raw, allowed);
  // Grounding contract: an answer that cites anything outside the supplied
  // context, or carries no valid citation at all, is not verifiably
  // grounded. Reject it entirely (the route falls back to the extractive
  // answer) rather than presenting unsupported prose as synthesized.
  if (dropped.length > 0) {
    logger.warn(
      { dropped, model: config.model },
      "Generated answer cited ids outside the supplied context; rejecting",
    );
    throw new Error(
      `LLM answer cited ids outside the supplied context (${dropped.join(", ")})`,
    );
  }
  if (citations.length === 0) {
    logger.warn(
      { model: config.model },
      "Generated answer carried no citations; rejecting as ungrounded",
    );
    throw new Error("LLM answer carried no citations to the supplied context");
  }
  if (text.length === 0) throw new Error("LLM answer empty after sanitizing");
  return { text, citations, model: config.model };
}
