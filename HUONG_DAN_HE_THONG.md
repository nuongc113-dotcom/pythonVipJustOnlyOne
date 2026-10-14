# 🚀 HỆ THỐNG ĐIỂM DANH & NHẬN DIỆN KHUÔN MẶT AI PRO (FULLSTACK)

Hệ thống hoàn chỉnh gồm 3 thành phần liên kết chặt chẽ:
1. **Frontend Web App (`Frontend/`)**: Giao diện người dùng hiện đại (HTML5 + Vanilla CSS + JS).
2. **AI Service (`FaceRecognitionAI/`)**: Dịch vụ AI Deep Learning (Python Flask + YuNet Face Detector + SFace 128D Embedding).
3. **Backend Service (`Backend/`)**: Máy chủ ASP.NET Core Web API (.NET 10 + EF Core + SQLite `attendance.db`).

---

## 🖥️ Các tính năng chính trong Web App:

### 👑 1. Phân quyền vai trò tối giản: Quản lý vs Nhân viên
* **Quản lý (Admin - Toàn quyền)**:
  * Có tất cả các quyền trong hệ thống: Điểm danh (Check-in/Check-out), Đăng ký khuôn mặt mới, Quản lý CSDL nhân sự, Xóa nhân viên, Xem toàn bộ nhật ký điểm danh.
  * Có nút chuyển sang chế độ "Nhân viên".
* **Nhân viên (User - Chỉ được quét mặt)**:
  * Giao diện tối giản tối đa: Chỉ hiển thị duy nhất màn hình quét mặt điểm danh.
  * Ẩn hoàn toàn Tab "2. Đăng Ký Khuôn Mặt" và Tab "3. Quản Lý Nhân Sự".
  * Để chuyển sang Quản lý: Bấm nút *"Đổi sang Quản lý"*, nhập mã PIN bảo mật (Mặc định: `123456` hoặc `admin`).

### ⏱️ 2. Điểm danh 2 kiểu: Giờ Check-in & Giờ Check-out (Tab 1)
* Nút bấm trực quan chuyển đổi giữa **"GIỜ CHECK-IN" (Vào ca)** và **"GIỜ CHECK-OUT" (Tan ca)**.
* Tự động phát âm thanh và giọng nói tiếng Việt tương ứng:
  * Check-in: *"Điểm danh Check-in thành công! Xin chào [Tên]"*.
  * Check-out: *"Điểm danh Check-out thành công! Tạm biệt [Tên], hẹn gặp lại"*.
* Lưu chính xác loại điểm danh vào CSDL SQLite và file CSV với Badge màu sắc riêng biệt (Xanh lá / Cam).

### 🛡️ 3. Chống trùng lặp khuôn mặt & Bắt chụp lại (Tab 2)
* Khi chụp ảnh hoặc tải ảnh đăng ký:
  * Python AI tự động trích xuất vector 128D và so khớp với toàn bộ CSDL hiện có.
  * **Nếu khuôn mặt đã tồn tại**:
    * Hiển thị cảnh báo đỏ rực: *"ĐÃ ĐĂNG KÍ KHUÔN MẶT RỒI! (Trùng khớp với nhân viên: [Tên])"*.
    * Phát âm thanh cảnh báo lỗi.
    * Tự động xóa ảnh xem trước, **bắt buộc phải chụp lại** và **tuyệt đối không thêm vào data**!
  * **Nếu khuôn mặt mới**: Báo tick xanh *"Hợp lệ"* và cho phép lưu vào Database.

### 📋 4. Quản lý nhân sự & Nhật ký (Tab 3 - Dành cho Quản lý)
* Hiển thị danh sách tất cả những người đã đăng ký tương ứng với cơ sở dữ liệu SQLite (`attendance.db`).
* Hiển thị Họ tên, Avatar, ID, Badge trạng thái Vector AI 128D, và mẫu chuỗi vector.
* Thanh tìm kiếm nhanh nhân viên theo tên hoặc mã.
* Bảng nhật ký điểm danh toàn bộ nhân viên: Hiển thị rõ cột Kiểu Điểm Danh (Check-in / Check-out), Giờ, Ngày, Độ khớp.
* Nút Xóa nhân viên trực tiếp (đồng bộ xóa trong C# Backend).

---

## ⚡ Cách khởi chạy trên máy tính mới / Gửi cho bạn bè

### Bước 1: Chuẩn bị môi trường (Chỉ làm 1 lần đầu tiên)
Nhấp đúp chuột vào file:
👉 **`1_CAI_DAT_MOI_TRUONG.bat`**
*(File này sẽ tự động cài các thư viện Python: OpenCV, Flask, NumPy... và kiểm tra xem máy đã có .NET SDK chưa)*

> **Lưu ý quan trọng:**
> - Máy tính cần cài sẵn **Python** (tải tại [python.org](https://www.python.org/downloads/), nhớ tích chọn *"Add python.exe to PATH"*).
> - Backend C# cần **.NET SDK** (tải tại [dotnet.microsoft.com](https://dotnet.microsoft.com/download)).

### Bước 2: Chạy hệ thống
Nhấp đúp chuột vào file:
👉 **`2_CHAY_HE_THONG.bat`**
*(Hoặc mở Terminal gõ: `python run_system.py`)*

Lệnh này sẽ tự động:
1. Khởi chạy **C# Backend** tại `http://localhost:5286`.
2. Khởi chạy **Python AI Service** tại `http://localhost:5001`.
3. Khởi chạy **Frontend Web App** tại `http://localhost:8080`.
4. Tự động mở trình duyệt web hiển thị ứng dụng!
