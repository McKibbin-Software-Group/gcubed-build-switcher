// src/utils/constants.js (updated)
"use strict"

/**
 * Extension metadata
 */
const EXTENSION_NAME = "G-Cubed venv switcher"
const EXTENSION_LOAD_TIME = Date.now()

// Use an environment variable with default - one canonical definition
const SOCKET_PATH_ENV_VAR = "GCUBED_VENV_SOCKET_PATH"
const SERVER_SOCKET_PATH = process.env[SOCKET_PATH_ENV_VAR] || "/tmp/gcubed_venv_switcher.sock"

// Export the relevant socket server constants
const NULL_BYTE = 0
const MAX_BUFFER_SIZE = 1024 // 1KB limit
const MAX_CONCURRENT_CLIENT_CONNECTIONS = 5
const SERVER_SOCKET_MODE = 0o666
const SOCKET_INACTIVITY_TIMEOUT = 5000
const FIRM_SOCKET_CLOSE_TIMEOUT = 3000
const INCOMING_MESSAGE_COMPLETION_TIMEOUT_MS = 1000

// Active connections tracking
const activeConnections = new Set()


module.exports = {
  EXTENSION_NAME,
  EXTENSION_LOAD_TIME,
  SERVER_SOCKET_PATH,
  NULL_BYTE,
  MAX_BUFFER_SIZE,
  MAX_CONCURRENT_CLIENT_CONNECTIONS,
  INCOMING_MESSAGE_COMPLETION_TIMEOUT_MS,
  SERVER_SOCKET_MODE,
  SOCKET_INACTIVITY_TIMEOUT,
  FIRM_SOCKET_CLOSE_TIMEOUT,
  activeConnections,
}
