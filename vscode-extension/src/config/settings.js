"use strict"
const vscode = require("vscode")
const { SERVER_TYPES } = require("../utils/constants")

/**
 * Gets extension configuration settings
 * @returns {Object} Resolved configuration values
 */
function getExtensionSettings() {
  const config = vscode.workspace.getConfiguration("gcubedVenvSwitcher")

  return {
    // Network settings
    localPort: config.get("localPort") || 9876,
    hostIP: config.get("hostIP") || "127.0.0.1",

    // Server type (defaults to HTTP for backward compatibility)
    serverType: config.get("serverType") || SERVER_TYPES.HTTP,

    // Unix socket settings
    socketPath: config.get("socketPath") || "/tmp/gcubed-venv-switcher.sock"
  }
}

module.exports = {
  getExtensionSettings
}