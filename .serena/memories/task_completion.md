# Task Completion

- Run the narrowest meaningful validation for the touched surface.
- Python changes: normally run `python3 -m unittest discover -s tests -v`; use focused tests first when diagnosing.
- Extension changes: normally run `cd vscode-extension && npm run build` and `cd vscode-extension && npm run test:socket`; package/release work should also run `npm run package:test` when possible.
- Runtime/release behavior changes may need configured smoke tests: `python -m src.gcubed_build_switcher.cli <build_tag>` and `node vscode-extension/tests/live/runSocketTests.js`.
- Report validation gaps plainly, especially missing real G-Cubed env vars, prerequisite repo access, build tags, VS Code host, or Microsoft Python extension availability.
- After substantial memory/doc-affecting work, update the smallest relevant canonical docs or Serena memories; run `serena memories check` after memory reference edits.