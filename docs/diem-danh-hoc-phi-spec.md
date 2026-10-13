# Điểm danh & học phí — spec v2 [Đã có — chưa dùng thật]

Tab mới trong **Trang gia sư** (`/math-quest/tutor`) thay cho Google Sheet "Dạy". Gia sư tích điểm danh ngay trong ngày dạy, rồi chốt đợt thu để gửi phụ huynh.

## 0. Bảng tính hiện tại cho thấy gì

Đọc từ sheet "Dạy" (tab *Nhật + Vinh*, *Hoàng*):

| Quan sát trong sheet | Nghĩa là hệ thống cần |
|---|---|
| Mỗi tab là một **nhóm học** ("Nhật + Vinh" học chung) chứ không phải một bé | Đơn vị tính tiền là **Lớp** (1 hoặc nhiều bé), không phải từng học sinh |
| Ngày học rơi đều vào **T3 và T7** (4/10, 7/10, 11/10, 14/10…) | **Lịch cố định**: hệ thống tự hiện sẵn các buổi dự kiến, gia sư chỉ cần xác nhận |
| Giá đổi từ **140.000 → 200.000 từ 20/9**, ngay giữa một đợt thu | Giá có **ngày áp dụng**; buổi trước ngày đó giữ giá cũ |
| Có các buổi "Dạy thử" (đỏ, 0đ), "Nghỉ lễ" / "nghỉ" (cam, 0đ) | Mỗi buổi có **trạng thái**, không chỉ "có dạy / không dạy" |
| Buổi nghỉ vẫn được đánh số thứ tự (buổi 3 = nghỉ 8/11) | Danh sách buổi trong đợt gồm cả buổi nghỉ; buổi nghỉ không tính tiền |
| Đợt đầu tiên là **"Tháng 8+9"** (26/8 → 30/9), các đợt sau theo tháng | Đợt thu **không nhất thiết đúng một tháng lịch** |
| Ô tổng ghi "Done" khi phụ huynh đã trả | Mỗi đợt có trạng thái **Chưa trả / Đã trả** |
| Không có cột giờ | Số giờ chỉ là thông tin phụ (thống kê), **tiền tính theo buổi** |

## 1. Mục tiêu

- Sau buổi dạy, mở app và **1 chạm** là xong điểm danh. Hôm nghỉ thì 2 chạm.
- Không phải gõ ngày, không phải cộng tiền, không phải tô màu.
- Cuối tháng chỉ cần bấm **Chốt đợt thu** rồi **Sao chép tin nhắn** để gửi phụ huynh.
- Xem lại được toàn bộ lịch sử như sheet hiện tại.

## 2. Vị trí

- Trang gia sư có thêm thanh tab: **📚 Bài học** | **🗓️ Điểm danh & học phí** (`/math-quest/tutor/attendance`).
- Dùng chung mật khẩu gia sư. Lớp **độc lập với tài khoản Math Quest**: tạo lớp không cần PIN, và bé không cần dùng sổ tay.

## 3. Lớp

| Trường | Ví dụ |
|---|---|
| Tên lớp | "Nhật + Vinh", "Hoàng" — một lớp = một phụ huynh trả = một hóa đơn |
| Lịch cố định | T3, T7 (chọn các thứ trong tuần; có thể để trống) |
| Giờ 1 buổi | 1,5 giờ (chỉ để thống kê) |
| Học phí 1 buổi (cả lớp) | 250.000đ, **áp dụng từ** một ngày |
| Ngày bắt đầu | 26/8 (trước ngày này lịch không hiện buổi dự kiến) |
| Ngừng dạy | Bật lên thì lớp được ẩn khỏi lịch, lịch sử vẫn giữ |

**Đổi giá** nghĩa là thêm một mức giá mới kèm ngày áp dụng. Lịch sử giá hiện dạng "140.000đ từ 26/8 → 200.000đ từ 20/9". Mỗi buổi tự lấy mức giá đúng với ngày của nó. Buổi thuộc đợt đã chốt thì không bị tính lại.

## 4. Trạng thái một buổi

| Trạng thái | Màu (giống sheet) | Tính tiền | Ghi chú |
|---|---|---|---|
| **Dự kiến** | xám, viền nét đứt | — | Tự hiện theo lịch cố định, chưa có dữ liệu |
| **Đã dạy** | xanh lá | Có, theo giá của ngày đó | |
| **Dạy thử** | đỏ | Không (0đ) | |
| **Nghỉ** | cam | Không | Lý do: Lễ / Học sinh bận / Gia sư bận / Khác |

- Buổi "Đã dạy" vào ngày ngoài lịch cố định tự có nhãn **"bù"**.
- Mỗi buổi có thể ghi thêm **ghi chú** ("ôn giữa kỳ").
- Điểm danh theo **cả lớp**, không theo từng bé: một bé trong nhóm vắng thì buổi đó vẫn tính bình thường. Nghỉ thì **không bao giờ** tính tiền.
- Buổi dự kiến **chưa được điểm danh** thì không tính vào đâu cả. Buổi dự kiến đã qua mà chưa tích thì có chấm nhắc "Quên điểm danh?".

