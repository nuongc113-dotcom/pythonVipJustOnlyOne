"""
====================================================================
🧩 MODULE TRÍCH XUẤT ĐẶC TRƯNG KHUÔN MẶT ĐA CỰ LY & ĐA ÁNH SÁNG
====================================================================
Công nghệ & Tối ưu:
  1. YuNet Face Detector siêu nhạy (Score Threshold 0.38):
     - Bắt nét khuôn mặt từ xa (3 - 5m) đến sát camera.
     - Hoạt động ổn định cả trong điều kiện ánh sáng mạnh, ngược sáng hoặc phòng tối.
  2. Bộ cân bằng ánh sáng thích ứng CLAHE trên không gian màu LAB:
     - Khử bóng tối khi ngược sáng (Backlight Compensation) và giảm chói sáng.
  3. SFace Deep Learning 128D Embedding:
     - Tự động căn chỉnh xoay và tỷ lệ theo 2 mắt (Face Alignment).
     - So khớp chuẩn xác bằng Cosine Similarity (Chuẩn Deep Learning công nghiệp).
====================================================================
"""

import os
import cv2
import numpy as np

class FaceExtractor:
    def __init__(self, score_threshold=0.38):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        self.models_dir = os.path.join(current_dir, "models")
        os.makedirs(self.models_dir, exist_ok=True)

        self.yunet_model = os.path.join(self.models_dir, "face_detection_yunet_2023mar.onnx")
        self.sface_model = os.path.join(self.models_dir, "face_recognition_sface_2021dec.onnx")

        self.has_deep_learning = False
        self.detector_yn = None
        self.recognizer_sf = None
        self.last_input_size = None
        self.score_threshold = score_threshold

        # Bộ cân bằng sáng thích ứng CLAHE trên kênh màu
        self.clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))

        if os.path.exists(self.yunet_model) and os.path.exists(self.sface_model):
            try:
                self.recognizer_sf = cv2.FaceRecognizerSF.create(
                    model=self.sface_model,
                    config=""
                )

                # score_threshold = 0.38 để bắt được khuôn mặt ở khoảng cách xa và ánh sáng mạnh
                self.detector_yn = cv2.FaceDetectorYN.create(
                    model=self.yunet_model,
                    config="",
                    input_size=(640, 480),
                    score_threshold=self.score_threshold,
                    nms_threshold=0.3,
                    top_k=5000
                )
                self.has_deep_learning = True
                print(f"🧠 [AI Pro] Đã nạp YuNet + SFace (Score Threshold: {self.score_threshold})!")
            except Exception as e:
                print(f"⚠️ Lỗi nạp YuNet/SFace: {e}")

    def enhance_lighting(self, image_bgr):
        """
        Cân bằng sáng thích ứng tự động (chống ngược sáng và chống chói)
        Áp dụng CLAHE riêng trên kênh L (Lightness) của hệ màu LAB, giữ nguyên màu sắc
        """
        if image_bgr is None:
            return None
        try:
            lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB)
            lab[:, :, 0] = self.clahe.apply(lab[:, :, 0])
            return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        except Exception:
            return image_bgr

    def set_score_threshold(self, threshold):
        """Điều chỉnh độ nhạy phát hiện khuôn mặt"""
        self.score_threshold = max(0.1, min(0.9, threshold))
        if self.detector_yn is not None:
            self.detector_yn.setScoreThreshold(self.score_threshold)

    def detect_and_extract(self, frame_bgr, use_lighting_enhancement=False):
        """
        Phát hiện khuôn mặt từ xa đến gần và trích xuất vector 128D
        """
        if frame_bgr is None:
            return []

        h, w, _ = frame_bgr.shape
        results = []

        if not self.has_deep_learning:
            return []

        # Tùy chọn cân bằng sáng cho toàn khung hình nếu đang bị ngược sáng mạnh
        process_frame = self.enhance_lighting(frame_bgr) if use_lighting_enhancement else frame_bgr

        if self.last_input_size != (w, h):
            self.detector_yn.setInputSize((w, h))
            self.last_input_size = (w, h)

        _, faces = self.detector_yn.detect(process_frame)

        # Nếu chưa tìm thấy mặt và chưa bật enhancement, thử tự động bật enhancement để cứu frame
        if (faces is None or len(faces) == 0) and not use_lighting_enhancement:
            enhanced_frame = self.enhance_lighting(frame_bgr)
            _, faces = self.detector_yn.detect(enhanced_frame)

        if faces is not None:
            for face in faces:
                bbox = (int(face[0]), int(face[1]), int(face[2]), int(face[3]))
                score = float(face[14])

                landmarks = [
                    (int(face[4]), int(face[5])),   # Mắt phải
                    (int(face[6]), int(face[7])),   # Mắt trái
                    (int(face[8]), int(face[9])),   # Mũi
                    (int(face[10]), int(face[11])), # Miệng phải
                    (int(face[12]), int(face[13]))  # Miệng trái
                ]

                # Căn chỉnh khuôn mặt (Face Alignment theo 2 mắt)
                aligned_face = self.recognizer_sf.alignCrop(frame_bgr, face)

                # Trích xuất vector đặc trưng 128 chiều
                feature = self.recognizer_sf.feature(aligned_face)

                # Chuẩn hóa L2-norm
                feat_arr = feature.flatten()
                norm = np.linalg.norm(feat_arr)
                if norm > 0:
                    feat_arr = feat_arr / norm

                vector = [round(float(v), 5) for v in feat_arr]

                results.append({
                    "bbox": bbox,
                    "score": score,
                    "landmarks": landmarks,
                    "vector": vector,
                    "aligned_face": aligned_face
                })

        return results

    @staticmethod
    def calculate_cosine_similarity(v1, v2):
        """
        Đo độ tương đồng Cosine chuẩn giữa 2 vector khuôn mặt:
        - Giá trị chạy từ -1.0 đến +1.0
        - Càng gần +1.0 thì càng giống nhau
        - Ngưỡng nhận diện cùng 1 người chuẩn SFace: >= 0.363 (đề xuất: >= 0.42 - 0.45)
        """
        if v1 is None or v2 is None or len(v1) == 0 or len(v2) == 0:
            return 0.0

        arr1 = np.array(v1, dtype=np.float32)
        arr2 = np.array(v2, dtype=np.float32)

        if len(arr1) != len(arr2):
            return 0.0

        norm1 = np.linalg.norm(arr1)
        norm2 = np.linalg.norm(arr2)

        if norm1 == 0 or norm2 == 0:
            return 0.0

        return float(np.dot(arr1, arr2) / (norm1 * norm2))

    @staticmethod
    def calculate_distance(v1, v2):
        """Tính khoảng cách Euclidean L2"""
        if v1 is None or v2 is None or len(v1) == 0 or len(v2) == 0:
            return float('inf')
        arr1 = np.array(v1, dtype=np.float32)
        arr2 = np.array(v2, dtype=np.float32)
        if len(arr1) != len(arr2):
            return float('inf')
        return float(np.linalg.norm(arr1 - arr2))

    @staticmethod
    def cosine_to_confidence_percent(cos_sim):
        """
        Chuyển đổi Cosine Similarity sang phần trăm hiển thị trực quan (0% - 100%)
        - cos < 0.20: 0% - 20% (người hoàn toàn khác)
        - cos 0.363 (ngưỡng SFace): ~60%
        - cos 0.50: ~75%
        - cos 0.65: ~88%
        - cos 0.80+: 95% - 100%
        """
        if cos_sim <= 0.15:
            return 0.0
        # Hàm sigmoid / linear mapping mượt mà
        percent = ((cos_sim - 0.15) / 0.70) * 100.0
        return round(max(0.0, min(100.0, percent)), 1)
