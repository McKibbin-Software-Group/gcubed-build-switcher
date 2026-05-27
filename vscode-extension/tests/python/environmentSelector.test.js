"use strict"

jest.mock(
  "vscode",
  () => ({
    Uri: { file: jest.fn((filePath) => ({ fsPath: filePath })) },
    window: { showErrorMessage: jest.fn() },
    workspace: { workspaceFolders: [{ uri: { fsPath: "/workspace/project" } }] },
    extensions: { getExtension: jest.fn() },
  }),
  { virtual: true }
)
jest.mock("@vscode/python-extension", () => ({ PythonExtension: { api: jest.fn() } }))

const {
  PYTHON_ENVS_EXTENSION_ID,
  LEGACY_PYTHON_EXTENSION_ID,
  createFallbackEnvironmentSelector,
  createPythonEnvsEnvironmentSelector,
  createLegacyPythonEnvironmentSelector,
  getPythonEnvsApi,
  validatePythonEnvsApi,
  formatKnownEnvironmentList,
  getEnvironmentPath,
  getFirstEnvironmentPathContaining,
} = require("../../src/python/environmentSelector")

describe("Python Environments selector", () => {
  test("selectInterpreter resolves, sets, verifies, and reports known environments", async () => {
    const requestedPath = "/workspace/project/venv_gcubed_1/bin/python"
    const scope = { fsPath: "/workspace/project" }
    const requestedUri = { fsPath: requestedPath }
    const environment = createPythonEnvsEnvironment(requestedPath)
    const pythonEnvsApi = {
      refreshEnvironments: jest.fn(async () => undefined),
      getEnvironments: jest.fn(async () => [environment]),
      resolveEnvironment: jest.fn(async () => environment),
      setEnvironment: jest.fn(async () => undefined),
      getEnvironment: jest.fn(async () => environment),
    }

    const selector = createPythonEnvsEnvironmentSelector({
      getApi: jest.fn(async () => pythonEnvsApi),
      getWorkspaceScope: () => scope,
      uriFile: jest.fn(() => requestedUri),
    })

    const result = await selector.selectInterpreter(requestedPath, "gcubed 1")

    expect(pythonEnvsApi.refreshEnvironments).toHaveBeenCalledTimes(2)
    expect(pythonEnvsApi.refreshEnvironments).toHaveBeenCalledWith(undefined)
    expect(pythonEnvsApi.getEnvironments).toHaveBeenCalledWith("all")
    expect(pythonEnvsApi.resolveEnvironment).toHaveBeenCalledWith(requestedUri)
    expect(pythonEnvsApi.setEnvironment).toHaveBeenCalledWith(scope, environment)
    expect(pythonEnvsApi.getEnvironment).toHaveBeenCalledWith(scope)
    expect(result).toEqual({
      apiId: PYTHON_ENVS_EXTENSION_ID,
      knownEnvironmentsBeforeSwitch: [environment],
      resolvedEnvironmentBeforeSwitch: environment,
      knownEnvironmentsAfterSwitch: [environment],
      resolvedEnvironmentAfterSwitch: environment,
    })
  })

  test("selectInterpreter throws when Python Environments cannot resolve the requested interpreter", async () => {
    const pythonEnvsApi = {
      refreshEnvironments: jest.fn(async () => undefined),
      getEnvironments: jest.fn(async () => []),
      resolveEnvironment: jest.fn(async () => undefined),
    }
    const selector = createPythonEnvsEnvironmentSelector({
      getApi: jest.fn(async () => pythonEnvsApi),
      getWorkspaceScope: () => undefined,
      uriFile: jest.fn((filePath) => ({ fsPath: filePath })),
      wait: jest.fn(async () => undefined),
      selectionRetry: { maxAttempts: 2, initialDelayMs: 10 },
    })

    await expect(selector.selectInterpreter("/workspace/project/venv_gcubed_missing/bin/python", "missing")).rejects.toThrow(
      "could not resolve"
    )
    expect(pythonEnvsApi.resolveEnvironment).toHaveBeenCalledTimes(2)
  })

  test("selectInterpreter retries until a newly-created interpreter resolves", async () => {
    const requestedPath = "/workspace/project/venv_gcubed_1/bin/python"
    const environment = createPythonEnvsEnvironment(requestedPath)
    const wait = jest.fn(async () => undefined)
    const pythonEnvsApi = {
      refreshEnvironments: jest.fn(async () => undefined),
      getEnvironments: jest.fn(async () => [environment]),
      resolveEnvironment: jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(environment),
      setEnvironment: jest.fn(async () => undefined),
      getEnvironment: jest.fn(async () => environment),
    }
    const selector = createPythonEnvsEnvironmentSelector({
      getApi: jest.fn(async () => pythonEnvsApi),
      getWorkspaceScope: () => ({ fsPath: "/workspace/project" }),
      uriFile: jest.fn((filePath) => ({ fsPath: filePath })),
      wait,
      selectionRetry: { maxAttempts: 2, initialDelayMs: 25 },
    })

    const result = await selector.selectInterpreter(requestedPath, "gcubed 1")

    expect(result.resolvedEnvironmentAfterSwitch).toBe(environment)
    expect(pythonEnvsApi.resolveEnvironment).toHaveBeenCalledTimes(2)
    expect(pythonEnvsApi.setEnvironment).toHaveBeenCalledTimes(1)
    expect(wait).toHaveBeenCalledWith(25)
  })

  test("selectInterpreter retries when selected environment verification lags", async () => {
    const requestedPath = "/workspace/project/venv_gcubed_1/bin/python"
    const requestedEnvironment = createPythonEnvsEnvironment(requestedPath)
    const wrongEnvironment = createPythonEnvsEnvironment("/workspace/project/venv_gcubed_other/bin/python")
    const wait = jest.fn(async () => undefined)
    const pythonEnvsApi = {
      refreshEnvironments: jest.fn(async () => undefined),
      getEnvironments: jest.fn(async () => [requestedEnvironment, wrongEnvironment]),
      resolveEnvironment: jest.fn(async () => requestedEnvironment),
      setEnvironment: jest.fn(async () => undefined),
      getEnvironment: jest.fn()
        .mockResolvedValueOnce(wrongEnvironment)
        .mockResolvedValueOnce(requestedEnvironment),
    }
    const selector = createPythonEnvsEnvironmentSelector({
      getApi: jest.fn(async () => pythonEnvsApi),
      getWorkspaceScope: () => ({ fsPath: "/workspace/project" }),
      uriFile: jest.fn((filePath) => ({ fsPath: filePath })),
      wait,
      selectionRetry: { maxAttempts: 2, initialDelayMs: 25 },
    })

    const result = await selector.selectInterpreter(requestedPath, "gcubed 1")

    expect(result.resolvedEnvironmentAfterSwitch).toBe(requestedEnvironment)
    expect(pythonEnvsApi.setEnvironment).toHaveBeenCalledTimes(2)
    expect(pythonEnvsApi.getEnvironment).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenCalledWith(25)
  })

  test("selectInterpreter returns unresolved after-switch state when selected environment does not match", async () => {
    const requestedPath = "/workspace/project/venv_gcubed_1/bin/python"
    const requestedEnvironment = createPythonEnvsEnvironment(requestedPath)
    const wrongEnvironment = createPythonEnvsEnvironment("/workspace/project/venv_gcubed_other/bin/python")
    const pythonEnvsApi = {
      refreshEnvironments: jest.fn(async () => undefined),
      getEnvironments: jest.fn(async () => [requestedEnvironment, wrongEnvironment]),
      resolveEnvironment: jest.fn(async () => requestedEnvironment),
      setEnvironment: jest.fn(async () => undefined),
      getEnvironment: jest.fn(async () => wrongEnvironment),
    }
    const selector = createPythonEnvsEnvironmentSelector({
      getApi: jest.fn(async () => pythonEnvsApi),
      getWorkspaceScope: () => ({ fsPath: "/workspace/project" }),
      uriFile: jest.fn((filePath) => ({ fsPath: filePath })),
      wait: jest.fn(async () => undefined),
      selectionRetry: { maxAttempts: 1 },
    })

    const result = await selector.selectInterpreter(requestedPath, "gcubed 1")

    expect(result.resolvedEnvironmentAfterSwitch).toBeUndefined()
  })

  test("validateStartingInterpreter reports selected environment and known environments", async () => {
    const activeEnvironment = createPythonEnvsEnvironment("/workspace/project/venv_gcubed_active/bin/python")
    const pythonEnvsApi = {
      refreshEnvironments: jest.fn(async () => undefined),
      getEnvironments: jest.fn(async () => [activeEnvironment]),
      getEnvironment: jest.fn(async () => activeEnvironment),
    }
    const selector = createPythonEnvsEnvironmentSelector({
      getApi: jest.fn(async () => pythonEnvsApi),
      getWorkspaceScope: () => ({ fsPath: "/workspace/project" }),
    })

    await expect(selector.validateStartingInterpreter()).resolves.toEqual({
      success: true,
      path: "/workspace/project/venv_gcubed_active/bin/python",
      knownVenvs: [activeEnvironment],
    })
  })
})

