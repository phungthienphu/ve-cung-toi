# Hải Chiến — Spec & Game Play Flow

**Trạng thái:** v1 đã code (chưa chơi thử thật)  
**Đường dẫn:** `/battleship`  
**Số người:** 2–8, có bot  
**Chế độ:** Solo 1 vs 1, Hỗn chiến, Đồng đội

## 1. Ý tưởng

Trò Bắn Tàu nhiều người chơi trên trình duyệt: mỗi người (hoặc mỗi đội) giấu hạm đội trên lưới ô vuông, rồi đoán tọa độ và nã pháo vào lưới đối thủ. Mất hết tàu là thua. Tàu và lưới vẽ bằng canvas, không cần file ảnh.

## 2. Ba chế độ

| | Solo | Hỗn chiến | Đồng đội |
|---|---|---|---|
| Số người | đúng 2 (1 người thì tự thêm 1 bot) | 3–8 | 2 đội, mỗi đội 1–4 |
| Lưới | 10×10 mỗi người | 8×8 mỗi người | 10×10 mỗi đội (chung) |
| Hạm đội | 5 tàu: 5, 4, 3, 3, 2 ô | 4 tàu: 4, 3, 3, 2 ô | 5 tàu: 5, 4, 3, 3, 2 ô |
| Cách bắn | lần lượt, mỗi lượt 1 phát | theo vòng, mọi người bắn cùng lúc | theo vòng, cả đội bắn cùng lúc |
| Thắng khi | đánh chìm hết tàu đối thủ | là người cuối cùng còn tàu | đánh chìm hết tàu đội kia |

Tàu: Tàu sân bay (5), Thiết giáp hạm (4), Tuần dương hạm (3), Tàu ngầm (3), Khu trục hạm (2). Hỗn chiến bỏ tàu sân bay.

## 3. Game play flow tổng

```text
Trang chủ Hải Chiến ──► Tạo phòng / Nhập mã / Chọn phòng trong danh sách
        │
        ▼
Nhập tên thuyền trưởng ──► (ván đang chơi thì bị chặn: "Trận đang diễn ra, chờ ván sau nhé")
        │
        ▼
SẢNH CHỜ
  • chủ phòng chọn chế độ + cài đặt, người khác bấm Sẵn sàng
  • chat sảnh, thông báo "X đã lên tàu / rời tàu"
        │  chủ phòng bấm "Ra khơi!" (kiểm tra đủ người)
        ▼
XẾP TÀU (60 giây)
  • server phát sẵn một cách xếp ngẫu nhiên hợp lệ
  • người chơi sửa lại hoặc bấm Ngẫu nhiên, rồi bấm "Xếp xong"
  • mọi người xếp xong → vào trận ngay; hết giờ → giữ nguyên cách xếp hiện tại
        │
        ▼
GIAO TRANH  (Solo: theo lượt  ·  Hỗn chiến / Đồng đội: theo vòng)
        │  một phe/người còn lại
        ▼
KẾT THÚC
  • người/đội thắng, bảng xếp hạng + thống kê
  • lộ toàn bộ hạm đội
  • chủ phòng bấm "Chơi ván mới" → về Sảnh chờ (giữ người, bỏ bot và người đã rời)
```

## 4. Sảnh chờ

- **Chủ phòng chỉnh:**
  - Chế độ: Solo / Hỗn chiến / Đồng đội.
  - Thời gian mỗi lượt/vòng: 10 / 15 / 20 giây (mặc định 15).
  - Tàu không được đặt sát nhau, kể cả chéo (mặc định bật).
  - Bắn trúng được bắn tiếp (chỉ Solo, mặc định bật).
  - Số bot (Hỗn chiến, Đồng đội) và độ khó bot (Dễ / Thường).
