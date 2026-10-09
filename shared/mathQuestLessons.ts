// Math Quest lesson notebook ("Sổ tay bài học"): one page per lesson of the
// Kết nối tri thức textbook, written in our own words (never copied from the
// book). Drafted by Claude; a lesson only reaches students once the tutor
// approves it on the tutor page (status lives in MongoDB, not here).
//
// Each lesson: what to remember, worked examples revealed step by step, the
// mistakes kids actually make, and a quick practice drawn from the question
// generators in mathBossTypes.ts.

import type { Grade, TopicId } from "./mathBossTypes";

export interface LessonPoint {
  formula?: string;
  text: string;
}

export interface LessonExample {
  prompt: string;
  steps: string[];
}

export interface LessonMistake {
  wrong: string;
  right: string;
  why: string;
}

export interface Lesson {
  /** Stable id stored with progress: "g8-c2-b6" = lớp 8, chương II, bài 6. */
  id: string;
  grade: Grade;
  chapter: number;
  number: number;
  title: string;
  summary: string;
  remember: LessonPoint[];
  examples: LessonExample[];
  mistakes: LessonMistake[];
  /** Generators for the "Luyện nhanh" quiz; empty means no quiz yet. */
  practice: TopicId[];
}

export interface Chapter {
  grade: Grade;
  number: number;
  roman: string;
  title: string;
  lessons: Lesson[];
}

