#!/usr/bin/env python3
"""Exercise the actual Linux WebKit application using the platform WebDriver."""
import argparse
import base64
import ctypes
import json
import hashlib
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


def document_ready(driver, title):
    return driver.execute('return document.querySelector("article h1")?.textContent === arguments[0] && document.querySelector("#reader").getAttribute("aria-busy") !== "true"', title)


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

    def execute_async(self, script, *args):
        return self.request('POST', f'/session/{self.session}/execute/async',
                            {'script': script, 'args': list(args)})

    def screenshot(self, name):
        image = self.request('GET', f'/session/{self.session}/screenshot')
        output = self.screenshot_directory / name
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(base64.b64decode(image))


class Search(ctypes.Structure):
    _fields_ = [('title', ctypes.c_char_p), ('winclass', ctypes.c_char_p),
                ('winclassname', ctypes.c_char_p), ('winname', ctypes.c_char_p),
                ('pid', ctypes.c_int), ('max_depth', ctypes.c_long),
                ('only_visible', ctypes.c_int), ('screen', ctypes.c_int),
                ('require', ctypes.c_int), ('searchmask', ctypes.c_uint),
                ('desktop', ctypes.c_long), ('limit', ctypes.c_uint)]


class ClientMessage(ctypes.Structure):
    _fields_ = [('type', ctypes.c_int), ('serial', ctypes.c_ulong),
                ('send_event', ctypes.c_int), ('display', ctypes.c_void_p),
                ('window', ctypes.c_ulong), ('message_type', ctypes.c_ulong),
                ('format', ctypes.c_int), ('data', ctypes.c_long * 5)]


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
    lib.xdo_send_keysequence_window(handle, 0, b'Return', 50000)
    time.sleep(0.2)
    lib.xdo_send_keysequence_window(handle, 0, b'alt+o', 50000)
    lib.xdo_free(handle)


def close_native_window():
    lib = ctypes.CDLL('libxdo.so.3')
    lib.xdo_new.argtypes = [ctypes.c_char_p]
    lib.xdo_new.restype = ctypes.c_void_p
    handle = lib.xdo_new(os.environ['DISPLAY'].encode())
    assert handle
    lib.xdo_search_windows.argtypes = [ctypes.c_void_p, ctypes.POINTER(Search),
                                       ctypes.POINTER(ctypes.POINTER(ctypes.c_ulong)),
                                       ctypes.POINTER(ctypes.c_uint)]
    query = Search(winname=' — Mivu$'.encode(), searchmask=20, only_visible=1, max_depth=1, require=1)
    windows = ctypes.POINTER(ctypes.c_ulong)()
    count = ctypes.c_uint()
    lib.xdo_search_windows(handle, ctypes.byref(query), ctypes.byref(windows), ctypes.byref(count))
    assert count.value == 1, 'Expected one visible Mivu reader window'
    window = windows[0]
    lib.xdo_free.argtypes = [ctypes.c_void_p]
    lib.xdo_free(handle)
    # Send the same graceful close request as a window manager, not XDestroyWindow.
    xlib = ctypes.CDLL('libX11.so.6')
    xlib.XOpenDisplay.argtypes = [ctypes.c_char_p]
    xlib.XOpenDisplay.restype = ctypes.c_void_p
    display = xlib.XOpenDisplay(os.environ['DISPLAY'].encode())
    assert display
    xlib.XInternAtom.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int]
    xlib.XInternAtom.restype = ctypes.c_ulong
    xlib.XSendEvent.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_int, ctypes.c_long, ctypes.c_void_p]
    xlib.XCloseDisplay.argtypes = [ctypes.c_void_p]
    event = ctypes.create_string_buffer(ctypes.sizeof(ctypes.c_long) * 24)
    message = ClientMessage.from_buffer(event)
    message.type = 33
    message.display = display
    message.window = window
    message.message_type = xlib.XInternAtom(display, b'WM_PROTOCOLS', 0)
    message.format = 32
    message.data[0] = xlib.XInternAtom(display, b'WM_DELETE_WINDOW', 0)
    assert xlib.XSendEvent(display, window, 0, 0, event)
    xlib.XCloseDisplay(display)
    time.sleep(0.2)



