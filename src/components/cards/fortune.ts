import { cardInfo, type Suit } from "./deck";

// Everything the fortune teller says. Spooky-playful, never actually grim:
// kids use this site too.

export type Topic = "love" | "money" | "study" | "health" | "any";

export const TOPICS: { id: Topic; label: string; emoji: string; ack: string }[] = [
  { id: "love", label: "Tình duyên", emoji: "💘", ack: "Tình duyên à… hehehe. Ta thấy có sợi chỉ đỏ quấn quanh cổ tay con." },
  { id: "money", label: "Tiền tài", emoji: "💰", ack: "Tiền tài… kẻ nào tới đây cũng hỏi câu đó. Để xem ví con dày hay mỏng." },
  { id: "study", label: "Học hành · công việc", emoji: "📚", ack: "Chuyện học hành, công việc… Được. Bài sẽ nói thật, con đừng giận." },
  { id: "health", label: "Sức khỏe", emoji: "🌿", ack: "Sức khỏe là vàng… để ta nghe xem bài thì thầm điều gì." },
  { id: "any", label: "Hỏi đại", emoji: "🔮", ack: "Không hỏi gì cụ thể à? Được thôi… bài tự biết phải nói gì." },
];

export const ACE_OF_SPADES = 0;

/** Allowance for AI readings, enforced by /api/fortune. */
export const AI_READINGS_PER_HOUR = 5;
export const AI_READINGS_PER_DAY = 300;

/** In the /api/fortune text stream: "throw away what you have so far". */
export const FORTUNE_RESET = "\f";
export const FORTUNE_REFUSED_LINE = "Hừm… quẻ này mây mù che kín, ta không đọc được. Con thử hỏi câu khác xem.";

const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

export const LINES = {
  greet: "Hừmmm… lại có kẻ tìm tới đây giữa đêm khuya… Ngồi xuống. Tên con là gì?",
  askTopic: (name: string) =>
    name
      ? `${name}… cái tên nghe có duyên đấy, hehe. Con muốn hỏi chuyện gì? Gõ ra đây, hoặc chọn một chuyện.`
      : "Không chịu nói tên à? Không sao… ta biết hết. Con muốn hỏi chuyện gì? Gõ ra đây, hoặc chọn một chuyện.",
  newRound: (name: string) => (name ? `Lại là con à, ${name}… Ván này con muốn hỏi chuyện gì?` : "Lại tới nữa à… Ván này con muốn hỏi chuyện gì?"),
  ready: (ack: string) => `${ack} Bấm Bắt đầu, ta cho con xem bộ bài.`,
  questionAck: "Hừm… câu này nghe có mùi đấy. Để bài trả lời con.",
  reveal: "Nhìn cho kỹ… đủ 52 lá, bốn chất ♠ ♥ ♦ ♣, không thiếu lá nào.",
  gather: "Giờ… ta gom chúng lại.",
  deckFirst: "Tâm niệm điều con muốn hỏi… rồi bấm Xào bài. Xào bao nhiêu lần tùy tâm con.",
  shuffling: () => pick(["Bay lên… bay lên nào các con…", "Hehehe… bài ơi, nghe lời ta…", "Âm khí đang xoay vần…", "Xào nữa… xào nữa…", "Ta thấy rồi… ta thấy rồi…"]),
  shuffled: (count: number) => {
    if (count === 1) return "Bài đã nghe lời ta. Xào thêm cho kỹ… hay xòe ra mà rút?";
    if (count < 5) return `Xào ${count} lần rồi… bài đã thấm hơi con. Xòe ra được rồi đấy.`;
    return pick([`${count} lần rồi! Xào nữa là bài chóng mặt đấy… hehehe.`, `Kỹ tính thế… ${count} lần. Xòe ra thôi con.`, `${count} lần… ta mỏi tay rồi đấy nhé.`]);
  },
  fan: "Bài đã xòe. Rút đi… lá nào gọi tên con thì rút lá đó. Rút bao nhiêu tùy con.",
  allPicked: "Rút sạch cả bộ rồi… tham thế! Gom bài lại mà chơi ván mới.",
  gatherBack: "Gom hết lại… vận mới, bài mới. Xào đi con.",
  readingWait: "Im lặng… ta đang nhập hồn… các vong đang thì thầm vào tai ta…",
  readingDone: "Quẻ đã phán. Tin hay không… tùy con, hehehe.",
  readingTired: "Hừm… ta mỏi miệng rồi. Quẻ này ta đọc nhanh thôi nhé.",
  readingOffline: "Sóng tâm linh chập chờn quá… quẻ này ta đọc nhanh vậy.",
};

