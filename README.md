# Project Overview

Different G-Cubed economic models have different dependencies on G-Cubed Code library "builds" (versions).  Python scripts, which run simulations and create projections based on these models, need the correct build of the G-Cubed Code library to be installed and active. This is required both for the VS Code editor to work correctly (linting, completion, hints, etc) and in order for the models to run correctly.

This project provides a way to manage the dependencies of G-Cubed model simulations by creating and maintaining Python virtual environments specific to each G-Cubed Code library build, and by enabling simple activation of the correct build at run time.

If a required build is not available in a local virtual environment then this will pull the appropriate build from the MSG python prerequisites repo, create a corresponding virtual environment, install all prerequisites, and then activate that environment.

## A tale of two cities

This repo consists of two components:
1. A Python virtual environment manager & virtual environment change requestor
2. A JavaScript VS Code extension which listens for virtual environment change requests and then, using the VS Code internal API, changes to the requested Python virtual environment


## Usage
 1. Add the following to the `devcontainer.json` root of the repository requiring this capability:

    ```json
    "containerEnv": {
      // ensure that uv copies dependencies into the venvs - as otherwise venvs are linked from cache
      // which disappears when the container is rebuilt.
      "UV_LINK_MODE": "copy",
      "GCUBED_ROOT": "${containerWorkspaceFolder}",
      "GCUBED_PYTHON_PREREQUISITES_REPO": "https://github.com/McKibbin-Software-Group/python-gcubed-prerequisites",
      "GCUBED_CODE_PACKAGE_NAME=gcubed": "gcubed"
    },
    ```
    **NOTE:** `GCUBED_ROOT` should point to the root of your G-Cubed `project` within the container, not the root of the container.

    **NOTE:**  If you want to disable the auto build switching for a customer/devcontainer, set any value for GCUBED_CODE_AUTO_BUILD_SWITCHER_DISABLED (eg TRUE) in the environment. This can be set in the customer-configuration.env file for a 'permanent' change to a specific repo's devcontainer, or can be export/unset on the fly in a terminal session.

 2. Ensure that `uv` is being installed in the G-Cubed devcontainer

 3. Include `venv_gcubed*` in the container's `.gitignore`

 4. Inject a dependency on this repo into the target container's root `pyproject.toml`:

 ```toml
 [project]
dependencies = [
    { git = "https://github.com/McKibbin-Software-Group/gcubed-build-switcher", branch = "main" }
]
```

Assuming that the target project is running `uv` on container start (defined in that container's `devcontainer.json`) then uv will automatically install/update this project's module into the Python global context. The `devcontainer.json` should include something like the following:

  ```json
  "postStartCommand ": "sudo uv pip install --system -r pyproject.toml"
  ```

 5. At the beginning of a simulation script import the `activate_or_build_and_activate_venv` function from this module and pass it a G-Cubed Code build tag which corresponds with a tag in the G-Cubed Code repo.  If that completes successfully then continue as normal with your script.


## Testing

```bash
python -m src.gcubed_build_switcher.cli adb_0001
```

## End-user python script example
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
