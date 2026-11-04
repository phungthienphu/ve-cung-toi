# Tài khoản bằng tên đăng nhập, email và mật khẩu

Ngày: 04/11/2026. Trạng thái: đã triển khai trong code; cần cấu hình email, migration và kiểm tra staging trước khi mở production.

## 1. Mục tiêu và phạm vi

Thêm cách đăng ký/đăng nhập cho người không muốn dùng Google. Email bắt buộc để xác minh quyền sở hữu và nhận liên kết đặt lại mật khẩu. Giữ Google và chơi khách.

Mọi cách đăng nhập dùng cùng một tài khoản nội bộ và `playerId`: cùng hồ sơ, xu, xe và thống kê. Không tạo hệ tiến độ riêng cho tài khoản mật khẩu. Xu/vật phẩm vẫn tách theo game.

Bao gồm:

- Đăng ký bằng tên đăng nhập, tên hiển thị, email, mật khẩu và xác nhận mật khẩu.
- Xác minh email, gửi lại email xác minh.
- Đăng nhập bằng tên đăng nhập hoặc email và mật khẩu.
- Quên mật khẩu qua email, đổi mật khẩu trong tài khoản.
- Chủ động liên kết Google với tài khoản hiện có, hoặc thêm mật khẩu vào tài khoản Google.
- Thu hồi phiên sau khi đặt lại/đổi mật khẩu.
- Gộp tiến độ khách theo cơ chế hiện có.

Không gồm SMS, Facebook/Zalo, passkey, đăng ký không email, đổi email, xoá tài khoản tự phục vụ hoặc tự động gộp hai tài khoản đã có tiến độ. Người không có email tiếp tục chơi khách.

## 2. Hiện trạng cần giữ và điều chỉnh

Code hiện có dùng Auth.js JWT, MongoDB `AccountUser`, định danh Google bằng `googleSubject`, còn `playerId` nhận diện tiến độ. `googleSubject` đang bắt buộc và unique. Email chưa unique và chưa có trường xác minh/mật khẩu. Các cờ bật đăng nhập và bảo vệ ví hiện phụ thuộc cấu hình Google.

Khi triển khai:

- Tách `authEnabled` khỏi `googleLoginEnabled`. Email/mật khẩu phải hoạt động khi không có cấu hình Google.
- Giữ nguyên `playerId` của tài khoản Google cũ, không tạo lại ví hoặc lịch sử.
- Giữ hợp đồng phiên `session.user.playerId` và cơ chế gộp khách đúng một lần.
- Không sửa mô phỏng game hoặc giao thức phòng chỉ để thêm mật khẩu. Đăng nhập không biến mã phòng tạm thời thành dữ liệu cần lưu lâu dài.

## 3. Quy tắc thông tin đăng ký

| Trường | Quy tắc |
| --- | --- |
| Tên đăng nhập | Bắt buộc, 3–24 ký tự ASCII `a-z`, `0-9`, `_`; không phân biệt hoa/thường; duy nhất; không cho đổi ở phạm vi này |
| Tên hiển thị | Bắt buộc, 1–24 ký tự sau trim, hỗ trợ tiếng Việt; được trùng; không dùng làm định danh |
| Email | Bắt buộc, trim và chuẩn hoá chữ thường để tra cứu; tối đa 254 ký tự; kiểm tra cú pháp trên server; không tự bỏ dấu chấm hoặc phần `+tag` |
| Mật khẩu | 12–128 ký tự; cho phép khoảng trắng, Unicode và paste; không trim/đổi chữ hoa/thường; không bắt buộc phối hợp ký tự đặc biệt |
| Xác nhận mật khẩu | Phải giống mật khẩu, không lưu vào DB |

Email chuẩn hoá chỉ thuộc một tài khoản. Tên đăng nhập khác tên hiển thị. Google-only có thể chưa có tên đăng nhập; đăng nhập bằng Google vẫn bình thường.

Mật khẩu băm bằng Argon2id, tối thiểu memory 19 MiB, iterations 2, parallelism 1; đo trên runtime Vercel và tăng nếu phù hợp. Salt riêng do thư viện sinh. Không lưu mật khẩu gốc, không mã hoá theo cách có thể giải mã. Chạy xử lý mật khẩu trên Node.js runtime, không Edge.

## 4. Luồng đăng ký và xác minh email

