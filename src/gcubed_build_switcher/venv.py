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
    ConfigurationError,
)
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


def verify_venv_has_gcubed(venv_path):
    """
    Checks for the existence of the requested venv and
    confirm that gcubed is installed in it.

    Args:
        venv_path (str): Path to the virtual environment

    Returns:
        bool: True if activation successful, False otherwise
              Note - special case if we get an exception looking for the package
    """
    # For error bubbling
    if venv_path is False:
        return False

    python_path = os.path.join(venv_path, "bin", "python")

    # Check if requested venv exists
    if not os.path.exists(python_path):
        print(f"Virtual environment not found at: {venv_path}")
        return False

    # Check if the gcubed package is installed in that venv
    try:
        gcubed_package_name = get_package_name()

        subprocess.run(
            ["uv", "pip", "show", "-p", python_path, gcubed_package_name],
            check=True,
            capture_output=True,
            text=True,
        )
    except ConfigurationError as e:
        print(str(e))
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        # NOTE: DO NOT DELETE THE VENV IF THE PACKAGE IS NOT FOUND - IT MAY BE THERE FOR OTHER REASONS
        print(f"Error looking for prerequisite package '{gcubed_package_name}' in virtual environment: {e}.")
        return False

    # So the venv exists and there is a gcubed package installed in it
    return True


def remove_directory_tree(directory_to_delete, message):
    if os.path.exists(directory_to_delete):
        print(message)
        shutil.rmtree(directory_to_delete)
        return True
    return False


def validate_build_tag(build_tag):
    """
    Validates if the specified build tag exists in the prerequisites repository.

    Args:
        build_tag (str): The G-Cubed code build tag

    Returns:
        tuple: (bool, temp_dir_path) indicating success and path to temp clone
    """
    try:
        gcubed_root = get_gcubed_root()
        repo_url = get_prerequisites_repo_url()

        # Create temporary directory name
        temp_dir_name = get_venv_name(DEFAULT_TEMP_DIR_SUFFIX)
        temp_dir_path = os.path.join(gcubed_root, temp_dir_name)

        # Remove temp directory if it already exists
        remove_directory_tree(temp_dir_path, "Removing old temp directory...")

        # Clone the repository with the specific build tag
        print(f"Validating build tag {build_tag}...")
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

        return True, temp_dir_path

    except ConfigurationError as e:
        print(str(e))
        return False, None
    except subprocess.CalledProcessError as e:
        print(
            f"Error: Build tag '{build_tag}' does not exist in the prerequisites repository."
        )
        # Clean up temp directory if it was created
        remove_directory_tree(temp_dir_path, "Cleaning up temp directory")
        return False, None


def create_venv_for_build(build_tag):
    """
    Create a virtual environment for the specified build tag.

    Args:
        build_tag (str): The G-Cubed code build tag

    Returns:
        bool: True if creation successful, False otherwise
    """
    # First validate the build tag
    is_valid, temp_dir_path = validate_build_tag(build_tag)
    if not is_valid:
        return False

    try:
        gcubed_root = get_gcubed_root()
        venv_name = get_venv_name(build_tag)
        venv_path = os.path.join(gcubed_root, venv_name)

        # Create new venv only after validating the build tag
        print(f"Creating virtual environment for build {build_tag}...")
        subprocess.run(
            ["uv", "venv", "--system-site-packages", venv_name],
            cwd=gcubed_root,
            check=True,
        )

        # Get Python interpreter path
        python_path = os.path.join(venv_path, "bin", "python")

        # Find files to install
        wheel_files = glob.glob(os.path.join(temp_dir_path, "*.whl"))
        requirements_txt_files = glob.glob(os.path.join(temp_dir_path, "requirements*.txt"))

        # Install wheel files and requirements files
        if not install_packages(
            wheel_files,
            python_path,
            get_venv_name(DEFAULT_TEMP_DIR_SUFFIX),
            gcubed_root,
        ):
            raise RuntimeError(f"Failed to install wheel files for build {build_tag}")

        if not install_packages(
            requirements_txt_files,
            python_path,
            get_venv_name(DEFAULT_TEMP_DIR_SUFFIX),
            gcubed_root,
            "-r",
        ):
            raise RuntimeError(f"Failed to install requirements for build {build_tag}")

        return True

    except Exception as e:
        print(f"Error creating virtual environment: {e}")
        # If venv was created but installation failed, clean it up
        remove_directory_tree(venv_path, "Cleaning up failed virtual environment...")
        return False

    finally:
        # Always clean up temp directory
        remove_directory_tree(temp_dir_path, "Cleaning up temporary files...")


def prepare_local_venv(build_tag):
    """
    Tries to activate the build. If the build is not found, creates and activates it.

    Args:
        build_tag (str): The G-Cubed code build tag

    Returns:
        bool: True if activation successful, False otherwise
    """
    venv_name = get_venv_name(build_tag)
    venv_path = get_venv_directory_for_build(venv_name)

    # Try to activate existing venv first
    print(f"Attempting to activate venv {venv_name}")
    result = verify_venv_has_gcubed(venv_path)
    if result:
        return True

    print("Cannot activate the venv. Re-creating the virtual environment...")

    # Create the venv and install packages
    if create_venv_for_build(build_tag):
        # Try to activate the newly created venv
        print("Virtual environment created, attempting to activate...")
        return verify_venv_has_gcubed(venv_path)

    return False
