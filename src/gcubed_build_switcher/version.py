"""Runtime package version helpers."""

try:
    from importlib import metadata as importlib_metadata
except ImportError:  # pragma: no cover - Python < 3.8 compatibility path.
    try:
        import importlib_metadata
    except ImportError:  # pragma: no cover - optional backport may be absent.
        importlib_metadata = None


PACKAGE_NAME = "gcubed-build-switcher"
FALLBACK_VERSION = "1.1.4"


def get_package_version():
    if importlib_metadata is None:
        return FALLBACK_VERSION

    try:
        return importlib_metadata.version(PACKAGE_NAME)
    except importlib_metadata.PackageNotFoundError:
        return FALLBACK_VERSION
