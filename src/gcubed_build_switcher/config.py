import os


def get_optional_env_var(name, default=None):
    """Get an optional environment variable with default."""
    return os.environ.get(name, default)


# Constants
DEFAULT_TEMP_DIR_SUFFIX = "temp"
VSCODE_VENV_SWITCHER_API_ACTION = "set-interpreter"
VSCODE_VENV_SWITCHER_API_TIMEOUT_SECONDS = 6

VSCODE_VENV_SOCKET_PATH = get_optional_env_var("GCUBED_VENV_SOCKET_PATH", "/tmp/gcubed_venv_switcher.sock")
VENV_NAME_PREFIX = get_optional_env_var("GCUBED_VENV_NAME_PREFIX", "venv_gcubed_")

RICH_TRACEBACK_ENABLED = get_optional_env_var("RICH_TRACEBACKS")

DEFAULT_PYTHON_INSTALL_ROOT = "~/.gcubed/python-builds/pyenv"
DEFAULT_PYTHON_PREBUILT_MANIFEST_URL = (
    "https://github.com/AshieSlashy/gcubed-python-builds/releases/download/"
    "python-builds-latest/manifest.json"
)
DEFAULT_PYTHON_DOWNLOAD_TIMEOUT_SECONDS = 60
DEFAULT_PYTHON_PROVIDER_ORDER = "cache,path,system,prebuilt"

class ConfigurationError(Exception):
    """Exception raised for configuration errors."""
    pass

def get_required_env_var(name, error_message=None):
    """Get a required environment variable or exit with error."""
    value = os.environ.get(name)
    if not value:
        msg = (
            error_message
            or f"{name} environment variable not set. Please contact G-Cubed support."
        )
        raise ConfigurationError(msg)
    return value

def is_feature_disabled(feature_name):
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
    print(f"Feature {feature_name} is {'disabled' if feature_is_disabled else 'enabled'}")
    return bool(feature_is_disabled)

def get_gcubed_root():
    """Get the G-Cubed root directory from environment."""
    return get_required_env_var("GCUBED_ROOT")

def get_package_name():
    """Get the G-Cubed code package name."""
    return get_required_env_var("GCUBED_CODE_PACKAGE_NAME")

def get_prerequisites_repo_url():
    """Get the URL for the prerequisites repository."""
    return get_required_env_var("GCUBED_PYTHON_PREREQUISITES_REPO")

def get_python_install_root():
    """Get the root directory for cached MSG Python builds."""
    configured_root = get_optional_env_var("GCUBED_PYTHON_INSTALL_ROOT")
    if configured_root:
        return os.path.expanduser(configured_root)

    return os.path.expanduser(DEFAULT_PYTHON_INSTALL_ROOT)

def get_python_prebuilt_manifest_url():
    """Get the manifest URL for MSG prebuilt Python archives."""
    return get_optional_env_var(
        "GCUBED_PYTHON_PREBUILT_MANIFEST_URL",
        DEFAULT_PYTHON_PREBUILT_MANIFEST_URL,
    )

def get_python_download_timeout_seconds():
    """Get the timeout for Python manifest/archive downloads."""
    value = get_optional_env_var("GCUBED_PYTHON_DOWNLOAD_TIMEOUT_SECONDS")
    if value is None:
        return DEFAULT_PYTHON_DOWNLOAD_TIMEOUT_SECONDS

    try:
        timeout = int(value)
    except ValueError:
        return DEFAULT_PYTHON_DOWNLOAD_TIMEOUT_SECONDS

    if timeout <= 0:
        return DEFAULT_PYTHON_DOWNLOAD_TIMEOUT_SECONDS
    return timeout

def get_python_provider_order():
    """Get the ordered Python provider chain."""
    return get_optional_env_var(
        "GCUBED_PYTHON_PROVIDER_ORDER",
        DEFAULT_PYTHON_PROVIDER_ORDER,
    )
