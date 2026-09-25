# Ma Sói Cùng Phòng — Game Design Specification

**Trạng thái:** v2 — cập nhật theo bản đang chạy (ngày 2026-09-25)  
**Đối tượng:** Product Designer, Game Designer, UI/UX Designer  
**Nền tảng:** Web responsive, ưu tiên điện thoại  
**Số người:** 5–12 người (người thật + bot)  
**Bối cảnh chính:** Nhóm bạn chơi cùng phòng hoặc từ xa, mỗi người dùng thiết bị riêng

Quy ước: mục có nhãn **[Đã có]** là hành vi đang chạy; **[Chưa làm]** là ý tưởng hoặc phần của v1 chưa triển khai.

## 1. Tầm nhìn sản phẩm

Ma Sói Cùng Phòng là game suy luận xã hội chơi trên trình duyệt. Điểm khác biệt chính là mọi người đều tương tác trong suốt pha đêm, nhờ đó tiếng chuột, bàn phím và thời gian thao tác không dễ làm lộ vai trò.

Thiết bị đảm nhiệm:

- Chia vai và bảo mật thông tin.
- Điều phối các pha và đồng hồ.
- Nhận hành động bí mật, giải quyết luật, công bố kết quả.
- Trò chuyện, bỏ phiếu (công khai sau khi đóng phiếu), ghi chú và lưu lịch sử ván.

## 2. Nguyên tắc thiết kế

1. **Ai cũng có việc để làm:** mọi người tương tác đến hết pha đêm, kể cả Dân và người đã chết (hành động giả).
2. **Giao diện không tố cáo vai trò:** bố cục và chuyển động gần giống nhau giữa các vai. Nút "Xong" ban đêm giống hệt nhau và không hiện ai đã bấm.
3. **Server là quản trò:** không cần một người biết toàn bộ vai.
4. **Thông tin bí mật chỉ xuất hiện khi cần.**
5. **Thảo luận là trung tâm:** chat trong ứng dụng là kênh chính ban ngày; giao diện không bắt người chơi cuộn cả trang để đọc.
6. **Thông tin công khai gây tranh luận:** kết quả dư luận sau đêm và phiếu bầu (ai bầu ai, lý do) được công khai để người chơi chất vấn nhau.

## 3. Bộ vai

| Vai | Phe | Ban đêm |
|---|---|---|
| Dân Làng | Dân | Chọn người nghi ngờ (ghi chú riêng). |
| Ma Sói | Sói | Biết đồng đội; thăm dò rồi chốt nạn nhân chung. Không thể chọn đồng đội. |
| Tiên Tri | Dân | Soi một người; kết quả hiện riêng cuối đêm (Thuộc / Không thuộc phe Sói). |
| Bảo Vệ | Dân | Che chở một người khỏi Sói. Không bảo vệ cùng một người hai đêm liên tiếp; không tự chọn mình. Không chặn độc. |
| Phù Thủy | Dân | 1 bình cứu + 1 bình độc, mỗi bình dùng một lần. Thấy nạn nhân ở bước cuối đêm. Tự cứu mình bật/tắt được (chủ phòng). |

## 4. Phân bổ vai **[Đã có]**

| Người chơi | Sói | Vai đặc biệt | Dân thường |
|---:|---:|---|---:|
| 5 | 1 | Tiên Tri | 3 |
| 6 | 1 | Tiên Tri, Bảo Vệ | 3 |
| 7 | 2 | Tiên Tri | 4 |
| 8 | 2 | Tiên Tri, Bảo Vệ | 4 |
| 9 | 2 | Tiên Tri, Bảo Vệ, Phù Thủy | 4 |
| 10 | 3 | Tiên Tri, Bảo Vệ | 5 |
| 11 | 3 | Tiên Tri, Bảo Vệ, Phù Thủy | 5 |
| 12 | 3 | Tiên Tri, Bảo Vệ, Phù Thủy | 6 |

Bảng vai cố định, chưa có preset Nhanh/Tiêu chuẩn hay tùy chỉnh vai **[Chưa làm]**. Thẻ "Cài đặt phòng" ở sảnh hiển thị bảng vai tính theo số người hiện có (kể cả bot).

