#!/usr/bin/env python3
"""Exercise the actual Linux WebKit application using the platform WebDriver."""
import argparse
import base64
import ctypes
import json
import os
from pathlib import Path
import subprocess
import time
import tempfile
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def wait_for(check, timeout=10):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        value = check()
        if value:
            return value
        time.sleep(0.1)
    raise AssertionError('Timed out waiting for native application state')


class Driver:
    def __init__(self, port):
        self.base = f'http://127.0.0.1:{port}'
        self.session = None

    def request(self, method, path, body=None):
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(self.base + path, data=data, method=method,
                                     headers={'Content-Type': 'application/json'})
        try:
            result = json.load(urllib.request.urlopen(req, timeout=20))['value']
        except urllib.error.HTTPError as error:
            raise AssertionError(error.read().decode()) from error
        return result

    def execute(self, script, *args):
        return self.request('POST', f'/session/{self.session}/execute/sync',
                            {'script': script, 'args': list(args)})

    def screenshot(self, name):
        image = self.request('GET', f'/session/{self.session}/screenshot')
        output = ROOT / 'docs/screenshots' / name
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(base64.b64decode(image))


class Search(ctypes.Structure):
    _fields_ = [('title', ctypes.c_char_p), ('winclass', ctypes.c_char_p),
                ('winclassname', ctypes.c_char_p), ('winname', ctypes.c_char_p),
                ('pid', ctypes.c_int), ('max_depth', ctypes.c_long),
                ('only_visible', ctypes.c_int), ('screen', ctypes.c_int),
                ('require', ctypes.c_int), ('searchmask', ctypes.c_uint),
                ('desktop', ctypes.c_long), ('limit', ctypes.c_uint)]


