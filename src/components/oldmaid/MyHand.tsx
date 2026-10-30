"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { JOKER, rankOf, type OldMaidHandCard } from "@shared/oldMaidTypes";
import { CardFace } from "@/components/cards/PlayingCard";
import { cardInfo } from "@/components/cards/deck";

// Your own hand, face up along the bottom of the screen (crisp HTML cards, the
// same art as Bà Đồng's table). Slot 0 is on your left, as on the table.
// Tap a card to dangle it ("nhử"); drag sideways to re-order. While someone
// draws from you, the card they're pointing at lights up live.

export function JokerFace({ className = "" }: { className?: string }) {
  return (
    <span className={`pc-side pc-static flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#ffe4ee] to-[#ffb3cb] text-[#be185d] ${className}`}>
      <span className="absolute left-[0.35em] top-[0.25em] text-[0.7em] font-black leading-[0.95]">
        J<br />O<br />K
      </span>
      <span className="text-[2.2em] leading-none">🐷</span>
      <span className="mt-[0.15em] font-serif text-[0.85em] font-black tracking-wider">HEO</span>
    </span>
  );
}

function Face({ card }: { card: number }) {
  return card === JOKER ? <JokerFace /> : <CardFace id={card} className="pc-static" />;
}

const cardLabel = (card: number) => (card === JOKER ? "Joker — con heo" : cardInfo(card).name);

interface Ghost {
  key: string;
  card: number;
  left: number;
}

