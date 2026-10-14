# 📷 HỆ THỐNG NHẬN DIỆN & ĐIỂM DANH KHUÔN MẶT AI (PYTHON)

Mô hình AI nhận diện khuôn mặt được thiết kế để đồng bộ 100% với Backend C# ASP.NET Core & CSDL SQLite (`attendance.db`).

---

## 📁 Cấu trúc thư mục `FaceRecognitionAI`

```text
FaceRecognitionAI/
├── face_extractor.py       # [Trích xuất đặc trưng] Phát hiện mặt & chuyển ảnh thành mảng 128 số float
├── backend_sync.py         # [Đồng bộ Backend] Đọc/ghi trực tiếp SQLite hoặc gọi REST API
├── attendance_camera.py    # [Chương trình chính] Mở Webcam nhận diện realtime, điểm danh & đăng ký
├── test_pipeline.py        # [Kiểm thử tự động] Test trích xuất vector từ ảnh mẫu và so khớp
├── attendance_history.csv  # [Nhật ký điểm danh] Lưu lại các lần quẹt mặt thành công
└── requirements.txt        # Các thư viện phụ thuộc (OpenCV, NumPy)
```

---

## 🚀 Cách chạy hệ thống

### 1. Kiểm thử mô hình với ảnh mẫu (Không cần Webcam):
```bash
python test_pipeline.py
```
* Tự động phát hiện khuôn mặt từ ảnh.
* Trích xuất mảng vector 128 chiều.
* So sánh khoảng cách Euclidean với CSDL SQLite của Backend.

### 2. Chạy ứng dụng điểm danh bằng Webcam thời gian thực:
```bash
python attendance_camera.py
```

**Các phím chức năng khi mở Webcam:**
* **`[R]`**: **Đăng ký người mới** – Đứng trước camera, bấm phím `R`, sau đó gõ Họ và Tên trong Terminal $\rightarrow$ Hệ thống tự trích xuất vector và lưu ngay vào CSDL SQLite của Backend.
* **`[S]`**: **Đồng bộ lại CSDL (Sync)** – Cập nhật danh sách nhân viên mới nhất từ Backend.
* **`[Q]` hoặc `[ESC]`**: Thoát chương trình.

---

## 🔗 Liên kết dữ liệu với Backend C#
* **Vector khuôn mặt:** Mảng 128 số thực float được chuẩn hóa L2 norm.
* **Công thức so khớp:** Tính khoảng cách sai số Euclidean:
  $$\text{Distance} = \sqrt{\sum (v_1 - v_2)^2}$$
  Ngưỡng nhận diện: $\le 0.55$ (Độ tin cậy $\ge 50\% - 100\%$).
* **Lưu trữ:** Lưu trực tiếp vào bảng `People` trong file [attendance.db](file:///d:/The%20Hundred-Billion%20Project%20with%20Brother%20Toan/testDiemDanhKhuonMat/Backend/Backend/attendance.db) và thư mục ảnh `wwwroot/uploads/faces`.
