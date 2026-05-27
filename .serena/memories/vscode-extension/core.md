Last checked: 2026-05-27
Source of truth: `docs/01-repo-overview.md`, `docs/02-current-status.md`, `docs/04-next-steps.md`, `docs/ai/python-environments-api-spike.md`, `vscode-extension/src/`, `vscode-extension/tests/`
Update when: extension IPC, interpreter-selection ownership, Microsoft Python API integration, or extension validation commands change.

# VS Code Extension Core

- Extension path: `vscode-extension/`.
- Source path: `vscode-extension/src/`.
- Unix socket server lives under `vscode-extension/src/unixSocketServer/`; it accepts null-terminated UTF-8 JSON and dispatches valid `set-interpreter` requests to an injected request handler.
- Interpreter request orchestration lives in `vscode-extension/src/handlers/interpreterHandler.js`; activation creates one interpreter handler and passes its `switchInterpreter` function to the socket server.
- Environment selection lives behind `vscode-extension/src/python/environmentSelector.js`. Current implementation wraps the legacy `ms-python.python` API; next planned slice adds `ms-python.vscode-python-envs` preference with legacy fallback.
- Python client/server IPC constants must stay aligned with `mem:python/core`.
- Plain Jest unit tests: `vscode-extension/tests/handlers/` and `vscode-extension/tests/python/`; run `npm run test:unit`.
- Socket/protocol tests: `vscode-extension/tests/unixSocketServer/`; run `npm run test:socket`. In this environment, the default sandbox blocks AF_UNIX sockets with `EPERM`, so this suite needs an unsandboxed/escalated shell.
- Live extension probe: `vscode-extension/tests/live/runSocketTests.js`; it requires an installed/running VS Code extension host.
- Known docs drift remains: some extension docs/package metadata still mention older HTTP/port behavior; source code uses Unix sockets.