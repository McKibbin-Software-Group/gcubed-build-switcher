import os
import sys
import subprocess
import shutil
import glob

from .config import (
    VENV_NAME_PREFIX,
    DEFAULT_TEMP_DIR_SUFFIX,
    get_gcubed_root,
    get_package_name,
    get_prerequisites_repo_url,
    is_feature_disabled,
    ConfigurationError,
)
from .messaging import display_warning
from .packages import install_packages

def get_venv_name(gcubed_code_build_tag):
    """
    Construct virtual environment name from build tag.

    Args:
        gcubed_code_build_tag (str): The G-Cubed code build tag

    Returns:
        str: The virtual environment name
    """
    return f"{VENV_NAME_PREFIX}{gcubed_code_build_tag}"

def get_venv_directory_for_build(venv_name):
    """
    Get the directory path for a virtual environment.

    Args:
        venv_name (str): Name of the virtual environment

    Returns:
        str: Path to the virtual environment or False if GCUBED_ROOT not set
    """
    try:
        gcubed_root = get_gcubed_root()
        return os.path.join(gcubed_root, venv_name)
    except ConfigurationError as e:
        print(str(e))
        return False

def activate_venv(venv_path):
    """
    Checks for the existence of the venv and activates it.

    Args:
        venv_path (str): Path to the virtual environment

    Returns:
        bool: True if activation successful, False otherwise
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
    try:
        package_name = get_package_name()

        subprocess.run(
            ["uv", "pip", "show", "-p", python_path, package_name],
            check=True,
            capture_output=True,
            text=True,
        )
    except ConfigurationError as e:
        print(str(e))
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"Error looking for prerequisite package '{package_name}' in virtual environment: {e}.")
        return False

    # Everything is in place so execute the activate_this.py script
    try:
        with open(activate_venv_path) as file:
            exec(file.read(), dict(__file__=activate_venv_path))
    except Exception as e:
        print(f"Error activating virtual environment: {e}")
        return False

    print(f"Activated virtual environment -")
    print(f"  Python interpreter: {sys.executable}")
    print(f"  Python version: {sys.version.split()[0]}")
    print(f"  Virtual env path: {sys.prefix}")
    print(f"  VIRTUAL_ENV set: {'VIRTUAL_ENV' in os.environ}")

    return True

def create_venv_for_build(build_tag):
    """
    Create a virtual environment for the specified build tag.

    Args:
        build_tag (str): The G-Cubed code build tag

    Returns:
        bool: True if creation successful, False otherwise
    """
    try:
        gcubed_root = get_gcubed_root()
        repo_url = get_prerequisites_repo_url()

        venv_name = get_venv_name(build_tag)
        venv_path = os.path.join(gcubed_root, venv_name)

        # Create temporary directory name
        temp_dir_name = get_venv_name(DEFAULT_TEMP_DIR_SUFFIX)
        temp_dir_path = os.path.join(gcubed_root, temp_dir_name)

        # Create new venv
        print(f"Creating virtual environment for build {build_tag}...")
        subprocess.run(["uv", "venv", "--system-site-packages", venv_name], cwd=gcubed_root, check=True)

        # Remove temp directory if it already exists
        if os.path.exists(temp_dir_path):
            shutil.rmtree(temp_dir_path)

        # Clone the repository with the specific build tag
        print(f"Cloning prerequisites for build {build_tag}...")
        clone_cmd = [
            "git", "clone", "--depth", "1", "--single-branch",
            "--branch", build_tag, repo_url, temp_dir_name,
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
        print("Cleaning up temporary files...")
        shutil.rmtree(temp_dir_path)

        return True

    except ConfigurationError as e:
        print(str(e))
        return False
    except subprocess.CalledProcessError as e:
        print(f"Error creating virtual environment: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error in virtual environment creation: {e}")
        return False

def prepare_local_venv(build_tag):
    """
    Tries to activate the build. If the build is not found, creates and activates it.

    Args:
        build_tag (str): The G-Cubed code build tag

    Returns:
        bool: True if activation successful, False otherwise
    """
    # Check if build switching is disabled
    if is_feature_disabled("CODE_AUTO_BUILD_SWITCHER"):
        warning_message = "WARNING: Automatic G-Cubed Code build switching disabled. Skipping virtual environment activation."
        display_warning(warning_message)
        return True

    venv_name = get_venv_name(build_tag)
    venv_path = get_venv_directory_for_build(venv_name)

    # Try to activate existing venv first
    print(f"Attempting to activate venv {venv_name}")
    result = activate_venv(venv_path)
    if result:
        return True

    print("Cannot activate the venv. Re-creating the virtual environment...")

    # Create the venv and install packages
    if create_venv_for_build(build_tag):
        # Try to activate the newly created venv
        print("Virtual environment created, attempting to activate...")
        return activate_venv(venv_path)

    return False
