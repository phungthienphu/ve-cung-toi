# Ma Sói Cùng Phòng — Game Design Specification

**Trạng thái:** Draft v1  
**Đối tượng:** Product Designer, Game Designer, UI/UX Designer  
**Nền tảng:** Web responsive, ưu tiên điện thoại  
**Số người:** 5–12 người  
**Bối cảnh chính:** Nhóm bạn ngồi trong cùng văn phòng/phòng họp, mỗi người dùng thiết bị riêng

## 1. Tầm nhìn sản phẩm

Ma Sói Cùng Phòng là game suy luận xã hội chơi trên trình duyệt. Điểm khác biệt chính là mọi người đều tương tác trong suốt pha đêm, nhờ đó tiếng chuột, bàn phím và thời gian thao tác không dễ làm lộ vai trò.

Game không thay thế phần trò chuyện trực tiếp. Thiết bị chỉ đảm nhiệm:

- Chia vai và bảo mật thông tin.
- Điều phối các pha và đồng hồ.
- Nhận hành động bí mật.
- Giải quyết luật và công bố kết quả.
- Bỏ phiếu, ghi chú và lưu lịch sử ván.

## 2. Nguyên tắc thiết kế

1. **Ai cũng có việc để làm:** mọi người tương tác đến hết pha đêm, kể cả Dân và người đã chết.
2. **Giao diện không tố cáo vai trò:** bố cục, số lần chuyển màn hình và chuyển động chính gần giống nhau giữa các vai.
3. **Server là quản trò:** không cần một người biết toàn bộ vai để điều hành.
4. **Thông tin bí mật chỉ xuất hiện khi cần:** vai trò và kết quả riêng được che mặc định.
5. **Thảo luận ngoài đời là trung tâm:** ứng dụng không làm người chơi chú ý vào màn hình quá lâu vào ban ngày.
6. **Không loại bỏ hoàn toàn tín hiệu xã hội:** game chỉ hạn chế tín hiệu kỹ thuật; nét mặt và cách tranh luận vẫn là một phần của Ma Sói.

## 3. Đối tượng và điều kiện chơi

- Nhóm 5–12 người quen biết nhau.
- Một người tạo phòng, những người khác vào bằng QR, link hoặc mã phòng.
- Mỗi người dùng một điện thoại hoặc laptop riêng; điện thoại là trải nghiệm ưu tiên.
- Thiết bị nên để im lặng và giảm độ sáng nếu ngồi gần nhau.
- Một màn hình chung là tùy chọn, dùng để hiện đồng hồ và sự kiện công khai, tuyệt đối không hiện thông tin vai.

## 4. Bộ vai MVP

### Dân Làng

- Phe: Dân.
- Ban đêm: chọn người mình nghi là Sói và cập nhật sổ nghi ngờ cá nhân.
- Ban ngày: thảo luận và bỏ phiếu.

### Ma Sói

- Phe: Sói.
- Biết những Sói còn lại.
- Ban đêm: cùng đồng đội chọn một nạn nhân.
- Thấy lựa chọn tạm thời và lựa chọn đã chốt của đồng đội.

### Tiên Tri

- Phe: Dân.
- Mỗi đêm chọn một người còn sống để soi.
- Cuối đêm nhận kết quả `Thuộc phe Sói` hoặc `Không thuộc phe Sói`.
- Kết quả không xuất hiện ngay lúc chọn để tránh phản ứng làm lộ vai.

### Bảo Vệ

- Phe: Dân.
- Mỗi đêm chọn một người để bảo vệ khỏi đòn cắn của Sói.
- Không bảo vệ cùng một người hai đêm liên tiếp.
- Không chặn bình độc của Phù Thủy.

### Phù Thủy

- Phe: Dân.
- Có một bình cứu và một bình độc, mỗi bình dùng tối đa một lần trong cả ván.
- Từ giây 25 của pha đêm, biết nạn nhân bị Sói nhắm đến.
- Mỗi đêm chỉ được dùng tối đa một bình.
- Nếu dùng độc, có thể chọn mục tiêu trong 15 giây cuối.
- Hết giờ mà không chốt được hiểu là không sử dụng bình.

## 5. Phân bổ vai đề xuất

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

Preset có thể chỉnh, nhưng UI phải cảnh báo khi cấu hình khiến một phe quá mạnh.

## 6. Luồng toàn ván

```text
Tạo/tham gia phòng
→ Phòng chờ và cấu hình
→ Xem vai bí mật
→ Đêm
→ Bình minh
→ Thảo luận
→ Bỏ phiếu
→ Kết quả bỏ phiếu
→ Kiểm tra thắng
→ Đêm tiếp theo hoặc kết thúc
```

## 7. Phòng chờ

Chủ phòng có thể:

