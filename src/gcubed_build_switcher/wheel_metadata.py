import zipfile
from email.parser import Parser
from typing import Iterable, Optional


class WheelMetadataError(Exception):
    """Raised when wheel metadata cannot be read."""
    pass


def get_wheel_requires_python(wheel_path: str) -> Optional[str]:
    """Read the Requires-Python metadata field from a wheel file."""
    try:
        with zipfile.ZipFile(wheel_path) as wheel:
            metadata_names = [
                name
                for name in wheel.namelist()
                if name.endswith(".dist-info/METADATA")
            ]
            if not metadata_names:
                return None

            with wheel.open(metadata_names[0]) as metadata_file:
                metadata = metadata_file.read().decode("utf-8")

    except (OSError, UnicodeDecodeError, zipfile.BadZipFile) as e:
        raise WheelMetadataError(
            "Could not read wheel metadata from {}: {}".format(wheel_path, e)
        )

    return Parser().parsestr(metadata).get("Requires-Python")


def get_combined_requires_python(wheel_paths: Iterable[str]) -> Optional[str]:
    """Combine all Requires-Python constraints declared by local wheel files."""
    requirements = []
    seen = set()

    for wheel_path in wheel_paths:
        requires_python = get_wheel_requires_python(wheel_path)
        if not requires_python:
            continue

        requires_python = requires_python.strip()
        if requires_python and requires_python not in seen:
            seen.add(requires_python)
            requirements.append(requires_python)

    if not requirements:
        return None

    return ",".join(requirements)
