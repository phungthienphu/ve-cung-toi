"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

const STYLE = "inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-bold text-violet-100 transition hover:bg-white/15";

/**
 * The "‹ Parent" button on the dark Quái Máy Tính screens — same place and
 * look everywhere. Pass `confirmText` while a fight is live so a stray tap
 * can't pull someone out of it.
 */
export function DarkBack({ href, label, confirmText }: { href: string; label: string; confirmText?: string | null }) {
  const router = useRouter();
  if (!confirmText) {
    return (
      <Link href={href} className={STYLE}>
        <span aria-hidden>‹</span> {label}
      </Link>
    );
  }
  return (
    <button onClick={() => window.confirm(confirmText) && router.push(href)} className={STYLE}>
      <span aria-hidden>‹</span> {label}
    </button>
  );
}
