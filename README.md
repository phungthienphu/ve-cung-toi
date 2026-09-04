# Vẽ Cùng Tôi 🎨

Game vẽ - đoán chữ nhiều người chơi thời gian thực, kiểu Skribbl.io. Không cần tài khoản — vào link phòng, nhập tên, chơi ngay.

## Stack

- **Next.js 15** (App Router, TypeScript, Tailwind CSS) — giao diện, routing, API routes.
- **PartyKit** — mỗi phòng chơi là một room/Durable Object riêng, giữ toàn bộ state realtime (người chơi, nét vẽ, chat, điểm số, thời gian).
- **MongoDB** (qua Mongoose) — chỉ lưu dữ liệu bền: bộ từ vựng (`wordlists`) và lịch sử ván đấu (`game_history`). Không dùng để đồng bộ nét vẽ/chat lúc chơi.

## Cấu trúc thư mục

```
src/app/                # Next.js App Router pages + API routes
src/components/         # React components (canvas, chat, lobby, ...)
src/lib/                # MongoDB connection, models, client hooks
party/server.ts         # PartyKit room server — toàn bộ game loop
shared/types.ts          # Types dùng chung giữa Next.js và PartyKit
shared/wordlists.ts      # Bộ từ mặc định (Việt + Anh)
scripts/seed.ts          # Seed bộ từ mặc định vào MongoDB
```

## Chạy local

1. Cài dependencies:

   ```bash
   npm install
   ```

2. Tạo file `.env.local` từ mẫu:

   ```bash
   cp .env.example .env.local
   ```

   Điền `MONGODB_URI` (dùng [MongoDB Atlas](https://www.mongodb.com/atlas), free tier là đủ). `NEXT_PUBLIC_PARTYKIT_HOST` để mặc định `127.0.0.1:1999` khi chạy local.

3. (Tùy chọn) Seed bộ từ vựng mặc định vào MongoDB:

   ```bash
   npm run seed
   ```

   Lưu ý: PartyKit dùng bộ từ mặc định được bundle sẵn trong `shared/wordlists.ts` để chơi (không phụ thuộc DB lúc realtime), nên **không seed vẫn chơi được** — bước này chỉ để lưu bản ghi vào MongoDB.

4. Chạy song song cả Next.js dev server và PartyKit dev server:

   ```bash
   npm run dev
   ```

   Lệnh này chạy đồng thời `next dev` (http://localhost:3000) và `partykit dev` (ws://127.0.0.1:1999). Mở http://localhost:3000, tạo phòng, mở thêm 1-2 tab/trình duyệt khác để test đồng bộ vẽ + đoán chữ theo thời gian thực.

   Nếu muốn chạy riêng từng server: `npm run dev:next` và `npm run dev:party`.

## Deploy

### PartyKit

```bash
npm run party:deploy
```

Lệnh này (chạy `partykit deploy`) sẽ hỏi đăng nhập PartyKit (Cloudflare) lần đầu, sau đó deploy `party/server.ts` lên `https://ve-cung-toi.<username>.partykit.dev`. Nếu bạn muốn PartyKit tự lưu lịch sử ván đấu vào MongoDB qua API `/api/game-history` của app đã deploy, set biến môi trường `NEXT_APP_URL` cho PartyKit project (qua PartyKit dashboard hoặc `partykit env add`) trỏ tới domain Vercel của bạn.

### Next.js (Vercel)

1. Import repo vào [Vercel](https://vercel.com/new).
2. Thêm biến môi trường:
   - `MONGODB_URI` — connection string MongoDB Atlas.
   - `NEXT_PUBLIC_PARTYKIT_HOST` — domain PartyKit đã deploy ở trên (không có `https://`, ví dụ `ve-cung-toi.<username>.partykit.dev`).
3. Deploy.

### MongoDB Atlas

Tạo cluster free tier, tạo database user, whitelist IP `0.0.0.0/0` (hoặc IP cụ thể của Vercel/PartyKit nếu muốn chặt hơn), lấy connection string dán vào `MONGODB_URI`.

## Luồng chơi

1. **Trang chủ** (`/`) — nhập tên, tạo phòng mới hoặc nhập mã phòng có sẵn.
2. **Phòng chờ** (`/room/[roomId]`, trạng thái `lobby`) — chủ phòng cấu hình số vòng, thời gian vẽ, bộ từ vựng (mặc định Việt/Anh và/hoặc từ tùy chỉnh), bấm "Bắt đầu" khi có ≥2 người.
3. **Vòng chơi** — người vẽ chọn 1 trong 3 từ, vẽ trên canvas (đồng bộ realtime qua PartyKit), người khác đoán trong chat. Đoán đúng sớm được nhiều điểm hơn; người vẽ cũng được cộng điểm theo số người đoán đúng.
4. **Hết lượt** — lộ đáp án, hiển thị ảnh vừa vẽ (chụp từ canvas, xử lý hoàn toàn phía client) kèm nút Tải về/Sao chép, rồi tự động chuyển người vẽ tiếp theo.
5. **Kết thúc ván** — sau khi mỗi người chơi vẽ đủ số vòng cấu hình, hiện bảng xếp hạng cuối và lưu lịch sử ván đấu vào MongoDB.

## Giới hạn phòng

- Tối đa 8 người / phòng, tối thiểu 2 người để bắt đầu.
- Chơi hoàn toàn ẩn danh — id ngẫu nhiên lưu ở `localStorage` để refresh/rớt mạng vẫn vào lại đúng phiên.

## Test đồng bộ realtime

Đã test thủ công với ≥2 tab trình duyệt trỏ tới cùng phòng (`/room/ABC123`) để xác nhận:

- Nét vẽ của người vẽ hiện ra gần như tức thời ở các tab khác.
- Người mới vào giữa lượt (hoặc reload) nhận lại đúng toàn bộ nét vẽ hiện có.
- Đoán đúng ở 1 tab cập nhật điểm số + trạng thái "đã đoán đúng" ở tất cả các tab còn lại.
- Người vẽ rời phòng giữa chừng khiến lượt tự động kết thúc và chuyển người vẽ khác.