- Người khác thấy các cài đặt nhưng không đổi được.
- **Đồng đội:** chia 2 cột Xanh / Đỏ, mỗi người tự chọn đội, chủ phòng có nút chia ngẫu nhiên. Bot tự vào đội ít người hơn.
- **Điều kiện "Ra khơi!":**
  - mọi người thật (trừ chủ phòng) đã Sẵn sàng;
  - Solo: đúng 2 người tính cả bot;
  - Hỗn chiến: ít nhất 3 người tính cả bot;
  - Đồng đội: mỗi đội 1–4 người và hai đội chênh nhau tối đa 1.

## 5. Xếp tàu

- Chạm một tàu để chọn (viền vàng), chạm một ô để chuyển tàu tới đó (ô chạm là đầu tàu, tự đẩy vào trong nếu tràn lưới). Nút **Xoay** đổi ngang/dọc, nút **Ngẫu nhiên** xếp lại cả hạm đội.
- Nước đi không hợp lệ (chồng tàu, sát tàu khi luật bật) bị từ chối kèm lời nhắc.
- **Đồng đội:** cả đội chung một hạm đội, ai cũng sửa được, thay đổi hiện ngay trên máy đồng đội.
- Bấm "Xếp xong" để sẵn sàng; bấm lại để sửa tiếp. Hiển thị "Sẵn sàng n/m".

## 6. Giao tranh — Solo

```text
Chọn ngẫu nhiên người bắn trước
  └─► LƯỢT của A (15s)
        ├─ A chọn một ô trên biển địch
        │    ├─ trúng / chìm tàu → nếu bật "trúng được bắn tiếp": A bắn tiếp (lượt mới 15s)
        │    │                     không bật: sang lượt B
        │    └─ trượt → sang lượt B
        ├─ hết giờ → A mất lượt, sang B
        └─ B hết tàu → A thắng
```

- Màn hình: **Biển địch** (bấm để bắn, có viền vàng khi tới lượt) và **Hạm đội của bạn** (thấy tàu mình và các phát đối thủ đã bắn).
- Nhật ký ghi từng phát: "Phú bắn C7: trúng! 💥".

## 7. Giao tranh — Hỗn chiến

```text
VÒNG n (15s)
  ├─ mỗi người còn tàu chọn MỘT đối thủ + MỘT ô, có thể đổi đến khi bấm "Khai hỏa"
  ├─ mọi người thật đã khai hỏa (bot tự bắn) HOẶC hết giờ
  ▼
GIẢI QUYẾT CÙNG LÚC
  ├─ mọi phát được tính một lượt; hai người bắn trúng cùng ô → cả hai được tính trúng
  ├─ tàu chìm trong vòng → mọi người đã bắn trúng tàu đó đều được tính "đánh chìm"
  ├─ ai hết tàu → bị loại (thứ hạng theo vòng bị loại)
  ▼
HIỆN KẾT QUẢ ~2 giây (hiệu ứng lửa/nước, âm thanh)
  ├─ còn ≥2 người có tàu → VÒNG n+1
  └─ còn 1 người → thắng · còn 0 (cùng chìm vòng cuối) → đồng hạng nhất
```

- **Chống "hội đồng":** mỗi vòng một lưới chỉ nhận tối đa **(số người còn tàu − 2)** phát, tối thiểu 1. Các tab đối thủ hiện "x/giới hạn ngắm"; tab đã đủ thì bắn vào sẽ bị từ chối.
- Không bấm "Khai hỏa" trước khi hết giờ thì ô đang ngắm vẫn được bắn; chưa ngắm thì mất phát vòng đó.
- **Bị loại:** chuyển sang chế độ xem, thấy vị trí tàu của mọi người, vẫn chat được.

## 8. Giao tranh — Đồng đội

