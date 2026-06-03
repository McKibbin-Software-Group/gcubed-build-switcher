import subprocess

from .config import get_required_uv_version


def update_uv_for_devcontainer_if_required(is_devcontainer: bool) -> bool:
    """Update uv in devcontainer-like environments before managed Python use."""
    if not is_devcontainer:
        return True

    required_uv_version = get_required_uv_version()
    print("Devcontainer detected; updating uv to {}...".format(required_uv_version))
    subprocess.run(
        ["uv", "self", "update", required_uv_version],
        check=True,
    )
    return True
