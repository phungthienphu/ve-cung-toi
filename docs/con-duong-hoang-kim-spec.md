# Con Đường Hoàng Kim — Spec & Game Play Flow

**Trạng thái:** spec, chưa code (02/11/2026).
**Đường dẫn:** `/con-duong-hoang-kim`. Phòng đua là `/con-duong-hoang-kim/MÃPHÒNG`.
**Thể loại:** đua xe địa hình 2D nhìn ngang, giống Hill Climb Racing.
**Chế độ:**
1. **Phá kỷ lục:** chơi một mình.
2. **Đua cùng bạn bè:** thời gian thực, 2–6 xe, có bot.

**Đã chốt với chủ dự án (02/11/2026):**
- Có 2 chế độ: một mình ghi kỷ lục, và chơi cùng bạn bè.
- **Xuất phát chồng tháp** cho hỗn loạn (§6.3).
- Server chạy trên **Cloudflare gói Free** (§11.5).
- **Tên game: Con Đường Hoàng Kim.**
- **Xe kín, không lộ bác tài**, cho nhẹ máy (§2.2, §9).
- **Chưa có nâng cấp xe**, vì trang không cần đăng nhập nên không có chỗ giữ tiến trình (§4).
- **Có va chạm:** xe không đi xuyên qua nhau. Muốn vượt thì phải lợi dụng địa hình, hoặc dùng xăng và năng lượng để **nhảy qua đầu** hay **nhảy lên đầu** xe khác.
- Có vật phẩm nếu cần.
- Giao diện ưu tiên điện thoại (yêu cầu chung của chủ dự án).

---

## 1. Ý tưởng & tìm hiểu

**Hill Climb Racing** (Fingersoft, 2012) vui vì 3 thứ:
1. **Cảm giác vật lý:**
   - Xe có nhún, bánh bám dốc.
   - Đang bay mà nhấn ga thì xe ngửa ra sau, nhấn phanh thì xe chúc đầu xuống.
   - Điều khiển chỉ có 2 nút, nhưng làm chủ được thì rất "đã".
2. **"Thêm chút nữa thôi":** xăng cạn dần, can xăng mỗi lúc một xa. Ai cũng muốn vượt mốc kỷ lục cũ, đang cắm cờ ngay trên đường.
3. **Tai nạn buồn cười:** lật xe, đầu bác tài cắm xuống đất là hết lượt.

**Hill Climb Racing 2** có đua nhiều người, nhưng đối thủ là **bóng ma** (bản ghi lại của người khác), đi xuyên qua nhau. Spec này khác ở chỗ **xe đặc, đua cùng lúc thật**:
- Đâm nhau, đẩy nhau.
- Nhảy lên đầu nhau "giẫm bẹp".
- Bay qua đầu nhau ở đỉnh dốc.

Đây là điểm mới, cũng là phần khó nhất về kỹ thuật (xem §11).

**"Linh hồn" phải giữ được:**
- **Một mình:** lái thật đã tay. Kỷ lục của mình và của bạn bè hiện thành cờ ngay trên đường.
- **Nhiều người:** mấy chiếc xe chen nhau trên cùng một con dốc, có lúc phải liều nhảy qua đầu đứa trước.

## 2. Lái xe & vật lý

### 2.1 Điều khiển
| | Điện thoại | Máy tính |
|---|---|---|
| Ga | Bàn đạp to góc phải dưới | → / D |
| Phanh / lùi | Bàn đạp to góc trái dưới | ← / A |
| Nhảy (xe đang ngửa thì thành **↻ Bật lật**, §2.6) | Nút tròn phía trên bàn đạp ga | ↑ / W |
| Dùng vật phẩm (chế độ đua) | Nút phía trên bàn đạp phanh | E / Shift |

- **Bàn đạp:**
  - Chạm vào là nhấn; đè vào nhau hay vuốt trượt khỏi nút vẫn tính đang giữ.
  - Hỗ trợ đa chạm, để vừa giữ ga vừa bấm nhảy được.
  - Bàn đạp lún xuống khi nhấn, có rung nhẹ (`navigator.vibrate`, máy nào hỗ trợ).
- **Khi đang bay:**
  - Ga làm xe xoay ngửa ra sau, phanh làm xe chúc đầu.
  - Phần này đến từ phản lực của động cơ trong mô phỏng, cộng thêm một lực xoay nhỏ cho dễ điều khiển.

### 2.1.1 Lao tới (bổ sung 02/11/2026)
- Máy tính: **Space**; điện thoại: nút **💨 Lao tới** phía trên bàn đạp phanh.
- Tốn **25⚡**, chờ **2 giây** giữa hai cú lao; giữ phím không tự lặp.
- Đẩy cả thân và bánh về phía trước, tăng tối đa **8 m/s**, giới hạn vận tốc tiến **30 m/s**. Không dùng được khi hết xăng hoặc xe đang úp.
- Chơi một mình: dùng để lấy đà vượt dốc. Giai đoạn 3: lực đẩy truyền qua va chạm vật lý để húc xe phía trước; chỉnh độ mạnh sau khi thử đua thật.
- Nhảy / bật lật chuyển sang **↑ / W**; vẫn có nút riêng trên điện thoại.

### 2.2 Mô hình xe
- **Thân xe:** một khối đặc (hình đa giác theo dáng xe).
- **Bánh xe:** 2 bánh tròn, gắn vào thân bằng **khớp bánh xe có lò xo giảm xóc** (WheelJoint, giống ví dụ "Car" kinh điển của Box2D).
- **Động cơ:** quay bánh với lực xoắn tối đa và tốc độ tối đa riêng cho từng xe.
- **Xe kín, không có bác tài lộ ra.** Thay cho "đầu bác tài" của bản gốc là **cảm biến trên nóc xe**. Nóc chạm đất là xe **lật ngửa**, nhưng **chưa thua ngay**: còn 3 giây để tự lật lại (§2.6). Không lật lại kịp mới là **"Chổng vó!"**:
  - chơi một mình thì hết lượt;
  - đang đua thì hồi sinh (§6.5).
- **Đơn vị:** mét.
  - Trọng lực 9,8; riêng bản đồ mặt trăng là 1,6.
  - Bánh xe bán kính khoảng 0,45–0,8 m tùy xe.

### 2.3 Xăng ⛽
- Bình đầy 100%.
  - Xăng **luôn hao theo thời gian**, nhấn ga thì hao nhanh hơn.
  - Đầy bình chạy được khoảng 35–45 giây.
- Ăn **can xăng** trên đường thì đầy bình lại.
  - Can đặt cách nhau xa dần theo quãng đường; đây chính là thứ giới hạn kỷ lục.
- **Hết xăng:**
  - xe trôi theo quán tính;
  - đứng yên 3 giây thì hết lượt (một mình) hoặc bị loại (chế độ "Đi xa nhất").

### 2.4 Năng lượng ⚡ và nhảy
- Thanh năng lượng từ 0 đến 100, nạp từ các nguồn sau:

| Nguồn | Năng lượng nhận được |
|---|---|
| Thời gian bay | +6 mỗi giây trên không |
| Lộn một vòng | +25 |
| Giẫm đầu xe khác (§6.4) | +20 |
| Bình ⚡ trên đường | +40 |
| Tự hồi khi đang chạy trên đất | +2 mỗi giây |

