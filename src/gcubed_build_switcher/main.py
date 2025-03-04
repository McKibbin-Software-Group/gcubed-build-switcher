__all__ = ["activate_or_build_and_activate_venv"]

import os
import sys
import subprocess
import shutil
import glob
import requests

"""
Different G-Cubed economic models have different dependencies on G-Cubed Code library builds.
Python scripts, which run simulations and create projections based on these models,
are aware of the G-Cubed Code library version required by the model.

This module provides a way to manage the dependencies of G-Cubed model simulations
by creating virtual environments specific to each G-Cubed Code library build.

A set of one or more virtual environments (venvs) is created in the root of the project.
Using this module the simulation scripts switch to the appropriate venv on startup.

If a required build is not available in a venv, then this module will pull the appropriate
tag from the MSG python prerequisites repo, create a corresponding venv, install the
requirements into that repo, and then activate that environment.
"""


def get_venv_name(gcubed_code_build_tag):
    venv_name_root = "venv_gcubed_"
    return f"{venv_name_root}{gcubed_code_build_tag}"


def get_venv_directory_for_build(venv_name):
    """
    OS has an environment variable called GCUBED_ROOT that points to the root of the project
    """

    gcubed_root = os.environ.get("GCUBED_ROOT")
    if not gcubed_root:
        print("GCUBED_ROOT environment variable not set")
        return False

    # build the path to the virtual environment: GCUBED_ROOT/venv_gcubed_<tag>
    return os.path.join(gcubed_root, venv_name)


def activate_venv(venv_path):
    """
    Checks for the existence of the venv.
    Returns false if not exist, or if it exists but doesn't contain the 'gcubed' package
    which means the calling package will retry
    If exists then activates the venv by executing 'activate_this.py' in
    that venv
    Actual errors here need to be raised as exceptions or otherwise sys.exit(1)
    """
    if venv_path is False:
        return False

    activate_venv_path = os.path.join(venv_path, "bin", "activate_this.py")
    python_path = os.path.join(venv_path, "bin", "python")

    # Check if venv and activate script exist
    if not os.path.exists(activate_venv_path):
        print(f"Virtual environment not found at: {venv_path}")
        return False

    # Check if the gcubed package is installed
    package_name = os.environ.get("GCUBED_CODE_PACKAGE_NAME")
    if not package_name:
        print(
            "GCUBED_CODE_PACKAGE_NAME environment variable not set. Please contact G-Cubed support."
        )
        sys.exit(1)

    try:
        subprocess.run(
            ["uv", "pip", "show", "-p", python_path, package_name],
            check=True,  # This will raise an exception if return code is non-zero
            capture_output=True,
            text=True,
        )
        # If we get here, the package exists (command succeeded)
    except subprocess.CalledProcessError as e:
        print(
            f"Error looking for prerequisite package '{package_name}' in virtual environment: {e}."
        )
        return False

    # Everything is in place so execute the activate_this.py script
    try:
        with open(activate_venv_path) as file:
            exec(file.read(), dict(__file__=activate_venv_path))
    except Exception as e:
        return False

    print(f"Activated virtual environment -")
    print(f"  Python interpreter: {sys.executable}")
    print(f"  Python version: {sys.version.split()[0]}")
    print(f"  Virtual env path: {sys.prefix}")
    print(f"  VIRTUAL_ENV set: {'VIRTUAL_ENV' in os.environ}")

    return True


def install_packages(files, python_path, temp_dir_name, gcubed_root, config_param=None):
    """
    Helper function to install packages from wheel files or requirements files

    Parameters:
    - files: List of file paths to install
    - python_path: Path to the Python interpreter in the venv
    - temp_dir_name: Name of the temporary directory
    - gcubed_root: Root directory of the G-Cubed project
    - config_param: Optional config parameter (e.g., '-r' for requirements files)
    """
    if not files:
        return

    file_type = "requirements" if config_param else "wheel"
    print(f"Installing {file_type} files...")

    for file_path in files:
        file_name = os.path.basename(file_path)

        cmd = ["uv", "pip", "install"]

        if config_param is not None:
            cmd.append(config_param)

        cmd.extend(
            [
                "-p",
                python_path,
                os.path.join(f"./{temp_dir_name}", file_name),
            ]
        )

        subprocess.run(cmd, cwd=gcubed_root, check=True)


def check_for_disabled_flag():
    overridden = os.environ.get("GCUBED_CODE_AUTO_BUILD_SWITCHER_DISABLED")
    if overridden:
        warning_message = "WARNING: Automatic G-Cubed Code build switching disabled. Skipping virtual environment activation."
        warning_message_left_border = "!!!   "
        warning_message_right_border = "   !!!"
        border = "!" * (
            warning_message_left_border.__len__()
            + warning_message.__len__()
            + warning_message_right_border.__len__()
        )
        warning_message_blank_line = (
            warning_message_left_border
            + " " * warning_message.__len__()
            + warning_message_right_border
        )
        # Check if terminal supports color
        use_color = (
            hasattr(sys.stdout, "isatty")
            and sys.stdout.isatty()
            and os.environ.get("NO_COLOR") is None
        )
        if use_color:
            # Yellow bold text on red background for maximum visibility
            print("\033[1;33;41m" + border + "\033[0m")
            print("\033[1;33;41m" + warning_message_blank_line + "\033[0m")
            print(
                "\033[1;33;41m"
                + warning_message_left_border
                + warning_message
                + warning_message_right_border
                + "\033[0m"
            )
            print("\033[1;33;41m" + warning_message_blank_line + "\033[0m")
            print("\033[1;33;41m" + border + "\033[0m")
        else:
            # Fallback for terminals without color support
            print(border)
            print(warning_message_blank_line)
            print(
                warning_message_left_border
                + warning_message
                + warning_message_right_border
            )
            print(warning_message_blank_line)
            print(border)
        return True
    return False


