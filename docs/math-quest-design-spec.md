# Math Quest (tên tạm) — Game Design Specification

**Trạng thái:** v0 — chốt sau buổi grill ngày 2026-10-09, chưa có code
**Đối tượng:** gia sư (người duyệt nội dung, quản lý lớp) và người làm game
**Người chơi:** học sinh của gia sư, bắt đầu với 1 bé lớp 8 và 1 bé lớp 9 (bé lớp 8 vững hơn)
**Chương trình:** Toán GDPT 2018, bộ **Kết nối tri thức với cuộc sống**
**Nền tảng:** Web trong Vẽ cùng tôi, ưu tiên điện thoại, dùng được trên laptop. Hình ảnh **2D đơn giản**.

Quy ước: **[v1]** là bản đầu tiên (làm ngay, "càng sớm càng tốt"); **[Sau]** là các bản tiếp theo, chỉ làm khi v1 cho thấy các bé chịu chơi.

## 1. Mục tiêu

Game "vừa học vừa chơi" dùng lâu dài (ít nhất tới kỳ thi vào 10, khoảng tháng 6/2027), phục vụ cùng lúc 4 mục tiêu:

| Mục tiêu | Phần trong game |
|---|---|
| Bám chương trình trên lớp | Cốt truyện chính: vùng đất mở theo chương đang học |
| Lấp lỗ hổng kiến thức cũ | "Vùng đất cổ": kiến thức lớp dưới mà bé đang hổng |
| Ôn thi vào 10 (bé lớp 9) | "Tháp thử thách": đề trộn theo cấu trúc đề thi **[Sau]** |
| Tạo hứng thú | Lớp vỏ game: thẻ, sao, chuỗi ngày, boss, xếp hạng |

## 2. Nguyên tắc thiết kế

1. **Cấp ≠ thành thạo.** *Cấp nhân vật* tăng theo công sức, chỉ mở đồ trang trí, danh hiệu, tính năng. *Độ thành thạo* từng dạng toán chỉ tăng khi làm đúng thật và giảm nếu lâu không ôn. Mở ải, mở boss dựa vào thành thạo, không dựa vào cấp. Cày ải dễ không làm mạnh lên.
2. **Sức mạnh chỉ đến từ học.** Không có vật phẩm tăng sức mạnh mua được hay quay được. Ngẫu nhiên chỉ dành cho đồ trang trí.
3. **Sai không bị phạt nặng.** Không mất tim, không năng lượng. Câu sai vào "sổ nợ" và quay lại sau. Sai liên tiếp thì game dạy lời giải từng bước.
4. **Không ép tốc độ.** Chấm theo đúng/sai. Không đồng hồ đếm ngược từng câu khi cày ở nhà.
5. **Hai bé không bị đặt lên bàn cân.** Mỗi bé làm đề lớp mình. Game không bao giờ đặt tiến độ hai bé trên cùng một vùng cạnh nhau.
6. **Gia sư tốn ít công.** Đề tự sinh là chính. Gia sư chỉ duyệt khoảng 20–30 câu soạn sẵn mỗi tuần (~30 phút).

## 3. Thế giới và bản đồ

- **Vùng đất = một chương** của SGK. Gia sư mở vùng theo tiến độ trên lớp, nên bé không học trước bài chưa được dạy.
- **Ải = một dạng toán.** Ải trong vùng xếp theo thứ tự kiến thức. Bản đồ là một con đường dọc có các nút ải (kiểu Duolingo), dễ dùng trên điện thoại.
- **Boss vùng** ở cuối mỗi vùng: đề trộn mọi dạng trong vùng. Chỉ mở khi mọi ải trong vùng đạt 2★.
- **Vùng đất cổ:** cùng nội dung với chương lớp dưới nhưng tên, hình khác, câu hỏi nâng dần về dạng lớp trên hay gặp. Dùng khi bé lớp trên cần ôn chương bé lớp dưới đang học.
- **Bài thử thách mở cổng:** lần đầu vào một vùng đã học trên trường, bé làm bài thử ngắn (~10 phút, 1–2 câu mỗi dạng). Dạng làm đúng thì nhận 1★ luôn; dạng sai thì ải mở ra để cày.
- **Chủ đề thế giới:** chưa chốt. Hai bé bỏ phiếu giữa 3 phương án: học viện pháp sư (mỗi dạng toán là một câu thần chú), đấu trường tướng (mỗi thẻ là một tướng), thu phục quái thú (qua ải thu được linh thú). Code đặt tên qua cấu hình để đổi chủ đề không phải sửa logic.