export function MyHand({
  cards,
  drawnId,
  pointedSlot,
  pointerName,
  teasedSlot,
  canTease,
  canArrange,
  onTease,
  onReorder,
  onShuffle,
}: {
  cards: OldMaidHandCard[];
  drawnId?: string;
  /** Slot the drawer is pointing at right now (you're being drawn from). */
  pointedSlot: number | null;
  pointerName: string;
  teasedSlot: number | null;
  canTease: boolean;
  canArrange: boolean;
  onTease: (slot: number | null) => void;
  onReorder: (order: string[]) => void;
  onShuffle: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  const [drag, setDrag] = useState<{ id: string; from: number; startX: number; dx: number; moved: boolean } | null>(null);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const previous = useRef<{ cards: OldMaidHandCard[]; lefts: Map<string, number> }>({ cards: [], lefts: new Map() });
  const [fresh, setFresh] = useState<string | null>(null);

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const cardW = Math.round(Math.max(54, Math.min(92, width / 5.2)));
  const cardH = Math.round(cardW * 1.4);
  const n = cards.length;
  const spacing = n > 1 ? Math.min(cardW * 0.78, (width - cardW - 8) / (n - 1)) : 0;
  const startX = (width - (cardW + spacing * Math.max(0, n - 1))) / 2;

  // Where each card sits, with the dragged one following the pointer and the others making room.
  const target = drag ? Math.max(0, Math.min(n - 1, Math.round(drag.from + drag.dx / Math.max(spacing, 1)))) : -1;
  const order = cards.map((card) => card.id);
  if (drag && drag.moved && target !== drag.from) {
    order.splice(drag.from, 1);
    order.splice(target, 0, drag.id);
  }
  const leftOf = (id: string) => startX + order.indexOf(id) * spacing;

  // Cards that just left your hand (drawn from you, or paired off) fly away instead of vanishing.
  useEffect(() => {
    const before = previous.current;
    const ids = new Set(cards.map((card) => card.id));
    const gone = before.cards.filter((card) => !ids.has(card.id));
    if (gone.length && before.cards.length) {
      const now = Date.now();
      setGhosts((current) => [...current, ...gone.map((card) => ({ key: `${card.id}-${now}`, card: card.card, left: before.lefts.get(card.id) ?? width / 2 }))]);
      window.setTimeout(() => setGhosts((current) => current.filter((ghost) => !ghost.key.endsWith(`-${now}`))), 600);
    }
    previous.current = { cards, lefts: new Map(cards.map((card, index) => [card.id, startX + index * spacing])) };
    // Only when the hand itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards]);

  useEffect(() => {
    if (!drawnId) return;
    setFresh(drawnId);
    const timer = window.setTimeout(() => setFresh(null), 2600);
    return () => window.clearTimeout(timer);
  }, [drawnId, cards]);

  const dragRef = useRef(drag);
  dragRef.current = drag;
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const move = (event: PointerEvent) =>
      setDrag((current) => (current ? { ...current, dx: event.clientX - current.startX, moved: current.moved || Math.abs(event.clientX - current.startX) > 8 } : current));
    const up = () => {
      const current = dragRef.current;
      setDrag(null);
      if (!current) return;
      const from = cards.findIndex((card) => card.id === current.id);
      if (from < 0) return; // the card left your hand mid-drag
      if (!current.moved) {
        if (canTease) onTease(teasedSlot === from ? null : from);
        return;
      }
      const to = Math.max(0, Math.min(cards.length - 1, Math.round(from + current.dx / Math.max(spacing, 1))));
      if (!canArrange || to === from) return;
      const next = cards.map((card) => card.id);
      next.splice(from, 1);
      next.splice(to, 0, current.id);
      onReorder(next);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragging, cards, spacing, canArrange, canTease, onReorder, onTease, teasedSlot]);

  const sortByRank = () => {
    const sorted = [...cards].sort((a, b) => (a.card === JOKER ? 99 : rankOf(a.card)) - (b.card === JOKER ? 99 : rankOf(b.card)) || a.card - b.card);
    onReorder(sorted.map((card) => card.id));
  };

  return (
    <div className="pointer-events-none flex w-full flex-col items-center">
      {n > 0 && canArrange && (
        <div className="pointer-events-auto mb-1.5 flex items-center gap-1.5">
          <button type="button" onClick={onShuffle} className="rounded-full bg-black/55 px-3 py-1.5 text-xs font-bold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-black/70 active:scale-95">
            🔀 Xào
          </button>
          <button type="button" onClick={sortByRank} className="rounded-full bg-black/55 px-3 py-1.5 text-xs font-bold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-black/70 active:scale-95">
            🔢 Xếp
          </button>
          {canTease && (
            <span className="hidden rounded-full bg-black/40 px-2.5 py-1 text-[11px] text-white/75 sm:inline">Bấm 1 lá để nhử · kéo để đổi chỗ</span>
          )}
        </div>
      )}
      <div ref={box} className="relative w-full max-w-3xl" style={{ height: cardH + 34 }}>
        {cards.map((card, index) => {
          const pointed = pointedSlot === index;
          const teased = teasedSlot === index;
          const isDragged = drag?.id === card.id && drag.moved;
          const left = isDragged ? startX + drag!.from * spacing + drag!.dx : leftOf(card.id);
          const lift = pointed ? -26 : teased ? -34 : 0;
          return (
            <button
              key={card.id}
              type="button"
              aria-label={`${cardLabel(card.card)}${teased ? " (đang nhử)" : ""}`}
              onPointerDown={(event) => {
                event.preventDefault();
                setDrag({ id: card.id, from: index, startX: event.clientX, dx: 0, moved: false });
              }}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && canTease) {
                  event.preventDefault();
                  onTease(teased ? null : index);
                }
              }}
              className={`om-hand-card pointer-events-auto absolute bottom-2 touch-none select-none ${isDragged ? "z-50 cursor-grabbing" : "cursor-pointer"} ${
                pointed ? "om-pointed" : ""
              } ${card.id === fresh ? "om-fresh" : ""}`}
              style={{
                left,
                width: cardW,
                height: cardH,
                fontSize: cardW / 5,
                zIndex: isDragged ? 50 : index + 1,
                transform: `translateY(${lift}px) rotate(${(index - (n - 1) / 2) * (n > 1 ? Math.min(3, 30 / n) : 0)}deg)`,
                transition: isDragged ? "none" : undefined,
              }}
            >
              <span className="relative block h-full w-full">
                <Face card={card.card} />
              </span>
              {pointed && (
                <span className="om-banner absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-300 px-2.5 py-1 text-[11px] font-black text-amber-950 shadow-lg">
                  👀 {pointerName} đang nhắm
                </span>
              )}
              {teased && !pointed && (
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-pink-500 px-2 py-0.5 text-[10px] font-black text-white shadow">☝️ nhử</span>
              )}
              {card.id === fresh && (
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-black text-emerald-950 shadow">
                  ✨ Mới
                </span>
              )}
            </button>
          );
        })}
        {ghosts.map((ghost) => (
          <span key={ghost.key} className="om-leave absolute bottom-2" style={{ left: ghost.left, width: cardW, height: cardH, fontSize: cardW / 5 }}>
            <span className="relative block h-full w-full">
              <Face card={ghost.card} />
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
