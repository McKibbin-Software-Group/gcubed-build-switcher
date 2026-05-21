# Repo Overview

## Purpose

This repo ships the G-Cubed build switcher used by customer devcontainers. It lets model scripts request a G-Cubed Code build tag and get a matching Python environment plus VS Code interpreter selection without the user manually rebuilding or selecting venvs.

## Architecture

- Python package: `src/gcubed_build_switcher/`
  - `cli.py` exposes `gcubed-switch <build_tag>`.
  - `__init__.py` exposes `activate_or_build_and_activate_venv(build_tag)` and honors `GCUBED_CODE_AUTO_BUILD_SWITCHER_DISABLED`.
  - `venv.py` validates build tags, creates/verifies `${GCUBED_ROOT}/venv_gcubed_<build_tag>`, installs wheels/requirements from a temporary prerequisites clone, installs runtime support packages into generated venvs, and configures optional Rich tracebacks.
  - `wheel_metadata.py` reads wheel `Requires-Python` metadata. Venv creation prefers this metadata over `.python-version`.
  - `python_provider.py` resolves exact CPython patch versions through cache, explicit path handling, system Python, or prebuilt manifest/archive download with checksum and safe extraction.
  - `vscode.py` sends null-terminated JSON over `GCUBED_VENV_SOCKET_PATH` to request `set-interpreter`.
- VS Code extension: `vscode-extension/`
  - Starts a Unix domain socket server on startup.
  - Parses one null-terminated JSON request per connection.
  - Uses the Microsoft Python extension API to refresh, resolve, and switch interpreters.
- Release payload: `release-files/`
  - Contains artifacts consumed by the G-Cubed devcontainer template from the GitHub `latest` release.

## Directory Map

- `src/gcubed_build_switcher/`: Python runtime package and CLI.
- `tests/`: Python unit tests, currently centered on Python provider, wheel metadata, and venv behavior.
- `vscode-extension/src/`: VS Code extension source.
- `vscode-extension/tests/unixSocketServer/`: Jest socket/protocol tests.
- `vscode-extension/tests/live/`: live socket probe for an installed/running extension.
- `release-files/`: files attached to the GitHub release consumed by devcontainer builds.
- `docs/`: project memory and handoff docs.
- `docs/adr/`: durable architecture decisions when a choice has meaningful tradeoffs.
- `docs/ai/`: temporary agent handoff or investigation notes when useful.

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

- Python owns build tag validation, venv creation, package installation, Python interpreter acquisition, and IPC client requests.
- The VS Code extension owns socket server lifecycle, request validation, and VS Code interpreter switching.
- The prerequisites repo owns build-tagged wheels, requirements files, and optional deprecated `.python-version` files.
- The prebuilt Python manifest owns available exact CPython archives by platform.
- Release artifacts are generated outputs; do not hand-edit `.vsix` files.
