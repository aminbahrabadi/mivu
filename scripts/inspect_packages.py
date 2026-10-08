#!/usr/bin/env python3
"""Assert package identity and integration files, and record artifact checksums."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
version = json.loads((ROOT / 'package.json').read_text())['version']
bundles = ROOT / 'src-tauri/target/release/bundle'
report = []
packages = sorted(bundles.glob('deb/*.deb'))
assert packages, 'No release Debian package found'
for path in packages:
    def field(name):
        return subprocess.check_output(['dpkg-deb', '--field', str(path), name], text=True).strip()
    assert field('Package') == 'mivu' and field('Version') == version
    depends = field('Depends')
    assert all(name in depends for name in ('libc6', 'libwebkit2gtk-4.1-0', 'libgtk-3-0', 'libxdo3', 'shared-mime-info'))
    contents = subprocess.check_output(['dpkg-deb', '--contents', str(path)], text=True)
    assert all(name in contents for name in ('usr/bin/mivu', '/applications/Mivu.desktop', '/mime/packages/mivu.xml', '/doc/mivu/LICENSE', '/icons/hicolor/32x32/apps/mivu.png'))
    report.append({'file': path.name, 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'architecture': field('Architecture'), 'depends': depends})
for path in sorted(bundles.glob('appimage/*.AppImage')):
    with path.open('rb') as source:
        header = source.read(12)
    assert header[:4] == b'\x7fELF' and header[8:11] == b'AI\x02', 'Invalid type-2 AppImage'
    report.append({'file': path.name, 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
output = ROOT / 'test-results/package-manifest.json'
output.parent.mkdir(exist_ok=True)
output.write_text(json.dumps(report, indent=2) + '\n')
print(output.read_text())