type RankGroup = "ace" | "low" | "high" | "face";

const READINGS: Record<Suit, Record<RankGroup, string>> = {
  hearts: {
    ace: "Trái tim đỏ rực… một niềm vui lớn đang gõ cửa nhà con.",
    low: "Chuyện vui nho nhỏ thôi, nhưng đừng bỏ qua.",
    high: "Có người đang nghĩ về con nhiều hơn con tưởng đấy… hehe.",
    face: "Một người tốt bụng sẽ giúp con. Để ý những người quanh mình.",
  },
  diamonds: {
    ace: "Tin vui về tiền bạc sắp tới… giữ ví cho chặt.",
    low: "Lộc lặt vặt… nhặt được tiền lẻ cũng nên.",
    high: "Cơ hội đang tới, nhưng phải nhanh tay. Chần chừ là nó bay mất.",
    face: "Một kẻ khéo ăn khéo nói sẽ mang tin tốt tới cho con.",
  },
  clubs: {
    ace: "Bắt đầu việc gì mới thì cứ mạnh dạn. Bài ủng hộ con.",
    low: "Chăm chỉ thêm một chút nữa là ổn thôi.",
    high: "Công sức con bỏ ra sắp được đền đáp rồi.",
    face: "Có một người thầy, người anh chị sẽ chỉ đường cho con.",
  },
  spades: {
    ace: "",
    low: "Chút trục trặc nhỏ… bình tĩnh là qua.",
    high: "Ta thấy mây đen… cẩn thận, đừng hấp tấp.",
    face: "Một kẻ khó tính đang để ý con đấy… hehehe.",
  },
};

/** What she says about a freshly drawn card. `topic` is passed for the first card only, to tie the reading to the question. */
export function reading(id: number, name: string, topic: Topic | null): string {
  if (id === ACE_OF_SPADES) {
    return `ÁT BÍCH!!! Lá bài tử thần!!!… … Đùa thôi, hehehe. Nhưng tuần này nhớ giữ mồm giữ miệng nhé${name ? `, ${name}` : ""}.`;
  }
  const info = cardInfo(id);
  const rankIndex = id % 13;
  const group: RankGroup = rankIndex === 0 ? "ace" : rankIndex >= 10 ? "face" : rankIndex >= 5 ? "high" : "low";
  const lead = topic && topic !== "any" ? `Chuyện ${TOPICS.find((item) => item.id === topic)?.label.toLowerCase()} của con… ` : "";
  return `${lead}${info.name} ${info.suit.symbol}… ${READINGS[info.suit.id][group]}`;
}

const WEEKDAYS = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];
const FACE_PEOPLE = ["một người trẻ tuổi, nhanh nhảu", "một người phụ nữ dịu dàng mà sắc sảo", "một người lớn tuổi, có tiếng nói"];
const word = (pattern: string) => new RegExp(`(^|[^\\p{L}])(${pattern})([^\\p{L}]|$)`, "iu");

type QuestionKind = "when" | "who" | "choice" | "yesno" | "other";

/** What kind of answer a typed question wants, so even the offline reading answers *it*. */
function questionKind(question: string): QuestionKind {
  const q = question.toLowerCase().trim();
  if (/(ngày nào|hôm nào|khi nào|bao giờ|lúc nào|tháng nào|năm nào|mấy giờ|thứ mấy|ngày mấy)/.test(q)) return "when";
  if (word("ai").test(q)) return "who";
  if (word("hay|hoặc").test(q)) return "choice";
  if (/(không|chưa|ko|k)\s*\?*$/.test(q) || /(có .+ không|được không|phải không)/.test(q)) return "yesno";
  return "other";
}