1. Mở `/register`, nhập các trường và gửi form. Không làm mất dữ liệu form nếu lỗi mạng; không lưu mật khẩu vào localStorage/log.
2. Server kiểm tra dữ liệu và giới hạn tần suất. Tên đăng nhập đã dùng trả lỗi tại ô tên; tình trạng email không được tiết lộ qua thông báo công khai.
3. Lưu đăng ký chờ xác minh vào collection riêng, chưa tạo tài khoản hoạt động và chưa chiếm username/email trong `AccountUser`.
4. Gửi email chứa liên kết xác minh dùng một lần, hiệu lực 24 giờ.
5. Trang thông báo: “Nếu email hợp lệ, hướng dẫn xác minh sẽ được gửi tới hộp thư. Kiểm tra cả thư rác.” Có nút gửi lại và quay về đăng nhập.
6. Mở liên kết chỉ hiển thị trang xác nhận; người dùng bấm “Xác minh email” mới tiêu thụ token bằng POST, tránh trình quét email kích hoạt bằng GET.
7. Trong transaction: kiểm tra token còn hạn/chưa dùng, kiểm tra unique email/username và tạo tài khoản với email đã xác minh, hash mật khẩu và `playerId` mới. Nếu tên vừa bị người khác lấy, cho nhập tên khác trước khi xác nhận; không buộc đăng ký lại từ đầu.
8. Đưa về `/login` với thông báo xác minh thành công. Không tự đăng nhập bằng token email. Sau đăng nhập thành công mới gộp tiến độ khách trên thiết bị hiện tại.

Đăng ký chờ không được coi là bằng chứng sở hữu email. Người biết email người khác không thể đặt mật khẩu cho tài khoản Google của người đó bằng form đăng ký. Nếu email đã thuộc tài khoản hoạt động, không sửa thông tin/mật khẩu; có thể gửi email hướng dẫn chủ hộp thư đăng nhập hoặc khôi phục.

Gửi lại xác minh tạo token mới và thu hồi token xác minh cũ trong một thao tác nhất quán. Token mới chỉ được chấp nhận sau khi bản ghi pending tương ứng đã được lưu. Nếu nhà cung cấp email lỗi, cho phép gửi lại trong giới hạn; không thông báo đã gửi chắc chắn.

## 5. Đăng nhập và phiên

- `/login`: một ô “Tên đăng nhập hoặc email”, mật khẩu, nút hiện/ẩn mật khẩu, “Quên mật khẩu?”, nút Google nếu được cấu hình và link đăng ký.
- Auth.js Credentials provider kiểm tra email/username, hash mật khẩu và trạng thái email đã xác minh. Không tự viết cookie đăng nhập riêng.
- Thất bại trả cùng thông báo “Thông tin đăng nhập không đúng hoặc tài khoản chưa được xác minh.” Không phân biệt không tồn tại/sai mật khẩu; dùng hash giả để giảm chênh lệch thời gian kiểm tra.
- Giữ thời hạn phiên 30 ngày như hiện tại; cookie HttpOnly, Secure trên production, SameSite theo Auth.js. Kiểm tra Origin/CSRF cho endpoint thay đổi trạng thái.
- Chỉ redirect về đường dẫn nội bộ đã kiểm tra; không nhận URL bên ngoài từ tham số callback.
- Trước đăng nhập, flush tiến độ khách đã chờ đồng bộ; sau đăng nhập gộp qua API hiện có, retry không nhân xu/lượt chơi. Lỗi gộp không được xoá cache trước khi thành công.
- Không chuyển danh tính giữa trận đang chơi: thao tác đăng nhập từ ngoài trận hoặc sau kết quả; giữ hành vi hiện có của phòng online.

## 6. Quên và đặt lại mật khẩu

1. `/forgot-password` nhận email. Luôn trả thông báo chung: “Nếu email này có tài khoản hỗ trợ mật khẩu, bạn sẽ nhận được hướng dẫn.”
2. Với tài khoản đã xác minh và có mật khẩu, gửi liên kết dùng một lần, hiệu lực 30 phút. Với Google-only, gửi hướng dẫn đăng nhập Google và thêm mật khẩu trong tài khoản, không tự cấp mật khẩu qua luồng quên mật khẩu.
3. `/reset-password` cho nhập mật khẩu mới và xác nhận. GET không đổi tài khoản hoặc tiêu thụ token.
4. POST kiểm tra token, hạn, mục đích và mật khẩu. Trong transaction, đánh dấu token đã dùng, cập nhật hash, tăng `sessionVersion`, thu hồi các token reset còn lại.
5. Chỉ một POST đồng thời được thành công. Token hết hạn/đã dùng/sai đều hiện thông báo chung và link yêu cầu lại.
6. Sau thành công, gửi email thông báo bảo mật, đưa về đăng nhập; không tự tạo phiên mới. Lỗi gửi thông báo bảo mật không hoàn tác mật khẩu đã đổi.
7. Tất cả phiên cũ, kể cả phiên Google của cùng tài khoản, bị vô hiệu hoá ở yêu cầu được bảo vệ tiếp theo.

