import { PIPS, cardInfo } from "./deck";

// Renders the fortune reading as a portrait PNG to download or share:
// gold title, the fortune teller (copied from the live SVG on the page),
// the drawn cards fanned on her altar, the question and the reading on a
// parchment panel. Drawn on a canvas so it works the same everywhere; the
// height grows with the reading so long ones stay readable.

export interface ShareCardInput {
  cards: number[];
  name: string;
  question: string;
  topicLabel: string;
  text: string;
  /** The on-page medium SVG, if mounted. */
  portrait: SVGSVGElement | null;
  /** e.g. "ve-cung-toi.vercel.app/card-draw". */
  link: string;
}

const W = 1080;
const MIN_H = 1350;
const MAX_H = 2160;
const FRAME = 34;
const GOLD = "#e0b84a";
const SERIF = "Georgia, 'Times New Roman', serif";
const FACE_GLYPH: Record<string, string> = { J: "♞", Q: "♛", K: "♚" };

/** The font stack an element on the page resolved to (next/font gives hashed family names). */
const fontOf = (selector: string, fallback: string) => {
  const element = document.querySelector(selector);
  return element ? getComputedStyle(element).fontFamily : fallback;
};

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** The medium as an image: a clone of her SVG with lids and the open mouth removed (they're only hidden by page CSS). */
async function portraitImage(svg: SVGSVGElement | null): Promise<HTMLImageElement | null> {
  if (!svg) return null;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll(".md-lid, .md-mouth").forEach((node) => node.remove());
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", "640");
  clone.setAttribute("height", "520");
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
  try {
    await image.decode();
    return image;
  } catch {
    return null;
  }
}

/** A playing card (0–51) centred on (cx, cy), `w` wide, turned `angle` degrees. Also paints the Ai Là Heo card textures. */
export function drawCard(ctx: CanvasRenderingContext2D, id: number, cx: number, cy: number, w: number, angle: number, shadow = true) {
  const h = w * 1.4;
  const info = cardInfo(id);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((angle * Math.PI) / 180);

  if (shadow) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 12;
  }
  const paper = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  paper.addColorStop(0, "#fffdf6");
  paper.addColorStop(1, "#ece3cb");
  ctx.fillStyle = paper;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, w * 0.1);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "#c9bd9c";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = info.suit.red ? "#d61f3c" : "#1e1b2e";
  ctx.strokeStyle = ctx.fillStyle;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const flip of [false, true]) {
    ctx.save();
    if (flip) ctx.rotate(Math.PI);
    ctx.font = `700 ${w * 0.2}px ${SERIF}`;
    ctx.fillText(info.rank, -w / 2 + w * 0.15, -h / 2 + h * 0.1);
    ctx.font = `${w * 0.16}px ${SERIF}`;
    ctx.fillText(info.suit.symbol, -w / 2 + w * 0.15, -h / 2 + h * 0.21);
    ctx.restore();
  }
  if (info.rank === "A") {
    ctx.font = `${w * 0.62}px ${SERIF}`;
    ctx.fillText(info.suit.symbol, 0, h * 0.02);
  } else if (info.isFace) {
    ctx.lineWidth = w * 0.014;
    ctx.beginPath();
    ctx.roundRect(-w * 0.31, -h * 0.35, w * 0.62, h * 0.7, w * 0.05);
    ctx.stroke();
    ctx.font = `${w * 0.4}px ${SERIF}`;
    ctx.fillText(FACE_GLYPH[info.rank], 0, -h * 0.06);
    ctx.font = `700 ${w * 0.17}px ${SERIF}`;
    ctx.fillText(`${info.rank}${info.suit.symbol}`, 0, h * 0.2);
  } else {
    ctx.font = `${w * 0.19}px ${SERIF}`;
    for (const [px, py] of PIPS[info.rank]) {
      ctx.save();
      ctx.translate(-w / 2 + (w * px) / 100, -h / 2 + (h * py) / 100);
      if (py > 50) ctx.rotate(Math.PI);
      ctx.fillText(info.suit.symbol, 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawCandle(ctx: CanvasRenderingContext2D, x: number, baseY: number, height: number) {
  const width = height * 0.26;
  const halo = ctx.createRadialGradient(x, baseY - height - 18, 0, x, baseY - height - 18, height * 0.9);
  halo.addColorStop(0, "rgba(255, 170, 80, 0.55)");
  halo.addColorStop(1, "rgba(255, 110, 40, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(x - height, baseY - height * 2, height * 2, height * 2);
  const wax = ctx.createLinearGradient(x - width / 2, 0, x + width / 2, 0);
  wax.addColorStop(0, "#5e0612");
  wax.addColorStop(0.45, "#c0182e");
  wax.addColorStop(1, "#4a040e");
  ctx.fillStyle = wax;
  ctx.fillRect(x - width / 2, baseY - height, width, height);
  const flame = ctx.createRadialGradient(x, baseY - height - 12, 1, x, baseY - height - 16, 22);
  flame.addColorStop(0, "#fffbe6");
  flame.addColorStop(0.45, "#ffb340");
  flame.addColorStop(1, "#ff5a1a");
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(x, baseY - height - 46);
  ctx.bezierCurveTo(x + 15, baseY - height - 22, x + 13, baseY - height - 6, x, baseY - height - 2);
  ctx.bezierCurveTo(x - 13, baseY - height - 6, x - 15, baseY - height - 22, x, baseY - height - 46);
  ctx.fill();
}

export async function renderFortuneCard(input: ShareCardInput): Promise<Blob> {
  const seance = fontOf(".font-seance", SERIF);
  const body = fontOf(".font-draw-body", "system-ui, sans-serif");
  await Promise.all([
    document.fonts.load(`800 90px ${seance}`, "Bà Đồng Xem Bài"),
    document.fonts.load(`500 34px ${seance}`, "Quẻ của ắằẳẵặ ộ ữ"),
    document.fonts.load(`600 28px ${body}`, "Chỉ để giải trí"),
  ]).catch(() => undefined);
  const portrait = await portraitImage(input.portrait);

  // Lay the text out first: it decides how tall the card is.
  const measure = document.createElement("canvas").getContext("2d")!;
  const panelX = 90;
  const panelW = W - panelX * 2;
  const textX = panelX + 52;
  const textW = panelW - 104;
  measure.font = `italic 500 30px ${body}`;
  const subtitle = input.question ? `“${input.question}”` : input.topicLabel ? `Chuyện ${input.topicLabel.toLowerCase()}` : "";
  let questionLines = subtitle ? wrapLines(measure, subtitle, W - 220) : [];
  if (questionLines.length > 2) questionLines = [questionLines[0], `${questionLines[1].replace(/\s*\S*$/, "")}…”`];
  const panelTop = questionLines.length ? 816 + (questionLines.length - 1) * 40 + 40 : 806;
  let size = 36;
  let lines: string[] = [];
  for (; size >= 24; size -= 2) {
    measure.font = `500 ${size}px ${seance}`;
    lines = wrapLines(measure, input.text, textW);
    if (panelTop + lines.length * size * 1.45 + 96 + 170 <= MAX_H) break;
  }
  const lineHeight = Math.round(size * 1.45);
  const panelH = lines.length * lineHeight + 96;
  const H = Math.max(MIN_H, Math.round(panelTop + panelH + 170));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Backdrop: dark red curtains, a glow behind her, darkened edges.
  ctx.fillStyle = "#12040a";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(110, 12, 24, 0.22)";
  for (let x = 0; x < W; x += 56) ctx.fillRect(x + 28, 0, 28, H);
  const glow = ctx.createRadialGradient(W / 2, 330, 20, W / 2, 330, 620);
  glow.addColorStop(0, "rgba(220, 40, 55, 0.45)");
  glow.addColorStop(1, "rgba(220, 40, 55, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.7)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  // Gold double frame with diamonds in the corners.
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.strokeRect(FRAME, FRAME, W - FRAME * 2, H - FRAME * 2);
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  ctx.strokeRect(FRAME + 12, FRAME + 12, W - FRAME * 2 - 24, H - FRAME * 2 - 24);
  ctx.globalAlpha = 1;
  ctx.fillStyle = GOLD;
  for (const [x, y] of [
    [FRAME, FRAME],
    [W - FRAME, FRAME],
    [FRAME, H - FRAME],
    [W - FRAME, H - FRAME],
  ]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-11, -11, 22, 22);
    ctx.restore();
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(243, 210, 122, 0.8)";
  ctx.font = `700 24px ${body}`;
  ctx.fillText("✦   QUẺ BÀI TÂY   ✦", W / 2, 104);
  const titleFill = ctx.createLinearGradient(0, 120, 0, 200);
  titleFill.addColorStop(0, "#ffe9a8");
  titleFill.addColorStop(0.55, GOLD);
  titleFill.addColorStop(1, "#a8740f");
  ctx.fillStyle = titleFill;
  ctx.shadowColor = "rgba(224, 184, 74, 0.55)";
  ctx.shadowBlur = 28;
  ctx.font = `800 92px ${seance}`;
  ctx.fillText("Bà Đồng Xem Bài", W / 2, 194);
  ctx.shadowColor = "transparent";

  // Her, behind the altar, which hides her below the chest as on the page.
  const portraitTop = 200;
  const altarTop = portraitTop + Math.round(358 * 0.86);
  if (portrait) ctx.drawImage(portrait, W / 2 - 220, portraitTop, 440, 358);
  const altar = ctx.createLinearGradient(0, altarTop, 0, altarTop + 192);
  altar.addColorStop(0, "#8c1426");
  altar.addColorStop(1, "#2c040c");
  ctx.fillStyle = altar;
  ctx.fillRect(FRAME + 12, altarTop, W - FRAME * 2 - 24, 192);
  ctx.fillStyle = GOLD;
  ctx.fillRect(FRAME + 12, altarTop - 3, W - FRAME * 2 - 24, 4);
  drawCandle(ctx, 175, altarTop + 18, 96);
  drawCandle(ctx, W - 175, altarTop + 18, 96);

  // The drawn cards, fanned (the first seven; the rest as a count).
  const shown = input.cards.slice(0, 7);
  const cardW = shown.length <= 3 ? 150 : shown.length <= 5 ? 128 : 108;
  const spacing = cardW * 0.8;
  const mid = (shown.length - 1) / 2;
  shown.forEach((id, index) => drawCard(ctx, id, W / 2 + (index - mid) * spacing, 585 + Math.abs(index - mid) * 7, cardW, (index - mid) * 6));
  if (input.cards.length > shown.length) {
    const x = W / 2 + (shown.length - 1 - mid) * spacing + cardW * 0.75;
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.beginPath();
    ctx.roundRect(x - 10, 567, 104, 46, 23);
    ctx.fill();
    ctx.fillStyle = "#f3d27a";
    ctx.font = `800 26px ${body}`;
    ctx.textAlign = "center";
    ctx.fillText(`+${input.cards.length - shown.length} lá`, x + 42, 599);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#f5e9cb";
  ctx.font = `700 58px ${seance}`;
  ctx.fillText(`Quẻ của ${input.name || "con"}`, W / 2, 768);
  ctx.fillStyle = "rgba(243, 230, 196, 0.8)";
  ctx.font = `italic 500 30px ${body}`;
  questionLines.forEach((line, index) => ctx.fillText(line, W / 2, 816 + index * 40));

  // The reading on parchment.
  const parchment = ctx.createLinearGradient(0, panelTop, 0, panelTop + panelH);
  parchment.addColorStop(0, "#f5e9cb");
  parchment.addColorStop(1, "#e6d3a3");
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = 40;
  ctx.fillStyle = parchment;
  ctx.beginPath();
  ctx.roundRect(panelX, panelTop, panelW, panelH, 22);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "#5a0a18";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "rgba(90, 10, 24, 0.12)";
  ctx.font = `800 170px ${seance}`;
  ctx.textAlign = "left";
  ctx.fillText("“", panelX + 18, panelTop + 130);
  ctx.fillStyle = "#2a070d";
  ctx.font = `500 ${size}px ${seance}`;
  lines.forEach((line, index) => ctx.fillText(line, textX, panelTop + 48 + size + index * lineHeight));

  ctx.textAlign = "center";
  ctx.fillStyle = "#f3d27a";
  ctx.font = `700 28px ${body}`;
  ctx.fillText(`🔮 ${input.link}`, W / 2, H - FRAME - 82);
  ctx.fillStyle = "rgba(243, 230, 196, 0.55)";
  ctx.font = `600 22px ${body}`;
  ctx.fillText(`Chỉ để giải trí · ${new Date().toLocaleDateString("vi-VN")}`, W / 2, H - FRAME - 44);

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png"));
}

/** "Bà Đồng – Minh Anh" → "que-boi-minh-anh-20261029.png" */
export function shareCardFileName(name: string): string {
  const slug =
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[đĐ]/g, "d")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "ba-dong";
  const today = new Date();
  const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  return `que-boi-${slug}-${stamp}.png`;
}
