'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { hillFontClass } from '@/features/hill/components/hillFonts';
import { getStoredName } from '@/lib/player';
import { HillFriendsPanel } from '@/features/hill/components/HillFriendsPanel';

// Where "Rời phòng" and shared links lead: the online-race finder on its own
// page. The same panel is a mode of the game's main menu.

export default function Page() {
  const [name, setName] = useState('');
  useEffect(() => setName(getStoredName()), []);

  return (
    <main className={`${hillFontClass} hk-online`}>
      <nav className="hk-online-nav">
        <Link href="/con-duong-hoang-kim">‹ Sảnh game</Link>
        <span>CON ĐƯỜNG HOÀNG KIM</span>
        <span>Đua cùng bạn</span>
      </nav>
      <div className="hk-online-grid">
        <section className="hk-online-intro">
          <p className="hk-online-eyebrow">RỦ HỘI, LÊN XE!</p>
          <h1>Đường gập ghềnh.<br />Có hội là vui.</h1>
          <p>2–6 tài xế cùng xuất phát. Lấy đà, nhảy qua dốc và húc nhau về đích!</p>
          <div className="hk-online-art">
            <Image src="/racing-with-me.png" alt="Những tay đua heo cùng vượt đường địa hình" fill priority sizes="(max-width: 760px) 100vw, 55vw" className="object-cover" />
            <span>🏁 Cùng một đường đua · Mỗi người một cách vượt</span>
          </div>
        </section>
        <section className="hk-online-card" aria-label="Tạo hoặc vào phòng đua">
          <p className="hk-online-eyebrow">CHỌN HỘI CỦA BẠN</p>
          <h2>Sẵn sàng xuất phát?</h2>
          <p>Tạo phòng rồi gửi mã cho bạn bè, hoặc nhập mã để vào hội.</p>
          <HillFriendsPanel name={name} onName={setName} />
        </section>
      </div>
    </main>
  );
}
