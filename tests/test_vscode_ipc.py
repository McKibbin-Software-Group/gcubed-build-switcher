import json
import unittest
from unittest import mock

try:
    from support import add_src_to_path
except ModuleNotFoundError:
    from tests.support import add_src_to_path

add_src_to_path()

from gcubed_build_switcher import vscode


class FakeSocket:
    def __init__(self, response):
        self.response = response
        self.sent = b""
        self.connected_path = None
        self.timeout = None
        self.closed = False

    def settimeout(self, timeout):
        self.timeout = timeout

    def connect(self, path):
        self.connected_path = path

    def sendall(self, message):
        self.sent += message

    def recv(self, _buffer_size):
        if self.response is None:
            return b""
        response = self.response
        self.response = None
        return response

    def close(self):
        self.closed = True


class VSCodeIpcCompatibilityTests(unittest.TestCase):
    def test_python_client_sends_stable_socket_payload(self):
        fake_socket = self._run_with_response(
            {"success": True, "requestedPath": "/workspace/project/venv_gcubed_c_0002/bin/python"}
        )

        self.assertEqual(fake_socket.connected_path, vscode.VSCODE_VENV_SOCKET_PATH)
        self.assertEqual(fake_socket.timeout, vscode.VSCODE_VENV_SWITCHER_API_TIMEOUT_SECONDS)
        self.assertTrue(fake_socket.sent.endswith(b"\0"))

        payload = json.loads(fake_socket.sent[:-1].decode("utf-8"))
        self.assertEqual(
            payload,
            {
                "action": "set-interpreter",
                "pythonPath": "/workspace/project/venv_gcubed_c_0002/bin/python",
                "shortName": "venv_gcubed_c_0002",
            },
        )
        self.assertTrue(fake_socket.closed)

    def test_python_client_accepts_old_extension_response_shape(self):
        fake_socket = self._run_with_response(
            {
                "success": True,
                "message": "Switched to /workspace/project/venv_gcubed_c_0002/bin/python",
                "requestedPath": "/workspace/project/venv_gcubed_c_0002/bin/python",
            }
        )

        self.assertTrue(fake_socket.closed)

    def test_python_client_accepts_new_extension_response_shape(self):
        fake_socket = self._run_with_response(
            {
                "success": True,
                "message": "Switched to /workspace/project/venv_gcubed_c_0002/bin/python",
                "requestedPath": "/workspace/project/venv_gcubed_c_0002/bin/python",
                "apiId": "ms-python.vscode-python-envs",
            }
        )

        self.assertTrue(fake_socket.closed)

    def _run_with_response(self, response_object):
        response = json.dumps(response_object).encode("utf-8") + b"\0"
        fake_socket = FakeSocket(response)

        with mock.patch.object(vscode.os.path, "exists", return_value=True), mock.patch.object(
            vscode, "try_get_venv_directory_for_build", return_value="/workspace/project/venv_gcubed_c_0002"
        ), mock.patch.object(vscode.socket, "socket", return_value=fake_socket):
            result = vscode.set_vscode_python_interpreter("c_0002")

        self.assertTrue(result)
        return fake_socket


if __name__ == "__main__":
    unittest.main()
