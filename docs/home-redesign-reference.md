# Trang chủ: thông số trích từ bản thiết kế

Nguồn: https://claude.ai/artifact/4Q8JHaBQNcjfKuLchxTpxj

Ngày đối chiếu: 2026-11-03. Đọc trực tiếp DOM, inline styles và CSS của các artboard; không ước lượng từ ảnh.

## Phạm vi và độ đầy đủ

Ba artboard: `Main.dc.html` (trang chủ desktop), `Mobile.dc.html` (hai mẫu mobile ngày/đêm), `MobileNews.dc.html` (bảng tin mobile).

Thông số dưới đây đủ làm mốc triển khai giao diện các màn này. Thiết kế chưa bao gồm sảnh, màn chơi, kết quả của từng game; chưa đủ để thay toàn bộ UI hệ thống. Toàn bộ 23 link trong Main đang trỏ `#`, nên cần nối lại route thật và xây dựng tương tác sản phẩm. Không coi các trạng thái chưa có trong mẫu là đã được đặc tả.

## Màu sắc

| Vai trò | Ban ngày | Ban đêm trên mẫu mobile |
| --- | --- | --- |
| Nền trang | `#ecc489` | `#0f2418` |
| Nền hero | `#4fa8e6` | `#142a52` |
| Bề mặt card | `#fffaf0` | `#183a27` |
| Chữ chính | `#2e1c0f` | `#f4efdc` |
| Viền và bóng cứng | `#2e1c0f` | `#050c08` |

Màu phụ desktop: CTA `#ffc23a`, nền badge `#f6e2bd`, chữ mô tả card `#5c3d22`, mô tả hero `#1f2f45`, bảng tin nâu `#8a5530`, chữ trên bảng tin `#fff3dc`, thông báo đỏ `#ef4f36`. Badge NEW dùng gradient `#ff9db5` → `#ffe0e8` → `#ff9db5`.

## Typography

- Heading/logo/CTA chính: `Baloo 2`, fallback `system-ui, sans-serif`, weight 800.
- Nội dung: `Be Vietnam Pro`, fallback `system-ui, sans-serif`.
- Logo: desktop 26px, mobile 21px, line-height 1.
- H1 desktop: 58px/1, letter-spacing -0.5px. Mobile: 36px/1.02.
- Mô tả hero desktop: 18px/1.55, weight 500, max-width 560px. Mobile: 15px/1.5, max-width 300px.
- Tên game nổi bật desktop: 40px/1.02, weight 800.
- Tên game card thường desktop: 22px/1.15, weight 800.
- Mô tả card nổi bật desktop: 15px/1.6, max-width 520px.
- Heading bảng tin desktop: 23px/1; phần hướng dẫn: 32px/1.1; tiêu đề bước: 20px/1.2.

## Desktop và responsive

- Khung nav/main: max-width 1280px, căn giữa, padding ngang 32px.
- Nav: padding dọc 16px, gap 8px; logo gap 10px.
- Khối heading: padding 32px 32px 0; mô tả cách heading 10px; dải đồi SVG cao 88px.
- Main: padding 4px 32px 0.
- Layout: `minmax(0,1fr) 300px`, gap 24px, align-items start.
- Lưới game: 3 cột `minmax(0,1fr)`, gap 20px.
- Card nổi bật span 2 cột × 2 hàng; card ngang span 2 cột.
- Ba bước hướng dẫn: 3 cột, gap 20px.

CSS gốc điều khiển breakpoint:

```css
@media (max-width:1100px) {
  .layout { grid-template-columns:1fr; }
  .side { display:none; }
  .ticker { display:flex; }
}
@media (max-width:760px) {
  .grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
  .span-f { grid-row:auto; }
  .steps { grid-template-columns:1fr; }
}
@media (max-width:640px) {
  .nav-label, .clouds { display:none; }
}
```

## Card, CTA và bộ lọc

- Card nổi bật desktop: radius 22px, viền 2.5px, bóng `0 6px 0 #2e1c0f`; ảnh min-height 260px, object-fit cover, object-position 45% 45%; vùng chữ padding 20px 24px 24px, gap 12px.
- Card thường desktop: radius 18px, viền 2.5px, bóng `0 5px 0 #2e1c0f`; ảnh cao 196px; vùng chữ padding 12px 16px 16px, gap 2px.
- CTA chính desktop: min-height 50px, padding ngang 24px, radius 14px, viền 2.5px, bóng `0 4px 0 #2e1c0f`, font Baloo 2 800 20px.
- CTA phụ desktop: min-height 50px, padding ngang 18px, radius 14px, viền 2.5px, font nội dung 700 15px.
- Filter desktop: min-height 44px, padding ngang 18px, radius 999px, viền 2.5px; gap 10px, margin-bottom 22px. Active nền mực/chữ kem, inactive nền kem/chữ mực.
- Badge mới có animation shine 2.8s linear infinite; tắt khi `prefers-reduced-motion: reduce`.

