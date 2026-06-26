import http.server
import socketserver
import json
import os
from pathlib import Path

PORT = 8000
HERE = Path(__file__).parent

def load_env_file(env_path: Path):
    config = {}
    if not env_path.exists():
        return config
    try:
        for line in env_path.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            config[k.strip()] = v.strip()
    except Exception as e:
        print(f"Error loading env file: {e}")
    return config

class NangTrisHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Serve static files from the current directory
        return super().translate_path(path)

    def do_GET(self):
        # Respond to both /config and /api/config
        if self.path in ('/config', '/api/config'):
            env_config = load_env_file(HERE / '.env.local')
            # fallback to os.environ if not in .env.local
            url = env_config.get('SUPABASE_URL') or os.getenv('SUPABASE_URL', '')
            key = env_config.get('SUPABASE_KEY') or os.getenv('SUPABASE_KEY', '')
            
            response_data = {
                'SUPABASE_URL': url,
                'SUPABASE_KEY': key
            }
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode('utf-8'))
        else:
            # Standard static file serving
            super().do_GET()

if __name__ == '__main__':
    # Force working directory to script directory so static file serving starts correctly
    os.chdir(str(HERE))
    
    # Allow address reuse to avoid port blockages on restart
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(("", PORT), NangTrisHandler) as httpd:
        print(f"=======================================================")
        print(f"  냥트리스 로컬 개발 서버가 시작되었습니다.")
        print(f"  접속 주소: http://localhost:{PORT}")
        print(f"=======================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n서버를 종료합니다.")
