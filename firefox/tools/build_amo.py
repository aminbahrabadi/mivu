"""Offline, deterministic Firefox packaging; never publishes to AMO."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import argparse
import hashlib
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "releases/v0.1.0-submitted.json"
CSP = ("default-src 'none'; script-src 'self'; style-src 'self'; "
       "img-src 'self' blob: data:; font-src 'self'; connect-src 'none'; "
       "object-src 'none'; base-uri 'none'; form-action 'none'")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def inventory(files):
    return {name: {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
            for name, data in sorted(files.items())}


def read_tree(root):
    require(root.is_dir() and not root.is_symlink(), f"Expected a real source directory: {root}")
    files = {}
    for path in sorted(root.rglob("*")):
        require(not path.is_symlink(), f"Symlink not allowed: {path}")
        if path.is_file():
            name = path.relative_to(root).as_posix()
            require(path.stat().st_size <= 16 * 1024 * 1024, f"Unexpectedly large asset: {name}")
            files[name] = path.read_bytes()
    return files


def validate(files):
    require("manifest.json" in files, "manifest.json must be at the package root")
    manifest = json.loads(files["manifest.json"])
    require(manifest.get("manifest_version") == 3, "Firefox Manifest V3 required")
    version = manifest.get("version", "")
    require(isinstance(version, str) and re.fullmatch(r"\d{1,5}(?:\.\d{1,5}){2}", version)
            and all(int(part) <= 65535 for part in version.split(".")), "Invalid release version")
    for key in ("permissions", "host_permissions"):
        require(manifest.get(key) == [], f"{key} must remain []")
    for key in ("optional_permissions", "optional_host_permissions", "content_scripts",
                "web_accessible_resources", "externally_connectable"):
        require(not manifest.get(key), f"Unsupported access declaration: {key}")
    gecko = manifest.get("browser_specific_settings", {}).get("gecko", {})
    require(gecko.get("id") == "mivu@aminbahrabadi.github.io", "Unexpected Firefox add-on identity")
    require(gecko.get("data_collection_permissions") == {"required": ["none"]},
            "Declare no data collection, with no optional collection")
    require(gecko.get("strict_min_version") == "128.0", "Review compatibility before changing its baseline")
    require(manifest.get("background") == {"scripts": ["background.js"]}, "Unexpected background configuration")
    require(manifest.get("content_security_policy", {}).get("extension_pages") == CSP,
            "CSP changed: review security policy explicitly")
    required = {"reader.html", "reader.js", "safety.mjs", "styles.css", "background.js",
                "icons/mivu.svg", "vendor/marked.js", "vendor/highlight.min.js",
                "vendor/LICENSE-marked.txt", "vendor/LICENSE-highlight.txt"}
    require(required <= files.keys(), "Missing reader assets or third-party notices")
    for name, data in files.items():
        require(not name.startswith("/") and "\\" not in name
                and all(part not in ("", ".", "..") for part in name.split("/")), f"Unsafe path: {name}")
        require(Path(name).suffix in (".json", ".html", ".js", ".mjs", ".css", ".svg", ".txt"),
                f"Unexpected runtime file: {name}")
        if name.endswith((".js", ".mjs")):
            require(not re.search(r"\.(?:innerHTML|outerHTML)\s*=", data.decode("utf-8")),
                    f"Unsafe HTML assignment in {name}")
    # Static checks supplement, not replace, DOM/security regression tests.
    if version == "0.1.0":
        baseline = json.loads(EVIDENCE.read_text())
        require(inventory(files) == baseline["files"],
                "Submitted v0.1.0 runtime changed: restore it or intentionally bump the Firefox version")
    return version


def write_zip(output, files):
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(files.items()):
            info = ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data, compress_type=ZIP_DEFLATED, compresslevel=9)
    with ZipFile(output) as archive:
        require(archive.testzip() is None, "ZIP integrity check failed")
        require(archive.namelist() == sorted(files), "ZIP inventory/order changed")
        require({name: archive.read(name) for name in archive.namelist()} == files,
                "Packaged file content changed")
    print(f"Package valid: {output.name} ({output.stat().st_size} bytes; "
          f"SHA-256 {hashlib.sha256(output.read_bytes()).hexdigest()})")


def compare_submitted(path, files):
    evidence = json.loads(EVIDENCE.read_text())
    require(hashlib.sha256(path.read_bytes()).hexdigest() == evidence["submitted_archive"]["sha256"],
            "Input is not the recorded submitted AMO archive")
    with ZipFile(path) as archive:
        require(len(archive.namelist()) == len(set(archive.namelist())), "Duplicate ZIP entries")
        require(archive.testzip() is None, "Submitted ZIP is corrupt")
        require(inventory({name: archive.read(name) for name in archive.namelist()}) == inventory(files),
                "Runtime differs from the submitted package")
    print("Submitted archive verified: all paths and decompressed bytes match")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-submitted", type=Path, help="Compare the original immutable AMO archive")
    args = parser.parse_args()
    files = read_tree(ROOT / "app")
    version = validate(files)
    if args.verify_submitted:
        compare_submitted(args.verify_submitted, files)
    suffix = "-security-fixed" if version == "0.1.0" else ""
    write_zip(ROOT / "dist" / f"mivu-firefox-AMO-upload-v{version}{suffix}.zip", files)
    source = {}
    for folder in ("app", "tools", "tests", "docs", "releases", "third-party"):
        for name, data in read_tree(ROOT / folder).items():
            if "__pycache__" not in Path(name).parts and not name.endswith(".pyc"):
                source[f"firefox/{folder}/{name}"] = data
    source["firefox/README.md"] = (ROOT / "README.md").read_bytes()
    source["LICENSE"] = (ROOT.parent / "LICENSE").read_bytes()
    write_zip(ROOT / "dist" / f"mivu-firefox-source-v{version}.zip", source)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError) as error:
        sys.exit(f"Build failed: {error}")
