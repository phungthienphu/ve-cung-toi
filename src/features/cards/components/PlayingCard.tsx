import { PIPS, cardInfo, type CardInfo } from "./deck";

// Card art drawn in HTML/CSS so it stays crisp at any size. Everything is in
// `em`: the card's font-size (set by the parent to width / 5) scales it all.

const FACE_GLYPH: Record<string, string> = { J: "♞", Q: "♛", K: "♚" };

function Corner({ info, flipped = false }: { info: CardInfo; flipped?: boolean }) {
  return (
    <span
      className={`absolute flex flex-col items-center leading-none ${flipped ? "bottom-[0.3em] right-[0.32em] rotate-180" : "left-[0.32em] top-[0.3em]"}`}
    >
      <span className={`font-serif font-bold ${info.rank === "10" ? "-tracking-[0.08em] text-[0.92em]" : "text-[1em]"}`}>{info.rank}</span>
      <span className="mt-[0.06em] text-[0.82em]">{info.suit.symbol}</span>
    </span>
  );
}

function Center({ info }: { info: CardInfo }) {
  if (info.rank === "A") {
    return (
      <span className="absolute inset-0 flex items-center justify-center">
        <span className={`leading-none drop-shadow-[0_0.04em_0_rgba(0,0,0,0.15)] ${info.suit.id === "spades" ? "text-[3em]" : "text-[2.5em]"}`}>{info.suit.symbol}</span>
      </span>
    );
  }
  if (info.isFace) {
    return (
      <span
        className={`absolute inset-x-[19%] inset-y-[15%] flex flex-col items-center justify-center rounded-[0.25em] border-[0.07em] border-current ${
          info.suit.red ? "bg-[repeating-linear-gradient(45deg,#fff1f2_0_0.18em,#ffe4e6_0.18em_0.36em)]" : "bg-[repeating-linear-gradient(45deg,#f8fafc_0_0.18em,#e2e8f0_0.18em_0.36em)]"
        }`}
      >
        <span className="text-[1.9em] leading-none">{FACE_GLYPH[info.rank]}</span>
        <span className="mt-[0.1em] font-serif text-[0.95em] font-bold leading-none">{info.rank}</span>
        <span className="text-[0.85em] leading-none">{info.suit.symbol}</span>
      </span>
    );
  }
  return (
    <>
      {PIPS[info.rank].map(([x, y], index) => (
        <span
          key={index}
          className="absolute text-[0.95em] leading-none"
          style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%)${y > 50 ? " rotate(180deg)" : ""}` }}
        >
          {info.suit.symbol}
        </span>
      ))}
    </>
  );
}

export function CardFace({ id, className = "" }: { id: number; className?: string }) {
  const info = cardInfo(id);
  return (
    <span className={`pc-side pc-face ${info.suit.red ? "text-[#d61f3c]" : "text-[#1e1b2e]"} ${className}`}>
      <Corner info={info} />
      <Center info={info} />
      <Corner info={info} flipped />
    </span>
  );
}

export function CardBack({ className = "" }: { className?: string }) {
  return (
    <span className={`pc-side pc-back ${className}`}>
      <span className="pc-back-frame" />
      <span className="pc-back-emblem">
        <span>♠</span>
      </span>
    </span>
  );
}

/** A standalone face-up card (not part of the table's flip machinery), e.g. for the zoomed preview. */
export function StaticCard({ id, width }: { id: number; width: number }) {
  return (
    <span className="relative block" style={{ width, height: width * 1.4, fontSize: width / 5 }}>
      <CardFace id={id} className="pc-static" />
    </span>
  );
}
