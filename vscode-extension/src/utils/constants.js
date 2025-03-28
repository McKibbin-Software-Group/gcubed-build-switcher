/**
 * @fileoverview Defines constants used throughout the extension
 * Contains configuration values, limits, and shared resources
 */

"use strict"

/**
 * Extension metadata and identification
 */
const EXTENSION_NAME = "G-Cubed venv switcher"
const EXTENSION_LOAD_TIME = Date.now()

/**
 * Socket path configuration
 * Uses environment variable if available, otherwise defaults to /tmp
 */
const SERVER_SOCKET_PATH = process.env["GCUBED_VENV_SOCKET_PATH"] || "/tmp/gcubed_venv_switcher.sock"

/**
 * G-Cubed virtual environments base name
 */
const VENV_NAME_PREFIX = process.env["GCUBED_VENV_NAME_PREFIX"] || "venv_gcubed_"


/**
 * Socket communication parameters
 * Defines message format and size limitations
 */
const NULL_BYTE = 0
const MAX_BUFFER_SIZE = 1024 // 1KB limit

/**
 * Connection management settings
 * Controls concurrency and timeout behaviors
 */
const MAX_CONCURRENT_CLIENT_CONNECTIONS = 5
const SERVER_SOCKET_MODE = 0o666
const SOCKET_INACTIVITY_TIMEOUT = 5000
const FIRM_SOCKET_CLOSE_TIMEOUT = 3000
const INCOMING_MESSAGE_COMPLETION_TIMEOUT_MS = 1000


/**
 * Shared state for connection tracking across modules
 * @type {Set<import('net').Socket>}
 */
const activeConnections = new Set()

module.exports = {
  EXTENSION_NAME,
  EXTENSION_LOAD_TIME,
  SERVER_SOCKET_PATH,
  VENV_NAME_PREFIX,
  NULL_BYTE,
  MAX_BUFFER_SIZE,
  MAX_CONCURRENT_CLIENT_CONNECTIONS,
  INCOMING_MESSAGE_COMPLETION_TIMEOUT_MS,
  SERVER_SOCKET_MODE,
  SOCKET_INACTIVITY_TIMEOUT,
  FIRM_SOCKET_CLOSE_TIMEOUT,
  activeConnections,
}