## 4. Ải, sao và thẻ

### 4.1 Ba mức của một ải

| Sao | Điều kiện | Kiểu câu |
|---|---|---|
| 1★ | 3 câu đúng liên tiếp ở **mức 1** | Dạng trực tiếp, hệ số nhỏ |
| 2★ | 3 câu đúng liên tiếp ở **mức 2** | Hệ số lớn hơn, phân số, cần biến đổi trước |
| 3★ | 3 câu đúng liên tiếp ở **mức 3**, không dùng gợi ý | Dạng ngược, kết hợp nhiều bước |

- Đạt 1★ là mở ải tiếp theo trong vùng. Mỗi ải có nút **Gợi ý** (hiện bước đầu của lời giải); câu đã dùng gợi ý không tính cho 3★.
- 3 câu liên tiếp được chọn để chống đoán mò: với trắc nghiệm 4 lựa chọn, đoán trúng 3 lần liền chỉ có xác suất 1/64.

### 4.2 Thẻ

- Đạt 1★ lần đầu ở một ải thì bé nhận **thẻ** của dạng toán đó. Số sao của thẻ chính là độ thành thạo hiện tại.
- Thẻ là thứ bé mang vào boss và đấu hạng **[Sau]**. Thẻ càng nhiều sao càng mạnh.

### 4.3 Ôn tập ngắt quãng

- Khi đạt sao mới, thẻ có **hạn ôn** sau 2 ngày. Mỗi lần ôn là 2 câu ở mức sao hiện tại của thẻ.
- Ôn đúng cả 2 câu thì hạn ôn sau giãn ra theo bậc **2 → 5 → 10 → 20 → 40 ngày**. Ôn sai thì lùi một bậc.
- Quá hạn mà chưa ôn thì thẻ bị **phong ấn**: hiển thị tụt 1★ (thẻ không mất). Ôn đạt là gỡ phong ấn, trả lại sao.
- Thẻ đến hạn tự vào nhiệm vụ ngày (mục 5).

## 5. Một ngày chơi

- Mỗi ngày khoảng **15–20 phút**, tức **12–15 câu**. Đó là **nhiệm vụ ngày**, game tự trộn theo thứ tự:
  1. Ôn thẻ đến hạn (tối đa ~5 câu, thẻ sắp bị phong ấn trước).
  2. Tiến ải ở vùng hiện tại (~6 câu).
  3. Vùng đất cổ hoặc tháp thi vào 10 (~4 câu). Với bé lớp 9 ở v1: vùng đất cổ Hằng đẳng thức.
- Gia sư chỉnh được tỉ lệ cho từng bé **[Sau]**; v1 dùng tỉ lệ mặc định.
- Làm xong nhiệm vụ ngày thì vẫn chơi tiếp được: thành thạo vẫn tính đủ, nhưng vàng và kinh nghiệm giảm dần.
- **Sổ nợ:** câu sai được ghi lại, một câu cùng dạng (đề khác) quay lại trong nhiệm vụ của những ngày sau.
- **Khi sai:** sai lần 1 thì được làm lại câu tương tự; sai 2 lần liên tiếp thì game hiện **lời giải từng bước** rồi mới cho làm câu mới.

## 6. Trả lời câu hỏi

- Đáp án là **số** (gồm phân số, số âm, nhiều nghiệm) → **gõ số**. Bàn phím số riêng trên điện thoại có các nút `-`, `/`, `;`. Nhiều nghiệm cách nhau bằng `;`, không cần đúng thứ tự. So sánh theo giá trị đúng (1/2 = 0,5 = 2/4).
- Đáp án là **biểu thức, khẳng định, hình** → **trắc nghiệm 4 lựa chọn**. Các đáp án nhiễu được dựng từ **lỗi sai hay gặp** (ví dụ (a+b)² có nhiễu là a²+b²). Bé chọn đáp án nhiễu nào cũng được ghi lại, để gia sư thấy bé đang hiểu sai ở đâu.
- Công thức hiển thị bằng KaTeX. Trục số và hình học vẽ bằng SVG sinh từ dữ liệu đề.

