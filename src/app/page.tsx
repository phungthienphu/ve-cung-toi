import Image from "next/image";
import Link from "next/link";
import { seanceFontClass } from "@/components/cards/fonts";
import { Candle, Medium } from "@/components/cards/Medium";
import { MonsterSprite } from "@/components/mathboss/MonsterSprite";
import { drawFontClass } from "@/lib/drawFonts";

// The game hub: a hero, a spotlight on the newest games, and a bento grid of
// every game with its own cover art (games without art get a drawn scene).

type Cover = { image: string; position: string } | { scene: "sea" | "math" | "seance" };

interface Game {
  href: string;
  title: string;
  description: string;
  tag: string;
  players: string;
  cover: Cover;
  /** Bento tile: hero 2×2, wide 2×1, small 1×1. */
  size: "hero" | "wide" | "small";
  isNew?: boolean;
}

const GAMES: Game[] = [
  {
    href: "/werewolf",
    title: "Ma Sói",
    description: "Đêm xuống, sói lặng lẽ ra tay. Sáng ra cả làng suy luận, cãi nhau và bỏ phiếu — ai là sói đêm nay?",
    tag: "Suy luận nhóm",
    players: "5–12 người",
    cover: { image: "/ma-soi/bg-ma-soi.webp", position: "52% 70%" },
    size: "hero",
  },
  {
    href: "/draw-guess",
    title: "Vẽ Cùng Tôi",
    description: "Một người vẽ, cả hội đoán — nét vẽ càng méo càng vui.",
    tag: "Vẽ & đoán chữ",
    players: "2–20 người",
    cover: { image: "/bg-ve-cung-toi.png", position: "50% 40%" },
    size: "wide",
  },
  {
    href: "/ai-la-heo",
    title: "Ai Là Heo",
    description: "Rút bài 3D cùng hội bạn: nhử nhau, đọc nhau — ai ôm lá Joker cuối cùng là HEO!",
    tag: "Rút bài 3D",
    players: "2–6 · có bot",
    cover: { image: "/ai-la-heo.png", position: "50% 38%" },
    size: "wide",
    isNew: true,
  },
  {
    href: "/tank-game",
    title: "Đại Chiến Xe Tăng",
    description: "Bắn nhau loạn xạ, ai đủ điểm hạ gục trước thì thắng.",
    tag: "Bắn tăng",
    players: "2–8 người",
    cover: { image: "/tank/tank-bg.png", position: "28% 42%" },
    size: "wide",
  },
  {
    href: "/soccer",
    title: "Sân Cỏ Đẫm Máu",
    description: "Đá bóng 1vs1 đến 4vs4: xoạc, sút, thẻ đỏ.",
    tag: "Bóng đá",
    players: "1–8 · có bot",
    cover: { image: "/soccer/bg-soccer.png", position: "40% 45%" },
    size: "wide",
  },
  {
    href: "/battleship",
    title: "Hải Chiến",
    description: "Giấu hạm đội, đoán tọa độ, nã pháo. Solo, hỗn chiến hoặc chia đội.",
    tag: "Bắn tàu",
    players: "2–8 · có bot",
    cover: { scene: "sea" },
    size: "wide",
  },
  {
    href: "/card-draw",
    title: "Bà Đồng Xem Bài",
    description: "Rút bài Tây, nghe bà đồng luận quẻ.",
    tag: "Xem bói",
    players: "1 người",
    cover: { scene: "seance" },
    size: "small",
    isNew: true,
  },
  {
    href: "/math-quest",
    title: "Math Quest",
    description: "Sổ tay toán 8–9 và trận đánh Quái Máy Tính.",
    tag: "Học toán",
    players: "Lớp gia sư",
    cover: { scene: "math" },
    size: "small",
  },
];

const TILE_SIZE: Record<Game["size"], string> = { hero: "col-span-2 row-span-2", wide: "col-span-2", small: "col-span-1" };
const IMAGE_SIZES: Record<Game["size"], string> = {
  hero: "(min-width: 1024px) 50vw, 100vw",
  wide: "(min-width: 1024px) 50vw, 100vw",
  small: "(min-width: 1024px) 25vw, 50vw",
};

/** Shown in the footer. A link with an empty href is left out. */
const AUTHOR = {
  name: "Thiên Phú",
  initials: "TP",
  note: "Chơi Cùng Tôi · có góp ý gì cứ nhắn mình nhé!",
  links: [
    { label: "Facebook", href: "https://www.facebook.com/phu.tuila.50", icon: "f", badge: "bg-[#1877f2] text-xs text-white" },
    { label: "GitHub", href: "https://github.com/phungthienphu", icon: "</>", badge: "bg-white text-[#0a0812] text-[9px]" },
  ],
};

