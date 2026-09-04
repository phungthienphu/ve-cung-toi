// Default word lists, bundled directly with the PartyKit server so that
// gameplay never depends on a database round-trip. The same arrays are
// written into MongoDB (`wordlists` collection) by scripts/seed.ts purely
// for persistence / display purposes.

export interface WordlistDef {
  id: string;
  name: string;
  language: "vi" | "en";
  words: string[];
}

export const VI_DEFAULT_WORDS: string[] = [
  "con mèo", "con chó", "con gà", "con voi", "con cá", "con chim", "con rắn",
  "con bò", "con lợn", "con ngựa", "con khỉ", "con hổ", "con thỏ", "con cua",
  "cái bàn", "cái ghế", "cái tủ", "cái giường", "cái quạt", "cái đèn",
  "cái ô", "cái kính", "cái mũ", "cái áo", "cái quần", "đôi giày",
  "quả táo", "quả chuối", "quả xoài", "quả dừa", "quả dưa hấu", "quả cam",
  "bánh mì", "bánh chưng", "phở", "cơm", "trứng", "cà phê", "trà sữa",
  "mặt trời", "mặt trăng", "ngôi sao", "đám mây", "cầu vồng", "cơn mưa",
  "ngọn núi", "dòng sông", "bãi biển", "hòn đảo", "cây thông", "hoa hồng",
  "bác sĩ", "giáo viên", "ca sĩ", "đầu bếp", "phi công", "cảnh sát",
  "xe đạp", "xe máy", "ô tô", "máy bay", "tàu thủy", "tàu hỏa",
  "điện thoại", "máy tính", "ti vi", "tủ lạnh", "máy giặt", "đồng hồ",
  "quả bóng", "cây đàn guitar", "quyển sách", "cái bút", "lá cờ", "chìa khóa",
  "người tuyết", "ông già Noel", "siêu nhân", "ma cà rồng", "rồng", "cầu vồng",
];

export const EN_DEFAULT_WORDS: string[] = [
  "cat", "dog", "chicken", "elephant", "fish", "bird", "snake",
  "cow", "pig", "horse", "monkey", "tiger", "rabbit", "crab",
  "table", "chair", "wardrobe", "bed", "fan", "lamp",
  "umbrella", "glasses", "hat", "shirt", "pants", "shoes",
  "apple", "banana", "mango", "coconut", "watermelon", "orange",
  "bread", "rice", "egg", "coffee", "milk tea", "pizza",
  "sun", "moon", "star", "cloud", "rainbow", "rain",
  "mountain", "river", "beach", "island", "pine tree", "rose",
  "doctor", "teacher", "singer", "chef", "pilot", "police officer",
  "bicycle", "motorbike", "car", "airplane", "ship", "train",
  "phone", "computer", "television", "refrigerator", "washing machine", "clock",
  "ball", "guitar", "book", "pen", "flag", "key",
  "snowman", "santa claus", "superhero", "vampire", "dragon", "robot",
];

export const VI_HARD_WORDS: string[] = [
  "deadline dí sát nút", "wifi yếu", "hết pin lúc quan trọng", "nhạc sến",
  "crush đi ngang qua", "giả vờ bận", "họp online bị đơ hình", "sếp gọi ngoài giờ",
  "kẹt xe giờ tan tầm", "trà đá vỉa hè", "cháy túi cuối tháng", "giao hàng nhầm địa chỉ",
  "wifi chùa hàng xóm", "mất ví đúng lúc đói", "dậy muộn đi làm", "than thở cuối tuần",
  "ảo tưởng sức mạnh", "flex quá đà", "đu trend", "cà khịa",
  "sống ảo", "ghost tin nhắn", "đứng hình mất 5 giây", "hết mood làm việc",
  "nấu ăn cháy nồi", "đi làm vào thứ hai", "họp hành liên miên", "lương ba cọc ba đồng",
  "đặt đồ ăn nhầm món", "sạc pin quên rút", "gửi nhầm tin nhắn cho sếp", "quên mật khẩu",
  "lag game giữa trận", "spam like dạo", "trà chanh chém gió", "canh giờ vàng săn sale",
  "chỉnh ảnh sống ảo", "trốn deadline", "họp lại chốt lịch họp", "khoe con lên mạng",
  "review 1 sao dạo",
];

export const EN_HARD_WORDS: string[] = [
  "deadline stress", "dead phone battery", "awkward silence", "Monday morning",
  "ghosted text", "burnt dinner", "overslept alarm", "video call freeze",
  "broke by month end", "secret crush", "fake busy", "traffic jam",
  "spam likes", "forgot password", "wrong order delivered", "boss calls after hours",
  "running out of memes", "procrastination", "autocorrect fail", "buffering video",
  "lost airpod", "overthinking", "group project drama", "cliffhanger ending",
  "plot twist", "awkward eye contact", "endless scrolling", "humble brag",
  "doom scrolling", "fashionably late",
];

export const DEFAULT_WORDLISTS: WordlistDef[] = [
  { id: "vi-default", name: "Đời sống (Tiếng Việt - Dễ)", language: "vi", words: VI_DEFAULT_WORDS },
  { id: "en-default", name: "Everyday life (English - Easy)", language: "en", words: EN_DEFAULT_WORDS },
  { id: "vi-hard", name: "Khó & Hài hước (Tiếng Việt)", language: "vi", words: VI_HARD_WORDS },
  { id: "en-hard", name: "Hard & Funny (English)", language: "en", words: EN_HARD_WORDS },
];

export function getWordsForIds(ids: string[]): string[] {
  const words: string[] = [];
  for (const id of ids) {
    const list = DEFAULT_WORDLISTS.find((w) => w.id === id);
    if (list) words.push(...list.words);
  }
  return words;
}
