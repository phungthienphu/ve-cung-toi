"use client";
import Image from 'next/image';
import { homeFonts } from '@/features/home/fonts';
import { HomeIcon } from '@/features/home/components/HomeIcon';
import '@/features/tank/lobby.css';


import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { makeRoomId } from "@/lib/player";
import { playClick } from "@/lib/sound";
import { KILL_TARGET, MAX_TANK_PLAYERS, TANK_ROOM_MODE_LABELS, type TankRoomListing } from "@shared/tank/types";

// Room list is a nice-to-have, not core gameplay — poll instead of a
// websocket, and just show whatever's in `rooms` (starting empty) if a
// fetch ever fails, rather than surfacing an error for something this minor.
const ROOM_LIST_POLL_MS = 4000;

export default function TankGameHomePage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [rooms, setRooms] = useState<TankRoomListing[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadRooms() {
      try {
        const res = await fetch("/api/tank-rooms", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as TankRoomListing[];
        if (!cancelled) setRooms(data);
      } catch {
        // Keep showing whatever we already had rather than clearing the list.
      }
    }
    loadRooms();
    const interval = setInterval(loadRooms, ROOM_LIST_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  async function handleRefresh() {
    playClick();
    setRefreshing(true);
    try {
      const res = await fetch("/api/tank-rooms", { cache: "no-store" });
      if (res.ok) setRooms((await res.json()) as TankRoomListing[]);
    } catch {
      // Ignore — the auto-poll will retry shortly anyway.
    } finally {
      setRefreshing(false);
    }
  }

  function handleCreate() {
    playClick();
    router.push(`/tank-game/${makeRoomId()}`);
  }

  function handleJoin(code?: string) {
    playClick();
    const target = (code ?? joinCode).trim().toUpperCase();
    if (!target) return alert("Nhập mã phòng!");
    router.push(`/tank-game/${target}`);
  }

  return <main className={`${homeFonts} tank-lobby-preview`}>
    <nav className="tl-nav" aria-label="Điều hướng sảnh"><Link href="/">‹ Chơi Cùng Tôi</Link><span>SẢNH TRÒ CHƠI / XE TĂNG</span><Link href="/leaderboard?game=tank">Lịch sử trận ↗</Link></nav>
    <div className="tl-layout">
      <section className="tl-feature">
        <div className="tl-art"><Image src="/tank/tank-bg.png" alt="Đội xe tăng giữa chiến trường" fill priority sizes="(max-width:800px) 100vw, 60vw" /><span className="tl-art-badge"><HomeIcon name="game" /> Đấu trường đã sẵn sàng</span></div>
        <div className="tl-story"><div className="tl-eyebrow">VÀO TRẬN THÔI!</div><h1>Đại Chiến <br />Xe Tăng<span>.</span></h1><p>Lái thật khéo, ngắm thật chuẩn.<br />Rủ hội bạn vào một trận cho ra trò.</p><div className="tl-facts"><span><HomeIcon name="users" /> 1–8 người</span><span><HomeIcon name="bot" /> Có bot</span><span>{KILL_TARGET} điểm để thắng</span></div></div>
      </section>
      <section className="tl-play" aria-labelledby="tl-play-heading">
        <span className="tl-step">01 / CHỌN CÁCH CHƠI</span><h2 id="tl-play-heading">Lên xe nào.</h2><p className="tl-muted">Một mình hay cả hội, đều có chỗ.</p>
        <button className="tl-create" onClick={handleCreate}><span><HomeIcon name="users" /> Chơi cùng bạn bè<small>Tạo phòng mới · gửi link là vào</small></span><span aria-hidden>↗</span></button>
        <Link className="tl-practice" href="/tank-game/local" onClick={playClick}><span><HomeIcon name="bot" /> Đấu với bot<small>Chơi ngay tại máy · tối đa 5 bot</small></span><span aria-hidden>→</span></Link>
        <div className="tl-join"><label htmlFor="tl-code">Có mã phòng rồi?</label><div><input id="tl-code" value={joinCode} onChange={e=>setJoinCode(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleJoin()} maxLength={8} placeholder="NHẬP MÃ PHÒNG" autoComplete="off" /><button onClick={()=>handleJoin()} aria-label="Vào phòng bằng mã">Vào →</button></div></div>
        <div className="tl-room-heading"><h3>Phòng đang mở <span>{rooms.length}</span></h3><button onClick={handleRefresh} disabled={refreshing}>{refreshing?'Đang tìm…':'Làm mới ↻'}</button></div>
        {rooms.length ? <ul className="tl-rooms">{rooms.map(room=><li key={room.roomId}><button onClick={()=>handleJoin(room.roomId)}><strong>{room.roomId}</strong><span>{TANK_ROOM_MODE_LABELS[room.mode]} · {room.playerCount}/{MAX_TANK_PLAYERS}</span><span aria-hidden>→</span></button></li>)}</ul> : <div className="tl-empty"><HomeIcon name="game" /><p>Chiến trường đang yên ắng.<br /><strong>Tạo phòng, gọi hội bạn vào phá thôi!</strong></p></div>}
        <p className="tl-note">Không tài khoản. Không cài đặt. Chỉ cần chơi.</p>
      </section>
    </div>
    <footer className="tl-footer"><span>CHƠI CÙNG TÔI</span><span>Vui là chính. Thắng thì càng vui.</span></footer>
  </main>;
}
