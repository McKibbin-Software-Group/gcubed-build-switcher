import os
import sys
import subprocess
import shutil
import glob
from typing import Optional

from .config import (
    VENV_NAME_PREFIX,
    DEFAULT_TEMP_DIR_SUFFIX,
    RICH_TRACEBACK_ENABLED,
    get_gcubed_root,
    get_package_name,
    get_prerequisites_repo_url,
    get_build_switcher_install_spec,
    ConfigurationError,
)
from .packages import install_packages
from .python_provider import ensure_python_available, PythonProviderError


def get_venv_name(gcubed_code_build_tag):
    """
    Construct virtual environment name from build tag.

    Args:
        gcubed_code_build_tag (str): The G-Cubed code build tag

    Returns:
        str: The virtual environment name
    """
    return f"{VENV_NAME_PREFIX}{gcubed_code_build_tag}"


def try_get_venv_directory_for_build(venv_name: str) -> Optional[str]:
    """
    Get the directory path for a virtual environment.

    Args:
        venv_name (str): Name of the virtual environment

    Returns:
        str: Path to the virtual environment or None if GCUBED_ROOT is not set
    """
    try:
        gcubed_root = get_gcubed_root()
        return os.path.join(gcubed_root, venv_name)
    except ConfigurationError as e:
        print(str(e))
        return None


def get_venv_directory_for_build(venv_name: str):
    """
    Get the directory path for a virtual environment.

    Returns a path string, or False for legacy callers that treat a missing
    configuration as a failed venv lookup.
    """
    return try_get_venv_directory_for_build(venv_name) or False


def verify_venv_has_gcubed(venv_path: Optional[str]) -> bool:
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
    if not venv_path:
        return False

    python_path = get_venv_python_path(venv_path)

    # Check if requested venv exists
    if not os.path.exists(python_path):
        print(f"Virtual environment not found at: {venv_path}")
        return False

    # Check if the gcubed package is installed in that venv
    gcubed_package_name = ""
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
        # Do not delete the venv if the package is missing; it may be useful.
        print(
            "Error looking for prerequisite package "
            f"'{gcubed_package_name}' in virtual environment: {e}."
        )
        return False

    # So the venv exists and there is a gcubed package installed in it
    return True


def remove_directory_tree(directory_to_delete, message):
    if os.path.exists(directory_to_delete):
        print(message)
        shutil.rmtree(directory_to_delete)
        return True
    return False


def get_uv_env():
    env = os.environ.copy()
    env["UV_LINK_MODE"] = "copy"
    return env


def get_venv_python_path(venv_path: str) -> str:
    return os.path.join(venv_path, "bin", "python")


def find_local_project_root() -> Optional[str]:
    candidate = os.path.abspath(
        os.path.join(os.path.dirname(__file__), os.pardir, os.pardir)
    )
    pyproject_path = os.path.join(candidate, "pyproject.toml")
    package_path = os.path.join(candidate, "src", "gcubed_build_switcher")

    if os.path.exists(pyproject_path) and os.path.isdir(package_path):
        return candidate
    return None


def get_build_switcher_install_target() -> str:
    local_project_root = find_local_project_root()
    if local_project_root:
        return local_project_root
    return get_build_switcher_install_spec()


def venv_has_runtime_support_packages(python_path: str) -> bool:
    try:
        subprocess.run(
            [
                "uv",
                "pip",
                "show",
                "-p",
                python_path,
                "gcubed-build-switcher",
                "rich",
            ],
            check=True,
            capture_output=True,
            text=True,
            env=get_uv_env(),
        )
        return True
    except subprocess.CalledProcessError:
        return False


def ensure_runtime_support_packages(python_path: str, gcubed_root: str) -> bool:
    """
    Ensure generated venvs can import the switcher after VS Code activates them.

    Build venvs may use an exact prebuilt Python that cannot see packages installed
    into the devcontainer's global Python, so install this support package directly.
    """
    if venv_has_runtime_support_packages(python_path):
        return True

    install_target = get_build_switcher_install_target()
    print(
        "Installing G-Cubed build switcher support package "
        "into virtual environment..."
    )

    try:
        subprocess.run(
            ["uv", "pip", "install", "-p", python_path, install_target],
            cwd=gcubed_root,
            check=True,
            env=get_uv_env(),
        )
        return venv_has_runtime_support_packages(python_path)
    except subprocess.CalledProcessError as e:
        print(f"Error installing G-Cubed build switcher support package: {e}")
        return False


