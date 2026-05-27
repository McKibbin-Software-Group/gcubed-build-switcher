"use strict"

jest.mock("vscode", () => ({ window: { showErrorMessage: jest.fn() } }), { virtual: true })
jest.mock("@vscode/python-extension", () => ({ PythonExtension: { api: jest.fn() } }))

const {
  createLegacyPythonEnvironmentSelector,
  getEnvironmentPath,
  getFirstEnvironmentPathContaining,
} = require("../../src/python/environmentSelector")

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
})
