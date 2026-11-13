# locanh

**Swipe Photo Cleaner (Lọc Ảnh Kiểu Quẹt Thẻ)** — Bộ đôi công cụ giúp dọn ảnh chụp màn hình cũ, ảnh chụp thử bị mờ và video nặng cực nhanh, gom nhóm theo từng tháng và xem trước tổng dung lượng sắp giải phóng trước khi xóa thật.

## 1. Bản App Android (`.apk` — dọn ảnh lưu trên máy)
Thư mục: `android-app/`
- File cài đặt sẵn: `android-app/SwipePhotoCleaner.apk` (~970 KB)
- Gom ảnh & video theo từng tháng (`MediaStore`), quẹt phải **Giữ**, quẹt trái **Chờ xóa** (xem trước tổng MB/GB sẽ giải phóng), quẹt lên **Yêu thích**.
- Dùng hộp thoại hệ thống Android (`createTrashRequest` / `createFavoriteRequest` trên Android 11+) để chuyển vào **Thùng rác hệ thống** an toàn (khôi phục 30 ngày).

## 2. Bản Chrome Extension (chạy trực tiếp trên `photos.google.com`)
Thư mục: `chrome-extension/`
- Chạy trực tiếp trên trang web **Google Photos** (`https://photos.google.com/`), gom theo từng tháng, đo dung lượng thực tế và lưu **Yêu thích / Thùng rác** thật vào tài khoản Google Photos Cloud.
- Cài đặt: mở `chrome://extensions/` → bật **Developer mode** → **Load unpacked** → chọn thư mục `chrome-extension/`.