- **Nhảy:**
  - Tốn **35**, nên thanh đầy nhảy được 2 lần liền.
  - Xe bật thẳng lên kèm một chút đà về trước, đủ để qua được nóc một chiếc xe thường đang đứng yên.
  - Chỉ nhảy được khi ít nhất một bánh đang chạm đất, hoặc vừa rời đất dưới 0,15 giây. Không có nhảy hai lần trên không.
  - Chờ 0,6 giây giữa hai lần nhảy.
  - Khi xe đang ngửa, nút nhảy thành **↻ Bật lật** (§2.6).
- **Vì sao tách khỏi xăng:**
  - Xăng là "sống còn": hết thì thua.
  - Năng lượng là "chiêu": bay lượn đẹp thì có, rồi dùng để vượt người.
  - Dùng chung một thanh thì ai nhảy để vượt cũng tự đốt mạng mình, chẳng ai dám nhảy.

### 2.5 Thưởng kỹ năng (hiện chữ nổi trên xe)
| Pha | Thưởng |
|---|---|
| ✈️ Bay trên 1,5 giây | xu theo thời gian bay |
| 🔄 Lộn vòng (360° rồi tiếp đất bằng bánh) | +xu, +25⚡ |
| 🤸 Lộn ngược (ra sau) | như trên, chữ khác |
| 🦘 Giẫm đầu (chỉ khi đua) | +20⚡ |
| 🎯 Tiếp đất êm (hai bánh chạm gần như cùng lúc) | +xu nhỏ |
| 🙃 Thoát hiểm (lật ngửa rồi tự lật lại kịp) | +xu nhỏ |

### 2.6 Lật ngửa & tự lật lại
Chủ dự án hỏi chổng vó rồi có lật lại đi tiếp được không (02/11/2026). Câu trả lời là được, nếu kịp:
- **Nóc chạm đất:** xe vào trạng thái **lật ngửa**. Một vòng đếm ngược **3 giây** hiện quanh xe, mắt xe xoay vòng, xăng vẫn hao.
- **Ba cách lật lại:**
  1. **Lắc xe bằng ga / phanh:** lực xoay giống lúc đang bay, mạnh hơn chút khi nóc chạm đất. Xe nằm nghiêng hoặc nằm trên dốc thì thường tự lật được; nằm ngửa trên đường bằng thì khó.
  2. **↻ Bật lật** (nút nhảy): tốn **35⚡**, bật xe lên và xoay về đúng chiều, gần như chắc chắn dựng được. Đây là thêm một lý do để giữ ⚡ thay vì xài hết vào nhảy.
  3. **Khi đua:** bị xe khác húc trúng cũng có thể lật lại. Ai tốt bụng thì "cứu" được bạn.
- **Hai bánh chạm đất lại trước khi hết 3 giây:** đi tiếp, hiện chữ "Thoát hiểm!".
- **Hết 3 giây vẫn ngửa:** **"Chổng vó!"**. Chơi một mình thì hết lượt, đang đua thì hồi sinh ở checkpoint (§6.5).
- Không có kiểu "rơi cắm nóc là chết ngay", cho luật trước sau như một. Rơi cắm nóc mạnh chỉ làm xe móp méo và rung màn hình cho vui.
- 3 giây và 35⚡ là số khởi điểm, sẽ chỉnh khi lái thử: dễ quá thì kỷ lục dài lê thê, khó quá thì cay.

## 3. Đường đua

### 3.1 Sinh địa hình
- **Sinh từ một hạt giống (seed)** bằng hàm nhiễu nhiều lớp. Máy chủ và mọi máy chơi tự sinh ra **y hệt nhau**, nên không cần gửi bản đồ qua mạng.
- **Hình dạng đường:**
  - Điểm cao độ đặt mỗi 1 m, nối thành đường gấp khúc.
  - Đi càng xa, dốc càng cao và càng gắt.
  - Có xen kẽ các đoạn đặc biệt: dốc nhảy, vực ngắn, bậc thang, đoạn bằng để nghỉ.
- **Đặt vật phẩm:**
  - Can xăng, xu, bình ⚡ và hộp vật phẩm cũng đặt theo seed.
  - Đường dài vô tận khi chơi một mình; khi đua có vạch đích.
- **Mốc trên đường:**
  - Biển báo mỗi 100 m.
  - **Cờ kỷ lục:** của bạn, của người đứng đầu bảng, và "đường hôm nay".
  - **Checkpoint:** mỗi 150 m khi đua.

### 3.2 Bản đồ (v1: 3–4 bản)
| Bản đồ | Đặc điểm |
|---|---|
| 🌾 **Đồi chè** (mặc định) | Đồi thoai thoải, dễ chơi |
| 🏜️ **Đồi cát Mũi Né** | Cát lún: bám đường kém, xăng hao nhanh hơn |
| 🏔️ **Đèo Mã Pí Lèng** | Dốc dựng, vực sâu, bậc đá |
| 🌕 **Mặt trăng** | Trọng lực thấp, bay rất xa, lộn vòng dễ |

Có thể thêm sau: ruộng bậc thang, tuyết Sa Pa (trơn), công trường.

## 4. Xe (v1: 4 xe)

| Xe | Tốc độ | Leo dốc | Nặng | Đặc điểm |
|---|---|---|---|---|
| 🚙 **Jeep** (mặc định) | ●●●○ | ●●●○ | ●●○○ | Cân bằng, dễ lái |
| 🚗 **Xe con bọ** | ●●●● | ●●○○ | ●○○○ | Nhỏ, nhẹ, bay xa, dễ lật, đụng là bị đẩy văng |
| 🛻 **Xe tải quái vật** | ●●○○ | ●●●● | ●●●● | Bánh to vượt gồ ghề, khó lật, ủi được xe khác, tốn xăng |
| 🚌 **Xe buýt** (cho vui) | ●●○○ | ●○○○ | ●●●○ | Dài, dễ kẹt đỉnh dốc, nhưng nóc rộng nên khó bị giẫm đổ |

- **Mở khóa:** Jeep có sẵn, ba xe còn lại mở bằng xu (§5.3). Giá khởi điểm giai đoạn 2: con bọ 150, tải quái vật 350, xe buýt 500 xu; chỉnh sau khi chơi thử.
- **Khi đua:** xe nào cũng đã mở sẵn; chủ phòng có thể ép cả phòng đi cùng một loại xe.
- **Nâng cấp** (động cơ, giảm xóc, lốp…) như Hill Climb Racing: **chưa làm**.
  - Trang không có đăng nhập nên không có chỗ giữ tiến trình lâu dài.
  - Ai cũng như ai thì kỷ lục cũng công bằng hơn.

## 5. Chế độ 1 — Phá kỷ lục (một mình)

### 5.1 Luồng chơi
1. Chọn **bản đồ** (hoặc "🗓️ Đường hôm nay") và **xe**, rồi bấm **Chạy**.
2. Đếm ngược 3-2-1, xuất phát.
3. Lượt kết thúc khi hết xăng hoặc chổng vó.
4. Màn kết quả hiện:
   - quãng đường;
   - **kỷ lục mới hay chưa**;
   - xu kiếm được;
   - hạng của bạn trên bảng xếp hạng bản đồ đó;
   - các nút "Chạy lại" và "Đổi xe".

### 5.2 Kỷ lục & bảng xếp hạng
- **Điểm chính là quãng đường (m)**, tính riêng theo từng bản đồ.
- **🗓️ Đường hôm nay:**
  - Seed lấy theo ngày (giờ Việt Nam), cả trang chạy chung một con đường.
  - Bảng xếp hạng riêng cho ngày đó, hết ngày thì khóa sổ.
  - Đây là cách "chơi với bạn bè" khi không cùng online.
