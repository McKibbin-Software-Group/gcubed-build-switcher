# Tech Stack

- Python package supports `requires-python = ">=3.6"`; preserve this floor unless the project explicitly raises it.
- Python tests use stdlib `unittest`.
- Runtime shells out to `git` and `uv`; prefer the existing command-based flow over heavier abstractions unless there is a clear reliability/coverage win.
- Package metadata/version sources currently exist in root `pyproject.toml`, `src/gcubed_build_switcher/__init__.py`, `vscode-extension/package.json`, and `release-files/pyproject.toml`; version ownership is unresolved.
- VS Code extension uses Node/npm/Jest and the Microsoft Python extension API.
- IPC is null-terminated UTF-8 JSON over a Unix domain socket; default socket path is `/tmp/gcubed_venv_switcher.sock` via `GCUBED_VENV_SOCKET_PATH`.
- Important env vars are documented in `docs/01-repo-overview.md`; avoid printing token values or sensitive config contents.