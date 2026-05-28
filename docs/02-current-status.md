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

## Known Risks / Gaps

- Version metadata is still being aligned across root package, extension package,
  release shim, and runtime `__version__`.
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
- Prebuilt Python support depends on manifest reachability, platform coverage,
  archive checksum integrity, and local cache state.

## Last Validation

Most recent validation recorded from this documentation/update slice on
2026-05-28:

```bash
bash -n scripts/build-secure-bundle scripts/obtain-secure-bundle \
  scripts/verify-secure-bundle scripts/install-secure-bundle \
  scripts/devcontainer-profile \
  .devcontainer/gcubed-setup/gcubed-build-switcher-dev-setup.sh
shellcheck scripts/build-secure-bundle scripts/obtain-secure-bundle \
  scripts/verify-secure-bundle scripts/install-secure-bundle \
  scripts/devcontainer-profile \
  .devcontainer/gcubed-setup/gcubed-build-switcher-dev-setup.sh
python3 -m py_compile scripts/secure_bundle.py
python3 -m unittest discover -s tests -v
scripts/build-secure-bundle
scripts/verify-secure-bundle \
  build/secure-bundle/gcubed-build-switcher-secure.tar.gz
scripts/install-secure-bundle \
  build/secure-bundle/gcubed-build-switcher-secure.tar.gz \
  --artifact-dir /tmp/gcubed-secure-bundle-install-check \
  --skip-python-install --sudo never
scripts/obtain-secure-bundle \
  build/secure-bundle/gcubed-build-switcher-secure.tar.gz \
  --output /tmp/gcubed-secure-bundle-obtain-check.tar.gz
scripts/devcontainer-profile render secure-bundle-python-envs \
  --bundle-url https://example.invalid/gcubed-build-switcher-secure.tar.gz \
  | python3 -m json.tool
scripts/devcontainer-profile prepare secure-bundle-legacy \
  --bundle-url https://example.invalid/gcubed-build-switcher-secure.tar.gz
python3 -m json.tool .devcontainer/matrix-active/devcontainer.json

cd vscode-extension
npm run test:unit
npm run build
npm run package:test
npm run test:socket

cd ..
git diff --check
```

Result:

- The wrapper/setup syntax and shellcheck passed.
- Python unit discovery passed, 34 tests.
- Secure bundle build produced
  `build/secure-bundle/gcubed-build-switcher-secure.tar.gz`; validation passed.
  The local bundle manifest recorded `git.dirty: true` because it was built
  from this in-progress worktree. The first sandboxed build attempt could not
  resolve isolated Python build dependencies; the successful run used
  escalated/network access.
- Bundle install with `--skip-python-install` deployed `manifest.json` and
  `gcubed-vscode-venv-switcher.vsix` to a temporary artifact directory.
- Bundle obtain copied and verified the local bundle.
- Generated secure-bundle profile JSON parsed successfully.
- `prepare secure-bundle-legacy` wrote the ignored active profile successfully.
- Extension unit tests passed, 3 suites / 25 tests.
- Extension build passed.
- `npm run package:test` passed after switching VSCE packaging to
  `.vscodeignore` plus `--no-dependencies`.
- `npm run test:socket` passed, 13 tests. Required an escalated/unsandboxed run
  because the default sandbox blocks Unix domain sockets under `/tmp`.
- `git diff --check` passed.

Gaps:

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
- Should the stable bundle asset name remain
  `gcubed-build-switcher-secure.tar.gz` and manifest name remain
  `manifest.json` for customer devcontainer templates?
- What repeatable live VS Code/devcontainer smoke path should be documented for
  validating both the legacy and Python Environments API interpreter switchers?
- What date or customer-baseline signal allows removing the legacy
  `ms-python.python` fallback?