Đổi mật khẩu khi đang đăng nhập yêu cầu mật khẩu hiện tại và mật khẩu mới; cũng tăng `sessionVersion`, thu hồi phiên/token và yêu cầu đăng nhập lại. Tài khoản Google chưa có mật khẩu dùng luồng thêm mật khẩu ở mục 7.

## 7. Liên kết Google và email/mật khẩu

Không tự gộp hoặc liên kết tài khoản chỉ vì email trùng.

### Từ tài khoản mật khẩu sang Google

- Người dùng đăng nhập tài khoản hiện tại, vào phần bảo mật và chọn “Liên kết Google”.
- Yêu cầu xác thực lại trong 5 phút bằng mật khẩu hiện tại, sau đó chạy OAuth có state và ý định liên kết gắn với đúng phiên/tài khoản.
- Chỉ nhận Google email đã xác minh và trùng `emailNormalized` của tài khoản hiện tại. Google subject đã gắn tài khoản khác thì từ chối.
- Liên kết thành công giữ nguyên `playerId`, ví, tên hiển thị và lịch sử; không ghi đè bằng hồ sơ Google.

### Từ tài khoản Google sang mật khẩu

- Người dùng đăng nhập Google, chọn “Thêm mật khẩu”. Yêu cầu Google OAuth lại trong vòng 5 phút; không chỉ kiểm tra tuổi của cookie.
- Nhập username còn trống, mật khẩu và xác nhận. Email lấy từ tài khoản đã xác minh, không cho nhập email khác ở bước này.
- Ghi username/password hash vào chính tài khoản đang có, không tạo tài khoản thứ hai. Thông báo qua email.

### Khi email Google trùng tài khoản mật khẩu nhưng chưa liên kết

- Đăng nhập Google không tạo tài khoản trùng email và không tự gắn Google subject.
- Hiện “Hãy đăng nhập bằng phương thức đang có rồi liên kết Google trong tài khoản.” Không gộp xu hoặc thay mật khẩu.
- Nếu đã tồn tại hai tài khoản có dữ liệu: giữ nguyên, chưa cho gộp tự động; cần quy trình riêng với bằng chứng sở hữu cả hai.

## 8. Dữ liệu và migration

### `AccountUser`

Giữ `playerId`, tên/ảnh và timestamps. Bổ sung:

- `username`: optional, dạng chuẩn hoá chữ thường, unique partial index chỉ với string.
- `emailNormalized`: bắt buộc cho tài khoản hoạt động, unique sau migration.
- `emailVerifiedAt`: thời điểm xác minh.
- `passwordHash`: optional, mặc định không select, không trả API/session.
- `sessionVersion`: integer, mặc định 0.
- `passwordChangedAt`: optional.
- `googleSubject`: chuyển từ required sang optional; unique partial index chỉ với string; khi không có thì bỏ trường, không ghi `null`.

Đọc tên/ảnh chung từ `AccountUser`; không để lần đăng nhập Google tiếp theo ghi đè tên do người dùng đã chọn hoặc email xác minh nội bộ. Thay đổi email Google không tự đổi email khôi phục; đổi email có quy trình riêng ngoài phạm vi này.

### Collection hỗ trợ

- `AccountRegistration`: username, tên hiển thị, emailNormalized, passwordHash, tokenHash, expiresAt, consumedAt, timestamps. Có TTL để dọn pending, giới hạn bản ghi theo email; không trả hash/token qua API.
- `AccountToken`: accountId, purpose (`password-reset`), tokenHash unique, expiresAt, consumedAt, createdAt. TTL để dọn; server vẫn luôn so hạn vì TTL không xoá ngay.
- `AuthRateLimit`: kho bộ đếm dùng chung giữa các instance, có TTL; cập nhật atomically. Không chỉ lưu bộ đếm trong RAM Vercel.
- Ý định liên kết/reauth có nonce, owner, purpose, expiresAt và dùng một lần; được kiểm tra phía server trong OAuth callback.

Token email sinh bằng CSPRNG tối thiểu 32 byte; DB chỉ lưu SHA-256 hash. Không lưu token thô vào log/analytics. Trang có token đặt `Referrer-Policy: no-referrer`, `Cache-Control: no-store` và không nhúng quảng cáo/analytics; cấu hình root layout phải loại script khỏi các trang này.

### Migration có thể chạy thử

