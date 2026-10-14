"""
====================================================================
🚀 KHỞI ĐỘNG TOÀN BỘ HỆ THỐNG ĐIỂM DANH KHUÔN MẶT AI (3-IN-1)
====================================================================
Bao gồm:
  1. C# ASP.NET Core Backend (Port 5286) -> Quản lý SQLite & Lịch sử
  2. Python AI Service YuNet/SFace (Port 5001) -> Xử lý trích xuất & nhận diện
  3. Frontend Web App (Port 8080) -> Giao diện người dùng
====================================================================
Chế độ: LOCALHOST ONLY (Chỉ chạy trên máy này, bảo mật tuyệt đối)
====================================================================
"""

import subprocess
import webbrowser
import time
import sys
import os

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "Backend", "Backend")
AI_DIR = os.path.join(ROOT_DIR, "FaceRecognitionAI")
FRONTEND_DIR = os.path.join(ROOT_DIR, "Frontend")

def free_ports():
    """Giải phóng các port 5286, 5001 và 8080 nếu có tiến trình cũ còn sót lại"""
    try:
        for port in [5286, 5001, 8080]:
            cmd = f'powershell -Command "Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"'
            res = subprocess.run(cmd, capture_output=True, text=True, shell=True)
            for line in res.stdout.strip().split():
                if line.isdigit():
                    pid = int(line)
                    if pid != os.getpid():
                        subprocess.run(f"taskkill /F /PID {pid}", shell=True, capture_output=True)
    except Exception:
        pass

def check_environment():
    """Kiểm tra xem máy tính đã cài đặt đủ các công cụ cần thiết chưa"""
    issues = []
    
    # 1. Kiểm tra các thư viện Python
    required_packages = {
        "flask": "flask",
        "flask_cors": "flask-cors",
        "cv2": "opencv-python",
        "numpy": "numpy",
        "requests": "requests"
    }
    missing_packages = []
    for mod, pkg in required_packages.items():
        try:
            __import__(mod)
        except ImportError:
            missing_packages.append(pkg)
            
    if missing_packages:
        issues.append(
            f"❌ THIẾU THƯ VIỆN PYTHON: {', '.join(missing_packages)}\n"
            f"   👉 Hãy mở CMD tại thư mục này và chạy:\n"
            f"      pip install -r FaceRecognitionAI/requirements.txt"
        )

    # 2. Kiểm tra .NET SDK
    import shutil
    if not shutil.which("dotnet"):
        issues.append(
            "❌ CHƯA CÀI ĐẶT .NET SDK!\n"
            "   👉 Máy tính chưa có .NET để chạy C# Backend.\n"
            "   👉 Tải và cài đặt .NET SDK tại: https://dotnet.microsoft.com/download"
        )
        
    if issues:
        print("\n" + "!" * 76)
        print("⚠️  PHÁT HIỆN THIẾU MÔI TRƯỜNG ĐỂ CHẠY HỆ THỐNG:")
        print("!" * 76)
        for issue in issues:
            print(f"\n{issue}")
        print("\n" + "!" * 76)
        print("💡 Hãy cài đặt các phần còn thiếu theo hướng dẫn trên rồi thử lại.")
        print("!" * 76)
        return False
        
    return True

def run():
    print("=" * 76)
    print("🌟 KHỞI ĐỘNG HỆ THỐNG ĐIỂM DANH KHUÔN MẶT AI PRO (CHẾ ĐỘ LOCALHOST)")
    print("=" * 76)

    # Kiểm tra điều kiện môi trường trước khi chạy
    if not check_environment():
        print("\n⚠️ Hệ thống sẽ vẫn cố gắng tiếp tục khởi chạy phần khả dụng...")
        time.sleep(2)

    free_ports()
    time.sleep(1)

    processes = []

    try:
        # 1. Khởi động C# Backend (Chỉ lắng nghe localhost:5286)
        print("1️⃣ [1/3] Đang khởi động C# Backend (.NET 10) tại localhost:5286...")
        try:
            p_backend = subprocess.Popen(
                ["dotnet", "run", "--launch-profile", "http"],
                cwd=BACKEND_DIR
            )
            processes.append(p_backend)
        except FileNotFoundError:
            print("⚠️ Lỗi: Không tìm thấy lệnh 'dotnet' trên máy tính này!")
            print("   👉 Vui lòng cài đặt .NET SDK để Backend hoạt động.")

        # 2. Khởi động Python AI Service (Chỉ lắng nghe 127.0.0.1:5001)
        print("2️⃣ [2/3] Đang khởi động Python AI Service (YuNet + SFace) tại localhost:5001...")
        p_ai = subprocess.Popen(
            [sys.executable, "ai_service.py"],
            cwd=AI_DIR
        )
        processes.append(p_ai)

        time.sleep(3)

        # 3. Khởi động Frontend Web App (Chỉ lắng nghe 127.0.0.1:8080)
        print("3️⃣ [3/3] Đang khởi động Frontend Web App tại localhost:8080...")
        web_url = "http://localhost:8080/index.html"

        p_frontend = subprocess.Popen(
            [sys.executable, "-m", "http.server", "8080", "--bind", "127.0.0.1"],
            cwd=FRONTEND_DIR
        )
        processes.append(p_frontend)

        print("-" * 76)
        print("✅ TẤT CẢ DỊCH VỤ ĐÃ KHỞI CHẠY THÀNH CÔNG TRÊN LOCALHOST!")
        print(f"🖥️  Giao diện hệ thống (Trình duyệt):")
        print(f"    👉 {web_url}")
        print()
        print("🔒 Chế độ bảo mật Local: Chỉ chạy nội bộ trên máy này, không chia sẻ qua Wi-Fi/LAN.")
        print("-" * 76)
        print("👉 Nhấn Ctrl + C để dừng toàn bộ hệ thống cùng lúc.")
        print("=" * 76)

        webbrowser.open(web_url)

        # Giữ tiến trình chạy cho đến khi người dùng bấm Ctrl + C
        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n🛑 Đang dừng toàn bộ các dịch vụ hệ thống...")
        for p in processes:
            p.terminate()
        print("👋 Đã dừng thành công. Hẹn gặp lại bạn!")

if __name__ == "__main__":
    run()
