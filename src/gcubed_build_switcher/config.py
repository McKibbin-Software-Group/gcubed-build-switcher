import os
import sys

# Constants
VENV_NAME_PREFIX = "venv_gcubed_"
DEFAULT_TEMP_DIR_SUFFIX = "temp"

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

def get_optional_env_var(name, default=None):
    """Get an optional environment variable with default."""
    return os.environ.get(name, default)

def is_feature_disabled(feature_name):
    """Check if a feature is disabled via environment variable."""
    return bool(os.environ.get(f"GCUBED_{feature_name}_DISABLED"))

def get_gcubed_root():
    """Get the G-Cubed root directory from environment."""
    return get_required_env_var("GCUBED_ROOT")

def get_package_name():
    """Get the G-Cubed code package name."""
    return get_required_env_var("GCUBED_CODE_PACKAGE_NAME")

def get_prerequisites_repo_url():
    """Get the URL for the prerequisites repository."""
    return get_required_env_var("GCUBED_PYTHON_PREREQUISITES_REPO")