- **Cờ trên đường:**
  - 🚩 Kỷ lục của bạn.
  - 🏆 Người đứng đầu bản đồ.
  - Tối đa 3 cờ của người có tên gần với bạn trên bảng.
- **Bóng ma** (v1.5): chạy cùng một chiếc xe mờ của người giữ kỷ lục hoặc của chính bạn lần tốt nhất.
  - Bản ghi lấy mẫu vị trí và góc 10 lần/giây, nén lại, khoảng 20 KB cho 3 phút.
- Trang không có tài khoản, nên bảng xếp hạng **phân biệt người chơi theo mã máy** (`vct_player_id` trong bộ nhớ trình duyệt) kèm tên. Hai người cùng tên vẫn là hai dòng.

### 5.3 Xu & mở khóa
- **Nguồn xu:** nhặt xu trên đường và thưởng kỹ năng.
- **Dùng xu để:** mở xe (và sau này mở màu sơn, nhân vật).
- **Lưu ở đâu:** ở v1, xu lưu trong bộ nhớ trình duyệt, kèm một bản sao trên server theo mã máy để xóa cache vẫn lấy lại được.

## 6. Chế độ 2 — Đua cùng bạn bè

### 6.1 Phòng & sảnh
- Làm giống các game khác của trang:
  - mã phòng, link mời gửi qua Zalo;
  - danh sách phòng đang mở;
  - kết nối lại khi rớt mạng.
- **Ở sảnh:** chọn xe và màu sơn, bấm sẵn sàng; chủ phòng thêm bot và chỉnh tùy chọn.
- Có thể dùng chung khung chat với các game khác.

**Tùy chọn phòng:**
| Tùy chọn | Lựa chọn | Mặc định |
|---|---|---|
| Thể thức | 🏁 Đua về đích · ⛽ Ai đi xa nhất | Đua về đích |
| Bản đồ | 4 bản + 🎲 ngẫu nhiên | Đồi chè |
| Độ dài (đua về đích) | Ngắn 600 m · Vừa 1.200 m · Dài 2.000 m | Vừa (khoảng 1,5–2 phút) |
| Xe | Tự chọn · Cùng một xe | Tự chọn |
| Va chạm | 💥 Xe đặc · 👻 Xe ma (đi xuyên) | Xe đặc |
| Vật phẩm | Bật · Tắt | Bật |
| Số ván | 1 · 3 · 5 (cộng điểm theo hạng) | 3 |

### 6.2 Thể thức
- **🏁 Đua về đích:**
  - Ai qua vạch trước thì thắng. Người về sau có 20 giây để về đích, quá thời gian thì xếp hạng theo quãng đường.
  - Vẫn có xăng nhưng can dày hơn, để xăng là chuyện chiến thuật chứ không phải chuyện sống còn.
- **⛽ Ai đi xa nhất:** như chơi một mình nhưng chạy chung.
  - Hết xăng là dừng.
  - Chổng vó thì hồi sinh nhưng mất 25% xăng.
  - Xe cuối cùng còn chạy được thì thắng; xếp hạng theo quãng đường.
- **Điểm nhiều ván:** hạng 1/2/3/4/5/6 được 10/7/5/3/2/1 điểm.

### 6.3 Xuất phát: chồng tháp 🗼

Chủ dự án muốn **hỗn loạn ngay từ giây đầu** (02/11/2026). Vì vậy các xe không xếp hàng ngang mà **được thả chồng lên nhau** tại vạch xuất phát.

**Xếp tháp:**
- 1–3 xe: **1 cột**.
- 4–6 xe: **2 cột**, mỗi cột tối đa 3 xe. Cột sau đứng cách cột trước khoảng 6 m, nên xe dưới cùng của cột sau lao lên là húc ngay vào đống đổ của cột trước.

```
     F        C        ← đỉnh tháp
     E        B
     D        A
 ─────────────────║──────────▶ hướng chạy
  cột sau   cột trước (ngay vạch xuất phát)
```
Ví dụ 6 xe: A chạy được ngay; B và C chờ rơi hoặc liều nhảy; D lao lên là húc vào đống A–B–C đang đổ.

**Trong lúc đếm ngược 3-2-1:**
- Tháp được **ghim tại chỗ**: các xe chỉ lún nhẹ cho khớp vào nhau, không đổ trước giờ (đổ sớm là không công bằng).
- Camera lùi xa để thấy cả tháp, tên từng người hiện trên xe.
- Nhấn ga lúc này chỉ làm máy gầm và bánh quay tại chỗ, cho có không khí.

**"CHẠY!":** bỏ ghim, để vật lý tự lo.
- Xe dưới cùng lao đi trước. Xe phía trên mất chỗ đứng, rơi xuống đường hoặc rơi lên nóc xe khác: có thể lật ngửa ngay vạch và phải tự lật lại.
- Xe trên mà đang nhấn ga thì bánh quay trên nóc xe dưới: bị kéo đi theo, trượt ra sau, hoặc bị hất văng.
- **Mỗi xe xuất phát với 35⚡**, đủ đúng 1 lần nhảy. Xe ở trên cao vì vậy có lựa chọn: **chờ rơi**, hay **liều nhảy vọt ra trước** bay qua đầu xe dưới. Nhảy hụt thì dễ lật ngửa.
- Xe khác loại chồng lên nhau càng loạn: xe buýt nóc rộng ở dưới thì tháp vững; xe con bọ ở dưới thì xe trên dễ đổ nhào.

**Thứ tự trong tháp:** bốc thăm ngẫu nhiên mỗi ván. Chưa biết đứng dưới hay đứng trên mới là lợi, nên cần chơi thử rồi mới quyết có thêm tùy chọn "người dẫn điểm phải lên đỉnh tháp" hay không (câu hỏi mở 12).

**Đường xuất phát:** 40 m đường bằng, sau đó dốc xuống nhẹ, để đống xe có chỗ bung ra, không ai bị kẹt cứng sau vạch.

**Chổng vó ngay vạch:** hồi sinh như thường (§6.5). Checkpoint đầu tiên nằm ngay sau vạch, xe được làm xe ma 1,5 giây để không bị kẹt lại vào đống đổ.

**Kỹ thuật:** 3 giây đầu sau "CHẠY!", xe của mình **không đoán trước** mà vẽ theo server (§11.3). Va chạm dồn dập thì đoán trước sẽ bị kéo giật liên tục; lúc hỗn loạn chậm 0,1 giây không ai nhận ra.

Áp dụng cho cả hai thể thức đua. Chơi một mình thì không có tháp.

### 6.4 Va chạm — phần "bất ổn"
- **Xe đặc:**
  - Thân và bánh của các xe va chạm thật với nhau.
  - Xe nặng ủi được xe nhẹ; húc đít thì xe trước bị đẩy lên.
- **🦶 Giẫm đầu:** xe A rơi xuống nóc xe B, vận tốc rơi so với B vượt một ngưỡng, góc chạm gần như thẳng đứng.
  - **B bị "bẹp":** thân xe dẹp xuống (hiệu ứng), tốc độ còn 40%, không ga được trong 0,8 giây, kèm tiếng "bẹp!".
  - **A được nảy lên** và nhận +20⚡.
  - Mỗi cặp xe phải chờ 1,5 giây mới giẫm lại nhau được (chống giẫm liên hoàn).
- **Đứng trên nóc:** A có thể đậu trên nóc B và "đi nhờ". B nhấn ga hay nhảy là hất A xuống.
- **Không có hình phạt nào khiến người bị đâm thua oan:**
  - Bị xe khác đè lên nóc **không tính** chổng vó.
  - Chỉ nóc chạm **đất** mới tính.
