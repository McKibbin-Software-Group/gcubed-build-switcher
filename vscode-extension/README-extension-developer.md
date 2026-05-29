# G-Cubed VS Code Python venv switcher

This extension is the VS Code half of the G-Cubed build switcher. The Python package creates or verifies a build-specific venv, then sends a local Unix socket request so this extension can select the matching VS Code Python interpreter.

## Development

Start in a devcontainer, then install extension dependencies:

```bash
npm install
```

Run the fast extension checks:

```bash
npm run test:unit
npm run build
npm run test:socket
```

`npm run test:socket` needs an environment that permits Unix domain sockets under `/tmp`; the default agent sandbox may block that with `EPERM`.

## Package And Install

Create an unminified test VSIX:

```bash
npm run package:test
code --install-extension test/gcubed-vscode-venv-switcher-test.version.vsix
```

Then run `Developer: Reload Window` in VS Code.

Build the legacy production VSIX without changing the version:

```bash
npm run package:legacy
```

This checks version metadata, builds a production VSIX, and copies it to
`../release-files/`.

Production package scripts can also bump the shared version by release type:

```bash
npm run package:patch
npm run package:minor
npm run package:major
```

These scripts call `../scripts/sync-version --bump <part>` before packaging, so
the VSIX version stays aligned with the Python package, runtime fallback,
release shim, and `VERSION`. They write a production VSIX and copy it to
`../release-files/`.

## Runtime IPC

The extension listens on a Unix domain socket, not an HTTP port. The default socket path is `/tmp/gcubed_venv_switcher.sock`; override it with `GCUBED_VENV_SOCKET_PATH` if needed.

Requests are null-terminated UTF-8 JSON. The interpreter switch request shape is:

```json
{
  "action": "set-interpreter",
  "pythonPath": "venv_gcubed_c_0002/bin/python"
}
```

Relative paths are resolved against the first VS Code workspace folder. Absolute interpreter paths are also accepted.

## Live Smoke Test

With VS Code open and this extension active, run:

```bash
node tests/live/runSocketTests.js
```

For the full Python-to-extension path, run a configured build switcher smoke test from the repo root:

```bash
python -m src.gcubed_build_switcher.cli <build_tag>
```

A successful Python Environments API switch returns `apiId: "ms-python.vscode-python-envs"`. A legacy fallback switch returns `apiId: "ms-python.python"`.

## Devcontainer Settings

For Python Environments rollout validation, keep these settings in the target devcontainer or workspace:

```json
{
  "python.useEnvironmentsExtension": true,
  "python-envs.defaultEnvManager": "ms-python.python:venv",
  "python-envs.workspaceSearchPaths": ["venv_gcubed_*"],
  "python-envs.terminal.autoActivationType": "off",
  "python-envs.alwaysUseUv": true
}
```

The extension warns when the key rollout settings are missing or mismatched. It does not edit workspace settings automatically.
