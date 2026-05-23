# VS Code Extension Core

- Extension path: `vscode-extension/`.
- Source path: `vscode-extension/src/`; Unix socket server lives under `vscode-extension/src/unixSocketServer/`.
- Runtime role: start local Unix domain socket server, parse one null-terminated UTF-8 JSON request per connection, dispatch `set-interpreter`, and use the Microsoft Python extension API to refresh/resolve/select the requested interpreter.
- Socket tests live in `vscode-extension/tests/unixSocketServer/`; live extension probe lives in `vscode-extension/tests/live/`.
- Known docs/test drift: some extension docs/package metadata still mention older HTTP/port behavior; `npm run test:http` references missing old test paths. Current source uses Unix sockets.
- Known validation gap: socket Jest tests currently fail to load without a Jest-safe `vscode` mock or protocol/handler separation.
- Keep IPC protocol aligned with `mem:python/core`; Python client sends the request, extension owns server lifecycle and VS Code interpreter switching.