- **Chống phá rối:** xe đứng yên trên 4 giây khi đang đua (cố tình chặn đường) bị chuyển thành **xe ma** 3 giây, đi xuyên qua được. Luật này không tính trong 8 giây đầu ván, vì xe trên tháp phải đứng chờ (§6.3).

### 6.5 Chổng vó & hồi sinh
- Khi đua, chổng vó **không bị loại**:
  - xe mờ đi 1,5 giây;
  - rồi hiện lại đứng thẳng ở **checkpoint gần nhất phía sau**;
  - được làm xe ma 1,5 giây.
- Thiệt hại là mất thời gian, cộng mất quãng đường từ checkpoint tới chỗ úp.
- Kẹt không nhích được (kẹt giữa các xe, kẹt trong hố) trên 3 giây thì hiện nút **"↺ Hồi sinh"**. Lật ngửa thì đã có luật riêng (§2.6).

### 6.6 Màn kết quả
- **Bục 1-2-3** kèm xe của người về đầu.
- **Bảng thống kê:** thời gian, số lần giẫm đầu, số lần bị giẫm, số lần chổng vó, pha bay xa nhất.
- **Danh hiệu vui:** "Vua giẫm đầu", "Nạn nhân của năm", "Phi công" (bay nhiều nhất).
- Chủ phòng có nút "Ván tiếp".
- Lịch sử trận lưu vào `/leaderboard` (tab mới). Ván có bot không tính, giống Ai Là Heo.

### 6.7 Bot
- **Bot chạy trên server.**
- **Cách lái:**
  - Giữ ga.
  - Nhả ga hoặc phanh khi đầu xe ngửa quá ngưỡng.
  - Trên không thì chỉnh góc cho hai bánh tiếp đất.
  - Lật ngửa thì bật lật nếu đủ ⚡, không thì lắc xe.
  - Nhảy khi xe phía trước gần mà đi chậm hơn, và đủ năng lượng.
- **3 mức:**
  - **Dễ:** chậm phản xạ, hay lật.
  - **Vừa.**
  - **Khó:** biết giẫm đầu.

## 7. Vật phẩm

**Ai cũng có, mỗi người một bản riêng:**
- Can xăng, xu, bình ⚡ và hộp vật phẩm hiện với **mỗi người một bản riêng**. Ai ăn thì chỉ mất ở màn hình người đó.
- Vì vậy người đi đầu không "ăn hết phần" của người đi sau, và không có chuyện giành nhau.

**Hộp ❓** (chỉ khi đua, bật trong tùy chọn): giữ tối đa 1 vật phẩm, bấm nút để dùng.

| Vật phẩm | Tác dụng | Ghi chú |
|---|---|---|
| 🚀 **Tên lửa** | Đẩy mạnh về trước trong 1,5 giây | Hay ra cho người đi sau |
| 🦘 **Lò xo** | Nhảy cao gấp đôi, không tốn ⚡ | Để bay qua đầu cả đoàn |
| 🛢️ **Vũng dầu** | Thả lại phía sau; xe nào chạm vào thì trượt bánh 1,5 giây | Hay ra cho người đi đầu |
| 🛡️ **Khiên** | Trong 5 giây không bị giẫm, không trượt dầu; ai giẫm lên thì bị bật văng | |
| 🎈 **Phao chống lật** | Lật ngửa là tự dựng dậy ngay, không tốn ⚡; dùng được 1 lần trong 15 giây | |

- Hộp ra vật phẩm theo **thứ hạng hiện tại**: người đi sau dễ được tên lửa và lò xo, người đi đầu dễ được dầu và khiên. Kéo cả đoàn lại gần nhau thì mới có cảnh chen chúc.
- Khi chơi một mình: không có hộp ❓, chỉ có xăng, xu và ⚡.

### 7.1 Lên cấp trong trận ⭐ (làm sau, giai đoạn 5)

Chủ dự án đồng ý ý tưởng này (02/11/2026) nhưng **chưa làm ngay**; làm sau khi phần lái và phần đua đã ổn.

**Ý tưởng:** thay cho nâng cấp lâu dài (cần đăng nhập), xe **mạnh lên ngay trong lượt chạy hoặc trong ván đua**, hết lượt là mất. Mỗi lượt vì vậy là một "bộ đồ" khác nhau, chơi lại không chán.

**Kiếm EXP:**
- **⭐ trên đường:** mỗi người một bản riêng như xăng, rải thành cụm nhỏ mỗi 30–60 m.
- **Pha đẹp cũng ra sao:** lộn vòng, bay lâu, giẫm đầu, thoát hiểm (§2.5, §2.6).
- **Khi đua:** người đi sau nhặt sao được nhiều hơn (người bét ×1,5, người đầu ×0,8), để người đầu không bỏ xa cả đoàn.

**Lên cấp:**
- Từ cấp 1 tới tối đa **cấp 5**. Cần 10 / 20 / 35 / 55 EXP cho mỗi lần lên.
- Mỗi lần lên cấp: xe lóe sáng, hiện **3 thẻ** ngẫu nhiên, chọn 1.
- Một thẻ chọn được tối đa 2 lần. Thẻ đã đủ 2 lần thì không ra nữa.

**Bộ thẻ:**
| Thẻ | Tác dụng |
|---|---|
| 🔧 Máy khỏe | +15% lực kéo, leo dốc tốt hơn |
| 🏎️ Tăng tốc | +10% tốc độ tối đa |
| 🛞 Lốp bám | Bám đường hơn, đỡ trượt trên cát và dầu |
| 🪶 Nhún êm | Giảm xóc mềm hơn, tiếp đất ít nảy |
| ⛽ Bình to | +30% dung tích xăng và đổ đầy ngay |
| 💧 Tiết kiệm | −20% hao xăng |
| 🦘 Chân lò xo | Nhảy cao hơn 30%, mỗi lần nhảy tốn ít ⚡ hơn |
| 🔋 Pin trâu | ⚡ hồi nhanh gấp rưỡi |
| 🧲 Nam châm | Hút xu, ⭐ và can xăng trong vòng 4 m |
| 🙃 Lật đật | Thời gian cứu xe khi lật ngửa tăng từ 3 lên 5 giây |
| 🛡️ Nóc thép (chỉ khi đua) | Bị giẫm chỉ chậm 20% thay vì 60% |

**Chọn thẻ trên điện thoại** (hai ngón đang giữ bàn đạp):
- 3 thẻ to hiện **ở giữa đáy màn hình, giữa hai bàn đạp**, ngón nào cũng với tới.
- **Chơi một mình:** thời gian chậm lại còn 25% trong lúc chọn, tối đa 3 giây.
- **Khi đua:** không làm chậm được (người khác vẫn đang chạy); 4 giây không chọn thì máy chọn ngẫu nhiên giúp.
- Máy tính: phím 1 / 2 / 3.

**Công bằng:**
- **"Đường hôm nay":** thẻ được rút theo seed của ngày, nên ai cũng được mời cùng những thẻ như nhau ở cùng cấp.
- **Bảng xếp hạng:** mọi lượt đều bắt đầu từ cấp 1, nên kỷ lục vẫn so được với nhau.

**Hiển thị:**
- Huy hiệu "Lv3" cạnh tên xe.
- Hàng icon thẻ đã chọn nhỏ dưới thanh ⚡.
- Màn kết quả có thêm dòng "bộ đồ" của lượt đó.

