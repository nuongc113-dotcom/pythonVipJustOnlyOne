"""
====================================================================
🌐 AI SERVICE (FLASK REST API - YUNET + SFACE)
====================================================================
Cung cấp REST API cho Frontend Web gọi xử lý khuôn mặt:
  1. POST /api/ai/detect-and-extract : Phát hiện và trích xuất vector 128D
  2. POST /api/ai/register          : Đăng ký người mới (lưu SQLite + ảnh wwwroot)
  3. POST /api/ai/recognize         : Điểm danh khuôn mặt (so khớp Cosine với SQLite)
  4. GET  /api/ai/health            : Kiểm tra trạng thái AI Service
====================================================================
"""

import os
import base64
import json
import cv2
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

from face_extractor import FaceExtractor
from backend_sync import BackendSync

app = Flask(__name__)
# Cho phép CORS cho tất cả các nguồn (Web Frontend truy cập tự do)
CORS(app)

# Khởi tạo mô hình AI và bộ đồng bộ CSDL
extractor = FaceExtractor(score_threshold=0.38)
sync = BackendSync()

def base64_to_cv2(b64_string):
    """Chuyển chuỗi Base64 từ Web Canvas thành ảnh OpenCV BGR"""
    if not b64_string:
        return None
    try:
        if "," in b64_string:
            b64_string = b64_string.split(",")[1]
        img_bytes = base64.b64decode(b64_string)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        print(f"Lỗi decode Base64: {e}")
        return None

@app.route("/api/ai/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "online",
        "service": "Face Recognition AI Service (YuNet + SFace 128D)",
        "models_loaded": extractor.has_deep_learning
    })

@app.route("/api/ai/verify-face", methods=["POST"])
def verify_face():
    """
    Kiểm tra nhanh ảnh chụp/tải lên:
    - Có khuôn mặt không?
    - Khuôn mặt đã đăng ký trước đó hay chưa?
    """
    data = request.get_json(silent=True) or {}
    image_b64 = data.get("image") or data.get("faceImage")

    if not image_b64:
        return jsonify({"success": False, "message": "Chưa có ảnh khuôn mặt!"}), 400

    img = base64_to_cv2(image_b64)
    if img is None:
        return jsonify({"success": False, "message": "Ảnh gửi lên không hợp lệ!"}), 400

    detections = extractor.detect_and_extract(img, use_lighting_enhancement=True)
    if not detections:
        return jsonify({
            "success": True,
            "faceFound": False,
            "message": "Không phát hiện thấy khuôn mặt nào trong ảnh! Vui lòng nhìn thẳng vào camera và đủ ánh sáng."
        })

    best_det = max(detections, key=lambda d: d.get("score", 0.0))
    query_vector = best_det["vector"]

    # Kiểm tra xem khuôn mặt này đã tồn tại trong CSDL chưa
    people = sync.get_all_people()
    max_cosine = -1.0
    matched_person = None
    COSINE_THRESHOLD = 0.40  # Ngưỡng phát hiện trùng lặp khuôn mặt

    for p in people:
        db_vec = p.get("vector")
        if db_vec and len(db_vec) == 128:
            cos = extractor.calculate_cosine_similarity(query_vector, db_vec)
            if cos > max_cosine:
                max_cosine = cos
                matched_person = p

    confidence_pct = extractor.cosine_to_confidence_percent(max_cosine)

    if matched_person and max_cosine >= COSINE_THRESHOLD:
        matched_name = matched_person.get("name", "Không rõ")
        return jsonify({
            "success": True,
            "faceFound": True,
            "isDuplicate": True,
            "matchedName": matched_name,
            "confidence": confidence_pct,
            "cosine": round(max_cosine, 4),
            "message": f"Khuôn mặt này đã đăng kí khuôn mặt rồi (Trùng khớp với: {matched_name} - Độ khớp: {confidence_pct}%)! Bắt buộc chụp lại, không thêm vào data."
        })
    else:
        return jsonify({
            "success": True,
            "faceFound": True,
            "isDuplicate": False,
            "confidence": confidence_pct,
            "cosine": round(max_cosine, 4),
            "message": "Khuôn mặt hợp lệ, chưa từng đăng ký trong hệ thống. Sẵn sàng lưu."
        })

