import type { GenerateEvent } from "@/lib/mathQuest/exerciseTypes";

// The exercise maker's calls to /api/math-quest/exercises.

const ENDPOINT = "/api/math-quest/exercises";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number; locked: boolean };

export async function postExercises<T>(payload: Record<string, unknown>): Promise<ApiResult<T>> {
  try {
    const res = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data: body as T };
    return { ok: false, error: (body as { error?: string }).error ?? "Có lỗi xảy ra.", status: res.status, locked: (body as { locked?: boolean }).locked === true };
  } catch {
    return { ok: false, error: "Không kết nối được máy chủ.", status: 0, locked: false };
  }
}

/** Runs a generate / revise call, handing each streamed line to `onEvent`. Always ends with a result or an error event, unless aborted. */
export async function streamGenerate(payload: Record<string, unknown>, onEvent: (event: GenerateEvent) => void, signal: AbortSignal) {
  let finished = false;
  const handle = (event: GenerateEvent) => {
    if (event.type === "set" || event.type === "exercise" || event.type === "error") finished = true;
    onEvent(event);
  };
  try {
    const res = await fetch(`${ENDPOINT}/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal });
    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return handle({ type: "error", error: body.error ?? "Có lỗi xảy ra." });
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) handle(JSON.parse(line) as GenerateEvent);
      if (done) break;
    }
  } catch (error) {
    if (signal.aborted) return;
    console.error(error);
  }
  if (!finished && !signal.aborted) handle({ type: "error", error: "Mất kết nối giữa chừng — thử lại nhé." });
}
