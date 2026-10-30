# Ai Là Heo — Spec & Game Play Flow

**Trạng thái:** v1 đã code (30/10/2026), chưa chơi thử thật  
**Đường dẫn:** `/ai-la-heo` (phòng: `/ai-la-heo/MÃPHÒNG`)  
**Số người:** 2–6, có bot  
**Đồ họa:** 3D thật (Three.js qua React Three Fiber)  
**Thể thức:** chơi nhiều ván liên tục trong một phòng, đếm số lần làm heo

**Đã chốt với chủ dự án (30/10/2026):**
- Lá heo là **1 lá Joker** thêm vào bộ 52 lá.
- Đồ họa **3D thật**, có chế độ nhẹ cho máy yếu.
- **Nhiều ván, đếm số lần làm heo.**

---

## 1. Ý tưởng & tìm hiểu

Trò "rút bài, ai giữ lá cuối là heo" là biến thể của **Old Maid**. Bản Nhật **Babanuki** cũng dùng Joker làm lá xui:
- Cả bộ bài được chia hết, ai có đôi cùng số thì bỏ ra.
- Lần lượt từng người **rút úp một lá từ tay người bên cạnh**; thành đôi thì bỏ.
- Hết bài là thoát. Người cuối cùng còn cầm Joker thua.

Mình không tìm thấy trang nào ghi luật chính thức cho tên gọi "Ai là heo". Luật dưới đây theo bản Joker phổ biến; các khác biệt giữa từng nhóm chơi được đưa thành tùy chọn của phòng.

**Vì sao vui, và bản online phải giữ được điều gì:**
- Luật cực dễ, trẻ con hay người lớn đều chơi ngay được, không cần kỹ năng bài.
- **Cái vui là đấu trí khi rút.** Người cầm Joker cố dụ người khác rút trúng ("lá này nè…"); người rút đọc nét mặt, do dự, đổi ý.
- Bản online thường mất đúng phần này. Vì vậy "linh hồn" của spec là ba thứ:
  1. **Thấy nhau đang nhắm lá nào theo thời gian thực**: tay người rút lượn trên lá nào thì cả bàn thấy.
  2. **Nhử**: chủ bài nhấc một lá nhô lên để dụ.
  3. **Biểu cảm bằng tay**: emote, để giả vờ sợ hay giả vờ mừng.
- Mọi thứ khác (3D, phòng, điểm) phục vụ cho cảm giác "ngồi chung một bàn".

## 2. Luật chơi (v1)

### 2.1 Bộ bài
- 52 lá Tây và **1 Joker = "Heo"**. Lá Joker vẽ hình **heo hề** (đội mũ chú hề, cười ranh mãnh).
- Joker không ghép đôi với lá nào.

### 2.2 Chia bài & bỏ đôi đầu ván
- Server xào bằng bộ sinh số ngẫu nhiên mật mã, rồi chia **hết 53 lá** theo chiều kim đồng hồ, bắt đầu từ người ngồi sau người chia. Có người được hơn người khác 1 lá.
- **Đôi = 2 lá cùng số, khác chất bất kỳ** (ví dụ 7♠ + 7♥). Có 3 lá cùng số thì bỏ 1 đôi, giữ 1 lá; có 4 lá thì bỏ 2 đôi.
- Đầu ván, server **tự bỏ hết các đôi** của mọi người. Các đôi bay ra giữa bàn và ngửa lên, ai cũng thấy.
- Ai hết bài ngay sau bước này thì **thoát luôn**, xếp hạng theo thứ tự ngồi.

### 2.3 Lượt rút
- Lượt đi theo chiều kim đồng hồ.
- **Tới lượt bạn: rút 1 lá úp từ tay người chơi ngay trước bạn** (người còn bài, ngồi bên phải bạn). Đó cũng là người vừa rút xong.
- Lá rút được mà thành đôi với một lá trên tay thì đôi đó tự bay ra giữa bàn. Không thành đôi thì lá được cắm vào **một vị trí ngẫu nhiên** trong tay bạn (server chọn), để người khác không đoán được vị trí lá mới.
- **Thời gian rút: 15 giây** (chủ phòng chọn 10/15/20). Hết giờ thì server rút giúp một lá ngẫu nhiên.
- Người chơi đầu tiên của ván:
  - ván 1: chọn ngẫu nhiên;
  - từ ván 2: **heo ván trước chia bài và rút đầu tiên** ("heo chia bài").

### 2.4 Thoát & kết thúc ván
- Ai hết bài thì **thoát**, được xếp hạng 1, 2, 3… Có hai cách thoát: tự bỏ đôi cuối cùng, hoặc bị người khác rút mất lá cuối.
- Ván kết thúc khi chỉ còn **1 người còn bài**. Người đó chắc chắn đang cầm Joker và là **HEO**.

