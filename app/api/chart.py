import json, os, sys
from http.server import BaseHTTPRequestHandler

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from hdcalc_pkg import core  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            n = int(self.headers.get("content-length", "0"))
            body = json.loads(self.rfile.read(n) or b"{}")
            out = core.compute_chart(body["date"], body.get("time") or "12:00", body["tz"], float(body["lat"]), float(body["lon"]))
            data = json.dumps(out).encode()
            self.send_response(200)
        except Exception as e:  # noqa: BLE001
            data = json.dumps({"error": str(e)}).encode()
            self.send_response(400)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