const STEPS = [
  { icon: "🎮", title: "Chọn trò chơi", text: "Không cần đăng ký hay cài đặt gì cả." },
  { icon: "🔗", title: "Tạo phòng, gửi link", text: "Mỗi phòng một mã riêng, gửi qua Zalo hay Messenger là xong." },
  { icon: "🎉", title: "Cả hội vào chơi", text: "Chơi ngay trên điện thoại hoặc máy tính." },
];

const MATH_SYMBOLS = [
  { symbol: "∑", className: "left-[8%] top-[10%] text-4xl rotate-[-12deg]" },
  { symbol: "π", className: "left-[34%] top-[26%] text-3xl rotate-[10deg]" },
  { symbol: "√x", className: "left-[12%] top-[46%] text-2xl rotate-[6deg]" },
  { symbol: "x²", className: "left-[42%] top-[6%] text-2xl rotate-[-6deg]" },
  { symbol: "÷", className: "left-[30%] top-[52%] text-3xl" },
  { symbol: "∞", className: "left-[4%] top-[70%] text-2xl rotate-[-8deg]" },
];

/** Her altar: the medium behind a velvet cloth (it hides her below the chest), candles either side. */
function SeanceScene({ candle = 12 }: { candle?: number }) {
  return (
    <div className="bg-seance absolute inset-0">
      <div className="absolute bottom-[34%] left-1/2 aspect-[320/260] h-[72%] -translate-x-1/2 translate-y-[14%]">
        <Medium mood="idle" talking={false} />
      </div>
      <div className="altar-cloth absolute inset-x-0 bottom-0 h-[34%]" />
      <Candle style={{ left: "12%", bottom: "calc(34% - 6px)", width: candle, height: candle * 3.25 }} />
      <Candle style={{ right: "12%", bottom: "calc(34% - 6px)", width: candle, height: candle * 3.25 }} />
      <div className="seance-vignette absolute inset-0" />
    </div>
  );
}

/** A Battleship board: two ships, hits and misses. */
function SeaScene() {
  return (
    <div className="tile-sea absolute inset-0">
      <span className="absolute left-[50%] top-[20%] h-[11%] w-[30%] rounded-full bg-[#b9c3cf] ring-2 ring-[#4b5563]" />
      <span className="absolute left-[86%] top-[30%] h-[44%] w-[5%] rounded-full bg-[#b9c3cf] ring-2 ring-[#4b5563]" />
      <span className="absolute left-[58%] top-[60%] h-[11%] w-[18%] rounded-full bg-[#b9c3cf] ring-2 ring-[#4b5563]" />
      <span className="absolute left-[56%] top-[12%] text-2xl drop-shadow-[0_0_10px_rgba(251,146,60,0.9)] transition duration-500 group-hover:scale-125">💥</span>
      <span className="absolute left-[84%] top-[42%] text-2xl drop-shadow-[0_0_10px_rgba(251,146,60,0.9)] transition duration-500 group-hover:scale-125">💥</span>
      {["left-[40%] top-[38%]", "left-[72%] top-[80%]", "left-[94%] top-[12%]", "left-[66%] top-[44%]"].map((spot) => (
        <span key={spot} className={`absolute ${spot} h-2 w-2 rounded-full bg-white/80`} />
      ))}
    </div>
  );
}

/** The calculator boss among floating maths. */
function MathScene() {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-[#5b21b6] via-[#4c1d95] to-[#1e1b4b]">
      {MATH_SYMBOLS.map((item) => (
        <span key={item.symbol} className={`absolute font-draw-display font-extrabold text-white/20 ${item.className}`}>
          {item.symbol}
        </span>
      ))}
      <MonsterSprite
        mood="idle"
        screen="x²=?"
        className="absolute -right-3 top-[4%] h-[80%] w-auto drop-shadow-[0_12px_20px_rgba(0,0,0,0.45)] transition duration-500 group-hover:-rotate-6 group-hover:scale-105"
      />
    </div>
  );
}

function TileCover({ game }: { game: Game }) {
  const { cover } = game;
  if ("image" in cover) {
    return (
      <Image
        src={cover.image}
        alt=""
        fill
        sizes={IMAGE_SIZES[game.size]}
        priority={game.size === "hero"}
        className="object-cover transition duration-700 ease-out group-hover:scale-110"
        style={{ objectPosition: cover.position }}
      />
    );
  }
  if (cover.scene === "seance") return <SeanceScene />;
  if (cover.scene === "sea") return <SeaScene />;
  return <MathScene />;
}