## 5. Luồng toàn ván **[Đã có]**

```text
Trang chủ Ma Sói (tạo phòng / nhập mã / chọn từ danh sách phòng)
→ Nhập tên
→ Sảnh chờ (cài đặt, chat, sẵn sàng)
→ Xem vai bí mật
→ Đêm (thăm dò → chốt → quyết định cuối)
→ Bình minh
→ Thảo luận
→ Bỏ phiếu
→ Kết quả bỏ phiếu ("xử bắn")
→ Kiểm tra thắng
→ Đêm tiếp theo hoặc Kết thúc
```

## 6. Trang chủ và vào phòng **[Đã có]**

- Trang chủ Ma Sói: tạo phòng mới, nhập mã phòng, cách chơi 3 bước, danh sách phòng.
- **Danh sách phòng:** mã phòng, tên chủ phòng, số người, nhãn **Đang chờ** hoặc **Đang chơi**; tự làm mới 4 giây và có nút "Làm mới". Phòng không còn người kết nối thì biến mất. Số người chỉ tính người thật.
- Màn nhập tên: mã phòng dạng vé, avatar của người chơi, nút "Vào làng" (khóa khi chưa nhập tên).
- **Không cho vào giữa ván:** người mới vào phòng đang chơi thấy "Ngôi làng này đang yên ổn, bạn đừng vào :)))" kèm nút về sảnh. Người đã rời quá 30 giây cũng bị chặn như vậy.

## 7. Sảnh chờ **[Đã có]**

- Danh sách người chơi và trạng thái sẵn sàng.
- **Thẻ "Cài đặt phòng"** cho mọi người: bảng vai, và (với người không phải chủ phòng) thời gian thảo luận, bỏ phiếu, lộ vai khi chết, Phù Thủy tự cứu.
- **Chủ phòng chỉnh được:** thời gian thảo luận (60/120/180s), bỏ phiếu (20/30/45s), số bot, lộ vai khi chết, Phù Thủy tự cứu mình.
- **Chat sảnh** cho mọi người, kèm thông báo hệ thống: "X đã vào làng", "X đã rời làng", "X trở thành chủ phòng". Chat sảnh bị xóa khi ván bắt đầu.
- Chỉ bắt đầu khi có ít nhất 5 người (người thật + bot) và mọi người thật đã Sẵn sàng.
- Chưa có: preset thời gian, bật/tắt vai đặc biệt, phòng riêng tư/công khai, kick người chơi **[Chưa làm]**.

## 8. Bot lấp chỗ trống **[Đã có]**

- Chủ phòng chọn số bot; bot vào làng khi ván bắt đầu, tên có 🤖.
- Bot chơi theo luật đơn giản: đủ hành động đêm theo vai (sói chọn chung nạn nhân, tiên tri soi người chưa soi, bảo vệ che chở, phù thủy cứu/giết theo xác suất), chat 2–3 câu mỗi ngày bằng câu soạn sẵn, phản hồi khi bị nhắc tên, tiên tri bot công bố khi soi trúng sói, bỏ phiếu theo độ "nóng" trong chat và dư luận đêm.
- Bot tự xác nhận vai và tự bấm tiếp tục ở màn kết quả; không chặn việc bỏ qua bước đêm.
- **Ván có bot không lưu vào lịch sử.**
- Bot chat bằng AI (Claude) **[Chưa làm]** — đã cân nhắc, chi phí ước tính vài cent đến ~1 USD mỗi ván tùy cách gọi.

## 9. Xem vai bí mật **[Đã có]**

- Thẻ "Nhấn giữ để xem vai": giữ để xem, thả tay thì đóng.
- Sói thấy tên đồng đội.
- Bấm "Đã hiểu vai"; pha kết thúc khi tất cả xác nhận hoặc hết 30 giây.
- Màu vai chỉ nằm trong thẻ nhỏ, không đổi màu nền toàn màn hình.
- Bất kỳ lúc nào sau đó, nút "Vai của tôi" mở lại thẻ vai.

## 10. Pha đêm **[Đã có]**

