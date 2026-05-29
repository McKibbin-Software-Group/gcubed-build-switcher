# Legacy Release Process

Use this process when you need to publish the current production release shape:

- `release-files/pyproject.toml`
- `release-files/gcubed-vscode-venv-switcher.vsix`

This is still supported while the newer secure-bundle release process is being
finished. The current `gcubed-devcontainer-template` downloads these two files
from the latest GitHub release during Docker build, installs the Python package
with `uv pip install --system -r pyproject.toml`, and installs the VS Code
extension from the VSIX.

Do not attach `gcubed-build-switcher-secure.tar.gz` or wheel files when you are
intentionally doing this legacy release.

## Important Safety Notes

- `release-files/pyproject.toml` installs `gcubed-build-switcher` from GitHub
  `main`. Make sure the code you want customers to receive has already been
  merged to `main` before publishing the GitHub release.
- The devcontainer template uses GitHub's "latest release" URL by default:
  `https://github.com/McKibbin-Software-Group/gcubed-build-switcher/releases/latest/download/...`.
  Publish the release as the latest non-prerelease release.
- The VSIX is a generated artifact. Only replace the checked-in VSIX when you
  are deliberately preparing a release.

## 1. Start Clean

From the repo root:

```bash
git status --short
```

Decide what changes are part of the release. Do not continue with unrelated or
surprise changes in the worktree.

Make sure dependencies are installed:

```bash
cd vscode-extension
npm ci
cd ..
```

## 2. Choose The Version

If the version is already correct:

```bash
scripts/sync-version --check
```

If this release should bump the version, choose exactly one command.

Patch release:

```bash
scripts/sync-version --bump patch
```

Minor release:

```bash
scripts/sync-version --bump minor
```

Major release:

```bash
scripts/sync-version --bump major
```

Then confirm the metadata is aligned:

```bash
scripts/sync-version --check
```

This keeps the Python package metadata, runtime fallback, extension package,
npm lockfile, release shim, and `VERSION` file together.

## 3. Run Pre-Release Checks

From the repo root:

```bash
python3 -m unittest discover -s tests -v
```

From the extension directory:

```bash
cd vscode-extension
npm run test:unit
npm run build
npm run package:test
```

Run socket tests where Unix domain sockets are permitted:

```bash
npm run test:socket
cd ..
```

If socket tests fail with `connect EPERM ...sock`, rerun them in an environment
that permits Unix domain sockets. That is a sandbox limitation, not a release
artifact problem.

## 4. Build The Legacy VSIX

If you already bumped the version with `scripts/sync-version`, build the VSIX
without another version bump:

```bash
cd vscode-extension
npm run clean
npm run build:prod
./node_modules/.bin/vsce package \
  --no-dependencies \
  --out production/gcubed-vscode-venv-switcher.vsix
cp production/gcubed-vscode-venv-switcher.vsix \
  ../release-files/gcubed-vscode-venv-switcher.vsix
cd ..
```

If you have not bumped the version yet and want the packaging command to do it,
choose exactly one command.

Patch release:

```bash
cd vscode-extension
npm run package:patch
cd ..
```

Minor release:

```bash
cd vscode-extension
npm run package:minor
cd ..
```

Major release:

```bash
cd vscode-extension
npm run package:major
cd ..
```

Those package commands bump the shared version metadata, build the production
VSIX, and copy it into `release-files/`.

## 5. Check The Release Files

Confirm the two legacy release assets exist:

```bash
ls -lh release-files/pyproject.toml \
  release-files/gcubed-vscode-venv-switcher.vsix
```

Confirm the release shim version is the version you expect:

```bash
sed -n '1,20p' release-files/pyproject.toml
scripts/sync-version --check
git diff --check
git status --short
```

You should expect to see the VSIX changed when a new extension has been built.

## 6. Commit, Push, And Wait For CI

Commit the source, version metadata, and release files together:

```bash
git add VERSION pyproject.toml release-files/pyproject.toml \
  release-files/gcubed-vscode-venv-switcher.vsix \
  src/gcubed_build_switcher/version.py \
  vscode-extension/package.json vscode-extension/package-lock.json
```

Add any other intended source or documentation files before committing. Use the
actual version in the commit message:

```bash
git commit -m "Release gcubed-build-switcher 1.2.2"
git push
```

Open GitHub and confirm the commit is on `main`. Wait for CI to pass on `main`
before publishing the release. This matters because the release
`pyproject.toml` installs from `main`.

## 7. Publish The GitHub Release

In GitHub:

1. Open the `gcubed-build-switcher` repository.
2. Go to **Releases**.
3. Choose **Draft a new release**.
4. Create a new tag from `main`, usually `v<version>`, for example `v1.2.2`.
5. Set the release title, for example `gcubed-build-switcher v1.2.2`.
6. Make sure it is not a prerelease.
7. Make sure GitHub will treat it as the latest release.
8. Attach exactly these two files:
   - `release-files/pyproject.toml`
   - `release-files/gcubed-vscode-venv-switcher.vsix`
9. Publish the release.

## 8. Verify The Published Assets

From a temporary directory:

```bash
tmpdir="$(mktemp -d)"
cd "$tmpdir"
curl -fsSLO \
  https://github.com/McKibbin-Software-Group/gcubed-build-switcher/releases/latest/download/pyproject.toml
curl -fsSLO \
  https://github.com/McKibbin-Software-Group/gcubed-build-switcher/releases/latest/download/gcubed-vscode-venv-switcher.vsix
ls -lh
sed -n '1,20p' pyproject.toml
```

You should see both files download successfully.

## 9. Smoke Test With The Devcontainer Template

In `/home/ash/gcubed/gcubed-devcontainer-template`, confirm the template is
using the legacy latest release path:

```bash
rg -n "VENV_SWITCHER_TAG|pyproject.toml|gcubed-vscode-venv-switcher.vsix" \
  .devcontainer
```

The default should be `VENV_SWITCHER_TAG: "latest"`.

Rebuild a customer-like devcontainer from that template. During the Docker
build, check the logs for downloads of:

- `pyproject.toml`
- `gcubed-vscode-venv-switcher.vsix`

After the container opens, confirm:

```bash
python -c "import gcubed_build_switcher as g; print(g.__version__)"
ls -lh /home/vscode/extensions/gcubed-venv-switcher
```

Run a real switcher smoke test when a configured build tag is available:

```bash
gcubed-switch <build_tag>
```

## Rollback

If the release is bad, create or re-mark a known-good GitHub release as the
latest release, making sure it has working `pyproject.toml` and
`gcubed-vscode-venv-switcher.vsix` assets. Then rebuild affected devcontainers.
