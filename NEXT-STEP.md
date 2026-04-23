# Next Step: Python Interpreter Provider Chain

## Goal

Modify the Python part of `gcubed-build-switcher` so build-specific virtual environments are created with an exact required Python version obtained through this provider chain:

```text
cache/path/system -> MSG prebuilt -> fail with clear support message
```

Do not use `uv python install` or uv-managed Python downloads. Continue using `uv` to create venvs and install packages once an appropriate local Python executable has been resolved.

## Current Behaviour To Replace

`src/gcubed_build_switcher/venv.py` currently reads `.python-version` from the tagged prerequisites repo and, when present, runs:

```python
subprocess.run(["uv", "python", "install", python_version], cwd=gcubed_root, check=True)
venv_cmd.extend(["--python", python_version])
```

Replace this with resolution of a local interpreter path:

```python
python_path = ensure_python_available(python_version)
venv_cmd.extend(["--python", python_path])
```

`python_path` must be an absolute path to a locally available executable that has been validated as the exact requested Python version.

## Proposed Files

- Add `src/gcubed_build_switcher/python_provider.py`.
- Update `src/gcubed_build_switcher/config.py` with optional config helpers/defaults.
- Update `src/gcubed_build_switcher/venv.py` to call the provider.
- Add tests if a test framework exists or introduce lightweight unit tests for provider behaviour.

Keep the Python package compatible with the current `requires-python = ">=3.6"` unless the project explicitly changes that requirement.

## Configuration

All new configuration must have sensible defaults and be overridden only when the corresponding environment variable exists.

Recommended optional environment variables:

- `GCUBED_PYTHON_INSTALL_ROOT`
  - Default: `/opt/gcubed/python-builds/pyenv`
  - Purpose: root directory where MSG prebuilt Python archives are extracted.
  - Expected archive layout under this root: `versions/<python-version>/bin/python`.

- `GCUBED_PYTHON_PREBUILT_MANIFEST_URL`
  - Default: testing URL for the current MSG prebuilt archive manifest.
  - This must be easy to relocate after testing. Keep the value centralized in `config.py`.
  - If the URL is empty/unset or cannot be fetched, the prebuilt provider should fail gracefully and produce a clear final support message.

- `GCUBED_PYTHON_DOWNLOAD_TIMEOUT_SECONDS`
  - Default: `60`.

- `GCUBED_PYTHON_PROVIDER_ORDER`
  - Default: `cache,path,system,prebuilt`.
  - Useful for diagnostics/testing but not required for normal use.

Do not require these env vars for normal operation.

## Provider Behaviour

### 1. Cache Provider

Look for an already-installed interpreter at:

```text
<GCUBED_PYTHON_INSTALL_ROOT>/versions/<python-version>/bin/python
```

Validate it before use:

```bash
<python> -c "import sys; print('.'.join(map(str, sys.version_info[:3])))"
```

Only return it when the version exactly matches `.python-version`.

### 2. Path Provider

If `.python-version` contains an absolute path, treat it as an explicit interpreter request.

Validate that:

- The file exists.
- It is executable.
- It reports the exact requested Python version if a version can be inferred.

If the path is invalid, fail clearly rather than silently falling through to unrelated versions.

If supporting both version strings and absolute paths creates ambiguity, keep the initial implementation simple: version strings use the provider chain; absolute paths are validated directly.

### 3. System Provider

Search for exact-match system interpreters without downloading anything.

Suggested candidates:

```text
python<major>.<minor>
python<major>
python3
python
```

Use `shutil.which()` and validate the exact patch version by running the candidate. Do not trust executable names alone.

### 4. MSG Prebuilt Provider

Fetch `manifest.json` from `GCUBED_PYTHON_PREBUILT_MANIFEST_URL`.

Match an archive by:

- `implementation == "cpython"`
- exact `version`
- current platform identifier

Platform identifiers should initially support:

```text
linux-x86_64-glibc
macos-arm64
```

Download the matching archive to a temporary file, verify its SHA256, extract to a temporary directory under the install root, validate the Python executable, then atomically move it into place.

Important:

- Do not leave half-extracted installations in the cache.
- Use a simple lock file or atomic directory creation to avoid two processes installing the same version concurrently.
- If another process installs the version first, re-check cache and use it.
- Handle unsupported platform, missing manifest, missing archive, checksum mismatch, download failure, and validation failure with clear messages.