### 2.5 Nhiều ván, tính điểm
Bảng điểm của phòng giữ suốt buổi chơi, gồm:
- **🐷 số lần làm heo** (càng ít càng tốt);
- **🥇 số lần thoát đầu**;
- **số ván đã chơi**.

Bảng xếp theo tỉ lệ làm heo thấp nhất, hoà thì ai có nhiều lần thoát đầu hơn đứng trên.

Thêm hai luật vui:
- **"Heo đương nhiệm"**: heo ván trước mang **mũi heo + tai heo** trên avatar cho tới khi có heo mới.
- Chủ phòng có thể đặt **chung cuộc sau 5 / 10 ván, hoặc chơi mãi**. Chung cuộc thì vinh danh "Vua né heo" và "Heo của buổi tối".

### 2.6 Tùy chọn của phòng (chủ phòng chỉnh ở sảnh)

| Tùy chọn | Giá trị | Mặc định |
|---|---|---|
| Số người tối đa | 2–6 | 6 |
| Thời gian rút | 10 / 15 / 20 giây | 15 |
| Luật đôi | Cùng số · Cùng số **và cùng màu** (♥♦ / ♠♣, ván dài hơn) | Cùng số |
| Heo chia bài ván sau | bật / tắt | bật |
| Chung cuộc | 5 ván · 10 ván · chơi mãi | chơi mãi |
| Bot | 0–5, độ khó Dễ / Khôn | 0, Khôn |
| Phòng | Công khai (hiện trong danh sách) · Riêng tư (chỉ vào bằng mã/link) | Công khai |

## 3. Game play flow tổng

```text
/ai-la-heo ──► Tạo phòng · Nhập mã · Chọn phòng trong danh sách · "Chơi với bot ngay"
        │
        ▼
Nhập tên (nhớ cho lần sau) ──► ván đang chơi thì vào xem, chờ ván sau
        │
        ▼
SẢNH CHỜ (bàn 3D nhìn từ trên, ghế trống quanh bàn)
  • bấm ghế trống để ngồi, chủ phòng chỉnh luật + bot, mọi người bấm Sẵn sàng
  • chat, emote, nút "Mời bạn" (copy link / chia sẻ)
        │  chủ phòng bấm "Chia bài!" (≥ 2 người tính cả bot, mọi người đã sẵn sàng)
        ▼
CHIA BÀI (≈ 4 giây): bài bay từ giữa bàn tới từng người ──► tự bỏ đôi, đôi bay ra giữa bàn
        │
        ▼
VÒNG RÚT: lượt theo chiều kim đồng hồ
  • người rút: lượn trên quạt bài của người trước mình (cả bàn thấy) ──► bấm rút
  • chủ bài: xào tay, nhử 1 lá, thả emote
  • ai hết bài ──► "THOÁT!" + hạng
        │  còn đúng 1 người cầm bài
        ▼
KẾT THÚC VÁN: đèn rọi vào heo, mũ heo rơi xuống, bùn bắn tung tóe, tiếng "ụt ịt"
  • bảng điểm cộng dồn, "Ván tiếp" (tự bắt đầu sau 15 giây nếu mọi người bấm sẵn sàng)
  • chủ phòng có thể về sảnh để đổi luật / thêm bớt bot
        │  đủ số ván chung cuộc (nếu đặt)
        ▼
CHUNG CUỘC: bục vinh danh 3D, "Vua né heo" và "Heo của buổi tối"
```

## 4. Trang trò chơi & hệ thống phòng

- **`/ai-la-heo`** có:
  - khối giới thiệu (cảnh 3D thu nhỏ hoặc ảnh tĩnh của bàn bài);
  - các nút **Tạo phòng**, **Nhập mã phòng**, **Chơi với bot ngay** (tạo phòng riêng tư có sẵn 3 bot rồi chia bài luôn);
  - **danh sách phòng công khai đang chờ**: chủ phòng, số người / tối đa, trạng thái; bấm là vào.
- **Mã phòng** gồm 5 ký tự in hoa, dễ đọc (bỏ 0/O, 1/I). Link mời có dạng `/ai-la-heo/MÃPHÒNG` và có ảnh xem trước khi gửi qua Zalo/Messenger ("Vào phòng MÃ · Ai Là Heo"), giống các game khác.
- **Tên người chơi** dùng chung cơ chế nhớ tên hiện có (`src/lib/player.ts`).
- **Vào giữa ván**: được xem bàn (không thấy bài ai) và ngồi vào ghế trống từ ván sau.
- Phòng không còn người thật nào thì tự đóng sau 1 phút.
- Trang chủ hub thêm một ô game "Ai Là Heo" có tag **NEW** (bỏ tag NEW khỏi Bà Đồng khi đó).

## 5. Sảnh chờ

