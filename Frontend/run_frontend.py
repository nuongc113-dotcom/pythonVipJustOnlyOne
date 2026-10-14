"""
====================================================================
🚀 KHỞI ĐỘNG GIAO DIỆN WEB ĐIỂM DANH KHUÔN MẶT AI PRO (FRONTEND)
====================================================================
"""

import http.server
import socketserver
import webbrowser
import os

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        pass

def run():
    os.chdir(DIRECTORY)
    url = f"http://localhost:{PORT}/index.html"

    print("=" * 68)
    print("🌐 WEB APP ĐIỂM DANH KHUÔN MẶT AI PRO")
    print("=" * 68)
    print(f"📁 Thư mục Web: {DIRECTORY}")
    print(f"🔗 Địa chỉ: {url}")
    print("💡 Đang tự động mở trình duyệt web...")
    print("👉 Nhấn Ctrl + C để dừng Web Server bất cứ lúc nào.")
    print("=" * 68)

    webbrowser.open(url)

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Đã dừng Web Server. Cảm ơn bạn!")

if __name__ == "__main__":
    run()
