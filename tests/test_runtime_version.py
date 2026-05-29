import io
import unittest
from unittest import mock

try:
    from support import add_src_to_path
except ModuleNotFoundError:
    from tests.support import add_src_to_path

add_src_to_path()

import gcubed_build_switcher
from gcubed_build_switcher import cli
from gcubed_build_switcher import version


class RuntimeVersionTests(unittest.TestCase):
    def test_activation_reports_switcher_version(self):
        with mock.patch.object(
            gcubed_build_switcher, "__version__", "9.8.7"
        ), mock.patch.object(
            gcubed_build_switcher,
            "is_feature_disabled",
            return_value=True,
        ), mock.patch(
            "sys.stdout",
            new=io.StringIO(),
        ) as stdout:
            result = gcubed_build_switcher.activate_or_build_and_activate_venv(
                "build-tag"
            )

        self.assertFalse(result)
        self.assertIn(
            "G-Cubed build switcher version 9.8.7",
            stdout.getvalue(),
        )

    def test_package_version_reads_distribution_metadata(self):
        class FakeMetadata:
            class PackageNotFoundError(Exception):
                pass

            @staticmethod
            def version(package_name):
                self.assertEqual(package_name, "gcubed-build-switcher")
                return "2.3.4"

        with mock.patch.object(version, "importlib_metadata", FakeMetadata):
            self.assertEqual(version.get_package_version(), "2.3.4")

    def test_cli_reports_version_before_argument_parsing(self):
        with mock.patch.object(
            cli, "__version__", "9.8.7"
        ), mock.patch(
            "sys.stdout",
            new=io.StringIO(),
        ) as stdout, mock.patch(
            "sys.stderr",
            new=io.StringIO(),
        ):
            with self.assertRaises(SystemExit) as exit_context:
                cli.main([])

        self.assertEqual(exit_context.exception.code, 2)
        self.assertIn(
            "G-Cubed build switcher version 9.8.7",
            stdout.getvalue(),
        )

    def test_cli_reports_version_once_for_successful_switch(self):
        with mock.patch.object(
            cli, "__version__", "9.8.7"
        ), mock.patch.object(
            cli,
            "activate_or_build_and_activate_venv",
            return_value=True,
        ) as activate, mock.patch(
            "sys.stdout",
            new=io.StringIO(),
        ) as stdout:
            cli.main(["build-tag"])

        activate.assert_called_once_with("build-tag", report_version=False)
        self.assertEqual(
            stdout.getvalue().count("G-Cubed build switcher version 9.8.7"),
            1,
        )


if __name__ == "__main__":
    unittest.main()
