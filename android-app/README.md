# Swipe Dọn Ảnh (`swipe-photo-cleaner-android`)

Ứng dụng Android (Kotlin + Jetpack Compose) giúp dọn ảnh chụp màn hình cũ, ảnh chụp thử bị mờ và video nặng trực tiếp trên điện thoại theo thao tác quẹt thẻ.

## Tính năng chính
- **Gom ảnh & video theo từng tháng (`MediaStore`):** Tự động phân nhóm theo từng tháng (`Tháng 11/2026`, `Tháng 10/2026`, ...), kèm bộ lọc **Tất cả / 📱 Chụp màn hình / 🎬 Video**.
- **Quẹt thẻ 3 hướng mượt mà:**
  - **Quẹt Phải:** Giữ lại
  - **Quẹt Trái:** Bỏ vào Thùng chờ xóa (chưa xóa ngay)
  - **Quẹt Lên:** Yêu thích ♥
  - Hỗ trợ **Hoàn tác**, **Soi nét**, và **Mở xem video**.
- **Xem trước dung lượng giải phóng:** Tính tổng MB / GB sẽ dọn được (vd: `1.42 GB`), phân bổ theo từng tháng, và cho phép **↩ Giữ lại** từng tấm trước khi bấm xác nhận.
- **Lưu thật vào hệ thống Android:**
  - Trên **Android 11+ (API 30+)**: Gọi hộp thoại xác nhận chính thức của hệ thống (`MediaStore.createFavoriteRequest` & `MediaStore.createTrashRequest`) để gắn sao Yêu thích và chuyển vào **Thùng rác hệ thống** (còn 30 ngày khôi phục).
  - Nếu bạn bật Sao lưu & Đồng bộ trên Google Photos, các thay đổi ảnh trên máy sẽ tự đồng bộ lên Google Photos.

## Build APK bằng dòng lệnh (JDK 21)
```powershell
$env:JAVA_HOME = 'D:\Android\jdk-21'
.\gradlew.bat testDebugUnitTest assembleRelease --no-daemon
```
File APK hoàn chỉnh nằm tại `SwipePhotoCleaner.apk` (và `app/build/outputs/apk/release/app-release.apk`).
