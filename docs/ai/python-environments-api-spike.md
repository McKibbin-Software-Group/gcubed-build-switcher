# Python Environments API Spike

Date: 2026-05-27

## Purpose

Update the VS Code extension so the G-Cubed switcher works with Microsoft's
new Python Environments extension while keeping the existing Python extension
API path as a fallback.

The Python package should continue to create or verify
`venv_gcubed_<build_tag>` environments and send an IPC request containing the
exact interpreter path. The VS Code extension should own editor integration:
resolving that interpreter, selecting it in VS Code, and monitoring whether
the customer devcontainer settings are compatible (this includes offering
to reset the settings should they change / become incompatible).

## Current Behavior

- Python creates build-specific venvs under `GCUBED_ROOT` using the
  `venv_gcubed_*` naming pattern.
- Python sends `{ "action": "set-interpreter", "pythonPath": "...",
  "shortName": "..." }` over the Unix socket.
- The VS Code extension currently depends on `@vscode/python-extension` and
  uses the legacy `ms-python.python` API:
  - `PythonExtension.api()`
  - `environments.refreshEnvironments({ forceRefresh })`
  - `environments.resolveEnvironment(path)`
  - `environments.updateActiveEnvironmentPath(path)`
- Customer devcontainers currently disable the new environment extension with
  `python.useEnvironmentsExtension: false`.

## Target Behavior

1. Prefer `ms-python.vscode-python-envs` when available and enabled.
2. Resolve the requested `pythonPath` as a Python Environments API
   environment.
3. Select the resolved environment for the active workspace scope.
4. Fall back to the current `ms-python.python` API when the new extension is
   unavailable, disabled, or unable to resolve/select the interpreter.
5. Keep the Python package unaware of VS Code settings and API details.
6. Warn from the VS Code extension when expected customer devcontainer settings
   are missing or incompatible.
7. Keep the top-level repository and package layout stable. The spike may
   refactor modules inside `vscode-extension/src`, but it should not move the
   Python package, VS Code extension package, or release payload directories.

## Rollout Settings

When the new path has passed live devcontainer validation, update the customer
devcontainer configuration with the correct VS Code setting scopes.

Put the workspace/window settings in `.vscode/settings.json`:

```json
{
  "python.useEnvironmentsExtension": true,
  "python-envs.defaultEnvManager": "ms-python.python:venv",
  "python-envs.workspaceSearchPaths": ["venv_gcubed_*"]
}
```

Put the Python Environments machine-scoped settings in the devcontainer's
`customizations.vscode.settings` block, not `.vscode/settings.json`:

```json
{
  "python-envs.terminal.autoActivationType": "off",
  "python-envs.alwaysUseUv": true
}
```

VS Code greys out machine-scoped settings when they are placed in workspace
settings, and they may not be applied there. `alwaysUseUv` currently defaults
to `true`, but keeping it explicit in the devcontainer documents the intended
Python Environments manager behavior.

Do not use `python-envs.pythonProjects` to model individual G-Cubed build
venvs. Those environments are selected dynamically by build tag. Use
`workspaceSearchPaths` only as a discovery/manual-selection fallback.

## Implementation Todos

1. Introduce an environment-selection adapter in the VS Code extension.
   - Done 2026-05-27: `vscode-extension/src/python/environmentSelector.js`
     wraps the current legacy API behind `selectInterpreter(...)`,
     `validateStartingInterpreter()`, known-environment formatting, and
     fallback path extraction.
   - IPC request and response shape stayed stable.

2. Add a Python Environments implementation.
   - Done 2026-05-27: the selector optionally activates
     `ms-python.vscode-python-envs` and reads its exported API.
   - Confirmed against upstream `src/api.ts`: use
     `resolveEnvironment(vscode.Uri.file(path))`, select with
     `setEnvironment(scope, environment)`, verify with
     `getEnvironment(scope)`, and compare `execInfo.run.executable` to the
     requested interpreter path.
   - Missing/disabled/incompatible Python Environments API falls back to the
     legacy selector.

3. Preserve the legacy implementation.
   - Done 2026-05-27: current `@vscode/python-extension` calls moved behind
     the selector adapter.
   - `updateActiveEnvironmentPath(path)` fallback behavior is preserved.
   - Startup validation still works through the adapter and can be simplified
     after the new API path is live-tested.

4. Make settings monitoring extension-owned.
   - On activation, read workspace settings with VS Code configuration APIs.
   - Warn if `python.useEnvironmentsExtension` is disabled after the new path
     is released.
   - Warn if `python-envs.workspaceSearchPaths` does not include
     `venv_gcubed_*`.
   - Warn if `python-envs.terminal.autoActivationType` is not `off`.
   - Do not silently mutate `.vscode/settings.json` during normal activation.
     If useful, offer an explicit user/operator action to apply or reset the
     recommended settings.

5. Install/dependency decisions.
   - Decide whether the customer devcontainer installs
     `ms-python.vscode-python-envs` explicitly.
   - Current slice handles missing extension errors clearly and keeps the
     dependency optional. Reconsider an `extensionDependencies` entry only after
     devcontainer VS Code/Python extension baselines are known.
   - Keep `ms-python.python` available while the fallback path exists.

