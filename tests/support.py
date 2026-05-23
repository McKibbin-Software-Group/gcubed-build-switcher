import os
import stat
import sys
import zipfile
from urllib.request import pathname2url


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_ROOT = os.path.join(REPO_ROOT, "src")


def add_src_to_path():
    if SRC_ROOT not in sys.path:
        sys.path.insert(0, SRC_ROOT)


add_src_to_path()


def file_url(path):
    return "file://" + pathname2url(os.path.abspath(path))


def create_fake_python(path, version):
    parent = os.path.dirname(path)
    if not os.path.exists(parent):
        os.makedirs(parent)
    with open(path, "w") as f:
        f.write("#!/bin/sh\n")
        f.write("printf '%s\\n' '{}'\n".format(version))
    os.chmod(path, stat.S_IRUSR | stat.S_IWUSR | stat.S_IXUSR)
    return path


def create_fake_wheel(path, name="gcubed", version="1.0.0", requires_python=None):
    metadata_lines = [
        "Metadata-Version: 2.1",
        "Name: {}".format(name),
        "Version: {}".format(version),
    ]
    if requires_python:
        metadata_lines.append("Requires-Python: {}".format(requires_python))

    metadata = "\n".join(metadata_lines) + "\n\n"
    dist_info = "{}-{}.dist-info".format(name, version)
    with zipfile.ZipFile(path, "w") as wheel:
        wheel.writestr("{}/METADATA".format(dist_info), metadata)
        wheel.writestr("{}/WHEEL".format(dist_info), "Wheel-Version: 1.0\n")
    return path
