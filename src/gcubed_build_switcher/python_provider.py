import re

from packaging.specifiers import InvalidSpecifier, SpecifierSet
from packaging.version import InvalidVersion, Version


PYTHON_VERSION_REQUEST_RE = re.compile(r"^\d+(?:\.\d+){0,2}$")


class PythonProviderError(Exception):
    """Raised when a Python request cannot be derived for uv."""
    pass


def resolve_uv_python_request_for_specifier(python_specifier: str) -> str:
    """
    Resolve wheel Requires-Python metadata to a uv Python request.

    uv owns installation and selection. This function only narrows common wheel
    specifiers into a request precise enough for `uv venv --managed-python`.
    """
    specifier_text = (python_specifier or "").strip()
    if not specifier_text:
        raise PythonProviderError(
            "Wheel Requires-Python metadata is required to choose a Python "
            "version for the G-Cubed build virtual environment."
        )

    try:
        specifier_set = SpecifierSet(specifier_text)
    except InvalidSpecifier as e:
        raise PythonProviderError(
            "Wheel Requires-Python value '{}' is not valid: {}".format(
                specifier_text,
                e,
            )
        )

    exact_request = get_exact_request(specifier_set)
    if exact_request:
        return exact_request

    lower_bound_request = get_lowest_lower_bound_request(specifier_set)
    if lower_bound_request:
        return lower_bound_request

    raise PythonProviderError(
        "Wheel Requires-Python value '{}' does not contain an exact version or "
        "a usable lower bound. Use an exact version such as '==3.13.11', or a "
        "bounded lower version such as '>=3.13,<3.14'.".format(specifier_text)
    )


def get_exact_request(specifier_set):
    for specifier in specifier_set:
        if specifier.operator != "==":
            continue

        version_text = specifier.version
        if version_text.endswith(".*"):
            version_text = version_text[:-2]

        request = normalize_python_request(version_text)
        if not specifier_set.contains(Version(request), prereleases=False):
            raise PythonProviderError(
                "Wheel Requires-Python value '{}' contains an exact version "
                "that does not satisfy the full combined constraint.".format(
                    str(specifier_set)
                )
            )
        return request

    return None


def get_lowest_lower_bound_request(specifier_set):
    lower_bounds = []

    for specifier in specifier_set:
        if specifier.operator not in (">=", "~="):
            if specifier.operator == ">":
                raise PythonProviderError(
                    "Wheel Requires-Python value '{}' uses an exclusive lower "
                    "bound. Use '>=' or an exact '==' Python version so the "
                    "switcher can make a deterministic uv request.".format(
                        str(specifier_set)
                    )
                )
            continue

        request = normalize_python_request(specifier.version)
        try:
            version = Version(request)
        except InvalidVersion as e:
            raise PythonProviderError(
                "Wheel Requires-Python lower bound '{}' is not valid: {}".format(
                    specifier.version,
                    e,
                )
            )

        lower_bounds.append((version, request))

    if not lower_bounds:
        return None

    lower_bounds.sort(key=lambda item: item[0])
    _version, request = lower_bounds[-1]

    if not specifier_set.contains(Version(request), prereleases=False):
        raise PythonProviderError(
            "Wheel Requires-Python value '{}' could not be reduced to a uv "
            "Python request that satisfies the full constraint.".format(
                str(specifier_set)
            )
        )

    return request


def normalize_python_request(version_text):
    request = (version_text or "").strip()
    if not PYTHON_VERSION_REQUEST_RE.match(request):
        raise PythonProviderError(
            "Python version request '{}' is not a supported major, major.minor, "
            "or major.minor.patch version.".format(version_text)
        )
    return request
