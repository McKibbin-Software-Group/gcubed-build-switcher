/**
 * @fileoverview Diagnostics for Python Environments rollout settings.
 */

"use strict"

const vscode = require("vscode")
const { VENV_NAME_PREFIX } = require("../utils/constants")

const REQUIRED_WORKSPACE_SEARCH_PATTERN = `${VENV_NAME_PREFIX}*`
const RECOMMENDED_TERMINAL_AUTO_ACTIVATION = "off"

function getPythonEnvsRolloutSettingWarnings({ workspace = vscode.workspace } = {}) {
  const pythonConfig = workspace.getConfiguration("python")
  const pythonEnvsConfig = workspace.getConfiguration("python-envs")
  const warnings = []

  if (pythonConfig.get("useEnvironmentsExtension") !== true) {
    warnings.push("python.useEnvironmentsExtension should be true")
  }

  const workspaceSearchPaths = pythonEnvsConfig.get("workspaceSearchPaths")
  if (!Array.isArray(workspaceSearchPaths) || !workspaceSearchPaths.includes(REQUIRED_WORKSPACE_SEARCH_PATTERN)) {
    warnings.push(`python-envs.workspaceSearchPaths should include "${REQUIRED_WORKSPACE_SEARCH_PATTERN}"`)
  }

  if (pythonEnvsConfig.get("terminal.autoActivationType") !== RECOMMENDED_TERMINAL_AUTO_ACTIVATION) {
    warnings.push(`python-envs.terminal.autoActivationType should be "${RECOMMENDED_TERMINAL_AUTO_ACTIVATION}"`)
  }

  return warnings
}

function reportPythonEnvsRolloutSettingsDiagnostics({
  workspace = vscode.workspace,
  window = vscode.window,
  logger = console,
} = {}) {
  let warnings

  try {
    warnings = getPythonEnvsRolloutSettingWarnings({ workspace })
  } catch (error) {
    logger.warn("Unable to inspect Python Environments rollout settings:", error)
    return []
  }

  if (warnings.length === 0) {
    return []
  }

  const message = `Python Environments rollout settings need attention: ${warnings.join("; ")}`
  logger.warn(message)
  window.showWarningMessage(message)
  return warnings
}

module.exports = {
  REQUIRED_WORKSPACE_SEARCH_PATTERN,
  RECOMMENDED_TERMINAL_AUTO_ACTIVATION,
  getPythonEnvsRolloutSettingWarnings,
  reportPythonEnvsRolloutSettingsDiagnostics,
}
