import errno
import hashlib
import json
import os
import platform
import re
import shutil
import subprocess
import tarfile
import tempfile
import time
import urllib.request

from .config import (
    DEFAULT_PYTHON_PROVIDER_ORDER,
    get_python_download_timeout_seconds,
    get_python_install_root,
    get_python_prebuilt_manifest_url,
    get_python_provider_order,
)


VERSION_CHECK_CODE = (
    "import sys; print('.'.join(map(str, sys.version_info[:3])))"
)
EXACT_VERSION_RE = re.compile(r"^\d+\.\d+\.\d+$")
VERSION_IN_PATH_RE = re.compile(r"(?<!\d)(\d+\.\d+\.\d+)(?!\d)")
PYTHON_VALIDATION_ENV_VARS_TO_CLEAR = (
    "PYTHONHOME",
    "PYTHONPATH",
    "LD_LIBRARY_PATH",
    "DYLD_LIBRARY_PATH",
)


class PythonProviderError(Exception):
    """Raised when a requested Python interpreter cannot be resolved."""
    pass


class ProviderResult(object):
    def __init__(self, ok, path=None, message=None):
        self.ok = ok
        self.path = path
        self.message = message


def ensure_python_available(python_request):
    """
    Resolve a requested Python version or absolute interpreter path.

    Args:
        python_request (str): Exact version such as "3.13.11" or an absolute path.

    Returns:
        str: Absolute path to a validated local Python executable.
    """
    request = (python_request or "").strip()
    if not request:
        raise PythonProviderError("No Python version was requested.")

    if os.path.isabs(request):
        return ensure_explicit_python_path(request)

    if not is_exact_python_version(request):
        raise PythonProviderError(
            "Python version '{}' is not an exact major.minor.patch version. "
            "Please contact G-Cubed support.".format(request)
        )

    version = request
    install_root = get_python_install_root()
    state = {
        "platform": get_platform_identifier(),
        "cache_path": get_cache_python_path(version, install_root),
        "manifest_reachable": False,
        "matching_archive_found": False,
    }
    failures = []

    for provider_name in get_provider_order():
        if provider_name == "cache":
            result = cache_provider(version, install_root)
        elif provider_name == "path":
            result = path_provider(version)
        elif provider_name == "system":
            result = system_provider(version)
        elif provider_name == "prebuilt":
            result = prebuilt_provider(version, install_root, state)
        else:
            result = ProviderResult(
                False,
                message="Unknown provider '{}'.".format(provider_name),
            )

        if result.ok:
            return result.path
        if result.message:
            failures.append("{}: {}".format(provider_name, result.message))

    raise PythonProviderError(build_support_message(version, state, failures))


def ensure_explicit_python_path(python_path):
    expected_version = infer_version_from_path(python_path)
    ok, absolute_path, reported_version, message = validate_python_executable(
        python_path,
        expected_version=expected_version,
    )
    if ok:
        print(
            "Using explicit Python interpreter {} ({})".format(
                absolute_path,
                reported_version,
            )
        )
        return absolute_path

    expected_text = ""
    if expected_version:
        expected_text = " Expected version inferred from path: {}.".format(
            expected_version
        )
    raise PythonProviderError(
        "Unable to use explicit Python interpreter '{}'.{} {}".format(
            python_path,
            expected_text,
            message,
        )
    )


def is_exact_python_version(value):
    return bool(EXACT_VERSION_RE.match(value or ""))


def infer_version_from_path(path):
    matches = VERSION_IN_PATH_RE.findall(path or "")
    if not matches:
        return None
    return matches[-1]


def get_provider_order():
    value = get_python_provider_order()
    if value is None:
        value = DEFAULT_PYTHON_PROVIDER_ORDER
    return [
        item.strip().lower()
        for item in value.split(",")
        if item.strip()
    ]


def get_cache_python_path(version, install_root=None):
    if install_root is None:
        install_root = get_python_install_root()
    return os.path.abspath(
        os.path.join(install_root, "versions", version, "bin", "python")
    )


def cache_provider(version, install_root=None):
    python_path = get_cache_python_path(version, install_root)
    ok, absolute_path, reported_version, message = validate_python_executable(
        python_path,
        expected_version=version,
    )
    if ok:
        return ProviderResult(True, path=absolute_path)
    return ProviderResult(False, message=message)


