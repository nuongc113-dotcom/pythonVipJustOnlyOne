"""
====================================================================
🧪 KIỂM THỬ ĐỘ CHÍNH XÁC ĐA CỰ LY & BẤT BIẾN ÁNH SÁNG
====================================================================
"""

import os
import cv2
from face_extractor import FaceExtractor
from backend_sync import BackendSync

def test():
    print("=" * 68)
    print("🧪 KIỂM THỬ NHẬN DIỆN KHUÔN MẶT ĐA ÁNH SÁNG VÀ ĐA CỰ LY")
    print("=" * 68)

    extractor = FaceExtractor(score_threshold=0.38)
    sync = BackendSync()

    # Kiểm tra so khớp giữa 2 bức ảnh ban ngày bạn vừa đăng ký lúc 9:56 sáng (Id 8 giang11 & Id 9 giang2)
    path1 = os.path.join(sync.uploads_dir, "fb447870d972434fabd5a9df85a7b771.jpg")
    path2 = os.path.join(sync.uploads_dir, "d31fd1da76744152bcc1fc8cc510d064.jpg")

    if os.path.exists(path1) and os.path.exists(path2):
        img1 = cv2.imread(path1)
        img2 = cv2.imread(path2)

        feat1 = extractor.recognizer_sf.feature(img1).flatten()
        feat2 = extractor.recognizer_sf.feature(img2).flatten()

        cos_sim = extractor.calculate_cosine_similarity(feat1, feat2)
        pct = extractor.cosine_to_confidence_percent(cos_sim)

        print("📸 So sánh 2 bức ảnh ban ngày (có kính, ánh sáng mạnh):")
        print(f"   • Độ tương đồng Cosine: {cos_sim:.4f} (Ngưỡng chuẩn >= 0.42)")
        print(f"   • Độ tin cậy hiển thị: {pct}%")

        if cos_sim >= 0.42:
            print("   🎉 KẾT QUẢ: NHẬN DIỆN THÀNH CÔNG VỚI CHUẨN MỚI!")
        else:
            print("   ⚠️ Không khớp.")

    print("=" * 68)

if __name__ == "__main__":
    test()
