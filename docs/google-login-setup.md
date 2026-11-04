# Google login (Auth.js)

## Cấu hình Google Cloud

1. Google Auth Platform → Branding: tên Chơi Cùng Tôi, email hỗ trợ của chủ web, trang chủ `https://ve-cung-toi.vercel.app`, privacy `https://ve-cung-toi.vercel.app/privacy`.
2. Audience: External. Khi Testing, thêm các email thử nghiệm vào Test users; chỉ các email đó đăng nhập được. Chuyển Production khi sẵn sàng mở công khai, làm theo yêu cầu xác minh Google hiển thị.
3. Data Access: chỉ `openid`, `email`, `profile`. Không yêu cầu Gmail/Drive.
4. Clients → Create client → Web application. Không tick AI-powered agent.
5. Origins: `https://ve-cung-toi.vercel.app`, `http://localhost:3012` (đổi cổng nếu dùng cổng khác).
6. Redirect URIs: `https://ve-cung-toi.vercel.app/api/auth/callback/google`, `http://localhost:3012/api/auth/callback/google`.
7. Lưu Client ID/Secret vào biến môi trường, không đưa vào Git/chat. Không dùng tiền tố NEXT_PUBLIC cho secret.

## Biến môi trường

Thiết lập trong `.env.local` và Vercel → Project → Settings → Environment Variables:

```
AUTH_GOOGLE_ID=<Google Client ID>
AUTH_GOOGLE_SECRET=<Google Client Secret>
AUTH_SECRET=<chuỗi ngẫu nhiên tối thiểu 32 byte>
AUTH_URL=https://ve-cung-toi.vercel.app
```

Sinh AUTH_SECRET bằng `openssl rand -base64 32` và dán trực tiếp vào nơi quản lý biến môi trường. Local đặt `AUTH_URL=http://localhost:3012`. Vercel có thể cần `AUTH_TRUST_HOST=true` khi Auth.js báo UntrustedHost; chỉ bật sau proxy đáng tin của ứng dụng. `MONGODB_URI` và `MONGODB_DB_NAME` giữ cấu hình sẵn có.

MongoDB **phải hỗ trợ transactions (replica set, ví dụ Atlas)**; gộp xu/lượt chơi chạy trong transaction. Không tự hạ xuống nhiều lệnh độc lập khi Mongo không hỗ trợ. Chạy test tích hợp trên DB thử riêng trước khi mở đăng nhập.

Sau khi thêm env: restart local / redeploy Vercel. Chưa đủ ba biến AUTH_GOOGLE_ID/SECRET và AUTH_SECRET thì không hiện nút đăng nhập; chơi khách vẫn hoạt động.

## Nguyên tắc tiến độ

- Tài khoản dùng Google `sub` duy nhất, không tự liên kết bằng email. Lưu tên/email/ảnh/mã chơi trong `AccountUser`, không lưu access token Google hay mật khẩu. Phiên JWT mã hoá của Auth.js.
- Chỉ gộp dữ liệu đã có trên server. Pending runs được gửi qua kiểm tra cũ trước khi gộp; không nhập xu/xe từ localStorage vào ví server.
- Mỗi ví khách chuyển đúng một lần, dù retry/nhiều tab/đăng nhập hai tài khoản. Hai máy có hai ví khách: cộng số xu còn lại, hợp xe, chuyển các lượt chạy giữ kỷ lục lớn nhất theo từng map/ngày.
- Giữ runId và creditedRuns để không cộng xu lần hai khi retry. Mã khách đã chuyển bị khoá; sau thành công tạo mã khách mới trên máy để đăng xuất vẫn chơi khách bình thường, không tiêu lại xu đã chuyển.
- Account ID vẫn xuất hiện trong phòng nhưng mọi đọc ví/mua xe/nộp lượt chơi theo mã tài khoản phải có đúng phiên. Server Party không đổi.
- Giới hạn giữ nguyên theo scope: mã **khách cũ** là bearer code, không có bằng chứng sở hữu mạnh. Biết mã khách có thể thao tác hoặc nhận tiến độ khách trước chủ máy. Đăng nhập bảo vệ mã tài khoản, không thể xác minh hồi tố chủ sở hữu mã khách cũ. Chưa phải chống gian lận vật lý/lượt chạy giả; kiểm tra hiện có chỉ chặn payload vô lý.

## Checklist thử thực tế