def path_provider(version):
    return ProviderResult(
        False,
        message=(
            "No explicit absolute interpreter path was requested; "
            "'.python-version' requested version {}."
        ).format(version),
    )


def system_provider(version):
    major, minor, _patch = version.split(".")
    candidate_names = [
        "python{}.{}".format(major, minor),
        "python{}".format(major),
        "python3",
        "python",
    ]
    seen_paths = set()
    failures = []

    for candidate_name in candidate_names:
        candidate_path = shutil.which(candidate_name)
        if not candidate_path:
            failures.append("{} not found on PATH".format(candidate_name))
            continue

        absolute_path = os.path.abspath(candidate_path)
        if absolute_path in seen_paths:
            continue
        seen_paths.add(absolute_path)

        ok, validated_path, _reported_version, message = validate_python_executable(
            absolute_path,
            expected_version=version,
        )
        if ok:
            return ProviderResult(True, path=validated_path)
        failures.append("{}: {}".format(candidate_name, message))

    return ProviderResult(False, message="; ".join(failures))


def prebuilt_provider(version, install_root=None, state=None):
    if install_root is None:
        install_root = get_python_install_root()
    if state is None:
        state = {
            "platform": get_platform_identifier(),
            "manifest_reachable": False,
            "matching_archive_found": False,
        }

    manifest_url = get_python_prebuilt_manifest_url()
    timeout_seconds = get_python_download_timeout_seconds()
    if not manifest_url:
        return ProviderResult(
            False,
            message="GCUBED_PYTHON_PREBUILT_MANIFEST_URL is empty.",
        )

    try:
        manifest = fetch_json_url(manifest_url, timeout_seconds)
        state["manifest_reachable"] = True
    except Exception as e:
        return ProviderResult(
            False,
            message="Could not fetch manifest {}: {}".format(manifest_url, e),
        )

    platform_id = state.get("platform") or get_platform_identifier()
    archive = find_manifest_archive(manifest, version, platform_id)
    if not archive:
        return ProviderResult(
            False,
            message=(
                "Manifest does not contain CPython {} for platform {}."
            ).format(version, platform_id),
        )
    state["matching_archive_found"] = True

    archive_format = archive.get("archive_format")
    if archive_format != "tar.gz":
        return ProviderResult(
            False,
            message="Unsupported archive format '{}'.".format(archive_format),
        )

    try:
        os.makedirs(install_root, exist_ok=True)
    except OSError as e:
        return ProviderResult(
            False,
            message="Could not create Python install root {}: {}".format(
                install_root,
                e,
            ),
        )

    lock_dir = None
    try:
        lock_dir = acquire_install_lock(version, install_root, timeout_seconds)

        cached = cache_provider(version, install_root)
        if cached.ok:
            return cached

        return install_prebuilt_archive(version, install_root, archive, timeout_seconds)

    except Exception as e:
        return ProviderResult(False, message=str(e))
    finally:
        if lock_dir:
            release_install_lock(lock_dir)


