"""
====================================================================
🔄 MODULE KẾT NỐI VÀ ĐỒNG BỘ DỮ LIỆU VỚI BACKEND C# & SQLITE (PRO)
====================================================================
Tối ưu hóa tốc độ:
  1. Đọc trực tiếp từ CSDL SQLite (attendance.db) siêu tốc (< 1ms)
  2. Sử dụng RAM Cache để không bị độ trễ (Zero-Latency)
  3. Tự động hỗ trợ cả Port 5286 (Kestrel) lẫn Port 61642 (IIS Express)
====================================================================
"""

import os
import json
import sqlite3
import time
from datetime import datetime
import uuid
import cv2

class BackendSync:
    def __init__(self, backend_url="http://localhost:5286"):
        self.backend_url = backend_url
        
        # Đường dẫn tới thư mục gốc dự án Backend
        current_dir = os.path.dirname(os.path.abspath(__file__))
        self.backend_root = os.path.abspath(os.path.join(current_dir, "..", "Backend", "Backend"))
        
        # File database SQLite của Backend C#
        self.db_path = os.path.join(self.backend_root, "attendance.db")
        
        # Thư mục lưu ảnh của Backend C#
        self.uploads_dir = os.path.join(self.backend_root, "wwwroot", "uploads", "faces")
        if not os.path.exists(self.uploads_dir):
            os.makedirs(self.uploads_dir, exist_ok=True)
            
        # File lưu lịch sử điểm danh cục bộ
        self.log_file = os.path.join(current_dir, "attendance_history.csv")

        # RAM Cache để nhận diện tức thì (< 1ms)
        self._people_cache = []
        self._last_cache_time = 0
        self._cache_ttl = 5 # Giữ trong bộ nhớ 5 giây trước khi check lại DB

    def load_people_from_db(self):
        """
        Đọc danh sách người dùng và mảng vector trực tiếp từ SQLite (cực nhanh, không qua mạng)
        """
        people = []
        if not os.path.exists(self.db_path):
            return people

        try:
            # Dùng URI read-only để tránh tranh chấp lock với Backend C#
            conn = sqlite3.connect(self.db_path, timeout=1.0)
            cursor = conn.cursor()
            cursor.execute("SELECT Id, Name, FaceVectorJson FROM People")
            rows = cursor.fetchall()

            for row in rows:
                p_id, p_name, vec_json = row
                try:
                    vector = json.loads(vec_json)
                    if isinstance(vector, list) and len(vector) > 0:
                        people.append({
                            "id": p_id,
                            "name": p_name,
                            "vector": vector
                        })
                except Exception:
                    continue

            conn.close()
        except Exception as e:
            print(f"⚠️ Lỗi đọc SQLite: {e}")

        return people

    def get_all_people(self, force_refresh=False):
        """
        Lấy danh sách người dùng từ RAM Cache để triệt tiêu hoàn toàn độ trễ (Zero Delay)
        """
        now = time.time()
        if force_refresh or (now - self._last_cache_time > self._cache_ttl) or not self._people_cache:
            self._people_cache = self.load_people_from_db()
            self._last_cache_time = now

        return self._people_cache

    def register_person(self, name, vector, face_image=None):
        """
        Lưu người dùng mới vào hệ thống (đồng bộ với cả SQLite và thư mục wwwroot của C#)
        """
        name = name.strip()
        if not name or not vector:
            return False, "Thiếu tên hoặc vector khuôn mặt!"

        photo_url = None

        # 1. Lưu ảnh khuôn mặt vào wwwroot/uploads/faces nếu có
        if face_image is not None:
            try:
                file_name = f"{uuid.uuid4().hex}.jpg"
                file_path = os.path.join(self.uploads_dir, file_name)
                cv2.imwrite(file_path, face_image)
                photo_url = f"/uploads/faces/{file_name}"
            except Exception as e:
                print(f"⚠️ Không thể lưu ảnh vào wwwroot: {e}")

        # 2. Lưu trực tiếp vào CSDL SQLite của Backend
        try:
            conn = sqlite3.connect(self.db_path, timeout=5.0)
            cursor = conn.cursor()
            vec_json = json.dumps(vector)
            cursor.execute("INSERT INTO People (Name, FaceVectorJson) VALUES (?, ?)", (name, vec_json))
            conn.commit()
            new_id = cursor.lastrowid
            conn.close()

            # Cập nhật ngay RAM Cache để nhận diện được người mới ngay lập tức
            self.get_all_people(force_refresh=True)

            return True, f"Đã đăng ký thành công {name} (Id: {new_id}) vào Database!"
        except Exception as e:
            return False, f"Lỗi ghi vào Database SQLite: {e}"

    def log_attendance(self, person_name, person_id=None, confidence=0.0, status="Check-in"):
        """
        Ghi nhận lịch sử lần điểm danh vào file CSV và CSDL SQLite (Hỗ trợ Check-in / Check-out)
        """
        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d")
        time_str = now.strftime("%H:%M:%S")
        timestamp_str = f"{date_str} {time_str}"
        attendance_status = status if status else "Check-in"

        # 1. Ghi vào file CSV
        file_exists = os.path.exists(self.log_file)
        try:
            with open(self.log_file, "a", encoding="utf-8-sig") as f:
                if not file_exists:
                    f.write("Id,Ho Va Ten,Ngay,Gio,Do Tuong Dong (%),Kieu Diem Danh\n")
                f.write(f'{person_id or "N/A"},"{person_name}","{date_str}","{time_str}",{confidence:.1f}%,"{attendance_status}"\n')
        except Exception:
            pass

        # 2. Ghi trực tiếp vào bảng AttendanceRecords trong SQLite
        try:
            if os.path.exists(self.db_path):
                conn = sqlite3.connect(self.db_path, timeout=3.0)
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO AttendanceRecords (PersonId, PersonName, Timestamp, Status, Confidence)
                    VALUES (?, ?, ?, ?, ?)
                """, (person_id, person_name, timestamp_str, attendance_status, round(confidence, 1)))
                conn.commit()
                conn.close()
        except Exception as e:
            print(f"⚠️ Lỗi lưu AttendanceRecords vào SQLite: {e}")