export const CHAPTERS: Chapter[] = [
  {
    grade: 8,
    number: 1,
    roman: "I",
    title: "Đa thức",
    lessons: [
      {
        id: "g8-c1-b1",
        grade: 8,
        chapter: 1,
        number: 1,
        title: "Đơn thức",
        summary: "Đơn thức, đơn thức thu gọn, bậc của đơn thức và cộng trừ các đơn thức đồng dạng.",
        remember: [
          { text: "Đơn thức là biểu thức chỉ gồm một số, một biến, hoặc một tích giữa các số và các biến. Ví dụ: 5, x, −3x²y." },
          { formula: "xᵐ · xⁿ = xᵐ⁺ⁿ", text: "Thu gọn đơn thức: nhân các hệ số với nhau; nhân lũy thừa cùng biến thì cộng số mũ." },
          { text: "Bậc của đơn thức (hệ số khác 0) là tổng số mũ của tất cả các biến. Ví dụ −5x³y² có bậc 3 + 2 = 5." },
          { formula: "3x²y + 5x²y = 8x²y", text: "Đơn thức đồng dạng có cùng phần biến; cộng (trừ) chúng thì cộng (trừ) hệ số, giữ nguyên phần biến." },
        ],
        examples: [
          { prompt: "Thu gọn (3x²y)·(−2xy³)", steps: ["Nhân hệ số: 3·(−2) = −6", "Nhân phần biến: x²·x = x³; y·y³ = y⁴", "= −6x³y⁴"] },
          { prompt: "Tìm bậc của đơn thức 7x⁴y", steps: ["Số mũ của x là 4, của y là 1", "Bậc = 4 + 1 = 5"] },
          { prompt: "Tính 4xy² − 9xy² + xy²", steps: ["Ba đơn thức đồng dạng (cùng phần biến xy²)", "= (4 − 9 + 1)xy² = −4xy²"] },
        ],
        mistakes: [
          { wrong: "x² · x³ = x⁶", right: "x² · x³ = x⁵", why: "Nhân lũy thừa cùng cơ số thì cộng số mũ, không nhân." },
          { wrong: "2x² + 3x = 5x³", right: "2x² + 3x không thu gọn được nữa", why: "Chỉ cộng được các đơn thức đồng dạng (cùng phần biến)." },
        ],
        practice: ["g8-monomial"],
      },
      {
        id: "g8-c1-b2",
        grade: 8,
        chapter: 1,
        number: 2,
        title: "Đa thức",
        summary: "Đa thức là tổng các đơn thức; thu gọn bằng cách gom hạng tử đồng dạng; bậc là bậc cao nhất sau khi thu gọn.",
        remember: [
          { text: "Đa thức là một tổng của những đơn thức; mỗi đơn thức là một hạng tử. Ví dụ: 3x² − 2x + 1." },
          { text: "Thu gọn đa thức: cộng (trừ) các hạng tử đồng dạng với nhau." },
          { text: "Bậc của đa thức là bậc của hạng tử có bậc cao nhất trong dạng thu gọn." },
        ],
        examples: [
          { prompt: "Thu gọn 3x² + 2x − x² + 5x − 4", steps: ["Gom: (3x² − x²) + (2x + 5x) − 4", "= 2x² + 7x − 4"] },
          { prompt: "Tìm bậc của đa thức x³y + 2xy − 4 + x³y", steps: ["Thu gọn: 2x³y + 2xy − 4", "Hạng tử 2x³y có bậc 3 + 1 = 4", "Bậc của đa thức là 4"] },
          { prompt: "Tìm bậc của x⁵ + 3x² − x⁵ + 1", steps: ["Thu gọn: x⁵ − x⁵ = 0, còn lại 3x² + 1", "Bậc là 2 (không phải 5!)"] },
        ],
        mistakes: [
          { wrong: "Bậc của x⁵ + 3x² − x⁵ + 1 là 5", right: "Bậc là 2", why: "Phải thu gọn trước rồi mới xét bậc." },
        ],
        practice: [],
      },
      {
        id: "g8-c1-b3",
        grade: 8,
        chapter: 1,
        number: 3,
        title: "Phép cộng và phép trừ đa thức",
        summary: "Cộng, trừ hai đa thức: bỏ ngoặc cho đúng dấu rồi gom các hạng tử đồng dạng.",
        remember: [
          { text: "Cộng đa thức: bỏ ngoặc (giữ nguyên dấu các hạng tử) rồi thu gọn." },
          { formula: "−(B − C + D) = −B + C − D", text: "Trừ đa thức: trước ngoặc có dấu trừ thì đổi dấu TẤT CẢ hạng tử trong ngoặc." },
        ],
        examples: [
          { prompt: "(2x² + 3x − 1) + (x² − 5x + 4)", steps: ["= 2x² + 3x − 1 + x² − 5x + 4", "= 3x² − 2x + 3"] },
          { prompt: "(3x² − 2x + 1) − (x² + 5x − 4)", steps: ["= 3x² − 2x + 1 − x² − 5x + 4", "= 2x² − 7x + 5"] },
        ],
        mistakes: [
          { wrong: "(3x² − 2x + 1) − (x² + 5x − 4) = 3x² − 2x + 1 − x² + 5x − 4", right: "= 3x² − 2x + 1 − x² − 5x + 4", why: "Mới đổi dấu hạng tử đầu tiên — phải đổi dấu mọi hạng tử trong ngoặc." },
        ],
        practice: ["g8-polyadd"],
      },
      {
        id: "g8-c1-b4",
        grade: 8,
        chapter: 1,
        number: 4,
        title: "Phép nhân đa thức",
        summary: "Nhân đơn thức với đa thức và nhân đa thức với đa thức: mỗi hạng tử nhân với mỗi hạng tử.",
        remember: [
          { formula: "A(B + C) = AB + AC", text: "Nhân đơn thức với đa thức: nhân đơn thức với từng hạng tử rồi cộng lại." },
          { formula: "(A + B)(C + D) = AC + AD + BC + BD", text: "Nhân đa thức với đa thức: mỗi hạng tử của đa thức này nhân với mỗi hạng tử của đa thức kia, rồi thu gọn." },
        ],
        examples: [
          { prompt: "Nhân 2x(3x − 4)", steps: ["= 2x·3x + 2x·(−4)", "= 6x² − 8x"] },
          { prompt: "Nhân (x + 2)(x − 5)", steps: ["= x·x + x·(−5) + 2·x + 2·(−5)", "= x² − 5x + 2x − 10", "= x² − 3x − 10"] },
          { prompt: "Nhân (2x − 1)(x + 3)", steps: ["= 2x² + 6x − x − 3", "= 2x² + 5x − 3"] },
        ],
        mistakes: [
          { wrong: "(x + 2)(x − 5) = x² − 10", right: "(x + 2)(x − 5) = x² − 3x − 10", why: "Quên nhân chéo x·(−5) và 2·x." },
          { wrong: "2x(3x − 4) = 6x² − 4", right: "2x(3x − 4) = 6x² − 8x", why: "Phải nhân 2x với cả hạng tử thứ hai." },
        ],
        practice: ["g8-polymul"],
      },
      {
        id: "g8-c1-b5",
        grade: 8,
        chapter: 1,
        number: 5,
        title: "Phép chia đa thức cho đơn thức",
        summary: "Chia đơn thức cho đơn thức; chia đa thức cho đơn thức bằng cách chia từng hạng tử.",
        remember: [
          { formula: "xᵐ : xⁿ = xᵐ⁻ⁿ (m ≥ n)", text: "Chia đơn thức cho đơn thức: chia hệ số cho hệ số; chia lũy thừa cùng biến thì trừ số mũ." },
          { formula: "(A + B) : C = A : C + B : C", text: "Chia đa thức cho đơn thức: chia từng hạng tử rồi cộng các kết quả." },
          { text: "Phép chia là chia hết khi mỗi biến của đơn thức chia có mặt trong mọi hạng tử bị chia với số mũ không nhỏ hơn." },
        ],
        examples: [
          { prompt: "Tính 12x⁴y² : 3x²y", steps: ["12 : 3 = 4; x⁴ : x² = x²; y² : y = y", "= 4x²y"] },
          { prompt: "Tính (6x³ − 9x² + 3x) : 3x", steps: ["6x³ : 3x = 2x²; −9x² : 3x = −3x; 3x : 3x = 1", "= 2x² − 3x + 1"] },
        ],
        mistakes: [
          { wrong: "x⁶ : x² = x³", right: "x⁶ : x² = x⁴", why: "Chia lũy thừa cùng cơ số thì trừ số mũ, không chia." },
          { wrong: "(6x³ − 9x²) : 3x = 2x² − 9x²", right: "(6x³ − 9x²) : 3x = 2x² − 3x", why: "Phải chia cả hạng tử thứ hai." },
        ],
        practice: ["g8-polydiv"],
      },
    ],
  },
  {
    grade: 8,
    number: 2,
    roman: "II",
    title: "Hằng đẳng thức đáng nhớ và ứng dụng",
    lessons: [
      {
        id: "g8-c2-b6",
        grade: 8,
        chapter: 2,
        number: 6,
        title: "Hiệu hai bình phương. Bình phương của một tổng hay một hiệu",
        summary: "Ba hằng đẳng thức đầu tiên: bình phương một tổng, bình phương một hiệu và hiệu hai bình phương.",
        remember: [
          { formula: "(A + B)² = A² + 2AB + B²", text: "Bình phương một tổng = bình phương số thứ nhất, cộng hai lần tích, cộng bình phương số thứ hai." },
          { formula: "(A − B)² = A² − 2AB + B²", text: "Bình phương một hiệu: giống hệt trên, chỉ đổi dấu hạng tử ở giữa." },
          { formula: "A² − B² = (A − B)(A + B)", text: "Hiệu hai bình phương = hiệu nhân tổng." },
          { text: "A và B có thể là số, là biến hoặc cả một biểu thức như 2x, 3y²." },
        ],
        examples: [
          { prompt: "Khai triển (x + 4)²", steps: ["(x + 4)² = x² + 2·x·4 + 4²", "= x² + 8x + 16"] },
          { prompt: "Khai triển (2x − 3)²", steps: ["Ở đây A = 2x, B = 3", "(2x − 3)² = (2x)² − 2·2x·3 + 3²", "= 4x² − 12x + 9"] },
          { prompt: "Viết 9x² − 25 thành tích", steps: ["9x² − 25 = (3x)² − 5²", "= (3x − 5)(3x + 5)"] },
          { prompt: "Tính nhanh 101²", steps: ["101² = (100 + 1)²", "= 100² + 2·100·1 + 1²", "= 10\u202f000 + 200 + 1 = 10\u202f201"] },
        ],
        mistakes: [
          { wrong: "(x + 3)² = x² + 9", right: "(x + 3)² = x² + 6x + 9", why: "Quên hạng tử 2AB ở giữa." },
          { wrong: "(2x − 1)² = 2x² − 4x + 1", right: "(2x − 1)² = 4x² − 4x + 1", why: "Phải bình phương cả hệ số: (2x)² = 4x²." },
          { wrong: "x² − 16 = (x − 4)²", right: "x² − 16 = (x − 4)(x + 4)", why: "Hiệu hai bình phương là hiệu nhân tổng, không phải bình phương của hiệu." },
        ],
        practice: ["g8-square", "g8-diffsq", "g8-evaluate"],
      },
      {
        id: "g8-c2-b7",
        grade: 8,
        chapter: 2,
        number: 7,
        title: "Lập phương của một tổng. Lập phương của một hiệu",
        summary: "Khai triển (A + B)³ và (A − B)³ — bốn hạng tử với hệ số 1, 3, 3, 1.",
        remember: [
          { formula: "(A + B)³ = A³ + 3A²B + 3AB² + B³", text: "Lập phương một tổng có 4 hạng tử, hệ số lần lượt 1 – 3 – 3 – 1." },
          { formula: "(A − B)³ = A³ − 3A²B + 3AB² − B³", text: "Lập phương một hiệu: dấu đan xen +, −, +, −." },
          { text: "Số mũ của A giảm dần 3 → 2 → 1 → 0, số mũ của B tăng dần 0 → 1 → 2 → 3." },
        ],
        examples: [
          { prompt: "Khai triển (x + 2)³", steps: ["(x + 2)³ = x³ + 3·x²·2 + 3·x·2² + 2³", "= x³ + 6x² + 12x + 8"] },
          { prompt: "Khai triển (x − 1)³", steps: ["(x − 1)³ = x³ − 3·x²·1 + 3·x·1² − 1³", "= x³ − 3x² + 3x − 1"] },
          { prompt: "Viết x³ + 9x² + 27x + 27 dưới dạng lập phương", steps: ["27 = 3³; 9x² = 3·x²·3; 27x = 3·x·3²", "Vậy x³ + 9x² + 27x + 27 = (x + 3)³"] },
        ],
        mistakes: [
          { wrong: "(x + 2)³ = x³ + 8", right: "(x + 2)³ = x³ + 6x² + 12x + 8", why: "Lập phương một tổng có 4 hạng tử, không chỉ là lập phương từng số." },
          { wrong: "(x − 2)³ = x³ − 6x² − 12x − 8", right: "(x − 2)³ = x³ − 6x² + 12x − 8", why: "Dấu đan xen +, −, +, −: hạng tử 3AB² luôn mang dấu cộng." },
        ],
        practice: ["g8-cube"],
      },
      {
        id: "g8-c2-b8",
        grade: 8,
        chapter: 2,
        number: 8,
        title: "Tổng và hiệu hai lập phương",
        summary: "Viết A³ + B³ và A³ − B³ thành tích — ngoặc thứ hai là một \"bình phương thiếu\".",
        remember: [
          { formula: "A³ + B³ = (A + B)(A² − AB + B²)", text: "Tổng hai lập phương." },
          { formula: "A³ − B³ = (A − B)(A² + AB + B²)", text: "Hiệu hai lập phương." },
          { text: "Ngoặc thứ hai chỉ có AB (không phải 2AB), và dấu của AB ngược với dấu ở ngoặc đầu." },
        ],
        examples: [
          { prompt: "Viết x³ + 8 thành tích", steps: ["x³ + 8 = x³ + 2³", "= (x + 2)(x² − 2x + 4)"] },
          { prompt: "Viết 27 − y³ thành tích", steps: ["27 − y³ = 3³ − y³", "= (3 − y)(9 + 3y + y²)"] },
          { prompt: "Rút gọn (x − 1)(x² + x + 1)", steps: ["Đây đúng dạng (A − B)(A² + AB + B²) với A = x, B = 1", "= x³ − 1"] },
        ],
        mistakes: [
          { wrong: "x³ + 8 = (x + 2)³", right: "x³ + 8 = (x + 2)(x² − 2x + 4)", why: "Tổng hai lập phương khác lập phương của một tổng." },
          { wrong: "x³ − 1 = (x − 1)(x² − x + 1)", right: "x³ − 1 = (x − 1)(x² + x + 1)", why: "Dấu của AB trong ngoặc thứ hai ngược với dấu ở ngoặc đầu." },
        ],
        practice: ["g8-sumcubes"],
      },
      {
        id: "g8-c2-b9",
        grade: 8,
        chapter: 2,
        number: 9,
        title: "Phân tích đa thức thành nhân tử",
        summary: "Biến một tổng thành một tích bằng ba cách: đặt nhân tử chung, dùng hằng đẳng thức, nhóm hạng tử.",
        remember: [
          { text: "Phân tích đa thức thành nhân tử là viết đa thức đó thành một tích của những đa thức." },
          { formula: "AB + AC = A(B + C)", text: "Cách 1 — Đặt nhân tử chung." },
          { formula: "x² − 9 = (x − 3)(x + 3)", text: "Cách 2 — Dùng hằng đẳng thức." },
          { formula: "x² − xy + 3x − 3y = (x − y)(x + 3)", text: "Cách 3 — Nhóm hạng tử cho xuất hiện nhân tử chung." },
          { text: "Nên thử theo thứ tự: nhân tử chung → hằng đẳng thức → nhóm. Làm xong, nhân ngược lại để kiểm tra." },
        ],
        examples: [
          { prompt: "Phân tích 6x² − 9x", steps: ["Nhân tử chung là 3x", "6x² − 9x = 3x(2x − 3)"] },
          { prompt: "Phân tích x² − 10x + 25", steps: ["= x² − 2·x·5 + 5²", "= (x − 5)²"] },
          { prompt: "Phân tích x² − xy + 3x − 3y", steps: ["= (x² − xy) + (3x − 3y)", "= x(x − y) + 3(x − y)", "= (x − y)(x + 3)"] },
          { prompt: "Phân tích 2x² − 8", steps: ["Đặt nhân tử chung: = 2(x² − 4)", "Dùng hằng đẳng thức: = 2(x − 2)(x + 2)"] },
        ],
        mistakes: [
          { wrong: "6x² − 9x = 3(2x² − 3x)", right: "6x² − 9x = 3x(2x − 3)", why: "Chưa lấy hết nhân tử chung — x vẫn còn chung." },
          { wrong: "2x² − 8 = 2(x² − 4)", right: "2x² − 8 = 2(x − 2)(x + 2)", why: "Phải phân tích đến cùng: x² − 4 vẫn tách tiếp được." },
        ],
        practice: ["g8-factor"],
      },
    ],
  },
  {
    grade: 9,
    number: 1,
    roman: "I",
    title: "Phương trình và hệ hai phương trình bậc nhất hai ẩn",
    lessons: [
      {
        id: "g9-c1-b1",
        grade: 9,
        chapter: 1,
        number: 1,
        title: "Khái niệm phương trình và hệ hai phương trình bậc nhất hai ẩn",
        summary: "Phương trình ax + by = c, nghiệm là cặp số (x; y); hệ hai phương trình và nghiệm chung.",
        remember: [
          { formula: "ax + by = c (a, b không đồng thời bằng 0)", text: "Phương trình bậc nhất hai ẩn x, y." },
          { text: "Cặp số (x₀; y₀) là nghiệm nếu thay x = x₀, y = y₀ vào được đẳng thức đúng. Mỗi phương trình có vô số nghiệm." },
          { text: "Hệ hai phương trình bậc nhất hai ẩn: nghiệm của hệ là nghiệm chung của cả hai phương trình." },
        ],
        examples: [
          { prompt: "(1; 3) có là nghiệm của 2x + y = 5 không?", steps: ["Thay vào: 2·1 + 3 = 5", "Đúng ⇒ (1; 3) là nghiệm"] },
          { prompt: "(2; 1) có là nghiệm của hệ x + y = 3; x − y = 1 không?", steps: ["2 + 1 = 3 ✓", "2 − 1 = 1 ✓", "Thỏa mãn cả hai ⇒ là nghiệm của hệ"] },
        ],
        mistakes: [
          { wrong: "(3; 1) là nghiệm của 2x + y = 5 vì 2·1 + 3 = 5", right: "Với (3; 1): x = 3, y = 1 ⇒ 2·3 + 1 = 7 ≠ 5", why: "Cặp (x; y) có thứ tự: số đầu là x, số sau là y." },
        ],
        practice: ["g9-pairsol"],
      },
      {
        id: "g9-c1-b2",
        grade: 9,
        chapter: 1,
        number: 2,
        title: "Giải hệ hai phương trình bậc nhất hai ẩn",
        summary: "Hai cách giải: phương pháp thế và phương pháp cộng đại số.",
        remember: [
          { text: "Phương pháp thế: từ một phương trình rút một ẩn theo ẩn kia, thế vào phương trình còn lại để được phương trình một ẩn." },
          { text: "Phương pháp cộng đại số: làm cho hệ số của một ẩn bằng nhau (hoặc đối nhau), rồi trừ (hoặc cộng) hai phương trình để khử ẩn đó." },
          { text: "Tìm được một ẩn thì thay vào tìm ẩn còn lại, và kết luận nghiệm (x; y)." },
        ],
        examples: [
          { prompt: "Giải hệ x + y = 5; x − y = 1", steps: ["Cộng hai phương trình: 2x = 6 ⇒ x = 3", "Thay vào: y = 5 − 3 = 2", "Nghiệm (x; y) = (3; 2)"] },
          { prompt: "Giải hệ 2x + y = 7; x − 3y = 0", steps: ["Từ phương trình sau: x = 3y", "Thế vào: 2·3y + y = 7 ⇒ 7y = 7 ⇒ y = 1", "x = 3·1 = 3. Nghiệm (3; 1)"] },
          { prompt: "Giải hệ 2x + 3y = 8; 2x − y = 0", steps: ["Trừ hai phương trình: 4y = 8 ⇒ y = 2", "2x − 2 = 0 ⇒ x = 1", "Nghiệm (1; 2)"] },
        ],
        mistakes: [
          { wrong: "Tìm được x = 3 là xong", right: "Thay vào tìm y rồi kết luận nghiệm (3; 2)", why: "Nghiệm của hệ là một cặp số." },
          { wrong: "Trừ hai phương trình nhưng chỉ trừ vế trái", right: "(2x + 3y) − (2x − y) = 8 − 0", why: "Cộng, trừ phương trình là cộng, trừ cả vế trái lẫn vế phải." },
        ],
        practice: ["g9-system"],
      },
      {
        id: "g9-c1-b3",
        grade: 9,
        chapter: 1,
        number: 3,
        title: "Giải bài toán bằng cách lập hệ phương trình",
        summary: "Bốn bước: chọn ẩn, lập hệ, giải hệ, đối chiếu điều kiện rồi trả lời.",
        remember: [
          { text: "Bước 1: Chọn hai ẩn, ghi rõ đơn vị và điều kiện (ví dụ số con vật phải là số nguyên dương)." },
          { text: "Bước 2: Dịch mỗi dữ kiện của đề thành một phương trình, được hệ hai phương trình." },
          { text: "Bước 3: Giải hệ. Bước 4: Đối chiếu nghiệm với điều kiện rồi trả lời đúng câu hỏi." },
        ],
        examples: [
          { prompt: "Vừa gà vừa chó có 36 con, đếm được 100 chân. Có bao nhiêu con mỗi loại?", steps: ["Gọi số gà là x, số chó là y (x, y nguyên dương)", "x + y = 36; 2x + 4y = 100", "Lấy phương trình sau trừ 2 lần phương trình đầu: 2y = 28 ⇒ y = 14, x = 22", "Vậy có 22 con gà và 14 con chó"] },
          { prompt: "Mua 3 quyển vở và 2 cái bút hết 34 nghìn; mua 2 quyển vở và 3 cái bút hết 31 nghìn. Tìm giá mỗi loại.", steps: ["Gọi giá vở là x, giá bút là y (nghìn đồng)", "3x + 2y = 34; 2x + 3y = 31", "Giải hệ: x = 8, y = 5", "Vở 8 nghìn, bút 5 nghìn"] },
        ],
        mistakes: [
          { wrong: "Giải ra y = 14 rồi trả lời \"có 14 con gà\"", right: "y là số chó ⇒ có 14 con chó", why: "Nhìn lại mình đã đặt ẩn nào là đại lượng nào trước khi trả lời." },
        ],
        practice: ["g9-wordsys"],
      },
    ],
  },
  {
    grade: 9,
    number: 2,
    roman: "II",
    title: "Phương trình và bất phương trình bậc nhất một ẩn",
    lessons: [
      {
        id: "g9-c2-b4",
        grade: 9,
        chapter: 2,
        number: 4,
        title: "Phương trình quy về phương trình bậc nhất một ẩn",
        summary: "Phương trình tích và phương trình chứa ẩn ở mẫu — đưa về những phương trình bậc nhất quen thuộc.",
        remember: [
          { formula: "A·B = 0 ⇔ A = 0 hoặc B = 0", text: "Phương trình tích: cho từng thừa số bằng 0 rồi giải." },
          { text: "Muốn đưa về phương trình tích: chuyển hết sang một vế, rồi phân tích vế đó thành nhân tử." },
          { formula: "ĐKXĐ: mọi mẫu ≠ 0", text: "Phương trình chứa ẩn ở mẫu: luôn tìm điều kiện xác định trước tiên." },
          { text: "Giải phương trình chứa ẩn ở mẫu: (1) tìm ĐKXĐ, (2) quy đồng rồi khử mẫu, (3) giải phương trình vừa nhận, (4) đối chiếu ĐKXĐ, loại nghiệm không thỏa mãn." },
        ],
        examples: [
          { prompt: "Giải (x − 3)(2x + 1) = 0", steps: ["x − 3 = 0 ⇒ x = 3", "2x + 1 = 0 ⇒ x = −1/2", "Vậy x = 3 hoặc x = −1/2"] },
          { prompt: "Giải x² − 4x = 0", steps: ["Đặt nhân tử chung: x(x − 4) = 0", "x = 0 hoặc x = 4"] },
          { prompt: "Giải 1/(x − 2) + 3 = (x − 3)/(x − 2)", steps: ["ĐKXĐ: x ≠ 2", "Quy đồng, khử mẫu: 1 + 3(x − 2) = x − 3", "3x − 5 = x − 3 ⇒ 2x = 2 ⇒ x = 1", "x = 1 thỏa mãn ĐKXĐ. Vậy x = 1"] },
          { prompt: "Giải (x + 1)/(x − 1) = 2/(x − 1)", steps: ["ĐKXĐ: x ≠ 1", "Khử mẫu: x + 1 = 2 ⇒ x = 1", "x = 1 không thỏa mãn ĐKXĐ", "Vậy phương trình vô nghiệm"] },
        ],
        mistakes: [
          { wrong: "x² = 4x ⇒ x = 4 (chia hai vế cho x)", right: "x² − 4x = 0 ⇒ x(x − 4) = 0 ⇒ x = 0 hoặc x = 4", why: "Chia hai vế cho x làm mất nghiệm x = 0. Hãy chuyển vế rồi đặt nhân tử chung." },
          { wrong: "Giải xong phương trình chứa ẩn ở mẫu là kết luận luôn", right: "Đối chiếu từng nghiệm với ĐKXĐ rồi mới kết luận", why: "Nghiệm làm mẫu bằng 0 phải bị loại." },
        ],
        practice: ["g9-product", "g9-domain"],
      },
      {
        id: "g9-c2-b5",
        grade: 9,
        chapter: 2,
        number: 5,
        title: "Bất đẳng thức và tính chất",
        summary: "Khi cộng, trừ, nhân hai vế của một bất đẳng thức, lúc nào giữ chiều, lúc nào phải đổi chiều.",
        remember: [
          { text: "Các hệ thức dạng a > b, a < b, a ≥ b, a ≤ b gọi là bất đẳng thức." },
          { formula: "a > b ⇒ a + c > b + c", text: "Cộng (hoặc trừ) cùng một số vào hai vế: giữ chiều." },
          { formula: "a > b và c > 0 ⇒ ac > bc", text: "Nhân hai vế với cùng một số dương: giữ chiều." },
          { formula: "a > b và c < 0 ⇒ ac < bc", text: "Nhân hai vế với cùng một số âm: đổi chiều!" },
          { formula: "a > b và b > c ⇒ a > c", text: "Tính chất bắc cầu." },
        ],
        examples: [
          { prompt: "Cho a > b. So sánh a − 5 và b − 5", steps: ["Trừ 5 vào hai vế, giữ chiều", "a − 5 > b − 5"] },
          { prompt: "Cho a > b. So sánh −3a và −3b", steps: ["Nhân hai vế với −3 < 0 nên đổi chiều", "−3a < −3b"] },
          { prompt: "Cho a < b. So sánh 2a + 1 và 2b + 1", steps: ["Nhân hai vế với 2 > 0: 2a < 2b", "Cộng 1 vào hai vế: 2a + 1 < 2b + 1"] },
        ],
        mistakes: [
          { wrong: "a > b ⇒ −2a > −2b", right: "a > b ⇒ −2a < −2b", why: "Nhân với số âm phải đổi chiều bất đẳng thức." },
        ],
        practice: ["g9-ineqprop"],
      },
      {
        id: "g9-c2-b6",
        grade: 9,
        chapter: 2,
        number: 6,
        title: "Bất phương trình bậc nhất một ẩn",
        summary: "Giải ax + b > 0 bằng chuyển vế và chia hai vế — nhớ đổi chiều khi chia cho số âm.",
        remember: [
          { formula: "ax + b > 0 (a ≠ 0)", text: "Bất phương trình bậc nhất một ẩn (dấu cũng có thể là <, ≥, ≤)." },
          { text: "Chuyển vế: chuyển một hạng tử sang vế kia thì đổi dấu hạng tử đó." },
          { text: "Chia hai vế cho số dương thì giữ chiều; chia cho số âm thì phải đổi chiều." },
        ],
        examples: [
          { prompt: "Giải 2x − 6 > 0", steps: ["2x > 6", "Chia cho 2 > 0, giữ chiều: x > 3"] },
          { prompt: "Giải −3x + 12 ≥ 0", steps: ["−3x ≥ −12", "Chia cho −3 < 0, đổi chiều: x ≤ 4"] },
          { prompt: "Giải 5 − 2x < 1", steps: ["−2x < 1 − 5, tức −2x < −4", "Chia cho −2 < 0, đổi chiều: x > 2"] },
        ],
        mistakes: [
          { wrong: "−2x > 6 ⇒ x > −3", right: "−2x > 6 ⇒ x < −3", why: "Chia cho số âm mà quên đổi chiều." },
          { wrong: "2x − 6 > 0 ⇒ 2x > −6", right: "2x − 6 > 0 ⇒ 2x > 6", why: "Chuyển vế phải đổi dấu hạng tử." },
        ],
        practice: ["g9-inequality"],
      },
    ],
  },
  {
    grade: 9,
    number: 3,
    roman: "III",
    title: "Căn bậc hai và căn bậc ba",
    lessons: [
      {
        id: "g9-c3-b7",
        grade: 9,
        chapter: 3,
        number: 7,
        title: "Căn bậc hai và căn thức bậc hai",
        summary: "Căn bậc hai số học, điều kiện xác định của √A và hằng đẳng thức √(A²) = |A|.",
        remember: [
          { formula: "√a = x ⇔ x ≥ 0 và x² = a", text: "Căn bậc hai số học của số a ≥ 0 là số không âm có bình phương bằng a." },
          { formula: "√A xác định ⇔ A ≥ 0", text: "Căn thức bậc hai chỉ có nghĩa khi biểu thức dưới dấu căn không âm." },
          { formula: "√(A²) = |A|", text: "Kết quả luôn không âm: bằng A nếu A ≥ 0, bằng −A nếu A < 0." },
        ],
        examples: [
          { prompt: "Tính √144", steps: ["12² = 144 và 12 ≥ 0", "⇒ √144 = 12"] },
          { prompt: "Tìm điều kiện xác định của √(2x − 6)", steps: ["Cần 2x − 6 ≥ 0", "⇒ x ≥ 3"] },
          { prompt: "Rút gọn √((x − 3)²) với x < 3", steps: ["√((x − 3)²) = |x − 3|", "x < 3 nên x − 3 < 0 ⇒ |x − 3| = 3 − x"] },
        ],
        mistakes: [
          { wrong: "√((x − 3)²) = x − 3 với mọi x", right: "√((x − 3)²) = |x − 3|", why: "Căn bậc hai số học không bao giờ âm." },
          { wrong: "√(9 + 16) = 3 + 4 = 7", right: "√(9 + 16) = √25 = 5", why: "Không tách căn của một tổng thành tổng các căn." },
        ],
        practice: ["g9-sqrt"],
      },
      {
        id: "g9-c3-b8",
        grade: 9,
        chapter: 3,
        number: 8,
        title: "Khai căn bậc hai với phép nhân và phép chia",
        summary: "Căn của một tích bằng tích các căn; căn của một thương bằng thương các căn.",
        remember: [
          { formula: "√(AB) = √A · √B (A, B ≥ 0)", text: "Khai căn một tích, hoặc gộp tích các căn thành một căn." },
          { formula: "√(A/B) = √A / √B (A ≥ 0, B > 0)", text: "Khai căn một thương, hoặc gộp thương các căn thành một căn." },
        ],
        examples: [
          { prompt: "Tính √3 · √12", steps: ["= √(3 · 12) = √36", "= 6"] },
          { prompt: "Tính √50 : √2", steps: ["= √(50 : 2) = √25", "= 5"] },
          { prompt: "Tính √(16 · 25)", steps: ["= √16 · √25", "= 4 · 5 = 20"] },
        ],
        mistakes: [
          { wrong: "√3 · √12 = √15", right: "√3 · √12 = √36 = 6", why: "Nhân hai căn thì nhân các số dưới dấu căn, không cộng." },
        ],
        practice: ["g9-sqrtmul"],
      },
      {
        id: "g9-c3-b9",
        grade: 9,
        chapter: 3,
        number: 9,
        title: "Biến đổi đơn giản và rút gọn biểu thức chứa căn thức bậc hai",
        summary: "Đưa thừa số ra ngoài hay vào trong dấu căn, trục căn thức ở mẫu, cộng trừ các căn đồng dạng.",
        remember: [
          { formula: "√(A²B) = |A|√B (B ≥ 0)", text: "Đưa thừa số ra ngoài dấu căn: tách số dưới căn thành (số chính phương) × (phần còn lại)." },
          { formula: "A√B = √(A²B) (A ≥ 0, B ≥ 0)", text: "Đưa thừa số vào trong dấu căn." },
          { formula: "a/√b = a√b / b (b > 0)", text: "Trục căn thức ở mẫu: nhân cả tử và mẫu với √b." },
          { text: "Căn đồng dạng (cùng số dưới dấu căn) cộng trừ như đơn thức đồng dạng: 2√3 + 3√3 = 5√3." },
        ],
        examples: [
          { prompt: "Đưa thừa số ra ngoài dấu căn: √50", steps: ["50 = 5² · 2", "√50 = 5√2"] },
          { prompt: "Rút gọn √12 + √27", steps: ["√12 = 2√3; √27 = 3√3", "= 5√3"] },
          { prompt: "Trục căn thức ở mẫu: 6/√3", steps: ["= 6√3 / 3", "= 2√3"] },
        ],
        mistakes: [
          { wrong: "√12 + √27 = √39", right: "√12 + √27 = 5√3", why: "Không cộng các số dưới dấu căn; đưa về căn đồng dạng rồi cộng hệ số." },
          { wrong: "√50 = 2√5", right: "√50 = 5√2", why: "Số đưa ra ngoài là căn của thừa số chính phương: 50 = 25 · 2." },
        ],
        practice: ["g9-sqrtsimplify"],
      },
      {
        id: "g9-c3-b10",
        grade: 9,
        chapter: 3,
        number: 10,
        title: "Căn bậc ba và căn thức bậc ba",
        summary: "Căn bậc ba của mọi số thực, kể cả số âm.",
        remember: [
          { formula: "∛a = x ⇔ x³ = a", text: "Căn bậc ba của a là số x có lập phương bằng a." },
          { formula: "∛(−a) = −∛a", text: "Mọi số đều có đúng một căn bậc ba; số âm có căn bậc ba âm." },
          { formula: "∛(a³) = a", text: "Khác căn bậc hai, ở đây không cần trị tuyệt đối." },
        ],
        examples: [
          { prompt: "Tính ∛64", steps: ["4³ = 64", "⇒ ∛64 = 4"] },
          { prompt: "Tính ∛(−27)", steps: ["(−3)³ = −27", "⇒ ∛(−27) = −3"] },
          { prompt: "Tính ∛8 + ∛(−125)", steps: ["∛8 = 2; ∛(−125) = −5", "= 2 + (−5) = −3"] },
        ],
        mistakes: [
          { wrong: "∛(−8) không tồn tại", right: "∛(−8) = −2", why: "Chỉ căn bậc hai mới cần số dưới căn không âm; căn bậc ba thì không." },
        ],
        practice: ["g9-cbrt"],
      },
    ],
  },
];

export const LESSONS: Lesson[] = CHAPTERS.flatMap((chapter) => chapter.lessons);

export function findLesson(id: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.id === id);
}
