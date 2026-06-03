import io
import os
import tempfile
import unittest
from unittest import mock

try:
    from support import create_fake_wheel
except ModuleNotFoundError:
    from tests.support import create_fake_wheel

from gcubed_build_switcher import venv as switcher_venv


class VenvTests(unittest.TestCase):
    def test_venv_creation_requires_wheel_requires_python_metadata(self):
        with tempfile.TemporaryDirectory() as gcubed_root:
            temp_dir = os.path.join(gcubed_root, "temp-prereqs")
            os.makedirs(temp_dir)

            with mock.patch(
                "gcubed_build_switcher.venv.validate_build_tag",
                return_value=(True, temp_dir),
            ), mock.patch(
                "gcubed_build_switcher.venv.get_gcubed_root",
                return_value=gcubed_root,
            ), mock.patch(
                "gcubed_build_switcher.venv.is_running_in_devcontainer",
                return_value=False,
            ), mock.patch(
                "gcubed_build_switcher.venv.install_packages",
                return_value=True,
            ), mock.patch(
                "gcubed_build_switcher.venv.ensure_runtime_support_packages",
                return_value=True,
            ), mock.patch(
                "sys.stdout",
                new=io.StringIO(),
            ):
                result = switcher_venv.create_venv_for_build("build-tag")

            self.assertFalse(result)

    def test_venv_creation_prefers_wheel_requires_python_over_python_version(self):
        with tempfile.TemporaryDirectory() as gcubed_root:
            temp_dir = os.path.join(gcubed_root, "temp-prereqs")
            os.makedirs(temp_dir)
            create_fake_wheel(
                os.path.join(temp_dir, "gcubed-1.0.0-py3-none-any.whl"),
                requires_python=">=3.13",
            )
            with open(os.path.join(temp_dir, ".python-version"), "w") as f:
                f.write("3.10.12\n")

            commands = []

            def fake_run(cmd, cwd=None, check=False, env=None, **_kwargs):
                commands.append((cmd, cwd, check, env))

            with mock.patch(
                "gcubed_build_switcher.venv.validate_build_tag",
                return_value=(True, temp_dir),
            ), mock.patch(
                "gcubed_build_switcher.venv.get_gcubed_root",
                return_value=gcubed_root,
            ), mock.patch(
                "gcubed_build_switcher.venv.is_running_in_devcontainer",
                return_value=False,
            ), mock.patch(
                "gcubed_build_switcher.venv."
                "resolve_uv_python_request_for_specifier",
                return_value="3.13.11",
            ) as resolve_version, mock.patch(
                "gcubed_build_switcher.venv.update_uv_for_devcontainer_if_required",
                return_value=True,
            ) as update_uv, mock.patch(
                "gcubed_build_switcher.venv.install_packages",
                return_value=True,
            ), mock.patch(
                "gcubed_build_switcher.venv.ensure_runtime_support_packages",
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
            resolve_version.assert_called_once_with(">=3.13")
            update_uv.assert_called_once_with(False)
            venv_commands = [
                (command, env)
                for command, _cwd, _check, env in commands
                if command[:2] == ["uv", "venv"]
            ]
            self.assertEqual(len(venv_commands), 1)
            venv_command, venv_env = venv_commands[0]
            self.assertIn("--managed-python", venv_command)
            self.assertNotIn("--system-site-packages", venv_command)
            self.assertEqual(
                venv_command[venv_command.index("--python") + 1],
                "3.13.11",
            )
            self.assertEqual(venv_env["UV_LINK_MODE"], "copy")

    def test_venv_creation_updates_uv_and_uses_managed_python_in_devcontainer(self):
        with tempfile.TemporaryDirectory() as gcubed_root:
            temp_dir = os.path.join(gcubed_root, "temp-prereqs")
            os.makedirs(temp_dir)
            create_fake_wheel(
                os.path.join(temp_dir, "gcubed-1.0.0-py3-none-any.whl"),
                requires_python=">=3.13",
            )
            with open(os.path.join(temp_dir, ".python-version"), "w") as f:
                f.write("3.10.12\n")

            commands = []

            def fake_run(cmd, cwd=None, check=False, env=None, **_kwargs):
                commands.append((cmd, cwd, check, env))

            with mock.patch(
                "gcubed_build_switcher.venv.validate_build_tag",
                return_value=(True, temp_dir),
            ), mock.patch(
                "gcubed_build_switcher.venv.get_gcubed_root",
                return_value=gcubed_root,
            ), mock.patch(
                "gcubed_build_switcher.venv.is_running_in_devcontainer",
                return_value=True,
            ), mock.patch(
                "gcubed_build_switcher.venv."
                "resolve_uv_python_request_for_specifier",
                return_value="3.13.11",
            ) as resolve_version, mock.patch(
                "gcubed_build_switcher.venv.update_uv_for_devcontainer_if_required",
                return_value=True,
            ) as update_uv, mock.patch(
                "gcubed_build_switcher.venv.install_packages",
                return_value=True,
            ), mock.patch(
                "gcubed_build_switcher.venv.ensure_runtime_support_packages",
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
            resolve_version.assert_called_once_with(">=3.13")
            update_uv.assert_called_once_with(True)
            venv_commands = [
                (command, env)
                for command, _cwd, _check, env in commands
                if command[:2] == ["uv", "venv"]
            ]
            self.assertEqual(len(venv_commands), 1)
            venv_command, venv_env = venv_commands[0]
            self.assertIn("--managed-python", venv_command)
            self.assertNotIn("--system-site-packages", venv_command)
            self.assertEqual(
                venv_command[venv_command.index("--python") + 1],
                "3.13.11",
            )
            self.assertEqual(venv_env["UV_LINK_MODE"], "copy")

    def test_runtime_support_install_installs_switcher_when_missing(self):
        commands = []
        show_calls = []

        def fake_run(cmd, cwd=None, check=False, **_kwargs):
            commands.append((cmd, cwd, check))
            if cmd[:4] == ["uv", "pip", "show", "-p"]:
                show_calls.append(cmd)
                if len(show_calls) == 1:
                    raise switcher_venv.subprocess.CalledProcessError(1, cmd)

        with mock.patch(
            "gcubed_build_switcher.venv.subprocess.run",
            side_effect=fake_run,
        ), mock.patch(
            "gcubed_build_switcher.venv.get_build_switcher_install_target",
            return_value="gcubed-build-switcher-test-spec",
        ), mock.patch(
            "sys.stdout",
            new=io.StringIO(),
        ):
            result = switcher_venv.ensure_runtime_support_packages(
                "/tmp/venv/bin/python",
                "/tmp/gcubed-root",
            )

        self.assertTrue(result)
        install_commands = [
            command
            for command, _cwd, _check in commands
            if command[:4] == ["uv", "pip", "install", "-p"]
        ]
        self.assertEqual(len(install_commands), 1)
        self.assertEqual(install_commands[0][-1], "gcubed-build-switcher-test-spec")

    def test_prepare_existing_venv_repairs_runtime_support_before_activation(self):
        with tempfile.TemporaryDirectory() as gcubed_root:
            venv_path = os.path.join(gcubed_root, "venv_gcubed_build-tag")
            os.makedirs(os.path.join(venv_path, "bin"))

            with mock.patch(
                "gcubed_build_switcher.venv.try_get_venv_directory_for_build",
                return_value=venv_path,
            ), mock.patch(
                "gcubed_build_switcher.venv.verify_venv_has_gcubed",
                return_value=True,
            ), mock.patch(
                "gcubed_build_switcher.venv.get_gcubed_root",
                return_value=gcubed_root,
            ), mock.patch(
                "gcubed_build_switcher.venv.ensure_runtime_support_packages",
                return_value=True,
            ) as ensure_support, mock.patch(
                "gcubed_build_switcher.venv.activate_rich_formatter",
            ) as activate_rich, mock.patch(
                "sys.stdout",
                new=io.StringIO(),
            ):
                result = switcher_venv.prepare_local_venv("build-tag")

            self.assertTrue(result)
            ensure_support.assert_called_once_with(
                os.path.join(venv_path, "bin", "python"),
                gcubed_root,
            )
            activate_rich.assert_called_once_with(venv_path)


if __name__ == "__main__":
    unittest.main()
