# Bạn bè, chat chữ và quản trị

## Cấu hình

- Dùng Auth.js và MongoDB đang có, không cần Resend cho Google/bạn bè/chat.
- `ADMIN_EMAILS`: danh sách email quản trị, phân cách dấu phẩy. Mặc định là tài khoản chủ web đã chỉ định. Đặt biến này để thay đổi hoặc đặt rỗng để tắt quyền quản trị.
- `/admin`: dashboard tổng quan và sidebar trái. Các trang `/admin/users`, `/admin/games`, `/admin/impressions`, `/admin/reports`, `/admin/audit`, `/admin/feedback`: người dùng (tìm kiếm, phân trang, khóa/mở), game (bật/tắt), impression 30 ngày, báo cáo và nhật ký thao tác.
- Khóa tăng sessionVersion, thu hồi phiên Auth.js. Không cho khóa email quản trị.
- Không thay đổi giao thức phòng Party/Cloudflare; khóa tài khoản không đá kết nối phòng tạm thời đã mở. Tắt game chặn giao diện khi truy cập mới, không ngắt trận đang diễn ra. Khi DB mất kết nối, giao diện game vẫn mở để giữ chơi khách.

## Luồng xã hội

- `/community`: tìm tên hoặc username (không tìm email), lời mời kết bạn, chấp nhận/từ chối, hủy bạn.
- Hồ sơ `/players/[id]` chỉ hiện tên, username và thành tích cho người đăng nhập. Không công khai email, xu, mật khẩu.
- Chat chữ giữa bạn bè, tối đa 1000 ký tự; tải 50 tin mới và tải tiếp tin cũ. Tin nhắn được lưu trong MongoDB, chưa mã hóa đầu cuối.
- Chặn chấm dứt bạn bè, ngăn đọc chat, tìm kiếm, gửi tin và mời phòng. Có thể bỏ chặn; không tự khôi phục bạn bè. Báo cáo vào admin.
- Nút Bạn bè mở bảng nổi trên màn phòng, giữ game đang chạy. Chọn bạn và bấm Mời vào phòng hiện tại. Lời mời hết hạn sau 2 phút. Link chỉ được phép tới đường dẫn phòng của game trong catalog, không cho URL ngoài.
- Đồng bộ bằng Party WebSocket, một kết nối cho mỗi tab đã đăng nhập. Không polling hoặc ghi heartbeat MongoDB. Online khi còn ít nhất một kết nối, offline khi đóng hết kết nối. MongoDB vẫn lưu lịch sử; Party gửi sự kiện tới đúng người, trình duyệt tải lại khi có sự kiện hoặc reconnect. Chưa xác minh dung lượng/trạng thái phòng từ Party; màn phòng xử lý phòng đầy/hết trận như khi mở link bình thường.
- Impression mới ghi từ lúc triển khai, không nhập số liệu Cloudflare cũ; đếm lượt xem trang chủ và vào game theo ngày, UUID chống ghi trùng. Không lưu query/hash/IP/email. Bản ghi TTL 90 ngày. Bộ giới hạn sử dụng khóa băm IP, không coi đây là thống kê duy nhất hay chống gian lận tuyệt đối.

## Khôi phục mật khẩu

Nút Quên mật khẩu luôn hiện Sắp ra mắt và bị vô hiệu. Cả trang forgot/reset và API tương ứng tạm khóa, kể cả link khôi phục cũ. Đăng ký/xác minh email vẫn cần cấu hình gửi mail; thay đổi này không tự bật đăng ký không xác minh.

## Kiểm tra

Chạy `ADMIN_EMAILS=review-admin@example.invalid npm run dev:account-review -- --email --no-google`, sau đó `npm run test:community`. Script chỉ tạo/dọn fixture trong DB review; không dùng tài khoản thật.

## Hỗ trợ người chơi

Chat bạn bè chỉ xuất hiện ngoài admin. Tab Hỗ trợ trong khung chat cho người dùng chủ động liên hệ quản trị viên. `/admin/feedback` là hộp thư riêng của quản trị, không đọc tin nhắn bạn bè. Admin chỉ có thể trả lời luồng người chơi đã mở; API xác minh quyền ở từng request. Lưu tin hỗ trợ trong MongoDB, giới hạn 1000 ký tự và 10 tin/phút, tải 50 tin và phân trang tin cũ.

## Bố cục

