# Current Status

Last updated: 2026-05-28

## Working State

- Python package version in root `pyproject.toml`: `1.1.4`.
- VS Code extension package version: `1.1.2`.
- `release-files/pyproject.toml` version: `1.2.2` and installs
  `gcubed-build-switcher` from GitHub `main`.
- Runtime version work is in progress locally:
  `src/gcubed_build_switcher/version.py`,
  `src/gcubed_build_switcher/__init__.py`, and
  `tests/test_runtime_version.py` are currently changed/untracked.
- In devcontainers, Python venv creation uses the ambient Python and skips wheel
  `Requires-Python`/`.python-version` interpreter acquisition. Outside
  devcontainers, it still prefers wheel `Requires-Python` metadata, resolves the
  lowest matching exact CPython patch version from the prebuilt manifest, and
  only uses `.python-version` as a deprecated fallback.
- Generated build venvs install `gcubed-build-switcher` and `rich` so scripts
  can continue importing the switcher after VS Code changes interpreter.
- Python and extension IPC use null-terminated UTF-8 JSON over a Unix domain
  socket. Compatibility tests cover the stable Python-to-extension payload and
  both old and new extension response shapes.
- The VS Code extension has an environment-selection adapter in
  `vscode-extension/src/python/environmentSelector.js`. The adapter prefers
  `ms-python.vscode-python-envs`, verifies selection with `getEnvironment(scope)`,
  and falls back to the legacy `ms-python.python` API when the new extension is
  missing, disabled, or unable to select the requested interpreter.
- Devcontainer matrix configs exist for legacy Python extension mode and Python
  Environments mode.
- `scripts/devcontainer-profile` can generate an ignored active devcontainer
  profile at `.devcontainer/matrix-active/devcontainer.json` with the chosen
  Python artifact, VSIX artifact, and Python extension mode baked in.
- GitHub automation files currently present:
  - `.github/dependabot.yml`
  - `.github/workflows/ci.yml`
  - `.github/workflows/codeql.yml`
- Root `AGENTS.md` is intentionally lean and serves as repo-local agent
  guardrails; durable project facts live in `docs/`.

## Recent Scan Notes

- `docs/` was missing before the project-memory setup.
- `AGENTS.md` was rewritten as a concise guardrail file on 2026-05-21; runtime
  flow, environment variables, maintenance notes, and release behavior now live
  in `docs/01-repo-overview.md`.
- On 2026-05-27, the Python Environments spike introduced the extension-owned
  selector adapter, optional `ms-python.vscode-python-envs` support, fallback to
  `ms-python.python`, and activation-time diagnostics for rollout settings.
- On 2026-05-27, live smoke validation confirmed the new selector path: the
  switch response returned `apiId: "ms-python.vscode-python-envs"` for a
  generated `venv_gcubed_smoke_*` interpreter.
- On 2026-05-28, the devcontainer migration matrix gained the
  `scripts/devcontainer-profile` wrapper and generated active profile workflow.
- On 2026-05-28, compatibility tests confirmed the IPC payload remains stable
  across old/new Python and VSIX combinations at the socket contract level.
- On 2026-05-28, roadmap/next-step docs were updated around soft migration,
  paired wheel/VSIX releases, and GitHub security automation.

## Known Risks / Gaps

- Version metadata is still being aligned across root package, extension package,
  release shim, and runtime `__version__`.
- Release behavior is changing deliberately: legacy deployments continue using
  the current release-files shape, while the new bundle path will use one
  intentionally moving secure channel tag such as `latest-secure` until field
  upgrade mechanics are easier.
- A Dependency Review workflow is not present yet.
- GitHub settings still need final verification after the branch lands:
  Dependency Graph, Dependabot alerts, Dependabot security updates, automatic
  fix PRs, secret scanning, push protection, and branch protection.
- Extension socket tests need an execution environment that permits Unix domain
  sockets. The default sandbox returns `EPERM` for AF_UNIX socket creation, so
  `npm run test:socket` must be run unsandboxed/escalated here.
- Repeatable live end-to-end validation still needs a documented configured
  devcontainer or VS Code host with the Microsoft Python extensions available.
- The Python Environments selector currently uses the first workspace folder as
  the project scope. That matches the existing path-resolution behavior but
  still needs live multi-root/devcontainer validation.
- `SERVER_SOCKET_MODE = 0o666` should be confirmed as acceptable for the target
  devcontainer security model.
- Prebuilt Python support depends on manifest reachability, platform coverage,
  archive checksum integrity, and local cache state.

## Last Validation

Most recent validation recorded from this documentation/update slice on
2026-05-28:

```bash
bash -n scripts/devcontainer-profile
shellcheck scripts/devcontainer-profile
scripts/devcontainer-profile list
scripts/devcontainer-profile show legacy-baseline
scripts/devcontainer-profile render new-python-new-vsix-python-envs \
  --python-url https://example.invalid/gcubed_build_switcher-1.2.3-py3-none-any.whl \
  --vsix-url https://example.invalid/gcubed-vscode-venv-switcher.vsix | python3 -m json.tool
scripts/devcontainer-profile prepare legacy-baseline
python3 -m json.tool .devcontainer/matrix-active/devcontainer.json
git diff --check
```

Result:

- The wrapper syntax and shellcheck passed.
- Profile listing and summary commands passed.
- Generated profile JSON parsed successfully.
- `prepare legacy-baseline` wrote the ignored active profile successfully.
- `git diff --check` passed.

Gaps:

- Python unit tests and extension npm tests were not rerun for this docs/wrapper
  slice.
- No devcontainer was rebuilt from the generated active profile.
- No live switcher smoke test was run because it requires a configured target
  devcontainer and real build tag.

Previously recorded compatibility validation on 2026-05-28:

```bash
python3 -m unittest discover -s tests -v

cd vscode-extension
npm run test:socket
```

Result:

- Python unit discovery: passed, 25 tests.
- `npm run test:socket`: passed, 13 tests. Required an
  escalated/unsandboxed run because the default sandbox blocks Unix domain
  sockets under `/tmp`.

Earlier validation on 2026-05-27 after the Python Environments selector slice:

```bash
cd vscode-extension
npm run test:unit
npm run build
npm run test:socket

cd ..
python3 -m unittest discover -s tests -v
```

Result:

- `npm run test:unit`: passed, 2 suites / 19 tests.
- `npm run build`: passed.
- `npm run test:socket`: passed, 5 suites / 11 tests. Required an
  escalated/unsandboxed run because the default sandbox blocks Unix domain
  sockets under `/tmp`.
- Python unit discovery: passed, 22 tests.

## Open Questions

- Which version source should be authoritative for releases?
- What exact moving secure channel tag name should be used for the new bundle
  path? Working assumption: `latest-secure`.
- What exact release asset names should be treated as stable by customer
  devcontainer templates?
- What repeatable live VS Code/devcontainer smoke path should be documented for
  validating both the legacy and Python Environments API interpreter switchers?
- What date or customer-baseline signal allows removing the legacy
  `ms-python.python` fallback?
