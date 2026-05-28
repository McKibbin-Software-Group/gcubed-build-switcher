# Next Steps

Last updated: 2026-05-28

## Immediate Pickup

1. Add a GitHub Dependency Review workflow for pull requests.
2. Confirm GitHub repository settings:
   - Dependency Graph enabled.
   - Dependabot alerts enabled.
   - Dependabot security updates and automatic fix PRs enabled.
   - Secret scanning enabled where available.
   - Push protection enabled where available.
   - Branch protection on `main` requires CI and CodeQL before merge.
3. Finish the single-source version work that is currently in progress in
   `src/gcubed_build_switcher/version.py` and `tests/test_runtime_version.py`.
4. Confirm the moving secure channel tag name, probably `latest-secure`, and
   document that it intentionally moves to the current approved secure bundle.
5. Decide the secure bundle asset layout:
   - Python wheel.
   - VSIX.
   - Validation or manifest metadata.
   - Any legacy release files still needed during migration.
6. Add a release workflow or script that builds the wheel and VSIX from the same
   source version, packages the secure tarball, and uploads it to the moving
   secure channel tag.
7. Produce a candidate secure bundle at a curl-reachable URL.
8. Run the production-vs-development devcontainer smoke profiles from
   `.devcontainer/README-SWITCHER-MATRIX.md`.
9. Merge only after CI, CodeQL, dependency review, and smoke validation are
   green.
10. Update the customer devcontainer template to consume the moving secure
    channel tag when ready.

## How To Handle Dependabot PRs

Treat Dependabot PRs as ordinary change PRs with a security-flavoured reason to
exist.

1. Read the Dependabot PR summary and linked advisory/changelog.
2. Wait for CI, CodeQL, and dependency review checks.
3. For npm changes, make sure extension unit tests, build, socket tests, and
   package smoke pass.
4. For Python changes, make sure Python unit tests pass.
5. For release or runtime dependency changes, run the relevant devcontainer
   matrix profile before merging.
6. Merge only after the branch has the same confidence as a human-authored PR.

Do not merge dependency updates directly to `main` before this branch's CI and
release safety rails are in place.

## Devcontainer Matrix Commands

List profiles:

```bash
scripts/devcontainer-profile list
```

Generate a current-live baseline profile:

```bash
scripts/devcontainer-profile prepare legacy-baseline
```

Generate a new-Python/old-VSIX compatibility profile:

```bash
scripts/devcontainer-profile prepare new-python-old-vsix \
  --python-url "https://github.com/McKibbin-Software-Group/gcubed-build-switcher/releases/latest/download/gcubed_build_switcher-1.2.3-py3-none-any.whl"
```

Generate a full new-Python/new-VSIX profile using the Python Environments path:

```bash
scripts/devcontainer-profile prepare new-python-new-vsix-python-envs \
  --python-url "https://github.com/McKibbin-Software-Group/gcubed-build-switcher/releases/latest/download/gcubed_build_switcher-1.2.3-py3-none-any.whl" \
  --vsix-url "https://github.com/McKibbin-Software-Group/gcubed-build-switcher/releases/latest/download/gcubed-vscode-venv-switcher.vsix"
```

After `prepare`, rebuild/reopen in VS Code and select the generated active
profile. Use `scripts/devcontainer-profile up <profile>` only when the
standalone `devcontainer` CLI is installed and working.

## Validation To Run

```bash
python3 -m unittest discover -s tests -v

cd vscode-extension
npm run test:unit
npm run build
npm run test:socket
npm run package:test
```

For a release or runtime change, also run configured smoke tests:

```bash
gcubed-switch <build_tag>
node vscode-extension/tests/live/runSocketTests.js
```

For a candidate release, run these matrix profiles at minimum:

```bash
scripts/devcontainer-profile prepare new-python-old-vsix --python-url "<wheel-url>"
scripts/devcontainer-profile prepare old-python-new-vsix-legacy --vsix-url "<vsix-url>"
scripts/devcontainer-profile prepare new-python-new-vsix-legacy --python-url "<wheel-url>" --vsix-url "<vsix-url>"
scripts/devcontainer-profile prepare new-python-new-vsix-python-envs --python-url "<wheel-url>" --vsix-url "<vsix-url>"
```

Rebuild the devcontainer after each `prepare` and run a real switcher smoke test
when a build tag is available.

## Context Needed Before Starting

- Target customer devcontainer assumptions: user IDs, socket permissions,
  available Python extension, and network access.
- Devcontainer runtime marker guaranteed by the customer template or host.
- Whether the customer devcontainer should install `ms-python.vscode-python-envs`
  explicitly or rely on the Python extension's rollout path.
- Expected versioning policy for Python package, VS Code extension, release shim,
  and generated artifacts.
- Exact release asset names for wheel, VSIX, legacy release file, and any
  compatibility manifest/tarball.
- A real prerequisites repo tag for CLI/end-to-end smoke testing.

## Blockers / Gaps

- Dependency Review workflow is not present yet.
- GitHub settings still need final verification after the repo files land on
  `main`.
- Candidate wheel/VSIX assets need curl-reachable URLs before the devcontainer
  matrix can fully prove the migration.
- Extension socket tests require an execution environment that permits Unix
  domain sockets; the default sandbox returns `EPERM` for AF_UNIX socket
  creation, so run them unsandboxed/escalated here.
- Further customer-like end-to-end validation still needs a configured target
  devcontainer and real build tag.

## Good Stopping Point

The next useful stopping point is a branch where CI, CodeQL, dependency review,
version generation, wheel/VSIX packaging, and the devcontainer compatibility
matrix are all repeatable enough that Dependabot PRs can be tested before being
merged.
