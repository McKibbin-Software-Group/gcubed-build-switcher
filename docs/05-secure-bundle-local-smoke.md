# Secure Bundle Local Smoke Test

Use this when you want to test the secure-bundle devcontainer path before
publishing a release asset. The trick is to serve the bundle from your host with
Python, then give the generated devcontainer profile a URL that Docker can
reach during image build.

## What This Proves

- The bundle can be downloaded by the devcontainer Docker build.
- The Dockerfile verifies the bundle and deploys the VSIX before VS Code tries
  to install it.
- The setup script verifies the same bundle again and installs the wheel.
- The generated active profile uses the same one-tarball shape the customer
  template should eventually consume.

## 1. Build And Verify The Bundle

From the repo root:

```bash
scripts/build-secure-bundle
scripts/verify-secure-bundle build/secure-bundle/gcubed-build-switcher-secure.tar.gz
```

For a release candidate, build only from a clean committed tree:

```bash
scripts/build-secure-bundle --require-clean
```

Local in-progress bundles may record `"dirty": true` in `manifest.json`. That is
fine for this smoke test. It is not fine for a promoted release candidate.

## 2. Serve The Bundle From The Host

Keep this terminal open while the devcontainer rebuilds:

```bash
cd build/secure-bundle
python3 -m http.server 8765 --bind 0.0.0.0
```

The bundle should now be available as:

```text
http://<host-ip>:8765/gcubed-build-switcher-secure.tar.gz
```

Do not use `localhost` in the devcontainer profile. During Docker build,
`localhost` means the build container, not your host machine.

## 3. Find A Docker-Reachable Host URL

In another terminal, start with the host IP:

```bash
HOST_IP="$(hostname -I | awk '{print $1}')"
BUNDLE_URL="http://${HOST_IP}:8765/gcubed-build-switcher-secure.tar.gz"
curl -fI "${BUNDLE_URL}"
```

If Docker cannot reach that address, try the Docker bridge gateway:

```bash
BUNDLE_URL="http://172.17.0.1:8765/gcubed-build-switcher-secure.tar.gz"
curl -fI "${BUNDLE_URL}"
```

On Docker Desktop, this may also work:

```bash
BUNDLE_URL="http://host.docker.internal:8765/gcubed-build-switcher-secure.tar.gz"
```

Use whichever URL the devcontainer build can actually fetch.

## 4. Generate The Active Profile

For the Python Environments path:

```bash
scripts/devcontainer-profile prepare secure-bundle-python-envs \
  --bundle-url "${BUNDLE_URL}"
```

For the legacy Python extension path:

```bash
scripts/devcontainer-profile prepare secure-bundle-legacy \
  --bundle-url "${BUNDLE_URL}"
```

Confirm the generated JSON contains your real URL, not `example.invalid`:

```bash
python3 -m json.tool .devcontainer/matrix-active/devcontainer.json
```

## 5. Rebuild The Devcontainer

In VS Code:

1. Run `Dev Containers: Reopen in Container`.
2. Choose the generated active profile:
   - `G-Cubed Build Switcher Matrix - Active Secure Bundle Python Environments`
   - or `G-Cubed Build Switcher Matrix - Active Secure Bundle Legacy`
3. Keep the Python HTTP server running until the image build has downloaded the
   bundle.

During build/setup, look for messages like:

```text
Downloading explicit secure bundle ...
Verified secure bundle: package ... / extension ... / commit ...
Installing G-Cubed build switcher from secure bundle ...
```

## 6. Check The Rebuilt Container

Inside the rebuilt devcontainer:

```bash
ls -lah /home/vscode/extensions/gcubed-venv-switcher
python -c "import gcubed_build_switcher as g; print(g.__version__)"
```

Expected files:

```text
gcubed-build-switcher-secure.tar.gz
gcubed-vscode-venv-switcher.vsix
manifest.json
```

When a real configured build tag is available, run the end-to-end smoke:

```bash
gcubed-switch <build_tag>
```

For the Python Environments profile, the extension path should report or log
`apiId: "ms-python.vscode-python-envs"` when that API is used. If it falls back
to the legacy Python API, check the extension logs before treating the smoke as
fully proven.

## Troubleshooting

- `curl` fails during Docker build: the URL is not reachable from Docker. Keep
  the server running, bind it to `0.0.0.0`, and try another host address.
- The active profile still uses `example.invalid`: rerun
  `scripts/devcontainer-profile prepare ... --bundle-url "${BUNDLE_URL}"`.
- VS Code cannot install the local VSIX path: check that the Docker build
  printed `Verified secure bundle` before extension installation.
- The bundle verifies locally but not in Docker: rebuild the bundle and make
  sure the server is serving the latest file from `build/secure-bundle`.
- The manifest says `"dirty": true`: expected for local tests from an
  uncommitted tree; use `--require-clean` for release candidates.

## Stop The Server

After the devcontainer has downloaded the bundle, stop the Python HTTP server
with `Ctrl-C`.
