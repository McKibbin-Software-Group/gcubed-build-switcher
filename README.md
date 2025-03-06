# Project Overview

Different G-Cubed economic models have different dependencies on G-Cubed Code library "builds" (versions).  Python scripts, which run simulations and create projections based on these models, need the correct build of the G-Cubed Code library to be installed and active. This is required both for the VS Code editor to work correctly (linting, completion, hints, etc) and in order for the models to run correctly.

This project provides a way to manage the dependencies of G-Cubed model simulations by creating and maintaining Python virtual environments specific to each G-Cubed Code library build, and by enabling simple activation of the correct build at run time.

If a required build is not available in a local virtual environment then this will pull the appropriate build from the MSG python prerequisites repo, create a corresponding virtual environment, install all prerequisites, and then activate that environment.

## A tale of two cities

This repo consists of two components:
1. A Python virtual environment manager & virtual environment change requestor
1. A JavaScript VS Code extension which listens for virtual environment change requests and then, using the VS Code internal API, changes to the requested Python virtual environment


## Installation
 1. Add the following to the `devcontainer.json` root of the repository requiring this capability:

    ```json
    "containerEnv": {
      // ensure that uv copies dependencies into the venvs - as otherwise venvs are linked from cache
      // which disappears when the container is rebuilt.
      "UV_LINK_MODE": "copy",
      "GCUBED_ROOT": "${containerWorkspaceFolder}{{USER_DATA_SUBDIRECTORY}}",
      "GCUBED_PYTHON_PREREQUISITES_REPO": "https://github.com/McKibbin-Software-Group/python-gcubed-prerequisites",
      "GCUBED_CODE_PACKAGE_NAME=gcubed": "gcubed"
    },
    ```
    **NOTE:** `GCUBED_ROOT` should point to the root of your G-Cubed `project` within the container, not the root of the container.

    **NOTE:**  If you want to disable the auto build switching for a customer/devcontainer, set any value for GCUBED_CODE_AUTO_BUILD_SWITCHER_DISABLED (eg TRUE) in the environment. This can be set in the customer-configuration.env file for a 'permanent' change to a specific repo's devcontainer, or can be export/unset on the fly in a terminal session.

 2. Ensure that `uv` is being installed in the G-Cubed devcontainer

 3. Include `venv_gcubed*` in the container's `.gitignore`

 4. The following TOML file is separately attached to the release so that the `gcubed-setup.sh` script or similar method can install the file and use a tool such as 'uv' to install the dependency into global (--system) space:

 ```toml
[project]
name = "G-Cubed_Economic_Modelling"
version = "1.0.0"
dependencies = [
    "gcubed-build-switcher @ git+https://github.com/McKibbin-Software-Group/gcubed-build-switcher@main"
]

```

If using `uv` to install the dependency then the command would be something like:

```
sudo $(which uv) pip install --system -r pyproject.toml
```

 5. At the beginning of a simulation script import the `activate_or_build_and_activate_venv` function from this module and pass it a G-Cubed Code build tag which corresponds with a tag in the G-Cubed Code repo.  If that completes successfully then continue as normal with your script.


## Usage
A CLI tool is provided in the target environment:
```bash
gcubed-switch [build_tag]
```
### End-user python script example
A simple python script which invokes this module & requests a venv switch. Takes the gcubed code build tag from command-line or defaults to a preset version.

```Python
import gcubed_build_switcher
import sys

# Take build tag from command line or use default
gcubed_code_build_tag = sys.argv[1] if len(sys.argv) > 1 else "c_0002"

# Returns True or False
result = gcubed_build_switcher.activate_or_build_and_activate_venv(gcubed_code_build_tag)
print(f"Result: {"It Verked!!" if result is True else "Oh noes!"}")

```



## Testing
If testing locally in the dev environment:
```bash
python -m src.gcubed_build_switcher.cli [build_tag]
```

