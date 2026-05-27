# Repo Overview

## Purpose

This repo ships the G-Cubed build switcher used by customer devcontainers. It lets model scripts request a G-Cubed Code build tag and get a matching Python environment plus VS Code interpreter selection without the user manually rebuilding or selecting venvs.

## Architecture

- Python package: `src/gcubed_build_switcher/`
  - `cli.py` exposes `gcubed-switch <build_tag>`.
  - `__init__.py` exposes `activate_or_build_and_activate_venv(build_tag)` and honors `GCUBED_CODE_AUTO_BUILD_SWITCHER_DISABLED`.
  - `venv.py` validates build tags, creates/verifies `${GCUBED_ROOT}/venv_gcubed_<build_tag>`, installs wheels/requirements from a temporary prerequisites clone, installs runtime support packages into generated venvs, and configures optional Rich tracebacks. In devcontainers it uses the ambient Python for new venvs.
  - `wheel_metadata.py` reads wheel `Requires-Python` metadata. Outside devcontainers, venv creation prefers this metadata over `.python-version`.
  - `python_provider.py` resolves exact CPython patch versions through cache, explicit path handling, system Python, or prebuilt manifest/archive download with checksum and safe extraction when non-devcontainer venv creation requests a specific interpreter.
  - `vscode.py` sends null-terminated JSON over `GCUBED_VENV_SOCKET_PATH` to request `set-interpreter`.
- VS Code extension: `vscode-extension/`
  - Starts a Unix domain socket server on startup.
  - Parses one null-terminated JSON request per connection.
  - Routes interpreter switching through an extension-owned environment selector adapter. The selector prefers `ms-python.vscode-python-envs` when available and verified, then falls back to the legacy `ms-python.python` API.
- Release payload: `release-files/`
  - Contains artifacts consumed by the G-Cubed devcontainer template from the GitHub `latest` release.

## Runtime Flow

1. User code calls `gcubed_build_switcher.activate_or_build_and_activate_venv(build_tag)` or runs `gcubed-switch <build_tag>`.
2. `src/gcubed_build_switcher/__init__.py` checks whether `GCUBED_CODE_AUTO_BUILD_SWITCHER_DISABLED` is present and exits early if so.
3. `venv.prepare_local_venv()` looks for `${GCUBED_ROOT}/venv_gcubed_<build_tag>/bin/python` and verifies that `GCUBED_CODE_PACKAGE_NAME` is installed using `uv pip show`.
4. If missing, `venv.create_venv_for_build()` clones `GCUBED_PYTHON_PREREQUISITES_REPO` at the requested tag into a temporary directory.
5. In devcontainers, venv creation uses the ambient container Python and skips wheel `Requires-Python` / `.python-version` interpreter acquisition.
6. Outside devcontainers, wheel `Requires-Python` metadata is preferred for interpreter selection; `.python-version` is only a deprecated fallback when wheels do not declare `Requires-Python`.
7. Any `*.whl` and `requirements*.txt` files found in the tag are installed into the build venv.
8. `vscode.set_vscode_python_interpreter()` sends a null-terminated JSON message over `GCUBED_VENV_SOCKET_PATH` to request `set-interpreter`.
9. The VS Code extension receives the request in `vscode-extension/src/unixSocketServer/`, then `handlers/interpreterHandler.js` resolves the path and asks `src/python/environmentSelector.js` to refresh, resolve, and select the interpreter through the active Microsoft API implementation.

## Directory Map

- `src/gcubed_build_switcher/`: Python runtime package and CLI.
- `tests/`: Python unit tests, currently centered on Python provider, wheel metadata, and venv behavior.
- `vscode-extension/src/`: VS Code extension source.
- `vscode-extension/src/python/environmentSelector.js`: adapter seam for Python Environments API selection with legacy fallback.
- `vscode-extension/tests/handlers/` and `vscode-extension/tests/python/`: plain Jest unit tests for interpreter handler and selector behavior.
- `vscode-extension/tests/unixSocketServer/`: Jest socket/protocol tests.
- `vscode-extension/tests/live/`: live socket probe for an installed/running extension.
- `release-files/`: files attached to the GitHub release consumed by devcontainer builds.
- `docs/`: project memory and handoff docs.
- `docs/adr/`: durable architecture decisions when a choice has meaningful tradeoffs.
- `docs/ai/`: temporary agent handoff or investigation notes when useful.

