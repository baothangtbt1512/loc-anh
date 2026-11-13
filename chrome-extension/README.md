# Swipe Photo Cleaner — Extension Dọn Ảnh Google Photos Kiểu Quẹt Thẻ

Chrome Extension (Manifest V3) chạy trực tiếp trên **Google Photos** (`https://photos.google.com`), giúp dọn ảnh chụp màn hình cũ, ảnh chụp thử bị mờ hoặc video nặng theo từng tháng nhanh gọn và an toàn.

## Tính năng chính
- **Gom ảnh theo từng tháng:** Tự động gom ảnh/video theo tháng (`Tháng 11/2026`, `Tháng 10/2026`...) kèm số lượng còn lại và bộ lọc nhanh (`Tất cả`, `📱 Chụp màn hình`, `🎬 Video`).
- **Hiển thị to rõ & Quẹt 3 hướng:**
  - **Quẹt Phải** (`→` hoặc `D`): **Giữ lại**
  - **Quẹt Trái** (`←` hoặc `A`): **Bỏ vào thùng chờ xóa** (chưa xóa ngay!)
  - **Quẹt Lên** (`↑` hoặc `W` hoặc `F`): **Yêu thích ♥**
  - **Hoàn tác** (`Z` hoặc `Backspace`) bất kỳ lúc nào, **Soi nét 100%** (`Space`).
- **Xem trước dung lượng sắp giải phóng trước khi xóa thật:** Hiển thị tổng dung lượng dự kiến giải phóng (ví dụ `Giải phóng 1.42 GB`), phân bổ theo tháng, và cho phép **"Giữ lại"** từng tấm trong màn hình Xem lại.
- **Lưu trực tiếp vào Google Photos:** Khi bấm xác nhận, extension sẽ tự động gắn sao **Yêu thích** và chuyển các ảnh chờ xóa vào **Thùng rác (Trash)** thật trên tài khoản Google Photos (vẫn có 60 ngày khôi phục).

## Cách cài đặt vào Chrome / Edge
1. Mở Chrome và truy cập `chrome://extensions/` (hoặc Edge: `edge://extensions/`).
2. Bật **Developer mode** (Chế độ dành cho nhà phát triển) ở góc trên bên phải.
3. Bấm **Load unpacked** (Tải tiện ích đã giải nén) và chọn thư mục `swipe-photo-cleaner`.
4. Mở [https://photos.google.com/](https://photos.google.com/) (đăng nhập tài khoản của bạn), bấm nút **Quẹt Dọn Ảnh** ở góc dưới bên phải hoặc nhấn `Alt + Shift + S` (hoặc bấm biểu tượng extension trên thanh công cụ).

## Thử nghiệm an toàn trên Sandbox (Offline)
Bấm vào biểu tượng extension trên Chrome → **Chạy thử trên Sandbox Mô Phỏng** (hoặc mở `demo/sandbox.html`) để trải nghiệm đầy đủ thao tác quẹt, tính dung lượng giải phóng, màn hình xem lại và mô phỏng chuyển vào thùng rác trước khi dùng trên thư viện thật.

## Kiểm thử tự động
```bash
node --test tests/*.test.js
```