- Admin dùng sidebar trái, menu thu gọn trên mobile. Cột Vai trò (người chơi/quản trị) độc lập với Trạng thái (hoạt động/khóa).
- Ngoài admin: bong bóng chat góc phải, mở khung nhỏ giữ game chạy bên dưới. Trong khung có tab Hỗ trợ để nhắn quản trị viên.
- Cài đặt âm thanh gom thành một nút bánh răng góc trái. Những game có HUD âm thanh riêng giữ điều khiển riêng; không có nút âm thanh nổi trong admin.

## Party realtime

- Thêm `CommunityRoom` (Durable Object), migration `v4`, endpoint `/parties/community/main`.
- Đặt cùng `COMMUNITY_REALTIME_SECRET` tại Next và Worker (`wrangler secret put COMMUNITY_REALTIME_SECRET`). Nếu chưa có, hai bên dùng `GAME_HISTORY_SECRET` làm fallback với chữ ký được phân biệt theo mục đích. Không đưa secret vào biến `NEXT_PUBLIC_*`.
- `NEXT_PUBLIC_COMMUNITY_HOST` tùy chọn, mặc định dùng host Party của game. Local dùng `127.0.0.1:1999`; chạy `npm run dev:party`. Không đổi host các game khác.
- `/api/community/realtime` chỉ cấp ticket khi phiên Auth.js còn hợp lệ, không bị khóa. Ticket HMAC hạn 5 phút, chỉ chứa mã tài khoản, danh sách bạn được phép xem online và quyền admin. Worker kiểm tra trước upgrade và kiểm tra lại ở DO. Alarm hết hạn đóng socket, PartySocket tự xin ticket mới. Đây là xác thực lại kết nối, không phải polling dữ liệu chat.
- Socket chỉ nhận sự kiện. Gửi tin/đọc lịch sử vẫn qua API có xác thực và quyền bạn bè; sau khi Mongo ghi thành công, API ký sự kiện server-to-server để Party chuyển đúng người. Không broadcast nội dung chat hay email công khai. Support chỉ thông báo người mở luồng và admin.
- Kết bạn/hủy bạn/chặn làm mới ticket cả hai phía để cập nhật quyền xem presence. Khóa tài khoản đóng socket; các API vẫn kiểm tra phiên DB, không dựa vào socket.
- Mất kết nối tự reconnect và lấy snapshot để bù sự kiện bỏ lỡ. Nếu ghi Mongo thành công nhưng publish Party thất bại, UI báo tin đã lưu nhưng chưa đẩy realtime, không tự gửi lại làm trùng tin.
- Một hub cho bản hiện tại, dùng WebSocket hibernation. Chưa phân mảnh hub cho quy mô lớn.
- Khi đưa production: cấu hình secret cả hai bên, host, deploy Worker (`npm run party:deploy`) rồi deploy Next. Không chỉ deploy frontend, vì binding mới cần migration.
- Kiểm tra local: chạy Worker + server review, rồi `npm run test:community:realtime`. Test dùng tài khoản giả, DB review riêng và socket thật: chat, invite, support, presence nhiều tab, chống giả ticket/publish, đóng socket khi khóa tài khoản.

### Guest discovery and room invitations
- Guests can open the chat bubble or `/community` and search display names/usernames (minimum two characters). Public search returns only player ID, display name and username; private messages and friendship writes remain session-protected.
- Guest Chat / Add friend actions open a login prompt and preserve the current page as the login return destination. Existing room links and in-game guest chat are unchanged.
- On a room route, the bubble identifies “Mời bạn / Chat”. Accepted friends have a direct “Mời vào phòng” action in both the friend list and search results. Other players must first accept a friendship.
- Incoming invitations show the sender, game and “Bỏ qua / Đồng ý” actions. Party delivers changes; MongoDB persists invitations. Existing path checks, blocks, expiry and invite rate limits still apply.

### Góp ý không cần tài khoản
Khách mở tab Hỗ trợ sẽ được chọn đăng nhập để trò chuyện hoặc tiếp tục bằng khách, nhập tên (tối đa 60 ký tự) và góp ý (tối đa 1000 ký tự). Góp ý khách là một chiều, không cấp quyền đọc hộp thư; admin thấy nhãn Khách và không có nút trả lời cho luồng này. API kiểm tra cùng origin và giới hạn 5 góp ý/10 phút theo khóa băm IP. Party thông báo ngay cho admin sau khi MongoDB lưu thành công. Người đã đăng nhập tiếp tục dùng hội thoại hỗ trợ hai chiều như cũ.
