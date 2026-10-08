#!/usr/bin/env python3
"""Build packages with an honest host glibc dependency; build older for older OSes."""
import json
import platform
import subprocess
import sys

kind = sys.argv[1] if len(sys.argv) == 2 else 'deb,appimage'
assert kind in ('deb', 'appimage', 'deb,appimage')
name, version = platform.libc_ver()
assert sys.platform == 'linux' and name == 'glibc' and version, 'Linux glibc build host required'
config = {'bundle': {'linux': {'deb': {'depends': [f'libc6 (>= {version})', 'libxdo3', 'shared-mime-info']}}}}
subprocess.run(['pnpm', 'tauri', 'build', '--ci', '--bundles', kind, '--config', json.dumps(config), '--', '--locked'], check=True)
