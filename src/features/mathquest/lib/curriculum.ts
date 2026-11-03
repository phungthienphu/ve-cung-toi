// The whole Kết nối tri thức outline for the grades we teach — chapter and
// lesson names only, for the AI exercise maker's pickers. Fixed here rather
// than asked of the AI, which could invent lessons. Lesson ids match the
// notebook's ("g9-c1-b3" = lớp 9, chương I, bài 3).

export type CurriculumGrade = 8 | 9;

export interface CurriculumLesson {
  id: string;
  grade: CurriculumGrade;
  chapter: number;
  number: number;
  title: string;
}

export interface CurriculumChapter {
  grade: CurriculumGrade;
  number: number;
  roman: string;
  title: string;
  lessons: CurriculumLesson[];
}

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

const OUTLINE: Record<CurriculumGrade, [string, [number, string][]][]> = {
  8: [
    ["Đa thức", [[1, "Đơn thức"], [2, "Đa thức"], [3, "Phép cộng và phép trừ đa thức"], [4, "Phép nhân đa thức"], [5, "Phép chia đa thức cho đơn thức"]]],
    ["Hằng đẳng thức đáng nhớ và ứng dụng", [[6, "Hiệu hai bình phương. Bình phương của một tổng hay một hiệu"], [7, "Lập phương của một tổng. Lập phương của một hiệu"], [8, "Tổng và hiệu hai lập phương"], [9, "Phân tích đa thức thành nhân tử"]]],
    ["Tứ giác", [[10, "Tứ giác"], [11, "Hình thang cân"], [12, "Hình bình hành"], [13, "Hình chữ nhật"], [14, "Hình thoi và hình vuông"]]],
    ["Định lí Thalès", [[15, "Định lí Thalès trong tam giác"], [16, "Đường trung bình của tam giác"], [17, "Tính chất đường phân giác của tam giác"]]],
    ["Dữ liệu và biểu đồ", [[18, "Thu thập và phân loại dữ liệu"], [19, "Biểu diễn dữ liệu bằng bảng, biểu đồ"], [20, "Phân tích số liệu thống kê dựa vào biểu đồ"]]],
    ["Phân thức đại số", [[21, "Phân thức đại số"], [22, "Tính chất cơ bản của phân thức đại số"], [23, "Phép cộng và phép trừ phân thức đại số"], [24, "Phép nhân và phép chia phân thức đại số"]]],
    ["Phương trình bậc nhất và hàm số bậc nhất", [[25, "Phương trình bậc nhất một ẩn"], [26, "Giải bài toán bằng cách lập phương trình"], [27, "Khái niệm hàm số và đồ thị của hàm số"], [28, "Hàm số bậc nhất và đồ thị của hàm số bậc nhất"], [29, "Hệ số góc của đường thẳng"]]],
    ["Mở đầu về tính xác suất của biến cố", [[30, "Kết quả có thể và kết quả thuận lợi"], [31, "Cách tính xác suất của biến cố bằng tỉ số"], [32, "Mối liên hệ giữa xác suất thực nghiệm với xác suất và ứng dụng"]]],
    ["Tam giác đồng dạng", [[33, "Hai tam giác đồng dạng"], [34, "Ba trường hợp đồng dạng của hai tam giác"], [35, "Định lí Pythagore và ứng dụng"], [36, "Các trường hợp đồng dạng của hai tam giác vuông"], [37, "Hình đồng dạng"]]],
    ["Một số hình khối trong thực tiễn", [[38, "Hình chóp tam giác đều"], [39, "Hình chóp tứ giác đều"]]],
  ],
  9: [
    ["Phương trình và hệ hai phương trình bậc nhất hai ẩn", [[1, "Khái niệm phương trình và hệ hai phương trình bậc nhất hai ẩn"], [2, "Giải hệ hai phương trình bậc nhất hai ẩn"], [3, "Giải bài toán bằng cách lập hệ phương trình"]]],
    ["Phương trình và bất phương trình bậc nhất một ẩn", [[4, "Phương trình quy về phương trình bậc nhất một ẩn"], [5, "Bất đẳng thức và tính chất"], [6, "Bất phương trình bậc nhất một ẩn"]]],
    ["Căn bậc hai và căn bậc ba", [[7, "Căn bậc hai và căn thức bậc hai"], [8, "Khai căn bậc hai với phép nhân và phép chia"], [9, "Biến đổi đơn giản và rút gọn biểu thức chứa căn thức bậc hai"], [10, "Căn bậc ba và căn thức bậc ba"]]],
    ["Hệ thức lượng trong tam giác vuông", [[11, "Tỉ số lượng giác của góc nhọn"], [12, "Một số hệ thức giữa cạnh, góc trong tam giác vuông và ứng dụng"]]],
    ["Đường tròn", [[13, "Mở đầu về đường tròn"], [14, "Cung và dây của một đường tròn"], [15, "Độ dài của cung tròn. Diện tích hình quạt tròn và hình vành khuyên"], [16, "Vị trí tương đối của đường thẳng và đường tròn"], [17, "Vị trí tương đối của hai đường tròn"]]],
    ["Hàm số y = ax² (a ≠ 0). Phương trình bậc hai một ẩn", [[18, "Hàm số y = ax² (a ≠ 0)"], [19, "Phương trình bậc hai một ẩn"], [20, "Định lí Viète và ứng dụng"], [21, "Giải bài toán bằng cách lập phương trình"]]],
    ["Tần số và tần số tương đối", [[22, "Bảng tần số và biểu đồ tần số"], [23, "Bảng tần số tương đối và biểu đồ tần số tương đối"], [24, "Bảng tần số, tần số tương đối ghép nhóm và biểu đồ"]]],
    ["Xác suất của biến cố trong một số mô hình xác suất đơn giản", [[25, "Phép thử ngẫu nhiên và không gian mẫu"], [26, "Xác suất của biến cố liên quan tới phép thử"]]],
    ["Đường tròn ngoại tiếp và đường tròn nội tiếp", [[27, "Góc nội tiếp"], [28, "Đường tròn ngoại tiếp và đường tròn nội tiếp của một tam giác"], [29, "Tứ giác nội tiếp"], [30, "Đa giác đều"]]],
    ["Một số hình khối trong thực tiễn", [[31, "Hình trụ và hình nón"], [32, "Hình cầu"]]],
  ],
};

export const CURRICULUM: CurriculumChapter[] = ([8, 9] as const).flatMap((grade) =>
  OUTLINE[grade].map(([title, lessons], index) => {
    const number = index + 1;
    return {
      grade,
      number,
      roman: ROMAN[number],
      title,
      lessons: lessons.map(([lesson, lessonTitle]) => ({ id: `g${grade}-c${number}-b${lesson}`, grade, chapter: number, number: lesson, title: lessonTitle })),
    };
  })
);

const ALL_LESSONS = CURRICULUM.flatMap((chapter) => chapter.lessons);

export function findCurriculumLesson(id: unknown): { lesson: CurriculumLesson; chapter: CurriculumChapter } | null {
  const lesson = ALL_LESSONS.find((item) => item.id === id);
  if (!lesson) return null;
  return { lesson, chapter: CURRICULUM.find((chapter) => chapter.grade === lesson.grade && chapter.number === lesson.chapter)! };
}