## 7. Nội dung

### 7.1 Nguồn đề

- **Tự sinh (phần lớn):** mỗi dạng toán có một bộ sinh đề theo mức 1–3, kèm đáp án nhiễu và lời giải từng bước. Đề sinh ra luôn có số "đẹp" (nghiệm nguyên hoặc phân số đơn giản).
- **Soạn sẵn (lời văn, xếp bước chứng minh, hình có hình vẽ):** Claude soạn trước theo chương gia sư sắp dạy (bài tương tự, không chép nguyên SGK), kèm lời giải. Gia sư duyệt trên trang quản trị (~1 phút/câu). **Câu chưa duyệt không bao giờ ra cho học sinh.** Câu có đáp số được kiểm bằng máy trước khi đưa gia sư duyệt.
- **Hình học chứng minh:** dạng **xếp bước chứng minh** (sắp lại các bước bị xáo trộn, hoặc chọn bước tiếp theo và lý do) cùng các câu **tính toán trong hình**. Không có nhiệm vụ nộp ảnh bài làm giấy.

### 7.2 Vùng của v1

**Lớp 8 — Chương II: Hằng đẳng thức đáng nhớ và ứng dụng** (bé lớp 8 đang học)

| # | Ải | Trả lời | Đề | Đáp án nhiễu tiêu biểu |
|---|---|---|---|---|
| 1 | Bình phương một tổng / một hiệu | Trắc nghiệm | Tự sinh | thiếu 2ab; quên nhân 2; không bình phương hệ số; sai dấu hạng tử giữa |
| 2 | Hiệu hai bình phương (xuôi và ngược) | Trắc nghiệm | Tự sinh | (3x−4)² thay vì (3x−4)(3x+4) |
| 3 | Viết thành bình phương, điền hạng tử còn thiếu | Trắc nghiệm / số | Tự sinh | (x+9)² cho x²+6x+9 |
| 4 | Tính nhanh (99², 101·99, 52²−48²) | Số | Tự sinh | — |
| 5 | Lập phương một tổng / một hiệu | Trắc nghiệm | Tự sinh | x³+8; hệ số 3 đặt sai chỗ |
| 6 | Tổng, hiệu hai lập phương | Trắc nghiệm | Tự sinh | sai dấu thừa số thứ hai; nhầm với lập phương một tổng |
| 7 | Phân tích nhân tử: đặt nhân tử chung | Trắc nghiệm | Tự sinh | lấy chưa hết nhân tử chung; sai dấu trong ngoặc |
| 8 | Phân tích nhân tử: dùng hằng đẳng thức | Trắc nghiệm | Tự sinh | nhận nhầm hằng đẳng thức |
| 9 | Phân tích nhân tử: nhóm hạng tử | Trắc nghiệm | Tự sinh | nhóm xong không đặt được nhân tử chung |
| 10 | Tìm x bằng A·B = 0 | Số (nhiều nghiệm) | Tự sinh | — (thiếu nghiệm được ghi lại) |
| 👹 | Boss vùng | Trộn | Tự sinh | |

**Lớp 9 — Chương II: Phương trình và bất phương trình bậc nhất một ẩn** (bé lớp 9 đang học)

| # | Ải | Trả lời | Đề | Ghi chú |
|---|---|---|---|---|
| 1 | Giải phương trình tích | Số (nhiều nghiệm) | Tự sinh | |
| 2 | Đưa về phương trình tích | Số (nhiều nghiệm) | Tự sinh | **Cần** ải 7–9 lớp 8; sai nhiều thì gợi ý về vùng đất cổ |
| 3 | Điều kiện xác định | Trắc nghiệm | Tự sinh | |
| 4 | Giải phương trình chứa ẩn ở mẫu | Số | Tự sinh | Có đề với nghiệm bị loại; nhiễu = quên loại nghiệm |
| 5 | Giải bài toán bằng cách lập phương trình | Số | Soạn sẵn (~20 bài) | Gia sư duyệt tuần đầu |
| 6 | Tính chất bất đẳng thức | Trắc nghiệm | Tự sinh | nhân với số âm mà không đổi chiều |
| 7 | Giải bất phương trình bậc nhất | Trắc nghiệm | Tự sinh | sai chiều khi chia cho số âm |
| 8 | Biểu diễn tập nghiệm trên trục số | Trắc nghiệm (hình SVG) | Tự sinh | sai chấm tròn rỗng/đặc; sai hướng gạch |
| 👹 | Boss vùng | Trộn | Tự sinh + soạn sẵn | |

