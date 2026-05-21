# Next Steps

Last updated: 2026-05-21

## Immediate Pickup

1. Fix `npm run test:socket` by providing a Jest-safe `vscode` mock or separating socket protocol tests from interpreter switching imports.
2. Update stale extension-facing docs and metadata from HTTP/port wording to Unix socket wording.
3. Decide how versions should line up across root `pyproject.toml`, `vscode-extension/package.json`, `release-files/pyproject.toml`, and `src/gcubed_build_switcher/__init__.py`.
4. Confirm release shim behavior: floating `main` dependency versus pinned release ref.

## Validation To Run

```bash
python3 -m unittest discover -s tests -v

cd vscode-extension
npm run build
npm run test:socket
npm run package:test
```

For a release or runtime change, also run a configured smoke test:

```bash
python -m src.gcubed_build_switcher.cli <build_tag>
node vscode-extension/tests/live/runSocketTests.js
```

## Context Needed Before Starting

- Target customer devcontainer assumptions: user IDs, socket permissions, available Python extension, and network access.
- Expected versioning policy for Python package, VS Code extension, release shim, and generated artifacts.
- Whether release assets should float to `main` or pin to immutable refs.
- A real prerequisites repo tag for CLI/end-to-end smoke testing.

## Blockers

- No docs blocker remains after the baseline setup.
- Extension socket test validation is blocked by missing `vscode` module resolution in Jest.
- Live end-to-end validation is blocked without a configured VS Code/devcontainer environment.

## Good Stopping Point

The next useful stopping point is a repo where Python tests pass, extension build passes, socket tests run cleanly in plain Jest, and release/version ownership is documented before packaging.
