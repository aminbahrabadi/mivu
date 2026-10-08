#!/usr/bin/env python3
"""Measure the built application on an isolated display; never touches user files."""
import argparse
import json
import os
from pathlib import Path
import platform
import statistics
import subprocess
import tempfile
import time
import urllib.error
from native_smoke import Driver, ROOT, wait_for


def rss_tree(pid):
    total = 0
    try:
        status = Path(f'/proc/{pid}/status').read_text()
        for line in status.splitlines():
            if line.startswith('VmRSS:'):
                total += int(line.split()[1])
        children = Path(f'/proc/{pid}/task/{pid}/children').read_text().split()
        total += sum(rss_tree(int(child)) for child in children)
    except (FileNotFoundError, PermissionError, ProcessLookupError):
        pass
    return total


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--binary', type=Path, default=ROOT / 'src-tauri/target/release/mivu')
    parser.add_argument('--output', type=Path, default=ROOT / 'test-results/native-benchmark.json')
    args = parser.parse_args()
    binary = args.binary.resolve()
    fixture = (ROOT / 'tests/fixtures/reading.md').read_text()
    report = {
        'platform': platform.platform(), 'cpu': next((line.split(':', 1)[1].strip() for line in Path('/proc/cpuinfo').read_text().splitlines() if line.startswith('model name')), platform.processor()),
        'binary': str(binary.relative_to(ROOT)) if binary.is_relative_to(ROOT) else str(binary), 'webkit': subprocess.check_output(['pkg-config', '--modversion', 'webkit2gtk-4.1'], text=True).strip(),
        'conditions': 'Isolated X11 display. Process-cold starts with warm OS caches. Open timings include single-instance IPC, parse, sanitize and DOM insertion; images may still decode. RSS includes WebKit descendants and double-counts shared pages. Three samples per case; polling every 10 ms. Complete-open timings wait for aria-busy=false. First content means first heading in the DOM, not paint. A 50 ms timer estimates main-thread scheduling gaps. RSS sampled after one idle second.',
        'startup_ms': [], 'documents': {}, 'watch_ms': [],
    }
    driver = Driver(4447)
    with tempfile.TemporaryDirectory(dir=ROOT / 'test-results') as directory:
        folder = Path(directory)
        (folder / 'mivu.png').write_bytes((ROOT / 'tests/fixtures/mivu.png').read_bytes())
        env = os.environ | {'TAURI_WEBVIEW_AUTOMATION': 'true', 'GDK_BACKEND': 'x11'}
        for kind in ('data', 'cache', 'config'):
            env[f'XDG_{kind.upper()}_HOME'] = str(folder / kind)
        with (folder / 'driver.log').open('w') as log:
            process = subprocess.Popen(['WebKitWebDriver', '--port=4447'], env=env, stdout=log, stderr=log)
            try:
                def ready():
                    try: return driver.request('GET', '/status')
                    except urllib.error.URLError: return None
                wait_for(ready)
                for _ in range(3):
                    before = time.perf_counter()
                    session = driver.request('POST', '/session', {'capabilities': {'alwaysMatch': {'webkitgtk:browserOptions': {'binary': str(binary.relative_to(ROOT)) if binary.is_relative_to(ROOT) else str(binary), 'args': []}}}})
                    driver.session = session['sessionId']
                    wait_for(lambda: driver.execute('return !!document.querySelector("#theme")'))
                    report['startup_ms'].append(round((time.perf_counter() - before) * 1000, 2))
                    driver.request('DELETE', f'/session/{driver.session}')
                    driver.session = None
                session = driver.request('POST', '/session', {'capabilities': {'alwaysMatch': {'webkitgtk:browserOptions': {'binary': str(binary.relative_to(ROOT)) if binary.is_relative_to(ROOT) else str(binary), 'args': []}}}})
                driver.session = session['sessionId']
                wait_for(lambda: driver.execute('return !!document.querySelector("#theme")'))
                for kib in (8, 64, 512, 2048):
                    content = fixture * max(1, (kib * 1024) // len(fixture.encode()))
                    measurements = []
                    first_content = []
                    gaps = []
                    for sample in range(3):
                        title = f'Benchmark {kib} KiB {sample}'
                        path = folder / f'{kib}-{sample}.md'
                        path.write_text(f'# {title}\n\n' + content)
                        driver.execute('window.__benchmarkGaps=[]; window.__benchmarkLast=performance.now(); window.__benchmarkTimer=setInterval(() => { const now=performance.now(); window.__benchmarkGaps.push(now-window.__benchmarkLast); window.__benchmarkLast=now; }, 50)')
                        before = time.perf_counter()
                        subprocess.run([str(binary), str(path)], env=env, check=True, stdout=log, stderr=log, timeout=10)
                        deadline = time.monotonic() + 30
                        first = None
                        while True:
                            state = driver.execute('return {shown: document.querySelector("h1")?.textContent === arguments[0], ready: document.querySelector("#reader").getAttribute("aria-busy") !== "true"}', title)
                            if state['shown'] and first is None:
                                first = (time.perf_counter() - before) * 1000
                            if state['shown'] and state['ready']: break
                            assert time.monotonic() < deadline
                            time.sleep(0.01)
                        assert driver.execute('return document.querySelector("#error").hidden'), 'Benchmark document did not render completely'
                        measurements.append(round((time.perf_counter() - before) * 1000, 2))
                        first_content.append(round(first, 2))
                        gaps.append(driver.execute('clearInterval(window.__benchmarkTimer); return Math.max(50, ...window.__benchmarkGaps)'))
                    time.sleep(1)
                    children = Path(f'/proc/{process.pid}/task/{process.pid}/children').read_text().split()
                    memory = sum(rss_tree(int(child)) for child in children)
                    report['documents'][str(kib)] = {'bytes': path.stat().st_size, 'open_ms': measurements, 'first_content_ms': first_content, 'max_timer_gap_ms': gaps, 'median_ms': round(statistics.median(measurements), 2), 'rss_tree_mib': round(memory / 1024, 2)}
                    print(f'{kib} KiB: median {statistics.median(measurements):.1f} ms; RSS tree {memory / 1024:.1f} MiB', flush=True)
                path = folder / 'watch.md'
                path.write_text('# Watching\n\n' + fixture * 90)
                subprocess.run([str(binary), str(path)], env=env, check=True, stdout=log, stderr=log, timeout=10)
                wait_for(lambda: driver.execute('return document.querySelector("h1")?.textContent') == 'Watching')
                for sample in range(3):
                    title = f'Watch {sample}'
                    before = time.perf_counter()
                    path.write_text(f'# {title}\n\n' + fixture * 90)
                    deadline = time.monotonic() + 30
                    while not driver.execute('return document.querySelector("h1")?.textContent === arguments[0] && document.querySelector("#reader").getAttribute("aria-busy") !== "true"', title):
                        assert time.monotonic() < deadline
                        time.sleep(0.01)
                    report['watch_ms'].append(round((time.perf_counter() - before) * 1000, 2))
                args.output.parent.mkdir(parents=True, exist_ok=True)
                args.output.write_text(json.dumps(report, indent=2) + '\n')
                print(json.dumps(report, indent=2))
            finally:
                if driver.session:
                    driver.request('DELETE', f'/session/{driver.session}')
                process.terminate()
                process.wait(timeout=10)


if __name__ == '__main__':
    main()
