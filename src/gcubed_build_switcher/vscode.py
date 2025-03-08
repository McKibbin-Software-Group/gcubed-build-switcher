import os
import requests
from .venv import get_venv_name, get_venv_directory_for_build
from .config import (
    VSCODE_VENV_SWITCHER_HOST,
    VSCODE_VENV_SWITCHER_PORT,
    VSCODE_VENV_SWITCHER_API_ROUTE,
    VSCODE_VENV_SWITCHER_API_TIMEOUT_SECONDS,
)


def set_vscode_python_interpreter(build_tag):
    """
    Tell VSCode extension to use the specified interpreter.

    Args:
        build_tag (str): The G-Cubed code build tag

    Returns:
        bool: True if successful, False otherwise
    """
    venv_name = get_venv_name(build_tag)
    full_path = get_venv_directory_for_build(venv_name)
    python_path = os.path.join(full_path, "bin", "python")

    print(f"Trying to switch python interpreter to: {python_path}")

    try:
        response = requests.post(
            f"http://{VSCODE_VENV_SWITCHER_HOST}:{VSCODE_VENV_SWITCHER_PORT}/{VSCODE_VENV_SWITCHER_API_ROUTE}",
            json={"pythonPath": python_path, "shortName": venv_name},
            timeout=VSCODE_VENV_SWITCHER_API_TIMEOUT_SECONDS,
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
