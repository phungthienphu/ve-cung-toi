# Thiết lập đăng ký bằng email và mật khẩu

Code dùng Auth.js Credentials + Google, Argon2id và MongoDB transactions. Phần email không cần thay đổi/deploy Party. Để mở trên production cần thực hiện các bước sau; chưa bật tính năng chỉ bằng việc deploy code.

## 1. Audit và migration tài khoản

Backup DB trước. Dùng đúng MONGODB_URI/MONGODB_DB_NAME của môi trường cần chuyển đổi; không dán giá trị secret vào Git hoặc chat.

```
npm run account:auth:migrate
```

Lệnh mặc định chỉ đọc, in số nhóm email trùng, thiếu email, tài khoản không xác định nguồn xác minh. Nếu có vấn đề thì dừng; không tự gộp hoặc xoá tài khoản. Kiểm tra provenance của các tài khoản Google cũ: code cũ chỉ nhận email_verified=true; nếu DB có import ngoài luồng thì phải xử lý/xác minh riêng.

Sau khi review audit và có backup:

```
npm run account:auth:migrate -- --apply
```

Lệnh backfill email chuẩn hoá, trạng thái xác minh của Google cũ và sessionVersion; đổi index Google subject sang partial để nhiều tài khoản mật khẩu không cần Google subject; tạo unique/TTL indexes. Giữ nguyên playerId và tiến độ. Nên chạy migration trong cửa sổ ngắn ngừng tạo tài khoản mới, trước khi bật credentials. Script không xoá index khác bằng syncIndexes. JWT cũ thiếu sessionVersion chỉ còn hợp lệ khi phiên bản trong DB vẫn là 0.

## 2. Cấu hình Resend

Tạo tài khoản Resend, xác minh domain gửi theo hướng dẫn SPF/DKIM; tạo API key giới hạn gửi email. Với tài khoản thử nghiệm chưa xác minh domain, nhà cung cấp có thể chỉ cho gửi tới email chủ tài khoản. Kiểm tra bằng hộp thư của bạn trước khi mở công khai.

Đặt trong `.env.local` hoặc Vercel:

```
AUTH_SECRET=<chuỗi bí mật đang dùng>
AUTH_URL=https://ve-cung-toi.vercel.app
AUTH_EMAIL_ENABLED=true
RESEND_API_KEY=<API key phía server>
AUTH_EMAIL_FROM=Chơi Cùng Tôi <taikhoan@your-verified-domain.example>
AUTH_PUBLIC_ORIGIN=https://ve-cung-toi.vercel.app
```

Local đổi AUTH_URL/AUTH_PUBLIC_ORIGIN về đúng cổng đang chạy, ví dụ `http://localhost:3012`. Production bắt buộc HTTPS. AUTH_PUBLIC_ORIGIN không chứa path/query và không được lấy từ request Host. Không cần Google env nếu chỉ mở mật khẩu; Google và email bật độc lập. Khởi động lại/redeploy sau khi đổi env.

AUTH_EMAIL_ENABLED phải giữ false cho tới khi migration, domain và kiểm tra xong. Thiếu một env email sẽ ẩn chức năng email; Google/khách vẫn hoạt động. Vercel sử dụng header IP do nền tảng ghi đè; proxy tự quản lý chỉ bật AUTH_TRUST_PROXY=true khi proxy thực sự ghi đè x-forwarded-for.

## 3. Luồng cần kiểm tra trước khi mở

- Đăng ký ở `/register`, nhận thư → mở link → chủ động xác nhận → đăng nhập bằng username hoặc email.
- Link dùng fragment `#token=...` để token không đi vào access log HTTP. Trang tự xoá fragment khỏi thanh địa chỉ sau khi đọc; không reload trang trước khi xác nhận. GET không đổi tài khoản.
- Quên mật khẩu: `/forgot-password`. Link hiệu lực 30 phút, dùng một lần. Sau reset/đổi/thêm mật khẩu, các phiên cũ bị thu hồi, phải đăng nhập lại.
- Gửi lại xác minh ở `/verify-email`. Token cũ bị thu hồi khi gửi lại; pending tồn tại 24 giờ. Pending hết hạn bị dọn thì đăng ký lại.
- Cùng email giữa Google và mật khẩu không tự gộp. Đăng nhập bằng phương thức đang có → menu → Bảo mật tài khoản → Liên kết Google.
- Google-only → Bảo mật → xác thực lại Google → chọn username và thêm mật khẩu. OAuth yêu cầu max_age=0; callback phải có auth_time gần đây. Nếu Google không cung cấp proof này, thao tác bị từ chối; không tự giảm yêu cầu bảo mật. Cần kiểm tra luồng này với OAuth thật trên staging.
- Xu/xe/kỷ lục vẫn dùng playerId cũ. Đăng nhập từ khách gộp tiến độ đã có trên server đúng một lần như trước.
- Email không tồn tại hay Google-only không tiết lộ qua phản hồi quên mật khẩu. Google-only nhận hướng dẫn Google; lỗi dịch vụ gửi vẫn phản hồi điều kiện chung, không hứa thư đã giao. Người dùng có thể gửi lại sau giới hạn 60 giây.
- Giới hạn gửi email theo địa chỉ dùng chung cho đăng ký/xác minh/khôi phục: tối đa 3/giờ, 1/phút. Giới hạn IP và tài khoản hỗ trợ chống spam; dữ liệu bộ đếm có TTL tối đa một giờ.

## 4. Kiểm thử cục bộ không gửi email thật

```
npm run test:account:credentials
npm run dev:account-review -- --email --no-google
# Terminal khác:
npm run test:account:credentials-api
```

Integration ép DB riêng `vct_account_review_20261104`, tạo/xoá chỉ fixtures ngẫu nhiên. Test credentials áp dụng index migration trên DB test này, không áp dụng DB app. Review server chỉ bind localhost:3014, dùng OAuth/secret giả, chặn chạy production/Vercel và chặn mọi gửi thư Resend thật. Đừng đưa bất kỳ giá trị review-only nào vào env production.

`--email` mở cả Google giả và email; thêm `--no-google` để thử credentials độc lập. `--guest-only` tắt cả hai. Review endpoint thu thư `/__review/mail` chỉ có trong script test cục bộ, không nằm trong app production.

Chạy thêm typecheck/lint/layout và test tài khoản cũ. Các kiểm thử dùng mail giả không chứng minh Resend gửi được vào inbox hoặc OAuth Google thật hoạt động. Cần một lượt đăng ký/reset/liên kết thật trên staging trước khi bật production.
