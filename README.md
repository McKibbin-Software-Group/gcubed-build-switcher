# Module Description

Different G-Cubed economic models have different dependencies on G-Cubed Code library builds.  Python scripts, which run simulations and create projections based on these models, are aware of the G-Cubed Code library version required by the model they are using.

This module provides a way to manage the dependencies of G-Cubed model simulations by creating virtual environments specific to each G-Cubed Code library build.

A set of one or more virtual environments (venvs) is created in the root of the project. Using this module the simulation scripts switch to the appropriate venv on startup.

If a required build is not available in a venv, then this module will pull the appropriate tag from the MSG python prerequisites repo, create a corresponding venv, install the requirements into that repo, and then activate that environment.

## Usage
 1. Add the following to the `devcontainer.json` root:

    ```
    "containerEnv": {
      // ensure that uv copies dependencies into the venvs - as otherwise venvs are linked from cache
      // which disappears when the container is rebuilt.
      "UV_LINK_MODE": "copy",
      "GCUBED_ROOT": "${containerWorkspaceFolder}",
      "GCUBED_PYTHON_PREREQUISITES_REPO": "https://github.com/McKibbin-Software-Group/python-gcubed-prerequisites",
      "GCUBED_CODE_PACKAGE_NAME=gcubed": "gcubed"
    },
    ```
    Note: `GCUBED_ROOT` should point to the root of your project within the container.

 2. Ensure that `uv` is being installed in the G-Cubed devcontainer

 3. Include `venv_gcubed*` in the container's `.gitignore`

 3. At the beginning of a simulation script import the `activate_or_build_and_activate_venv` functionion from this module and pass it a G-Cubed Code build tag which corresponds with a tag in the G-Cubed Code repo.  If that completes successfully then continue as normal with your script.

 A simple example of how to use this is in the `main()` function of the module.
