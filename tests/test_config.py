import os
import tempfile
import unittest
from unittest import mock

try:
    from support import add_src_to_path
except ModuleNotFoundError:
    from tests.support import add_src_to_path

add_src_to_path()

from gcubed_build_switcher import config


class ConfigurationTests(unittest.TestCase):
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

    def test_devcontainer_detection_uses_explicit_runtime_markers(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertFalse(config.is_running_in_devcontainer())

        for marker in config.DEVCONTAINER_MARKER_ENV_VARS:
            with mock.patch.dict(os.environ, {marker: "true"}, clear=True):
                self.assertTrue(config.is_running_in_devcontainer())
            with mock.patch.dict(os.environ, {marker: "false"}, clear=True):
                self.assertFalse(config.is_running_in_devcontainer())


if __name__ == "__main__":
    unittest.main()
