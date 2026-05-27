# G-Cubed Build Switcher Devcontainer Matrix

The default `.devcontainer/devcontainer.json` remains the source-development
container: it installs this checkout in editable mode and installs npm
dependencies for the extension.

The matrix configs are customer-like test containers. They download a selectable
Python artifact and a selectable VSIX into
`/home/vscode/extensions/gcubed-venv-switcher`, then the setup script installs
the Python side from that artifact instead of the editable checkout.

## Flavours

| Config | Purpose |
| --- | --- |
| `.devcontainer/matrix-legacy/devcontainer.json` | Tests the legacy Microsoft Python extension path. |
| `.devcontainer/matrix-python-envs/devcontainer.json` | Tests the `ms-python.vscode-python-envs` path. |

## Artifact Selectors

Set these in the host shell before rebuilding a matrix devcontainer:

| Build arg | Purpose |
| --- | --- |
| `VENV_SWITCHER_TAG` | Backward-compatible tag used for both halves when the specific selectors are unset. Defaults to `latest`. |
| `VENV_SWITCHER_PYTHON_TAG` | Release tag for the Python artifact only. |
| `VENV_SWITCHER_PYTHON_URL` | Full URL for the Python artifact only. Overrides `VENV_SWITCHER_PYTHON_TAG`. |
| `VENV_SWITCHER_PYTHON_FILE` | Destination/release filename for the Python artifact. Use `pyproject.toml` for the old shape or the wheel filename for wheel testing. |
| `VENV_SWITCHER_VSIX_TAG` | Release tag for the VSIX only. |
| `VENV_SWITCHER_VSIX_URL` | Full URL for the VSIX only. Overrides `VENV_SWITCHER_VSIX_TAG`. |
| `VENV_SWITCHER_VSIX_FILE` | Release asset name for the VSIX. Defaults to `gcubed-vscode-venv-switcher.vsix`. |

The setup script installs the Python side from `*.whl` when a wheel artifact is
present. Otherwise it falls back to `uv pip install --system -r pyproject.toml`,
which preserves the old release path.

## Migration Matrix

| Profile | Config | Python artifact | VSIX artifact | VS Code Python mode |
| --- | --- | --- | --- | --- |
| `legacy-baseline` | `matrix-legacy` | current release `pyproject.toml` | current release VSIX | legacy `ms-python.python` |
| `new-python-old-vsix` | `matrix-legacy` | candidate wheel | current release VSIX | legacy `ms-python.python` |
| `old-python-new-vsix-legacy` | `matrix-legacy` | current release `pyproject.toml` | candidate VSIX | legacy fallback |
| `new-python-new-vsix-legacy` | `matrix-legacy` | candidate wheel | candidate VSIX | legacy fallback |
| `old-python-new-vsix-python-envs` | `matrix-python-envs` | current release `pyproject.toml` | candidate VSIX | `ms-python.vscode-python-envs` |
| `new-python-new-vsix-python-envs` | `matrix-python-envs` | candidate wheel | candidate VSIX | `ms-python.vscode-python-envs` |

The first two rows prove the new Python side remains compatible with the live
extension. The later rows prove the candidate extension works with both Python
generations and both Microsoft Python environment paths.