- Chọn preset Nhanh, Tiêu chuẩn hoặc Tùy chỉnh.
- Bật/tắt vai đặc biệt.
- Chọn thời gian thảo luận và bỏ phiếu.
- Chọn công khai hay ẩn vai của người chết.
- Cho phép hoặc không cho phép Phù Thủy tự cứu.
- Chọn phòng riêng tư hoặc công khai.
- Kick người chơi trước khi bắt đầu.

Mỗi người phải ở trạng thái `Sẵn sàng`. Chỉ bắt đầu khi có ít nhất 5 người và cấu hình hợp lệ.

## 8. Xem vai bí mật

- Vai được che bởi một thẻ `Giữ để xem vai`.
- Người chơi phải giữ nút để xem, thả tay thì thẻ đóng lại.
- Thẻ hiển thị tên vai, phe, mục tiêu và mô tả hành động ngắn.
- Sói thấy tên đồng đội.
- Mỗi người bấm `Đã hiểu` sau khi xem.
- Pha tự kết thúc khi tất cả đã sẵn sàng hoặc hết 30 giây.

Không dùng màu nền toàn màn hình khác nhau theo vai. Màu vai chỉ xuất hiện bên trong thẻ nhỏ để hạn chế nhìn trộm từ xa.

## 9. Pha đêm 40 giây

### 9.1. Giây 00–20: thăm dò

Tất cả người còn sống đều có cùng cấu trúc màn hình:

- Danh sách người còn sống.
- Một người đang được chọn.
- Đồng hồ.
- Câu hướng dẫn theo vai.
- Thẻ vai thu gọn ở góc.

Trong 20 giây này:

- Người chơi chọn và đổi mục tiêu không giới hạn.
- Chưa có lựa chọn nào là chính thức.
- Dân dùng lựa chọn để ghi người đang nghi ngờ.
- Sói thấy mục tiêu hiện tại của đồng đội theo thời gian thực.
- Tiên Tri, Bảo Vệ chọn thử mục tiêu kỹ năng.
- Phù Thủy chọn người nghi ngờ; lựa chọn này đồng thời là mục tiêu mặc định nếu sau đó muốn dùng độc.

### 9.2. Giây 20–25: Sói chốt nạn nhân

- Sói có 5 giây để chốt.
- Sói thấy lựa chọn của đồng đội và trạng thái đã chốt/chưa chốt.
- Người không phải Sói tiếp tục chỉnh lựa chọn như bình thường.
- Giao diện của tất cả người chơi đều có thay đổi nhỏ tại giây 20 để không lộ riêng màn hình Sói.

Quy tắc chọn nạn nhân:

- Đa số Sói cùng chọn một người: người đó là nạn nhân.
- Hòa: server chọn ngẫu nhiên giữa các mục tiêu hòa.
- Sói không chốt: dùng mục tiêu cuối của giai đoạn thăm dò.
- Không có bất kỳ mục tiêu nào: đêm đó Sói không tấn công.

### 9.3. Giây 25–40: phản ứng và chốt

- Mục tiêu Sói đã bị khóa và không thể đổi.
- Phù Thủy thấy nạn nhân và chọn cứu, đầu độc hoặc không hành động.
- Tiên Tri và Bảo Vệ tiếp tục chọn đến hết giây 40.
- Dân tiếp tục cập nhật sổ nghi ngờ.
- Sói chuyển sang hoạt động nghi ngờ/ghi chú giả để vẫn có lý do tương tác.
- Người chết có màn hình tương tác giả tương tự, nhưng kết quả bị bỏ qua.

Tại giây 40, server khóa mọi lựa chọn và giải quyết đêm cùng lúc.

## 10. Sổ nghi ngờ cá nhân

Sổ nghi ngờ là công cụ riêng, không phải biểu đồ công khai của cả làng.

Mỗi đêm, người chơi có thể:

- Chọn một người đáng ngờ nhất.
- Gắn một nhãn nhanh: `Mâu thuẫn`, `Quá im lặng`, `Bỏ phiếu lạ`, `Đang bao che`, `Chưa rõ`.
- Xem lại lựa chọn của chính mình từ các đêm trước.

Ví dụ:

| Người | Đêm 1 | Đêm 2 | Đêm 3 |
|---|---|---|---|
| An | Chưa rõ | Nghi ngờ | Nghi ngờ |
| Bình | Nghi ngờ | Nghi ngờ | — |
| Chi | — | — | Nghi ngờ |

Sổ không được chia sẻ tự động. Người chơi tự quyết định có nói nội dung đó trong thảo luận hay không. Sau khi ván kết thúc, game có thể dùng dữ liệu này để tạo recap vui.

## 11. Bình minh

- Tất cả thiết bị chuyển pha cùng lúc.
- Hiện `Không ai chết` hoặc danh sách người chết.
- Nếu cấu hình công khai vai, lật vai người chết sau một animation ngắn.
- Không giải thích nguyên nhân sống/chết; ví dụ không nói rõ người đó được Bảo Vệ hay Phù Thủy cứu.
- Thời lượng đề xuất: 8 giây.

