# Start Here

This is the entrypoint for humans and agents working in this repo.

## Current Source Of Truth

- Agent guardrails: `AGENTS.md`
- Repo overview: `docs/01-repo-overview.md`
- Current status: `docs/02-current-status.md`
- Roadmap: `docs/03-roadmap.md`
- Next steps: `docs/04-next-steps.md`
- Architecture decisions, when useful: `docs/adr/`
- Temporary AI working notes, when useful: `docs/ai/`

`AGENTS.md` is intentionally lean. It should contain only instructions that
shape agent behavior before or while reading the rest of the memory set. Stable
project facts belong in `docs/`; temporary investigation or handoff material
belongs in `docs/ai/`.

## Project In One Paragraph

`gcubed-build-switcher` helps G-Cubed model and simulation code run against the correct G-Cubed Code library build inside customer devcontainers. The Python package validates a requested build tag, creates or verifies a build-specific virtual environment, installs artifacts from the tagged prerequisites repo, and asks the bundled VS Code extension to switch the active Python interpreter through a local Unix socket.

## First Commands

```bash
python3 -m unittest discover -s tests -v

cd vscode-extension
npm run build
npm run test:unit
npm run test:socket
```

The CLI smoke path requires a configured target environment:

```bash
python -m src.gcubed_build_switcher.cli <build_tag>
```

## Before Making Changes

- Read root `AGENTS.md`.
- Check `docs/01-repo-overview.md`, `docs/02-current-status.md`, and `docs/04-next-steps.md`.
- Inspect relevant code and config before editing.
- Preserve local/user changes; this repo often has generated or untracked files.
- Treat checked-in `.vsix` files as release artifacts unless the task is explicitly about packaging or release.
