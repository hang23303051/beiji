import http.server
import socketserver
import subprocess
import os
import sys
import webbrowser
#666#
PORT = 8000
DATA_PROCESS = None
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# ✅ 主服务脚本名（避免自己执行自己）
SERVICE_SCRIPT_NAME = os.path.basename(__file__)

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        global DATA_PROCESS

        if self.path == "/start":
            if DATA_PROCESS is None:
                print("▶️ 启动 t5.py...")
                # ✅ 安全调用：确保不是再次执行本程序！
                t5_path = os.path.join(SCRIPT_DIR, "t5.py")
                python_exe = sys.executable  # 推荐：虚拟环境 or 系统解释器
                if os.path.basename(python_exe).lower().endswith(".exe") and "run_all" in python_exe:
                    python_exe = "python"  # 避免再次运行 run_all.exe

                DATA_PROCESS = subprocess.Popen(
                    [python_exe, t5_path],
                    cwd=SCRIPT_DIR
                )
                self.respond("✅ 已启动采集")
            else:
                self.respond("⏳ 采集已在运行")

        elif self.path == "/stop":
            if DATA_PROCESS:
                print("⛔ 正在终止 t5.py...")
                DATA_PROCESS.terminate()
                DATA_PROCESS.wait()
                DATA_PROCESS = None
                self.respond("🛑 已停止采集")
            else:
                self.respond("⚠️ 当前无采集进程")

        else:
            return super().do_GET()

    def respond(self, msg):
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(msg.encode("utf-8"))

def start_server():
    os.chdir(SCRIPT_DIR)
    url = f"http://localhost:{PORT}/index.html"
    print(f"🌐 本地服务已启动: {url}")
    os.system(f'start {url}')  # 强制调用默认浏览器
    with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
        httpd.serve_forever()

if __name__ == "__main__":
    # ✅ 避免 run_all.exe 被自己错误触发多次
    if "run_all" in os.path.basename(sys.argv[0]).lower():
        start_server()