**Vùng đất cổ của bé lớp 9 (v1):** ải 7–10 của vùng lớp 8 ở trên, có bài thử thách mở cổng, câu hỏi nghiêng về dạng hay dùng ở lớp 9 (phân tích để giải phương trình, rút gọn).

## 8. Phần thưởng và động lực

- **Kinh nghiệm → cấp nhân vật:** từ nhiệm vụ ngày, ôn tập, đánh boss. Giảm dần khi chơi quá nhiệm vụ ngày.
- **Chuỗi ngày** kiểu Duolingo, mỗi tuần 1 thẻ đóng băng. Ngày có buổi học với gia sư tự tính là đã học. Gia sư cho nghỉ những ngày bé thi trên trường.
- **Vàng → đồ trang trí và rương** **[Sau]**: rương ra skin thẻ, khung avatar, thú cưng; có bảo hiểm (đủ số rương chắc chắn ra đồ hiếm).
- **Quà thật theo cột mốc** **[Sau]**: gia sư đặt cột mốc (hạ boss vùng, chuỗi 30 ngày, lên hạng…). Bé chạm cột mốc thì game báo gia sư. Không thưởng theo từng câu.

## 9. Trên lớp: đánh boss chung **[Sau]**

- Buổi học trực tiếp: boss chiếu trên màn hình laptop/TV của gia sư, hai bé trả lời trên điện thoại (kiểu Kahoot), chạy trên PartyKit như các phòng game khác.
- Hai bé chung phe. Mỗi bé đánh thẻ của mình và giải câu thuộc dạng đó, đề theo lớp của bé. Cùng đúng trong một lượt thì được combo. Có những lượt boss tung "chiêu khó" để cả hai cùng giải.
- **Đối chiếu chống ăn gian:** ở nhà bé có thể dùng Photomath hoặc AI. Game không cố cấm, mà so độ thành thạo ở nhà với kết quả trên lớp. Dạng nào ở nhà 3★ mà trên lớp sai thì báo cho gia sư.
- **Đấu hạng** theo mùa (Đồng → Bạc → Vàng…), thỉnh thoảng mới dùng. Mỗi bé làm đề lớp mình, điểm quy đổi theo mức đề.

## 10. Gia sư và phụ huynh

**Trang gia sư [v1]**, có mật khẩu:
- Tạo tài khoản học sinh (tên + mã PIN 4–6 số), gắn lớp 8/9.
- Mở vùng cho từng bé.
- Bảng tiến độ: sao từng ải, thẻ bị phong ấn, hôm nay bé đã chơi chưa (để nhắc qua Zalo), chuỗi ngày.
- Lỗi hay gặp: đáp án nhiễu nào bé chọn nhiều nhất theo từng dạng.
- Hàng chờ duyệt đề soạn sẵn: duyệt, sửa, loại.

**[Sau]:** chỉnh tỉ lệ nhiệm vụ ngày, đặt cột mốc quà thật, báo cáo tuần cho phụ huynh (gia sư xem trước rồi gửi link), cảnh báo chênh lệch nhà/lớp.

## 11. Kỹ thuật

- **Nằm trong Vẽ cùng tôi**, đường dẫn riêng (tạm `/math-quest`).
- **Next.js API routes + MongoDB** (đang dùng cho lịch sử trận) lưu toàn bộ tiến trình. Không cần PartyKit cho v1. PartyKit chỉ dùng cho boss trên lớp [Sau].
- **Đăng nhập:** tên + PIN, PIN lưu dạng băm. Phiên lưu trong cookie để lần sau vào thẳng.
- **Bộ sinh đề** viết bằng TypeScript, chạy trên server: nhận (dạng, mức, seed) và trả về đề, đáp án, các đáp án nhiễu kèm nhãn lỗi sai, lời giải từng bước. Lưu seed để dựng lại đúng câu đã ra (sổ nợ, báo cáo).
- **Kiểm đáp án trên server** (client không nhận đáp án đúng trước khi trả lời).
- Thiết kế cho nhiều học sinh ngay từ đầu nhưng chỉ một gia sư.