def install_prebuilt_archive(version, install_root, archive, timeout_seconds):
    archive_url = archive.get("url")
    expected_sha256 = archive.get("sha256")
    archive_python = archive.get(
        "python",
        os.path.join("versions", version, "bin", "python"),
    )

    if not archive_url:
        return ProviderResult(False, message="Matching archive has no URL.")
    if not expected_sha256:
        return ProviderResult(False, message="Matching archive has no SHA256.")
    if not is_safe_relative_path(archive_python):
        return ProviderResult(
            False,
            message="Manifest Python path is unsafe: {}".format(archive_python),
        )

    archive_path = None
    extract_dir = None
    target_version_dir = os.path.join(install_root, "versions", version)
    created_target = False

    try:
        fd, archive_path = tempfile.mkstemp(
            prefix="gcubed-python-",
            suffix=".tar.gz",
            dir=install_root,
        )
        os.close(fd)
        download_url_to_file(archive_url, archive_path, timeout_seconds)

        actual_sha256 = sha256_file(archive_path)
        if actual_sha256.lower() != expected_sha256.lower():
            return ProviderResult(
                False,
                message=(
                    "Checksum mismatch for {}. Expected {}, got {}."
                ).format(archive_url, expected_sha256, actual_sha256),
            )

        extract_dir = tempfile.mkdtemp(
            prefix=".gcubed-python-extract-",
            dir=install_root,
        )
        safe_extract_tar(archive_path, extract_dir)

        extracted_python = os.path.join(extract_dir, archive_python)
        ok, _path, reported_version, message = validate_python_executable(
            extracted_python,
            expected_version=version,
        )
        if not ok:
            if reported_version:
                asset_name = archive.get("asset_name") or archive_url
                return ProviderResult(
                    False,
                    message=(
                        "Prebuilt archive metadata mismatch. Manifest advertised "
                        "CPython {expected}, but {asset} contains Python {actual}. "
                        "Archive URL: {url}"
                    ).format(
                        expected=version,
                        asset=asset_name,
                        actual=reported_version,
                        url=archive_url,
                    ),
                )
            return ProviderResult(
                False,
                message="Extracted Python failed validation: {}".format(message),
            )

        extracted_version_dir = os.path.join(extract_dir, "versions", version)
        if not os.path.isdir(extracted_version_dir):
            return ProviderResult(
                False,
                message=(
                    "Archive did not contain expected directory {}."
                ).format(os.path.join("versions", version)),
            )

        os.makedirs(os.path.dirname(target_version_dir), exist_ok=True)
        if os.path.exists(target_version_dir):
            return ProviderResult(
                False,
                message=(
                    "Cache directory {} already exists but did not validate; "
                    "not overwriting it."
                ).format(target_version_dir),
            )

        os.rename(extracted_version_dir, target_version_dir)
        created_target = True

        cached = cache_provider(version, install_root)
        if cached.ok:
            return cached

        if created_target:
            shutil.rmtree(target_version_dir, ignore_errors=True)
            created_target = False
        return ProviderResult(
            False,
            message="Installed Python failed validation after move.",
        )

    finally:
        if archive_path and os.path.exists(archive_path):
            os.remove(archive_path)
        if extract_dir and os.path.exists(extract_dir):
            shutil.rmtree(extract_dir, ignore_errors=True)


def acquire_install_lock(version, install_root, timeout_seconds):
    locks_dir = os.path.join(install_root, ".locks")
    os.makedirs(locks_dir, exist_ok=True)
    lock_dir = os.path.join(locks_dir, "python-{}.lock".format(version))
    deadline = time.time() + timeout_seconds

    while True:
        cached = cache_provider(version, install_root)
        if cached.ok:
            return None

        try:
            os.mkdir(lock_dir)
            return lock_dir
        except OSError as e:
            if e.errno != errno.EEXIST:
                raise
            if time.time() >= deadline:
                raise RuntimeError(
                    "Timed out waiting for Python install lock {}.".format(lock_dir)
                )
            time.sleep(0.25)


def release_install_lock(lock_dir):
    try:
        os.rmdir(lock_dir)
    except OSError:
        pass


def validate_python_executable(python_path, expected_version=None):
    absolute_path = os.path.abspath(python_path)
    if not os.path.exists(absolute_path):
        return False, absolute_path, None, "Python executable not found at {}".format(
            absolute_path
        )
    if not os.path.isfile(absolute_path):
        return False, absolute_path, None, "{} is not a file".format(absolute_path)
    if not os.access(absolute_path, os.X_OK):
        return False, absolute_path, None, "{} is not executable".format(absolute_path)

    try:
        completed = subprocess.run(
            [absolute_path, "-c", VERSION_CHECK_CODE],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
            timeout=10,
            env=get_python_validation_env(),
        )
    except Exception as e:
        return False, absolute_path, None, "Could not run {}: {}".format(
            absolute_path,
            e,
        )

    output_lines = completed.stdout.strip().splitlines()
    if not output_lines:
        return False, absolute_path, None, "{} did not report a Python version".format(
            absolute_path
        )

    reported_version = output_lines[0]
    if expected_version and reported_version != expected_version:
        return (
            False,
            absolute_path,
            reported_version,
            "{} reported Python {}, expected {}".format(
                absolute_path,
                reported_version,
                expected_version,
            ),
        )

    return True, absolute_path, reported_version, None


