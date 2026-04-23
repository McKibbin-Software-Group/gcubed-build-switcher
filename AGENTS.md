# G-Cubed Build Switcher Agent Notes

## Project Purpose

This repo ships a helper used inside G-Cubed customer devcontainers. Its job is to let model/simulation Python code request the G-Cubed Code library build it needs, ensure a matching virtual environment exists, and ask VS Code to switch its active Python interpreter to that environment.

There are two cooperating components:

- `src/gcubed_build_switcher/`: Python package and CLI (`gcubed-switch`) that validates a requested build tag, creates/verifies a build-specific venv, installs wheel and requirements artifacts from the tagged prerequisites repo, and sends the interpreter switch request.
- `vscode-extension/`: JavaScript VS Code extension that starts a Unix domain socket server and uses the Microsoft Python extension API to switch the active interpreter.

Release artifacts in `release-files/` are consumed by the G-Cubed devcontainer template from the GitHub `latest` release. Treat checked-in `.vsix` files as generated release artifacts unless the task is explicitly about packaging/releasing.

## Runtime Flow

1. User code calls `gcubed_build_switcher.activate_or_build_and_activate_venv(build_tag)` or runs `gcubed-switch <build_tag>`.
2. `src/gcubed_build_switcher/__init__.py` checks whether `GCUBED_CODE_AUTO_BUILD_SWITCHER_DISABLED` is present and exits early if so.
3. `venv.prepare_local_venv()` looks for `${GCUBED_ROOT}/venv_gcubed_<build_tag>/bin/python` and verifies that `GCUBED_CODE_PACKAGE_NAME` is installed using `uv pip show`.
4. If missing, `venv.create_venv_for_build()` clones `GCUBED_PYTHON_PREREQUISITES_REPO` at the requested tag into a temporary directory, reads an optional `.python-version`, creates the venv, and installs any `*.whl` and `requirements*.txt` files found in that tag.
5. `vscode.set_vscode_python_interpreter()` sends a null-terminated JSON message over `GCUBED_VENV_SOCKET_PATH` to request `"set-interpreter"`.
6. The VS Code extension receives the request in `vscode-extension/src/unixSocketServer/`, then `handlers/interpreterHandler.js` refreshes/resolves Python environments and calls the Python extension API to update the active interpreter path.

## Important Environment Variables

- `GCUBED_ROOT`: root directory where build-specific venvs and temporary prerequisite clones are created.
- `GCUBED_PYTHON_PREREQUISITES_REPO`: git repo containing build-tagged wheels, requirements files, and optional `.python-version`.
- `GCUBED_CODE_PACKAGE_NAME`: package name used to verify a venv contains the expected G-Cubed library.
- `GCUBED_CODE_AUTO_BUILD_SWITCHER_DISABLED`: when present with any value, disables automatic switching.
- `GCUBED_VENV_SOCKET_PATH`: Unix socket path shared by Python and the extension, default `/tmp/gcubed_venv_switcher.sock`.
- `GCUBED_VENV_NAME_PREFIX`: venv name prefix, default `venv_gcubed_`.
- `RICH_TRACEBACKS`: when present, `venv.py` writes Rich traceback setup into the target venv's `sitecustomize.py`.
- `UV_LINK_MODE=copy`: configured in the devcontainer so dependencies are copied into generated venvs instead of linked from uv's cache.

## Development Commands

Python package:

```bash
python -m src.gcubed_build_switcher.cli <build_tag>
gcubed-switch <build_tag>
```

VS Code extension commands should be run from `vscode-extension/`:

```bash
npm install
npm run build
npm run test:socket
npm run package:test
npm run package:patch
npm run package:minor
npm run package:major
```

`package:patch`, `package:minor`, and `package:major` bump the extension version, build a production `.vsix`, and copy it into `release-files/`.

## Code And Maintenance Notes

- Keep the Python side compatible with `requires-python = ">=3.6"` unless the project explicitly raises that floor.
- The Python package currently shells out to `git` and `uv`; avoid replacing these with heavier abstractions unless there is a clear reliability or coverage win.
- `venv.py` currently uses `uv python install <version>` when `.python-version` is present, then `uv venv --python <version>`. Future Python-provider work should preserve the ability to use `uv pip` for fast package installs even if interpreter acquisition moves elsewhere.
- The extension IPC protocol is null-terminated UTF-8 JSON over a Unix domain socket. Keep the Python client and JS server constants in sync.
- Extension tests exercise socket behaviour under `vscode-extension/tests/unixSocketServer/`; they mock or isolate socket paths rather than requiring the live VS Code extension.
- The extension README still mentions older HTTP/port-based examples in places, but the source code currently uses Unix sockets.
- Avoid destructive cleanup of `venv_gcubed*` directories unless the user explicitly asks; existing venvs may be useful to the devcontainer user.
- `.codex` is currently an untracked root file in this workspace. Leave unrelated untracked or user-created files alone.

## Release Notes

The devcontainer template downloads `release-files/pyproject.toml` and the packaged VSIX from the GitHub `latest` release. For a real release, confirm changes are merged to `main`, create/update the GitHub release tagged `latest`, and attach the files from `release-files/`.