Dữ liệu chính (MongoDB):

| Collection | Nội dung |
|---|---|
| `mq_students` | tên, lớp, PIN đã băm, cấp, kinh nghiệm, chuỗi ngày, số thẻ đóng băng |
| `mq_regions` | vùng (lớp, chương, thứ tự, chủ đề hiển thị, các ải), học sinh nào đã được mở |
| `mq_skills` | dạng toán: id, tên, bộ sinh đề hoặc kho đề, dạng cần học trước |
| `mq_mastery` | (học sinh, dạng): sao, bậc hạn ôn, hạn ôn tiếp, đang phong ấn |
| `mq_attempts` | mỗi câu đã làm: dạng, mức, seed hoặc id câu, đúng/sai, đáp án nhiễu đã chọn, có dùng gợi ý, thời gian |
| `mq_questions` | câu soạn sẵn: dạng, nội dung, đáp án, lời giải, trạng thái nháp / đã duyệt / loại |
| `mq_daily` | nhiệm vụ ngày của từng học sinh: danh sách câu, tiến độ |

## 12. Phạm vi v1

**Có:**
- Đăng nhập PIN; trang gia sư tối giản (mục 10).
- Hai vùng ở mục 7.2, kèm vùng đất cổ và bài thử thách mở cổng cho bé lớp 9.
- Ải 3 mức, gợi ý, sổ nợ, lời giải từng bước.
- Thẻ, độ thành thạo, ôn tập ngắt quãng, phong ấn.
- Nhiệm vụ ngày với tỉ lệ mặc định; kinh nghiệm, cấp; chuỗi ngày và thẻ đóng băng.
- Hình ảnh: emoji, bộ hình 2D miễn phí; chủ đề tạm cho tới khi các bé bỏ phiếu.

**Chưa có:** boss trên lớp, đấu hạng, vàng, rương, cửa hàng, quà thật, báo cáo phụ huynh, chỉnh tỉ lệ nhiệm vụ, tháp thi vào 10, thông báo đẩy, xếp bước chứng minh (cần cho các vùng hình học sau).

## 13. Đo hiệu quả sau 2 tuần dùng thử

- Mỗi bé tự giác chơi **≥5/7 ngày** mà không cần nhắc nhiều (đo bằng nhật ký chơi).
- **Trên lớp sai ít hơn** ở các dạng đã cày (gia sư ghi nhận; sau này đo bằng boss trên lớp).
- **Điểm kiểm tra trên trường** (theo dõi dài hạn).
- **Bé tự nói thích**, tự khoe thẻ.

## 14. Trò mở màn buổi đầu: "Quái Máy Tính" [Đã có — chưa thử với học sinh]

Trò 15–20 phút cho buổi học đầu tiên, để các bé hào hứng trước khi có Math Quest. Đường dẫn `/math-boss`. Máy của gia sư làm màn hình chiếu ("Tạo phòng"). Học sinh vào bằng điện thoại: nhập mã 5 chữ số, tên, và chọn lớp 8 hoặc 9.

1. **Chọn nhân vật:** người que **Cung thủ 🏹** hoặc **Xạ thủ 🔫**, cộng màu khăn riêng (hai bé không trùng màu). Bé nào không chọn thì được chia ngẫu nhiên khi gia sư bấm tiếp.
2. **Màn thách đấu với máy tính:** máy "bấm" từng số để tính (ví dụ A = x² + 6x + 9 tại x = 97), còn gia sư nhận ra hằng đẳng thức và ra ngay 10 000. Đáp án hiện kèm các bước. Có 3 màn.
3. **Ba đợt đánh boss, mỗi đợt một dạng của lớp mình**, trước mỗi đợt có thẻ công thức:
   - Lớp 8 (Chương II): bình phương một tổng/hiệu → hiệu hai bình phương → tính nhanh bằng hằng đẳng thức.
   - Lớp 9 (Chương II): phương trình tích → điều kiện xác định → bất phương trình bậc nhất.

   Đề ở mức cơ bản, tự sinh. Đáp án nhiễu dựng từ lỗi hay gặp. Câu tính giá trị thì gõ số, còn lại là trắc nghiệm 4 lựa chọn.
