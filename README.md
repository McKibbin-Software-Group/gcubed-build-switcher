# Project Overview

Different G-Cubed economic models have different dependencies on G-Cubed Code library "builds" (versions).  Python scripts, which run simulations and create projections based on these models, need the correct build of the G-Cubed Code library to be installed and active. This is required both for the VS Code editor to work correctly (linting, completion, hints, etc) and in order for the models to run correctly.

This project provides a way to manage the dependencies of G-Cubed model simulations by creating and maintaining Python virtual environments specific to each G-Cubed Code library build, and by enabling simple activation of the correct build at run time.

If a required build is not available in a local virtual environment then this will pull the appropriate build from the MSG python prerequisites repo, create a corresponding virtual environment, install all prerequisites, and then activate that environment.

## A tale of two cities

This repo consists of two components:
1. A Python virtual environment manager & virtual environment change requestor
1. A JavaScript VS Code extension which listens for virtual environment change requests and then, using the VS Code internal API, changes to the requested Python virtual environment. This is currently packaged as an internal VS Code extension `.vsix` file. May in future be deployed to a Marketplace for easier install (and could possibly be enhanced so that it manages the Python part install as well)


## Installation

The outputs of this repo are assumed to be used by G-Cubed customer devcontainers built from the [G-Cubed Devcontainer Template](https://github.com/McKibbin-Software-Group/gcubed-devcontainer-template).

This template pulls all prerequisites from files attached to the 'latest' tag of [this repo on GitHub](https://github.com/McKibbin-Software-Group/gcubed-build-switcher) at container build stage.  For instructions on creating a GitHub release see this [README.md](release-files/README.md).


## Usage
A CLI tool is provided in the target environment:
```bash
gcubed-switch [build_tag]
```

### Building into G-Cubed Python Scripts
At the beginning of a simulation script import the `activate_or_build_and_activate_venv` function from this module and pass it a G-Cubed Code build tag which corresponds with a tag in the G-Cubed Code repo.  If that completes successfully then continue as normal with your script.

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

