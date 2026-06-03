import os
import unittest
from unittest import mock

try:
    from support import add_src_to_path
except ModuleNotFoundError:
    from tests.support import add_src_to_path

add_src_to_path()

from gcubed_build_switcher import config


class ConfigurationTests(unittest.TestCase):
    def test_required_uv_version_defaults_to_repo_policy(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            required_uv_version = config.get_required_uv_version()

        self.assertEqual(required_uv_version, "0.11.18")

    def test_required_uv_version_env_override_wins(self):
        with mock.patch.dict(
            os.environ,
            {
                "GCUBED_ROOT": "/tmp/gcubed-root",
                "GCUBED_REQUIRED_UV_VERSION": "0.11.19",
            },
            clear=True,
        ):
            required_uv_version = config.get_required_uv_version()

        self.assertEqual(required_uv_version, "0.11.19")

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