Sample manifest:

Copy of actual current manifest available at the self-managed python repo:

```json
{
  "schema_version": 1,
  "install_root": "/opt/gcubed/python-builds/pyenv",
  "generated_at": "2026-04-23T07:16:22Z",
  "archives": [
    {
      "implementation": "cpython",
      "version": "3.13.11",
      "platform": "linux-x86_64-glibc",
      "archive_format": "tar.gz",
      "asset_name": "cpython-3.13.11-linux-x86_64-glibc.tar.gz",
      "url": "https://github.com/AshieSlashy/gcubed-python-builds/releases/download/python-builds-latest/cpython-3.13.11-linux-x86_64-glibc.tar.gz",
      "sha256": "9cd1787fe81764439c31164f79880c2d543b390f8656e23973c4eb0c52ddf9ca",
      "python": "versions/3.13.11/bin/python",
      "build_tool": "pyenv/python-build"
    },
    {
      "implementation": "cpython",
      "version": "3.13.11",
      "platform": "macos-arm64",
      "archive_format": "tar.gz",
      "asset_name": "cpython-3.13.11-macos-arm64.tar.gz",
      "url": "https://github.com/AshieSlashy/gcubed-python-builds/releases/download/python-builds-latest/cpython-3.13.11-macos-arm64.tar.gz",
      "sha256": "af3b3358a1e99cadea8f5c26a8557062a86963331a25a9dcbe565d2f98abbc7a",
      "python": "versions/3.13.11/bin/python",
      "build_tool": "pyenv/python-build"
    }
  ]
}

```

Expected install path after extraction:

```text
<GCUBED_PYTHON_INSTALL_ROOT>/versions/<python-version>/bin/python
```

## Failure Message

If all providers fail, return `False` from venv creation and print a clear support-oriented message. It should include:

- Requested Python version.
- Current platform identifier.
- Cache path checked.
- Whether the prebuilt manifest was reachable.
- Whether a matching archive was found.
- A short instruction to contact G-Cubed support.

Example:

```text
Unable to obtain required Python 3.10.13 for platform linux-x86_64-glibc.
Checked local cache, explicit/system interpreters, and MSG prebuilt archives.
Please contact G-Cubed support and provide this Python version and platform.
```

NOTE: this should fit into current error reporting mechanism.

## Integration With Existing Venv Creation

`create_venv_for_build()` should still:

1. Validate the build tag by cloning the prerequisites repo.
2. Read optional `.python-version`.
3. Resolve the interpreter path only when `.python-version` exists.
4. Run `uv venv --system-site-packages --python <absolute-python-path> <venv_name>`.
5. Install wheel and requirements files with the existing `uv pip install -p <venv-python>` path.

If `.python-version` does not exist, preserve current behaviour and let `uv venv` use the default interpreter.

## Implementation Notes

- Prefer standard library only for provider implementation: `json`, `hashlib`, `os`, `platform`, `shutil`, `subprocess`, `tarfile`, `tempfile`, `time`, `urllib.request`.
- Be careful with tar extraction. Reject archive members with absolute paths or `..` traversal.
- Keep logs helpful but not noisy. Provider failures should be accumulated and displayed only when all providers fail, unless a failure indicates corruption or checksum mismatch.
- Avoid deleting existing Python installations unless the current install attempt created them and validation failed.
- Keep `uv pip` usage in `packages.py` unchanged.

## Suggested Tests

Add tests for:

- Version validation accepts exact `3.x.y` and rejects wrong patch versions.
- Cache provider returns an existing valid interpreter.
- System provider validates executable output rather than trusting names.
- Manifest matching chooses the correct platform/version.
- Prebuilt provider rejects checksum mismatch.
- Tar extraction rejects path traversal.
- All-provider failure produces the support message.
- `venv.py` passes an absolute `--python` path to `uv venv` when `.python-version` exists.

If adding a test framework is out of scope, create small unit-testable functions and document manual smoke-test commands in the implementation notes.

## Manual Smoke Test

After implementation, test with a prerequisites tag containing `.python-version` set to a version present in the MSG archive.

Expected outcome:

1. First run downloads/extracts the MSG prebuilt Python into the install root.
2. `uv venv` creates `venv_gcubed_<tag>` using that interpreter.
3. Wheel/requirements installation continues as before.
4. Second run uses the cached Python and cached/verified venv without downloading the archive again.
