# Con Đường Hoàng Kim — bàn giao giai đoạn 1

Đọc cùng `con-duong-hoang-kim-spec.md`. Bản đặc tả gốc được giữ nguyên.

## Chạy thử

- `npm run dev:next` rồi mở `/con-duong-hoang-kim` hoặc `/con-duong-hoang-kim/solo`.
- Bản review trong phiên làm việc: http://localhost:3011/con-duong-hoang-kim.
- A / ←: phanh rồi lùi; D / →: ga. P / Escape: tạm dừng.
- Điện thoại: giữ bàn đạp; pointer capture giữ nút khi ngón tay trượt ra ngoài. Có thể giữ cả hai bàn đạp.
- Nóc chạm đất bắt đầu 3 giây cứu xe bằng ga/phanh; dựng lại bằng hai bánh thì tiếp tục. Hết xăng, dừng 3 giây thì kết thúc.
- Đổi tab hoặc mất focus tự tạm dừng và nhả điều khiển.

## Phạm vi

Một Jeep, Đồi chè, seed cố định để các lần lái thử so sánh được. Planck 1.5.1 dùng WheelJoint, bước cố định 1/60 giây. Mô phỏng, kiểu dữ liệu và sinh địa hình nằm trong `shared/hill*.ts`, không phụ thuộc DOM. Đường vật lý được sinh/xóa theo cửa sổ quanh xe; vật phẩm có ID ổn định, xu đã nhặt không tái sinh khi lùi.

Canvas 2D, camera bám mượt và thu xa theo tốc độ/khi bay, HUD xăng/xu/quãng đường, đếm ngược, kết quả, chạy lại, toàn màn hình và âm tổng hợp Web Audio. Dùng mã máy từ `src/lib/player.ts`; xu chỉ tính trong lượt.

Năng lượng, nhảy/bật lật, thưởng kỹ năng, xe/bản đồ khác, ví xu và kỷ lục thuộc các giai đoạn sau. Chưa thêm API, server game, phòng, cấu hình Cloudflare hoặc ô trang chủ.

## Chỉnh cảm giác khi review

Các thông số ở `shared/hillTypes.ts` (`HILL_JEEP`): lực ga, tốc độ bánh, tần số lò xo, giảm chấn, lực xoay khi bay và khi cứu xe. Dáng đồi/độ khó ở `shared/hillTerrain.ts`.

Ưu tiên lái thử: xe có quá bốc đầu không, lên dốc có bị ì, tiếp đất có nảy quá nhiều, xoay trên không và 3 giây cứu xe có dễ điều khiển không.

## Kiểm tra đã chạy

- `npx tsc --noEmit -p tsconfig.json`: đạt.
- `npx tsc --noEmit -p party/tsconfig.json`: đạt, gồm cả mô phỏng shared trong cấu hình Worker.
- `npm run lint`: đạt, còn một warning có sẵn tại `SoccerGameRoom.tsx:105`. Bổ sung ignore cho mã sinh `.next`, `out`, `build`, `next-env.d.ts`.
- `node --import tsx scripts/hill-smoke.test.ts`: đạt; cùng seed/input, tiến/lùi, nhặt xu/xăng, số body địa hình, hết xăng, nóc chạm đất không thua ngay và cứu xe.
- `git diff --check`: đạt.
- Trình duyệt local: kiểm tra Canvas, đếm ngược, hết xăng/kết quả, chạy lại, tạm dừng/tiếp tục, bố cục 390×844. Đã xử lý nút âm thanh toàn trang đè lên bàn đạp.

Còn cần lái thử trên điện thoại thật để đánh giá cảm giác và đa chạm; chưa xác nhận FPS trên thiết bị tầm trung. Chưa deploy.