def get_python_validation_env():
    env = os.environ.copy()
    for name in PYTHON_VALIDATION_ENV_VARS_TO_CLEAR:
        env.pop(name, None)
    return env


def fetch_json_url(url, timeout_seconds):
    with urllib.request.urlopen(url, timeout=timeout_seconds) as response:
        payload = response.read()
    return json.loads(payload.decode("utf-8"))


def download_url_to_file(url, destination, timeout_seconds):
    with urllib.request.urlopen(url, timeout=timeout_seconds) as response:
        with open(destination, "wb") as f:
            shutil.copyfileobj(response, f)


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def find_manifest_archive(manifest, version, platform_id):
    for archive in manifest.get("archives", []):
        if archive.get("implementation") != "cpython":
            continue
        if archive.get("version") != version:
            continue
        if archive.get("platform") != platform_id:
            continue
        return archive
    return None


def safe_extract_tar(archive_path, destination):
    with tarfile.open(archive_path, "r:gz") as tar:
        members = tar.getmembers()
        for member in members:
            validate_tar_member(member, destination)
        tar.extractall(destination, members)


def validate_tar_member(member, destination):
    member_name = member.name
    if not is_safe_relative_path(member_name):
        raise ValueError("Unsafe archive member path: {}".format(member_name))

    destination_abs = os.path.abspath(destination)
    target_path = os.path.abspath(os.path.join(destination_abs, member_name))
    if not is_within_directory(destination_abs, target_path):
        raise ValueError("Archive member escapes destination: {}".format(member_name))

    if member.issym() or member.islnk():
        link_name = member.linkname
        if not is_safe_relative_path(link_name):
            raise ValueError(
                "Unsafe archive link target: {} -> {}".format(member_name, link_name)
            )
        link_target = os.path.abspath(
            os.path.join(os.path.dirname(target_path), link_name)
        )
        if not is_within_directory(destination_abs, link_target):
            raise ValueError(
                "Archive link target escapes destination: {} -> {}".format(
                    member_name,
                    link_name,
                )
            )


def is_safe_relative_path(path):
    if not path or os.path.isabs(path):
        return False
    normalized = path.replace("\\", "/")
    parts = normalized.split("/")
    return ".." not in parts


def is_within_directory(directory, target):
    directory_abs = os.path.abspath(directory)
    target_abs = os.path.abspath(target)
    try:
        return os.path.commonpath([directory_abs, target_abs]) == directory_abs
    except ValueError:
        return False


def get_platform_identifier():
    system = platform.system().lower()
    machine = normalize_machine(platform.machine())

    if system == "linux":
        libc_name, _libc_version = platform.libc_ver()
        libc = "glibc" if libc_name == "glibc" else (libc_name or "unknown")
        return "linux-{}-{}".format(machine, libc)

    if system == "darwin":
        return "macos-{}".format(machine)

    return "{}-{}".format(system or "unknown", machine or "unknown")


def normalize_machine(machine):
    value = (machine or "").lower()
    if value in ("amd64", "x64"):
        return "x86_64"
    if value in ("aarch64", "arm64"):
        return "arm64"
    return value or "unknown"


def build_support_message(version, state, failures):
    manifest_reachable = "yes" if state.get("manifest_reachable") else "no"
    matching_archive = "yes" if state.get("matching_archive_found") else "no"

    lines = [
        "Unable to obtain required Python {} for platform {}.".format(
            version,
            state.get("platform") or get_platform_identifier(),
        ),
        (
            "Checked local cache, explicit/system interpreters, "
            "and MSG prebuilt archives."
        ),
        "Cache path checked: {}".format(state.get("cache_path") or "unknown"),
        "Prebuilt manifest reachable: {}".format(manifest_reachable),
        "Matching prebuilt archive found: {}".format(matching_archive),
        (
            "Please contact G-Cubed support and provide this Python version "
            "and platform."
        ),
    ]

    if failures:
        lines.append("Provider details:")
        lines.extend(["- {}".format(failure) for failure in failures])

    return "\n".join(lines)