- Cảnh 3D nhìn chéo từ trên xuống bàn tròn: ghế trống có nút "＋ Ngồi đây"; ghế có người hiện avatar heo, tên và dấu ✓ khi đã sẵn sàng.
- Chủ phòng có biểu tượng 👑. Chủ phòng thấy bảng luật ở mục 2.6, người khác chỉ xem.
- **Bot** ngồi vào ghế trống, tên vui (Heo Quay, Ỉn Con, Bé Lợn Lì, Heo Mập, Ụt Ịt) và có nhãn 🤖. Chủ phòng có thể bấm vào bot để mời ra.
- Có chat của sảnh, cùng thông báo "X đã vào bàn / rời bàn".
- **Điều kiện bấm "Chia bài!"**: ít nhất 2 người tính cả bot, và mọi người thật (trừ chủ phòng) đã Sẵn sàng.

## 6. Trong ván: tương tác chi tiết

### 6.1 Khi tới lượt bạn rút
- Camera lia nhẹ về phía người bạn rút. Người đó **"chìa" quạt bài** về phía bạn: các lá úp hơi xoè rộng ra.
- **Máy tính:** rê chuột qua lá nào thì lá đó nhô lên và sáng viền; bấm để rút.
- **Điện thoại:** chạm lần 1 để chọn (nhô lên), chạm lần 2 hoặc bấm "Rút lá này" để rút. Như vậy không bị lỡ tay rút nhầm.
- **Lá bạn đang nhắm được phát cho cả bàn theo thời gian thực** (khoảng 10 lần/giây). Mọi người thấy một bàn tay mờ hoặc vệt sáng lượn trên quạt bài. Đây là phần "đọc nhau".
- Lúc rút: lá bay khỏi quạt bài kia, xoay một vòng rồi cắm vào tay bạn.
  - Nếu là **Joker**: **chỉ riêng bạn** thấy lá lật ra heo hề, kèm tiếng nhạc "đùng đùng", màn hình rung và viền đỏ.
  - **Avatar của bạn không tự phản ứng gì**, để không lộ cho người khác biết.
- Thành đôi thì hai lá bay ra giữa bàn và ngửa lên, kèm tiếng "ting".

### 6.2 Khi người khác đang rút bài của bạn
- Bạn thấy rõ họ đang lượn trên lá nào.
- **🔀 Xào tay**: trộn lại thứ tự quạt bài của bạn, có hiệu ứng bài đổi chỗ. Dùng được bất cứ lúc nào, trừ khoảnh khắc lá đang bị rút.
- **☝️ Nhử**: chạm một lá của mình để nhấc nó nhô lên (chạm lại để hạ). Người rút và cả bàn thấy lá nhô đó. Lá nhô có thể là Joker, cũng có thể là mồi giả.
- Kéo để **sắp xếp lại bài** của mình: có ở v1 trên máy tính; trên điện thoại chỉ có nút Xào.

### 6.3 Emote (ai cũng dùng được, mọi lúc)
- Nút 😀 mở bảng nhanh: 😏 tự tin · 😱 sợ · 🤫 suỵt · 🙏 xin đừng · 😂 · 🐷 ụt ịt · 👀.
- Emote hiện thành bong bóng 3D trên đầu avatar trong 2 giây và có tiếng nhỏ.
- Mỗi người tối đa 1 emote mỗi 1,5 giây, để không ai spam được.

### 6.4 Màn hình (HUD, vẽ bằng HTML đè lên cảnh 3D)
- **Phía trên:** banner lượt ("🎯 Lượt của bạn: rút bài của Minh" / "Hùng đang rút bài của bạn…"), vòng đếm giờ, và **số lá còn lại của từng người**.
- **Góc:**
  - nút Bảng điểm (🐷 / 🥇 của từng người);
  - nút Chat; tin nhắn cũng hiện ngắn trên đầu avatar;
  - nút Âm thanh (dùng chung `SoundToggle`);
  - nút ⚙️ Đồ họa (Cao / Thấp).
- **Dưới cùng:** quạt bài của bạn (to, dễ đọc), nút 🔀 Xào và ☝️ Nhử.

## 7. Kết thúc ván & chung cuộc

- Lá cuối cùng: Joker trên tay heo **lật ngửa giữa bàn** cho mọi người thấy.
- Đèn tắt bớt, **đèn rọi vào avatar heo**, rồi đến:
  - **mũ heo rơi xuống đầu**, bùn bắn tung tóe, tiếng "ụt ịt" kèm tiếng huýt sáo chọc quê;
  - **những người đã thoát vỗ tay**, có pháo giấy.
- Bảng tổng kết ván:
  - thứ tự thoát;
  - số lá mỗi người đã rút;
  - **"Pha rút oan nhất"**: ai rút trúng Joker nhiều lần nhất trong ván. Thông tin này chỉ lộ ra sau khi ván kết thúc.