Tổng 40 giây theo cấu trúc **20 + 5 + 15**, cố định trong MVP:

1. **Thăm dò (20s):** ai cũng chọn/đổi mục tiêu không giới hạn. Dân và Phù Thủy dùng lựa chọn làm ghi chú nghi ngờ; Sói thấy mục tiêu tạm của đồng đội; Tiên Tri/Bảo Vệ chọn thử.
2. **Sói chốt (5s):** Sói khóa nạn nhân; Tiên Tri/Bảo Vệ có thể khóa. Hòa thì server chọn ngẫu nhiên; không ai chọn thì đêm đó Sói không tấn công.
3. **Quyết định cuối (15s):** mục tiêu Sói đã khóa; Phù Thủy thấy nạn nhân và chọn Cứu / Đầu độc / Không làm gì; mọi người cập nhật "Note nghi ngờ cá nhân".

**Bỏ qua sớm:** mỗi bước có nút **"Xong, sang bước tiếp"**, giống hệt nhau cho mọi vai. Khi tất cả người thật còn sống và đang kết nối đã bấm, đêm chuyển bước ngay (nước đi bot còn chờ được chạy ngay). Giao diện **không hiện ai đã bấm** để không lộ ai còn đang quyết định.

Người chết vẫn thấy màn đêm tương tự (hành động giả, kết quả bị bỏ qua).

## 11. Dư luận và sổ nghi ngờ **[Đã có — khác v1]**

- **Dư luận sau đêm (công khai, tổng hợp):** sau mỗi đêm, phần "Dư luận sau đêm N — Ai đang bị cả làng nghi ngờ?" hiện xếp hạng theo % phiếu nghi ngờ, ẩn danh người ghi. Trình bày như một cảnh báo (đỏ, 🚨, người đứng đầu nổi bật) và luôn hiện ở màn Thảo luận.
- **Sổ nghi ngờ cá nhân (riêng tư):** kết quả soi của Tiên Tri và biểu đồ những người mình đã nghi qua các đêm. Nằm trong tab "Ghi chú riêng" (mobile) hoặc cột bên phải (desktop).
- Cuối ván có "Bảng phong thần": ai suýt bị xử nhiều nhất (đêm + ngày ×2).
- Nhãn nhanh cho ghi chú (Mâu thuẫn, Quá im lặng…) **[Chưa làm]**.

## 12. Bình minh **[Đã có]**

- 8 giây, cố định, chưa có nút bỏ qua.
- Hiện "Không ai chết" hoặc thông báo tử vong; nếu bật, lật vai người chết. Không giải thích nguyên nhân.
- Kèm phần dư luận sau đêm.

## 13. Thảo luận **[Đã có]**

- **Chat trong ứng dụng** là kênh chính. Người chết không chat được.
- Thời lượng theo cài đặt chủ phòng (60/120/180s, mặc định 120s). Chủ phòng bấm "Chuyển sang bỏ phiếu" để kết thúc sớm.
- Bố cục: chat cuộn bên trong; từ màn rộng chia 2 cột (chat | dư luận + ghi chú riêng); màn hẹp có dư luận ghim trên và tab Thảo luận / Ghi chú riêng.
- Đếm ngược "tick" ở 10 giây cuối.

## 14. Bỏ phiếu **[Đã có]**

- Chỉ người còn sống được bỏ phiếu; không tự bầu mình.
- Chọn tên là phiếu được ghi nhận ngay; có nút **"Xác nhận bầu X"** để chốt kèm lý do. Bấm lại tên đã chọn để rút phiếu. Không chọn ai = bỏ phiếu trắng. Đổi được đến hết giờ.
- **Lý do (tùy chọn, tối đa 120 ký tự)**, tự lưu và gửi kèm khi xác nhận.
- Hiển thị tiến độ "Đã bỏ phiếu n/m" (chỉ ai đã bỏ, không lộ bầu cho ai).
- Chủ phòng có nút **"← Quay lại thảo luận"** nếu lỡ bấm; quay về với thời gian còn lại (tối thiểu 30 giây), phiếu đã bỏ được giữ.
- Đếm ngược "tick" ở 10 giây cuối.
- Thời lượng theo cài đặt (20/30/45s, mặc định 30s).