4. **Màn ngang:** anh hùng đứng bên trái, quái vật đi dần từ phải sang trong lúc đếm giờ. Mỗi lượt quái vật ném cho **mỗi bé một câu riêng, gọi tên** ("Đỡ này, Minh!").
   - Bé trả lời là được chấm ngay. Đúng thì nhân vật bắn tên hoặc đạn trúng quái và trừ máu luôn; sai thì phát bắn trượt rơi xuống đất.
   - Hết lượt hiện đáp án và lời giải từng bước cho từng bé.
5. **Đợt 4 "nổi giận":** trộn cả 3 dạng, kéo dài tới khi boss gục. Từ lượt thứ 6 sát thương ×2, từ lượt thứ 9 ×3, gia sư có thêm nút "Kết liễu". Trước đợt 4 boss không xuống dưới 10% máu. **Buổi đầu luôn thắng.**
6. **Chấm điểm:** mỗi phát trúng 10 sát thương. Cả đội cùng trúng một lượt được thêm 10 (COMBO). Máu boss là 200 × số học sinh. Mỗi lượt 35/35/40/35 giây. Lượt kết thúc sớm khi mọi người đã trả lời. Màn hình chỉ hiện tổng của cả đội.
7. **Kết thúc:** mỗi bé nhận 3 thẻ công thức của lớp mình, rồi bỏ phiếu chủ đề thế giới và đề xuất tên đội. Kết quả chỉ hiển thị, chưa lưu.

Điều khiển: nút "Tiếp" trên màn hình chiếu, hoặc phím →, PageDown, Space, Enter (dùng được với bút trình chiếu).

**Cấu hình trận (gia sư chọn khi tạo phòng).** Màn hình chiếu mở ra ở bước "⚙️ Nội dung trận đấu", trước khi hiện mã phòng.
- Với mỗi lớp, chọn các dạng toán theo chương và bài. Thứ tự bấm chọn là thứ tự đợt.
- Chọn số câu mỗi đợt (3/5/7) và bật/tắt màn thách đấu mở đầu.
- Số đợt bằng số dạng của lớp chọn nhiều nhất, cộng một đợt nổi giận trộn tất cả. Lớp có ít dạng hơn sẽ dùng các đợt dư để ôn tổng hợp.
- Máu boss tự co giãn theo số đợt × số câu. Mở lại được bằng nút "⚙️ Nội dung trận" cho tới khi trận bắt đầu.

**Đồ họa trận đánh** (`/math-boss/preview` để xem thử với dữ liệu giả): phong cách hoạt hình game mobile, viền đen dày.
- Phông nền nhiều lớp: trời, mặt trời, mây trôi, núi, đồi có cây, mặt cỏ.
- Anh hùng chibi: Cung thủ đội mũ trùm có lông vũ, Xạ thủ đội mũ lưỡi trai kèm kính.
- Quái Máy Tính cỡ boss: bước đi khi đồng hồ chạy, thanh máu trên đầu.
- Trúng đòn: chớp nổ, tia lửa, số sát thương, rung màn hình. Không ai trúng thì quái vồ tới. Combo thì hai anh hùng hợp lực bắn quả cầu năng lượng kèm chữ COMBO! Thắng thì quái ngã kèm sao quay.

## 15. Sổ tay bài học [Đã có — chưa thử với học sinh]

Chỗ để học sinh **xem lại những bài đã học**, theo từng bài của SGK Kết nối tri thức.

- **Học sinh** (`/math-quest`): đăng nhập bằng tên (không phân biệt dấu, hoa thường) + mã PIN do gia sư cấp. Thấy các chương của lớp mình:
  - Bài **đã duyệt và đã được dạy** thì mở được.
  - Bài đã duyệt nhưng chưa dạy thì hiện 🔒.
  - Bài chưa duyệt thì không hiện.
