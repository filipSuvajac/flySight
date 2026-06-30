#!/usr/bin/env python3

from http.server import BaseHTTPRequestHandler, HTTPServer
import hashlib
import hmac
import json
import os
import subprocess
import threading

HOST = os.environ.get("WEBHOOK_HOST", "0.0.0.0")
PORT = int(os.environ.get("WEBHOOK_PORT", "9000"))
SECRET = os.environ.get("WEBHOOK_SECRET", "")
DEPLOY_SCRIPT = os.environ.get(
    "DEPLOY_SCRIPT",
    "/home/flysight/flySight/scripts/deploy-backend.sh"
)

deploy_lock = threading.Lock()


def verify_signature(body: bytes, signature_header: str) -> bool:
    if not SECRET:
        return False

    if not signature_header.startswith("sha256="):
        return False

    expected_signature = "sha256=" + hmac.new(
        SECRET.encode("utf-8"),
        body,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(expected_signature, signature_header)


class WebhookHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"webhook-ok")
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        if self.path != "/deploy":
            self.send_response(404)
            self.end_headers()
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(content_length)
        signature = self.headers.get("X-FlySight-Signature", "")

        if not verify_signature(body, signature):
            self.send_response(401)
            self.end_headers()
            self.wfile.write(b"invalid signature")
            return

        if not deploy_lock.acquire(blocking=False):
            self.send_response(409)
            self.end_headers()
            self.wfile.write(b"deployment already running")
            return

        try:
            payload = json.loads(body.decode("utf-8"))
            print("Received deploy webhook:", payload, flush=True)

            result = subprocess.run(
                [DEPLOY_SCRIPT],
                text=True,
                capture_output=True,
                timeout=300
            )

            print(result.stdout, flush=True)

            if result.stderr:
                print(result.stderr, flush=True)

            if result.returncode != 0:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(b"deployment failed")
                return

            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"deployment completed")

        except Exception as error:
            print("Webhook error:", error, flush=True)
            self.send_response(500)
            self.end_headers()
            self.wfile.write(b"server error")

        finally:
            deploy_lock.release()


if __name__ == "__main__":
    server = HTTPServer((HOST, PORT), WebhookHandler)
    print(f"FlySight webhook server running on {HOST}:{PORT}", flush=True)
    server.serve_forever()
