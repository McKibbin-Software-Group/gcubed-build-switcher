# Repo Overview

## Purpose

This repo ships the G-Cubed build switcher used by customer devcontainers. It lets model scripts request a G-Cubed Code build tag and get a matching Python environment plus VS Code interpreter selection without the user manually rebuilding or selecting venvs.

## Architecture

- Python package: `src/gcubed_build_switcher/`
  - `cli.py` exposes `gcubed-switch <build_tag>`.
  - `__init__.py` exposes `activate_or_build_and_activate_venv(build_tag)` and honors `GCUBED_CODE_AUTO_BUILD_SWITCHER_DISABLED`.
  - `venv.py` validates build tags, creates/verifies `${GCUBED_ROOT}/venv_gcubed_<build_tag>`, installs wheels/requirements from a temporary prerequisites clone, installs runtime support packages into generated venvs, and configures optional Rich tracebacks. It always creates build venvs with uv-managed Python.
  - `wheel_metadata.py` reads wheel `Requires-Python` metadata.
  - `python_provider.py` reduces wheel `Requires-Python` metadata to a uv Python request such as `3.13.11` or `3.13`.
  - `uv_runtime.py` updates uv to the configured required version in devcontainer-like environments before managed-Python venv creation.
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
5. Wheel `Requires-Python` metadata is reduced to a uv Python request. Missing, invalid, or ambiguous metadata fails loudly.
6. In devcontainer-like environments, `uv_runtime.py` runs `uv self update <required-version>` before venv creation. The default required uv version is `0.11.18`.
7. `venv.create_venv_for_build()` runs `uv venv --managed-python --python <request> <venv_name>` so Python comes from uv's managed distribution, not the ambient system Python or an MSG archive.
8. Any `*.whl` and `requirements*.txt` files found in the tag are installed into the build venv.
9. `vscode.set_vscode_python_interpreter()` sends a null-terminated JSON message over `GCUBED_VENV_SOCKET_PATH` to request `set-interpreter`.
10. The VS Code extension receives the request in `vscode-extension/src/unixSocketServer/`, then `handlers/interpreterHandler.js` resolves the path and asks `src/python/environmentSelector.js` to refresh, resolve, and select the interpreter through the active Microsoft API implementation.

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
- `GCUBED_PYTHON_PREREQUISITES_REPO`: git repo containing build-tagged wheels and requirements files.
- `GCUBED_CODE_PACKAGE_NAME`: package name used to verify a venv contains the expected G-Cubed library.
- `GCUBED_CODE_AUTO_BUILD_SWITCHER_DISABLED`: when present with any value, disables automatic switching.
- `GCUBED_DEVCONTAINER`: explicit marker that this is a G-Cubed devcontainer. Truthy values make the switcher update uv before venv creation; `0`, `false`, `no`, and `off` are treated as disabled.
- `DEVCONTAINER`, `REMOTE_CONTAINERS`, `CODESPACES`: additional devcontainer/Codespaces markers recognized by the switcher.
- `GCUBED_REQUIRED_UV_VERSION`: optional override for the uv version used by devcontainer-like environments. Default: `0.11.18`.
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
scripts/sync-version --check
scripts/build-secure-bundle
scripts/verify-secure-bundle build/secure-bundle/gcubed-build-switcher-secure.tar.gz

cd vscode-extension
npm run package:legacy
# or, when bumping as part of packaging:
npm run package:patch
# or npm run package:minor
# or npm run package:major
```

`VERSION` is the release version source for the Python package, VS Code
extension, runtime fallback, npm lockfile metadata, and release shim. Use
`scripts/sync-version --bump patch|minor|major` for release bumps, or
`scripts/sync-version --from-build-env --check` when a release build is driven
by `GCUBED_BUILD_SWITCHER_VERSION`, a `vX.Y.Z` GitHub ref, or an exact git tag.
The secure bundle scripts check this metadata before building the wheel and
VSIX together, write `manifest.json`, verify hashes/sizes, and produce
`build/secure-bundle/gcubed-build-switcher-secure.tar.gz`. The legacy package
scripts still build a production VSIX and copy it to `release-files/`. During
the soft migration, publish both the old release-files payload and the new
secure bundle.

## Ownership Boundaries

- Python owns build tag validation, uv-managed venv creation, package installation, devcontainer uv self-update, and IPC client requests.
- The VS Code extension owns socket server lifecycle, request validation, and VS Code interpreter switching.
- The prerequisites repo owns build-tagged wheels, requirements files, and wheel `Requires-Python` metadata.
- uv owns managed Python acquisition from Astral's Python distribution.
- Release artifacts are generated outputs; do not hand-edit `.vsix` files.

## Maintenance Notes

- Keep the Python side compatible with `requires-python = ">=3.6"` unless the project explicitly raises that floor.
- Preserve uv-managed Python venv creation unless the Python strategy changes explicitly. Do not reintroduce `.python-version`, ambient system-Python selection, or MSG prebuilt-Python acquisition.
- Future Python-provider work should keep the provider as a lightweight resolver from wheel `Requires-Python` metadata to uv Python requests; uv should own downloading/installing Python.
- Python Environments extension support should live in the VS Code extension, not the Python package. The Python package should keep requesting a specific `venv_gcubed_*` interpreter over IPC; the VS Code extension should adapt that request to either `ms-python.vscode-python-envs` or the legacy `ms-python.python` API.
- When enabling the new Python Environments extension in customer
  devcontainers, put `python.useEnvironmentsExtension`,
  `python-envs.defaultEnvManager`, and `python-envs.workspaceSearchPaths` in
  `.vscode/settings.json`; put machine-scoped
  `python-envs.terminal.autoActivationType` and `python-envs.alwaysUseUv` in
  the devcontainer `customizations.vscode.settings` block. Use
  `python-envs.workspaceSearchPaths` for `venv_gcubed_*` discovery and keep
  `python-envs.terminal.autoActivationType` set to `off` until terminal
  activation is explicitly validated.
- The Python package shells out to `git` and `uv`; avoid replacing these with heavier abstractions unless there is a clear reliability or coverage win.
- Extension tests exercise handler/selector behavior under `vscode-extension/tests/handlers/` and `vscode-extension/tests/python/`, and socket behavior under `vscode-extension/tests/unixSocketServer/`.
- Extension docs and package metadata describe Unix socket IPC; older HTTP/port examples were removed on 2026-05-27.