def choose_native_file(path):
    lib = ctypes.CDLL('libxdo.so.3')
    lib.xdo_new.argtypes = [ctypes.c_char_p]
    lib.xdo_new.restype = ctypes.c_void_p
    handle = lib.xdo_new(os.environ['DISPLAY'].encode())
    assert handle, 'Could not connect to X11 test display'
    lib.xdo_search_windows.argtypes = [ctypes.c_void_p, ctypes.POINTER(Search),
                                       ctypes.POINTER(ctypes.POINTER(ctypes.c_ulong)),
                                       ctypes.POINTER(ctypes.c_uint)]
    query = Search(winname=b'^Open Markdown$', searchmask=20, only_visible=1, max_depth=1, require=1)
    windows = ctypes.POINTER(ctypes.c_ulong)()
    count = ctypes.c_uint()

    def find_dialog():
        lib.xdo_search_windows(handle, ctypes.byref(query), ctypes.byref(windows), ctypes.byref(count))
        return windows[0] if count.value else None

    window = wait_for(find_dialog)
    lib.xdo_focus_window.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
    lib.xdo_set_window_size.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_int, ctypes.c_int, ctypes.c_int]
    lib.xdo_move_mouse_relative_to_window.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_int, ctypes.c_int]
    lib.xdo_click_window.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_int]
    lib.xdo_send_keysequence_window.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_char_p, ctypes.c_uint]
    lib.xdo_enter_text_window.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_char_p, ctypes.c_uint]
    lib.xdo_free.argtypes = [ctypes.c_void_p]
    lib.xdo_set_window_size(handle, window, 900, 700, 0)
    lib.xdo_focus_window(handle, window)
    lib.xdo_send_keysequence_window(handle, 0, b'ctrl+l', 50000)
    lib.xdo_send_keysequence_window(handle, 0, b'ctrl+a', 50000)
    lib.xdo_enter_text_window(handle, 0, str(path).encode(), 50000)
    lib.xdo_move_mouse_relative_to_window(handle, window, 850, 678)
    lib.xdo_click_window(handle, 0, 1)
    lib.xdo_free(handle)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--binary', type=Path, default=ROOT / 'src-tauri/target/debug/mivu')
    parser.add_argument('--port', type=int, default=4446)
    parser.add_argument('--deb', type=Path)
    args = parser.parse_args()
    env = os.environ | {'TAURI_WEBVIEW_AUTOMATION': 'true', 'GDK_BACKEND': 'x11'}
    profile = ROOT / 'test-results/native-profile'
    if args.deb:
        extracted = ROOT / 'test-results/package-root'
        extracted.mkdir(parents=True, exist_ok=True)
        subprocess.run(['dpkg-deb', '--extract', str(args.deb), str(extracted)], check=True)
        args.binary = extracted / 'usr/bin/mivu'
        env['PATH'] = str(args.binary.parent) + os.pathsep + env['PATH']
        env['XDG_DATA_DIRS'] = str(extracted / 'usr/share') + os.pathsep + env.get('XDG_DATA_DIRS', '/usr/local/share:/usr/share')
        subprocess.run(['desktop-file-validate', str(extracted / 'usr/share/applications/Mivu.desktop')], check=True)
        subprocess.run(['update-mime-database', str(extracted / 'usr/share/mime')], env=env, check=True)
    for kind in ('data', 'config', 'cache'):
        env[f'XDG_{kind.upper()}_HOME'] = str(profile / kind)
    driver = Driver(args.port)
    log_path = ROOT / 'test-results/native-driver.log'
    log_path.parent.mkdir(exist_ok=True)
    with log_path.open('w') as log:
        process = subprocess.Popen(['WebKitWebDriver', f'--port={args.port}'], env=env, stdout=log, stderr=log)
        try:
            def ready():
                try: return driver.request('GET', '/status')
                except urllib.error.URLError: return None
            wait_for(ready)
            result = driver.request('POST', '/session', {'capabilities': {'alwaysMatch': {
                'webkitgtk:browserOptions': {'binary': str(args.binary.resolve()), 'args': []}}}})
            driver.session = result['sessionId']
            wait_for(lambda: driver.execute('return !!document.querySelector("#theme")'))
            driver.execute('document.querySelector("#theme").value="light"; document.querySelector("#theme").dispatchEvent(new Event("change"))')
            driver.screenshot('empty-light.png')
            driver.execute('document.querySelector("[data-action=open]").click()')
            choose_native_file(ROOT / 'tests/fixtures/reading.md')
            wait_for(lambda: driver.execute('return document.querySelector("h1")?.textContent') == 'Reading, without the noise')
            wait_for(lambda: driver.execute('return document.querySelector("article img")?.naturalWidth') == 32)
            driver.execute('document.activeElement.blur()')
            driver.screenshot('reader-light.png')
            driver.execute('document.querySelector("#theme").value="dark"; document.querySelector("#theme").dispatchEvent(new Event("change"))')
            driver.screenshot('reader-dark.png')
            driver.execute('document.querySelector("#find").click(); const input=document.querySelector("#search-input"); input.value="read"; input.dispatchEvent(new Event("input"))')
            assert driver.execute('return document.querySelectorAll("mark").length') >= 2
            driver.execute('document.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape"}))')
            assert driver.execute('return document.querySelector("#search-bar").hidden')
            driver.execute('document.dispatchEvent(new KeyboardEvent("keydown", {key:"+",ctrlKey:true}))')
            assert driver.execute('return document.querySelector("#zoom-status").textContent') == '110%'
            driver.execute('document.dispatchEvent(new KeyboardEvent("keydown", {key:"0",ctrlKey:true}))')
            driver.execute("Array.from(document.querySelectorAll('a')).find(a => a.getAttribute('href').startsWith('second.md')).click()")
            wait_for(lambda: driver.execute('return document.querySelector("h1")?.textContent') == 'The next page')
            driver.execute('document.querySelector("[data-action=open]").click()')
            choose_native_file(ROOT / 'tests/fixtures/persian.md')
            wait_for(lambda: driver.execute('return document.querySelector("h1")?.textContent') == 'کمی فضا برای خواندن')
            assert driver.execute('return getComputedStyle(document.querySelector("article p")).direction') == 'rtl'
            assert driver.execute('return getComputedStyle(document.querySelector("pre")).direction') == 'ltr'
            driver.execute('document.activeElement.blur()')
            driver.screenshot('persian-dark.png')
            driver.request('POST', f'/session/{driver.session}/window/rect', {'width': 560, 'height': 720})
            assert driver.execute('return document.documentElement.scrollWidth <= window.innerWidth')
            driver.screenshot('persian-narrow.png')
            with tempfile.TemporaryDirectory(dir=ROOT / 'test-results') as temporary:
                folder = Path(temporary)
                path = folder / 'سلام with spaces.md'
                long_text = '\n\nA paragraph for reading and scrolling.' * 100
                path.write_text('# Initial' + long_text)
                if args.deb:
                    mime = subprocess.check_output(['xdg-mime', 'query', 'filetype', str(path)], env=env, text=True).strip()
                    assert mime == 'text/markdown', mime
                    subprocess.run(['gio', 'launch', str(extracted / 'usr/share/applications/Mivu.desktop'), str(path)], env=env, check=True, timeout=10)
                    wait_for(lambda: driver.execute('return document.querySelector("h1")?.textContent') == 'Initial')
                subprocess.run([str(args.binary.resolve()), path.name], cwd=folder, env=env, check=True, timeout=10)
                wait_for(lambda: driver.execute('return document.querySelector("h1")?.textContent') == 'Initial')
                driver.execute('document.querySelector("#reader").scrollTo({top:200,behavior:"instant"})')
                original_scroll = driver.execute('return document.querySelector("#reader").scrollTop')
                before = time.monotonic()
                path.write_text('# Updated' + long_text)
                wait_for(lambda: driver.execute('return document.querySelector("h1")?.textContent') == 'Updated')
                watch_ms = round((time.monotonic() - before) * 1000, 1)
                assert abs(driver.execute('return document.querySelector("#reader").scrollTop') - original_scroll) < 2
                replacement = folder / 'atomic.tmp'
                replacement.write_text('# Atomic replacement' + long_text)
                replacement.replace(path)
                wait_for(lambda: driver.execute('return document.querySelector("h1")?.textContent') == 'Atomic replacement')
                path.unlink()
                wait_for(lambda: driver.execute('return !document.querySelector("#error").hidden'))
                assert driver.execute('return document.querySelector("h1")?.textContent') == 'Atomic replacement'
                path.write_text('# Restored' + long_text)
                wait_for(lambda: driver.execute('return document.querySelector("h1")?.textContent') == 'Restored')
                assert driver.execute('return document.querySelector("#error").hidden')
                subprocess.run([str(args.binary.resolve()), 'missing.md'], cwd=folder, env=env, check=True, timeout=10)
                wait_for(lambda: driver.execute('return !document.querySelector("#error").hidden'))
                assert driver.execute('return document.querySelector("h1")?.textContent') == 'Restored'
                driver.request('DELETE', f'/session/{driver.session}')
                driver.session = None
                result = driver.request('POST', '/session', {'capabilities': {'alwaysMatch': {
                    'webkitgtk:browserOptions': {'binary': str(args.binary.resolve()), 'args': [str(path)]}}}})
                driver.session = result['sessionId']
                wait_for(lambda: driver.execute('return document.querySelector("h1")?.textContent') == 'Restored')
                print(f'PASS: native reader, startup/second-instance CLI, watch/atomic replacement/deletion/recovery; observed refresh {watch_ms} ms')
        except Exception:
            print(driver.execute("return document.body.innerText"))
            subprocess.run(["xwininfo", "-root", "-tree"], check=False)
            raise
        finally:
            if driver.session:
                try: driver.request('DELETE', f'/session/{driver.session}')
                except (OSError, AssertionError): pass
            process.terminate()
            process.wait(timeout=10)


if __name__ == '__main__':
    main()
