#!/usr/bin/env python3
"""Build, fetch, verify, and install G-Cubed build switcher bundles."""

from __future__ import print_function

import argparse
import ast
import datetime
import hashlib
import json
import os
import posixpath
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
from collections import Counter

try:
    from urllib.parse import urlparse
    from urllib.request import urlopen
except ImportError:  # pragma: no cover - Python 2 fallback is not expected.
    from urlparse import urlparse
    from urllib2 import urlopen


BUNDLE_SCHEMA_VERSION = 1
MANIFEST_FILENAME = "manifest.json"
DEFAULT_BUNDLE_NAME = "gcubed-build-switcher-secure.tar.gz"
DEFAULT_ARTIFACT_DIR = "/home/vscode/extensions/gcubed-venv-switcher"
DEFAULT_VSIX_NAME = "gcubed-vscode-venv-switcher.vsix"
PACKAGE_NAME = "gcubed-build-switcher"
EXTENSION_DIR = "vscode-extension"


class SecureBundleError(Exception):
    """Raised when a secure bundle cannot be built, verified, or installed."""


def default_repo_root():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def _as_abs_path(path):
    return os.path.abspath(os.path.expanduser(path))


def _run(command, cwd=None):
    print("+ {}".format(" ".join(command)))
    subprocess.check_call(command, cwd=cwd)


def _run_output(command, cwd=None):
    try:
        return subprocess.check_output(
            command, cwd=cwd, stderr=subprocess.DEVNULL
        ).decode("utf-8").strip()
    except (OSError, subprocess.CalledProcessError):
        return ""


def _command_exists(command):
    return shutil.which(command) is not None


def _is_root():
    geteuid = getattr(os, "geteuid", None)
    return bool(geteuid and geteuid() == 0)


def _needs_sudo(sudo_mode):
    if sudo_mode == "always":
        return True
    if sudo_mode == "never":
        return False
    return not _is_root() and _command_exists("sudo")


def _parse_toml_string(value):
    value = value.strip()
    try:
        parsed = ast.literal_eval(value)
    except (SyntaxError, ValueError):
        parsed = value.strip("\"'")
    if not isinstance(parsed, str):
        raise SecureBundleError("expected TOML string, got: {}".format(value))
    return parsed


def _read_project_metadata(pyproject_path):
    table = None
    metadata = {}

    with open(pyproject_path, "r") as pyproject:
        for raw_line in pyproject:
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("[") and line.endswith("]"):
                table = line.strip("[]")
                continue
            if table != "project" or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            if key in ("name", "version", "requires-python"):
                metadata[key] = _parse_toml_string(value)

    if "name" not in metadata or "version" not in metadata:
        raise SecureBundleError(
            "could not read project name/version from {}".format(pyproject_path)
        )

    return metadata


def _read_extension_metadata(package_json_path):
    with open(package_json_path, "r") as package_json:
        metadata = json.load(package_json)

    if "name" not in metadata or "version" not in metadata:
        raise SecureBundleError(
            "could not read extension name/version from {}".format(package_json_path)
        )

    return metadata


def _git_commit(repo_root):
    return _run_output(["git", "rev-parse", "HEAD"], cwd=repo_root) or "unknown"


