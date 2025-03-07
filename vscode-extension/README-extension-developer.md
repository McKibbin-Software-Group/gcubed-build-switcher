# G-Cubed VSCode python venv switcher

This project is used by the Python project in this repo.

***Start in a devcontainer***

Don't forget to `npm install` to ensure your environment has that new-car smell.

## Building
Build, package, and deploy.

### Test
Unminified for testing for easier debugging.
``` bash
npm run package:test
code --install-extension test/vscode-interpreter-switcher-test.vsix
ctrl-shift-p - Developer: reload window
```

### Prod:
Produces a minified & version-named package.
``` bash
npm run package:production
code --install-extension production/vscode-interpreter-switcher-0.1.0.vsix
ctrl-shift-p - Developer: reload window
```

Once satisfied copy the .vsix file to the target devcontainer.

## Installation
TODO

**Important** - target devcontainer must have the following port setups:
``` JSON
"portsAttributes": {
    // auto-forward charting page to local web browser.
    "8888": {
      "label": "G-Cubed Chart",
      "onAutoForward": "openBrowser"
    },
    // Internal use only. Do not expose the helper outside the devcontainer.
    "9876": {
      "label": "G-Cubed venv helper",
      "onAutoForward": "ignore"
    }
```

## Testing

### Test 1: Valid request with absolute path - gcubed
``` bash
curl -X POST http://127.0.0.1:9876/set-interpreter -H "Content-Type: application/json" -d '{"pythonPath": "/workspaces/test-new-gcubed-2R/venv_gcubed_c_0002/bin/python"}'
```

### Test 2: Valid request with relative path (will be resolved relative to workspace) - gcubed
``` bash
curl -X POST http://127.0.0.1:9876/set-interpreter -H "Content-Type: application/json" -d '{"pythonPath": "venv_gcubed_c_0002/bin/python"}'
```

#### Test 2a: Valid request relative path back to global /usr/local/bin/python
``` bash
curl -X POST http://127.0.0.1:9876/set-interpreter -H "Content-Type: application/json" -d '{"pythonPath": "/usr/local/bin/python"}'
```

### Test 3: Valid request with invalid path
``` bash
curl -X POST http://127.0.0.1:9876/set-interpreter -H "Content-Type: application/json" -d '{"pythonPath": "bad path"}'
```

### Test 4: Invalid request - missing pythonPath parameter
``` bash
curl -X POST http://127.0.0.1:9876/set-interpreter -H "Content-Type: application/json" -d '{}'
```

### Test 5: Invalid request - empty pythonPath
``` bash
curl -X POST http://127.0.0.1:9876/set-interpreter -H "Content-Type: application/json" -d '{"pythonPath": ""}'
```

### Test 6: Invalid request - pythonPath is not a string
``` bash
curl -X POST http://127.0.0.1:9876/set-interpreter -H "Content-Type: application/json" -d '{"pythonPath": 12345}'
```

### Test 7: Invalid endpoint
``` bash
curl -X GET http://127.0.0.1:9876/wrong-endpoint
```