describe("fallback environment selector", () => {
  test("uses primary selector when it verifies the selected interpreter", async () => {
    const primaryResult = {
      knownEnvironmentsBeforeSwitch: [],
      resolvedEnvironmentBeforeSwitch: undefined,
      knownEnvironmentsAfterSwitch: [],
      resolvedEnvironmentAfterSwitch: { path: "/workspace/project/venv_gcubed_1/bin/python" },
    }
    const primarySelector = createFakeSelector("primary", primaryResult)
    const fallbackSelector = createFakeSelector("fallback")
    const selector = createFallbackEnvironmentSelector({ primarySelector, fallbackSelector })

    await expect(selector.selectInterpreter("/workspace/project/venv_gcubed_1/bin/python", "gcubed 1")).resolves.toEqual({
      ...primaryResult,
      apiId: "primary",
    })
    expect(fallbackSelector.selectInterpreter).not.toHaveBeenCalled()
  })

  test("falls back when primary selector throws", async () => {
    const fallbackResult = {
      knownEnvironmentsBeforeSwitch: [],
      resolvedEnvironmentBeforeSwitch: undefined,
      knownEnvironmentsAfterSwitch: [],
      resolvedEnvironmentAfterSwitch: { path: "/workspace/project/venv_gcubed_1/bin/python" },
    }
    const primarySelector = createFakeSelector("primary")
    primarySelector.selectInterpreter.mockRejectedValueOnce(new Error("primary unavailable"))
    const fallbackSelector = createFakeSelector("fallback", fallbackResult)
    const selector = createFallbackEnvironmentSelector({ primarySelector, fallbackSelector })

    await expect(selector.selectInterpreter("/workspace/project/venv_gcubed_1/bin/python", "gcubed 1")).resolves.toEqual({
      ...fallbackResult,
      apiId: "fallback",
    })
    expect(fallbackSelector.selectInterpreter).toHaveBeenCalledWith(
      "/workspace/project/venv_gcubed_1/bin/python",
      "gcubed 1"
    )
  })

  test("falls back when primary selector cannot verify selected interpreter", async () => {
    const fallbackResult = {
      knownEnvironmentsBeforeSwitch: [],
      resolvedEnvironmentBeforeSwitch: undefined,
      knownEnvironmentsAfterSwitch: [],
      resolvedEnvironmentAfterSwitch: { path: "/workspace/project/venv_gcubed_1/bin/python" },
    }
    const primarySelector = createFakeSelector("primary", {
      knownEnvironmentsBeforeSwitch: [],
      resolvedEnvironmentBeforeSwitch: { path: "/workspace/project/venv_gcubed_1/bin/python" },
      knownEnvironmentsAfterSwitch: [],
      resolvedEnvironmentAfterSwitch: undefined,
    })
    const fallbackSelector = createFakeSelector("fallback", fallbackResult)
    const selector = createFallbackEnvironmentSelector({ primarySelector, fallbackSelector })

    await expect(selector.selectInterpreter("/workspace/project/venv_gcubed_1/bin/python", "gcubed 1")).resolves.toEqual({
      ...fallbackResult,
      apiId: "fallback",
    })
    expect(fallbackSelector.selectInterpreter).toHaveBeenCalledTimes(1)
  })
})

