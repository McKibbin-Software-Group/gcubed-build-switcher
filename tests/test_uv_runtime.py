import io
import unittest
from unittest import mock

from gcubed_build_switcher import uv_runtime


class UvRuntimeTests(unittest.TestCase):
    def test_non_devcontainer_does_not_update_uv(self):
        with mock.patch(
            "gcubed_build_switcher.uv_runtime.subprocess.run",
        ) as run:
            result = uv_runtime.update_uv_for_devcontainer_if_required(False)

        self.assertTrue(result)
        run.assert_not_called()

    def test_devcontainer_updates_uv_to_required_version(self):
        with mock.patch(
            "gcubed_build_switcher.uv_runtime.get_required_uv_version",
            return_value="0.11.18",
        ), mock.patch(
            "gcubed_build_switcher.uv_runtime.subprocess.run",
        ) as run, mock.patch(
            "sys.stdout",
            new=io.StringIO(),
        ):
            result = uv_runtime.update_uv_for_devcontainer_if_required(True)

        self.assertTrue(result)
        run.assert_called_once_with(
            ["uv", "self", "update", "0.11.18"],
            check=True,
        )


if __name__ == "__main__":
    unittest.main()