function NewBadge({ className = "" }: { className?: string }) {
  return <span className={`badge-new rounded-full px-2.5 py-1 text-[11px] font-black leading-none tracking-wider ${className}`}>NEW</span>;
}

function GameTile({ game, index }: { game: Game; index: number }) {
  const small = game.size === "small";
  return (
    <Link
      href={game.href}
      style={{ animationDelay: `${index * 60}ms` }}
      className={`group animate-bounce-in relative isolate flex flex-col justify-end overflow-hidden rounded-3xl bg-[#17131f] ring-1 ring-white/10 transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.9)] hover:ring-2 hover:ring-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${TILE_SIZE[game.size]}`}
    >
      <TileCover game={game} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
      {game.isNew && <NewBadge className="absolute left-3 top-3 z-10" />}
      <span className="absolute right-3 top-3 z-10 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white/90 backdrop-blur">👥 {game.players}</span>

      <div className={`relative z-10 ${small ? "p-3.5 pr-14 sm:p-4 sm:pr-16" : "p-5 sm:p-7"}`}>
        <span
          className={`w-fit rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white/85 backdrop-blur ${small ? "hidden sm:inline-block" : "inline-block"}`}
        >
          {game.tag}
        </span>
        <h3
          className={`mt-2 font-draw-display font-extrabold leading-[1.05] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] ${
            game.size === "hero" ? "text-4xl sm:text-6xl" : small ? "text-xl sm:text-2xl" : "text-3xl sm:text-4xl"
          }`}
        >
          {game.title}
        </h3>
        <p className={`mt-1.5 text-sm leading-snug text-white/75 ${small ? "hidden lg:line-clamp-2" : game.size === "hero" ? "max-w-md sm:text-base" : "line-clamp-2 max-w-md"}`}>
          {game.description}
        </p>
        {!small && (
          <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-extrabold text-[#0a0812] shadow-lg transition-all duration-300 group-hover:gap-3 group-hover:bg-[#ffe08a]">
            Chơi ngay <span aria-hidden>→</span>
          </span>
        )}
      </div>
      {small && (
        <span
          aria-hidden
          className="absolute bottom-3.5 right-3.5 z-10 grid h-10 w-10 place-items-center rounded-full bg-white text-lg font-black text-[#0a0812] shadow-lg transition duration-300 group-hover:scale-110 group-hover:bg-[#ffe08a]"
        >
          →
        </span>
      )}
    </Link>
  );
}

export default function GamePickerPage() {
  return (
    <main className={`${drawFontClass} ${seanceFontClass} bg-hub min-h-app text-white`}>
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0a0812]/70 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 whitespace-nowrap font-draw-display text-xl font-extrabold tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#ff9ec4] to-[#ff8a5b] text-lg shadow-[0_4px_16px_rgba(255,138,91,0.45)]">🐷</span>
            Chơi Cùng Tôi
          </Link>
          {/* On a phone the links are icons only, "NEW" shrinks to a dot, so the name stays on one line. */}
          <div className="flex items-center gap-1 sm:gap-2">
            <Link href="/ai-la-heo" aria-label="Ai Là Heo (mới)" className="relative flex items-center gap-2 rounded-full px-2.5 py-1.5 text-sm font-bold text-white/80 transition hover:bg-white/10 hover:text-white sm:px-3">
              🐷 <span className="hidden sm:inline">Ai Là Heo</span>
              <NewBadge className="hidden !px-2 !py-0.5 text-[10px] sm:inline" />
              <span aria-hidden className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#ff5ea8] ring-2 ring-[#0a0812] sm:hidden" />
            </Link>
            <Link href="/card-draw" aria-label="Bà Đồng (mới)" className="relative flex items-center gap-2 rounded-full px-2.5 py-1.5 text-sm font-bold text-white/80 transition hover:bg-white/10 hover:text-white sm:px-3">
              🔮 <span className="hidden sm:inline">Bà Đồng</span>
              <NewBadge className="hidden !px-2 !py-0.5 text-[10px] sm:inline" />
              <span aria-hidden className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#ff5ea8] ring-2 ring-[#0a0812] sm:hidden" />
            </Link>
            <Link href="/leaderboard" aria-label="Lịch sử trận" className="rounded-full px-2.5 py-1.5 text-sm font-bold text-white/80 transition hover:bg-white/10 hover:text-white sm:px-3">
              🏆 <span className="hidden sm:inline">Lịch sử trận</span>
            </Link>
          </div>
        </nav>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 sm:px-6 sm:pt-8">
        {/* Hero */}
        <section className="relative isolate overflow-hidden rounded-[2rem] ring-1 ring-white/10">
          <Image src="/background-home.png" alt="" fill priority sizes="(min-width: 1152px) 1152px, 100vw" className="-z-10 object-cover" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0a0812] via-[#0a0812]/75 to-[#0a0812]/5" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0a0812]/80 via-transparent to-transparent" />
          <div className="max-w-2xl px-6 py-12 sm:px-12 sm:py-20 lg:py-24">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/85 ring-1 ring-white/15 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
              Không cần tài khoản · chơi ngay trên trình duyệt
            </span>
            <h1 className="mt-5 font-draw-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">
              Chơi Cùng <span className="bg-gradient-to-r from-[#ffd36e] via-[#ff8a5b] to-[#ff5ea8] bg-clip-text text-transparent">Tôi</span>
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-white/75 sm:text-lg">
              Tạo phòng, gửi link, cả hội vào chơi — vẽ đoán chữ, Ma Sói, bắn tăng, đá bóng, hải chiến, rút bài Ai Là Heo, và cả bà đồng xem bói.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#games"
                className="rounded-2xl bg-gradient-to-r from-[#ff8a5b] to-[#ff5ea8] px-6 py-3 font-draw-display text-lg font-extrabold shadow-[0_10px_30px_-8px_rgba(255,94,168,0.7)] transition hover:-translate-y-0.5 hover:brightness-110"
              >
                🎮 Chọn trò chơi
              </a>
              <Link
                href="/card-draw"
                className="flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 font-draw-display text-lg font-extrabold ring-1 ring-white/20 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15"
              >
                🔮 Xem bói <NewBadge />
              </Link>
            </div>
            <dl className="mt-9 flex flex-wrap gap-x-8 gap-y-3">
              {[
                { value: String(GAMES.length), label: "trò chơi" },
                { value: "20", label: "người / phòng" },
                { value: "0đ", label: "miễn phí" },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd className="font-draw-display text-3xl font-extrabold leading-none">
                    {stat.value} <span className="font-draw-body text-sm font-semibold text-white/55">{stat.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Spotlight on the newest games: side by side on a wide screen, stacked on a phone */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Link
            href="/ai-la-heo"
            className="group relative isolate grid overflow-hidden rounded-[2rem] bg-[#1d0f08] ring-1 ring-[#ff9ec4]/30 transition duration-300 hover:ring-2 hover:ring-[#ff9ec4]/70 sm:grid-cols-[1.15fr_1fr] lg:grid-cols-1"
          >
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_20%_30%,#4a2614_0%,#24120a_55%,#140904_100%)]" />
            <div className="flex flex-col justify-center p-6 sm:p-10 lg:p-8">
              <div className="flex items-center gap-2.5">
                <NewBadge />
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#ffc6dc]/80">Vừa ra mắt</span>
              </div>
              <h2 className="mt-3 font-draw-display text-4xl font-extrabold leading-none text-[#ffe4ee] drop-shadow-[0_0_18px_rgba(255,120,170,0.45)] sm:text-6xl lg:text-5xl">Ai Là Heo</h2>
              <p className="mt-3 max-w-md leading-relaxed text-[#f6e3d3]/80">
                Bàn bài 3D cho 2–6 người: rút bài của nhau, nhử, xào, đọc mặt nhau mà né lá Joker. Ai ôm con heo tới cuối thì… làm heo 🐷 Thiếu người thì gọi bot vào.
              </p>
              <span className="mt-6 inline-flex w-fit items-center gap-2 rounded-2xl bg-gradient-to-b from-[#ffc2da] to-[#ff5ea8] px-6 py-3 font-draw-display text-xl font-extrabold text-[#4a0b26] shadow-[0_5px_0_#9d174d] transition group-hover:brightness-110">
                🐷 Vào bàn chơi <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
              </span>
            </div>
            <div className="relative h-60 overflow-hidden sm:h-auto sm:min-h-[320px] lg:h-64 lg:min-h-0">
              <Image
                src="/ai-la-heo.png"
                alt="Bầy heo chơi bài quanh bàn, lá Joker con heo nằm giữa bàn"
                fill
                sizes="(min-width: 1024px) 560px, (min-width: 640px) 45vw, 100vw"
                className="object-cover transition duration-700 ease-out group-hover:scale-105"
                style={{ objectPosition: "50% 42%" }}
              />
              {/* Melts into the text side: above it on a phone and two-up, to its left in between. */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#1d0f08] via-transparent via-25% sm:bg-gradient-to-r lg:bg-gradient-to-b" />
            </div>
          </Link>

          <Link
            href="/card-draw"
            className="group relative isolate grid overflow-hidden rounded-[2rem] bg-[#12040a] ring-1 ring-[#e0b84a]/30 transition duration-300 hover:ring-2 hover:ring-[#e0b84a]/70 sm:grid-cols-[1.15fr_1fr] lg:grid-cols-1"
          >
            <div className="bg-seance absolute inset-0 -z-10" />
            <div className="flex flex-col justify-center p-6 sm:p-10 lg:p-8">
              <div className="flex items-center gap-2.5">
                <NewBadge />
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#f3d27a]/80">Vừa ra mắt</span>
              </div>
              <h2 className="mt-3 font-seance text-4xl font-extrabold leading-none text-[#f3d27a] drop-shadow-[0_0_18px_rgba(224,184,74,0.4)] sm:text-6xl lg:text-5xl">Bà Đồng Xem Bài</h2>
              <p className="mt-3 max-w-md leading-relaxed text-[#f3e6c4]/80">
                Bà đồng hỏi chuyện, cho cả bộ bài bay lên mà xào, xòe 52 lá cho bạn rút — rồi luận quẻ và cho tải ảnh quẻ về khoe. Hơi rợn đấy 👁️
              </p>
              <span className="mt-6 inline-flex w-fit items-center gap-2 rounded-2xl bg-gradient-to-b from-[#ffd36e] to-[#e0951a] px-6 py-3 font-seance text-xl font-bold text-[#3b0a0f] shadow-[0_5px_0_#7a3b06] transition group-hover:brightness-110">
                🔮 Vào xem bói <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
              </span>
            </div>
            <div className="relative h-60 sm:h-auto sm:min-h-[320px] lg:h-64 lg:min-h-0">
              <SeanceScene candle={18} />
            </div>
          </Link>
        </div>

        {/* Every game */}
        <section id="games" className="mt-14 scroll-mt-24">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#ff8a5b]">Thư viện game</p>
              <h2 className="mt-2 font-draw-display text-3xl font-extrabold sm:text-4xl">Hôm nay chơi gì?</h2>
            </div>
            <p className="hidden max-w-xs text-right text-sm text-white/50 sm:block">Tất cả đều chơi được trên điện thoại — rủ hội bạn vào bằng một đường link.</p>
          </div>
          <div className="mt-6 grid auto-rows-[170px] grid-cols-2 gap-3 [grid-auto-flow:dense] sm:auto-rows-[210px] sm:gap-4 lg:auto-rows-[220px] lg:grid-cols-4">
            {GAMES.map((game, index) => (
              <GameTile key={game.href} game={game} index={index} />
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mt-16">
          <h2 className="font-draw-display text-2xl font-extrabold sm:text-3xl">Chơi thế nào?</h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-3 sm:gap-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#7c3aed]/60 to-[#ff5ea8]/50 text-2xl ring-1 ring-white/15">{step.icon}</span>
                <p className="mt-4 text-xs font-bold uppercase tracking-widest text-white/40">Bước {index + 1}</p>
                <h3 className="mt-1 font-draw-display text-xl font-extrabold">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/60">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <footer className="mt-16 border-t border-white/10 pt-10">
          <div className="grid gap-6 sm:grid-cols-[1.4fr_1fr] sm:items-center">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#ff9ec4] via-[#ff8a5b] to-[#7c3aed] font-draw-display text-xl font-extrabold shadow-[0_8px_24px_rgba(255,138,91,0.35)]">
                {AUTHOR.initials}
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">Tác giả</p>
                <p className="font-draw-display text-2xl font-extrabold leading-tight">{AUTHOR.name}</p>
                <p className="text-sm text-white/55">{AUTHOR.note}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              {AUTHOR.links
                .filter((link) => link.href)
                .map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] py-2 pl-2 pr-4 text-sm font-bold text-white/80 ring-1 ring-white/15 transition hover:-translate-y-0.5 hover:bg-white/10 hover:text-white"
                  >
                    <span className={`grid h-6 w-6 place-items-center rounded-full font-black ${link.badge}`}>{link.icon}</span>
                    {link.label}
                  </a>
                ))}
            </div>
          </div>
          <div className="mt-8 flex flex-col items-center justify-between gap-3 text-xs text-white/40 sm:flex-row">
            <span>
              © {new Date().getFullYear()} Chơi Cùng Tôi · làm bởi {AUTHOR.name} 🐷
            </span>
            <Link href="/leaderboard" className="rounded-full px-4 py-2 text-sm font-bold text-white/70 ring-1 ring-white/15 transition hover:bg-white/10 hover:text-white">
              🏆 Lịch sử trận đấu
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
