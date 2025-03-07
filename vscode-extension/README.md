# G-Cubed VS Code Python Environment Switcher

## Overview
This extension works in tandem with the G-Cubed Python Virtual Environment Manager to automatically handle Python environment switching for G-Cubed economic modeling projects. It ensures the correct G-Cubed Code library build is active for both editing and execution of economic models.

## Key Features
- Automatically responds to virtual environment change requests from G-Cubed scripts
- Seamlessly switches VS Code's Python interpreter to the requested environment
- Supports both absolute and relative Python interpreter paths
- Integrates with the G-Cubed build system to ensure consistent development environments

## How It Works
When a G-Cubed economic model script runs, it can request a specific G-Cubed Code build version. The Python component of this system will:
1. Check if the requested build's virtual environment exists
2. Create and set up the environment if necessary
3. Send a request to this VS Code extension to activate the appropriate Python interpreter

This ensures that the correct dependencies are available for both code completion/linting and runtime execution.

## Requirements
- VS Code with Python extension
- G-Cubed Python virtual environment manager component installed
- Properly configured `devcontainer.json` with required environment variables

## Configuration
Ensure your `devcontainer.json` includes required port configuration:
```json
"portsAttributes": {
    "8888": {
      "label": "G-Cubed Chart",
      "onAutoForward": "openBrowser"
    },
    "9876": {
      "label": "G-Cubed venv helper",
      "onAutoForward": "ignore"
    }
}
```

## Usage
The extension operates automatically in the background. To trigger a build/environment switch from a Python script:

```python
import gcubed_build_switcher

# Activate a specific G-Cubed Code build
gcubed_build_switcher.activate_or_build_and_activate_venv("c_0002")
```

Alternatively, use the CLI tool:
```bash
gcubed-switch c_0002
