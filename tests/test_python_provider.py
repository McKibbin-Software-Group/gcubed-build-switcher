import hashlib
import io
import json
import os
import tarfile
import tempfile
import unittest
from unittest import mock

try:
    from support import create_fake_python, file_url
except ModuleNotFoundError:
    from tests.support import create_fake_python, file_url

from gcubed_build_switcher import python_provider


class PythonProviderTests(unittest.TestCase):
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

    def test_validate_python_executable_scrubs_python_environment(self):
        with mock.patch.dict(
            os.environ,
            {
                "PYTHONHOME": "/bad/pythonhome",
                "PYTHONPATH": "/bad/pythonpath",
                "LD_LIBRARY_PATH": "/bad/ld",
                "DYLD_LIBRARY_PATH": "/bad/dyld",
                "PATH": os.environ.get("PATH", ""),
            },
            clear=True,
        ):
            validation_env = python_provider.get_python_validation_env()

        self.assertNotIn("PYTHONHOME", validation_env)
        self.assertNotIn("PYTHONPATH", validation_env)
        self.assertNotIn("LD_LIBRARY_PATH", validation_env)
        self.assertNotIn("DYLD_LIBRARY_PATH", validation_env)
        self.assertIn("PATH", validation_env)

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

    def test_resolve_prebuilt_python_version_uses_lowest_satisfying_candidate(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            manifest_path = os.path.join(temp_dir, "manifest.json")
            platform_id = python_provider.get_platform_identifier()
            manifest = {
                "archives": [
                    {
                        "implementation": "cpython",
                        "version": "3.12.10",
                        "platform": platform_id,
                    },
                    {
                        "implementation": "cpython",
                        "version": "3.13.12",
                        "platform": platform_id,
                    },
                    {
                        "implementation": "cpython",
                        "version": "3.13.11",
                        "platform": platform_id,
                    },
                    {
                        "implementation": "cpython",
                        "version": "3.13.10",
                        "platform": "macos-arm64",
                    },
                ]
            }
            with open(manifest_path, "w") as f:
                json.dump(manifest, f)

            manifest_url_getter = (
                "gcubed_build_switcher.python_provider."
                "get_python_prebuilt_manifest_url"
            )
            with mock.patch(manifest_url_getter, return_value=file_url(manifest_path)):
                version = (
                    python_provider.resolve_prebuilt_python_version_for_specifier(
                        ">=3.13,<3.14"
                    )
                )

            self.assertEqual(version, "3.13.11")

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
            manifest_url_getter = (
                "gcubed_build_switcher.python_provider."
                "get_python_prebuilt_manifest_url"
            )
            with mock.patch(
                manifest_url_getter,
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
            manifest_url_getter = (
                "gcubed_build_switcher.python_provider."
                "get_python_prebuilt_manifest_url"
            )
            with mock.patch(
                manifest_url_getter,
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

    def test_prebuilt_provider_reports_archive_version_mismatch(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            requested_version = "3.13.11"
            actual_version = "3.13.13"
            archive_root = os.path.join(temp_dir, "archive-root")
            create_fake_python(
                os.path.join(
                    archive_root,
                    "versions",
                    requested_version,
                    "bin",
                    "python",
                ),
                actual_version,
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
                        "version": requested_version,
                        "platform": python_provider.get_platform_identifier(),
                        "archive_format": "tar.gz",
                        "asset_name": "cpython-3.13.11-linux-x86_64-glibc.tar.gz",
                        "url": file_url(archive_path),
                        "sha256": archive_sha256,
                        "python": "versions/{}/bin/python".format(
                            requested_version
                        ),
                    }
                ]
            }
            with open(manifest_path, "w") as f:
                json.dump(manifest, f)

            manifest_url_getter = (
                "gcubed_build_switcher.python_provider."
                "get_python_prebuilt_manifest_url"
            )
            with mock.patch(
                manifest_url_getter,
                return_value=file_url(manifest_path),
            ):
                result = python_provider.prebuilt_provider(
                    requested_version,
                    os.path.join(temp_dir, "install"),
                )

            self.assertFalse(result.ok)
            self.assertIn("metadata mismatch", result.message)
            self.assertIn(requested_version, result.message)
            self.assertIn(actual_version, result.message)
            self.assertIn("cpython-3.13.11-linux-x86_64-glibc.tar.gz", result.message)

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
                "cache_path": (
                    "/opt/gcubed/python-builds/pyenv/versions/"
                    "3.10.13/bin/python"
                ),
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


if __name__ == "__main__":
    unittest.main()
