/**
 * Configuration settings manager
 */
"use strict"
const vscode = require('vscode');
const { DEFAULT_CONFIG, SERVER_TYPES } = require('../utils/constants');

/**
 * Gets extension configuration settings with defaults
 *
 * @returns {Object} Resolved configuration values
 */
function getExtensionSettings() {
  const config = vscode.workspace.getConfiguration('gcubedVenvSwitcher');

  return {
    // Server type (http or socket)
    serverType: validateServerType(
      config.get('serverType'),
      DEFAULT_CONFIG.SERVER_TYPE
    ),

    // HTTP server settings
    hostIP: config.get('hostIP') || DEFAULT_CONFIG.HOST_IP,
    localPort: validatePort(
      config.get('localPort'),
      DEFAULT_CONFIG.HTTP_PORT
    ),

    // Socket server settings
    socketPath: config.get('socketPath') || DEFAULT_CONFIG.SOCKET_PATH
  };
}

/**
 * Validates a server type setting
 *
 * @param {string} serverType - Server type from config
 * @param {string} defaultType - Default server type
 * @returns {string} Valid server type
 */
function validateServerType(serverType, defaultType) {
  if (!serverType || !Object.values(SERVER_TYPES).includes(serverType)) {
    console.warn(`Invalid server type: ${serverType}, defaulting to ${defaultType}`);
    return defaultType;
  }
  return serverType;
}

/**
 * Validates a port number
 *
 * @param {any} port - Port number from config
 * @param {number} defaultPort - Default port number
 * @returns {number} Valid port number
 */
function validatePort(port, defaultPort) {
  const portNumber = parseInt(port, 10);

  if (isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
    console.warn(`Invalid port: ${port}, defaulting to ${defaultPort}`);
    return defaultPort;
  }

  return portNumber;
}

module.exports = {
  getExtensionSettings
};