def prepare_local_venv(build_tag):
    """
    Tries to activate the build. If the build is not found, it will try to create
    a venv for that build and then activate it.
    """

    if check_for_disabled_flag():
        return True

    venv_name = get_venv_name(build_tag)
    venv_path = get_venv_directory_for_build(venv_name)

    # Try to activate existing venv first
    print(f"Attempting to activate venv {venv_name}")
    result = activate_venv(venv_path)
    if result:
        return result

    print("Cannot activate the venv. Re-creating the virtual environment...")
    # The venv doesn't exist, so create it
    gcubed_root = os.environ.get("GCUBED_ROOT")
    if not gcubed_root:
        print("GCUBED_ROOT environment variable not set")
        return False

    # Get Git repository URL from environment variable
    repo_url = os.environ.get("GCUBED_PYTHON_PREREQUISITES_REPO")
    if not repo_url:
        print("GCUBED_PYTHON_PREREQUISITES_REPO not set")
        return False

    try:
        # Create new venv if it doesn't already exist (no probs if it already does)
        print(f"Creating virtual environment for build {build_tag}...")
        subprocess.run(["uv", "venv", venv_name], cwd=gcubed_root, check=True)

        # Create temporary directory
        temp_dir_name = get_venv_name("temp")
        temp_dir_path = os.path.join(gcubed_root, temp_dir_name)

        # Remove temp directory if it exists
        if os.path.exists(temp_dir_path):
            shutil.rmtree(temp_dir_path)

        # Clone the repository with the specific build tag
        print(f"Cloning prerequisites for build {build_tag}...")
        clone_cmd = [
            "git",
            "clone",
            "--depth",
            "1",
            "--single-branch",
            "--branch",
            build_tag,
            repo_url,
            temp_dir_name,
        ]
        subprocess.run(clone_cmd, cwd=gcubed_root, check=True)

        # Get Python interpreter path
        python_path = os.path.join(venv_path, "bin", "python")

        # Find files to install
        wheel_files = glob.glob(os.path.join(temp_dir_path, "*.whl"))
        req_files = glob.glob(os.path.join(temp_dir_path, "requirements*.txt"))

        # Install wheel files and requirements files
        install_packages(wheel_files, python_path, temp_dir_name, gcubed_root)
        install_packages(req_files, python_path, temp_dir_name, gcubed_root, "-r")

        # Clean up temporary directory
        print(f"Cleaning up temporary files...")
        shutil.rmtree(temp_dir_path)

        # Try to activate the newly created venv
        print("Virtual environment created, attempting to activate...")
        return activate_venv(venv_path)

    except subprocess.CalledProcessError as e:
        print(f"Error creating virtual environment: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        return False


def set_vscode_python_interpreter(build_tag):
    """Tell VSCode extension to use the specified interpreter."""
    venv_name = get_venv_name(build_tag)
    # venv_path = get_venv_directory_for_build(venv_name)
    python_path = os.path.join(".", venv_name, "bin", "python")

    print(f"Trying to switch python interpreter to: {python_path}")

    try:
        response = requests.post(
            "http://127.0.0.1:9876/set-interpreter",
            json={"pythonPath": python_path},
            timeout=3,
        )
        if response.status_code == 200:
            print(f"VSCode Python interpreter set to: {python_path}")
            return True
        else:
            print(f"Failed to set interpreter: {response.text}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"Communication with VSCode extension failed: {e}")
        print("Is the extension installed and running? Please contact G-Cubed support.")
        return False


def activate_or_build_and_activate_venv(build_tag):
    # if local venv is up, then try to activate it via the custom vscode extension
    if prepare_local_venv(build_tag) is not False:
        return set_vscode_python_interpreter(build_tag)
    # no venv
    return False


def main():
    """
    simple test/demonstration.

    A script calling this module executes "activate_build_venv(<build-number>)" and recieves
    either True or False as a return value. If True, the script can proceed with the simulation.
    """

    # gcubed_build_tag is a build tag that the simulation would use when
    # calling activate_build_venv in this module.
    gcubed_build_tag = "adb_0001"

    # Calling script would do something like this:
    if activate_or_build_and_activate_venv(gcubed_build_tag) is False:
        print(
            "Failed to activate virtual environment required for this simulation. Please contact G-Cubed support."
        )
        sys.exit(1)

    print(f"\nSuccess. Starting simulation...")

    #### Continue running your code here ====>>


if __name__ == "__main__":
    main()