describe("legacy Python environment selector", () => {
  test("selectInterpreter preserves the legacy refresh, resolve, switch, refresh, resolve flow", async () => {
    const pythonApi = { environments: {} }
    const calls = []

    const refreshEnvironments = jest.fn(async () => {
      calls.push("refresh")
      return [{ legacy: { id: "legacy", path: "/workspace/venv_gcubed_1/bin/python" } }]
    })
    const resolveEnvironment = jest.fn(async (api, absolutePath, displayName) => {
      calls.push(`resolve:${displayName}:${absolutePath}`)
      return { id: "resolved", path: absolutePath }
    })
    const switchEnvironment = jest.fn(async (api, absolutePath) => {
      calls.push(`switch:${absolutePath}`)
    })

    const selector = createLegacyPythonEnvironmentSelector({
      getApi: jest.fn(async () => pythonApi),
      refreshEnvironments,
      resolveEnvironment,
      switchEnvironment,
      validateStartingInterpreter: jest.fn(),
      formatEnvironments: jest.fn(),
    })

    const result = await selector.selectInterpreter("/workspace/venv_gcubed_1/bin/python", "gcubed 1")

    expect(calls).toEqual([
      "refresh",
      "resolve:gcubed 1:/workspace/venv_gcubed_1/bin/python",
      "switch:/workspace/venv_gcubed_1/bin/python",
      "refresh",
      "resolve:gcubed 1:/workspace/venv_gcubed_1/bin/python",
    ])
    expect(result.apiId).toBe(LEGACY_PYTHON_EXTENSION_ID)
    expect(result.resolvedEnvironmentAfterSwitch).toEqual({
      id: "resolved",
      path: "/workspace/venv_gcubed_1/bin/python",
    })
  })

  test("delegates startup validation and environment formatting", async () => {
    const pythonApi = { environments: {} }
    const validateStartingInterpreter = jest.fn(async () => ({ success: true, path: "/bin/python" }))
    const formatEnvironments = jest.fn(() => ["formatted"])
    const selector = createLegacyPythonEnvironmentSelector({
      getApi: jest.fn(async () => pythonApi),
      validateStartingInterpreter,
      formatEnvironments,
    })

    await expect(selector.validateStartingInterpreter()).resolves.toEqual({ success: true, path: "/bin/python" })
    expect(validateStartingInterpreter).toHaveBeenCalledWith(pythonApi)
    expect(selector.formatKnownEnvironments(undefined)).toEqual(["formatted"])
    expect(formatEnvironments).toHaveBeenCalledWith([])
  })
})

