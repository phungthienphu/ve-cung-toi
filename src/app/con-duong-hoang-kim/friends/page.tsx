'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { drawFontClass } from '@/features/draw/fonts';
import { getStoredName } from '@/lib/player';
import { HillFriendsPanel } from '@/features/hill/components/HillFriendsPanel';

// Where "Rời phòng" and shared links lead: the online-race finder on its own
// page. The same panel is a mode of the game's main menu.

export default function Page() {
  const [name, setName] = useState('');
  useEffect(() => setName(getStoredName()), []);

  return (
    <main className={`${drawFontClass} min-h-dvh bg-emerald-950 text-emerald-50`}>
      <div className="relative h-44 overflow-hidden sm:h-56">
        <Image src="/racing-with-me.png" alt="" fill priority sizes="100vw" className="object-cover" style={{ objectPosition: '50% 42%' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-emerald-950" />
        <Link
          href="/con-duong-hoang-kim"
          className="absolute left-3 flex items-center gap-1 rounded-full bg-black/45 px-3 py-2 text-sm font-bold backdrop-blur hover:bg-black/60"
          style={{ top: 'max(12px, env(safe-area-inset-top))' }}
        >
          ‹ Sảnh game
        </Link>
      </div>

      <div className="relative mx-auto -mt-16 max-w-xl px-4 pb-12">
        <p className="font-draw-display text-sm font-extrabold uppercase tracking-[0.25em] text-amber-300">Con Đường Hoàng Kim</p>
        <h1 className="font-draw-display text-4xl font-extrabold leading-tight drop-shadow">Đua cùng bạn bè</h1>
        <p className="mt-1 text-sm text-emerald-100/75">2–6 tài xế · xuất phát chồng tháp · xe va chạm thật · giẫm đầu nhau mà vượt</p>
        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
          <HillFriendsPanel name={name} onName={setName} />
        </section>
      </div>
    </main>
  );
}
