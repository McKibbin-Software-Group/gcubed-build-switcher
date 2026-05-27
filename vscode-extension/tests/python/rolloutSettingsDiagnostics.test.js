"use strict"

jest.mock(
  "vscode",
  () => ({
    workspace: { getConfiguration: jest.fn() },
    window: { showWarningMessage: jest.fn() },
  }),
  { virtual: true }
)

const {
  getPythonEnvsRolloutSettingWarnings,
  reportPythonEnvsRolloutSettingsDiagnostics,
} = require("../../src/python/rolloutSettingsDiagnostics")

describe("Python Environments rollout settings diagnostics", () => {
  test("returns no warnings when rollout settings match recommendations", () => {
    const warnings = getPythonEnvsRolloutSettingWarnings({
      workspace: createWorkspace({
        python: { useEnvironmentsExtension: true },
        "python-envs": {
          workspaceSearchPaths: ["venv_gcubed_*"],
          "terminal.autoActivationType": "off",
        },
      }),
    })

    expect(warnings).toEqual([])
  })

  test("reports warnings for missing or mismatched rollout settings", () => {
    const warnings = getPythonEnvsRolloutSettingWarnings({
      workspace: createWorkspace({
        python: { useEnvironmentsExtension: false },
        "python-envs": {
          workspaceSearchPaths: ["src"],
          "terminal.autoActivationType": "shellActivation",
        },
      }),
    })

    expect(warnings).toEqual([
      "python.useEnvironmentsExtension should be true",
      'python-envs.workspaceSearchPaths should include "venv_gcubed_*"',
      'python-envs.terminal.autoActivationType should be "off"',
    ])
  })

  test("shows one warning message when diagnostics find issues", () => {
    const window = { showWarningMessage: jest.fn() }
    const logger = { warn: jest.fn() }

    const warnings = reportPythonEnvsRolloutSettingsDiagnostics({
      workspace: createWorkspace({
        python: { useEnvironmentsExtension: undefined },
        "python-envs": {
          workspaceSearchPaths: undefined,
          "terminal.autoActivationType": undefined,
        },
      }),
      window,
      logger,
    })

    expect(warnings).toHaveLength(3)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Python Environments rollout settings need attention"))
    expect(window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining("python.useEnvironmentsExtension should be true")
    )
  })

  test("does not show a warning message when settings are recommended", () => {
    const window = { showWarningMessage: jest.fn() }
    const logger = { warn: jest.fn() }

    const warnings = reportPythonEnvsRolloutSettingsDiagnostics({
      workspace: createWorkspace({
        python: { useEnvironmentsExtension: true },
        "python-envs": {
          workspaceSearchPaths: ["venv_gcubed_*"],
          "terminal.autoActivationType": "off",
        },
      }),
      window,
      logger,
    })

    expect(warnings).toEqual([])
    expect(logger.warn).not.toHaveBeenCalled()
    expect(window.showWarningMessage).not.toHaveBeenCalled()
  })
})

function createWorkspace(sections) {
  return {
    getConfiguration(sectionName) {
      const section = sections[sectionName] || {}
      return {
        get(settingName) {
          return section[settingName]
        },
      }
    },
  }
}
