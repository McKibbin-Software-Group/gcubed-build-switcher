#!/usr/bin/env python3
"""Synchronize release version metadata from the repo VERSION file."""

from __future__ import print_function

import argparse
import json
import os
import re
import subprocess
import sys


VERSION_FILE = "VERSION"
ROOT_PYPROJECT = "pyproject.toml"
RELEASE_PYPROJECT = os.path.join("release-files", "pyproject.toml")
RUNTIME_VERSION = os.path.join("src", "gcubed_build_switcher", "version.py")
EXTENSION_PACKAGE = os.path.join("vscode-extension", "package.json")
EXTENSION_LOCK = os.path.join("vscode-extension", "package-lock.json")

VERSION_RE = re.compile(r"^[0-9]+[.][0-9]+[.][0-9]+$")
PYPROJECT_VERSION_RE = re.compile(r'(?m)^(version\s*=\s*)"([^"]*)"')
RUNTIME_FALLBACK_RE = re.compile(r'(?m)^(FALLBACK_VERSION\s*=\s*)"([^"]*)"')


class VersionSyncError(Exception):
    """Raised when version metadata cannot be synchronized."""


def default_repo_root():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def normalize_version(version):
    version = (version or "").strip()
    if version.startswith("refs/tags/"):
        version = version[len("refs/tags/") :]
    if version.startswith("v"):
        version = version[1:]
    if not VERSION_RE.match(version):
        raise VersionSyncError(
            "version must use MAJOR.MINOR.PATCH format, got {!r}".format(version)
        )
    return version


def read_version_file(repo_root):
    path = os.path.join(repo_root, VERSION_FILE)
    with open(path, "r") as version_file:
        return normalize_version(version_file.read())


def bump_version(version, bump):
    major, minor, patch = [int(part) for part in normalize_version(version).split(".")]
    if bump == "major":
        return "{}.0.0".format(major + 1)
    if bump == "minor":
        return "{}.{}.0".format(major, minor + 1)
    if bump == "patch":
        return "{}.{}.{}".format(major, minor, patch + 1)
    raise VersionSyncError("unsupported version bump: {}".format(bump))


def _run_output(command, cwd=None):
    try:
        return subprocess.check_output(
            command, cwd=cwd, stderr=subprocess.DEVNULL
        ).decode("utf-8").strip()
    except (OSError, subprocess.CalledProcessError):
        return ""


def version_from_build_environment(repo_root):
    version = version_from_optional_build_environment(repo_root)
    if version:
        return version

    raise VersionSyncError(
        "could not infer version from GCUBED_BUILD_SWITCHER_VERSION, "
        "GITHUB_REF_NAME, GITHUB_REF, or an exact git tag"
    )


def version_from_optional_build_environment(repo_root):
    explicit = os.environ.get("GCUBED_BUILD_SWITCHER_VERSION")
    if explicit:
        return normalize_version(explicit)

    github_ref = os.environ.get("GITHUB_REF")
    if github_ref and github_ref.startswith("refs/tags/"):
        return normalize_version(github_ref)

    github_ref_name = os.environ.get("GITHUB_REF_NAME")
    if github_ref_name:
        try:
            return normalize_version(github_ref_name)
        except VersionSyncError:
            pass

    tag = _run_output(["git", "describe", "--tags", "--exact-match"], cwd=repo_root)
    if tag:
        return normalize_version(tag)

    return None


def _read_text(path):
    with open(path, "r") as source:
        return source.read()


def _write_text(path, content):
    with open(path, "w") as target:
        target.write(content)


def _replace_one(pattern, replacement, content, path):
    updated, count = pattern.subn(replacement, content, count=1)
    if count != 1:
        raise VersionSyncError("could not find version metadata in {}".format(path))
    return updated


def _sync_text_file(path, update_content, check):
    original = _read_text(path)
    updated = update_content(original)
    if original == updated:
        return False
    if check:
        return True
    _write_text(path, updated)
    return True


def _sync_json_package(path, version, check):
    with open(path, "r") as package_file:
        package_data = json.load(package_file)

    changed = package_data.get("version") != version
    package_data["version"] = version

    if not changed:
        return False
    if check:
        return True

    with open(path, "w") as package_file:
        json.dump(package_data, package_file, indent=2)
        package_file.write("\n")
    return True


