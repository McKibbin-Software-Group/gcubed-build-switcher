import os
import json
import socket
from .venv import get_venv_name, get_venv_directory_for_build
from .config import (
    VSCODE_VENV_SWITCHER_API_TIMEOUT_SECONDS,
    VSCODE_VENV_SOCKET_PATH,
    VSCODE_VENV_SWITCHER_API_ACTION,
)


def set_vscode_python_interpreter(build_tag):
    """
    Tell VSCode extension to use the specified interpreter via Unix socket.

    Args:
        build_tag (str): The G-Cubed code build tag

    Returns:
        bool: True if successful, False otherwise
    """
    venv_name = get_venv_name(build_tag)
    full_path = get_venv_directory_for_build(venv_name)
    python_path = os.path.join(full_path, "bin", "python")

    print(f"Trying to switch python interpreter to: {python_path}")

    # Check if socket file exists before attempting connection
    if not os.path.exists(VSCODE_VENV_SOCKET_PATH):
        print(f"Socket file not found at {VSCODE_VENV_SOCKET_PATH}")
        print("Is the VS Code extension installed and running?")
        return False

    try:
        # Prepare the request payload
        payload = {
            "action": VSCODE_VENV_SWITCHER_API_ACTION,
            "pythonPath": python_path,
            "shortName": venv_name,
        }

        # Create and connect the socket
        client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        client.settimeout(VSCODE_VENV_SWITCHER_API_TIMEOUT_SECONDS)
        client.connect(VSCODE_VENV_SOCKET_PATH)

        # Send the request with NULL_BYTE terminator
        message = json.dumps(payload).encode("utf-8") + b"\0"
        client.sendall(message)

        # Read the response until NULL_BYTE
        response_data = b""
        while True:
            chunk = client.recv(1024)
            if not chunk:
                break

            # Check if chunk contains NULL_BYTE
            if 0 in chunk:
                # Find position and slice off after NULL_BYTE
                null_pos = chunk.find(0)
                response_data += chunk[:null_pos]
                break

            response_data += chunk

        # Parse response and determine success
        responseString = response_data.decode("utf-8")
        responseObject = json.loads(responseString)

        if responseObject.get("success"):
            print(
                f"VSCode Python interpreter set to: {responseObject.get('requestedPath', python_path)}"
            )
            return True
        else:
            print(
                f"Failed to set interpreter: {responseString}"
            )
            return False

    except socket.timeout:
        print(
            f"Connection to VS Code extension timed out after {VSCODE_VENV_SWITCHER_API_TIMEOUT_SECONDS} seconds"
        )
        print("Is the extension installed and running? Please contact G-Cubed support.")

        return False
    except Exception as e:
        print(f"Error communicating with VS Code extension: {e}")
        print("Is the extension installed and running? Please contact G-Cubed support.")
        return False
    finally:
        # Ensure socket is closed regardless of outcome
        try:
            client.close()
        except:
            pass
