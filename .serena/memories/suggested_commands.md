# Suggested Commands

- Python unit tests: `python3 -m unittest discover -s tests -v`.
- Focused Python provider tests: `python3 -m unittest tests.test_python_provider`.
- CLI smoke path, requires real target env vars and a build tag: `python -m src.gcubed_build_switcher.cli <build_tag>`.
- Extension build: `cd vscode-extension && npm run build`.
- Extension socket tests: `cd vscode-extension && npm run test:socket`.
- Extension package test: `cd vscode-extension && npm run package:test`.
- Live extension probe, requires installed/running VS Code extension context: `node vscode-extension/tests/live/runSocketTests.js`.
- Serena memory integrity: `serena memories check`.
- Serena project validation/indexing: `serena project health-check`; `serena project index`.