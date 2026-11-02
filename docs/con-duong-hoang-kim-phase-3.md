# Giai đoạn 3 — đua nhiều người

PartyServer đã deploy lên `https://ve-cung-toi.phungthienphu.workers.dev`, version `314e92f3-d65d-44ef-99b3-a653f044287e` (02/11/2026). Hai giai đoạn trước vẫn ở `1dde70e` và `73dbb34`.

## Chơi thử

- `/con-duong-hoang-kim`: giữ chế độ solo, thêm nút **Đua cùng bạn**.
- `/con-duong-hoang-kim/friends`: đặt tên, tạo phòng, nhập mã, danh sách phòng.
- `/con-duong-hoang-kim/[roomId]`: chọn đủ bốn xe, sẵn sàng, chia sẻ link, sảnh và đua.
- Chạy Worker: `npm run dev:party` (port 1999).
- Chạy Next để review local: `NEXT_PUBLIC_PARTYKIT_HOST=127.0.0.1:1999 MONGODB_DB_NAME=vct_hill_review_20261102 npm run dev:next -- --port 3011`.
- Không dùng giá trị PartyKit hosted cũ trong `.env.local` để thử HillRoom mới. Binding/migration v3 đã được triển khai production. Vercel production đã được kiểm tra: `NEXT_PUBLIC_PARTYKIT_HOST=ve-cung-toi.phungthienphu.workers.dev`.

## Mô phỏng và luật

- `HillPhysicsWorld` quản lý chung một thế giới Planck và vùng địa hình quanh từng xe. Mỗi xe dùng cùng `HillSim` với solo, nhóm lọc riêng để chỉ bỏ va chạm với các bộ phận của chính mình.
- HillRoom chạy ba bước 1/60 giây mỗi 50ms; phát 15 snapshot/giây. Dừng vòng lặp khi ở sảnh/kết quả hoặc không còn ai kết nối.
- 2–6 người, tháp xuất phát ngẫu nhiên, ghim ba giây; 35 năng lượng. Bốn bản đồ hoặc ngẫu nhiên; 600/1200/2000m; về đích hoặc đi xa nhất; xe tự chọn hoặc cùng loại; xe đặc/ma; 1/3/5 ván.
- Húc ngang dùng truyền động lượng thật, xe nặng chống đẩy tốt hơn. Space vẫn +8m/s, tốn 25 năng lượng, hồi hai giây.
- Giẫm từ trên với chênh lệch vận tốc rơi >3m/s: nạn nhân giảm vận tốc còn 40%, khóa **ga** 0,8s; vẫn dùng phanh, W và Space được. Người giẫm nảy lên, +20 năng lượng. Mỗi cặp hồi 1,5s.
- Chỉ nóc chạm **đất** tính lật, không tính khi xe khác đè lên nóc. Hết thời gian cứu lật thì mờ 1,5s, hồi tại checkpoint 150m phía sau và ma thêm 1,5s. Nút hồi sinh khi đứng yên ba giây; sau tám giây đầu, đứng yên bốn giây thì ma ba giây chống chặn đường.
- Hồi sinh đặt bánh cao hơn bề mặt ở cả hai bên để tránh chôn bánh vào dốc. Quãng đường đua dùng vị trí hiện tại, nên hồi sinh thực sự mất quãng đường.
- Đua về đích có can xăng mỗi 60m và 20s chờ sau người đầu tiên. Chế độ đi xa nhất dùng xăng solo, lật mất 25 xăng; người cuối còn chạy thắng. Chặn phòng bỏ quên ở sáu phút.
- Điểm 10/7/5/3/2/1, kết quả từng ván và tổng điểm, số giẫm/bị giẫm/lật/thời gian bay, ván tiếp/về sảnh.

## Đồng bộ trình duyệt

- Chỉ gửi khi nút thay đổi, có seq; bỏ seq cũ và dữ liệu sai. Nhấn W/Space rất ngắn được giữ đến bước vật lý kế tiếp. Mất mạng nhả nút; reconnect/refresh chấp nhận lại chuỗi seq từ đầu.
- Xe khác nội suy giữa các snapshot trong khoảng 100ms. Ba giây đầu dùng trạng thái server cho mọi xe; sau đó xe mình dự đoán bằng HillSim, khôi phục snapshot và chạy lại bước chưa được xác nhận. Lỗi vị trí/góc được làm dịu khoảng 100ms; respawn xa thì đặt lại ngay. Khi bị bẹp dùng trạng thái server.
- Snapshot lượng tử hóa pose/vận tốc tới 0,001, dùng mảng số; pickup chỉ gửi ID và tái tạo vị trí từ seed. Đo thực tế phòng sáu người khoảng **4,9KB/snapshot**, ~73KB/s/client, lớn hơn dự tính 1KB trong phác thảo spec.
- Canvas2D, điều khiển pointer đa nút, A/D hoặc mũi tên, W/↑ và Space, âm thanh WebAudio, mute, thông báo mất kết nối và trạng thái bị bẹp. Có vạch đích, tên trên xe, mờ khi ma/hồi sinh.
- Dự đoán xe mình không chạy lại vật lý của cả sáu xe trên client; va chạm với xe khác do server sửa lại. Cần chơi thử mạng di động thật để chỉnh độ mượt khi chen chúc.

