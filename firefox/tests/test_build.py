"""Packaging regressions using only Python's standard library."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("build_amo", ROOT / "tools/build_amo.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class PackagingTests(unittest.TestCase):
    def setUp(self):
        self.files = build.read_tree(ROOT / "app")

    def altered(self, edit):
        manifest = json.loads(self.files["manifest.json"])
        edit(manifest)
        self.files["manifest.json"] = json.dumps(manifest).encode()
        return self.files

    def test_submitted_runtime_matches_every_recorded_file(self):
        self.assertEqual(build.validate(self.files), "0.1.0")
        self.assertEqual(build.inventory(self.files), json.loads(build.EVIDENCE.read_text())["files"])

    def test_permission_and_host_access_regressions_fail(self):
        for key in ("permissions", "host_permissions", "optional_permissions", "optional_host_permissions"):
            with self.subTest(key=key):
                self.setUp()
                files = self.altered(lambda m: m.update({key: ["<all_urls>"]}))
                with self.assertRaisesRegex(ValueError, key):
                    build.validate(files)

    def test_collection_and_content_scripts_regressions_fail(self):
        with self.assertRaisesRegex(ValueError, "collection"):
            build.validate(self.altered(lambda m: m["browser_specific_settings"]["gecko"].update(
                {"data_collection_permissions": {"required": ["none"], "optional": ["technicalAndInteraction"]}})))
        self.setUp()
        with self.assertRaisesRegex(ValueError, "content_scripts"):
            build.validate(self.altered(lambda m: m.update({"content_scripts": [{"matches": ["<all_urls>"]}]})))

    def test_runtime_changes_need_a_new_version(self):
        self.files["reader.js"] += b"\n// changed\n"
        with self.assertRaisesRegex(ValueError, "bump"):
            build.validate(self.files)
        self.altered(lambda m: m.update({"version": "0.1.1"}))
        self.assertEqual(build.validate(self.files), "0.1.1")

    def test_missing_assets_unsafe_sinks_csp_and_unexpected_files_fail(self):
        del self.files["vendor/LICENSE-marked.txt"]
        with self.assertRaisesRegex(ValueError, "Missing"):
            build.validate(self.files)
        self.setUp()
        self.files["reader.js"] += b"\nelement.innerHTML = userInput;"
        with self.assertRaisesRegex(ValueError, "Unsafe HTML"):
            build.validate(self.files)
        self.setUp()
        with self.assertRaisesRegex(ValueError, "CSP"):
            build.validate(self.altered(lambda m: m.update({"content_security_policy": {"extension_pages": "default-src *"}})))
        self.setUp()
        self.files["credentials.env"] = b"not included"
        with self.assertRaisesRegex(ValueError, "Unexpected runtime"):
            build.validate(self.files)
        del self.files["credentials.env"]
        self.files["../secret.txt"] = b"not included"
        with self.assertRaisesRegex(ValueError, "Unsafe path"):
            build.validate(self.files)

    def test_symlinks_fail_before_packaging(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)
            (path / "escape").symlink_to(ROOT / "README.md")
            with self.assertRaisesRegex(ValueError, "Symlink"):
                build.read_tree(path)
            link = path / "directory"
            link.symlink_to(ROOT / "app", target_is_directory=True)
            with self.assertRaisesRegex(ValueError, "real source directory"):
                build.read_tree(link)

    def test_zip_metadata_and_order_are_deterministic(self):
        with tempfile.TemporaryDirectory() as folder:
            first, second = Path(folder) / "a.zip", Path(folder) / "b.zip"
            build.write_zip(first, self.files)
            build.write_zip(second, dict(reversed(list(self.files.items()))))
            self.assertEqual(first.read_bytes(), second.read_bytes())
            with ZipFile(first) as archive:
                self.assertEqual(archive.namelist(), sorted(self.files))
                self.assertTrue(all(entry.date_time == (1980, 1, 1, 0, 0, 0) for entry in archive.infolist()))
                self.assertIn("manifest.json", archive.namelist())
                self.assertIsNone(archive.testzip())


if __name__ == "__main__":
    unittest.main()