- **Ván tiếp:**
  - mọi người bấm "Ván tiếp" là chia ngay; nếu không, tự chia sau 15 giây;
  - ai không bấm trong 15 giây và đang mất kết nối thì tự đứng dậy khỏi ghế;
  - chủ phòng có nút "Về sảnh" để đổi luật.
- **Chung cuộc** (nếu đặt 5/10 ván): bục 3 bậc, có "Vua né heo" (ít lần làm heo nhất) và "Heo của buổi tối" (nhiều nhất, đội vương miện heo vàng). Sau đó có nút "Chơi tiếp" hoặc "Về sảnh".

## 8. Đồ họa 3D

### 8.1 Công nghệ
- Dùng `three`, `@react-three/fiber` (bản hợp với React 19) và `@react-three/drei`.
- **Tải chậm**: phần 3D chỉ tải khi vào phòng (dynamic import, `ssr: false`), có màn hình chờ "Đang dọn bàn…". Trang `/ai-la-heo` và trang chủ không phải tải Three.js.
- Không dùng file 3D bên ngoài. Bàn, ghế, avatar heo và đồ trang trí đều dựng từ khối cơ bản (cầu, trụ, hộp bo góc) trong code, theo phong cách hoạt hình mũm mĩm hợp với tranh heo của web.

### 8.2 Bối cảnh
- **"Quán bài của hội heo"**: phòng gỗ ấm, đèn lồng treo trên bàn, bàn tròn phủ nỉ xanh, viền gỗ.
- Trên bàn: chồng bài giữa bàn và đống đôi đã bỏ (ngửa, xếp lộn xộn như thật).
- Ánh sáng: một đèn chính có bóng mềm, ánh sáng nền ấm, bóng đổ tiếp xúc dưới đồ vật.

### 8.3 Camera
- Góc nhìn **từ ghế của bạn**, chếch khoảng 40° xuống bàn.
- Bàn luôn được xoay để **ghế của bạn ở gần màn hình nhất**. Mọi người đều thấy mình ngồi ở "đáy" màn hình.
- Camera đổi theo tình huống:
  - tới lượt bạn thì lia về phía người bị rút;
  - kết thúc ván thì quay về phía heo;
  - lúc chia bài thì nhìn rộng hơn một chút.
- Điện thoại dọc: camera nhìn từ cao hơn và quạt bài của bạn đặt to ở đáy.

### 8.4 Lá bài
- Mỗi lá là một tấm mỏng bo góc, mặt trước và mặt sau lấy từ **một tấm texture duy nhất**:
  - texture được vẽ lúc chạy bằng canvas, dùng lại hàm vẽ lá bài ở `src/components/cards/shareCard.ts` cho đồng bộ với Bà Đồng;
  - gồm 55 ô (52 lá, Joker heo hề, mặt sau, ô dự phòng), mỗi ô khoảng 160×224, ghép thành ảnh 1760×1120. Kích thước này vừa giới hạn texture 2048 của điện thoại.
- Quạt bài của người khác chỉ là các lá úp. Máy khách **không hề nhận** mặt bài của họ (xem mục 12).
- Rê chuột qua lá: lá nhô lên và có viền vàng phát sáng.

### 8.5 Avatar heo
- Heo chibi: đầu tròn to, mõm, tai, mắt to có chớp; tay cầm quạt bài.
- Mỗi ghế một màu áo và một chiếc mũ khác nhau (nón lá, mũ len, kính râm, nơ…) để dễ nhận ra.
- Có các trạng thái:
  - ngồi chờ: thở nhẹ, lắc lư;
  - đang rút: nghiêng người về phía trước;
  - bị rút: chìa quạt bài ra;
  - thoát: giơ tay ăn mừng, rồi ngả lưng xem;
  - heo: đội mũ heo, dính bùn, mặt méo.
- **Không có phản ứng tự động nào để lộ bài**, chỉ có emote do người chơi tự bấm.
- Tên hiện trên đầu, kèm số lá, 👑 (chủ phòng), 🤖 (bot) và 📡 (mất kết nối).

### 8.6 Hiệu ứng
- Chia bài: bài bay theo đường cong.
- Bỏ đôi: hai lá bay ra giữa bàn và ngửa.
- Rút bài: lá xoay rồi cắm vào tay.
- Xào tay: các lá đổi chỗ theo đường vòng.
- Rút trúng Joker: rung màn hình, viền đỏ, chỉ người rút thấy.
- Có người thoát: banner "THOÁT!", tia sáng.
- Kết thúc ván: đèn rọi, mũ heo rơi, bùn bắn, pháo giấy.
- Tất cả chuyển động dùng nội suy mượt (damping) trong vòng lặp vẽ, không cần thêm thư viện animation.

