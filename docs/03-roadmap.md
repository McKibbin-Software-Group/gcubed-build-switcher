# Roadmap

## Near Term

- Add the `ms-python.vscode-python-envs` implementation behind the environment-selection adapter described in `docs/ai/python-environments-api-spike.md`.
- Complete the Python Environments API spike so the extension prefers `ms-python.vscode-python-envs` with a legacy `ms-python.python` fallback.
- Align stale extension docs and package metadata with the Unix socket implementation.
- Decide and document the authoritative versioning/release model for the Python package, extension package, release shim, and `__version__`.
- Clarify whether `release-files/pyproject.toml` should install from `main` or a pinned release ref.

## Medium Term

- Add or document a repeatable devcontainer/VS Code integration smoke test for the full flow: build tag request, venv creation, socket request, interpreter switch.
- Review socket file permissions and target-user assumptions for customer devcontainers.
- Expand test coverage around CLI/config error paths and runtime support package installation failure cases.
- Document cache invalidation and unsupported-platform operator paths for prebuilt Python archives.

## Later / Deferred

- Consider Marketplace distribution only after internal release mechanics and live validation are boringly reliable.
- Consider moving interpreter acquisition behind a provider abstraction only if more providers are actually needed.
- Consider reducing checked-in generated artifacts if release automation can provide the same confidence without confusing normal development.

## Non-Goals

- Do not replace `git` and `uv` shell-outs without a concrete reliability or support win.
- Do not change the top-level `src/gcubed_build_switcher/`, `vscode-extension/`, or `release-files/` layout as part of the Python Environments API spike; keep refactors scoped inside `vscode-extension/src`.
- Do not remove existing generated venvs or cached Python builds as part of ordinary development.
- Do not hand-edit VSIX artifacts.

## Sequencing Notes

1. Keep socket and selector validation trustworthy while adding the Python Environments implementation behind the adapter.
2. Clean up stale docs/scripts after the current behavior is captured.
3. Resolve release/version ownership before the next real release.
