import hashlib
import io
import json
import os
import stat
import sys
import tarfile
import tempfile
import unittest
from unittest import mock
from urllib.request import pathname2url


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_ROOT = os.path.join(REPO_ROOT, "src")
if SRC_ROOT not in sys.path:
    sys.path.insert(0, SRC_ROOT)

from gcubed_build_switcher import python_provider
from gcubed_build_switcher import config
from gcubed_build_switcher import venv as switcher_venv


def file_url(path):
    return "file://" + pathname2url(os.path.abspath(path))


def create_fake_python(path, version):
    parent = os.path.dirname(path)
    if not os.path.exists(parent):
        os.makedirs(parent)
    with open(path, "w") as f:
        f.write("#!/bin/sh\n")
        f.write("printf '%s\\n' '{}'\n".format(version))
    os.chmod(path, stat.S_IRUSR | stat.S_IWUSR | stat.S_IXUSR)
    return path


class PythonProviderTests(unittest.TestCase):
    def test_python_install_root_defaults_under_user_home(self):
        with tempfile.TemporaryDirectory() as home_dir:
            with mock.patch.dict(os.environ, {"HOME": home_dir}, clear=True):
                install_root = config.get_python_install_root()

            self.assertEqual(
                install_root,
                os.path.join(home_dir, ".gcubed", "python-builds", "pyenv"),
            )

    def test_python_install_root_env_override_wins(self):
        with mock.patch.dict(
            os.environ,
            {
                "GCUBED_ROOT": "/tmp/gcubed-root",
                "GCUBED_PYTHON_INSTALL_ROOT": "/opt/gcubed/python-builds/pyenv",
            },
            clear=True,
        ):
            install_root = config.get_python_install_root()

        self.assertEqual(install_root, "/opt/gcubed/python-builds/pyenv")

    def test_python_install_root_expands_user_override(self):
        with tempfile.TemporaryDirectory() as home_dir:
            with mock.patch.dict(
                os.environ,
                {
                    "HOME": home_dir,
                    "GCUBED_PYTHON_INSTALL_ROOT": "~/custom-python-cache",
                },
                clear=True,
            ):
                install_root = config.get_python_install_root()

        self.assertEqual(install_root, os.path.join(home_dir, "custom-python-cache"))

    def test_validate_python_executable_requires_exact_patch_version(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            python_path = create_fake_python(
                os.path.join(temp_dir, "python"),
                "3.13.11",
            )

            ok, _path, reported, _message = python_provider.validate_python_executable(
                python_path,
                expected_version="3.13.11",
            )
            self.assertTrue(ok)
            self.assertEqual(reported, "3.13.11")

            ok, _path, reported, message = python_provider.validate_python_executable(
                python_path,
                expected_version="3.13.10",
            )
            self.assertFalse(ok)
            self.assertEqual(reported, "3.13.11")
            self.assertIn("expected 3.13.10", message)

    def test_cache_provider_returns_existing_valid_interpreter(self):
        with tempfile.TemporaryDirectory() as install_root:
            version = "3.13.11"
            python_path = create_fake_python(
                os.path.join(install_root, "versions", version, "bin", "python"),
                version,
            )

            result = python_provider.cache_provider(version, install_root)

            self.assertTrue(result.ok)
            self.assertEqual(result.path, os.path.abspath(python_path))

    def test_system_provider_validates_output_not_executable_name(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            fake_python = create_fake_python(
                os.path.join(temp_dir, "python3.13"),
                "3.13.11",
            )

            def fake_which(name):
                if name == "python3.13":
                    return fake_python
                return None

            with mock.patch(
                "gcubed_build_switcher.python_provider.shutil.which",
                side_effect=fake_which,
            ):
                result = python_provider.system_provider("3.13.11")

            self.assertTrue(result.ok)
            self.assertEqual(result.path, os.path.abspath(fake_python))

    def test_manifest_matching_uses_platform_and_exact_version(self):
        manifest = {
            "archives": [
                {
                    "implementation": "cpython",
                    "version": "3.13.10",
                    "platform": "linux-x86_64-glibc",
                },
                {
                    "implementation": "cpython",
                    "version": "3.13.11",
                    "platform": "macos-arm64",
                },
                {
                    "implementation": "cpython",
                    "version": "3.13.11",
                    "platform": "linux-x86_64-glibc",
                    "url": "https://example.invalid/python.tar.gz",
                },
            ]
        }

        archive = python_provider.find_manifest_archive(
            manifest,
            "3.13.11",
            "linux-x86_64-glibc",
        )

        self.assertEqual(archive["url"], "https://example.invalid/python.tar.gz")

    def test_prebuilt_provider_rejects_checksum_mismatch(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            version = "3.13.11"
            archive_path = os.path.join(temp_dir, "python.tar.gz")
            with open(archive_path, "wb") as f:
                f.write(b"not really a tarball")

            manifest_path = os.path.join(temp_dir, "manifest.json")
            manifest = {
                "archives": [
                    {
                        "implementation": "cpython",
                        "version": version,
                        "platform": python_provider.get_platform_identifier(),
                        "archive_format": "tar.gz",
                        "url": file_url(archive_path),
                        "sha256": hashlib.sha256(b"different").hexdigest(),
                        "python": "versions/{}/bin/python".format(version),
                    }
                ]
            }
            with open(manifest_path, "w") as f:
                json.dump(manifest, f)

            state = {
                "platform": python_provider.get_platform_identifier(),
                "manifest_reachable": False,
                "matching_archive_found": False,
            }
            with mock.patch(
                "gcubed_build_switcher.python_provider.get_python_prebuilt_manifest_url",
                return_value=file_url(manifest_path),
            ):
                result = python_provider.prebuilt_provider(
                    version,
                    os.path.join(temp_dir, "install"),
                    state,
                )

            self.assertFalse(result.ok)
            self.assertIn("Checksum mismatch", result.message)
            self.assertTrue(state["manifest_reachable"])
            self.assertTrue(state["matching_archive_found"])

    def test_prebuilt_provider_installs_matching_archive(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            version = "3.13.11"
            archive_root = os.path.join(temp_dir, "archive-root")
            create_fake_python(
                os.path.join(archive_root, "versions", version, "bin", "python"),
                version,
            )

            archive_path = os.path.join(temp_dir, "python.tar.gz")
            with tarfile.open(archive_path, "w:gz") as tar:
                tar.add(
                    os.path.join(archive_root, "versions"),
                    arcname="versions",
                )

            with open(archive_path, "rb") as f:
                archive_sha256 = hashlib.sha256(f.read()).hexdigest()

            manifest_path = os.path.join(temp_dir, "manifest.json")
            manifest = {
                "archives": [
                    {
                        "implementation": "cpython",
                        "version": version,
                        "platform": python_provider.get_platform_identifier(),
                        "archive_format": "tar.gz",
                        "url": file_url(archive_path),
                        "sha256": archive_sha256,
                        "python": "versions/{}/bin/python".format(version),
                    }
                ]
            }
            with open(manifest_path, "w") as f:
                json.dump(manifest, f)

            install_root = os.path.join(temp_dir, "install")
            state = {
                "platform": python_provider.get_platform_identifier(),
                "manifest_reachable": False,
                "matching_archive_found": False,
            }
            with mock.patch(
                "gcubed_build_switcher.python_provider.get_python_prebuilt_manifest_url",
                return_value=file_url(manifest_path),
            ):
                result = python_provider.prebuilt_provider(
                    version,
                    install_root,
                    state,
                )

            expected_python = os.path.join(
                install_root,
                "versions",
                version,
                "bin",
                "python",
            )
            self.assertTrue(result.ok)
            self.assertEqual(result.path, os.path.abspath(expected_python))
            self.assertTrue(os.path.exists(expected_python))

    def test_safe_extract_tar_rejects_path_traversal(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            archive_path = os.path.join(temp_dir, "bad.tar.gz")
            with tarfile.open(archive_path, "w:gz") as tar:
                info = tarfile.TarInfo("../evil")
                payload = b"bad"
                info.size = len(payload)
                tar.addfile(info, io.BytesIO(payload))

            with self.assertRaises(ValueError):
                python_provider.safe_extract_tar(
                    archive_path,
                    os.path.join(temp_dir, "extract"),
                )

    def test_all_provider_failure_message_is_support_oriented(self):
        message = python_provider.build_support_message(
            "3.10.13",
            {
                "platform": "linux-x86_64-glibc",
                "cache_path": "/opt/gcubed/python-builds/pyenv/versions/3.10.13/bin/python",
                "manifest_reachable": True,
                "matching_archive_found": False,
            },
            ["cache: missing", "prebuilt: no archive"],
        )

        self.assertIn("Unable to obtain required Python 3.10.13", message)
        self.assertIn("linux-x86_64-glibc", message)
        self.assertIn("Cache path checked:", message)
        self.assertIn("Prebuilt manifest reachable: yes", message)
        self.assertIn("Matching prebuilt archive found: no", message)
        self.assertIn("Please contact G-Cubed support", message)

    def test_venv_creation_passes_absolute_python_path_to_uv(self):
        with tempfile.TemporaryDirectory() as gcubed_root:
            temp_dir = os.path.join(gcubed_root, "temp-prereqs")
            os.makedirs(temp_dir)
            with open(os.path.join(temp_dir, ".python-version"), "w") as f:
                f.write("3.13.11\n")

            commands = []

            def fake_run(cmd, cwd=None, check=False, **_kwargs):
                commands.append((cmd, cwd, check))

            with mock.patch(
                "gcubed_build_switcher.venv.validate_build_tag",
                return_value=(True, temp_dir),
            ), mock.patch(
                "gcubed_build_switcher.venv.get_gcubed_root",
                return_value=gcubed_root,
            ), mock.patch(
                "gcubed_build_switcher.venv.ensure_python_available",
                return_value="/tmp/gcubed-python",
            ), mock.patch(
                "gcubed_build_switcher.venv.install_packages",
                return_value=True,
            ), mock.patch(
                "gcubed_build_switcher.venv.subprocess.run",
                side_effect=fake_run,
            ), mock.patch(
                "sys.stdout",
                new=io.StringIO(),
            ):
                result = switcher_venv.create_venv_for_build("build-tag")

            self.assertTrue(result)
            venv_commands = [
                command
                for command, _cwd, _check in commands
                if command[:2] == ["uv", "venv"]
            ]
            self.assertEqual(len(venv_commands), 1)
            self.assertIn("--python", venv_commands[0])
            self.assertEqual(
                venv_commands[0][venv_commands[0].index("--python") + 1],
                "/tmp/gcubed-python",
            )
            self.assertFalse(
                any(
                    command[:3] == ["uv", "python", "install"]
                    for command, _cwd, _check in commands
                )
            )


if __name__ == "__main__":
    unittest.main()
