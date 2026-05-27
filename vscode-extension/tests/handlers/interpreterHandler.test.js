"use strict"

const mockShowInformationMessage = jest.fn()
const mockShowErrorMessage = jest.fn()

jest.mock(
  "vscode",
  () => ({
    workspace: {
      workspaceFolders: [{ uri: { fsPath: "/workspace/project" } }],
      getConfiguration: jest.fn(() => ({ get: jest.fn() })),
    },
    window: {
      showInformationMessage: mockShowInformationMessage,
      showWarningMessage: jest.fn(),
      showErrorMessage: mockShowErrorMessage,
    },
  }),
  { virtual: true }
)
jest.mock("@vscode/python-extension", () => ({ PythonExtension: { api: jest.fn() } }))

const { createInterpreterHandler, resolveAbsolutePath } = require("../../src/handlers/interpreterHandler")

describe("interpreter handler", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("resolves relative paths and delegates selection to the environment selector", async () => {
    const environmentSelector = createFakeEnvironmentSelector({
      selectionResult: {
        knownEnvironmentsBeforeSwitch: [],
        resolvedEnvironmentBeforeSwitch: undefined,
        knownEnvironmentsAfterSwitch: [{ path: "/workspace/project/venv_gcubed_a/bin/python" }],
        resolvedEnvironmentAfterSwitch: { path: "/workspace/project/venv_gcubed_a/bin/python" },
      },
    })
    const handler = createInterpreterHandler(environmentSelector)

    const result = await handler.switchInterpreter("venv_gcubed_a/bin/python", "build a")

    expect(environmentSelector.selectInterpreter).toHaveBeenCalledWith(
      "/workspace/project/venv_gcubed_a/bin/python",
      "build a"
    )
    expect(result).toEqual({
      success: true,
      message: "Switched to venv_gcubed_a/bin/python",
      requestedPath: "venv_gcubed_a/bin/python",
      apiId: "fake",
    })
  })

  test("returns the formatted known environments when selection cannot be resolved after switching", async () => {
    const environmentSelector = createFakeEnvironmentSelector({
      selectionResult: {
        knownEnvironmentsBeforeSwitch: [],
        resolvedEnvironmentBeforeSwitch: undefined,
        knownEnvironmentsAfterSwitch: [{ path: "/workspace/project/venv_gcubed_a/bin/python" }],
        resolvedEnvironmentAfterSwitch: undefined,
      },
    })
    const handler = createInterpreterHandler(environmentSelector)

    const result = await handler.switchInterpreter("venv_gcubed_a/bin/python", "build a")

    expect(environmentSelector.formatKnownEnvironments).toHaveBeenCalledWith([
      { path: "/workspace/project/venv_gcubed_a/bin/python" },
    ])
    expect(result).toEqual({
      success: false,
      message: "Switch to venv_gcubed_a/bin/python did not appear to work - could not resolve the environment",
      requestedPath: "venv_gcubed_a/bin/python",
      apiId: "fake",
      knownEnvironments: ["known environment"],
    })
  })

  test("short-circuits invalid pythonPath without calling the selector", async () => {
    const environmentSelector = createFakeEnvironmentSelector()
    const handler = createInterpreterHandler(environmentSelector)

    const result = await handler.switchInterpreter("  ", "build a")

    expect(environmentSelector.selectInterpreter).not.toHaveBeenCalled()
    expect(result).toEqual({
      success: false,
      error: "pythonPath must be a non-empty string",
    })
  })

  test("resolves paths relative to the first workspace folder", () => {
    expect(resolveAbsolutePath("venv_gcubed_a/bin/python")).toBe("/workspace/project/venv_gcubed_a/bin/python")
  })
})

function createFakeEnvironmentSelector({
  selectionResult = {
    knownEnvironmentsBeforeSwitch: [],
    resolvedEnvironmentBeforeSwitch: undefined,
    knownEnvironmentsAfterSwitch: [],
    resolvedEnvironmentAfterSwitch: undefined,
  },
} = {}) {
  return {
    apiId: "fake",
    selectInterpreter: jest.fn(async () => selectionResult),
    validateStartingInterpreter: jest.fn(),
    formatKnownEnvironments: jest.fn(() => ["known environment"]),
    getFirstEnvironmentPathContaining: jest.fn(),
  }
}
