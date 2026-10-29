import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { FORTUNE_RESET, FORTUNE_REFUSED_LINE } from "@/components/cards/fortune";
import { FORTUNE_SYSTEM_PROMPT, clientIp, fortuneUserMessage, parseFortuneRequest, takeReading } from "@/lib/fortuneAi";
import { dbConnect } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

let anthropic: Anthropic | null = null;

// POST { cards: number[], topic, question?, name? } — the fortune teller's
// reading of the drawn cards, streamed back as plain UTF-8 text.
// FORTUNE_RESET in the stream means "discard what you have so far" (the
// server-side fallback model took over, or the reading was declined).
// Errors before any text: 400 bad_request, 429 rate_limited / daily_limit,
// 503/502 unavailable — the client then shows its offline reading instead.
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY || !process.env.MONGODB_URI) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  const input = parseFortuneRequest(await req.json().catch(() => null));
  if (!input) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  let quota: Awaited<ReturnType<typeof takeReading>>;
  try {
    await dbConnect();
    quota = await takeReading(clientIp(req));
  } catch (error) {
    // Without the counter there is no cap on spend, so no reading either.
    console.error("[fortune] rate limit check failed", error);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  if (!quota.ok) return NextResponse.json({ error: quota.reason === "hour" ? "rate_limited" : "daily_limit" }, { status: 429 });

  anthropic ??= new Anthropic();
  const stream = anthropic.beta.messages.stream({
    model: "claude-opus-5-5",
    max_tokens: 2000,
    output_config: { effort: "low" },
    // If a safety classifier declines, the API retries on its recommended fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: FORTUNE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: fortuneUserMessage(input) }],
  });

  // Wait for the first event so a bad key / no credit / overload becomes a
  // proper error response instead of a broken 200 stream.
  const events = stream[Symbol.asyncIterator]();
  let first: Awaited<ReturnType<typeof events.next>>;
  try {
    first = await events.next();
  } catch (error) {
    console.error("[fortune] Claude request failed", error);
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(text));
      try {
        for (let result = first; !result.done; result = await events.next()) {
          const event = result.value;
          if (event.type === "content_block_start" && event.content_block.type === "fallback") send(FORTUNE_RESET);
          else if (event.type === "content_block_delta" && event.delta.type === "text_delta") send(event.delta.text);
        }
        const message = await stream.finalMessage();
        if (message.stop_reason === "refusal") send(FORTUNE_RESET + FORTUNE_REFUSED_LINE);
        controller.close();
      } catch (error) {
        console.error("[fortune] stream failed", error);
        controller.error(error);
      }
    },
    cancel() {
      // The visitor left: stop generating (and paying for) the rest.
      stream.abort();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Fortune-Remaining": String(quota.remaining),
    },
  });
}
