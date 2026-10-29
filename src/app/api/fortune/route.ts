import { NextResponse } from "next/server";
import { FORTUNE_REFUSED_LINE, FORTUNE_RESET, offlineReading } from "@/components/cards/fortune";
import { parseFortuneRequest, saveReading, takeReading, visitorId } from "@/lib/fortuneAi";
import { readingSource } from "@/lib/fortuneProviders";
import { dbConnect } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST { cards: number[], topic, question?, name? } — the fortune teller's
// reading of the drawn cards, streamed back as plain UTF-8 text.
// FORTUNE_RESET in the stream means "discard what you have so far" (another
// model took over, or the reading was declined).
// Errors before any text: 400 bad_request, 429 rate_limited / daily_limit,
// 503/502 unavailable — the client then shows its offline reading instead.
// Every reading, AI or offline, is saved to the admin's history.
export async function POST(req: Request) {
  // Without the database there is neither a cap on spend nor a history.
  if (!process.env.MONGODB_URI) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const input = parseFortuneRequest(await req.json().catch(() => null));
  if (!input) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const visitor = visitorId(req);
  let quota: Awaited<ReturnType<typeof takeReading>>;
  try {
    await dbConnect();
    quota = await takeReading(visitor);
  } catch (error) {
    console.error("[fortune] rate limit check failed", error);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  // No AI reading: the client shows the offline one, which is computed the same way here for the history.
  const offline = async (reason: string, error: string, status: number) => {
    const text = offlineReading(input.cards, input.name, input.topic, input.question);
    await saveReading(input, { text, source: "offline", status: "done", reason, model: "", visitor, count: quota.count });
    return NextResponse.json({ error }, { status });
  };
  if (!quota.ok) return offline(quota.reason === "hour" ? "rate_limited" : "daily_limit", quota.reason === "hour" ? "rate_limited" : "daily_limit", 429);
  const source = readingSource();
  if (!source) return offline("no_ai", "unavailable", 503);

  const abort = new AbortController();
  const chunks = source.read(input, abort.signal);
  // Wait for the first chunk so a bad key / no credit / unreachable endpoint
  // becomes a proper error response instead of a broken 200 stream.
  let first: IteratorResult<string>;
  try {
    first = await chunks.next();
  } catch (error) {
    console.error("[fortune] AI request failed", error);
    return offline("ai_error", "unavailable", 502);
  }

  const encoder = new TextEncoder();
  let text = "";
  const save = (status: "done" | "interrupted") =>
    saveReading(input, {
      text,
      source: "ai",
      status: status === "done" && text === FORTUNE_REFUSED_LINE ? "refused" : status,
      reason: "",
      model: source.model,
      visitor,
      count: quota.count,
    });

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (let result = first; !result.done; result = await chunks.next()) {
          controller.enqueue(encoder.encode(result.value));
          text += result.value;
          const reset = text.lastIndexOf(FORTUNE_RESET);
          if (reset >= 0) text = text.slice(reset + FORTUNE_RESET.length);
        }
        // Saved before closing: on serverless the function may stop once the response ends.
        await save("done");
        controller.close();
      } catch (error) {
        if (!abort.signal.aborted) console.error("[fortune] stream failed", error);
        await save("interrupted");
        try {
          controller.error(error);
        } catch {
          // Already cancelled by the visitor.
        }
      }
    },
    cancel() {
      // The visitor left: stop generating (and paying for) the rest.
      abort.abort();
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
