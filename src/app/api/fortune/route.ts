import { NextResponse } from "next/server";
import { clientIp, parseFortuneRequest, takeReading } from "@/lib/fortuneAi";
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
export async function POST(req: Request) {
  const source = readingSource();
  if (!source || !process.env.MONGODB_URI) return NextResponse.json({ error: "unavailable" }, { status: 503 });
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

  const abort = new AbortController();
  const chunks = source(input, abort.signal);
  // Wait for the first chunk so a bad key / no credit / unreachable endpoint
  // becomes a proper error response instead of a broken 200 stream.
  let first: IteratorResult<string>;
  try {
    first = await chunks.next();
  } catch (error) {
    console.error("[fortune] AI request failed", error);
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (let result = first; !result.done; result = await chunks.next()) controller.enqueue(encoder.encode(result.value));
        controller.close();
      } catch (error) {
        if (!abort.signal.aborted) console.error("[fortune] stream failed", error);
        controller.error(error);
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
