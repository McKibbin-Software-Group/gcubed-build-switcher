# G-Cubed Build Switcher Agent Instructions

Start with `docs/00-START-HERE.md`; use it as the project-memory map.

## Repo Guardrails

- Before substantial edits, check `docs/02-current-status.md` and
  `docs/04-next-steps.md`.

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
