# Current Status

Last updated: 2026-05-21

## Working State

- Python package version in root `pyproject.toml`: `1.1.4`.
- VS Code extension package version: `1.1.2`.
- `release-files/pyproject.toml` version: `1.2.2` and installs `gcubed-build-switcher` from GitHub `main`.
- Python venv creation currently prefers wheel `Requires-Python` metadata, resolves the lowest matching exact CPython patch version from the prebuilt manifest, and only uses `.python-version` as a deprecated fallback.
- Generated build venvs install `gcubed-build-switcher` and `rich` so scripts can continue importing the switcher after VS Code changes interpreter.
- Python and extension IPC use null-terminated UTF-8 JSON over a Unix domain socket.
- Root `AGENTS.md` is current enough to serve as the repo-local agent instruction source.

## Recent Scan Notes

- `docs/` was missing before this project-memory setup.
- Initial `git status --short` showed only untracked `.agents/` and `skills-lock.json`.
- `vscode-extension/node_modules/`, `dist/`, `production/`, and `test/` are present locally.
- `vscode-extension/package.json` still describes "local HTTP requests" even though the source uses Unix sockets.
- `vscode-extension/README-extension-developer.md` still contains older HTTP/port examples and stale package command names.
- `npm run test:http` references `tests/httpServer/jest.config.js`, but no matching test directory was found in the repo scan.

## Known Risks / Gaps

- Version metadata is inconsistent across root package, extension package, release shim, and `src/gcubed_build_switcher/__init__.py`.
- Extension socket tests currently cannot load because Jest cannot resolve the VS Code host module.
- Live end-to-end validation still requires a configured devcontainer or VS Code host with the Microsoft Python extension available.
- Release behavior should be clarified: the release shim currently installs from GitHub `main`, not a pinned release tag or commit.
- `SERVER_SOCKET_MODE = 0o666` should be confirmed as acceptable for the target devcontainer security model.
- Prebuilt Python support depends on manifest reachability, platform coverage, archive checksum integrity, and local cache state.

## Last Validation

- Date: 2026-05-21
- Commands run:

```bash
python3 -m unittest discover -s tests -v

cd vscode-extension
npm run build
npm run test:socket
```

- Result:
  - Python unit tests passed: 20 tests.
  - Extension build passed and produced `dist/extension.js`.
  - Extension socket tests failed before executing tests: `Cannot find module 'vscode'` from `src/handlers/interpreterHandler.js`.
- Gaps:
  - No CLI smoke test was run because it requires real G-Cubed environment variables, prerequisite repo access, and a build tag.
  - No live VS Code interpreter-switch validation was run.

## Open Questions

- Which version source should be authoritative for releases?
- Should the release shim continue floating to GitHub `main`, or pin to a release tag/commit?
- Should stale HTTP docs/scripts be removed or updated to Unix socket terminology?
- Should Jest mock `vscode` for socket tests, or should socket tests avoid importing the interpreter handler directly?
