import importlib.util
import json
import os
import shutil
import tempfile
import unittest
from unittest import mock

try:
    from support import REPO_ROOT
except ModuleNotFoundError:
    from tests.support import REPO_ROOT


VERSION_SYNC_PATH = os.path.join(REPO_ROOT, "scripts", "version_sync.py")
spec = importlib.util.spec_from_file_location("version_sync", VERSION_SYNC_PATH)
version_sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(version_sync)


class VersionSyncTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.repo_root = os.path.join(self.temp_dir, "repo")
        os.makedirs(os.path.join(self.repo_root, "release-files"))
        os.makedirs(os.path.join(self.repo_root, "src", "gcubed_build_switcher"))
        os.makedirs(os.path.join(self.repo_root, "vscode-extension"))

        self._write("VERSION", "1.2.2\n")
        self._write(
            "pyproject.toml",
            "\n".join(
                [
                    "[project]",
                    'name = "gcubed-build-switcher"',
                    'version = "0.0.1"',
                    "",
                ]
            ),
        )
        self._write(
            os.path.join("release-files", "pyproject.toml"),
            "\n".join(
                [
                    "[project]",
                    'name = "G-Cubed_Build_Switcher"',
                    'version = "0.0.2"',
                    "",
                ]
            ),
        )
        self._write(
            os.path.join("src", "gcubed_build_switcher", "version.py"),
            'FALLBACK_VERSION = "0.0.3"\n',
        )
        self._write_json(
            os.path.join("vscode-extension", "package.json"),
            {
                "name": "gcubed-venv-switcher",
                "version": "0.0.4",
            },
        )
        self._write_json(
            os.path.join("vscode-extension", "package-lock.json"),
            {
                "name": "gcubed-venv-switcher",
                "version": "0.0.5",
                "lockfileVersion": 3,
                "packages": {
                    "": {
                        "name": "gcubed-venv-switcher",
                        "version": "0.0.5",
                    }
                },
            },
        )

    def tearDown(self):
        shutil.rmtree(self.temp_dir)

    def _path(self, relative_path):
        return os.path.join(self.repo_root, relative_path)

    def _write(self, relative_path, content):
        with open(self._path(relative_path), "w") as target:
            target.write(content)

    def _read(self, relative_path):
        with open(self._path(relative_path), "r") as source:
            return source.read()

    def _write_json(self, relative_path, content):
        with open(self._path(relative_path), "w") as target:
            json.dump(content, target, indent=2)
            target.write("\n")

    def _read_json(self, relative_path):
        with open(self._path(relative_path), "r") as source:
            return json.load(source)

    def test_sync_version_updates_all_version_metadata(self):
        changed = version_sync.sync_version(self.repo_root, "1.2.2")

        self.assertEqual(
            changed,
            [
                "pyproject.toml",
                os.path.join("release-files", "pyproject.toml"),
                os.path.join("src", "gcubed_build_switcher", "version.py"),
                os.path.join("vscode-extension", "package.json"),
                os.path.join("vscode-extension", "package-lock.json"),
            ],
        )
        self.assertIn('version = "1.2.2"', self._read("pyproject.toml"))
        self.assertIn(
            'version = "1.2.2"',
            self._read(os.path.join("release-files", "pyproject.toml")),
        )
        self.assertIn(
            'FALLBACK_VERSION = "1.2.2"',
            self._read(os.path.join("src", "gcubed_build_switcher", "version.py")),
        )
        self.assertEqual(
            self._read_json(os.path.join("vscode-extension", "package.json"))[
                "version"
            ],
            "1.2.2",
        )
        package_lock = self._read_json(
            os.path.join("vscode-extension", "package-lock.json")
        )
        self.assertEqual(package_lock["version"], "1.2.2")
        self.assertEqual(package_lock["packages"][""]["version"], "1.2.2")

    def test_check_mode_reports_drift_without_writing(self):
        with self.assertRaisesRegex(
            version_sync.VersionSyncError,
            "version metadata is out of sync",
        ):
            version_sync.check_version_files(self.repo_root)

        self.assertIn('version = "0.0.1"', self._read("pyproject.toml"))

    def test_bump_version_uses_semantic_release_parts(self):
        self.assertEqual(version_sync.bump_version("1.2.3", "patch"), "1.2.4")
        self.assertEqual(version_sync.bump_version("1.2.3", "minor"), "1.3.0")
        self.assertEqual(version_sync.bump_version("1.2.3", "major"), "2.0.0")

    def test_build_environment_version_accepts_v_prefixed_tags(self):
        with mock.patch.dict(
            os.environ,
            {
                "GCUBED_BUILD_SWITCHER_VERSION": "",
                "GITHUB_REF_NAME": "v1.2.3",
                "GITHUB_REF": "",
            },
        ):
            self.assertEqual(
                version_sync.version_from_build_environment(self.repo_root),
                "1.2.3",
            )

    def test_optional_build_environment_version_ignores_branch_refs(self):
        with mock.patch.dict(
            os.environ,
            {
                "GCUBED_BUILD_SWITCHER_VERSION": "",
                "GITHUB_REF_NAME": "main",
                "GITHUB_REF": "refs/heads/main",
            },
        ):
            self.assertIsNone(
                version_sync.version_from_optional_build_environment(self.repo_root)
            )


if __name__ == "__main__":
    unittest.main()
