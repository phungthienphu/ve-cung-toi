"use client";

import type { Grade } from "@shared/mathBossTypes";
import { drawFontClass } from "@/lib/drawFonts";
import { useMathBossRoom } from "@/lib/useMathBossRoom";
import { DarkBack } from "./DarkBack";
import { HostView } from "./HostView";
import { PlayerView } from "./PlayerView";

export default function MathBossRoom({ roomId, playerId, name, grade, role }: { roomId: string; playerId: string; name: string; grade: Grade; role: "host" | "player" }) {
  const room = useMathBossRoom(roomId, playerId, name, grade, role);

  if (!room.state) {
    return (
      <main className={`${drawFontClass} bg-mathboss relative flex min-h-app flex-col items-center justify-center gap-4 text-violet-200`}>
        <div className="absolute left-4 top-4">
          {role === "host" ? <DarkBack href="/math-quest/tutor" label="Trang gia sư" /> : <DarkBack href="/math-boss" label="Thoát" />}
        </div>
        <p>{room.connected ? "Đang tải phòng…" : "Đang kết nối…"}</p>
      </main>
    );
  }

  // A second tutor screen was turned away while the first is still live.
  if (role === "host" && room.joinedAs !== "host" && room.error) {
    return (
      <main className={`${drawFontClass} bg-mathboss flex min-h-app flex-col items-center justify-center gap-4 px-6 text-center text-white`}>
        <div className="text-6xl">🖥️</div>
        <p className="max-w-sm text-lg">{room.error}</p>
        <DarkBack href="/math-quest/tutor" label="Về trang gia sư" />
      </main>
    );
  }

  return (
    <>
      {role === "host" ? <HostView state={room.state} send={room.send} /> : <PlayerView state={room.state} selfId={playerId} send={room.send} />}
      {!room.connected && (
        <div className="fixed inset-x-0 top-0 z-50 bg-amber-400 py-1.5 text-center text-sm font-bold text-violet-950">Mất kết nối — đang thử lại…</div>
      )}
      {room.error && (
        <button
          onClick={room.clearError}
          className="animate-bounce-in fixed bottom-4 left-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-xl"
        >
          {room.error} · bấm để đóng
        </button>
      )}
    </>
  );
}