def drag_file(path, env):
    process = subprocess.Popen(['/usr/bin/python3', str(ROOT / 'scripts/drag_source.py'), str(path)], env=env)
    try:
        time.sleep(0.6)
        lib = ctypes.CDLL('libxdo.so.3')
        lib.xdo_new.argtypes = [ctypes.c_char_p]
        lib.xdo_new.restype = ctypes.c_void_p
        handle = lib.xdo_new(os.environ['DISPLAY'].encode())
        lib.xdo_move_mouse.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int]
        lib.xdo_mouse_down.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_int]
        lib.xdo_mouse_up.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_int]
        lib.xdo_free.argtypes = [ctypes.c_void_p]
        lib.xdo_move_mouse(handle, 1120, 90, 0)
        lib.xdo_mouse_down(handle, 0, 1)
        for x in range(1120, 450, -25):
            lib.xdo_move_mouse(handle, x, 180, 0)
            time.sleep(0.03)
        time.sleep(0.3)
        lib.xdo_mouse_up(handle, 0, 1)
        lib.xdo_free(handle)
        time.sleep(0.3)
    finally:
        process.terminate()
        process.wait(timeout=5)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--binary', type=Path, default=ROOT / 'src-tauri/target/debug/mivu')
    parser.add_argument('--port', type=int, default=4446)
    parser.add_argument('--deb', type=Path)
    parser.add_argument('--screenshots', type=Path, default=ROOT / 'test-results/screenshots')
    args = parser.parse_args()
    fixture_hashes = {p: hashlib.sha256(p.read_bytes()).digest() for p in (ROOT / "tests/fixtures").rglob("*") if p.is_file()}
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
    driver.screenshot_directory = args.screenshots
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
            wait_for(lambda: document_ready(driver, 'Reading, without the noise'))
            wait_for(lambda: driver.execute('return document.querySelector("article img")?.naturalWidth') == 32)
            driver.execute('document.activeElement.blur()')
            driver.screenshot('reader-light.png')
            driver.execute('document.querySelector("#theme").value="dark"; document.querySelector("#theme").dispatchEvent(new Event("change"))')
            driver.screenshot('reader-dark.png')
            driver.execute('document.querySelector("[data-action=open]").click()')
            choose_native_file(ROOT / 'tests/fixtures/embedded-images.md')
            wait_for(lambda: document_ready(driver, 'Embedded image export'))
            wait_for(lambda: driver.execute('return [...document.querySelectorAll("article img")].filter(img => img.complete && img.naturalWidth === 32).length') == 4)
            assert driver.execute('return !document.querySelector("article a[href^=data],article img[src^=http]") && document.querySelector("article").textContent.includes("Remote image blocked") && !document.querySelector("article").textContent.includes("![][image")')
            for theme in ('light', 'dark'):
                driver.execute('document.querySelector("#theme").value=arguments[0]; document.querySelector("#theme").dispatchEvent(new Event("change"))', theme)
                driver.execute('document.querySelector("#reader").scrollTo({top:0,behavior:"instant"}); document.activeElement.blur()')
                driver.screenshot(f'embedded-images-{theme}.png')
            driver.execute('document.querySelector("[data-action=open]").click()')
            choose_native_file(ROOT / 'tests/fixtures/tables.md')
            wait_for(lambda: document_ready(driver, 'Readable tables'))
            for theme, width, zoom in (('light', 1000, 100), ('light', 560, 100), ('dark', 1000, 100), ('dark', 560, 100), ('dark', 560, 180)):
                driver.execute('document.querySelector("#theme").value=arguments[0]; document.querySelector("#theme").dispatchEvent(new Event("change"))', theme)
                driver.request('POST', f'/session/{driver.session}/window/rect', {'width': width, 'height': 850})
                driver.execute('document.querySelector("article").style.setProperty("--reader-size", arguments[0] + "px")', 17 * zoom / 100)
                layout = driver.execute('''
                    const table = document.querySelector('article table');
                    const singleLine = cell => {
                        const range = document.createRange();
                        range.selectNodeContents(cell);
                        return range.getBoundingClientRect().height <= parseFloat(getComputedStyle(cell).lineHeight);
                    };
                    const padded = cell => {
                        const range = document.createRange();
                        range.selectNodeContents(cell);
                        const text = range.getBoundingClientRect();
                        const box = cell.getBoundingClientRect();
                        const style = getComputedStyle(cell);
                        return text.left >= box.left + parseFloat(style.paddingLeft) - 1 && text.right <= box.right - parseFloat(style.paddingRight) + 1;
                    };
                    const wrappers = [...document.querySelectorAll('.table-scroll')];
                    const compactCells = [0, 1, 3, 4, 5, 6].map(i => table.tBodies[0].rows[0].cells[i]);
                    const description = table.tBodies[0].rows[0].cells[2];
                    const descriptionRange = document.createRange();
                    descriptionRange.selectNodeContents(description);
                    return {
                        headers: [...table.tHead.rows[0].cells].every(singleLine),
                        compact: compactCells.every(singleLine),
                        description: descriptionRange.getBoundingClientRect().height <= 4 * parseFloat(getComputedStyle(description).lineHeight),
                        cells: [...table.querySelectorAll('th,td')].every(padded) && [...document.querySelectorAll('article th,article td')].every(cell => cell.scrollWidth <= cell.clientWidth + 1),
                        confined: document.documentElement.scrollWidth <= innerWidth && document.querySelector('#reader').scrollWidth <= document.querySelector('#reader').clientWidth,
                        scrollable: wrappers[0].scrollWidth > wrappers[0].clientWidth,
                        longValue: wrappers[2].scrollWidth > wrappers[2].clientWidth,
                        rtl: getComputedStyle(wrappers[1].querySelector('tbody td:nth-child(2)')).direction,
                        code: getComputedStyle(wrappers[1].querySelector('code')).direction
                    };
                ''')
                assert all(layout[key] for key in ('headers', 'compact', 'description', 'cells', 'confined', 'longValue')), layout
                assert layout['rtl'] == 'rtl' and layout['code'] == 'ltr', layout
                if width == 560: assert layout['scrollable'], layout
                if zoom == 100:
                    driver.execute('document.activeElement.blur()')
                    driver.screenshot(f'tables-{theme}-{width}.png')
            driver.execute('document.querySelector("article").style.removeProperty("--reader-size")')
            driver.request('POST', f'/session/{driver.session}/window/rect', {'width': 1000, 'height': 850})
            driver.execute('document.querySelector("[data-action=open]").click()')
            choose_native_file(ROOT / 'tests/fixtures/reading.md')
            wait_for(lambda: document_ready(driver, 'Reading, without the noise'))
            driver.execute('document.querySelector("#find").click(); const input=document.querySelector("#search-input"); input.value="read"; input.dispatchEvent(new Event("input"))')
            assert driver.execute('return document.querySelectorAll("mark").length') >= 2
            driver.execute('document.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape"}))')
            assert driver.execute('return document.querySelector("#search-bar").hidden')
            driver.execute('document.dispatchEvent(new KeyboardEvent("keydown", {key:"+",ctrlKey:true}))')
            assert driver.execute('return document.querySelector("#zoom-status").textContent') == '110%'
            driver.execute('document.dispatchEvent(new KeyboardEvent("keydown", {key:"0",ctrlKey:true}))')
            driver.execute("Array.from(document.querySelectorAll('a')).find(a => a.getAttribute('href').startsWith('second.md')).click()")
            wait_for(lambda: document_ready(driver, 'The next page'))
            driver.execute('document.querySelector("[data-action=open]").click()')
            choose_native_file(ROOT / 'tests/fixtures/persian.md')
            wait_for(lambda: document_ready(driver, 'کمی فضا برای خواندن'))
            assert driver.execute('return getComputedStyle(document.querySelector("article p")).direction') == 'rtl'
            assert driver.execute('return getComputedStyle(document.querySelector("pre")).direction') == 'ltr'
            driver.execute('document.activeElement.blur()')
            driver.screenshot('persian-dark.png')
            driver.request('POST', f'/session/{driver.session}/window/rect', {'width': 560, 'height': 720})
            assert driver.execute('return document.documentElement.scrollWidth <= window.innerWidth')
            driver.screenshot('persian-narrow.png')
            driver.execute('document.querySelector("[data-action=open]").click()')
            choose_native_file(ROOT / 'tests/fixtures/mixed-rtl.md')
            wait_for(lambda: document_ready(driver, 'راهنمای مستندات دو زبانه'))
            for theme, width, zoom in (('light', 1000, 100), ('light', 560, 100), ('dark', 1000, 100), ('dark', 560, 100), ('dark', 560, 180)):
                driver.execute('document.querySelector("#theme").value=arguments[0]; document.querySelector("#theme").dispatchEvent(new Event("change"))', theme)
                driver.request('POST', f'/session/{driver.session}/window/rect', {'width': width, 'height': 1000})
                driver.execute('document.querySelector("article").style.setProperty("--reader-size", arguments[0] + "px")', 17 * zoom / 100)
                layout = driver.execute('''
                    const article = document.querySelector('article');
                    const direction = node => getComputedStyle(node).direction;
                    const paragraphs = [...article.querySelectorAll(':scope > p')];
                    const list = article.querySelector('ul');
                    const nested = article.querySelector('ul ul');
                    const firstText = paragraphs[0].firstChild;
                    const range = document.createRange();
                    range.setStart(firstText, 0); range.setEnd(firstText, 5);
                    const event = range.getBoundingClientRect();
                    range.setStart(firstText, 6); range.setEnd(firstText, 13);
                    const service = range.getBoundingClientRect();
                    return {
                        paragraphs: paragraphs.map(direction),
                        bullets: [...list.children].map(direction),
                        list: direction(list),
                        indent: list.getBoundingClientRect().right - list.firstElementChild.getBoundingClientRect().right,
                        ordered: direction(article.querySelector('ol')),
                        nestedParent: direction(nested.parentElement),
                        nested: direction(nested),
                        code: [...article.querySelectorAll('code,pre')].every(node => direction(node) === 'ltr'),
                        englishPhrase: event.left < service.left,
                        confined: document.documentElement.scrollWidth <= innerWidth && document.querySelector('#reader').scrollWidth <= document.querySelector('#reader').clientWidth,
                        text: article.textContent
                    };
                ''')
                assert layout['paragraphs'][:3] == ['rtl', 'rtl', 'ltr'], layout
                assert all(d == 'rtl' for d in layout['paragraphs'][3:]), layout
                assert all(d == 'rtl' for d in layout['bullets']), layout
                assert layout['list'] == 'rtl' and layout['ordered'] == 'rtl' and layout['indent'] > 10, layout
                assert layout['nestedParent'] == 'ltr' and layout['nested'] == 'rtl', layout
                assert layout['code'] and layout['englishPhrase'] and layout['confined'], layout
                driver.execute('document.querySelector("#reader").scrollTo({top:0,behavior:"instant"}); document.activeElement.blur()')
                driver.screenshot(f'mixed-rtl-{theme}-{width}-{zoom}.png')
            driver.execute('document.querySelector("article").style.removeProperty("--reader-size")')
            driver.execute('document.querySelector("#find").click(); const input=document.querySelector("#search-input"); input.value="DLQ"; input.dispatchEvent(new Event("input"))')
            assert driver.execute('return getComputedStyle(document.querySelector("article li")).direction') == 'rtl'
            driver.execute('document.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape"}))')
            assert driver.execute('return document.querySelector("article").textContent') == layout['text']
            with tempfile.TemporaryDirectory(dir=ROOT / 'test-results') as temporary:
                folder = Path(temporary)
                path = folder / 'سلام with spaces.md'
                long_text = '\n\nA paragraph for reading and scrolling.' * 100
                path.write_text('# Initial' + long_text)
                if args.deb:
                    mime = subprocess.check_output(['gio', 'info', '--attributes=standard::content-type', str(path)], env=env, text=True)
                    assert 'standard::content-type: text/markdown' in mime, mime
                    subprocess.run(['gio', 'launch', str(extracted / 'usr/share/applications/Mivu.desktop'), str(path)], env=env, check=True, timeout=10)
                    wait_for(lambda: document_ready(driver, 'Initial'))
                subprocess.run([str(args.binary.resolve()), path.name], cwd=folder, env=env | {'PWD': str(folder)}, check=True, timeout=10)
                wait_for(lambda: document_ready(driver, 'Initial'))
                driver.execute('document.querySelector("#reader").scrollTo({top:200,behavior:"instant"})')
                original_scroll = driver.execute('return document.querySelector("#reader").scrollTop')
                drag = folder / 'dropped.markdown'
                drag.write_text('# Dropped document')
                if args.deb:
                    assert 'standard::content-type: text/markdown' in subprocess.check_output(['gio', 'info', '--attributes=standard::content-type', str(drag)], env=env, text=True)
                drag_file(drag, env)
                wait_for(lambda: document_ready(driver, 'Dropped document'))
                subprocess.run([str(args.binary.resolve()), str(path)], env=env, check=True, timeout=10)
                wait_for(lambda: document_ready(driver, 'Initial'))
                driver.execute('document.querySelector("#reader").scrollTo({top:200,behavior:"instant"})')
                original_scroll = driver.execute('return document.querySelector("#reader").scrollTop')
                before = time.monotonic()
                path.write_text('# Updated' + long_text)
                wait_for(lambda: document_ready(driver, 'Updated'))
                watch_ms = round((time.monotonic() - before) * 1000, 1)
                assert abs(driver.execute('return document.querySelector("#reader").scrollTop') - original_scroll) < 2
                replacement = folder / 'atomic.tmp'
                replacement.write_text('# Atomic replacement' + long_text)
                replacement.replace(path)
                wait_for(lambda: document_ready(driver, 'Atomic replacement'))
                path.unlink()
                wait_for(lambda: driver.execute('return !document.querySelector("#error").hidden'))
                assert driver.execute('return document.querySelector("h1")?.textContent') == 'Atomic replacement'
                path.write_text('# Restored' + long_text)
                wait_for(lambda: document_ready(driver, 'Restored'))
                assert driver.execute('return document.querySelector("#error").hidden')
                subprocess.run([str(args.binary.resolve()), 'missing.md'], cwd=folder, env=env | {'PWD': str(folder)}, check=True, timeout=10)
                wait_for(lambda: driver.execute('return !document.querySelector("#error").hidden'))
                assert driver.execute('return document.querySelector("h1")?.textContent') == 'Restored'
                close_native_window()
                driver.request('DELETE', f'/session/{driver.session}')
                driver.session = None
                result = driver.request('POST', '/session', {'capabilities': {'alwaysMatch': {
                    'webkitgtk:browserOptions': {'binary': str(args.binary.resolve()), 'args': [str(path.relative_to(ROOT))]}}}})
                driver.session = result['sessionId']
                wait_for(lambda: document_ready(driver, 'Restored'))
                subprocess.run([str(args.binary.resolve()), str(ROOT / 'tests/fixtures/adversarial.md')], env=env, check=True, timeout=10)
                wait_for(lambda: document_ready(driver, 'Untrusted input'))
                assert driver.execute('return !window.__mivuPwned && !document.querySelector("article script,article iframe,article object,article svg")')
                assert driver.execute('return !document.querySelector("article img[src^=http]")')
                assert driver.execute_async("const done=arguments[arguments.length-1]; window.__TAURI_INTERNALS__.invoke('plugin:fs|read_text_file', {path:'/etc/passwd'}).then(()=>done(false),()=>done(true))")
                assert driver.execute_async("const done=arguments[arguments.length-1]; window.__TAURI_INTERNALS__.invoke('current_document').then(state=>window.__TAURI_INTERNALS__.invoke('read_image',{id:state.document.id,reference:'../../LICENSE'})).then(()=>done(false),()=>done(true))")
                driver.execute("setTimeout(()=>{location.href='https://example.invalid/'},0)")
                time.sleep(0.2)
                assert driver.execute('return location.protocol') == 'tauri:'
                assert all(hashlib.sha256(p.read_bytes()).digest() == digest for p, digest in fixture_hashes.items()), 'Source fixtures were modified'
                print(f'PASS: native reader/drag, startup/second-instance CLI, refresh/deletion/recovery, IPC and navigation security; observed refresh {watch_ms} ms')
        except Exception:
            subprocess.run(['/usr/bin/python3', str(ROOT / 'scripts/capture_display.py'), str(ROOT / 'test-results/native-display.png')], check=False)
            if driver.session:
                print(driver.execute("return {title: document.title, error: document.querySelector('#error-message')?.textContent}"))
            subprocess.run(["xwininfo", "-root", "-tree"], check=False)
            raise
        finally:
            if driver.session:
                try:
                    close_native_window()
                    driver.request('DELETE', f'/session/{driver.session}')
                except (OSError, AssertionError): pass
            process.terminate()
            process.wait(timeout=10)


if __name__ == '__main__':
    main()