**Kỹ thuật:**
- Thẻ là thông số đưa vào mô phỏng (`shared/hillSim.ts`).
- Khi đua, server rút thẻ và áp dụng. Trình duyệt gửi `perk {index}`, tức thêm tối đa 4 message mỗi người mỗi ván, không đáng kể so với hạn mức.

## 8. Màn hình & điều khiển (ưu tiên điện thoại)

- **Màn hình ngang** là chính. Mở bằng điện thoại dọc thì hiện gợi ý "Xoay ngang để chơi đã hơn 🔄", nhưng **vẫn chơi được dọc**: camera thu xa hơn, bàn đạp nằm dưới đáy.
- Có nút toàn màn hình (Fullscreen API, máy nào hỗ trợ).
- Chặn kéo trang và chặn phóng to bằng hai ngón khi đang chơi.
- **HUD:**
  - **Góc trái trên:** thanh ⛽ (dưới 20% thì nhấp nháy đỏ và kêu bíp), thanh ⚡ ngay dưới.
  - **Giữa trên:** quãng đường hiện tại, kèm mốc kỷ lục (một mình); hoặc **thanh tiến độ cả đoàn**: một đường ngang có chấm màu của từng xe và vạch đích (khi đua).
  - **Góc phải trên:** xu, nút ⏸ / ⚙️.
  - **Khi đua:** hạng hiện tại "2/5" chữ to. Xe ngoài màn hình hiện thành mũi tên ở mép, kèm tên và khoảng cách ("An +35 m").
- **Camera:**
  - Bám theo xe của mình, xe hơi lệch về bên trái màn hình để thấy đường phía trước.
  - Chạy nhanh hay đang bay thì thu xa lại.
  - Có độ trễ mượt, rung nhẹ khi tiếp đất mạnh hoặc bị giẫm.
- **Lối vào:** trang `/con-duong-hoang-kim` có 2 thẻ to "🏆 Phá kỷ lục" và "👥 Đua cùng bạn bè", phía dưới là bảng xếp hạng "Đường hôm nay".

## 9. Đồ họa

- **2D bằng Canvas**, cùng cách với Xe Tăng và Bóng Đá. Không cần 3D.
- **Phong cách:** hoạt hình tươi sáng, gần với ảnh mẫu.
  - Trời có dải màu chuyển, 2–3 lớp đồi nền trôi chậm cho có chiều sâu.
  - Mặt đường là khối đất có vân, viền cỏ phía trên.
  - Màu sắc riêng theo từng bản đồ.
- **Xe:**
  - Vẽ sẵn thành ảnh để vẽ nhanh.
  - Bánh xe quay thật, nhún thật, sơn theo màu người chơi chọn.
- **Xe kín, không vẽ bác tài**, cho nhẹ máy và dễ vẽ:
  - Kính xe tối màu, tên người chơi hiện phía trên xe.
  - Cho có cảm xúc mà vẫn rẻ: **đôi mắt vẽ trên kính chắn gió** (kiểu phim hoạt hình *Cars*), chỉ vài nét. Mắt tròn xoe khi bay, mắt xoắn khi bị giẫm, mắt chữ X khi chổng vó.
- **Hiệu ứng:** bụi bánh xe, tia lửa khi cạ gầm, sao bay khi chổng vó, chữ thưởng nổi, xu lấp lánh, khói đen khi gần hết xăng.
- **Hiệu năng:**
  - Chỉ vẽ phần đường đang thấy.
  - Mật độ điểm ảnh tối đa 2.
  - Nhắm 60 khung hình/giây trên điện thoại tầm trung.
  - Có chế độ "Nhẹ": bỏ lớp nền trôi và hạt bụi.

## 10. Âm thanh

Tạo âm bằng Web Audio, cùng cách với `sound.ts` hiện có:
- **Tiếng máy:** sóng răng cưa qua bộ lọc thấp, cao độ theo tốc độ bánh. Mỗi xe một giọng (xe con bọ thì rít cao, xe tải thì ầm ầm).
- **Các tiếng khác:**
  - nhặt xu, đổ xăng;
  - tiếp đất "bịch", nhảy "boing", giẫm "bẹp!";
  - chổng vó, trượt dầu, tên lửa;
  - đếm ngược 3-2-1, nhạc về đích;
  - còi báo gần hết xăng.
- Tắt / bật tiếng trong ⚙️.

## 11. Kỹ thuật

### 11.1 Mô phỏng dùng chung
- **Bộ vật lý:** **planck.js** (bản Box2D viết bằng JavaScript, bản 1.5.x; thư viện mới).
  - Chạy được cả trên trình duyệt lẫn trên Cloudflare Worker.
  - Có sẵn khớp bánh xe có lò xo, đúng thứ cần cho xe.
- **`shared/hillTypes.ts`:** hằng số, thông số xe, bản đồ, kiểu message.
- **`shared/hillSim.ts`:** sinh địa hình từ seed, dựng xe, một bước mô phỏng cố định **1/60 giây**, phát hiện chổng vó / giẫm đầu / ăn vật phẩm.
  - **Dùng chung cho cả 3 nơi:** chơi một mình (trình duyệt), server đua, và phần đoán trước của trình duyệt.
- **Chỉ giữ đường gần xe:** thế giới vật lý chỉ chứa đoạn đường quanh các xe (khoảng ±60 m), sinh thêm và xóa bớt khi xe chạy, để khỏi phình bộ nhớ trên đường vô tận.

### 11.2 Chơi một mình
- **Chạy hoàn toàn trên trình duyệt**, không cần server game.
- Hết lượt thì gửi kết quả lên `POST /api/hill/runs`: bản đồ, seed, xe, quãng đường, xu, thời gian, và bản ghi bóng ma nếu đủ điều kiện.
- **Lưu MongoDB:**
  - `HillRun`: kỷ lục và bóng ma của top.
  - `HillWallet`: xu và xe đã mở, theo mã máy.

### 11.3 Đua nhiều người — máy chủ quyết định, trình duyệt đoán trước

Vì xe va chạm và giẫm lên nhau, **mọi máy phải thấy cùng một thực tại**. Cách chắc chắn nhất:
- **Server (`HillRoom`, Durable Object mới) chạy vật lý cho cả phòng.**
  - Mô phỏng ở 60 bước/giây: mỗi 50 ms chạy 3 bước.
  - Gửi **ảnh chụp trạng thái** 15 lần/giây (giống Xe Tăng): vị trí, góc, vận tốc, xăng, ⚡ và trạng thái của từng xe.
  - Thêm các sự kiện: giẫm, chổng vó, hồi sinh, ăn vật phẩm, về đích.
- **Trình duyệt chỉ gửi khi nút bấm thay đổi:** `{ seq, gas, brake, jump, item }`. Server giữ trạng thái nút cuối cùng của mỗi người cho tới lần đổi sau. **Không gửi nhịp đều**, vì gói Free tính tiền theo số message gửi lên (§11.5). Rớt mạng thì server coi như nhả hết nút.
- **Xe người khác:** vẽ chậm khoảng 100 ms so với hiện tại, nội suy mượt giữa hai ảnh chụp.
- **Xe của mình:** trình duyệt **đoán trước** bằng chính bộ mô phỏng đó, nên bấm ga là xe chạy ngay, không đợi mạng.
  - Mỗi ảnh chụp từ server, trình duyệt so lại: lệch nhiều thì đặt xe về đúng trạng thái server, rồi chạy lại các lần bấm phím server chưa xử lý.
  - Chỗ lệch được kéo về từ từ trong khoảng 100 ms cho khỏi giật.
  - Bị đâm hay bị giẫm thì sẽ có chỉnh nhỏ. Không tránh được, nhưng mắt người khó thấy.