### 8.7 Hiệu năng
- **Mục tiêu:** 60 hình/giây trên máy tính, ≥ 30 hình/giây trên điện thoại tầm trung. Dưới 120 lệnh vẽ mỗi khung hình. Texture dưới 8 MB.
- **Chế độ Thấp** (tự bật khi đo thấy khung hình chậm trong 3 giây đầu, hoặc người chơi tự chọn): độ phân giải 1×, tắt bóng đổ động, bớt hạt pháo giấy, avatar ít chi tiết hơn.
- Máy không có WebGL thì báo "Máy không hỗ trợ 3D" kèm gợi ý mở bằng Chrome hoặc Safari mới. Bản 2D dự phòng để sau.

## 9. Âm thanh

- **Tất cả tổng hợp bằng code** (`src/lib/sound.ts`, tôn trọng nút tắt tiếng): tiếng xào bài, tiếng lá bay "phạch", "ting" khi bỏ đôi, tiếng rút bài, "THOÁT!" kèm tiếng kèn ngắn, tiếng tick 5 giây cuối khi tới lượt bạn.
- **Rút trúng Joker**: tiếng nhạc "đùng đùng" (chỉ người rút nghe).
- **Kết thúc ván**: "ụt ịt" + huýt sáo + vỗ tay.
- Nhạc nền quán bài nhẹ, có thể tắt riêng.

## 10. Bot

Bot chỉ dùng thông tin công khai và bài của chính nó; không bao giờ nhìn trộm bài người khác.

- **Khi rút:**
  - **Dễ:** rút ngẫu nhiên.
  - **Khôn:** lượn qua 2–4 lá trước khi rút, cho giống người đang phân vân (cả bàn thấy). Nếu chủ bài đang nhử một lá, bot có 60% né lá đó và 40% "liều" rút luôn.
- **Khi cầm Joker** (bản Khôn):
  - thỉnh thoảng nhử chính lá Joker, thỉnh thoảng nhử mồi giả;
  - xào tay sau khi bị rút hụt;
  - thả 😏 hoặc 🙏 ngẫu nhiên để gây nhiễu.
- **Nhịp:** suy nghĩ 1–3,5 giây mỗi lượt, có lúc thả emote.
- **Bot tiếp quản:** người thật mất kết nối quá 30 giây giữa ván thì bot cầm bài thay (mục 11).

## 11. Mất kết nối & rời phòng

- Có **30 giây** để vào lại (cùng trình duyệt). Mọi người thấy "📡 Minh (27s)".
  - Nếu tới lượt người đó rút: giờ vẫn chạy, hết giờ thì server rút giúp.
  - Nếu họ đang bị rút: vẫn rút bình thường, không ai phải chờ.
- **Quá 30 giây giữa ván:** **bot tạm cầm bài thay**, avatar đổi nhãn 🤖. Không thể bỏ người đó ra khỏi ván, vì bài trên tay họ vẫn còn cặp với bài người khác.
  - Người cũ quay lại trong cùng ván thì lấy lại ghế và bài.
  - Hết ván mà vẫn chưa về thì đứng dậy khỏi ghế.
- **Bấm "Rời phòng" giữa ván:** bot cầm bài thay ngay, không chờ 30 giây.
- Đang ở **sảnh** mà mất kết nối quá 30 giây thì mất ghế.
- Chủ phòng thoát thì quyền chủ phòng chuyển cho người thật ngồi sớm nhất.
- Bàn chỉ còn bot thì ván dừng và phòng đóng sau 1 phút.

## 12. Chống gian lận & giấu thông tin

Server nắm toàn bộ trạng thái và quyết định mọi thứ. Máy khách chỉ gửi "ý định" (rút lá thứ k, xào, nhử), không gửi kết quả.

| Thông tin | Ai được biết |
|---|---|
| Bài trên tay (mặt lá) | chỉ chủ bài |
| Số lá trên tay từng người | mọi người |
| Lá nào bị rút (vị trí thứ k) | mọi người |
| Mặt lá bị rút | người rút và người bị rút (người bị rút vốn đã biết bài mình) |
| Đôi bỏ ra giữa bàn | mọi người (ngửa, như ngoài đời) |
| Joker đang ở đâu | chỉ người đang cầm; lộ cho cả bàn khi ván kết thúc |
| Lá đang nhắm / lá đang nhử | mọi người (là vị trí, không phải mặt lá) |

- Người khác chỉ thấy tay bài của bạn là **N ô trống được đánh số thứ tự**, không có mã lá. Mã lá chỉ gửi cho chủ bài và được **tạo ngẫu nhiên lại mỗi ván**. Nhờ vậy mở DevTools cũng không dò được Joker.
- Lá mới rút được cắm vào vị trí ngẫu nhiên do server chọn, nên không ai lần theo được vị trí lá vừa đổi chủ.
- Server kiểm tra từng thao tác: đúng lượt, đúng người bị rút, vị trí còn hợp lệ, không rút hai lần. Hover, nhử và emote đều bị giới hạn tần suất.

