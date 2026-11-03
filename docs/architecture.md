# Tổ chức mã nguồn

Các game dùng chung ứng dụng Next.js và Worker PartyServer. Mỗi game có miền mã nguồn riêng; URL, tên Durable Object, room và khóa lưu trữ không đổi khi di chuyển file.

| Thư mục | Trách nhiệm |
| --- | --- |
| `src/app` | Route, trang và API HTTP |
| `src/features/<game>/components` | Giao diện, Canvas và điều khiển |
| `src/features/<game>/hooks` | Kết nối phòng, đồng bộ state |
| `src/features/<game>/audio` | Âm thanh riêng của game |
| `src/features/<feature>/server` | Helper chỉ chạy trên Next server |
| `src/server/db`, `src/server/models` | Database và schema dữ liệu bền |
| `src/components`, `src/lib` | UI và tiện ích dùng chung |
| `src/lib/audio/core.ts` | AudioContext, mute và hàm tổng hợp âm thanh |
| `shared/<game>` | Hợp đồng dữ liệu và luật không phụ thuộc framework |
| `party/<game>` | Adapter realtime, danh sách phòng và vòng đời kết nối |

## Ranh giới

- `shared` không import `src`, React, Next.js hay PartyServer. Bộ mô phỏng phải dùng được trong trình duyệt và Worker.
- Trong mỗi miền, `models.ts` chứa kiểu dữ liệu, `config.ts` chứa hằng số/cấu hình, `rules.ts` chứa hàm luật. `types.ts` là API xuất chung để nơi sử dụng không phụ thuộc cách tách file bên trong.
- Component và hook trình duyệt không import `src/server` hay helper `features/*/server`. API routes chịu trách nhiệm xác thực và truy cập database.
- `src/lib/sound.ts` giữ API âm thanh chung; phần hiện thực từng game nằm trong feature tương ứng. Mọi âm thanh sử dụng cùng trạng thái mute.
- Đặt mã mới vào miền sở hữu. Chỉ chuyển sang thư mục chung khi có nhu cầu dùng thực tế từ nhiều miền.

## Xe tăng

`shared/tank/engine.ts` là luật có thẩm quyền cho cả phòng online và luyện tập tại máy. Adapter `party/tank/server.ts` cung cấp kết nối, broadcast và ghi lịch sử. Phòng `/tank-game/local` chạy engine ngay trong trình duyệt và không mở Party socket.

Engine chạy 30 bước/giây, gửi snapshot 15 lần/giây. Input có sequence; server chỉ xác nhận sau khi đã mô phỏng. Client dự đoán vị trí của mình, phát lại input chưa được xác nhận và làm dịu sai lệch nhỏ. Camera, xe và điểm ngắm dùng cùng vị trí dự đoán. Khi thay cadence cần giữ tốc độ và tài nguyên theo thời gian thực.

Bot dùng cùng input và luật tài nguyên/cooldown như người chơi. Chủ phòng chọn 0–5 bot, độ khó dễ/thường/khó; tổng số xe tối đa 8. Bot tìm đường trên lưới và chỉ chọn mục tiêu nhìn thấy.

Mobile dùng joystick trái 8 hướng và joystick phải ngắm 360°, giữ để bắn. Di chuyển chéo được chuẩn hóa tốc độ. Desktop giữ bàn phím và chuột.

## Kiểm tra

```bash
npm run typecheck
npm run lint
npm run test:tank
npm run test:hill
npm run test:layout
npm run build
```

Test mô phỏng xác nhận luật và đồng bộ, không thay thế đánh giá FPS trên điện thoại hoặc độ trễ mạng thực tế. Deploy Worker khi thay đổi `party` hoặc luật `shared` mà Worker dùng; deploy web khi thay đổi mã phía web hoặc shared mà web dùng.

Tailwind quét toàn bộ `src/**/*.{ts,tsx}`. Khi di chuyển UI, phải giữ các file trong phạm vi quét; build TypeScript không phát hiện việc CSS bị thiếu. `test:layout` kiểm tra mọi component feature và các utility bố cục/responsive quan trọng.