1. Read-only audit: email sau chuẩn hoá bị trùng, thiếu email, thiếu Google subject; báo số lượng, không in email/token vào log CI.
2. Nếu trùng: dừng bước tạo unique index và mở triển khai credentials; không tự gộp hoặc xoá tài khoản.
3. Backfill emailNormalized, sessionVersion và trạng thái xác minh từ tài khoản Google đã được kiểm tra email_verified. Xác minh lịch sử/provenance trước khi đánh dấu dữ liệu không rõ nguồn gốc.
4. Đổi index Google subject sang partial; tạo các unique/TTL index mới. Không dùng auto syncIndexes có thể xoá index ngoài ý muốn.
5. Deploy tương thích Google trước khi bật đăng ký. JWT cũ thiếu version được coi là 0; mỗi yêu cầu được bảo vệ phải đọc phiên bản hiện tại trong DB.
6. Dry-run và test migration trên DB riêng trước production; có backup và kế hoạch phục hồi index. Khi rollback code vẫn phải giữ cơ chế thu hồi phiên, không đưa token đã thu hồi về hợp lệ.

## 9. Bảo vệ endpoint và gửi email

Giới hạn khởi điểm, điều chỉnh bằng cấu hình sau đo thực tế:

| Thao tác | Theo IP | Theo email/username chuẩn hoá |
| --- | --- | --- |
| Đăng nhập thất bại | 30 lần / 15 phút | 10 lần / 15 phút |
| Đăng ký | 10 lần / giờ | 3 lần / giờ |
| Gửi lại xác minh / quên mật khẩu | 20 lần / giờ | 3 lần / giờ, cách nhau ít nhất 60 giây |
| Thử token | 30 lần / 15 phút | Giới hạn thêm theo token hash |

- Chặn phải có hạn, không khoá tài khoản vĩnh viễn; dùng IP từ proxy tin cậy. Với mạng trường học nhiều người chung IP, theo dõi để điều chỉnh.
- Endpoint gửi email vẫn giữ phản hồi chung khi chạm giới hạn theo địa chỉ; có thể trả 429 khi chạm giới hạn IP. Không tiết lộ email tồn tại qua status/body.
- Không gửi email trên mỗi lần nhập sai mật khẩu. Không log body mật khẩu/token. Có thể bật CAPTCHA khi bị abuse; không bắt mọi học sinh làm CAPTCHA từ đầu.
- Chọn Resend làm dịch vụ gửi ban đầu; xác minh domain gửi và cấu hình SPF/DKIM theo hướng dẫn nhà cung cấp. Không hứa email sẽ vào inbox ngay.
- Link email sinh từ origin chuẩn đã cấu hình, không lấy trực tiếp Host do client gửi. Dev dùng hộp thư test; email Việt ngữ, nêu hạn và hướng dẫn bỏ qua nếu không yêu cầu.

## 10. Trang và API dự kiến

Trang: `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/account/security`.

| API | Mục đích |
| --- | --- |
| `POST /api/account/register` | Tạo đăng ký chờ, gửi xác minh |
| `POST /api/account/verification/resend` | Gửi lại, phản hồi chung |
| `POST /api/account/verification/confirm` | Xác nhận token, tạo tài khoản |
| Auth.js Credentials callback | Đăng nhập mật khẩu và tạo phiên |
| `POST /api/account/password/forgot` | Yêu cầu email khôi phục |
| `POST /api/account/password/reset` | Đổi mật khẩu bằng token |
| `POST /api/account/password/change` | Đổi khi biết mật khẩu hiện tại |
| `POST /api/account/password/add` | Thêm vào Google-only sau reauth |
| `POST /api/account/google/link` | Tạo ý định liên kết, bắt đầu OAuth |

Mọi API tài khoản riêng phải xác thực phiên và sessionVersion ở server. Không chỉ kiểm tra version lúc render menu: wallet, nộp lượt chạy, gộp khách, hồ sơ và endpoint bảo mật đều cần guard dùng chung. Phiên bị thu hồi không được gọi thành guest để tiếp tục dùng mã tài khoản.

## 11. UI và tình huống lỗi

- Bám style trang chủ, dùng font hiện có, responsive từ 320 px; không sửa CSS global gây ảnh hưởng game.
- Label rõ ràng, autocomplete chuẩn (`username`, `email`, `new-password`, `current-password`), cho paste và hỗ trợ trình quản lý mật khẩu.
- Nút có trạng thái đang gửi, ngăn double submit; lỗi inline, focus vào lỗi, thông báo truy cập được bằng screen reader.
- Có “Chơi khách”, đường về trang chủ và link quyền riêng tư.
- Mục bảo mật hiển thị email đã xác minh, các phương thức đang có và hành động liên kết/thêm/đổi mật khẩu. Không hiển thị hash, Google subject hoặc token.
- Không hiện email cá nhân trong phòng, bảng xếp hạng hoặc hồ sơ công khai. Tên hiển thị được giải thích là có thể xuất hiện cùng kết quả trận.
- Nếu dịch vụ email chưa cấu hình, không hiện form đăng ký hoạt động giả; giữ Google/khách, thông báo rõ khi truy cập trực tiếp chức năng email.