/** A playful but on-topic answer, decided by the cards: their sum picks a date or time, red vs black the omen. */
function answerFor(kind: QuestionKind, question: string, cards: number[]): string {
  const total = cards.reduce((sum, id) => sum + (id % 13) + 1, 0);
  const reds = cards.filter((id) => cardInfo(id).suit.red).length;
  const luck = reds * 2 - cards.length;
  const omen = luck > 0 ? "Đỏ nhiều hơn đen — điềm lành đấy." : luck < 0 ? "Đen nhiều hơn đỏ… phải cẩn thận một chút." : "Đỏ đen chia đôi… thành hay bại là ở con.";
  const q = question.toLowerCase();
  switch (kind) {
    case "when": {
      if (q.includes("giờ")) return `Ta cộng các lá lại… ${((total - 1) % 12) + 8} giờ là giờ đẹp. ${omen}`;
      if (q.includes("thứ")) return `Ta cộng các lá lại… ${WEEKDAYS[(total - 1) % 7]} là ngày hợp với con. ${omen}`;
      if (q.includes("tháng nào")) return `Ta cộng các lá lại… ra tháng ${((total - 1) % 12) + 1}. ${omen}`;
      if (q.includes("năm nào")) return luck >= 0 ? `Ngay năm nay thôi! ${omen}` : `Năm sau mới tới… đừng nóng vội. ${omen}`;
      const day = ((total - 1) % 28) + 1;
      const month = q.match(/tháng\s*(\d{1,2})/)?.[1];
      return `Ta cộng các lá lại… ra con số ${day}. Ngày ${day}${month ? ` tháng ${month}` : ""} là ngày đẹp. ${omen}`;
    }
    case "who": {
      const face = cards.find((id) => id % 13 >= 10);
      if (face === undefined) return "Không có lá mặt người nào… người đó con chưa gặp đâu, hehe.";
      const info = cardInfo(face);
      return `${info.name} ${info.suit.symbol} hiện lên… là ${FACE_PEOPLE[(face % 13) - 10]}, ở rất gần con.`;
    }
    case "choice": {
      const red = cardInfo(cards[0]).suit.red;
      return `Lá đầu tiên màu ${red ? "đỏ" : "đen"}… bài chọn ${red ? "cái con nói trước" : "cái con nói sau"}. ${omen}`;
    }
    case "yesno":
      return luck > 0 ? "CÓ! Bài đỏ rực lên rồi, hehehe." : luck < 0 ? "Hừm… bài đen kịt. Chưa đâu, con phải cố thêm." : "Năm ăn năm thua… bài không chịu nói, còn tùy con.";
    default:
      return omen;
  }
}

/** The quick reading for when the AI one is unavailable or used up: answers the question, then reads the standout card. */
export function offlineReading(cards: number[], name: string, topic: Topic, question: string): string {
  const topicLabel = TOPICS.find((item) => item.id === topic)?.label.toLowerCase();
  const lead = question ? `Con hỏi: “${question}”… ` : topic !== "any" ? `Chuyện ${topicLabel} của con… ` : "";
  const answer = answerFor(question ? questionKind(question) : "other", question, cards);
  // An ace or a face card says the most; otherwise the first card drawn.
  const standout = cards.find((id) => id % 13 === 0 || id % 13 >= 10) ?? cards[0];
  const studying = topic === "study" || word("thi|học|ielts|toeic|điểm|kiểm tra|đỗ|đậu|bài tập").test(question);
  const closing = studying ? "Nhưng nhớ: bài chỉ phù hộ kẻ chịu ôn bài… hehehe." : `Ta chỉ nói được bấy nhiêu thôi${name ? `, ${name}` : ""}… hehehe.`;
  return `${lead}${answer} ${reading(standout, "", null)} ${closing}`;
}