## 13. Kỹ thuật

### 13.1 File
- **Luật dùng chung (hàm thuần, server và client cùng dùng):** `shared/oldMaidTypes.ts`. Gồm bộ bài, kiểm tra đôi theo luật phòng, chọn người bị rút kế tiếp, hành vi bot, và các kiểu message.
- **Server phòng:** `party/oldmaid-server.ts`, class `OldMaidRoom`, party `oldmaid`.
- **Danh sách phòng:** `party/oldmaid-directory.ts` (`OldMaidDirectory`, party `oldmaidlobby`) và `src/app/api/oldmaid-rooms/route.ts`, theo đúng mẫu Hải Chiến.
- **Client:**
  - trang: `src/app/ai-la-heo/{layout,page}.tsx`, `src/app/ai-la-heo/[roomId]/{layout,page}.tsx`;
  - kết nối phòng: `src/lib/useOldMaidRoom.ts`;
  - giao diện: `src/components/oldmaid/` gồm
    - `OldMaidRoom.tsx`, điều phối theo giai đoạn;
    - `LobbyPanel.tsx`, `Hud.tsx`, `RoundResult.tsx`;
    - `scene/Table3D.tsx`, `scene/HandFan.tsx`, `scene/PigAvatar.tsx`, `scene/CardMesh.tsx`, `scene/cardAtlas.ts`, `scene/effects.tsx`.
- **SEO:** `GAMES_SEO.oldmaid`, ảnh OG `/og/oldmaid.jpg` (chụp từ cảnh 3D).
- **Lịch sử trận:** thêm `"oldmaid"` vào enum `gameType` của `GameHistory`. Mỗi ván báo kết quả (thứ tự thoát, heo) như các game khác. Ván có bot chỉ là luyện tập, không báo.
- **Cloudflare:**
  - thêm 2 binding `Oldmaid`, `Oldmaidlobby` trong `wrangler.jsonc`;
  - thêm **migration mới** `{ "tag": "v2", "new_sqlite_classes": ["OldMaidRoom", "OldMaidDirectory"] }`;
  - export 2 class trong `party/index.ts`;
  - thêm biến môi trường vào `party/env.ts`;
  - deploy server bằng `npm run party:deploy`. Web vẫn deploy bằng push lên `main`.

### 13.2 Message (phác thảo)

```ts
// client → server
type OldMaidClientMessage =
  | { type: "join"; playerId: string; name: string }
  | { type: "take_seat"; seat: number }
  | { type: "set_ready"; ready: boolean }
  | { type: "update_config"; config: Partial<OldMaidConfig> } // chủ phòng
  | { type: "set_bot"; seat: number; level: "easy" | "smart" | null } // chủ phòng
  | { type: "start_game" } // chủ phòng
  | { type: "hover"; slot: number | null } // người đang rút, ≤ 10/giây
  | { type: "draw"; slot: number }
  | { type: "shuffle_hand" }
  | { type: "reorder"; order: string[] } // mã lá của chính mình
  | { type: "tease"; slot: number | null } // nhử
  | { type: "emote"; kind: Emote }
  | { type: "chat"; text: string }
  | { type: "next_round" }
  | { type: "back_to_lobby" } // chủ phòng
  | { type: "leave_room" };

// server → client
type OldMaidServerMessage =
  | { type: "state"; state: PublicOldMaidState } // ai cũng nhận
  | { type: "hand"; cards: { id: string; card: number }[] } // chỉ chủ bài; 52 = Joker
  | { type: "event"; event: OldMaidEvent } // để client chạy animation
  | { type: "hover"; drawerId: string; slot: number | null }
  | { type: "emote"; playerId: string; kind: Emote }
  | { type: "chat"; entry: ChatEntry }
  | { type: "error"; message: string };

type OldMaidEvent =
  | { type: "dealt"; counts: Record<string, number>; dealerId: string }
  | { type: "paired"; playerId: string; cards: [number, number] }
  | { type: "drew"; drawerId: string; targetId: string; slot: number; card?: number } // card chỉ gửi cho người rút và người bị rút
  | { type: "shuffled"; playerId: string }
  | { type: "finished"; playerId: string; rank: number }
  | { type: "round_end"; pigId: string; order: string[]; jokerDraws: Record<string, number> };
```

- `PublicOldMaidState` gồm:
  - `phase` (`lobby | dealing | playing | round_end | final`), `config`, `hostId`, `round`;
  - `seats[]`: id, tên, bot hay người, đã kết nối, sẵn sàng, số lá, hạng nếu đã thoát, heo đương nhiệm;
  - `turn`: người rút, người bị rút, hạn giờ;
  - `teased` (lá đang nhử của từng người), `discard[]` (các lá đã bỏ, ngửa), `scores`.