- Không env Google: tất cả game vẫn vào được bằng khách.
- Google Testing: đăng nhập email test, tên/ảnh menu đúng; logout không còn gọi API dưới mã tài khoản.
- Máy A khách có xu/xe/kỷ lục → login → gộp một lần. Login/logout lại không cộng trùng.
- Máy B khách có tiến độ → cùng Google → cộng xu, hợp xe, lấy max từng map/ngày.
- Hai tab đăng nhập/gộp đồng thời; hai tài khoản tranh một mã khách; retry run sau gộp: không nhân xu, không đổi chủ.
- Dùng mã tài khoản qua curl không cookie hoặc cookie tài khoản khác: wallet GET/POST, runs POST đều 403. Guest vẫn như cũ.
- Test OAuth cần Client ID/Secret thật và thao tác đăng nhập của chủ tài khoản; static checks không thay thế được bước này.

## Tái chạy kiểm tra cục bộ

- `npm run test:account`: identity/cache, không cần DB.
- `npm run test:account:merge`: dùng MONGODB_URI từ `.env.local` nhưng **ép DB riêng** `vct_account_review_20261104`; tạo/xoá chỉ bản ghi test ngẫu nhiên.
- `npm run dev:account-review`: server localhost **3014**, DB review ở trên, OAuth/JWT **giả chỉ dùng test**. Không dùng server này để đăng nhập Google thật. Chạy `npm run test:account:api` ở terminal khác để kiểm tra các phiên đúng/sai bằng JWT fixture. Dừng bằng Ctrl+C sau kiểm tra.
- Server review chỉ bind 127.0.0.1 và từ chối môi trường Vercel/production. Không đưa giá trị fixture vào Vercel hoặc `.env.local`.
- `NEXT_BUILD_DIR=.next-account-build npm run build`: build riêng không ghi đè `.next` của local dev đang chạy.

- `npm run dev:account-review -- --guest-only`: cố ý bỏ toàn bộ cấu hình OAuth/secret để kiểm tra chơi khách; `/api/auth/session` trả `null`, không báo lỗi cấu hình.

## Hồ sơ chung và thống kê các game

- `/profile` là trang riêng của tài khoản đang đăng nhập, truy cập từ menu tài khoản; không công khai email hay mã người chơi.
- Hoàng Kim đọc ví/lượt chạy đã lưu. Tank, Vẽ, Soccer, Ma sói, Hải chiến và Ai là heo đọc kết quả trận từ Cloudflare. Mỗi game có số trận, số thắng, tỉ lệ thắng riêng; không gộp tiền/vật phẩm.
- Tạo thêm `GAME_HISTORY_SECRET` ngẫu nhiên (ví dụ `openssl rand -hex 32`), đặt cùng giá trị trong Vercel/local và Cloudflare qua `npx wrangler secret put GAME_HISTORY_SECRET`. Không dùng lại `AUTH_SECRET`, không thêm tiền tố `NEXT_PUBLIC_`.
- Cần deploy cả web và Party cho phần báo cáo kết quả mới. Chưa có secret vẫn chơi và lưu lịch sử chung bình thường, nhưng các kết quả chưa xác minh không được tính vào hồ sơ.
- Trận cũ chỉ có tên không được ghép theo tên. Mã khách đã gộp được liên kết qua marker chuyển tiến độ; đăng nhập trên máy khác có thể gộp tiếp lịch sử khách máy đó.
- Chỉ số thắng lấy từ kết quả do phòng tính: Tank/Soccer theo đội hoặc người thắng, Vẽ tính đồng hạng cao nhất, Ma sói theo phe, Hải chiến theo người/đội thắng, Ai là heo theo hạng nhất. Bot không có thống kê tài khoản. Trận luyện tập không được báo cáo vẫn không tính.
- Brawler/Math Boss chưa có lưu kết quả; Math Quest giữ hồ sơ học sinh riêng, chưa liên kết Google.
- Xác thực báo cáo bảo vệ kênh Cloudflare → web; chưa phải cơ chế chống giả danh khi tham gia phòng. Phòng hiện vẫn nhận mã người chơi do client gửi, nên thống kê chỉ để tham khảo, không dùng trao xu hoặc phần thưởng có giá trị.

## Đăng nhập bằng email/mật khẩu

Xem [email-login-setup.md](email-login-setup.md) cho migration index/tài khoản và cấu hình Resend. Khi email được bật, không cần env Google để có nút đăng nhập. `googleSubject` trở thành optional, nhưng định danh Google vẫn theo subject và không tự liên kết bằng email. Phiên có sessionVersion và bị thu hồi sau thay đổi mật khẩu.