def _sync_package_lock(path, version, check):
    with open(path, "r") as lock_file:
        lock_data = json.load(lock_file)

    changed = False
    if lock_data.get("version") != version:
        lock_data["version"] = version
        changed = True

    root_package = lock_data.get("packages", {}).get("")
    if root_package is None:
        raise VersionSyncError("could not find root package in {}".format(path))
    if root_package.get("version") != version:
        root_package["version"] = version
        changed = True

    if not changed:
        return False
    if check:
        return True

    with open(path, "w") as lock_file:
        json.dump(lock_data, lock_file, indent=2)
        lock_file.write("\n")
    return True


def sync_version(repo_root, version, check=False):
    repo_root = os.path.abspath(repo_root)
    version = normalize_version(version)
    changed = []

    def sync(relative_path, callback):
        path = os.path.join(repo_root, relative_path)
        if callback(path):
            changed.append(relative_path)

    sync(
        VERSION_FILE,
        lambda path: _sync_text_file(
            path, lambda _content: version + "\n", check=check
        ),
    )
    sync(
        ROOT_PYPROJECT,
        lambda path: _sync_text_file(
            path,
            lambda content: _replace_one(
                PYPROJECT_VERSION_RE, r'\g<1>"{}"'.format(version), content, path
            ),
            check=check,
        ),
    )
    sync(
        RELEASE_PYPROJECT,
        lambda path: _sync_text_file(
            path,
            lambda content: _replace_one(
                PYPROJECT_VERSION_RE, r'\g<1>"{}"'.format(version), content, path
            ),
            check=check,
        ),
    )
    sync(
        RUNTIME_VERSION,
        lambda path: _sync_text_file(
            path,
            lambda content: _replace_one(
                RUNTIME_FALLBACK_RE, r'\g<1>"{}"'.format(version), content, path
            ),
            check=check,
        ),
    )
    sync(EXTENSION_PACKAGE, lambda path: _sync_json_package(path, version, check))
    sync(EXTENSION_LOCK, lambda path: _sync_package_lock(path, version, check))

    if check and changed:
        raise VersionSyncError(
            "version metadata is out of sync with {} {}: {}".format(
                VERSION_FILE, version, ", ".join(changed)
            )
        )
    return changed


def check_version_files(repo_root, version=None):
    version = version or read_version_file(repo_root)
    return sync_version(repo_root, version, check=True)


def parse_args(argv):
    parser = argparse.ArgumentParser(
        description="Synchronize Python, VS Code extension, and release metadata versions."
    )
    parser.add_argument(
        "--repo-root",
        default=default_repo_root(),
        help="repository root (default: parent of this script directory)",
    )

    source = parser.add_mutually_exclusive_group()
    source.add_argument("--version", help="explicit MAJOR.MINOR.PATCH version")
    source.add_argument(
        "--bump",
        choices=["major", "minor", "patch"],
        help="bump the current VERSION file",
    )
    source.add_argument(
        "--from-build-env",
        action="store_true",
        help="read version from GCUBED_BUILD_SWITCHER_VERSION, GitHub ref, or exact git tag",
    )

    parser.add_argument(
        "--check",
        action="store_true",
        help="fail if files are not already synchronized",
    )
    return parser.parse_args(argv)


def select_version(repo_root, args):
    if args.version:
        return normalize_version(args.version)
    if args.bump:
        return bump_version(read_version_file(repo_root), args.bump)
    if args.from_build_env:
        return version_from_build_environment(repo_root)
    return read_version_file(repo_root)


def main(argv=None):
    args = parse_args(argv)
    repo_root = os.path.abspath(args.repo_root)

    try:
        version = select_version(repo_root, args)
        changed = sync_version(repo_root, version, check=args.check)
    except VersionSyncError as error:
        print("ERROR: {}".format(error), file=sys.stderr)
        return 1

    if args.check:
        print("Version metadata is synchronized at {}".format(version))
    elif changed:
        print("Synchronized version {} in: {}".format(version, ", ".join(changed)))
    else:
        print("Version metadata already synchronized at {}".format(version))
    return 0


if __name__ == "__main__":
    sys.exit(main())