- Client dựng cảnh từ `state`, và chạy animation theo `event`. Vào lại phòng giữa ván chỉ cần `state` + `hand` là vẽ đúng.

### 13.3 Thời gian & hẹn giờ
- Chia bài 4 giây, rút 10/15/20 giây, chờ kết nối lại 30 giây, chờ ván tiếp 15 giây.
- Hẹn giờ của server dùng chung cơ chế `later()` / huỷ hàng loạt như Hải Chiến. Hover không được lưu vào state, chỉ chuyển tiếp ngay cho cả bàn.

### 13.4 Phụ thuộc mới
- `three`, `@react-three/fiber`, `@react-three/drei` (khoảng 200 KB gzip, chỉ tải trong phòng chơi).
- Không cần ảnh hay model 3D bên ngoài.

## 14. Lộ trình làm

1. **Luật + server**: `shared/oldMaidTypes.ts`, `OldMaidRoom` với chia bài, bỏ đôi, lượt, thoát, heo, điểm nhiều ván, bot, kết nối lại; kèm giao diện 2D tạm để chơi thử luồng.
2. **Bàn 3D**: cảnh, camera theo ghế, texture lá bài, quạt bài, rê và rút, hover đồng bộ, animation chia / bỏ đôi / rút.
3. **Đấu trí & cảm xúc**: nhử, xào tay, emote, avatar heo đủ trạng thái, hiệu ứng Joker, lễ "phong heo", âm thanh.
4. **Phòng & hoàn thiện**: trang `/ai-la-heo`, danh sách phòng, link mời có ảnh xem trước, lịch sử trận, chế độ đồ họa Thấp, điện thoại dọc, ô game trên trang chủ (NEW).

## 15. Để sau (v2)

- Bản 2D dự phòng cho máy không có WebGL.
- Chat giọng nói hoặc "bấm giữ để ú òa".
- Skin bài và avatar mở khóa theo số ván chơi.
- Chế độ **"Heo bí mật"**: úp bỏ 1 lá ngẫu nhiên, không ai biết lá nào là heo tới cuối ván.
- Giải đấu nhiều bàn, bảng xếp hạng toàn web.

## 16. Câu hỏi còn mở

v1 đã code theo mặc định dưới đây. Chủ dự án chưa xác nhận, muốn đổi thì nói lại.

1. **Luật đôi mặc định**: "cùng số". "Cùng số và cùng màu" có sẵn trong tùy chọn phòng.
2. **Tối đa 6 người.**
3. **Avatar** là heo mặc đồ khác nhau. Heo đương nhiệm đội vương miện heo màu hồng.
4. **Ván có bot** là luyện tập, không tính vào lịch sử trận.

**Khác với spec ở bản v1:**
- Bài của chính bạn chỉ hiện ở đáy màn hình bằng HTML (ngửa), chung kiểu vẽ với bài Bà Đồng, cho chữ sắc nét và dễ kéo thả. Trong 3D không có quạt bài của bạn.
- Camera (sửa sau lần chơi thử đầu, 30/10/2026):
  - **Góc nhìn thứ nhất chỉ khi chính bạn rút.**
  - **Khi bị rút:** camera vẫn ở ghế bạn, nghiêng về phía người rút; tay bài ngửa của bạn to ra, lá đang bị nhắm sáng vàng.
  - **Người khác rút của nhau:** camera nhìn từ phía bên kia bàn để thấy rõ cả hai con heo và quạt bài chìa ra giữa họ.
  - Không còn tùy chọn camera trong ⚙️.
- Ghế có vị trí cố định; đổi ghế thì camera lượn quanh bàn tới ghế mới (trước đây cả bàn xoay tức thì nên trông như không có gì xảy ra). Trên màn rộng, bàn được đẩy sang trái để panel sảnh không che ghế nào. Ở sảnh có nhãn "Bạn rút bài người này" / "Người này rút bài bạn" trên hai người ngồi cạnh.
- Rút xong không sang lượt ngay mà chia thành 2 nhịp (server giữ `pending`):
  - **Dò lá (1,6 giây):** lá bị rút nằm trên tay người rút. Nếu là bạn, lá lật ngửa trước mắt, một nhịp nhún chạy dọc tay bài và dừng ở lá thành đôi.
  - **Kết quả:** nếu thành đôi, cả hai lá bay chậm xuống bàn và lật ngửa (thêm 1,3 giây); nếu không, lá được cất vào tay (thêm 0,6 giây).
- Lá đang nhử nhấp nhả lên xuống liên tục (cả trên tay bạn lẫn trong 3D), không chỉ nhô lên.
- Nút âm thanh nổi của web bị ẩn trong phòng chơi để không che bài; tắt/bật tiếng nằm trong ⚙️ Cài đặt.

## 17. Lá kỹ năng (v2, 30/10/2026)