describe("Python Environments API retrieval", () => {
  test("throws when the extension is not installed", async () => {
    const extensions = { getExtension: jest.fn(() => undefined) }

    await expect(getPythonEnvsApi({ extensions })).rejects.toThrow("Python Environments extension not found")
    expect(extensions.getExtension).toHaveBeenCalledWith(PYTHON_ENVS_EXTENSION_ID)
  })

  test("activates the extension and returns its exported API", async () => {
    const pythonEnvsApi = createPythonEnvsApi()
    const extension = {
      isActive: false,
      exports: pythonEnvsApi,
      activate: jest.fn(async () => pythonEnvsApi),
    }
    const extensions = { getExtension: jest.fn(() => extension) }

    await expect(getPythonEnvsApi({ extensions })).resolves.toBe(pythonEnvsApi)
    expect(extension.activate).toHaveBeenCalledTimes(1)
  })

  test("validates required API functions", () => {
    expect(() => validatePythonEnvsApi({ refreshEnvironments: jest.fn() })).toThrow(
      "Python Environments extension API missing"
    )
  })
})

describe("environment path extraction", () => {
  test("supports known legacy and normalized environment shapes", () => {
    expect(getEnvironmentPath({ internal: { path: "/workspace/venv_gcubed_internal/bin/python" } })).toBe(
      "/workspace/venv_gcubed_internal/bin/python"
    )
    expect(getEnvironmentPath({ "env-id": { path: "/workspace/venv_gcubed_keyed/bin/python" } })).toBe(
      "/workspace/venv_gcubed_keyed/bin/python"
    )
    expect(getEnvironmentPath({ path: "/workspace/venv_gcubed_direct/bin/python" })).toBe(
      "/workspace/venv_gcubed_direct/bin/python"
    )
    expect(
      getEnvironmentPath({
        execInfo: { run: { executable: "/workspace/venv_gcubed_exec/bin/python" } },
        environmentPath: { fsPath: "/workspace/venv_gcubed_exec" },
      })
    ).toBe("/workspace/venv_gcubed_exec/bin/python")
    expect(getEnvironmentPath({ environmentPath: { fsPath: "/workspace/venv_gcubed_uri" } })).toBe(
      "/workspace/venv_gcubed_uri"
    )
  })

  test("finds the first environment path containing a requested fragment", () => {
    const knownEnvironments = [
      { internal: { path: "/workspace/other/bin/python" } },
      { "env-id": { path: "/workspace/venv_gcubed_build/bin/python" } },
    ]

    expect(getFirstEnvironmentPathContaining(knownEnvironments, "venv_gcubed_")).toBe(
      "/workspace/venv_gcubed_build/bin/python"
    )
    expect(getFirstEnvironmentPathContaining(knownEnvironments, "missing")).toBeUndefined()
  })

  test("formats mixed known environment shapes", () => {
    expect(
      formatKnownEnvironmentList([
        { "legacy-id": { path: "/workspace/venv_gcubed_legacy/bin/python" } },
        createPythonEnvsEnvironment("/workspace/venv_gcubed_new/bin/python"),
      ])
    ).toEqual([
      "legacy-id: path: '/workspace/venv_gcubed_legacy/bin/python'",
      "ms-python.python:venv:env-id: path: '/workspace/venv_gcubed_new/bin/python'",
    ])
  })
})

function createPythonEnvsEnvironment(executablePath) {
  return {
    name: "gcubed",
    displayName: "G-Cubed",
    envId: { managerId: "ms-python.python:venv", id: "env-id" },
    environmentPath: { fsPath: executablePath.replace(/\/bin\/python$/, "") },
    execInfo: { run: { executable: executablePath } },
  }
}

function createPythonEnvsApi() {
  return {
    refreshEnvironments: jest.fn(async () => undefined),
    getEnvironments: jest.fn(async () => []),
    resolveEnvironment: jest.fn(async () => undefined),
    setEnvironment: jest.fn(async () => undefined),
    getEnvironment: jest.fn(async () => undefined),
  }
}

function createFakeSelector(apiId, selectionResult) {
  return {
    apiId,
    selectInterpreter: jest.fn(async () => selectionResult),
    validateStartingInterpreter: jest.fn(async () => ({ success: true, path: "/bin/python", knownVenvs: [] })),
    formatKnownEnvironments: jest.fn(() => []),
    getFirstEnvironmentPathContaining: jest.fn(),
  }
}