## Địa hình

Giữ 40m bằng ở xuất phát. Sau đó mỗi đoạn 72m trộn bốn dạng theo seed: dốc phóng và lòng chảo tiếp đất, khe trũng sâu, ba bậc đá, chuỗi ụ liên tiếp. Có đoạn nghỉ giữa thử thách, khó tăng dần theo quãng đường. Đồi chè nhẹ nhất, đèo có biên độ lớn nhất. Dùng cùng hàm độ cao trên server, solo và Canvas; không chỉ trang trí dốc ở hình vẽ.

## Kiểm chứng

- Hai `tsc --noEmit` (Next và party), `npm run lint`, `git diff --check`.
- `node --import tsx scripts/hill-smoke.test.ts`: solo tất định, chạy/nhặt xăng, streaming, lật/cứu lật. Mốc smoke từ >100m xuống >80m vì đường đầu tiên đã có thử thách; test vẫn phải qua đoạn xuất phát và nhặt được can xăng.
- `node --import tsx scripts/hill-phase2.test.ts`: 16 tổ hợp xe/map, nhảy/coyote/cứu lật/dash, ngày Việt Nam, xác thực kết quả và retry.
- `node --import tsx scripts/hill-race.test.ts`: tháp, năng lượng, seq/reconnect, giẫm, mái chạm xe, Space giữa hai tick, chống cự khi bẹp, đẩy xe thật so với xe ma, lật tự hồi sinh, vạch đích/chờ 20s, checkpoint, độ gồ ghề; benchmark 6 xe.
- `node --import tsx scripts/hill-room.integration.ts` (Worker local đang chạy): sáu WebSocket, danh sách phòng, quyền host, ready/countdown, chuyển động server, ~15Hz, reconnect, tin lỗi, hoàn thành ván đi xa nhất, 28 tổng điểm và ván tiếp.
- Chạy lại integration với `HILL_PARTY_URL=https://ve-cung-toi.phungthienphu.workers.dev`: phòng production thử riêng sáu người đã qua đầy đủ luồng; ~4.821 byte/snapshot trong lượt đo này, đóng các client thử sau bài test.
- Browser thực tế: tạo phòng, chọn cấu hình, sáu xe trong Canvas, tháp và va chạm trên dốc; màn hình dọc 390×844 với bàn đạp cảm ứng và kết quả trọn ván hai người. Đây là viewport giả lập, chưa phải thiết bị mobile thật.

## CPU local

Benchmark Node 24, sáu xe hỗn hợp, 3.600 bước đo sau warmup. Giữ cả sáu xe hoạt động bằng cách tái đặt trên các đoạn dốc và bổ sung xăng mỗi 300 bước. Gồm cập nhật địa hình và luật đua, không gồm WebSocket/JSON. Các lượt đo gần cuối:

- CPU process (`process.cpuUsage`): 1.396–1.581ms / 3.600 bước, tức 0,39–0,44ms CPU/bước.
- Thời gian một bước: p50 0,25–0,28ms, p95 0,43–0,54ms, p99 0,63–0,78ms.
- 30 physics bodies ở cuối, cả sáu xe còn hoạt động. Bài test riêng cũng kiểm tra streaming khi các xe cách xa.

Đây là số đo máy local và có ảnh hưởng JIT/GC/độ tải; không quy đổi thành CPU Cloudflare. Wrangler local đã chạy được phòng sáu người; đã deploy trên Workers production; chưa benchmark CPU production.

## CTA trang chủ

Thêm CTA Con Đường Hoàng Kim tại hero và thẻ game nổi bật đầu thư viện trên `/`, với ảnh bìa SVG riêng trong `public/hill/cover.svg`. Cả hai dẫn vào màn chọn chế độ của game để người chơi tự chọn solo hoặc đua cùng bạn. Đã kiểm tra click từ home vào game trên trình duyệt.

## Phạm vi tiếp theo

Vật phẩm, bot, bóng ma kỷ lục, danh hiệu và lịch sử trận thuộc giai đoạn 4; không thêm API ghi kỷ lục/xu cho kết quả multiplayer trong bước này. Chưa có nút parry/khiên riêng; phòng thủ hiện là phanh/nhảy/lao tới với năng lượng hiện có.