def _git_dirty(repo_root):
    unstaged = subprocess.call(
        ["git", "diff", "--quiet", "--ignore-submodules", "--"],
        cwd=repo_root,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    staged = subprocess.call(
        ["git", "diff", "--cached", "--quiet", "--ignore-submodules", "--"],
        cwd=repo_root,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return unstaged != 0 or staged != 0


def _utc_now():
    return datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def _sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as artifact:
        for chunk in iter(lambda: artifact.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _artifact_entry(kind, path):
    filename = os.path.basename(path)
    return {
        "kind": kind,
        "path": filename,
        "sha256": _sha256_file(path),
        "size": os.path.getsize(path),
    }


def _build_manifest(repo_root, wheel_path, vsix_path, built_at=None):
    project_metadata = _read_project_metadata(os.path.join(repo_root, "pyproject.toml"))
    extension_metadata = _read_extension_metadata(
        os.path.join(repo_root, EXTENSION_DIR, "package.json")
    )

    return {
        "schema_version": BUNDLE_SCHEMA_VERSION,
        "built_at": built_at or _utc_now(),
        "package": {
            "name": project_metadata["name"],
            "version": project_metadata["version"],
            "requires_python": project_metadata.get("requires-python", ""),
        },
        "extension": {
            "name": extension_metadata["name"],
            "version": extension_metadata["version"],
            "publisher": extension_metadata.get("publisher", ""),
        },
        "git": {
            "commit": _git_commit(repo_root),
            "dirty": _git_dirty(repo_root),
        },
        "artifacts": [
            _artifact_entry("wheel", wheel_path),
            _artifact_entry("vsix", vsix_path),
        ],
    }


def _add_bytes_to_tar(bundle, arcname, data):
    info = tarfile.TarInfo(arcname)
    info.size = len(data)
    info.mtime = int(time.time())
    info.mode = 0o644
    bundle.addfile(info, fileobj=_BytesReader(data))


class _BytesReader(object):
    def __init__(self, data):
        self._data = data
        self._offset = 0

    def read(self, size=-1):
        if size is None or size < 0:
            size = len(self._data) - self._offset
        chunk = self._data[self._offset : self._offset + size]
        self._offset += len(chunk)
        return chunk


def create_bundle_from_artifacts(repo_root, wheel_path, vsix_path, output_path):
    repo_root = _as_abs_path(repo_root)
    wheel_path = _as_abs_path(wheel_path)
    vsix_path = _as_abs_path(vsix_path)
    output_path = _as_abs_path(output_path)

    if not wheel_path.endswith(".whl"):
        raise SecureBundleError("wheel artifact must end with .whl")
    if not vsix_path.endswith(".vsix"):
        raise SecureBundleError("VSIX artifact must end with .vsix")

    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    manifest = _build_manifest(repo_root, wheel_path, vsix_path)
    manifest_bytes = json.dumps(manifest, indent=2, sort_keys=True).encode("utf-8")

    artifacts_by_name = {
        manifest["artifacts"][0]["path"]: wheel_path,
        manifest["artifacts"][1]["path"]: vsix_path,
    }

    with tarfile.open(output_path, "w:gz") as bundle:
        _add_bytes_to_tar(bundle, MANIFEST_FILENAME, manifest_bytes)
        for entry in manifest["artifacts"]:
            bundle.add(artifacts_by_name[entry["path"]], arcname=entry["path"])

    verify_bundle(output_path)
    return output_path


def build_python_wheel(repo_root, wheel_dir):
    os.makedirs(wheel_dir, exist_ok=True)
    before = set(os.listdir(wheel_dir))
    _run(
        [
            sys.executable,
            "-m",
            "pip",
            "wheel",
            "--no-deps",
            "--wheel-dir",
            wheel_dir,
            repo_root,
        ],
        cwd=repo_root,
    )
    after = set(os.listdir(wheel_dir))
    new_wheels = sorted(
        os.path.join(wheel_dir, name)
        for name in after - before
        if name.endswith(".whl")
    )
    if len(new_wheels) != 1:
        raise SecureBundleError(
            "expected one newly built wheel in {}, found {}".format(
                wheel_dir, len(new_wheels)
            )
        )

    project_metadata = _read_project_metadata(os.path.join(repo_root, "pyproject.toml"))
    expected_prefix = "{}-{}".format(
        project_metadata["name"].replace("-", "_"), project_metadata["version"]
    )
    wheel_name = os.path.basename(new_wheels[0])
    if not wheel_name.startswith(expected_prefix):
        raise SecureBundleError(
            "built wheel {} does not match expected package/version {}".format(
                wheel_name, expected_prefix
            )
        )
    return new_wheels[0]


def build_vsix(repo_root, output_path):
    extension_dir = os.path.join(repo_root, EXTENSION_DIR)
    vsce_bin = os.path.join(extension_dir, "node_modules", ".bin", "vsce")
    if os.name == "nt":
        vsce_bin += ".cmd"
    if not os.path.exists(vsce_bin):
        raise SecureBundleError(
            "VSCE was not found at {}; run npm ci in {}".format(
                vsce_bin, extension_dir
            )
        )

    _run(["npm", "run", "clean"], cwd=extension_dir)
    _run(["npm", "run", "build:prod"], cwd=extension_dir)
    _run(
        [vsce_bin, "package", "--no-dependencies", "--out", output_path],
        cwd=extension_dir,
    )

    if not os.path.exists(output_path):
        raise SecureBundleError("VSIX build did not create {}".format(output_path))
    return output_path


def build_secure_bundle(repo_root, output_path, require_clean=False):
    repo_root = _as_abs_path(repo_root)
    output_path = _as_abs_path(output_path)

    if require_clean and _git_dirty(repo_root):
        raise SecureBundleError("refusing to build release bundle from dirty tree")

    work_dir = tempfile.mkdtemp(prefix="gcubed-secure-bundle-")
    try:
        wheel_dir = os.path.join(work_dir, "wheel")
        vsix_path = os.path.join(work_dir, DEFAULT_VSIX_NAME)
        wheel_path = build_python_wheel(repo_root, wheel_dir)
        build_vsix(repo_root, vsix_path)
        return create_bundle_from_artifacts(
            repo_root=repo_root,
            wheel_path=wheel_path,
            vsix_path=vsix_path,
            output_path=output_path,
        )
    finally:
        shutil.rmtree(work_dir)


def _safe_bundle_path(path):
    if not isinstance(path, str) or not path:
        return False
    if path.startswith("/") or path.startswith("\\") or "\\" in path:
        return False
    if path != posixpath.normpath(path):
        return False
    parts = path.split("/")
    if any(part in ("", ".", "..") for part in parts):
        return False
    if ":" in parts[0]:
        return False
    return True


def _validate_member(member):
    if not _safe_bundle_path(member.name):
        raise SecureBundleError("unsafe bundle member path: {}".format(member.name))
    if not member.isfile():
        raise SecureBundleError(
            "unsupported bundle member type for {}".format(member.name)
        )


def _validate_sha256(value):
    if not isinstance(value, str) or len(value) != 64:
        return False
    return all(char in "0123456789abcdef" for char in value)


def _validate_manifest(manifest):
    if not isinstance(manifest, dict):
        raise SecureBundleError("manifest must be a JSON object")
    if manifest.get("schema_version") != BUNDLE_SCHEMA_VERSION:
        raise SecureBundleError(
            "unsupported bundle schema version: {}".format(
                manifest.get("schema_version")
            )
        )
    if not isinstance(manifest.get("built_at"), str) or not manifest["built_at"]:
        raise SecureBundleError("manifest built_at is required")

    package = manifest.get("package")
    if not isinstance(package, dict):
        raise SecureBundleError("manifest package object is required")
    if package.get("name") != PACKAGE_NAME:
        raise SecureBundleError("manifest package.name must be {}".format(PACKAGE_NAME))
    if not isinstance(package.get("version"), str) or not package["version"]:
        raise SecureBundleError("manifest package.version is required")

    extension = manifest.get("extension")
    if not isinstance(extension, dict):
        raise SecureBundleError("manifest extension object is required")
    if not isinstance(extension.get("name"), str) or not extension["name"]:
        raise SecureBundleError("manifest extension.name is required")
    if not isinstance(extension.get("version"), str) or not extension["version"]:
        raise SecureBundleError("manifest extension.version is required")

    git = manifest.get("git")
    if not isinstance(git, dict):
        raise SecureBundleError("manifest git object is required")
    if not isinstance(git.get("commit"), str) or not git["commit"]:
        raise SecureBundleError("manifest git.commit is required")

    artifacts = manifest.get("artifacts")
    if not isinstance(artifacts, list) or not artifacts:
        raise SecureBundleError("manifest artifacts list is required")

    kinds = Counter()
    paths = []
    for artifact in artifacts:
        if not isinstance(artifact, dict):
            raise SecureBundleError("manifest artifact entries must be objects")
        kind = artifact.get("kind")
        path = artifact.get("path")
        if kind not in ("wheel", "vsix"):
            raise SecureBundleError("unsupported artifact kind: {}".format(kind))
        if not _safe_bundle_path(path):
            raise SecureBundleError("unsafe artifact path in manifest: {}".format(path))
        if kind == "wheel" and not path.endswith(".whl"):
            raise SecureBundleError("wheel artifact must end with .whl")
        if kind == "vsix" and not path.endswith(".vsix"):
            raise SecureBundleError("VSIX artifact must end with .vsix")
        if not _validate_sha256(artifact.get("sha256")):
            raise SecureBundleError("artifact {} has invalid sha256".format(path))
        if not isinstance(artifact.get("size"), int) or artifact["size"] < 0:
            raise SecureBundleError("artifact {} has invalid size".format(path))
        kinds[kind] += 1
        paths.append(path)

    if kinds["wheel"] != 1 or kinds["vsix"] != 1:
        raise SecureBundleError("bundle must contain exactly one wheel and one VSIX")
    if len(paths) != len(set(paths)):
        raise SecureBundleError("artifact paths must be unique")


def _load_and_verify_bundle(bundle_path):
    bundle_path = _as_abs_path(bundle_path)
    if not os.path.exists(bundle_path):
        raise SecureBundleError("bundle does not exist: {}".format(bundle_path))

    contents = {}
    with tarfile.open(bundle_path, "r:gz") as bundle:
        members = bundle.getmembers()
        names = [member.name for member in members]
        duplicates = [name for name, count in Counter(names).items() if count > 1]
        if duplicates:
            raise SecureBundleError(
                "bundle contains duplicate member paths: {}".format(
                    ", ".join(sorted(duplicates))
                )
            )

        for member in members:
            _validate_member(member)
            extracted = bundle.extractfile(member)
            if extracted is None:
                raise SecureBundleError(
                    "could not read bundle member {}".format(member.name)
                )
            contents[member.name] = extracted.read()

    if MANIFEST_FILENAME not in contents:
        raise SecureBundleError("bundle is missing {}".format(MANIFEST_FILENAME))

    try:
        manifest = json.loads(contents[MANIFEST_FILENAME].decode("utf-8"))
    except (TypeError, ValueError) as exc:
        raise SecureBundleError("bundle manifest is not valid JSON: {}".format(exc))

    _validate_manifest(manifest)

    expected_names = set(
        [MANIFEST_FILENAME] + [artifact["path"] for artifact in manifest["artifacts"]]
    )
    actual_names = set(contents)
    if actual_names != expected_names:
        missing = sorted(expected_names - actual_names)
        extra = sorted(actual_names - expected_names)
        message = []
        if missing:
            message.append("missing: {}".format(", ".join(missing)))
        if extra:
            message.append("extra: {}".format(", ".join(extra)))
        raise SecureBundleError("bundle members do not match manifest ({})".format("; ".join(message)))

    for artifact in manifest["artifacts"]:
        data = contents[artifact["path"]]
        digest = hashlib.sha256(data).hexdigest()
        if digest != artifact["sha256"]:
            raise SecureBundleError(
                "artifact {} sha256 mismatch".format(artifact["path"])
            )
        if len(data) != artifact["size"]:
            raise SecureBundleError("artifact {} size mismatch".format(artifact["path"]))

    return manifest, contents


def _write_verified_contents(contents, destination):
    destination = _as_abs_path(destination)
    os.makedirs(destination, exist_ok=True)
    for name, data in contents.items():
        target = os.path.abspath(os.path.join(destination, name))
        if not target.startswith(destination + os.sep) and target != destination:
            raise SecureBundleError("refusing to write outside {}".format(destination))
        parent = os.path.dirname(target)
        if parent:
            os.makedirs(parent, exist_ok=True)
        with open(target, "wb") as output:
            output.write(data)


def verify_bundle(bundle_path, extract_to=None):
    manifest, contents = _load_and_verify_bundle(bundle_path)
    if extract_to:
        _write_verified_contents(contents, extract_to)
    return manifest


def _basename_from_source(source):
    parsed = urlparse(source)
    path = parsed.path if parsed.scheme else source
    name = os.path.basename(path)
    return name or DEFAULT_BUNDLE_NAME


def _is_url(source):
    parsed = urlparse(source)
    return parsed.scheme in ("http", "https", "file")


def obtain_bundle(source, output_path=None, verify=True):
    if output_path is None:
        output_path = _basename_from_source(source)
    output_path = _as_abs_path(output_path)
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    if _is_url(source):
        print("Downloading {} -> {}".format(source, output_path))
        with urlopen(source) as response, open(output_path, "wb") as output:
            shutil.copyfileobj(response, output)
    else:
        print("Copying {} -> {}".format(source, output_path))
        shutil.copy2(_as_abs_path(source), output_path)

    if verify:
        verify_bundle(output_path)
    return output_path


def _artifact_path(manifest, kind):
    for artifact in manifest["artifacts"]:
        if artifact["kind"] == kind:
            return artifact["path"]
    raise SecureBundleError("bundle manifest does not contain {}".format(kind))


def _install_copy(source, destination, sudo_mode):
    use_sudo = _needs_sudo(sudo_mode)
    if use_sudo:
        _run(["sudo", "mkdir", "-p", os.path.dirname(destination)])
        _run(["sudo", "cp", source, destination])
    else:
        os.makedirs(os.path.dirname(destination), exist_ok=True)
        shutil.copy2(source, destination)


def install_bundle(
    bundle_path,
    artifact_dir=DEFAULT_ARTIFACT_DIR,
    uv_bin="uv",
    sudo_mode="auto",
    skip_python_install=False,
):
    artifact_dir = _as_abs_path(artifact_dir)
    extract_dir = tempfile.mkdtemp(prefix="gcubed-secure-bundle-install-")
    try:
        manifest = verify_bundle(bundle_path, extract_to=extract_dir)
        wheel_path = os.path.join(extract_dir, _artifact_path(manifest, "wheel"))
        vsix_path = os.path.join(extract_dir, _artifact_path(manifest, "vsix"))
        manifest_path = os.path.join(extract_dir, MANIFEST_FILENAME)

        _install_copy(
            vsix_path,
            os.path.join(artifact_dir, DEFAULT_VSIX_NAME),
            sudo_mode=sudo_mode,
        )
        _install_copy(
            manifest_path,
            os.path.join(artifact_dir, MANIFEST_FILENAME),
            sudo_mode=sudo_mode,
        )

        if not skip_python_install:
            command = [uv_bin, "pip", "install", "--system", wheel_path]
            if _needs_sudo(sudo_mode):
                command = ["sudo"] + command
            _run(command)

        return manifest
    finally:
        shutil.rmtree(extract_dir)


def _default_output_path(repo_root):
    return os.path.join(repo_root, "build", "secure-bundle", DEFAULT_BUNDLE_NAME)


def _print_manifest_summary(manifest):
    print(
        "Verified secure bundle: package {package} / extension {extension} / commit {commit}".format(
            package=manifest["package"]["version"],
            extension=manifest["extension"]["version"],
            commit=manifest["git"]["commit"],
        )
    )


def _build_parser():
    parser = argparse.ArgumentParser(
        description="Build, fetch, verify, and install G-Cubed secure bundles."
    )
    subparsers = parser.add_subparsers(dest="command")

    build_parser = subparsers.add_parser("build", help="build a secure bundle")
    build_parser.add_argument(
        "--repo-root", default=default_repo_root(), help="repository root"
    )
    build_parser.add_argument(
        "--output",
        help="bundle output path (default: build/secure-bundle/{})".format(
            DEFAULT_BUNDLE_NAME
        ),
    )
    build_parser.add_argument(
        "--require-clean",
        action="store_true",
        help="fail if the git worktree has staged or unstaged changes",
    )

    obtain_parser = subparsers.add_parser("obtain", help="download or copy a bundle")
    obtain_parser.add_argument("source", help="bundle URL or local path")
    obtain_parser.add_argument("--output", help="destination path")
    obtain_parser.add_argument(
        "--no-verify", action="store_true", help="skip verification after download"
    )

    verify_parser = subparsers.add_parser("verify", help="verify a secure bundle")
    verify_parser.add_argument("bundle", help="bundle path")
    verify_parser.add_argument("--extract-to", help="extract after verification")

    install_parser = subparsers.add_parser(
        "install", help="verify and install a secure bundle"
    )
    install_parser.add_argument("source", help="bundle URL or local path")
    install_parser.add_argument(
        "--artifact-dir",
        default=DEFAULT_ARTIFACT_DIR,
        help="directory where manifest and VSIX are deployed",
    )
    install_parser.add_argument(
        "--uv-bin", default="uv", help="uv executable used for Python installation"
    )
    install_parser.add_argument(
        "--sudo",
        choices=("auto", "always", "never"),
        default="auto",
        help="when to use sudo for install/copy operations",
    )
    install_parser.add_argument(
        "--skip-python-install",
        action="store_true",
        help="only verify and deploy VSIX/manifest",
    )

    return parser


def main(argv=None):
    parser = _build_parser()
    args = parser.parse_args(argv)

    if not args.command:
        parser.print_help()
        return 2

    try:
        if args.command == "build":
            repo_root = _as_abs_path(args.repo_root)
            output = args.output or _default_output_path(repo_root)
            bundle_path = build_secure_bundle(
                repo_root=repo_root,
                output_path=output,
                require_clean=args.require_clean,
            )
            print("Wrote secure bundle: {}".format(bundle_path))
            return 0

        if args.command == "obtain":
            obtain_bundle(
                source=args.source,
                output_path=args.output,
                verify=not args.no_verify,
            )
            return 0

        if args.command == "verify":
            manifest = verify_bundle(args.bundle, extract_to=args.extract_to)
            _print_manifest_summary(manifest)
            return 0

        if args.command == "install":
            cleanup_dir = None
            bundle_path = args.source
            if _is_url(args.source):
                cleanup_dir = tempfile.mkdtemp(prefix="gcubed-secure-bundle-fetch-")
                bundle_path = os.path.join(cleanup_dir, _basename_from_source(args.source))
                obtain_bundle(args.source, output_path=bundle_path, verify=True)
            try:
                manifest = install_bundle(
                    bundle_path=bundle_path,
                    artifact_dir=args.artifact_dir,
                    uv_bin=args.uv_bin,
                    sudo_mode=args.sudo,
                    skip_python_install=args.skip_python_install,
                )
                _print_manifest_summary(manifest)
            finally:
                if cleanup_dir:
                    shutil.rmtree(cleanup_dir)
            return 0

        parser.error("unknown command: {}".format(args.command))
        return 2
    except SecureBundleError as exc:
        print("error: {}".format(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