## 15. Kết quả bỏ phiếu **[Đã có]**

- Người nhiều phiếu nhất bị **xử bắn** (từ thống nhất toàn game). **Hòa hoặc không có phiếu hợp lệ: không ai bị xử bắn.** Chưa có vòng biện hộ và bỏ phiếu lại **[Chưa làm]**.
- **Phiếu công khai sau khi đóng:** bảng "Ai đã bầu ai?" nhóm theo người bị bầu, mỗi phiếu kèm lý do. Người bị bầu có 🎯 và viền đỏ; người bị xử bắn có nhãn ☠️; người bầu là chip riêng kèm 🗳️; phiếu của bạn có chữ "Bạn"; người không bầu được liệt kê riêng.
- Thời lượng 15 giây, có nút **"Đã đọc xong, tiếp tục"** kèm "n/m người sẵn sàng". Khi mọi người còn sống và đang kết nối đều bấm, ván sang đêm ngay.

## 16. Điều kiện thắng **[Đã có]**

- Dân thắng khi không còn Sói sống.
- Sói thắng khi số Sói sống **bằng hoặc nhiều hơn** số người phe Dân sống.
- Kiểm tra sau khi giải quyết đêm, sau khi xử bắn ban ngày, và sau khi có người bị xóa khỏi phòng.
- Màn kết thúc lộ mọi vai, dòng thời gian, bảng phong thần, nút "Chơi ván mới" (chủ phòng) và liên kết lịch sử trận.

## 17. Người chết và khán giả **[Đã có]**

- Người chết chỉ theo dõi: không chat, không bỏ phiếu, không dùng kỹ năng. Banner "👻 Bạn đã chết — chỉ được theo dõi…".
- **Hồn ma biết vai của mọi người:** thanh "Ngôi làng" hiện icon vai cạnh mỗi tên. Thông tin này chỉ gửi cho người đã chết, không gửi cho người sống.
- Lộ vai công khai khi chết là tùy chọn của chủ phòng (mặc định bật). Khi tắt, chỉ hồn ma biết.
- Chat riêng giữa người chết **[Chưa làm]**.

## 18. Mất kết nối và rời phòng **[Đã có]**

- Ngắt kết nối (mất mạng, đóng tab, "Rời phòng") có **30 giây** để vào lại; vào lại bằng cùng trình duyệt thì giữ nguyên chỗ. Làm mới trang không bị tính là ngắt kết nối.
- **Thông báo công khai:** "📡 X đã mất kết nối — còn 27s để hồi sinh" (nhiều người thì gộp một banner, mỗi người một đếm ngược, chiều cao giới hạn).
- Quá 30 giây: người chơi bị **xóa âm thầm** (không lộ vai, không thông báo tử vong; ở sảnh thì giải phóng chỗ) và điều kiện thắng được kiểm tra lại. Sau khi ván kết thúc thì họ vẫn ở lại để màn lộ vai đủ người.
- Chủ phòng ngắt kết nối: quyền chủ phòng chuyển ngay sang người khác đang online.
- Nếu người chưa xác nhận vai hoặc chưa bấm tiếp tục bị ngắt, game kiểm tra lại và chuyển tiếp.
- Khi không còn người thật, phòng đang chơi tự đóng.
- Đánh dấu AFK và kick **[Chưa làm]**.

## 19. Giao diện **[Đã có]**

- **Giao diện theo ngày/đêm:** pha đêm (gồm cả xem vai) dùng tông tối "ma mị" với nền trăng; các pha ngày dùng tông sáng. Theo pha của game, không theo giao diện hệ thống. Font tiêu đề Playfair Display, nội dung Manrope (có tiếng Việt).
- **Khung cố định:** thanh "Ngôi làng" ngang phía trên (avatar, tên, 👑 chủ phòng, icon vai của người chết, chấm vàng khi mất kết nối, nút Rời phòng); bên dưới là khung pha cuộn bên trong, không làm trang tràn. Trên mobile trang tự cuộn.
- Từ khóa thiết kế: bo góc lớn, thẻ nổi, banner thông báo gọn.
- Đánh dấu 🐺 cho đồng đội Sói trong lưới chọn mục tiêu, cả ban đêm lẫn lúc bỏ phiếu ban ngày.
- Trang "View as" (`/werewolf/preview`) là công cụ thiết kế: chọn vai, cảnh, kích thước màn hình và nghe thử âm thanh của cảnh.
- Bottom sheet cho chat/sổ, màn hình chung tùy chọn **[Chưa làm]**.

