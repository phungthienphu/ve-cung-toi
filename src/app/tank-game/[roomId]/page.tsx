"use client";

import Link from 'next/link';
import Image from 'next/image';
import { homeFonts } from '@/features/home/fonts';
import '@/features/tank/lobby.css';
import { use, useEffect, useState } from "react";
import { getOrCreatePlayerId, getStoredName, setStoredName } from "@/lib/player";
import { playClick } from "@/lib/sound";
import { TANK_COLORS, TANK_SKINS, TANK_SKIN_LABELS, skinForColor } from "@shared/tank/types";
import TankGameRoom from "@/features/tank/components/TankGameRoom";
import TankPreview from "@/features/tank/components/TankPreview";
import { ULTIMATE_UI } from "@/features/tank/components/ultimateUi";

export default function TankRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(TANK_COLORS[0]);

  useEffect(() => {
    setPlayerId(getOrCreatePlayerId());
    setName(getStoredName());
    if (sessionStorage.getItem(`vct_tank_confirmed:${roomId}`) === "1") {
      const savedColor = sessionStorage.getItem(`vct_tank_color:${roomId}`);
      if (savedColor) setColor(savedColor);
      setReady(true);
    }
  }, [roomId]);

  if (!playerId) return null;

  function confirm() {
    const trimmed = name.trim();
    if (!trimmed) return;
    playClick();
    setStoredName(trimmed);
    sessionStorage.setItem(`vct_tank_confirmed:${roomId}`, "1");
    sessionStorage.setItem(`vct_tank_color:${roomId}`, color);
    setName(trimmed);
    setReady(true);
  }

  if (!ready) {
    const skin = skinForColor(color);
    const ultimate = ULTIMATE_UI[skin];
    return <main className={`${homeFonts} tank-lobby-preview`}>
      <nav className="tl-nav" aria-label="Điều hướng chọn xe"><Link href="/tank-game">‹ Sảnh Xe Tăng</Link><span>02 / CHỌN CHIẾN XA</span><span className="ts-room">{roomId === 'local' ? 'LUYỆN TẬP' : `PHÒNG ${roomId.toUpperCase()}`}</span></nav>
      <div className="ts-layout">
        <section className="ts-showcase" aria-label="Xe tăng đang chọn">
          <div className="tl-eyebrow">CHIẾN XA CỦA BẠN</div><h1>{TANK_SKIN_LABELS[skin]}<span>.</span></h1>
          <div className="ts-stage"><div className="ts-orbit" /><span className="ts-coordinate">GARAGE / 0{TANK_SKINS.indexOf(skin)+1}</span><TankPreview color={color} size={260} /><span className="ts-ready-tag">● Sẵn sàng xuất kích</span></div>
          <div className="ts-ability" aria-live="polite"><span className="ts-ability-icon" aria-hidden>{ultimate.icon}</span><div><span className="tl-eyebrow">KỸ NĂNG ĐẶC BIỆT · PHÍM R</span><p>{ultimate.label}</p></div></div>
          <p className="ts-hint">Mỗi xe một tuyệt chiêu. Chọn đúng chất của bạn.</p>
        </section>
        <section className="tl-play ts-picker" aria-labelledby="ts-heading"><span className="tl-step">CHỌN XE, ĐẶT TÊN, VÀO TRẬN.</span><h2 id="ts-heading">Bạn lái chiếc nào?</h2><p className="tl-muted">8 chiến xa. 8 cách khuấy đảo chiến trường.</p>
          <div className="ts-grid" role="group" aria-label="Chọn loại xe tăng">{TANK_COLORS.map((c,i)=>{
            const selected = color === c;
            return <button key={c} className="ts-tank-card" aria-pressed={selected} aria-label={TANK_SKIN_LABELS[TANK_SKINS[i]]} onClick={()=>{playClick();setColor(c);}}><span className="ts-card-number">0{i+1}</span><Image src={`/tank/Retina/tank_${TANK_SKINS[i]}.png`} width={70} height={70} alt="" /><span className="ts-card-name">{TANK_SKIN_LABELS[TANK_SKINS[i]]}</span><span className="ts-card-check" aria-hidden>{selected ? '✓' : ''}</span></button>;
          })}</div>
          <form className="ts-confirm" onSubmit={event=>{event.preventDefault();confirm();}}><label htmlFor="ts-name">Tên của bạn trên chiến trường</label><input id="ts-name" autoComplete="nickname" placeholder="Ví dụ: Phú bá đạo" maxLength={20} value={name} onChange={event=>setName(event.target.value)} required />
            <button type="submit" className="tl-create" disabled={!name.trim()}><span>{roomId === 'local' ? 'Vào luyện tập' : 'Vào phòng'}<small>{TANK_SKIN_LABELS[skin]} · {name.trim() || 'Đặt tên để xuất kích'}</small></span><span aria-hidden>→</span></button></form>
        </section>
      </div>
      <footer className="tl-footer"><span>CHƠI CÙNG TÔI</span><span>Xe đã sẵn sàng. Còn bạn?</span></footer>
    </main>;
  }

  return <TankGameRoom roomId={roomId} playerId={playerId} name={name} color={color} />;
}
