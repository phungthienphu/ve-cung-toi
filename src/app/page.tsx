import Link from "next/link";
import { drawFontClass } from "@/lib/drawFonts";

interface GameCard {
  href: string;
  emoji: string;
  title: string;
  description: string;
  tag: string;
  players: string;
  gradient: string;
  border: string;
  button: string;
}

const GAMES: GameCard[] = [
  {
    href: "/draw-guess",
    emoji: "🎨",
    title: "Vẽ Cùng Tôi",
    description: "Người vẽ, người đoán — cả hội cười xỉu với những nét vẽ méo mó.",
    tag: "Vẽ & đoán chữ",
    players: "2–20 người",
    gradient: "from-amber-300 via-orange-300 to-orange-500",
    border: "border-orange-300",
    button: "from-orange-500 to-amber-500",
  },
  {
    href: "/werewolf",
    emoji: "🐺",
    title: "Ma Sói Cùng Phòng",
    description: "Suy luận, giấu vai và bỏ phiếu. Ai là sói trong đêm nay?",
    tag: "Suy luận nhóm",
    players: "5–12 người",
    gradient: "from-indigo-500 via-violet-600 to-purple-800",
    border: "border-violet-300",
    button: "from-violet-600 to-indigo-600",
  },
  {
    href: "/tank-game",
    emoji: "🎯",
    title: "Đại Chiến Xe Tăng",
    description: "Bắn nhau cùng hội bạn — ai đủ điểm tiêu diệt trước thì thắng.",
    tag: "Bắn tăng",
    players: "2–8 người",
    gradient: "from-lime-500 via-green-600 to-emerald-800",
    border: "border-green-300",
    button: "from-green-600 to-lime-600",
  },
  {
    href: "/soccer",
    emoji: "⚽",
    title: "Sân cỏ đẫm máu",
    description: "Đá bóng 2 đội, 1vs1 đến 4vs4. Xoạc, sút, thẻ đỏ — ghi nhiều bàn hơn là thắng.",
    tag: "Bóng đá",
    players: "1–8 người · có bot",
    gradient: "from-sky-400 via-blue-500 to-blue-700",
    border: "border-sky-300",
    button: "from-blue-600 to-sky-500",
  },
];

export default function GamePickerPage() {
  return (
    <main className={`${drawFontClass} min-h-app bg-home px-4 py-10 sm:py-14`}>
      <div className="mx-auto max-w-5xl">
        <header className="text-center">
          <div className="wood-sign mx-auto w-fit -rotate-1 rounded-2xl px-8 py-3 sm:px-12 sm:py-4">
            <h1 className="font-draw-display text-4xl font-extrabold tracking-tight text-[#fff3d6] drop-shadow-[0_3px_0_rgba(60,30,8,0.7)] sm:text-6xl">
              Chơi Cùng Tôi
            </h1>
          </div>
          <p className="mx-auto mt-8 w-fit max-w-full rounded-full border-2 border-[#8a5527]/40 bg-cream-50/90 px-5 py-2 text-sm font-semibold text-ink shadow-lg backdrop-blur">
            Chọn 1 game để bắt đầu — không cần tài khoản, chơi ngay trên trình duyệt 🐷
          </p>
        </header>

        <section className="mt-8 rounded-[2rem] border-4 border-[#8a5527]/70 bg-cream-50/75 p-4 shadow-2xl backdrop-blur-md sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
            {GAMES.map((game, index) => (
              <Link
                key={game.href}
                href={game.href}
                style={{ animationDelay: `${index * 70}ms` }}
                className={`group animate-bounce-in relative isolate flex flex-col overflow-hidden rounded-3xl border-2 border-b-[6px] bg-white shadow-lg transition duration-200 hover:-translate-y-1.5 hover:shadow-2xl active:translate-y-0 ${game.border}`}
              >
                <div className={`relative flex h-28 items-center gap-3 rounded-t-[1.2rem] bg-gradient-to-br px-4 ${game.gradient}`}>
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/90 text-4xl shadow-lg ring-4 ring-white/40 transition duration-200 group-hover:rotate-6 group-hover:scale-110">
                    {game.emoji}
                  </span>
                  <span className="rounded-full bg-black/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                    {game.tag}
                  </span>
                  <span aria-hidden className="pointer-events-none absolute -bottom-4 -right-2 rotate-12 text-8xl opacity-20 transition duration-300 group-hover:scale-110 group-hover:opacity-30">
                    {game.emoji}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <h2 className="font-draw-display text-2xl font-extrabold leading-tight text-ink">{game.title}</h2>
                  <p className="mt-1.5 flex-1 text-sm leading-relaxed text-ink/70">{game.description}</p>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate rounded-full bg-cream-100 px-3 py-1 text-xs font-semibold text-ink/70">👥 {game.players}</span>
                    <span className={`shrink-0 whitespace-nowrap rounded-full bg-gradient-to-r px-5 py-2 text-sm font-extrabold text-white shadow-md transition duration-200 group-hover:scale-105 group-hover:shadow-lg ${game.button}`}>
                      Chơi ngay →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <div className="mt-7 text-center">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-2 rounded-full border-2 border-[#8a5527]/50 bg-cream-50/95 px-6 py-2.5 text-sm font-bold text-ink shadow-lg transition hover:-translate-y-0.5 hover:bg-white"
          >
            🏆 Lịch sử trận đấu
          </Link>
        </div>
      </div>
    </main>
  );
}
