# Conventions

- Before editing: check `git status --short` and relevant diffs; preserve user changes.
- Keep changes minimal and scoped; avoid opportunistic refactors and metadata churn.
- Keep root `AGENTS.md` lean; stable project facts belong in `docs/`; task-local handoff notes belong in `docs/ai/`.
- Keep Python code compatible with Python `>=3.6`.
- Preserve devcontainer venv creation with ambient Python; do not reintroduce `.python-version`, wheel `Requires-Python`, or prebuilt-Python acquisition in devcontainers unless the strategy changes.
- Preserve non-devcontainer interpreter-provider flow unless deliberately changing it with tests/docs.
- Keep Python client and VS Code extension IPC constants/protocol in sync.
- Treat checked-in `.vsix` files as generated release artifacts except for explicit release/packaging tasks.
- Avoid destructive cleanup of `venv_gcubed*` directories unless explicitly requested.
- Protect secrets: do not print full tokens, credential contents, or sensitive config dumps.