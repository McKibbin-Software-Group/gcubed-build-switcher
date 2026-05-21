# G-Cubed Build Switcher Agent Instructions

Start with `docs/00-START-HERE.md`. Durable project context belongs in
`docs/`; temporary investigation plans or handoff notes belong in `docs/ai/`.
Keep this file limited to instructions that should shape agent behavior before
or while reading the rest of the project memory.

## Before Editing

- Check `git status --short` and relevant diffs. Preserve user changes.
- Read `docs/02-current-status.md` and `docs/04-next-steps.md` for current
  risks, validation state, and pickup tasks.
- Keep changes minimal and scoped to the user's request.
- Run the narrowest meaningful validation and report what passed or could not
  be run.

## Guardrails

- Keep the Python side compatible with `requires-python = ">=3.6"` unless the
  project explicitly raises that floor.
- In devcontainers, venv creation uses the ambient container Python. Do not
  reintroduce `.python-version`, wheel `Requires-Python`, or prebuilt-Python
  acquisition there unless the devcontainer Python strategy changes. Preserve
  the non-devcontainer interpreter-provider path.
- The Python package currently shells out to `git` and `uv`; prefer the existing
  command-based flow over heavier abstractions unless there is a clear
  reliability or coverage win.
- The extension IPC protocol is null-terminated UTF-8 JSON over a Unix domain
  socket. Keep the Python client and JavaScript server constants in sync.
- Treat checked-in `.vsix` files as generated release artifacts unless the task
  is explicitly about packaging or release.
- Avoid destructive cleanup of `venv_gcubed*` directories unless the user
  explicitly asks; existing venvs may be useful to the devcontainer user.
- Do not print full secrets, token values, or sensitive config contents.

## Documentation Boundary

- Put stable architecture, runtime flow, environment variables, commands, and
  release process in `docs/01-repo-overview.md`.
- Put current behavior, known risks, and latest validation in
  `docs/02-current-status.md`.
- Put next operator or agent actions in `docs/04-next-steps.md`.
- Use `docs/ai/` only for temporary working notes that should later be promoted
  into canonical docs or removed.