6. Fix the socket test harness first.
   - Done 2026-05-27: the socket server accepts an injected request handler.
     Production passes `switchInterpreter`; socket tests inject a fake handler
     and no longer import VS Code-dependent modules.
   - `npm run test:socket` now passes outside the sandbox. The default sandbox
     blocks AF_UNIX socket creation with `EPERM`, so this validation must run
     in an unsandboxed/escalated shell here.

7. Add focused tests.
   - Done 2026-05-27: legacy selector flow and interpreter-handler delegation
     have plain Jest unit coverage under `vscode-extension/tests/python/` and
     `vscode-extension/tests/handlers/`.
   - Done 2026-05-27: Python Environments happy path, resolution failure,
     selected-environment mismatch, extension-missing fallback, and mixed
     environment-shape extraction have focused unit coverage.
   - Done 2026-05-27: rollout settings diagnostics have focused unit coverage
     without writing workspace settings.
   - Keep socket protocol tests focused on null-terminated JSON framing,
     validation, response handling, timeout, and concurrency.
   - Add a live smoke script for a VS Code/devcontainer host with both
     Microsoft extensions installed.

8. Update docs and release artifacts.
   - Done 2026-05-27: stale HTTP wording was removed from extension developer
     docs and package metadata; the dead `test:http` script was dropped.
   - Update customer devcontainer settings when the spike is proven.
   - Document the fallback/removal policy for the legacy API.

## Layout Constraint

Do not change the top-level repository layout as part of this spike:

```text
src/gcubed_build_switcher/
vscode-extension/
release-files/
```

Those directories map to separate deliverables and release mechanics. Moving
them would touch Python packaging, npm scripts, VSIX build output,
release-file copying, docs, and customer devcontainer assumptions for little
near-term benefit.

Limit structural changes to `vscode-extension/src`, where the current coupling
between the socket server and VS Code/Python APIs blocks plain Jest testing.

## Suggested Extension Code Shape

Keep the socket server separate from interpreter selection:

```text
vscode-extension/src/unixSocketServer/
  socketServerManager.js
  socketClientHandler.js

vscode-extension/src/python/
  environmentSelector.js
  pythonEnvsExtension.js
  legacyPythonExtension.js
  settingsDiagnostics.js
```

`socketClientHandler` should depend on a passed-in selector or a narrow module
that has no direct test-time dependency on the VS Code host. That keeps socket
tests boring and lets API-specific tests mock the two Microsoft extensions.

## Extension Review Findings

### Resolved In First Slice

- `npm run test:socket` can now load and pass because socket protocol handling
  no longer imports `interpreterHandler.js` or the VS Code host module.
- The stale injectable echo-server test harness has been realigned around the
  current `set-interpreter` socket protocol.
- `interpreterHandler.js` now depends on the environment selector adapter
  instead of directly orchestrating legacy Python extension API calls.
- The startup fallback no longer assumes only `venv.internal.path`; fallback
  path extraction is normalized behind the adapter.
- The selector now prefers `ms-python.vscode-python-envs` and falls back to
  `ms-python.python`. It verifies the new API path by reading
  `getEnvironment(scope)` after `setEnvironment(scope, env)`.

### Medium

- `setValidStartingInterpreter()` blocks extension activation for about 15
  seconds before validating Python state. That delays readiness of the switcher
  socket path and can make startup behavior feel brittle in remote containers.
- The selector currently derives Python Environments scope from the first
  workspace folder, matching existing relative path behavior. Multi-root and
  `GCUBED_ROOT` outside the first workspace need live validation.
- Extension package metadata and developer docs now describe Unix socket IPC.

### Low

- `SERVER_SOCKET_MODE = 0o666` should be reviewed against the target
  devcontainer user/security model before release.
- Socket request validation only checks that `pythonPath` is present before
  calling `switchInterpreter`; deeper type/empty-string validation happens
  later. Keep one canonical validation boundary when refactoring.
- The extension shows multiple information messages during normal activation
  and switching. Consider reducing startup notifications once live validation
  is stable.

## Validation Plan

Run these before implementing API changes:

```bash
python3 -m unittest discover -s tests -v

cd vscode-extension
npm run build
npm run test:socket
```

For the live spike, use a real devcontainer with:

- `ms-python.python`
- `ms-python.vscode-python-envs`
- `python.useEnvironmentsExtension: true`
- `python-envs.workspaceSearchPaths: ["venv_gcubed_*"]`
- `python-envs.terminal.autoActivationType: "off"`

Then run a configured build-switch smoke test and confirm:

- requested `venv_gcubed_*` is created or verified;
- socket request succeeds;
- VS Code's selected environment changes to the requested interpreter;
- the environment appears in the Python Environments UI;
- opening a terminal does not auto-activate or mutate shell startup files.

## Open Questions

- Should the devcontainer install `ms-python.vscode-python-envs` explicitly, or
  rely on Microsoft's rollout through `ms-python.python`?
- Should the extension offer an explicit command to apply recommended settings,
  or only warn and document?
- What date or validation signal allows removal of the legacy
  `ms-python.python` API fallback?
- Is `0o666` socket mode intentional for all customer devcontainers?