- **Đã cân nhắc và không chọn:**
  - **Mỗi máy tự quyết xe mình:** xe khác bị trễ 100 ms, mà đi 15 m/giây thì lệch 1,5 m. Kết quả là đâm vào khoảng không, hoặc giẫm hụt.
  - **Lockstep tất định:** phải đảm bảo mọi trình duyệt tính ra cùng một con số; Safari và Chrome có thể lệch nhau. Quá phức tạp cho dự án này.

### 11.4 Message (phác thảo)
- **Trình duyệt → server:**
  - **Ở sảnh:** `join`, `pick {vehicle, color}`, `ready`, `config`, `add_bot`, `start`.
  - **Khi đua:** `input {seq, gas, brake, jump, item}` và `respawn`.
- **Server → trình duyệt:**
  - **Trạng thái phòng:** `state` gửi đầy đủ ở sảnh và lúc đổi pha.
  - **Khi đua:** `snap {tick, cars[], acks{id: seq}}`.
  - **Sự kiện:** `event {stomp | crash | respawn | pickup | item | finish}`.
  - **Kết thúc ván:** `results`.
- **Kích thước:** ảnh chụp 6 xe khoảng 6 × 14 số. Dùng mảng số thay object để gọn, cỡ 1 KB mỗi lần, khoảng 15 KB/giây.

### 11.5 Chạy trên Cloudflare gói Free

Chủ dự án xác nhận dùng **gói Free** (02/11/2026). Theo tài liệu Durable Objects của Cloudflare, gói Free có:
- **100.000 request mỗi ngày cho cả tài khoản**, trong đó **mỗi message WebSocket gửi lên server tính là 1 request**. Hạn này dùng chung với mọi game khác của trang (Xe Tăng, Bóng Đá, Ma Sói…).
- **13.000 GB-giây thời gian chạy mỗi ngày.** Một Durable Object dùng 128 MB, nên quy ra khoảng **29 giờ "phòng đang thức"** mỗi ngày cho cả tài khoản.
- Vượt hạn thì các thao tác loại đó **lỗi tới 7 giờ sáng** (00:00 UTC) mới chạy lại.
- CPU: mỗi message gửi lên lại được cấp 30 giây CPU, nên CPU **không phải** nút thắt.

**Vì vậy nút thắt là số message gửi lên**, không phải CPU. Cách giữ:
- **Chơi một mình không đụng tới Cloudflare**: chạy hết trên trình duyệt, kỷ lục gửi qua API Next (MongoDB). Chế độ này chơi bao nhiêu cũng không tốn hạn mức.
- **Khi đua, chỉ gửi lúc nút bấm đổi** (§11.3). Người lái hay nhấp nhả ga khoảng 2–4 lần mỗi giây.
  - Một ván 2 phút, 6 người: khoảng 1.500–3.000 message.
  - Tức khoảng **30–60 ván đua mỗi ngày** nếu chỉ có game này dùng hạn mức. Đủ cho một nhóm bạn, chưa đủ nếu trang đông.
- **Bot chạy ngay trên server**, không tốn message.
- **Tim server chỉ đập khi đang đua:** ở sảnh không chạy vòng lặp vật lý, để Durable Object được ngủ và không tốn thời gian chạy.
- **Server → trình duyệt không tính phí.** Ảnh chụp 15 lần/giây thoải mái.
- **Đếm và cảnh báo:** server đếm số message mỗi ngày, ghi log khi vượt 50% / 80% hạn mức.
- **Khi trang đông lên:** gói Paid $5/tháng có 1 triệu request mỗi tháng, mà message WebSocket chỉ tính 1/20. Nâng lúc đó là hết lo.

**CPU vẫn đo, nhưng ít đáng lo hơn:**
- Vật lý 60 bước/giây cho 6 xe, ước tính 0,1–0,3 ms mỗi bước.
- **Đo thật ở giai đoạn 3.** Nếu nặng thì lùi dần:
  1. Cho thân xe "ngủ" khi đứng yên.
  2. Giảm số vòng lặp giải lực.
  3. Giảm tối đa còn 4 người.

### 11.6 File dự kiến
- **Dùng chung:** `shared/hillTypes.ts`, `shared/hillSim.ts`, `shared/hillTerrain.ts`.
- **Server:**
  - `party/hill-server.ts` (`HillRoom`), `party/hill-directory.ts` (danh sách phòng), `party/hill/bots.ts`.
  - Thêm khai báo vào `wrangler.jsonc` và `party/index.ts`.
- **Trang:** `src/app/con-duong-hoang-kim/page.tsx` (lối vào), `.../solo/page.tsx`, `.../[roomId]/page.tsx`.
- **Giao diện:** `src/components/hill/` (canvas vẽ, HUD, bàn đạp, sảnh, kết quả), `src/lib/useHillRoom.ts`.
- **API:** `src/app/api/hill/runs/route.ts` (kỷ lục, bảng xếp hạng, bóng ma), `src/app/api/hill/wallet/route.ts`.
- **Thư viện mới:** `planck` (bản 1.5.x).

## 12. Chống gian lận
- **Đua nhiều người:** server quyết định toàn bộ vật lý, trình duyệt chỉ gửi nút bấm, nên không gian lận được.
- **Chơi một mình:** kết quả do trình duyệt tự báo. Ở mức game vui, server chỉ kiểm tra cho hợp lý:
  - quãng đường không vượt quá thời gian × tốc độ tối đa của xe;
  - xăng nhặt được khớp với số can trên đoạn đường đó.
- Muốn chặt hơn thì để sau: gửi kèm nhật ký nút bấm và server chạy lại (§14).

## 13. Lộ trình làm

1. **Lái một mình (quan trọng nhất):**
   - Bộ mô phỏng dùng chung, sinh đường, 1 bản đồ, xe Jeep.
   - Bàn đạp cảm ứng và bàn phím, xăng, xu, chổng vó, HUD, camera.
   - Đưa chủ dự án lái thử để **chỉnh cảm giác** (độ nhún, lực ga, độ xoay trên không) trước khi làm gì khác.
2. **Kỷ lục:**
   - API và bảng xếp hạng, "Đường hôm nay", cờ trên đường.
   - Đủ 4 xe và 4 bản đồ, năng lượng và nhảy, thưởng kỹ năng, xu và mở khóa xe, âm thanh.
3. **Đua nhiều người:**
   - `HillRoom` chạy vật lý trên server, ảnh chụp trạng thái, nội suy. **Đo CPU ngay bước này.**
   - Rồi tới đoán trước cho xe của mình.
   - Va chạm, giẫm đầu, hồi sinh, về đích, kết quả, sảnh, danh sách phòng.
4. **Cho vui hẳn:**
   - Hộp ❓ vật phẩm, bot, bóng ma kỷ lục.
   - Danh hiệu cuối trận, hiệu ứng, lịch sử trận, ô game trên trang chủ.
5. **Lên cấp trong trận** (§7.1): ⭐ trên đường, 3 thẻ mỗi lần lên cấp, cho cả chơi một mình lẫn khi đua.

