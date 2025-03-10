"use strict"

/**
 * Path to the Unix socket file for IPC communication between extension and client
 * Socket file serves as the rendezvous point for connections (not a data store)
 * @constant {string}
 */
const SERVER_SOCKET_PATH = process.env.SOCKET_PATH || "/tmp/gcubed_venv_switcher.sock"

/**
 * Null byte marker used as message terminator in the protocol
 * All valid messages must end with this byte to be processed
 * @constant {number}
 */
const NULL_BYTE = 0

/**
 * Maximum allowed message buffer size in bytes
 * Prevents memory exhaustion from malicious or malformed messages
 * @constant {number}
 */
const MAX_BUFFER_SIZE = 1024 // 1KB limit - sufficient for simple JSON messages

/**
 * Maximum number of concurrent client connections allowed
 * Prevents resource exhaustion from connection flooding attacks
 * @constant {number}
 */
const MAX_CONCURRENT_CLIENT_CONNECTIONS = 5

/**
 * Maximum time (in milliseconds) to wait for a complete message
 * Prevents connection hanging from clients who never send terminators
 * @constant {number}
 */
const INCOMING_MESSAGE_COMPLETION_TIMEOUT_MS = 3000

/**
 * Unix file permission mode for the socket file
 * 0o666 = read/write permissions for owner, group and others
 * @constant {number}
 */
const SERVER_SOCKET_MODE = 0o666

// Track active connections for better monitoring and management
const activeConnections = new Set()


module.exports = {
  SERVER_SOCKET_PATH,
  NULL_BYTE,
  MAX_BUFFER_SIZE,
  MAX_CONCURRENT_CLIENT_CONNECTIONS,
  INCOMING_MESSAGE_COMPLETION_TIMEOUT_MS,
  SERVER_SOCKET_MODE,
  activeConnections,
}