def activate_rich_formatter(venv_path):
    """
    Configures Rich traceback handling for the virtual environment.

    When RICH_TRACEBACK_ENABLED is True, finds the appropriate site-packages
    directory and creates/overwrites the sitecustomize.py file to install Rich
    traceback formatter.
    Otherwise, removes the file if it exists.

    Args:
        venv_path (str): Path to the virtual environment
    """

    print("Configuring Rich formatter...")

    # Find the site-packages directory
    site_packages_dirs = glob.glob(
        os.path.join(venv_path, "lib", "python*", "site-packages")
    )

    if not site_packages_dirs:
        print(
            "Warning: Could not find site-packages directory in virtual "
            "environment - cannot activate Rich traceback formatter"
        )
        return

    site_packages_dir = site_packages_dirs[0]  # Take the first match
    customize_file = os.path.join(site_packages_dir, "sitecustomize.py")

    if RICH_TRACEBACK_ENABLED:
        # Check if file exists and contains our config already
        existing_content = ""

        if os.path.exists(customize_file):
            with open(customize_file, "r") as f:
                existing_content = f.read()

            if "from rich.traceback import install" in existing_content:
                print("Rich traceback formatter is enabled")
                return  # Already configured

            existing_content = existing_content.strip() + "\n\n"

        with open(customize_file, "w") as f:
            f.write(
                f"{existing_content}from rich.traceback import install\n"
                "install(show_locals=False)"
            )
        print("Rich traceback formatter has been enabled")

    elif os.path.exists(customize_file):
        with open(customize_file, "r") as f:
            lines = f.read().splitlines()

        # Look for and remove our Rich configuration
        has_rich_config = False
        filtered_lines = []

        for line in lines:
            if "rich.traceback" in line or "show_locals" in line:
                has_rich_config = True
                continue  # Skip this line
            filtered_lines.append(line)

        if has_rich_config:  # Only take action if we found our config
            if filtered_lines:  # If anything remains, write it back
                with open(customize_file, "w") as f:
                    f.write("\n".join(filtered_lines))
            else:  # Empty file after removal
                os.remove(customize_file)
            print("Rich traceback formatter has been disabled.")

        else:
          print("Rich traceback formatter was not enabled in the first place.")

    else:
        print("Rich traceback formatter is not enabled.")

def validate_build_tag(build_tag):
    """
    Validates if the specified build tag exists in the prerequisites repository.

    Args:
        build_tag (str): The G-Cubed code build tag

    Returns:
        tuple: (bool, temp_dir_path) indicating success and path to temp clone
    """
    temp_dir_path = ""
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
    except subprocess.CalledProcessError:
        print(
            f"Error: Build tag '{build_tag}' does not exist in the "
            "prerequisites repository."
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
    assert temp_dir_path is not None

    venv_path = ""
    try:
        gcubed_root = get_gcubed_root()
        venv_name = get_venv_name(build_tag)
        venv_path = os.path.join(gcubed_root, venv_name)

        # Create new venv only after validating the build tag
        python_version_file = os.path.join(temp_dir_path, ".python-version")
        python_version = None
        if os.path.exists(python_version_file):
            with open(python_version_file) as f:
                python_version = f.read().strip()
            print(f".python-version file found - requesting version: {python_version}")

        print(f"Creating virtual environment for build {build_tag}...")
        venv_cmd = ["uv", "venv", "--system-site-packages", venv_name]
        if python_version:
            print(f"Resolving Python {python_version} (from .python-version)...")
            python_executable = ensure_python_available(python_version)
            venv_cmd.extend(["--python", python_executable])
        else:
            print("No specific Python version requested")

        subprocess.run(venv_cmd, cwd=gcubed_root, check=True, env=get_uv_env())

        # Get Python interpreter path
        python_path = get_venv_python_path(venv_path)

        # Find files to install
        wheel_files = glob.glob(os.path.join(temp_dir_path, "*.whl"))
        requirements_txt_files = glob.glob(
            os.path.join(temp_dir_path, "requirements*.txt")
        )

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

        if not ensure_runtime_support_packages(python_path, gcubed_root):
            raise RuntimeError(
                "Failed to install build switcher support package for build "
                f"{build_tag}"
            )

        return True

    except PythonProviderError as e:
        print(str(e))
        return False
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
    Depending on the existence of the RICH_TRACEBACKS environment variable will also
    enable Rich as the default traceback formatter

    Args:
        build_tag (str): The G-Cubed code build tag

    Returns:
        bool: True if activation successful, False otherwise
    """
    venv_name = get_venv_name(build_tag)
    venv_path = try_get_venv_directory_for_build(venv_name)
    if venv_path is None:
        return False

    # Verify existing venv first
    print(f"Verifying '{venv_name}' exists and has the gcubed module installed...")
    result = verify_venv_has_gcubed(venv_path)
    if result:
        try:
            gcubed_root = get_gcubed_root()
        except ConfigurationError as e:
            print(str(e))
            return False

        if not ensure_runtime_support_packages(
            get_venv_python_path(venv_path),
            gcubed_root,
        ):
            return False

        # If all good, then activate rich formatter
        activate_rich_formatter(venv_path)
        return True

    print("Something missing, re-creating...")

    # Create the venv and install packages
    if create_venv_for_build(build_tag):
        # Verify the newly created venv
        print("Virtual environment created, verifying...")
        result = verify_venv_has_gcubed(venv_path)
        if result:
            # If all good, then activate rich formatter
            activate_rich_formatter(venv_path)
            return True

    return False