## Important Environment Variables

- `GCUBED_ROOT`: root directory where build-specific venvs and temporary prerequisite clones are created.
- `GCUBED_PYTHON_PREREQUISITES_REPO`: git repo containing build-tagged wheels, requirements files, and optional `.python-version`.
- `GCUBED_CODE_PACKAGE_NAME`: package name used to verify a venv contains the expected G-Cubed library.
- `GCUBED_CODE_AUTO_BUILD_SWITCHER_DISABLED`: when present with any value, disables automatic switching.
- `GCUBED_DEVCONTAINER`: explicit marker that this is a G-Cubed devcontainer. Truthy values make venv creation use ambient Python; `0`, `false`, `no`, and `off` are treated as disabled.
- `DEVCONTAINER`, `REMOTE_CONTAINERS`, `CODESPACES`: additional devcontainer/Codespaces markers recognized by the switcher.
- `GCUBED_VENV_SOCKET_PATH`: Unix socket path shared by Python and the extension, default `/tmp/gcubed_venv_switcher.sock`.
- `GCUBED_VENV_NAME_PREFIX`: venv name prefix, default `venv_gcubed_`.
- `RICH_TRACEBACKS`: when present, `venv.py` writes Rich traceback setup into the target venv's `sitecustomize.py`.
- `UV_LINK_MODE=copy`: configured in the devcontainer so dependencies are copied into generated venvs instead of linked from uv's cache.

## Common Workflows

### Python Development

```bash
python3 -m unittest discover -s tests -v
python -m src.gcubed_build_switcher.cli <build_tag>
```

The CLI command needs real target env vars such as `GCUBED_ROOT`, `GCUBED_PYTHON_PREREQUISITES_REPO`, and `GCUBED_CODE_PACKAGE_NAME`.

### Extension Development

```bash
cd vscode-extension
npm install
npm run build
npm run test:unit
npm run test:socket
npm run package:test
```

### Release

```bash
cd vscode-extension
npm run package:patch
# or npm run package:minor
# or npm run package:major
```

The package scripts build a production VSIX and copy it to `release-files/`. For an actual release, confirm changes are on `main`, create/update the GitHub release tagged `latest`, and attach the `release-files/` payload.

## Ownership Boundaries

- Python owns build tag validation, venv creation, package installation, non-devcontainer Python interpreter acquisition, and IPC client requests.
- The VS Code extension owns socket server lifecycle, request validation, and VS Code interpreter switching.
- The prerequisites repo owns build-tagged wheels, requirements files, and optional deprecated `.python-version` files.
- The prebuilt Python manifest owns available exact CPython archives by platform.
- Release artifacts are generated outputs; do not hand-edit `.vsix` files.

## Maintenance Notes

- Keep the Python side compatible with `requires-python = ">=3.6"` unless the project explicitly raises that floor.
- Preserve ambient-Python venv creation in devcontainers until the devcontainer Python strategy changes.
- Preserve the non-devcontainer Python provider path: wheel `Requires-Python` metadata resolves to the lowest exact matching CPython patch version in the prebuilt manifest, then `uv venv --python <resolved-python>` creates the venv. `.python-version` remains only a deprecated fallback.
- Future Python-provider work should preserve the ability to use `uv pip` for fast package installs even if interpreter acquisition moves elsewhere.
- Python Environments extension support should live in the VS Code extension, not the Python package. The Python package should keep requesting a specific `venv_gcubed_*` interpreter over IPC; the VS Code extension should adapt that request to either `ms-python.vscode-python-envs` or the legacy `ms-python.python` API.
- When enabling the new Python Environments extension in customer devcontainers, use `python-envs.workspaceSearchPaths` for `venv_gcubed_*` discovery and keep `python-envs.terminal.autoActivationType` set to `off` until terminal activation is explicitly validated.
- The Python package shells out to `git` and `uv`; avoid replacing these with heavier abstractions unless there is a clear reliability or coverage win.
- Extension tests exercise handler/selector behavior under `vscode-extension/tests/handlers/` and `vscode-extension/tests/python/`, and socket behavior under `vscode-extension/tests/unixSocketServer/`.
- Extension docs and package metadata describe Unix socket IPC; older HTTP/port examples were removed on 2026-05-27.
