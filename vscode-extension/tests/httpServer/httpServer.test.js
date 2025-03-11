const http = require('http');
const HttpServer = require('../../src/server/httpServer');

// Mock VS Code and Python API
jest.mock('vscode', () => ({
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn()
  },
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: (key) => {
        if (key === 'localPort') return 9876;
        if (key === 'hostIP') return '127.0.0.1';
        return null;
      }
    }),
    workspaceFolders: [{ uri: { fsPath: '/workspaces/test' } }]
  },
  extensions: {
    getExtension: jest.fn().mockReturnValue({
      isActive: true,
      activate: jest.fn().mockResolvedValue(true)
    })
  }
}), { virtual: true });

// Mock Python extension API
jest.mock('@vscode/python-extension', () => ({
  PythonExtension: {
    api: jest.fn().mockResolvedValue({
      environments: {
        refreshEnvironments: jest.fn().mockResolvedValue(),
        updateActiveEnvironmentPath: jest.fn().mockResolvedValue(),
        known: [
          { venv1: { id: 'venv1', path: '/workspaces/test/venv/bin/python' } },
          { global: { id: 'global', path: '/usr/local/bin/python' } }
        ]
      }
    })
  }
}));

describe('HTTP Server Tests', () => {
  let server;
  let testConfig = {
    localPort: 9876,
    hostIP: '127.0.0.1'
  };

  beforeAll(async () => {
    server = new HttpServer(testConfig);
    await server.initialize();
  });

  afterAll(async () => {
    await server.shutdown();
  });

  // Helper function for HTTP requests
  function sendRequest(path, method, body) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: testConfig.hostIP,
        port: testConfig.localPort,
        path,
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {}
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: data ? JSON.parse(data) : null
            });
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  // Valid requests
  test('Test 1: Valid request with absolute path', async () => {
    const response = await sendRequest('/set-interpreter', 'POST', {
      pythonPath: '/usr/local/bin/python'
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test('Test 2: Valid request with relative path', async () => {
    const response = await sendRequest('/set-interpreter', 'POST', {
      pythonPath: 'venv/bin/python'
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
  });

  // Invalid requests
  test('Test 3: Invalid path', async () => {
    const response = await sendRequest('/set-interpreter', 'POST', {
      pythonPath: 'bad path'
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('Test 4: Missing pythonPath parameter', async () => {
    const response = await sendRequest('/set-interpreter', 'POST', {});

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Missing required parameter');
  });

  test('Test 5: Empty pythonPath', async () => {
    const response = await sendRequest('/set-interpreter', 'POST', {
      pythonPath: ''
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('Test 6: pythonPath is not a string', async () => {
    const response = await sendRequest('/set-interpreter', 'POST', {
      pythonPath: 12345
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('Test 7: Invalid endpoint', async () => {
    const response = await sendRequest('/wrong-endpoint', 'GET');

    expect(response.statusCode).toBe(404);
    expect(response.body.success).toBe(false);
  });
});