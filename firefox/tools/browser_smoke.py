"""Exercise the actual packaged extension in an isolated, headless Firefox profile."""
import argparse
import base64
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import threading
import time
import struct
import zlib
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
UUID = "a17f0200-1111-4111-8111-012345678901"
ELEMENT = "element-6066-11e4-a52e-4f735466cecf"


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--driver", default=os.environ.get("GECKODRIVER", "geckodriver"))
    parser.add_argument("--firefox", default=os.environ.get("FIREFOX", "firefox"))
    args = parser.parse_args()
    driver_bin, browser_bin = shutil.which(args.driver), shutil.which(args.firefox)
    check(driver_bin and browser_bin, "Install Firefox and geckodriver; see firefox/README.md")
    version = json.loads((ROOT / "app/manifest.json").read_text())["version"]
    suffix = "-security-fixed" if version == "0.1.0" else ""
    package = ROOT / "dist" / f"mivu-firefox-AMO-upload-v{version}{suffix}.zip"
    check(package.exists(), "Run python3 firefox/tools/build_amo.py first")
    output = ROOT.parent / "test-results/firefox"
    output.mkdir(parents=True, exist_ok=True)
    requests = []

    class Server(BaseHTTPRequestHandler):
        def do_GET(self):
            requests.append(self.path)
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(b"<!doctype html><title>Explicit link</title>")

        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Server)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    url = f"http://127.0.0.1:{port}"
    session = None
    with (output / "geckodriver.log").open("w") as log, tempfile.TemporaryDirectory(prefix="mivu-firefox-") as temp:
        # Firefox disallows WebDriver navigation to extension origins in content context.
        process = subprocess.Popen([driver_bin, "--allow-system-access", "--host", "127.0.0.1", "--port", str(port)],
                                   stdout=log, stderr=subprocess.STDOUT)

        def call(method, path, body=None):
            data = None if body is None else json.dumps(body).encode()
            request = urllib.request.Request(url + path, data=data, method=method,
                                             headers={"Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(request, timeout=30) as response:
                    result = json.load(response)["value"]
            except urllib.error.HTTPError as error:
                raise RuntimeError(error.read().decode()) from error
            if isinstance(result, dict) and "error" in result:
                raise RuntimeError(result)
            return result

        def command(method, path, body=None):
            return call(method, f"/session/{session}{path}", body)

        def script(code, *arguments):
            return command("POST", "/execute/sync", {"script": code, "args": list(arguments)})

        def wait(predicate, description):
            deadline = time.monotonic() + 15
            while time.monotonic() < deadline:
                try:
                    if predicate():
                        return
                except (urllib.error.URLError, RuntimeError):
                    pass
                time.sleep(0.1)
            raise AssertionError(f"Timed out: {description}; see {output}")

        def choose(selector, path):
            element = command("POST", "/element", {"using": "css selector", "value": selector})[ELEMENT]
            command("POST", f"/element/{element}/value", {"text": str(path)})

        try:
            wait(lambda: call("GET", "/status")["ready"], "geckodriver readiness")
            prefs = {"extensions.webextensions.uuids": json.dumps({"mivu@aminbahrabadi.github.io": UUID}),
                     "browser.startup.page": 0, "browser.newtabpage.enabled": False,
                     "datareporting.policy.dataSubmissionEnabled": False,
                     "toolkit.telemetry.enabled": False}
            result = call("POST", "/session", {"capabilities": {"alwaysMatch": {
                "browserName": "firefox", "moz:firefoxOptions": {
                    "binary": browser_bin, "args": ["-headless"], "prefs": prefs}}}})
            session = result["sessionId"]
            version = result["capabilities"]["browserVersion"]
            addon = command("POST", "/moz/addon/install", {"path": str(package), "temporary": True})
            check(addon == "mivu@aminbahrabadi.github.io", "Unexpected add-on identity")
            command("POST", "/moz/context", {"context": "chrome"})
            script("gBrowser.selectedBrowser.loadURI(Services.io.newURI(arguments[0]), {triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()})",
                   f"moz-extension://{UUID}/reader.html")
            command("POST", "/moz/context", {"context": "content"})
            wait(lambda: script("return !!document.getElementById('file-input')"), "reader page")
            command("POST", "/window/rect", {"width": 1100, "height": 850})
            document = Path(temp) / "راهنما with spaces.markdown"
            document.write_text((ROOT / "tests/fixtures/reading.md").read_text() +
                                f"\n[Local test link](http://127.0.0.1:{server.server_port}/click)\n"
                                f"![Must not load](http://127.0.0.1:{server.server_port}/no-auto-fetch.png)\n")
            choose("#file-input", document)
            wait(lambda: script("return document.querySelector('#docname').textContent === arguments[0]", document.name), "file selection")
            check(script("return !!document.querySelector('#document table') && document.querySelector('#document input').disabled"), "GFM/tasks failed")
            check(script("return getComputedStyle([...document.querySelectorAll('#document p')].find(p => p.textContent.startsWith('این'))).direction") == "rtl", "Persian direction failed")
            check(script("return getComputedStyle(document.querySelector('#document pre')).direction") == "ltr", "Code direction failed")
            check(script("return !!document.querySelector('#document .hljs-keyword')"), "Highlight tokens missing")
            check(not requests, "Remote image loaded automatically")
            image = Path(temp) / "photo.png"
            def chunk(kind, data):
                return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
            image.write_bytes(b"\x89PNG\r\n\x1a\n" +
                              chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0)) +
                              chunk(b"IDAT", zlib.compress(b"\0\x60\x56\xe8\xff")) + chunk(b"IEND", b""))
            choose("#image-input", image)
            wait(lambda: script("return !!document.querySelector('#document img')?.naturalWidth"), "selected image decoding")
            check(script("return document.querySelector('#document img').src.startsWith('blob:')"), "Image did not use blob")
            script("document.querySelector('#theme').value='dark';document.querySelector('#theme').dispatchEvent(new Event('change'))")
            check(script("return document.documentElement.dataset.theme") == "dark", "Dark theme failed")
            dark_background = script("return getComputedStyle(document.body).backgroundColor")
            script("document.querySelector('#search-btn').click();const i=document.querySelector('#search-input');i.value='Mivu';i.dispatchEvent(new Event('input'))")
            check(script("return document.querySelectorAll('#document mark').length") > 0, "Search failed")
            font_before = float(script("return parseFloat(getComputedStyle(document.querySelector('#document')).fontSize)"))
            script("document.querySelector('#search-close').click();window.dispatchEvent(new KeyboardEvent('keydown',{key:'+',ctrlKey:true}))")
            check(script("return document.querySelector('#zoom-status').textContent") == "110%", "Zoom failed")
            check(float(script("return parseFloat(getComputedStyle(document.querySelector('#document')).fontSize)")) > font_before,
                  "Zoom did not change rendered font size")
            screenshot = command("GET", "/screenshot")
            (output / "reader-dark.png").write_bytes(base64.b64decode(screenshot))
            script("document.querySelector('#theme').value='light';document.querySelector('#theme').dispatchEvent(new Event('change'))")
            check(script("return getComputedStyle(document.body).backgroundColor") != dark_background, "Theme did not change rendered colors")
            (output / "reader-light.png").write_bytes(base64.b64decode(command("GET", "/screenshot")))
            script("const data=new DataTransfer();data.items.add(new File(['# Dropped document'],'drop.md',{type:'text/markdown'}));document.querySelector('#dropzone').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}))")
            wait(lambda: script("return document.querySelector('#docname').textContent === 'drop.md'"), "DOM file drop")
            bad = Path(temp) / "invalid.md"
            bad.write_bytes(b"\xff")
            choose("#file-input", bad)
            wait(lambda: script("return document.querySelector('#error').textContent.includes('UTF-8')"), "invalid UTF-8 error")
            choose("#file-input", ROOT / "tests/fixtures/adversarial.md")
            wait(lambda: script("return document.querySelector('#docname').textContent === 'adversarial.md'"), "adversarial file")
            check(script("return !globalThis.mivuPayloadExecuted && !document.querySelector('#document script,#document svg,#document iframe,#document img,#document a')"), "Active Markdown survived")
            blocked = command("POST", "/execute/async", {"script": "const done=arguments[arguments.length-1];fetch(arguments[0]).then(()=>done(false),()=>done(true))", "args": [f"http://127.0.0.1:{server.server_port}/csp-test"]})
            check(blocked and not requests, "CSP allowed a connection")
            script("const s=document.createElement('script');s.textContent='globalThis.mivuInlineExecuted=true';document.body.append(s)")
            check(script("return !globalThis.mivuInlineExecuted"), "CSP allowed inline code")
            choose("#file-input", document)
            wait(lambda: script("return document.querySelector('#docname').textContent === arguments[0]", document.name), "document switching")
            script("document.querySelector(\"a[href$='/click']\").scrollIntoView({block:'center'})")
            element = command("POST", "/element", {"using": "css selector", "value": "a[href$='/click']"})[ELEMENT]
            command("POST", f"/element/{element}/click", {})
            wait(lambda: "/click" in requests, "explicit external link click")
            check(all(path in ("/click", "/favicon.ico") for path in requests), f"Unexpected document requests: {requests}")
            record = {"firefox": version, "status": "passed", "package": package.name,
                      "checks": ["file-input", "unicode-path", "GFM", "RTL/LTR computed direction", "highlight tokens",
                                 "selected raster decoding", "light/dark", "search", "zoom", "DOM file drop",
                                 "invalid UTF-8", "switching", "adversarial rendering", "CSP", "no automatic remote images",
                                 "explicit external link"],
                      "limitations": ["DOM drop is simulated; OS file drag and browser toolbar need manual verification",
                                      "Firefox 128/ESR and Android not tested"]}
            (output / "validation.json").write_text(json.dumps(record, indent=2) + "\n")
            print(json.dumps(record, indent=2))
        except Exception:
            if session:
                try:
                    (output / "failure.png").write_bytes(base64.b64decode(command("GET", "/screenshot")))
                    print("Reader diagnostic:", script("return {error:document.querySelector('#error')?.textContent,status:document.querySelector('#status')?.textContent}"))
                except Exception:
                    pass
            raise
        finally:
            if session:
                try:
                    command("DELETE", "")
                except Exception:
                    pass
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    main()
