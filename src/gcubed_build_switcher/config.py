import os
from typing import Optional, overload


@overload
def get_optional_env_var(name: str) -> Optional[str]:
    ...


@overload
def get_optional_env_var(name: str, default: str) -> str:
    ...


def get_optional_env_var(name: str, default: Optional[str] = None) -> Optional[str]:
    """Get an optional environment variable with default."""
    return os.environ.get(name, default)


# Constants
DEFAULT_TEMP_DIR_SUFFIX = "temp"
VSCODE_VENV_SWITCHER_API_ACTION = "set-interpreter"
VSCODE_VENV_SWITCHER_API_TIMEOUT_SECONDS = 6

VSCODE_VENV_SOCKET_PATH = get_optional_env_var(
    "GCUBED_VENV_SOCKET_PATH",
    "/tmp/gcubed_venv_switcher.sock",
)
VENV_NAME_PREFIX = get_optional_env_var("GCUBED_VENV_NAME_PREFIX", "venv_gcubed_")

RICH_TRACEBACK_ENABLED = get_optional_env_var("RICH_TRACEBACKS")

DEVCONTAINER_MARKER_ENV_VARS = (
    "GCUBED_DEVCONTAINER",
    "DEVCONTAINER",
    "REMOTE_CONTAINERS",
    "CODESPACES",
)

DEFAULT_REQUIRED_UV_VERSION = "0.11.18"
DEFAULT_BUILD_SWITCHER_INSTALL_SPEC = (
    "gcubed-build-switcher @ "
    "git+https://github.com/McKibbin-Software-Group/gcubed-build-switcher@main"
)

class ConfigurationError(Exception):
    """Exception raised for configuration errors."""
    pass


def get_required_env_var(name: str, error_message: Optional[str] = None) -> str:
    """Get a required environment variable or exit with error."""
    value = os.environ.get(name)
    if not value:
        msg = (
            error_message
            or f"{name} environment variable not set. Please contact G-Cubed support."
        )
        raise ConfigurationError(msg)
    return value


def is_feature_disabled(feature_name: str) -> bool:
    """
      The environment variable name is formatted as GCUBED_CODE_<feature_name>_DISABLED.
      The variable can have any value; it just has to exist to disable the feature.

      Args:
        feature_name (str): The name of the feature to check.

      Returns:
        bool: True if the feature is disabled, False otherwise.
    """
    environment_variable = f"GCUBED_CODE_{feature_name}_DISABLED"
    print(f"Checking environment variable {environment_variable}")
    feature_is_disabled = os.environ.get(environment_variable) is not None
    status = "disabled" if feature_is_disabled else "enabled"
    print(f"Feature {feature_name} is {status}")
    return bool(feature_is_disabled)


def is_running_in_devcontainer() -> bool:
    """Detect explicit devcontainer/Codespaces runtime markers."""
    for name in DEVCONTAINER_MARKER_ENV_VARS:
        value = os.environ.get(name)
        if value and value.strip().lower() not in ("0", "false", "no", "off"):
            return True
    return False


def get_gcubed_root() -> str:
    """Get the G-Cubed root directory from environment."""
    return get_required_env_var("GCUBED_ROOT")


def get_package_name() -> str:
    """Get the G-Cubed code package name."""
    return get_required_env_var("GCUBED_CODE_PACKAGE_NAME")


def get_prerequisites_repo_url() -> str:
    """Get the URL for the prerequisites repository."""
    return get_required_env_var("GCUBED_PYTHON_PREREQUISITES_REPO")


def get_required_uv_version() -> str:
    """Get the uv version required for devcontainer venv creation."""
    return get_optional_env_var(
        "GCUBED_REQUIRED_UV_VERSION",
        DEFAULT_REQUIRED_UV_VERSION,
    ) or DEFAULT_REQUIRED_UV_VERSION


def get_build_switcher_install_spec() -> str:
    """Get the package spec used to install the switcher into generated venvs."""
    return get_optional_env_var(
        "GCUBED_BUILD_SWITCHER_INSTALL_SPEC",
        DEFAULT_BUILD_SWITCHER_INSTALL_SPEC,
    ) or DEFAULT_BUILD_SWITCHER_INSTALL_SPEC