- **Mỗi bài** gồm 📌 Cần nhớ (công thức), ✍️ Ví dụ mẫu (bấm để lộ từng bước), ⚠️ Lỗi hay gặp, 🎯 Luyện nhanh 5 câu (dùng bộ sinh đề của game). Mở bài được tính là "ôn lần cuối"; điểm luyện được cộng dồn.
- **Gia sư** (`/math-quest/tutor`, mật khẩu `MATH_QUEST_TUTOR_PASSWORD`):
  - Tạo học sinh và PIN, đổi PIN, chuyển lớp, xóa.
  - Tích "đã dạy" từng bài cho từng bé.
  - Xem ngày ôn gần nhất và điểm luyện.
  - Duyệt bài: Duyệt / Cần sửa (kèm ghi chú) / Đưa về chờ duyệt.
- **Nội dung hiện có:**
  - Lớp 8: Chương I Đa thức (Bài 1–5), Chương II Hằng đẳng thức (Bài 6–9).
  - Lớp 9: Chương I Hệ hai phương trình bậc nhất hai ẩn (Bài 1–3), Chương II PT & BPT bậc nhất (Bài 4–6), Chương III Căn bậc hai, căn bậc ba (Bài 7–10).
  - Tổng cộng 19 bài và 21 dạng tự sinh. Riêng Bài 2 lớp 8 chưa có phần luyện.

  Claude soạn bằng lời riêng, nằm trong `shared/mathQuestLessons.ts`. Sửa nội dung thì sửa file đó; trạng thái duyệt lưu trong MongoDB.
- **Luồng vào:**
  - **Trang chủ** có thẻ "🧮 Math Quest" dẫn tới `/math-quest`. Khi chưa đăng nhập, trang này là cổng vào với ba lối: 📒 học sinh đăng nhập, ⚔️ nhập mã vào trận Quái Máy Tính, 🧑‍🏫 gia sư.
  - **Học sinh** vào sổ tay, luôn thấy thẻ **"Việc nên làm bây giờ"**. Thẻ ưu tiên lần lượt: bài mới dạy chưa mở → bài chưa luyện → bài đúng dưới 80% → bài 5 ngày chưa ôn → luyện thêm. Trang còn có thanh tiến độ, và mỗi bài có hai nút "📖 Ôn bài" và "🎯 Luyện 5 câu".
  - **Trong bài:** mục lục nhảy nhanh, thanh hành động ghim ở đáy (Luyện 5 câu · Bài tiếp). Luyện xong: chưa đúng hết thì nút dẫn về Cần nhớ, đúng hết thì nút sang bài tiếp.
  - **Gia sư:** khối "🚀 Bắt đầu nhanh" (thêm học sinh → duyệt bài → tích bài đã dạy) đánh dấu bước cần làm tiếp, kèm nút "🖥️ Mở màn hình chiếu" Quái Máy Tính và nút sao chép link gửi học sinh.
  - **Hết trận Quái Máy Tính:** điện thoại có nút "📒 Ôn lại bài trong sổ tay", màn hình chiếu có nút "Về trang gia sư".
- **Bảo mật:** PIN băm bằng scrypt, cookie phiên ký HMAC, nhập sai PIN 5 lần thì khóa 10 phút.
- **Lưu trữ (MongoDB):** `mq_students`, `mq_lesson_progress`, `mq_lesson_reviews`.

## 16. Rủi ro

| Rủi ro | Cách giảm |
|---|---|
| Hết mới lạ sau 2–3 tuần | Mở vùng mới theo chương; các bản sau thêm boss, rương, đấu hạng |
| Đề tự sinh ra số xấu hoặc đáp án nhiễu trùng đáp án đúng | Bộ sinh chỉ chọn tham số cho nghiệm đẹp; tự kiểm 4 lựa chọn khác nhau; có bộ test |
| Gia sư không kịp duyệt đề | Đề soạn sẵn chỉ chiếm phần nhỏ; v1 chỉ cần ~20 bài lời văn |
| Bé lớp 9 ngại vì em lớp 8 giỏi hơn | Cùng nội dung, khác vỏ; không so tiến độ cạnh nhau |
| Ăn gian bằng Photomath/AI | Đối chiếu với kết quả trên lớp |
| Mất dữ liệu tiến trình | MongoDB Atlas, sao lưu định kỳ |
