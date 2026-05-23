# Core

- Canonical entrypoints: `AGENTS.md`, `docs/00-START-HERE.md`.
- Durable project facts live in `docs/`; temporary agent notes live in `docs/ai/`.
- Purpose: select/build the correct G-Cubed Code Python environment inside customer devcontainers and ask VS Code to switch interpreters.
- Main docs: architecture/runtime flow in `docs/01-repo-overview.md`; current behavior/risks in `docs/02-current-status.md`; pickup tasks in `docs/04-next-steps.md`; ADRs in `docs/adr/`.
- Python runtime package: `src/gcubed_build_switcher/`; details in `mem:python/core`.
- VS Code extension: `vscode-extension/src/`; details in `mem:vscode-extension/core`.
- Release payload: `release-files/`; checked-in `.vsix` artifacts are generated release outputs unless the task is explicitly about release/packaging.
- Supporting memories: stack/tools in `mem:tech_stack`; useful commands in `mem:suggested_commands`; project guardrails in `mem:conventions`; done criteria in `mem:task_completion`.