Người dùng thấy chỉ bốc bài thì nhàm, nên chọn cách **kiểu UNO**: lá kỹ năng được xào chung với bộ bài, ai cầm lá nào thì dùng lá đó, và rút được lá kỹ năng của người khác. Phương án mang vật phẩm từ sảnh (có thời gian hồi) đã bị bỏ.

**Luật:**
- Lá kỹ năng là bài trên tay, không ghép đôi với lá nào. Muốn thoát phải dùng hết, hoặc để người khác rút mất. Nếu lá cuối cùng trên tay là lá kỹ năng thì dùng xong là thoát, và lượt kết thúc ngay.
- Mỗi lá dùng 1 lần, xong thì lật ngửa giữa bàn. Mỗi lượt, mỗi người dùng tối đa 1 lá. Lá vừa rút được phải chờ tới lượt sau mới dùng.
- Dùng chiêu thì cả bàn biết: màn "tung chiêu" hiện 1,8 giây (`SKILL_SHOW_MS`) trên mọi màn hình, kèm âm thanh và một dòng trong chat. Kết quả của 🔍 và 📡 chỉ người dùng thấy.
- Dùng chiêu trong lượt của mình thì đồng hồ còn ít nhất 8 giây (`SKILL_TIME_FLOOR_MS`).
- Khi bật lá kỹ năng, nhịp dò lá dài 2,6 giây (`SKILL_PEEK_MS`) **cho mọi người**, để kịp quyết có dùng 🛡️ không, mà nhìn thời gian cũng không đoán được ai đang cầm 🛡️.
- Ở sảnh, chủ phòng chọn: Bật/Tắt, dùng những lá nào (ít nhất 1 lá), mỗi loại 1 hay 2 lá. Mặc định: bật, đủ 6 loại, mỗi loại 1 lá. Ván có lá kỹ năng được ghi "· lá kỹ năng" trong lịch sử.

| Lá | Dùng khi | Tác dụng |
|---|---|---|
| 🔍 Kính lúp | Lượt mình, trước khi rút | Chọn 1 lá để xem mặt (chỉ mình thấy, lá lật ngửa trong quạt bài trước mắt). Cả bàn thấy nhãn "🔍 bị soi" trên lá đó. Người bị soi xào hoặc sắp lại bài thì kết quả soi mất tác dụng. |
| 📡 Radar heo | Lượt mình | Chọn 1 người: biết người đó CÓ hay KHÔNG giữ heo. |
| 🤲 Rút hai | Lượt mình | Lá chọn rút kèm 1 lá ngẫu nhiên. Có 6 giây (`DOUBLE_CHOOSE_MS`) để chọn giữ lá nào, lá kia trả về vị trí ngẫu nhiên. Hết giờ thì giữ lá đã chọn. |
| ↩️ Đổi hướng | Lượt mình | Rút bài người bên trái. Bẫy 🎭 của người bên phải bị bỏ phí. Không dùng được khi bàn còn 2 người. |
| 🎭 Đánh tráo | Khi bị rút, trước lúc họ bấm | Giăng bẫy công khai: lá người kia chọn bị đổi thành 1 lá ngẫu nhiên khác. Cần ít nhất 2 lá khác trên tay. |
| 🛡️ Trả lại | Lúc đang dò lá vừa rút | Trả lá đó về vị trí ngẫu nhiên trong tay người kia, lượt kết thúc. Không ai biết chắc đó có phải heo không, nên có thể dùng để lừa. |

**Bot:**
- Khi tới lượt: hay dùng chiêu (bot khôn khoảng 60%), soi lá đang được nhử, né heo nếu soi thấy heo.
- Khi bị rút mà đang giữ heo: giăng 🎭.
- Khi Rút hai: giữ lá không phải heo.
- Lỡ bốc trúng heo mà có 🛡️: trả lại ngay.

**Kỹ thuật:**
- Mã lá kỹ năng: `SKILL_BASE (60) + bản sao × 6 + loại`.
- Mặt lá: 6 ô mới trong atlas 3D, `SkillFace` cho HTML.
- Server giữ `pending.extra` / `choosing` cho 🤲.
- Sự kiện mới: `skill`, `peeked`, `radar`, `kept`; `resolved.returned`; `drew.switched/extraSlot/extraCard`.
- Người bị rút giờ thoát lúc ngã ngũ lá bài, không còn thoát ngay khi bị rút, vì 🛡️ có thể trả lá về cho họ.

## Nguồn tham khảo

- [Old maid (card game) — Wikipedia](https://en.wikipedia.org/wiki/Old_maid_(card_game))
- [Old Maid Card Game: Rules for How to Play — Geeky Hobbies](https://www.geekyhobbies.com/old-maid-rules/)
- [How to Play Old Maid — Game On Family](https://gameonfamily.com/old-maid/)
