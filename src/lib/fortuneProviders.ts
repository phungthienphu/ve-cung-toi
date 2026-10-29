import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { FORTUNE_REFUSED_LINE, FORTUNE_RESET } from "@/components/cards/fortune";
import { FORTUNE_SYSTEM_PROMPT, fortuneUserMessage, type FortuneRequest } from "@/lib/fortuneAi";

// Where the fortune teller's AI reading comes from. Each source yields the
// reading as text chunks, with FORTUNE_RESET meaning "discard what came so
// far". Picked by which credentials are set:
//   AI_ROUTER_API_KEY + AI_ROUTER_BASE_URL (+ AI_ROUTER_MODEL) — an
//     OpenAI-compatible Responses API endpoint, e.g. a company AI router;
//   ANTHROPIC_API_KEY — Claude via the Anthropic API.

export type ReadingSource = (input: FortuneRequest, signal: AbortSignal) => AsyncGenerator<string>;

const MAX_OUTPUT_TOKENS = 2000;

let router: OpenAI | null = null;
let anthropic: Anthropic | null = null;

async function* routerReading(input: FortuneRequest, signal: AbortSignal): AsyncGenerator<string> {
  router ??= new OpenAI({ apiKey: process.env.AI_ROUTER_API_KEY, baseURL: process.env.AI_ROUTER_BASE_URL });
  const stream = await router.responses.create(
    {
      model: process.env.AI_ROUTER_MODEL || "gpt-6.1-sol",
      instructions: FORTUNE_SYSTEM_PROMPT,
      input: fortuneUserMessage(input),
      reasoning: { effort: "low" },
      max_output_tokens: MAX_OUTPUT_TOKENS,
      store: false,
      stream: true,
    },
    { signal },
  );
  for await (const event of stream) {
    if (event.type === "response.output_text.delta") yield event.delta;
    else if (event.type === "response.refusal.done") yield FORTUNE_RESET + FORTUNE_REFUSED_LINE;
    else if (event.type === "error") throw new Error(`AI router error: ${event.message}`);
    else if (event.type === "response.failed") throw new Error(`AI router failed: ${event.response.error?.message ?? "unknown"}`);
  }
}

async function* claudeReading(input: FortuneRequest, signal: AbortSignal): AsyncGenerator<string> {
  anthropic ??= new Anthropic();
  const stream = anthropic.beta.messages.stream(
    {
      model: "claude-opus-5-5",
      max_tokens: MAX_OUTPUT_TOKENS,
      output_config: { effort: "low" },
      // If a safety classifier declines, the API retries on its recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: FORTUNE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: fortuneUserMessage(input) }],
    },
    { signal },
  );
  for await (const event of stream) {
    // A fallback block means another model took over from scratch.
    if (event.type === "content_block_start" && event.content_block.type === "fallback") yield FORTUNE_RESET;
    else if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
  }
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") yield FORTUNE_RESET + FORTUNE_REFUSED_LINE;
}

/** The configured source, or null when no AI credentials are set (the page then uses its offline reading). */
export function readingSource(): ReadingSource | null {
  if (process.env.AI_ROUTER_API_KEY && process.env.AI_ROUTER_BASE_URL) return routerReading;
  if (process.env.ANTHROPIC_API_KEY) return claudeReading;
  return null;
}