## Mobile ngày/đêm

Artboard đặt hai mẫu rộng 390px cạnh nhau trong khung 860px, gap 80px, min-height 2500px. Đây là kích thước trình bày thiết kế, không phải chiều rộng/chiều cao cố định cho trang thật. Bo góc mô phỏng thiết bị 36px không áp lên body ứng dụng.

- Padding nav: 14px 16px 0; heading: 26px 16px 0.
- Nút icon header: 44×44px, radius 14px, viền 2px.
- Dải đồi SVG cao 56px, margin-top 6px.
- Filter cuộn ngang: gap 8px, padding 2px 16px 4px, margin-bottom 14px; nút cao tối thiểu 44px, padding ngang 16px, font 14px, viền 2px.
- Ticker: margin 0 16px 14px, min-height 48px, padding 6px 12px 6px 7px, gap 10px, radius 14px, viền 2px, bóng 0 3px; chữ một dòng có ellipsis.
- Card nổi bật: margin ngang 16px, radius 20px, viền 2px, bóng 0 4px. Ảnh cao 196px, object-position 42% 45%.
- Grid card thường: 2 cột, gap 12px, padding ngang 16px, margin-top 18px.
- Dark mode là một mẫu riêng bên cạnh light mode; chưa chứng minh có cơ chế đổi theme, lưu lựa chọn hoặc theo giờ trong prototype.

## Bảng tin mobile

- Khung mẫu 390×844px; overlay `rgba(24,14,6,.58)`.
- Sheet: top 118px, left/right/bottom 0; nền kem, radius 26px 26px 0 0, viền trên 2.5px, bóng `0 -4px 0 #2e1c0f`.
- Handle: 46×5px, radius 999px, màu `#c9a26c`, margin-top 10px.
- Header padding 12px 16px, gap 10px; bảng tiêu đề cao 48px, radius 12px, viền 2.5px, bóng 0 4px.
- Khi triển khai phải thích ứng chiều cao viewport và safe-area, nội dung cuộn trong sheet; bổ sung focus trap, đóng bằng Escape/backdrop và trả focus về nút mở. Các hành vi này là yêu cầu triển khai, chưa xác nhận từ mẫu.

## Áp dụng vào repo

- Trang hiện tại: `src/app/page.tsx`; giữ đủ danh mục game và URL thật hiện có. Mẫu tham chiếu không liệt kê đầy đủ mọi tính năng của repo.
- Tách các phần HomeHeader, GameFilters, FeaturedGameCard, GameCard, NewsPanel/NewsSheet, HowToPlay và HomeFooter vào feature riêng nếu triển khai.
- Gom token dưới phạm vi home/theme; không thay màu, font hoặc CSS toàn cục của các màn game chỉ vì trang chủ đổi thiết kế.
- Dùng metadata có cấu trúc cho khả năng chơi solo/bot/số người; không lọc bằng chuỗi mô tả. Xe tăng hiện đã có luyện tập local và bot nên metadata cũ cần cập nhật.
- News trong mẫu là nội dung tĩnh và ngày tương đối; cần nguồn dữ liệu ngày phát hành thật, không hardcode “Hôm nay”.
- Artwork cần đối chiếu với asset thật trong `public/`; chưa trích xuất/bundle file ảnh gốc từ artifact. Không dùng URL asset tạm có token của Claude cho production.
- Cần kiểm tra hover/focus/pressed/disabled, loading/empty/error, dark mode desktop, tablet, nội dung tiếng Việt dài và màn hình 320–430px. Các trạng thái này chưa được đặc tả đầy đủ trong ba artboard.

## Trạng thái

Đã triển khai trang chủ trong `src/features/home`, CSS và font được giới hạn riêng cho trang chủ. Danh mục có bộ lọc theo metadata, giao diện sáng/tối và bảng tin responsive.

Bảng tin mặc định tối đa 5 tin mới nhất; bấm Xem thêm mở chế độ cuộn tải tiếp qua `/api/news` với cursor ID, mỗi trang tối đa 5 tin. Có trạng thái tải, lỗi/thử lại và hết tin. Nội dung phát hành được quản lý trong `src/features/home/data/news.ts`; chưa có database hoặc CMS.
