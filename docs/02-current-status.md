# Current Status

Last updated: 2026-06-03

## Working State

- `VERSION` is the release version source: `2.2.2`.
- Python package version in root `pyproject.toml`: `2.2.2`.
- VS Code extension package version: `2.2.2`.
- `release-files/pyproject.toml` version: `2.2.2` and installs
  `gcubed-build-switcher` from GitHub `main`.
- `scripts/sync-version` synchronizes `VERSION`, root `pyproject.toml`,
  `release-files/pyproject.toml`, `src/gcubed_build_switcher/version.py`,
  `vscode-extension/package.json`, and `vscode-extension/package-lock.json`.
  CI and secure-bundle builds check this before release artifacts are built;
  release/tag builds can validate against `GCUBED_BUILD_SWITCHER_VERSION`, a
  `vX.Y.Z` GitHub ref, or an exact git tag.
- Runtime reporting now prints the Python switcher version whenever the CLI is
  invoked, avoids duplicate version banners during a switch, and displays the
  VS Code Python API id returned by the extension on successful socket switches.
- Python venv creation now always uses wheel `Requires-Python` metadata and
  `uv venv --managed-python --python <request>`, so Python comes from uv's
  managed distribution. `.python-version`, ambient system-Python selection, and
  MSG prebuilt-Python acquisition are no longer used.
- In devcontainer-like environments, the switcher runs
  `uv self update <required-version>` before venv creation. The default required
  uv version is `0.11.18`.
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
- Secure bundle mechanics now exist locally:
  `scripts/build-secure-bundle`, `scripts/obtain-secure-bundle`,
  `scripts/verify-secure-bundle`, and `scripts/install-secure-bundle`.
  The bundle is `gcubed-build-switcher-secure.tar.gz` containing
  `manifest.json`, one wheel, and one VSIX. Verification rejects unsafe tar
  paths, duplicate members, missing/extra files, malformed manifests, and
  hash/size mismatches.
- Devcontainer matrix profiles now include `secure-bundle-legacy` and
  `secure-bundle-python-envs`. The Dockerfile verifies and deploys the VSIX
  during image build so VS Code can install it from the customer-like path; the
  setup script verifies the same bundle before installing the wheel.
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
- On 2026-05-29, `VERSION` became the single release version source for Python,
  extension, runtime fallback, npm lockfile metadata, and release shim metadata.
  The first unified value is `1.2.2`.

## Known Risks / Gaps

- Release behavior is changing deliberately: legacy deployments continue using
  the current release-files shape, while the new bundle path will use one
  intentionally moving secure channel tag such as `latest-secure` until field
  upgrade mechanics are easier. The secure tarball is now self-describing and
  locally validated; publishing/promotion to a curl-reachable secure channel is
  still to be wired.
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
- uv-managed Python support depends on uv's managed Python distribution
  coverage, network/cache state, and successful `uv self update` in
  devcontainer-like environments.

## Last Validation

Most recent validation from the uv-managed Python slice on 2026-06-03:

```bash
python3 -m unittest discover -s tests -v
```

Result:

- Python unit discovery passed, 42 tests.

Previously recorded validation from the runtime reporting and version-sync
slice on 2026-05-29:

```bash
scripts/sync-version --check
GCUBED_BUILD_SWITCHER_VERSION=1.2.2 \
  scripts/sync-version --from-build-env --check
python3 -m py_compile scripts/version_sync.py scripts/secure_bundle.py
python3 -m unittest discover -s tests -v

cd vscode-extension
npm run test:unit
npm run build
npm run package:test
npm run test:socket

cd ..
scripts/build-secure-bundle
scripts/verify-secure-bundle \
  build/secure-bundle/gcubed-build-switcher-secure.tar.gz
git diff --check
```

Result:

- Version metadata check passed at `1.2.2`; the build-env/tag version check
  also passed when driven by `GCUBED_BUILD_SWITCHER_VERSION=1.2.2`.
- Python unit discovery passed, 42 tests.
- Extension unit tests passed, 3 suites / 25 tests.
- Extension build passed.
- `npm run package:test` passed with the version check in the npm packaging
  path.
- `npm run test:socket` passed, 13 tests. Required an escalated/unsandboxed run
  because the default sandbox blocks Unix domain sockets under `/tmp`.
- Secure bundle build produced
  `build/secure-bundle/gcubed-build-switcher-secure.tar.gz`; verification
  reported package `1.2.2` / extension `1.2.2`. The local bundle manifest
  recorded `git.dirty: true` because it was built from this in-progress
  worktree. The first sandboxed build attempt could not resolve isolated Python
  build dependencies; the successful run used escalated/network access.
- `git diff --check` passed.

Gaps:

- No devcontainer was rebuilt from the generated active profile in this slice.
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

- What exact moving secure channel tag name should be used for the new bundle
  path? Working assumption: `latest-secure`.
- Should the stable bundle asset name remain
  `gcubed-build-switcher-secure.tar.gz` and manifest name remain
  `manifest.json` for customer devcontainer templates?
- What repeatable live VS Code/devcontainer smoke path should be documented for
  validating both the legacy and Python Environments API interpreter switchers?
- What date or customer-baseline signal allows removing the legacy
  `ms-python.python` fallback?
