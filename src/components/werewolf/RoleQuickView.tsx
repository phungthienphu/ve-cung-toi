import type { WerewolfRole } from "@shared/werewolfTypes";
import { GAME_CONTENT } from "./gameContent";
import { RoleArtwork } from "./ui";

export function RoleQuickView({ role, onClose }: { role: WerewolfRole; onClose: () => void }) {
  const content = GAME_CONTENT.roleReveal.roles[role];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Vai của tôi">
      <button className="absolute inset-0" onClick={onClose} aria-label="Đóng" />
      <section className="relative z-10 w-full max-w-sm rounded-3xl border border-[var(--ww-border)] bg-[var(--ww-surface-strong)] p-4 text-center shadow-2xl">
        <RoleArtwork role={role} className="mx-auto max-h-[68vh] w-auto rounded-2xl" />
        <h2 className="mt-4 font-ww-display text-xl font-bold text-[var(--ww-text)]">{content.title}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--ww-text-muted)]">{content.instruction}</p>
        <button onClick={onClose} className="mt-4 w-full rounded-xl bg-[var(--ww-accent-strong)] py-3 font-semibold text-[var(--ww-accent-ink)] transition hover:opacity-90">Đóng lại</button>
      </section>
    </div>
  );
}

