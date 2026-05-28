# 0001: Use a Moving Secure Channel Tag With a Self-Describing Bundle

Date: 2026-05-28

## Status

Accepted for the initial secure-bundle migration.

## Context

Existing field deployments already consume a moving release channel: the
devcontainer downloads release files from the current GitHub release shape and
rebuilds pick up the current approved switcher.

Moving every deployed template to immutable per-version tags would require a new
field update mechanism. That would add updater logic, version comparison,
failure handling, and operational state before the switcher itself is ready for
the new release shape.

## Decision

Use one intentionally moving secure channel tag, currently expected to be
`latest-secure`, for the new bundled release shape.

The bundle must be self-describing. It should contain a manifest with at least:

- bundle schema version
- switcher package version
- Git commit SHA
- build date/time
- wheel filename and SHA-256 hash
- VSIX filename and SHA-256 hash
- any installer or validation file names and SHA-256 hashes

The installer must validate the manifest before installing from the bundle.

Immutable per-version tags remain a long-term hardening goal, but field
deployments should not need to track them during the first migration.

## Consequences

- Rebuilding a devcontainer remains the update mechanism.
- Field templates can track one stable channel name instead of learning every
  release version.
- The moving tag itself is not enough for auditability, so the manifest becomes
  the audit record.
- Rollback is operationally simple: move the secure channel tag back to the last
  approved bundle.
- Release discipline matters: only validated bundles should be promoted to the
  moving secure channel tag.

## Follow-Up

- Define the exact manifest schema and filename.
- Add release automation that builds the wheel and VSIX, computes hashes, writes
  the manifest, packages the tarball, verifies it, and uploads it to the secure
  channel tag.
- Keep immutable release tags or GitHub releases for forensic/debug use even
  though field templates consume the moving channel.
