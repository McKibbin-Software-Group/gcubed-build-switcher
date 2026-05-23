# Python Core

- Package path: `src/gcubed_build_switcher/`.
- Public entrypoints: `cli.py` exposes `gcubed-switch <build_tag>`; `__init__.py` exposes `activate_or_build_and_activate_venv(build_tag)` and honors `GCUBED_CODE_AUTO_BUILD_SWITCHER_DISABLED`.
- Main flow: validate build tag, prepare `${GCUBED_ROOT}/venv_gcubed_<build_tag>`, install tagged wheel/requirements artifacts from `GCUBED_PYTHON_PREREQUISITES_REPO`, then request VS Code interpreter switch via `vscode.py`.
- Devcontainer behavior: new venvs use ambient container Python; preserve this unless the devcontainer Python strategy changes.
- Non-devcontainer behavior: interpreter selection uses wheel `Requires-Python` metadata first, then deprecated `.python-version` fallback; `python_provider.py` handles exact CPython resolution/cache/download/checksum/safe extraction.
- Generated build venvs install `gcubed-build-switcher` and `rich` so scripts can still import runtime support after VS Code switches interpreter.
- Tests live in `tests/`; current unit coverage centers on Python provider, wheel metadata, and venv behavior.
- Python/extension IPC contract: null-terminated UTF-8 JSON over Unix domain socket; keep constants and protocol in sync with `mem:vscode-extension/core`.