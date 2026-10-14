"""
====================================================================
📷 CHƯƠNG TRÌNH ĐIỂM DANH KHUÔN MẶT PRO (CHỐNG CHÓI, NGƯỢC SÁNG & ĐA CỰ LY)
====================================================================
Cải tiến công nghệ:
  1. Sử dụng chuẩn Cosine Similarity (Deep Learning Benchmark):
     - Ngưỡng nhận diện thông minh (mặc định 0.42) nhận diện mượt mà:
       + Đứng xa (3 - 5 mét) lẫn đứng gần
       + Điều kiện ánh sáng mạnh (ban ngày / đèn tuýp / ngược sáng)
       + Đeo kính hoặc không đeo kính
  2. Tính năng Bù sáng thông minh (Phím [L] - Backlight/Lighting Boost):
     - Tự động cân bằng vùng sáng tối (CLAHE LAB) khi camera bị lóa sáng
  3. Tùy chỉnh độ nhạy ngay trên màn hình (Phím [+] và [-])
====================================================================
"""

import cv2
import time
from face_extractor import FaceExtractor
from backend_sync import BackendSync

# Ngưỡng Cosine Similarity nhận diện chuẩn:
# Trong SFace: Cosine >= 0.363 là cùng 1 người.
# Mặc định để 0.42: Rất an toàn, chống nhận nhầm người khác nhưng cực nhạy khi có sáng/đứng xa.
DEFAULT_COSINE_THRESHOLD = 0.42