## 14. Để sau (v2)
- Nâng cấp xe (động cơ, giảm xóc, lốp, bình xăng) như Hill Climb Racing. Cần có đăng nhập, hoặc gắn tiến trình với mã máy.
- Thêm bản đồ (tuyết Sa Pa, ruộng bậc thang, công trường), thêm xe (xe ba gác, xe lam).
- Màu sơn, sticker, kiểu mắt xe mở bằng xu.
- Chơi một mình chống gian lận chặt: server chạy lại nhật ký nút bấm.
- Giải đấu tuần cho "Đường hôm nay"; đua đồng đội 2 vs 2.

## 15. Câu hỏi còn mở

Spec đang theo các mặc định dưới đây. Muốn đổi thì nói lại.

1. ~~Tên game~~ → **Con Đường Hoàng Kim** (đã chốt 02/11/2026). Đường dẫn `/con-duong-hoang-kim`.
2. ~~Nâng cấp xe~~ → **chưa làm** vì không có đăng nhập (đã chốt). Thay bằng **lên cấp trong trận** (§7.1), làm ở giai đoạn 5.
3. **Va chạm:** mặc định **xe đặc**, có tùy chọn **xe ma** cho ai thích đua chill. Giữ cả hai?
4. **Chổng vó khi đua:** **hồi sinh ở checkpoint** (mất thời gian) thay vì bị loại.
5. **Năng lượng tách khỏi xăng** (§2.4). Hay bạn muốn nhảy tốn xăng luôn cho căng?
6. **Vật phẩm khi đua:** bộ 5 món ở §7, chia theo thứ hạng. Thêm hoặc bớt món nào?
7. **Tối đa 6 xe** mỗi phòng, có bot.
8. ~~Bác tài~~ → **xe kín, không lộ bác tài**; mắt vẽ trên kính chắn gió (đã chốt).
9. **Điện thoại dọc:** vẫn cho chơi (camera thu xa), chỉ gợi ý xoay ngang.
10. ~~Gói Cloudflare~~ → **Free** (đã chốt 02/11/2026). Giới hạn chính là số message gửi lên mỗi ngày (§11.5).
11. **Bóng ma kỷ lục** để ở giai đoạn 4. Muốn có sớm hơn không?
12. **Thứ tự trong tháp xuất phát:** đang bốc thăm ngẫu nhiên mỗi ván. Chơi thử xong mới quyết có ép người dẫn điểm lên đỉnh tháp (hoặc xuống đáy) cho cân không.

## 16. Cập nhật sau bản 1: sảnh, cân bằng xe, đua bot (02/11/2026)

**Sảnh game (thay cho hộp thoại chọn xe cũ):**
- **Garage xem trước thật.** Ở sảnh, màn chơi phóng to vào xe đang chọn, đậu trên đúng bản đồ (hoặc đường hôm nay) đang chọn. Đổi xe thì xe mới rơi xuống nảy nhún; bấm CHẠY thì camera lùi ra rồi đếm ngược. Ý từ garage của Hill Climb Racing 2.
- **4 chế độ ngang hàng** ở trên cùng: 🏆 Phá kỷ lục · 🗓️ Đường hôm nay · 🤖 Đua với bot · 👥 Đua cùng bạn. Bảng bên dưới đổi theo chế độ: điện thoại dọc thì ở đáy, màn ngang và máy tính thì ở cạnh phải.
- **Chọn xe:**
  - dải thẻ vuốt ngang có hình xe thật, xe chưa mở hiện bóng tối kèm giá;
  - 5 thanh chỉ số kiểu Mario Kart;
  - dòng "Hợp nhất" bấm được để nhảy sang bản đồ hợp với xe đó.
- **Chọn đường:** thẻ bưu thiếp vẽ đúng dáng đường của bản đồ, có độ khó và đặc điểm, kèm cờ kỷ lục của bạn trên từng bản đồ.
- **Nút CHẠY:** to, dày, bấm có độ lún. Khi xe chưa mở, nút đổi thành "Mở khoá · giá" kèm số xu còn thiếu.
- **Màn kết quả:**
  - quãng đường đếm lên;
  - pháo hoa khi phá kỷ lục;
  - xu kiếm được tách theo nguồn;
  - thanh tiến độ tới xe kế tiếp;
  - "Chạy lại" là nút chính.
- **Sảnh đua cùng bạn:**
  - vạch xuất phát hiện xe thật của từng người;
  - chọn xe và đường bằng đúng các bộ chọn trên;
  - nút Sẵn sàng / Bắt đầu cố định ở đáy và nói rõ đang chờ gì;
  - nút "Mời bạn" dùng chia sẻ của điện thoại.
- **Bàn đạp khi đua giống hệt khi chơi một mình:** phanh trái, ga phải, lao tới và nhảy phía trên.

**Cân bằng xe** (chủ dự án: mỗi xe một thế mạnh riêng, không xe nào quá yếu hay quá mạnh). Số liệu nằm ở `HILL_VEHICLES`.

| Xe | Thế mạnh | Điểm yếu | Hợp nhất | Giá |
|---|---|---|---|---|
| 🚙 Jeep | Toàn diện | Không có | Mọi đường | 0 |
| 🚗 Xe con bọ | Nhanh nhất, tiết kiệm xăng nhất | Leo dốc gắt yếu, dễ lật | Đồi chè, Mặt trăng | 150 |
| 🚌 Xe buýt | Khó lật nhất, ủi mạnh | Tăng tốc chậm | Đồi cát | 300 (trước 500) |
| 🛻 Tải quái vật | Leo dốc, vượt đá giỏi nhất | Chậm hơn Jeep một chút, hao xăng | Đèo Mã Pí Lèng | 450 (trước 350) |

Trước đó xe con bọ (150 xu) vừa nhanh nhất vừa leo tốt nhất, còn xe buýt (500 xu, đắt nhất) lại yếu nhất. Số liệu mới tính trên giấy, **cần lái thử để chỉnh**.

**🤖 Đua với bot:**
- Chạy hoàn toàn trên trình duyệt bằng chính `HillRaceSim` của phòng online: không tốn hạn mức Cloudflare, không lag mạng, tạm dừng được.
- 1–5 bot, đặt tên Tèo, Tí, Sửu…, mỗi bot một xe.
- **3 mức:**
  - **Dễ:** phản xạ chậm, hay khựng ga.
  - **Vừa.**
  - **Khó:** phản xạ nhanh, rình nhảy lên đầu.
- Bot (`shared/hillBot.ts`) lái bằng đúng luật như người:
  - giữ ga, nhả ga khi đầu xe ngửa quá;
  - trên không thì chỉnh góc cho khớp dốc chỗ sắp đáp;
  - nhảy qua xe chắn đường;
  - bật lật hoặc lắc xe khi chổng vó;
  - kẹt thì xin hồi sinh.
- Được đi cả 4 xe, chưa mở khoá cũng được, giống đua cùng bạn.
- **Chưa thưởng xu**, để tránh cày xu bằng bot dễ.

**Hiệu ứng, cổng và bản đồ thu nhỏ (02/11/2026):**
- `hillFx.ts` chỉ là phần vẽ, tính trên máy người chơi từ trạng thái các xe mỗi khung hình. Áp dụng cho cả chơi một mình, đua bot và đua online, không gửi gì qua mạng. Gồm:
  - bụi bánh xe theo bản đồ (đất, cát, sỏi, bụi trăng lơ lửng), bánh càng trượt càng nhiều bụi;
  - vòng bụi khi tiếp đất mạnh;
  - tia lửa và chữ "BỐP!" khi hai xe húc nhau, đo bằng tốc độ lao vào nhau ngay trước va chạm;
  - chữ "BẸP!" khi bị giẫm;
  - tia lửa khi nóc xe cạ đất;
  - rung màn hình và rung điện thoại, chỉ cho xe của mình; tắt khi máy bật chế độ giảm chuyển động.
