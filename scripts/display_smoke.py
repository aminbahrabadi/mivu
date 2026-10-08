#!/usr/bin/env python3
"""Check actual WebKit startup and computed layout on a requested display backend."""
import argparse
import os
from pathlib import Path
import subprocess
import tempfile
import urllib.error
from native_smoke import Driver, ROOT, wait_for

parser = argparse.ArgumentParser()
parser.add_argument('--backend', choices=('x11', 'wayland'), required=True)
parser.add_argument('--scale', type=int, choices=(1, 2), default=1)
parser.add_argument('--binary', type=Path, default=ROOT / 'src-tauri/target/release/mivu')
args = parser.parse_args()
(ROOT / 'test-results').mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(dir=ROOT / 'test-results') as temporary:
    folder = Path(temporary)
    env = os.environ | {'TAURI_WEBVIEW_AUTOMATION': 'true', 'GDK_BACKEND': args.backend, 'GDK_SCALE': str(args.scale)}
    for kind in ('data', 'config', 'cache'):
        env[f'XDG_{kind.upper()}_HOME'] = str(folder / kind)
    driver = Driver(4448)
    with (folder / 'driver.log').open('w') as log:
        process = subprocess.Popen(['WebKitWebDriver', '--port=4448'], env=env, stdout=log, stderr=log)
        try:
            def ready():
                try: return driver.request('GET', '/status')
                except urllib.error.URLError: return None
            wait_for(ready)
            result = driver.request('POST', '/session', {'capabilities': {'alwaysMatch': {'webkitgtk:browserOptions': {'binary': str(args.binary.resolve()), 'args': [str(ROOT / 'tests/fixtures/persian.md')]}}}})
            driver.session = result['sessionId']
            wait_for(lambda: driver.execute('return document.querySelector("article h1") && document.querySelector("#reader").getAttribute("aria-busy") !== "true"'))
            result = driver.execute('return {dpr: devicePixelRatio, width: innerWidth, rtl: getComputedStyle(document.querySelector("article p")).direction, code: getComputedStyle(document.querySelector("pre")).direction, overflow: document.documentElement.scrollWidth > innerWidth}')
            assert result['rtl'] == 'rtl' and result['code'] == 'ltr' and not result['overflow'], result
            if args.scale == 2: assert result['dpr'] == 2, result
            print(f'PASS: {args.backend}, scale {args.scale}, computed layout {result}')
        finally:
            if driver.session: driver.request('DELETE', f'/session/{driver.session}')
            process.terminate()
            process.wait(timeout=10)