## 5. Lịch tháng

- Lưới 7 cột, tuần bắt đầu **Thứ 2**. Có nút `‹`, `›` và `Hôm nay`, cùng bộ lọc **Tất cả lớp / từng lớp**.
- Ô ngày hiện một viên màu cho mỗi buổi (tên lớp viết tắt và trạng thái). Trên điện thoại thì viên màu thu thành chấm.
- **Hôm nay luôn được chọn sẵn** và mở bảng điểm danh. Mỗi buổi dự kiến hôm nay có 3 nút lớn:
  **✓ Đã dạy** · **Nghỉ…** · **Dạy thử**.
- Bấm vào ngày khác để điểm danh bù (quên tích) hoặc thêm buổi **dạy bù** ngoài lịch.
- Phía trên lịch có thẻ **"Chưa điểm danh: 2 buổi"** nếu có buổi đã qua mà chưa tích. Bấm vào thì nhảy tới ngày đó.

## 6. Đợt thu (thay cho "tháng" trong sheet)

Mỗi lớp có danh sách đợt thu, xem như một bảng giống sheet:

```
Tháng 10 · 01/10 → 31/10                     1.600.000đ   ● Chưa trả
 #  Ngày          Trạng thái   Tiền
 1  T7 04/10      Đã dạy       200.000
 2  T3 07/10      Đã dạy       200.000
 3  T7 08/11      Nghỉ (Lễ)          —
 …
```

- **Đợt đang mở**: gồm mọi buổi chưa chốt của lớp. Tổng tiền tự cộng dần trong lúc dạy.
- **Chốt đợt thu**: chọn ngày kết thúc (mặc định là cuối tháng), đặt tên (mặc định "Tháng 10"). Các buổi tới ngày đó bị khóa vào đợt.
  - Đợt đầu tiên muốn gộp như "Tháng 8+9" thì chỉ cần chốt vào cuối tháng 9.
  - Chưa điểm danh hết các buổi dự kiến trong khoảng đó thì hệ thống cảnh báo trước khi chốt.
- Đợt đã chốt có nút **Đánh dấu đã trả** (lưu ngày trả) và **Mở lại** (khi cần sửa).
- **📋 Sao chép tin nhắn cho phụ huynh**:

  ```
  Chào anh/chị, em gửi học phí tháng 10 của Nhật và Vinh:
  - 8 buổi: 04/10, 07/10, 11/10, 14/10, 18/10, 21/10, 25/10, 28/10
  - Học phí: 8 buổi × 250.000đ = 2.000.000đ
  Anh/chị chuyển khoản giúp em nhé. Em cảm ơn ạ!
  ```

  Đợt có hai mức giá thì tin nhắn tách thành từng dòng (ví dụ "5 buổi × 140.000đ + 4 buổi × 200.000đ"). Đợt có buổi nghỉ thì thêm dòng "Nghỉ: 08/11 (lễ)".

## 7. Thống kê

- **Theo tháng** (mọi lớp): số buổi dạy, số giờ, tổng tiền đã thu và chưa thu.
- **Đang nợ**: các đợt đã chốt mà chưa trả, xếp từ cũ nhất. Đây là phần quan trọng nhất để nhắc phụ huynh.

## 8. Dữ liệu (MongoDB)

- `mq_classes`: `{ name, weekdays: number[], hoursPerSession, rates: [{ from: "YYYY-MM-DD", fee }], startDate, archived }`
- `mq_sessions`: `{ classId, date: "YYYY-MM-DD", status: taught|trial|off, offReason, hours, amount, note, invoiceId | null }`. Mỗi (lớp, ngày) chỉ một bản ghi. Ngày lưu dạng chuỗi nên không bị lệch múi giờ.
- `mq_invoices`: `{ classId, title, from, to, total, paidAt | null }`
- Buổi "Dự kiến" **không lưu**: hệ thống tính ra từ lịch cố định cho tới khi gia sư điểm danh.
- API: `GET/POST /api/math-quest/tutor/attendance`, chỉ gia sư đã đăng nhập mới dùng được.

## 9. Đã chốt với gia sư (13/10/2026)

1. "Nhật + Vinh" chung một phụ huynh. **250.000đ/buổi cho cả lớp** (200.000đ là giá cũ).
2. Một bé vắng thì buổi đó vẫn tính bình thường. Không điểm danh từng bé.
3. Nghỉ thì không bao giờ tính tiền.
4. Không nhập lịch sử từ Google Sheet. Bắt đầu mới.
5. Chưa cần số tài khoản hay QR trong tin nhắn.
6. Không nối với tài khoản Math Quest.

## 10. Ngoài phạm vi v1

- Phụ huynh tự đăng nhập xem điểm danh.
- Nhắc nhở tự động (thông báo "chưa điểm danh" hoặc "cuối tháng").
- Xuất Excel/PDF (tin nhắn copy đã đủ dùng).
- Số tài khoản / VietQR trong tin nhắn.
- Sửa tay số tiền từng buổi.