- Giống Hỗn chiến nhưng mục tiêu cố định là lưới đội kia.
- Mỗi người 1 phát mỗi vòng. **Đội ít người hơn được bắn bù** để tổng phát mỗi vòng bằng đội kia (ví dụ 3 vs 2: bên 2 người có 1 người được 2 phát).
- Thấy ô đồng đội đang ngắm (chấm xanh ngọc) để tránh bắn trùng; chạm lại ô đã chọn để bỏ.
- Có **chat đội** riêng bên cạnh chat chung.
- Hai hạm đội cùng chìm trong một vòng → hòa.

## 9. Kết thúc

- Banner người/đội thắng.
- Bảng: hạng, tên, số phát bắn, tỉ lệ trúng, số tàu đánh chìm.
- Tất cả lưới lộ đủ vị trí tàu.
- Ván **không có bot** được lưu vào "Lịch sử trận đấu" (tab 🚢 Hải Chiến).

## 10. Bot

- **Dễ:** bắn ngẫu nhiên vào ô chưa bắn.
- **Thường:** trúng rồi thì bắn quanh ô trúng, thấy hai ô trúng thẳng hàng thì nối dài theo hàng đó cho đến khi tàu chìm; lúc chưa có manh mối thì bắn theo kiểu bàn cờ; khi luật "không sát nhau" bật thì bỏ qua các ô cạnh tàu đã chìm.
- Hỗn chiến: bot ưu tiên kết liễu tàu đang bị thương, sau đó nhắm người còn nhiều tàu nhất; luôn tuân giới hạn phát.
- Bot chỉ dùng thông tin công khai (ô đã bắn, tàu đã chìm), không nhìn trộm vị trí tàu.

## 11. Mất kết nối

- Có 30 giây để vào lại (cùng trình duyệt). Mọi người thấy "📡 X (27s) mất kết nối".
- Trong lúc mất kết nối: lượt Solo cứ chạy hết giờ; Hỗn chiến / Đồng đội thì không chặn vòng.
- Quá 30 giây:
  - Sảnh chờ: xóa khỏi phòng.
  - Solo: đối thủ thắng.
  - Hỗn chiến: bị loại (hạm đội bỏ lại).
  - Đồng đội: ngừng bắn cho đội; đội không còn ai thì thua.
- Chủ phòng thoát: quyền chủ phòng chuyển ngay cho người khác.
- Không còn người thật nào: phòng tự đóng.

## 12. Giao diện

- Nền biển xanh đêm (CSS), thẻ bo góc nhỏ.
- Lưới có tọa độ A–J / 1–10. Trượt: chấm trắng. Trúng: lửa trên nền đỏ sẫm. Tàu chìm: vẽ xác tàu màu xám.
- Hiệu ứng vòng tỏa khi đạn rơi (trắng: trượt, cam: trúng).
- Cột phải: danh sách thuyền trưởng và trạng thái, nhật ký trận, chat.
- Mobile: các khối xếp dọc; bàn cờ co theo bề ngang màn hình.

## 13. Âm thanh

Tiếng pháo mỗi khi bắn; tiếng nước (trượt), tiếng nổ (trúng), tiếng nổ lớn kèm tiếng chìm (tàu chìm); tiếng bấm nút; tiếng tick 5 giây cuối khi đang tới lượt bạn. Tất cả tổng hợp bằng code.

## 14. Kỹ thuật

- Server: `party/battleship-server.ts` (party `battleship`), danh sách phòng: `party/battleship-directory.ts` (party `battleshiplobby`) và `/api/battleship-rooms`.
- Luật dùng chung: `shared/battleshipTypes.ts` (kích thước lưới, hạm đội, kiểm tra xếp tàu, bot chọn ô).
- Client: `src/app/battleship/**`, `src/components/battleship/**`.
- Vị trí tàu chỉ gửi cho chủ tàu / đội mình; người khác chỉ nhận ô đã bắn và tàu đã chìm.

## 15. Để sau (v2)

- Vật phẩm: radar, bom chùm, pháo tầm xa, khiên.
- Bot tiếp quản người rời trận.
- Tranh nền/nhân vật heo con hải tặc.