## 20. Âm thanh **[Đã có]**

- **Nhạc nền lặp:** sảnh (`nhac-ngoai-sanh`), đêm và xem vai (`ban-dem`), ngày gồm bình minh, thảo luận, bỏ phiếu, kết quả (`ban-ngay`); chuyển cảnh mượt.
- **Tiếng sự kiện:** sói hú (`soi-hu`) khi bình minh có người chết; tiếng xử án (`dan-lang-xu-ban`) khi có người bị xử bắn; nhạc kết thúc (`end-game`); chuông trầm khi đêm bắt đầu (tổng hợp bằng code). Nhạc nền nhỏ đi khi có tiếng sự kiện.
- **Hiệu ứng giao diện:** tiếng bấm nút, tiếng gõ phím ở ô chat/lý do, tiếng "pop" khi người khác nhắn hoặc có thông báo sảnh, tiếng "tick" ở 10 giây cuối thảo luận và bỏ phiếu.
- Không có âm thanh riêng theo vai; mọi người nghe cùng một soundtrack.
- Nút bật/tắt âm thanh chung điều khiển tất cả; nút nhạc tổng hợp 🎶 bị ẩn trong Ma Sói.
- Giọng quản trò dẫn truyện **[Chưa làm]** (đề xuất: Web Speech hoặc file thu sẵn; câu ban đêm phải chung chung để không lộ vai). Âm riêng cho từng phe thắng **[Chưa làm]**.

## 21. Lịch sử ván **[Đã có]**

- Ván không có bot được lưu vào lịch sử chung, xem ở "Lịch sử trận đấu" (tab Ma Sói).
- Có thể xóa từng trận hoặc toàn bộ lịch sử một game; cần mật khẩu, được kiểm tra trên server (biến môi trường `HISTORY_DELETE_PASSWORD`).

## 22. Thời gian mặc định

| Pha | Thời lượng | Ghi chú |
|---|---:|---|
| Xem vai | 30s | Tự chuyển khi mọi người xác nhận. |
| Đêm | 20 + 5 + 15s | Cố định; bỏ qua sớm bằng nút "Xong". |
| Bình minh | 8s | Cố định. |
| Thảo luận | 60 / 120 / 180s | Mặc định 120s. |
| Bỏ phiếu | 20 / 30 / 45s | Mặc định 30s. |
| Kết quả bỏ phiếu | 15s | Tự chuyển khi mọi người bấm tiếp tục. |
| Vào lại sau mất kết nối | 30s | Sau đó bị xóa khỏi phòng. |

## 23. Tiêu chí UX thành công

- Người mới hiểu việc cần làm trong vòng 10 giây sau khi pha bắt đầu.
- Người ngồi cách 1–2 mét không nhận biết vai qua bố cục/màu màn hình.
- Không có màn nào buộc cuộn cả trang để xem nội dung chính trên desktop.
- Mọi người tương tác đến hết pha đêm mà không phải giả vờ thủ công.
- Phiếu bầu và lý do đủ rõ để tạo tranh luận ngay sau khi công bố.
- Một ván 8 người hoàn thành trong khoảng 15–30 phút.

## 24. Ngoài phạm vi hiện tại

- Voice/video tích hợp giữa người chơi.
- Matchmaking xếp hạng, tài khoản, bạn bè.
- Vai trung lập, Cupid, Thợ Săn, Kẻ Ngốc.
- Bot chat bằng AI (đang ở dạng ý tưởng).
- Vòng biện hộ và bỏ phiếu lại khi hòa.
- Phòng riêng tư, kick người chơi, đánh dấu AFK.