@app.route("/api/ai/register", methods=["POST"])
def register():
    """
    Đăng ký khuôn mặt mới:
    Nhận: { "name": "Nguyễn Văn A", "code": "NV-001", "image": "data:image/jpeg;base64,..." }
    Ràng buộc: Nếu khuôn mặt đã tồn tại -> Báo lỗi 'đã đăng kí khuôn mặt rồi' và từ chối thêm vào data!
    """
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    code = (data.get("code") or "").strip()
    image_b64 = data.get("image") or data.get("faceImage")

    if not name:
        return jsonify({"success": False, "message": "Vui lòng nhập họ và tên nhân viên!"}), 400

    if not image_b64:
        return jsonify({"success": False, "message": "Vui lòng chụp ảnh khuôn mặt!"}), 400

    img = base64_to_cv2(image_b64)
    if img is None:
        return jsonify({"success": False, "message": "Ảnh gửi lên không hợp lệ!"}), 400

    # Dùng YuNet + SFace phát hiện và trích xuất vector
    detections = extractor.detect_and_extract(img, use_lighting_enhancement=True)
    if not detections:
        return jsonify({
            "success": False, 
            "message": "Không phát hiện thấy khuôn mặt nào trong ảnh! Vui lòng nhìn thẳng vào camera và đủ ánh sáng."
        }), 400

    # Lấy khuôn mặt có điểm số cao nhất
    best_det = max(detections, key=lambda d: d.get("score", 0.0))
    vector = best_det["vector"]
    aligned_face = best_det["aligned_face"]

    # 1. KIỂM TRA TRÙNG LẶP KHUÔN MẶT VỚI DATABASE
    people = sync.get_all_people()
    max_cosine = -1.0
    matched_person = None
    COSINE_THRESHOLD = 0.40  # Ngưỡng chống đăng ký trùng lặp khuôn mặt

    for p in people:
        db_vec = p.get("vector")
        if db_vec and len(db_vec) == 128:
            cos = extractor.calculate_cosine_similarity(vector, db_vec)
            if cos > max_cosine:
                max_cosine = cos
                matched_person = p

    if matched_person and max_cosine >= COSINE_THRESHOLD:
        confidence_pct = extractor.cosine_to_confidence_percent(max_cosine)
        matched_name = matched_person.get("name", "Đã có trong hệ thống")
        # CẢNH BÁO: ĐÃ ĐĂNG KÝ KHUÔN MẶT RỒI VÀ KHÔNG THÊM VÀO DATA
        return jsonify({
            "success": False,
            "isDuplicate": True,
            "matchedName": matched_name,
            "confidence": confidence_pct,
            "cosine": round(max_cosine, 4),
            "message": f"Đã đăng kí khuôn mặt rồi! (Trùng khớp với nhân viên: {matched_name} - Độ khớp: {confidence_pct}%). Bắt buộc phải chụp lại, không thêm vào data!"
        }), 400

    # Đặt tên lưu hiển thị: kết hợp Họ tên + Mã NV (nếu có)
    full_name = f"{code} - {name}" if code else name

    # Lưu trực tiếp vào Database SQLite và wwwroot của Backend C#
    success, msg = sync.register_person(full_name, vector, aligned_face)

    if success:
        return jsonify({
            "success": True,
            "message": f"Đăng ký thành công nhân viên: {full_name}!",
            "vectorLength": len(vector),
            "faceScore": round(best_det.get("score", 0.0), 3)
        })
    else:
        return jsonify({"success": False, "message": msg}), 500

