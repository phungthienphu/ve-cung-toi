# Con Đường Hoàng Kim — giai đoạn 2

## Chơi thử

Trang `/con-duong-hoang-kim` và `/con-duong-hoang-kim/solo` đều có chọn xe, bản đồ và chế độ phá kỷ lục / đường hôm nay. Nhập tên trước khi chạy. Jeep có sẵn; con bọ / tải quái vật / xe buýt mở bằng 150 / 350 / 500 xu (giá tạm để cân bằng).

- A / ←: phanh và lùi. D / →: ga.
- **W / ↑: nhảy hoặc bật lật**, tốn 35⚡, hồi 0,6 giây. Chỉ nhảy khi chạm đất hoặc vừa rời đất dưới 0,15 giây; không nhảy đôi.
- **Space: lao tới**, tốn 25⚡, hồi 2 giây, tăng tối đa 8 m/s và giới hạn tốc độ tiến 30 m/s. Giữ phím không tự lặp. Có nút riêng trên điện thoại.
- P / Escape: tạm dừng, đổi tab cũng tự tạm dừng và nhả các nút.

Năng lượng hồi +2/s trên đất, +6/s trên không, +25 mỗi vòng lộn hợp lệ khi đáp bằng bánh, +40 khi nhặt bình xanh. Thưởng xu khi bay lâu, lộn vòng, tiếp đất êm và cứu xe. Kết quả có xu kỹ năng, kỷ lục mới và hạng đã đồng bộ.

Đồi chè dễ lái; Mũi Né bám kém và hao xăng hơn; Mã Pí Lèng có dốc cao, bậc đá; Mặt trăng trọng lực 1,6 m/s². Bốn xe có kích thước, khối lượng, bánh xe, động cơ và hình vẽ riêng.

## Lưu trữ và kết quả

- `shared/hillTypes.ts`, `hillTerrain.ts`, `hillSim.ts`: cấu hình, seed và toàn bộ luật mô phỏng 60 Hz; không phụ thuộc DOM.
- `src/lib/models/Hill.ts`: `HillRun`, `HillWallet`.
- `/api/hill/runs`: gửi lượt chạy; đọc bảng theo map/ngày; xếp hạng riêng từng mã máy, cùng quãng đường cùng hạng.
- `/api/hill/wallet`: đọc ví và mở xe. Cộng xu theo runId duy nhất; mở xe trừ xu và thêm xe bằng một cập nhật nguyên tử.
- `src/lib/hillProgress.ts`: kỷ lục trên máy, ví cache và hàng chờ đồng bộ. Lỗi tạm giữ lượt để thử lại; lượt bị từ chối (ví dụ bảng ngày đã khóa) được ghi riêng, không chặn các lượt sau.
- “Đường hôm nay” lấy ngày theo Asia/Ho_Chi_Minh, cùng seed cho mọi người. Qua ngày thì server khóa nhận lượt mới vào bảng ngày cũ.
- Cờ trên đường: kỷ lục của mình, người dẫn đầu và tối đa ba người gần hạng.

Bộ nhớ local dùng mã máy `vct_player_id` hiện có. Kỷ lục/xu khi offline chỉ trở thành dữ liệu trên server sau khi đồng bộ thành công. Giá mở xe do server kiểm tra; chưa chạy lại nhật ký input để chống gian lận (để sau theo spec).

## Kiểm tra

- `npx tsc --noEmit -p tsconfig.json`: đạt.
- `npx tsc --noEmit -p party/tsconfig.json`: đạt.
- `npm run lint`: đạt, còn warning cũ tại `SoccerGameRoom.tsx:105`.
- `node --import tsx scripts/hill-smoke.test.ts`: đạt.
- `node --import tsx scripts/hill-phase2.test.ts`: đạt. Kiểm tra 16 tổ hợp xe/bản đồ, nhảy/coyote/năng lượng/cứu xe, lao tới/hồi chiêu/tốc độ, đổi ngày Việt Nam, kiểm tra payload, hàng chờ offline và bảng ngày cũ.
- `scripts/hill-api.integration.ts`: đạt trên Next local + database **vct_hill_review_20261102**. Kiểm tra lưu/hạng, hai mã máy cùng tên, xe khóa, bảng ngày đóng, gửi trùng đồng thời không cộng xu hai lần và mua xe đồng thời không trừ hai lần. Script dọn đúng các mã máy kiểm thử do nó tạo.
- Trình duyệt local: chọn bản đồ và chế độ, Space lao tới (100→75⚡, có vận tốc và hồi chiêu), W nhảy, Canvas và HUD tại 390×844.
- `git diff --check`: đạt.

Server local cổng 3011 trong phiên review dùng database riêng nêu trên. Khi tự chạy môi trường khác, các API dùng MONGODB_URI / MONGODB_DB_NAME theo cấu hình chung của repo.

Chưa deploy. Chưa làm phòng đua/Cloudflare, va chạm với xe khác hoặc giẫm đầu; tác dụng húc xe của cú lao sẽ cần thử ở giai đoạn 3. Đa chạm, FPS và cảm giác điều khiển vẫn cần lái trên điện thoại thật.
