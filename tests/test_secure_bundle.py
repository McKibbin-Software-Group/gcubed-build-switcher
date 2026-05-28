import importlib.util
import io
import json
import os
import shutil
import tarfile
import tempfile
import unittest

try:
    from support import REPO_ROOT
except ModuleNotFoundError:
    from tests.support import REPO_ROOT


SECURE_BUNDLE_PATH = os.path.join(REPO_ROOT, "scripts", "secure_bundle.py")
spec = importlib.util.spec_from_file_location("secure_bundle", SECURE_BUNDLE_PATH)
secure_bundle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(secure_bundle)


class SecureBundleTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.repo_root = os.path.join(self.temp_dir, "repo")
        os.makedirs(os.path.join(self.repo_root, "vscode-extension"))

        with open(os.path.join(self.repo_root, "pyproject.toml"), "w") as pyproject:
            pyproject.write(
                "\n".join(
                    [
                        "[project]",
                        'name = "gcubed-build-switcher"',
                        'version = "1.2.3"',
                        'requires-python = ">=3.6"',
                        "",
                    ]
                )
            )

        with open(
            os.path.join(self.repo_root, "vscode-extension", "package.json"), "w"
        ) as package_json:
            json.dump(
                {
                    "name": "gcubed-venv-switcher",
                    "version": "4.5.6",
                    "publisher": "mckibbin-software-group",
                },
                package_json,
            )

        self.wheel_path = os.path.join(
            self.temp_dir, "gcubed_build_switcher-1.2.3-py3-none-any.whl"
        )
        self.vsix_path = os.path.join(
            self.temp_dir, secure_bundle.DEFAULT_VSIX_NAME
        )
        with open(self.wheel_path, "wb") as wheel:
            wheel.write(b"fake wheel bytes")
        with open(self.vsix_path, "wb") as vsix:
            vsix.write(b"fake vsix bytes")

    def tearDown(self):
        shutil.rmtree(self.temp_dir)

    def _bundle_path(self, name="bundle.tar.gz"):
        return os.path.join(self.temp_dir, name)

    def _create_bundle(self, name="bundle.tar.gz"):
        bundle_path = self._bundle_path(name)
        secure_bundle.create_bundle_from_artifacts(
            self.repo_root, self.wheel_path, self.vsix_path, bundle_path
        )
        return bundle_path

    def _add_bytes(self, bundle, name, data):
        info = tarfile.TarInfo(name)
        info.size = len(data)
        bundle.addfile(info, io.BytesIO(data))

    def test_create_and_verify_bundle(self):
        bundle_path = self._create_bundle()

        manifest = secure_bundle.verify_bundle(bundle_path)

        self.assertEqual(manifest["schema_version"], 1)
        self.assertEqual(manifest["package"]["version"], "1.2.3")
        self.assertEqual(manifest["extension"]["version"], "4.5.6")
        self.assertEqual(
            sorted(artifact["kind"] for artifact in manifest["artifacts"]),
            ["vsix", "wheel"],
        )

    def test_verify_can_extract_after_validation(self):
        bundle_path = self._create_bundle()
        extract_dir = os.path.join(self.temp_dir, "extract")

        secure_bundle.verify_bundle(bundle_path, extract_to=extract_dir)

        self.assertTrue(
            os.path.exists(os.path.join(extract_dir, secure_bundle.MANIFEST_FILENAME))
        )
        self.assertTrue(
            os.path.exists(
                os.path.join(
                    extract_dir,
                    "gcubed_build_switcher-1.2.3-py3-none-any.whl",
                )
            )
        )
        self.assertTrue(
            os.path.exists(os.path.join(extract_dir, secure_bundle.DEFAULT_VSIX_NAME))
        )

    def test_verify_rejects_tampered_artifact(self):
        bundle_path = self._create_bundle()
        manifest = secure_bundle.verify_bundle(bundle_path)
        manifest_bytes = json.dumps(manifest, sort_keys=True).encode("utf-8")
        bad_bundle = self._bundle_path("tampered.tar.gz")

        with tarfile.open(bad_bundle, "w:gz") as bundle:
            self._add_bytes(bundle, secure_bundle.MANIFEST_FILENAME, manifest_bytes)
            self._add_bytes(
                bundle,
                "gcubed_build_switcher-1.2.3-py3-none-any.whl",
                b"not the original wheel",
            )
            self._add_bytes(
                bundle,
                secure_bundle.DEFAULT_VSIX_NAME,
                b"fake vsix bytes",
            )

        with self.assertRaisesRegex(
            secure_bundle.SecureBundleError, "sha256 mismatch"
        ):
            secure_bundle.verify_bundle(bad_bundle)

    def test_verify_rejects_unsafe_member_path(self):
        bad_bundle = self._bundle_path("unsafe.tar.gz")
        with tarfile.open(bad_bundle, "w:gz") as bundle:
            self._add_bytes(bundle, "../manifest.json", b"{}")

        with self.assertRaisesRegex(
            secure_bundle.SecureBundleError, "unsafe bundle member path"
        ):
            secure_bundle.verify_bundle(bad_bundle)

    def test_verify_rejects_extra_member(self):
        bundle_path = self._create_bundle()
        manifest = secure_bundle.verify_bundle(bundle_path)
        manifest_bytes = json.dumps(manifest, sort_keys=True).encode("utf-8")
        bad_bundle = self._bundle_path("extra.tar.gz")

        with tarfile.open(bad_bundle, "w:gz") as bundle:
            self._add_bytes(bundle, secure_bundle.MANIFEST_FILENAME, manifest_bytes)
            self._add_bytes(
                bundle,
                "gcubed_build_switcher-1.2.3-py3-none-any.whl",
                b"fake wheel bytes",
            )
            self._add_bytes(
                bundle,
                secure_bundle.DEFAULT_VSIX_NAME,
                b"fake vsix bytes",
            )
            self._add_bytes(bundle, "unexpected.txt", b"extra")

        with self.assertRaisesRegex(
            secure_bundle.SecureBundleError, "members do not match manifest"
        ):
            secure_bundle.verify_bundle(bad_bundle)

    def test_obtain_copies_and_verifies_local_bundle(self):
        bundle_path = self._create_bundle()
        copied_path = self._bundle_path("copied.tar.gz")

        result = secure_bundle.obtain_bundle(bundle_path, output_path=copied_path)

        self.assertEqual(result, copied_path)
        self.assertTrue(os.path.exists(copied_path))
        secure_bundle.verify_bundle(copied_path)

    def test_install_bundle_deploys_vsix_and_manifest_when_python_install_skipped(self):
        bundle_path = self._create_bundle()
        artifact_dir = os.path.join(self.temp_dir, "artifacts")

        manifest = secure_bundle.install_bundle(
            bundle_path,
            artifact_dir=artifact_dir,
            sudo_mode="never",
            skip_python_install=True,
        )

        self.assertEqual(manifest["package"]["version"], "1.2.3")
        with open(
            os.path.join(artifact_dir, secure_bundle.DEFAULT_VSIX_NAME), "rb"
        ) as vsix:
            self.assertEqual(vsix.read(), b"fake vsix bytes")
        self.assertTrue(
            os.path.exists(os.path.join(artifact_dir, secure_bundle.MANIFEST_FILENAME))
        )


if __name__ == "__main__":
    unittest.main()
