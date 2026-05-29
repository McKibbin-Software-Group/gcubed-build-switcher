# Roadmap

Last updated: 2026-05-28

## Goal

Move from the current loose release shape to a paired release model where the
Python wheel, VSIX, and compatibility metadata are produced together, while
keeping old and new devcontainer deployments working during the transition.

GitHub security automation should guard that path: dependency updates arrive as
PRs, code scanning runs continuously, CI proves the switcher still works, and
branch protection prevents untested dependency or release changes from landing.

## Phase 1: Security And CI Baseline

Status: partially in place.

- Keep `.github/dependabot.yml` covering root Python, `release-files`, VS Code
  extension npm dependencies, and GitHub Actions.
- Keep `.github/workflows/codeql.yml` scanning Python and JavaScript/TypeScript
  on PRs, pushes to `main`, weekly schedule, and manual dispatch.
- Keep `.github/workflows/ci.yml` running Python unit tests, extension unit
  tests, extension bundle build, socket protocol tests, package smoke, and test
  VSIX artifact upload.
- Add a Dependency Review workflow for PRs so dependency diffs are checked before
  merge, not only after Dependabot or CodeQL notices a problem.
- In GitHub settings, keep Dependency Graph, Dependabot alerts, Dependabot
  security updates, secret scanning, and push protection enabled where the repo
  plan supports them.
- Add branch protection for `main` requiring CI and CodeQL checks before merge.

## Phase 2: Release Shape Stabilisation

Status: initial secure-bundle mechanism and single-source version sync are in
place; publishing and live smoke validation are next.

- Keep `VERSION` as the authoritative release version source for the Python
  package, VS Code extension, runtime fallback, release shim, and generated
  release metadata. `scripts/sync-version --check` should fail builds when
  those files drift.
- Build the Python side as a wheel instead of relying only on
  `release-files/pyproject.toml` installing from GitHub `main`.
- Build the VSIX from the same release process as the wheel.
- Publish both new assets together:
  - Python wheel.
  - Candidate/new VSIX.
  - Compatibility or manifest metadata if needed.
  - Legacy release files for existing devcontainer templates.
- Keep the old release shape in parallel until distributed devcontainer users
  have migrated.
- Use a single intentionally moving secure channel tag, currently expected to be
  something like `latest-secure`, for the new bundled release shape. This keeps
  field deployments upgradeable without per-template tag edits.
- Make the secure tarball self-describing with a manifest that records the
  bundle schema version, package version, Git commit SHA, build date/time, wheel
  filename/hash, VSIX filename/hash, and any installer or validation file
  hashes.
- Require the installer to validate the manifest before installing from the
  bundle. The moving tag is the update channel; the manifest is the audit and
  integrity record.
- Keep `scripts/build-secure-bundle`, `scripts/obtain-secure-bundle`,
  `scripts/verify-secure-bundle`, and `scripts/install-secure-bundle` as the
  local contract test before changing customer devcontainer templates.
- Treat immutable per-version release tags as a later hardening step, not a
  blocker for the initial secure-bundle migration.

## Phase 3: Operational Devcontainer Validation

Status: local matrix support exists, but the intended shape is being simplified
to production-vs-development smoke profiles.

- Keep one production profile that reproduces the existing deployed install path:
  release `pyproject.toml`, release VSIX, and `uv pip install --system -r
  pyproject.toml`.
- Add one development profile that builds or consumes the secure bundle from the
  current branch: wheel, VSIX, validation metadata, and installer inputs in one
  compressed tarball.
- Add one release-candidate profile when candidate bundles are published to the
  moving secure channel tag.
- Record the smoke result, including whether the extension reports the legacy API
  path or `apiId: "ms-python.vscode-python-envs"`.
- Avoid rebuilding a full old/new cartesian matrix unless a compatibility risk
  specifically calls for it.

## Phase 4: Soft Migration

Status: planned.

- Merge the compatible Python side first once CI, CodeQL, and matrix smoke tests
  pass. The IPC contract is stable, so the new Python package should continue to
  work with the current live extension.
- Publish a release containing both old-shape assets and new paired assets.
- Continue publishing the old VSIX path while also bundling the new VSIX in the
  release package.
- Update devcontainer templates to consume the moving secure channel tag and
  choose the new bundle installer only when that deployment is ready.
- Let users move as they rebuild devcontainers; avoid forcing per-user or
  per-template tag changes during the first migration.
- Keep fallback support in the extension until customer/devcontainer baselines
  show the legacy path is no longer needed.

## Phase 5: Cleanup After Migration

Status: deferred.

- Remove `release-files/pyproject.toml` installing from GitHub `main` once no
  deployed template needs it.
- Remove old VSIX publishing only after all supported templates consume the new
  release shape.
- Revisit the legacy `ms-python.python` fallback after live deployments have
  settled on `ms-python.vscode-python-envs`.
- Tighten release docs and generated artifact retention once the release flow is
  boringly repeatable.

## Security Automation Expectations

- Dependabot opens PRs for vulnerable or outdated dependencies.
- Dependabot automatic fix PRs should be treated like normal code changes:
  review, wait for CI/CodeQL/dependency review, then merge.
- CodeQL flags code-level security and quality findings on PRs and scheduled
  scans.
- Dependency Review should block newly introduced vulnerable dependency versions
  in PRs after the workflow is added.
- Secret scanning and push protection catch committed or pushed credentials; they
  do not replace local secret hygiene.
- CI proves dependency updates still build, test, package, and preserve the IPC
  compatibility contract.

## Non-Goals

- Do not publish the private package to PyPI unless the distribution model
  changes deliberately.
- Do not require customer devcontainer templates to pin and maintain immutable
  per-version tags during the soft migration.
- Do not remove the legacy extension path until live deployments have migrated.
- Do not auto-merge dependency updates without a passing test/security gate.