@app.route("/api/ai/recognize", methods=["POST"])
def recognize():
    """
    Điểm danh khuôn mặt (Check-in hoặc Check-out):
    Nhận: { "image": "data:image/jpeg;base64,...", "type": "Check-in" | "Check-out" }
    So sánh với cơ sở dữ liệu SQLite và trả về kết quả
    """
    data = request.get_json(silent=True) or {}
    image_b64 = data.get("image") or data.get("faceImage")
    attendance_type = data.get("type") or data.get("status") or "Check-in"

    if not image_b64:
        return jsonify({"success": False, "message": "Chưa có ảnh chụp khuôn mặt!"}), 400

    img = base64_to_cv2(image_b64)
    if img is None:
        return jsonify({"success": False, "message": "Ảnh không hợp lệ!"}), 400

    detections = extractor.detect_and_extract(img, use_lighting_enhancement=True)
    if not detections:
        return jsonify({
            "success": True,
            "isMatched": False,
            "faceFound": False,
            "type": attendance_type,
            "name": "Chưa phát hiện khuôn mặt",
            "message": "Vui lòng nhìn thẳng vào camera để quét mặt."
        })

    # Lấy khuôn mặt nổi bật nhất
    best_det = max(detections, key=lambda d: d.get("score", 0.0))
    query_vector = best_det["vector"]

    # Lấy danh sách nhân viên từ CSDL
    people = sync.get_all_people()
    if not people:
        return jsonify({
            "success": True,
            "isMatched": False,
            "faceFound": True,
            "type": attendance_type,
            "name": "Chưa có dữ liệu",
            "message": "Hệ thống chưa có nhân viên nào được đăng ký!"
        })

    best_person = None
    max_cosine = -1.0

    for p in people:
        db_vec = p.get("vector")
        if db_vec and len(db_vec) == 128:
            cos = extractor.calculate_cosine_similarity(query_vector, db_vec)
            if cos > max_cosine:
                max_cosine = cos
                best_person = p

    # Ngưỡng nhận diện Cosine Similarity chuẩn SFace
    COSINE_THRESHOLD = 0.42
    confidence_pct = extractor.cosine_to_confidence_percent(max_cosine)

    if best_person and max_cosine >= COSINE_THRESHOLD:
        name = best_person.get("name", "Unknown")
        person_id = best_person.get("id")

        # Ghi nhận lần điểm danh vào file CSV và SQLite với kiểu Check-in hoặc Check-out
        sync.log_attendance(name, person_id, confidence_pct, status=attendance_type)

        return jsonify({
            "success": True,
            "isMatched": True,
            "faceFound": True,
            "personId": person_id,
            "name": name,
            "type": attendance_type,
            "confidence": confidence_pct,
            "cosine": round(max_cosine, 4),
            "message": f"Điểm danh {attendance_type} thành công! Xin chào {name}."
        })
    else:
        return jsonify({
            "success": True,
            "isMatched": False,
            "faceFound": True,
            "type": attendance_type,
            "name": "Người lạ / Unknown",
            "confidence": confidence_pct,
            "cosine": round(max_cosine, 4),
            "message": "Khuôn mặt chưa được đăng ký trong hệ thống!"
        })

@app.route("/api/ai/history", methods=["GET"])
def get_attendance_history():
    """Lấy danh sách lịch sử điểm danh trực tiếp từ SQLite (kèm loại Check-in / Check-out)"""
    import sqlite3
    limit = int(request.args.get("limit", 50))
    records = []
    try:
        conn = sqlite3.connect(sync.db_path, timeout=1.0)
        cursor = conn.cursor()
        cursor.execute("SELECT Id, PersonId, PersonName, Timestamp, Status, Confidence FROM AttendanceRecords ORDER BY Id DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        for r in rows:
            r_id, p_id, name, ts, status, conf = r
            parts = ts.split(" ") if " " in ts else [ts, ""]
            date_str = parts[0]
            time_str = parts[1] if len(parts) > 1 else ""
            records.append({
                "id": r_id,
                "personId": p_id,
                "personName": name,
                "date": date_str,
                "time": time_str,
                "status": status,
                "type": status,
                "confidence": conf
            })
        conn.close()
    except Exception as e:
        print(f"⚠️ Lỗi đọc lịch sử: {e}")
    return jsonify(records)

if __name__ == "__main__":
    port = 5001
    print("=" * 70)
    print(f"🚀 AI REST API SERVICE ĐANG CHẠY TẠI: http://localhost:{port}")
    print("   • Endpoint Đăng ký: POST http://localhost:5001/api/ai/register")
    print("   • Endpoint Điểm danh: POST http://localhost:5001/api/ai/recognize")
    print("   • Endpoint Lịch sử: GET http://localhost:5001/api/ai/history")
    print("=" * 70)
    app.run(host="127.0.0.1", port=port, debug=False)
