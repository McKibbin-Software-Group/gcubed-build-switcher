"use strict"

/**
 * Extension metadata constants
 */
const EXTENSION_NAME = "G-Cubed venv switcher";
const EXTENSION_LOAD_TIME = Date.now();

/**
 * HTTP server constants
 */
const HTTP = {
  CONTENT_TYPE_JSON: "application/json",
  STATUS: {
    OK: 200,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    UNPROCESSABLE_ENTITY: 422,
    SERVER_ERROR: 500
  }
};

/**
 * Server types enumeration to ensure consistency
 */
const SERVER_TYPES = {
  HTTP: "http",
  SOCKET: "socket"
};

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  HTTP_PORT: 9876,
  HOST_IP: "127.0.0.1",
  SOCKET_PATH: "/tmp/gcubed-venv-switcher.sock",
  SERVER_TYPE: SERVER_TYPES.HTTP
};

/**
 * Timeouts and retry configurations
 */
const RETRY_CONFIG = {
  PYTHON_EXTENSION: {
    MAX_RETRIES: 3,
    DELAY_MS: 500
  },
  INTERPRETER_CHECK: {
    MAX_RETRIES: 2,
    DELAY_MS: 1000
  },
  SOCKET_CONNECT: {
    TIMEOUT_MS: 5000
  }
};

module.exports = {
  EXTENSION_NAME,
  EXTENSION_LOAD_TIME,
  HTTP,
  SERVER_TYPES,
  DEFAULT_CONFIG,
  RETRY_CONFIG
};