## 12. Cấu hình và vận hành

Giữ AUTH_SECRET, AUTH_URL và env Google hiện có. Bổ sung biến phía server:

- `AUTH_EMAIL_ENABLED`: cờ bật tính năng sau migration và kiểm tra.
- `RESEND_API_KEY`, `AUTH_EMAIL_FROM`: dịch vụ gửi và địa chỉ đã xác minh.
- `AUTH_PUBLIC_ORIGIN`: origin chuẩn tạo link email; production chỉ HTTPS.

Không dùng `NEXT_PUBLIC_` cho secret. Google và email được bật độc lập; thiếu cấu hình email không được làm hỏng chơi khách hoặc Google. Mongo phải hỗ trợ transaction như tính năng gộp hiện có. Không cần deploy Party nếu implementation giữ nguyên giao thức phòng.

Cập nhật `.env.example`, hướng dẫn setup và `/privacy`: dữ liệu xác minh, hash mật khẩu, email khôi phục, nhà cung cấp gửi email và thời gian token tồn tại. Các bản ghi pending/token hết hạn được dọn bằng TTL; dữ liệu rate-limit phải có chính sách TTL cụ thể.

## 13. Tiêu chí nghiệm thu

- Đăng ký → nhận email → xác nhận → đăng nhập bằng username/email thành công. Chưa xác minh không có phiên hoặc tiến độ tài khoản.
- Username/email trùng đồng thời không tạo tài khoản thứ hai; đăng ký pending không thể thay đổi mật khẩu Google hay chiếm email của người khác.
- Reset đúng email đến đúng tài khoản; token sai/hết hạn/dùng lại không đổi mật khẩu. Hai POST đồng thời chỉ một lần thành công.
- GET từ trình quét email không tiêu thụ token. Trang token không tải analytics và không đưa token vào referrer/log.
- Đổi/reset mật khẩu làm các phiên cũ mất quyền ở tất cả API bảo vệ; mật khẩu cũ không dùng được.
- Liên kết từ cả hai phía giữ nguyên playerId/xu/xe/lịch sử; trùng email không tự liên kết. Reauth hết hạn/nonce sai không liên kết được.
- Đăng nhập credentials từ khách vẫn gộp đúng một lần, kể cả hai tab, hai máy, retry và mất kết nối. Đăng xuất trở về mã khách riêng.
- Không cấu hình Google vẫn dùng email được; không cấu hình email vẫn dùng Google/khách được; thiếu cả hai vẫn chơi khách.
- Rate-limit hoạt động qua nhiều instance và email gửi không bị spam bằng resend/forgot; phản hồi không dò được email tồn tại.
- Mobile/desktop dùng được; các game, sảnh và menu hiện tại không hồi quy.

Kiểm tra bắt buộc: `npm run typecheck`, `npm run lint`, `npm run test:layout`, các test tài khoản hiện có và test mới cho đăng ký/token/reauth/thu hồi phiên/rate-limit. Test DB dùng database riêng; email dùng dịch vụ/hộp thư test. Xác minh thực tế một lượt đăng ký, khôi phục và Google-link trên môi trường staging; build thành công không thay thế kiểm tra nhận email.

## 14. Chia việc triển khai

1. **Nền tảng:** audit/migration, schema và index, tách cờ auth, guard sessionVersion dùng chung, dịch vụ email và rate-limit.
2. **Đăng ký/đăng nhập:** pending registration, xác minh/resend, Credentials provider, form và gộp khách.
3. **Khôi phục/bảo mật:** forgot/reset/change, thu hồi phiên, email thông báo.
4. **Liên kết:** Google-link, reauth, thêm mật khẩu, bảo vệ trùng email.
5. **Hoàn thiện:** kiểm thử race/bảo mật/UI, cập nhật privacy/setup, kiểm tra staging. Chủ web cấu hình domain và email env trước khi mở tính năng production.

Đã có code credentials, email, migration, các trang và kiểm thử; migration thật và dịch vụ email chưa được bật. Xem `docs/email-login-setup.md` để vận hành. Việc bật tính năng và triển khai production thực hiện sau cấu hình và kiểm tra staging.