- **Cổng XUẤT PHÁT** đặt ngay trước tháp xe, **cổng 🏁 ĐÍCH** đặt ở vạch đích; cả hai kèm vạch caro trên mặt đường.
- **Bản đồ thu nhỏ khi đua:** cố ý để đơn giản theo ý chủ dự án: một đường lên xuống theo địa hình cả chặng, cộng chấm xe của từng người. Chế độ "Ai đi xa nhất" thì bản đồ dài dần theo người dẫn đầu.
- **Chơi một mình:** thanh "còn X m tới 🚩 kỷ lục".

**Đường trên không và nước dưới vực (02/11/2026, cả 4 bản đồ):**
- **Cách sinh:** sinh từ seed theo từng đoạn 72 m (`shared/hillTerrain.ts`), nên server, phần đoán trước của trình duyệt và phần vẽ khớp nhau mà không gửi thêm dữ liệu. **Mặt đường cũ giữ nguyên.** Không có trong 150 m đầu.
- **Chỉ có cầu sau dốc phóng**, khoảng 1/5 số đoạn. **Muốn lên phải lấy đà từ dốc VÀ bấm nhảy đúng lúc ở mép dốc** (luật của chủ dự án).
  - Cầu cao hơn độ bay của xe chạy nhanh (17 m/s) mà không nhảy, và cao hơn một cú nhảy tại chỗ.
  - Cầu bắt đầu cách mép dốc 8 m, nên nhảy mà không có đà thì hụt.
  - Độ cao tính riêng theo độ dốc từng con dốc và trọng lực từng bản đồ.
  - Cầu bắc ngang vực từng có ở bản trước nhưng đã bỏ, vì đứng sát mép bấm nhảy là lên được.
- **Mặt cầu:** phẳng nên đi nhanh hơn rõ (bỏ qua chỗ dốc đổ và lòng chảo), có dãy xu và một bình ⚡ ở giữa. Cuối cầu là dốc xuống mặt đường.
- **Cầu một chiều:** từ dưới đi xuyên hay nhảy xuyên lên được, từ trên đáp xuống thì đứng được (`pre-solve` trong `hillWorld.ts`). Chạm gầm cầu từ dưới không bị tính là chổng vó hay đang chạm đất.
- **Kiểu dáng theo bản đồ:**
  - Đồi chè: cầu tre trên cột.
  - Mũi Né: cầu ván.
  - Mã Pí Lèng: cầu treo dây.
  - Mặt trăng: tấm đá trôi phát sáng.
- **Nước dưới vực** (trừ Mặt trăng): xe chạm nước bị chậm 2% tốc độ mỗi giây (chủ dự án muốn 1–2%), té nước khi chạy nhanh, có tiếng.
- **Bot:** bot quyết định một lần cho mỗi cầu có nhảy lên hay không, tuỳ độ khó. Nếu nhảy thì bấm nhảy ngay mép dốc khi đang chạy trên 9 m/s.
- **Lưu ý:**
  - Các con số độ cao mới tính trên giấy, **cần lái thử** xem cầu phóng có quá dễ hoặc quá khó lên không.
  - Kỷ lục cũ trên bảng xếp hạng được lập khi chưa có lối tắt.

**Hết xăng khi đua (sửa sau lần chơi thử 02/11/2026):**
- Ở chế độ **Đua về đích**, hết xăng không còn bị tính là xong lượt. Xe **chạy cầm cự** (35% tốc độ, 60% lực kéo, không lao tới được) cho tới can xăng kế tiếp, mỗi 60 m. HUD báo "⛽ Cầm cự".
- Hồi sinh khi Đua về đích được đổ ít nhất 60% xăng (ban đầu là 30%, chủ dự án thấy ít, nâng ngày 03/11/2026), để xe cầm cự không kẹt mãi dưới cùng một con dốc.
- **Chơi một mình** và **Ai đi xa nhất** giữ luật cũ: hết xăng là hết lượt.
- Nút "Hồi sinh" không còn hiện khi lượt đã xong. Trước đây nó vẫn hiện nhưng bấm không có tác dụng.
- **Thời gian cứu xe khi lật ngửa tăng từ 3 lên 10 giây** theo ý chủ dự án (02/11/2026). Áp dụng cho mọi xe, mọi chế độ. Con số nằm duy nhất ở `HILL_JEEP.overturnSeconds` (`shared/hillTypes.ts`); vòng đếm ngược, phần khôi phục trạng thái khi đua online và các dòng hướng dẫn đều đọc từ đó. Những chỗ ghi "3 giây" ở phía trên spec là con số cũ.
- **Sửa xe kẹt dưới cuối cầu (03/11/2026):** cầu một chiều giờ nhớ từng bộ phận xe chạm cầu từ phía nào ngay lúc mới chạm, và giữ kết luận đó cho tới khi rời khỏi cả cây cầu (`HillPhysicsWorld.deckAbove`). Trước đây game tính lại mỗi khung hình, nên ở đoạn cầu dốc xuống chạm đất, xe chui bên dưới bị coi là đang ở trên cầu và bị mặt cầu kẹp như cái nêm. Phần kiểm tra bánh chạm đất và nóc chạm đất cũng dùng cùng kết luận này.

**Dốc không còn dựng đứng, xe mạnh hơn (04/11/2026, theo phản hồi của chủ dự án):**
- Hai lớp gợn địa hình và chướng ngại có lúc cộng dồn, lại nhân hệ số khó (tới ×1,7), thành vách 55–60°. Với lực máy cũ, xe chỉ bò lên được dốc khoảng 29° (Xe buýt) tới 40° (Tải quái vật), nên các vách đó không xe nào lên nổi.
- **Giới hạn độ dốc lên** theo từng đường (`MAX_CLIMB` trong `shared/hill/terrain.ts`), tính bằng độ cao tăng trên mỗi mét:

  | Đường | Giới hạn | Góc |
  | --- | --- | --- |
  | Đồi chè | 0,6 | 31° |
  | Đồi cát | 0,6 | 31° |
  | Mặt trăng | 0,7 | 35° |
  | Đèo | 0,75 | 37° |

  - Chỗ nào dựng hơn thì thành con dốc khoét vào vách, cho tới khi gặp lại mặt đất gốc.
  - Dốc xuống giữ nguyên độ gắt.
  - Mặt đất được tính lần lượt từ mét 40 và lưu lại, nên máy chủ, phần đoán trước và phần vẽ luôn ra cùng một con đường.
- **Mọi xe mạnh hơn cùng lúc:** tốc độ tối đa tăng khoảng 10%, lực kéo tăng 25%, thứ tự sở trường giữ nguyên. Con số mới ghi ở `HILL_VEHICLES`.
  - Xe buýt và Xe con bọ giờ bò đều lên được khoảng 38°, Jeep 42°, Tải quái vật 54°, đều qua được giới hạn dốc ở trên.
- **Cầu trên không:** tốc độ chuẩn dùng để tính độ cao cầu (`BRISK`) nâng từ 17 lên 19 m/s cho khớp với xe nhanh hơn, để vẫn phải lấy đà **và** bấm nhảy.
- **Lưu ý:**
  - Kỷ lục cũ được lập trên đường cũ, có vách dựng. Đường mới dễ hơn nên kỷ lục mới sẽ dễ vượt.
  - Các con số mới tính trên giấy, **cần lái thử**.