## 12. Thảo luận ban ngày

- Người chơi trò chuyện trực tiếp; ứng dụng chủ yếu hiển thị đồng hồ và danh sách người sống.
- Chat trong ứng dụng là tùy chọn, dành cho nhóm chơi từ xa hoặc hỗ trợ tiếp cận.
- Người chết không được nói hoặc gửi chat cho người sống.
- Chủ phòng có thể cộng 30 giây hoặc kết thúc thảo luận sớm.
- Thời lượng mặc định: 180 giây.

## 13. Bỏ phiếu

- Chỉ người còn sống được bỏ phiếu.
- Không được tự bỏ phiếu cho mình.
- Phiếu được giữ kín cho đến hết pha.
- Có thể đổi phiếu cho tới khi hết giờ.
- Hết giờ mà chưa chọn được tính là phiếu trắng.
- Người nhiều phiếu nhất bị loại.

Nếu hòa:

1. Các ứng viên hòa có 20 giây biện hộ.
2. Người còn lại bỏ phiếu lại trong 20 giây.
3. Nếu tiếp tục hòa, không ai bị loại.

## 14. Điều kiện thắng

- Phe Dân thắng khi không còn Sói sống.
- Phe Sói thắng khi số Sói sống bằng hoặc nhiều hơn tổng số người phe Dân còn sống.
- Điều kiện thắng được kiểm tra sau khi giải quyết đêm và sau khi loại người ban ngày.
- Không kết thúc giữa một animation; chuyển sang màn hình kết quả chung.

## 15. Người chết và khán giả

- Người chết vẫn đi qua cùng các pha để hạn chế lộ hành vi của người còn sống.
- Hành động ban đêm của họ là giả và không ảnh hưởng kết quả.
- Người chết có thể chat riêng với nhau nếu chủ phòng bật tùy chọn này.
- Người vào phòng giữa ván trở thành khán giả và không được xem vai người sống.
- Khán giả chỉ được tham gia từ ván sau.

## 16. Mất kết nối và AFK

- Giữ chỗ cho người chơi mất kết nối trong 90 giây.
- Khi quay lại, họ nhận lại vai, thông tin riêng và pha hiện tại.
- Nếu hết hạn hành động khi offline, áp dụng hành động mặc định của vai.
- Người bỏ lỡ hai pha liên tiếp được đánh dấu AFK.
- Host chỉ được kick người AFK ở điểm chuyển pha an toàn.
- Nếu host rời phòng, quyền host chuyển cho người kết nối lâu nhất.

## 17. UI responsive

### Mobile

- Đồng hồ cố định phía trên.
- Danh sách mục tiêu là grid hai cột.
- Nút hành động chính cố định phía dưới.
- Chat và sổ nghi ngờ mở bằng bottom sheet.
- Vùng chạm tối thiểu 44×44 px.

### Desktop

- Trung tâm: hướng dẫn pha và danh sách người.
- Bên phải: trạng thái người chơi/chat.
- Bên trái: lịch sử công khai và sổ cá nhân.
- Không dùng layout khác nhau đáng kể giữa các vai.

## 18. Âm thanh và chuyển động

- Không có âm thanh riêng theo vai.
- Âm thanh chuyển pha giống nhau trên mọi thiết bị.
- Rung phản hồi phải giống nhau cho hành động thật và giả.
- Animation xác nhận có cùng thời lượng.
- Có chế độ `Chơi cùng phòng` mặc định tắt toàn bộ âm thanh cá nhân.

## 19. Preset thời gian

| Pha | Nhanh | Tiêu chuẩn |
|---|---:|---:|
| Xem vai | 20s | 30s |
| Đêm | 40s | 40s |
| Bình minh | 6s | 8s |
| Thảo luận | 90s | 180s |
| Bỏ phiếu | 20s | 30s |
| Biện hộ khi hòa | 15s | 20s |

Pha đêm luôn giữ cấu trúc 20 + 5 + 15 giây, không cho host tùy chỉnh từng đoạn trong MVP.

## 20. Tiêu chí UX thành công

- Người mới hiểu việc cần làm trong vòng 10 giây sau khi pha bắt đầu.
- Người ngồi cách 1–2 mét không thể nhận biết vai chỉ qua bố cục/màu màn hình.
- Mọi người có thể tương tác đến hết pha đêm mà không phải giả vờ thủ công.
- Không có thông tin bí mật xuất hiện trên màn hình chung.
- Một ván 8 người hoàn thành trong khoảng 15–30 phút.

## 21. Ngoài phạm vi MVP

- Voice/video tích hợp.
- Matchmaking xếp hạng.
- Tài khoản và hệ thống bạn bè.
- Vai trung lập, Cupid, Thợ Săn và Kẻ Ngốc.
- Mỹ phẩm, tiền tệ hoặc shop.
- AI quản trò hoặc AI phân tích lời nói.

