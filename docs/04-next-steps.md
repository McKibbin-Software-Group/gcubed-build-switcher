# Next Steps

Last updated: 2026-05-27

## Immediate Pickup

1. Decide how versions should line up across root `pyproject.toml`, `vscode-extension/package.json`, `release-files/pyproject.toml`, and `src/gcubed_build_switcher/__init__.py`.
2. Confirm release shim behavior: floating `main` dependency versus pinned release ref.
3. Ensure the customer devcontainer template sets a devcontainer marker such as `GCUBED_DEVCONTAINER=1`, or confirm the target host reliably exposes `DEVCONTAINER`, `REMOTE_CONTAINERS`, or `CODESPACES`.
4. Decide whether to add an explicit `extensionDependencies` entry for `ms-python.vscode-python-envs` after customer/devcontainer baselines are known. Keep the legacy `ms-python.python` fallback for now.
5. Document a repeatable live VS Code/devcontainer smoke path that records the returned `apiId` for both the Python Environments selector and the legacy fallback.
6. When rolling out Python Environments support to customer templates, carry the settings below.

## Python Environments Rollout Settings

Use these settings when the switcher supports `ms-python.vscode-python-envs`
and the customer devcontainer is ready to stop disabling the new extension:

```json
{
  "python.useEnvironmentsExtension": true,
  "python-envs.defaultEnvManager": "ms-python.python:venv",
  "python-envs.workspaceSearchPaths": ["venv_gcubed_*"],
  "python-envs.terminal.autoActivationType": "off",
  "python-envs.alwaysUseUv": true
}
```

Do not use `python-envs.pythonProjects` to model individual
`venv_gcubed_*` build environments. The G-Cubed switcher creates and selects
build-specific venvs dynamically, so the extension should programmatically
resolve and set the requested interpreter. `python-envs.pythonProjects` is only
useful if a customer workspace needs explicit stable Python project mappings.

`python-envs.workspaceSearchPaths` is still useful as a fallback so generated
`venv_gcubed_*` environments appear in the Python Environments UI and manual
selection flows. Auto-discovery is not the primary switching mechanism.

Keep terminal auto-activation set to `off` for the first rollout. The switcher
changes the selected interpreter explicitly; terminal startup mutation should
not be introduced until it has a clear user benefit and has been tested in the
customer devcontainer shell.

## Validation To Run

```bash
python3 -m unittest discover -s tests -v

cd vscode-extension
npm run test:unit
npm run build
npm run test:socket
npm run package:test
```

For a release or runtime change, also run a configured smoke test:

```bash
python -m src.gcubed_build_switcher.cli <build_tag>
node vscode-extension/tests/live/runSocketTests.js
```

## Context Needed Before Starting

- Target customer devcontainer assumptions: user IDs, socket permissions, available Python extension, and network access.
- Devcontainer runtime marker guaranteed by the customer template or host.
- Whether the customer devcontainer should install `ms-python.vscode-python-envs` explicitly or rely on the Python extension's rollout path.
- Expected versioning policy for Python package, VS Code extension, release shim, and generated artifacts.
- Whether release assets should float to `main` or pin to immutable refs.
- A real prerequisites repo tag for CLI/end-to-end smoke testing.

## Blockers

- No docs blocker remains after the baseline setup.
- Extension socket tests require an execution environment that permits Unix domain sockets; the default sandbox returns `EPERM` for AF_UNIX socket creation, so run them unsandboxed/escalated.
- Further customer-like end-to-end validation still needs a configured target devcontainer and real build tag.

## Good Stopping Point

The next useful stopping point is a repo where Python tests pass, extension build passes, socket tests run cleanly in plain Jest, and release/version ownership is documented before packaging.
