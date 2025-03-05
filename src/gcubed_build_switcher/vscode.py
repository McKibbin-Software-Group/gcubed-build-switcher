import os
import requests
from .venv import get_venv_name

def set_vscode_python_interpreter(build_tag):
    """
    Tell VSCode extension to use the specified interpreter.

    Args:
        build_tag (str): The G-Cubed code build tag

    Returns:
        bool: True if successful, False otherwise
    """
    venv_name = get_venv_name(build_tag)
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