def main():
    print("=" * 72)
    print("🚀 KHỞI ĐỘNG HỆ THỐNG ĐIỂM DANH AI PRO (ĐA CỰ LY & BẤT BIẾN ÁNH SÁNG)")
    print("=" * 72)

    extractor = FaceExtractor(score_threshold=0.38)
    sync = BackendSync()

    # Tải danh sách người đã đăng ký từ SQLite
    print("📦 Đang nạp cơ sở dữ liệu nhân viên từ Backend SQLite...")
    people = sync.get_all_people()
    print(f"✅ Đã tải thành công {len(people)} hồ sơ khuôn mặt từ CSDL:")
    for p in people:
        print(f"   • Id: {p.get('id'):<2} | Tên: {p.get('name')}")

    # Kết nối Webcam
    print("\n📷 Đang kết nối Webcam...")
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("❌ Lỗi: Không thể mở Webcam! Vui lòng kiểm tra lại thiết bị.")
        return

    # Tối ưu kích thước khung hình
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 960)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 540)

    # Cài đặt động trong lúc chạy
    cosine_threshold = DEFAULT_COSINE_THRESHOLD
    use_lighting_boost = False

    print("=" * 72)
    print("💡 BẢNG ĐIỀU KHIỂN BẰNG BÀN PHÍM:")
    print("   [+] / [-] : Tăng / Giảm độ nhạy nhận diện (Threshold)")
    print("   [L]       : Bật / Tắt chế độ 'Bù sáng & Chống ngược sáng' (Light Boost)")
    print("   [R]       : Đăng ký khuôn mặt hiện tại vào hệ thống")
    print("   [S]       : Tải lại cơ sở dữ liệu từ Backend")
    print("   [Q] / ESC : Thoát chương trình")
    print("=" * 72)

    last_logged_time = {}
    fps_time = time.time()
    fps = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Lật ảnh gương
        frame = cv2.flip(frame, 1)
        h, w, _ = frame.shape

        now = time.time()
        fps = int(1.0 / (now - fps_time)) if (now - fps_time) > 0 else fps
        fps_time = now

        # Phát hiện mặt và trích xuất vector 128D
        detections = extractor.detect_and_extract(frame, use_lighting_enhancement=use_lighting_boost)

        current_face_crop = None
        current_vector = None

        for item in detections:
            x, y, fw, fh = item["bbox"]
            landmarks = item["landmarks"]
            vector = item["vector"]
            aligned_face = item["aligned_face"]

            current_face_crop = aligned_face
            current_vector = vector

            # Tìm người có độ tương đồng Cosine cao nhất trong Database
            best_person = None
            max_cosine = -1.0

            for p in people:
                db_vec = p.get("vector")
                if db_vec and len(db_vec) == 128:
                    cos_sim = extractor.calculate_cosine_similarity(vector, db_vec)
                    if cos_sim > max_cosine:
                        max_cosine = cos_sim
                        best_person = p

            # Đánh giá theo ngưỡng Cosine Similarity
            if best_person and max_cosine >= cosine_threshold:
                # NHẬN DIỆN THÀNH CÔNG
                color = (0, 220, 0) # Xanh lá
                name = best_person.get("name", "Unknown")
                p_id = best_person.get("id")
                confidence_pct = extractor.cosine_to_confidence_percent(max_cosine)
                label = f"{name} ({confidence_pct}% - cos:{max_cosine:.2f})"
                status_text = "DIEM DANH THANH CONG"

                # Ghi nhận log (10s/lần/người)
                last_time = last_logged_time.get(name, 0)
                if now - last_time > 10:
                    sync.log_attendance(name, p_id, confidence_pct)
                    last_logged_time[name] = now
                    print(f"🎯 [CHECK-IN] {name} | Khớp: {confidence_pct}% | Cosine: {max_cosine:.4f}")
            else:
                # NGƯỜI LẠ / CHƯA ĐĂNG KÝ
                color = (0, 0, 240) # Đỏ
                name = "Nguoi la / Unknown"
                cos_str = f"{max_cosine:.2f}" if max_cosine != -1.0 else "N/A"
                label = f"{name} (cos:{cos_str})"
                status_text = "CHUA DANG KY - BAM [R]"

            # Vẽ khung nhận diện
            cv2.rectangle(frame, (x, y), (x + fw, y + fh), color, 2)

            # Vẽ 5 điểm mốc sinh trắc học (mắt, mũi, khóe miệng)
            landmark_colors = [(255, 0, 0), (0, 0, 255), (0, 255, 255), (255, 255, 0), (255, 0, 255)]
            for idx, pt in enumerate(landmarks):
                cv2.circle(frame, pt, 2, landmark_colors[idx % len(landmark_colors)], -1)

            # Vẽ nhãn tên phía trên
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.62, 2)
            cv2.rectangle(frame, (x, y - th - 12), (x + tw + 10, y), color, -1)
            cv2.putText(frame, label, (x + 5, y - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.62, (255, 255, 255), 2)

            # Vẽ dòng trạng thái phía dưới
            cv2.putText(frame, status_text, (x, y + fh + 22), cv2.FONT_HERSHEY_SIMPLEX, 0.52, color, 2)

        # Thanh tiêu đề trên cùng
        cv2.rectangle(frame, (0, 0), (w, 42), (30, 30, 30), -1)
        boost_status = "ON (Chong nguoc sang)" if use_lighting_boost else "OFF"
        cv2.putText(frame, "AI FACE RECOGNITION PRO (DAY/NIGHT & LONG-RANGE)", (15, 27), cv2.FONT_HERSHEY_SIMPLEX, 0.58, (0, 220, 255), 2)
        cv2.putText(frame, f"Thresh: {cosine_threshold:.2f} | LightBoost: {boost_status} | FPS: {fps}", (w - 380, 27), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (200, 200, 200), 1)

        # Thanh hướng dẫn phía dưới cùng
        cv2.rectangle(frame, (0, h - 35), (w, h), (20, 20, 20), -1)
        cv2.putText(frame, "[+] [-] Chinh nguong | [L] Bu sang | [R] Dang ky | [S] Sync | [Q] Thoat", (15, h - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.50, (220, 220, 220), 1)

        cv2.imshow("He Thong Diem Danh AI Pro (Da Cu Ly & Bat Bien Anh Sang)", frame)

        key = cv2.waitKey(1) & 0xFF

        if key == ord('q') or key == ord('Q') or key == 27:
            print("\n🛑 Đã dừng camera. Hẹn gặp lại!")
            break
        elif key == ord('l') or key == ord('L'):
            use_lighting_boost = not use_lighting_boost
            print(f"💡 Chế độ Bù sáng / Chống ngược sáng: {'BẬT (ON)' if use_lighting_boost else 'TẮT (OFF)'}")
        elif key == ord('+') or key == ord('='):
            cosine_threshold = round(min(0.80, cosine_threshold + 0.02), 2)
            print(f"📈 Ngưỡng nhận diện (Threshold) tăng lên: {cosine_threshold:.2f} (Nghiêm ngặt hơn)")
        elif key == ord('-') or key == ord('_'):
            cosine_threshold = round(max(0.30, cosine_threshold - 0.02), 2)
            print(f"📉 Ngưỡng nhận diện (Threshold) giảm xuống: {cosine_threshold:.2f} (Nhạy hơn)")
        elif key == ord('s') or key == ord('S'):
            print("\n🔄 Đang tải lại dữ liệu từ Backend...")
            people = sync.get_all_people()
            print(f"✅ Đã cập nhật {len(people)} người dùng.")
        elif key == ord('r') or key == ord('R'):
            if current_vector is None or current_face_crop is None:
                print("\n⚠️ Không phát hiện khuôn mặt nào để đăng ký! Hãy đứng vào khung hình.")
                continue

            print("\n" + "=" * 55)
            print("👤 ĐĂNG KÝ HỒ SƠ KHUÔN MẶT MỚI:")
            print("💡 Mẹo: Bạn có thể nhập cùng một tên (ví dụ 'Pham Giang') để thêm")
            print("   khuôn mặt ở điều kiện ánh sáng mới / khi đeo kính vào hệ thống.")
            name_input = input("   Nhập họ và tên: ").strip()

            if not name_input:
                print("❌ Đã hủy: Tên không được để trống!")
            else:
                success, msg = sync.register_person(name_input, current_vector, current_face_crop)
                print(f"   {'✅' if success else '❌'} {msg}")
                people = sync.get_all_people()
            print("=" * 55)

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
