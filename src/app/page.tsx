import Link from "next/link";

interface GameCard {
  href: string;
  emoji: string;
  title: string;
  description: string;
  accent: string;
}

const GAMES: GameCard[] = [
  {
    href: "/draw-guess",
    emoji: "🎨",
    title: "Vẽ Cùng Tôi",
    description: "Vẽ & đoán chữ cùng bạn bè — không cần tài khoản.",
    accent: "hover:border-clay-500",
  },
  {
    href: "/tank-game",
    emoji: "🎯",
    title: "Đại Chiến Xe Tăng",
    description: "Bắn nhau cùng hội bạn — tối đa 8 người, ai đủ điểm tiêu diệt trước thì thắng.",
    accent: "hover:border-slate-600",
  },
  {
    href: "/brawler",
    emoji: "⚔️",
    title: "Đại Chiến Tí Hon",
    description: "Đối kháng nhiều người chơi — chọn nhân vật, chọn vũ khí, cùng tranh tài.",
    accent: "hover:border-amber-500",
  },
];

export default function GamePickerPage() {
  return (
    <main className="flex min-h-app items-center justify-center bg-home-scene p-6 sm:p-10 lg:p-32">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Chơi Cùng Tôi</h1>
          <p className="mt-2 text-sm text-ink/60">Chọn 1 game để bắt đầu — không cần tài khoản, chơi ngay trên trình duyệt.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {GAMES.map((game) => (
            <Link
              key={game.href}
              href={game.href}
              className={`flex flex-col gap-2 rounded-xl border border-cream-200 bg-white/95 p-5 shadow-xl transition ${game.accent}`}
            >
              <span className="text-3xl">{game.emoji}</span>
              <span className="text-base font-semibold text-ink">{game.title}</span>
              <span className="text-xs leading-relaxed text-ink/60">{game.description}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
