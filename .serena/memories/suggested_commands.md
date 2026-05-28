# Suggested Commands

Last checked: 2026-05-28
Source of truth: `docs/00-START-HERE.md`, `docs/04-next-steps.md`, `.devcontainer/README-SWITCHER-MATRIX.md`, manifests
Update when: test scripts, packaging scripts, or devcontainer matrix commands change.

- Python unit tests: `python3 -m unittest discover -s tests -v`.
- Focused Python provider tests: `python3 -m unittest tests.test_python_provider`.
- CLI smoke path, requires real target env vars and a build tag: `gcubed-switch <build_tag>` or `python -m src.gcubed_build_switcher.cli <build_tag>`.
- Extension build: `cd vscode-extension && npm run build`.
- Extension unit tests: `cd vscode-extension && npm run test:unit`.
- Extension socket tests: `cd vscode-extension && npm run test:socket`.
- Extension package test: `cd vscode-extension && npm run package:test`.
- Devcontainer matrix profiles: `scripts/devcontainer-profile list`; `scripts/devcontainer-profile prepare <profile>`.
- Live extension probe, requires installed/running VS Code extension context: `node vscode-extension/tests/live/runSocketTests.js`.
- Serena memory integrity: `serena memories check`.
- Serena project validation/indexing: `serena project health-check`; `serena project index`.
