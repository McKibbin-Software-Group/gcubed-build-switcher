"use strict"

/**
 * Extension metadata
 */
const EXTENSION_NAME = "G-Cubed venv switcher"
const EXTENSION_LOAD_TIME = Date.now()

/**
 * HTTP constants
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
}

/**
 * Server types
 */
const SERVER_TYPES = {
  HTTP: "http",
  SOCKET: "socket"
}

module.exports = {
  EXTENSION_NAME,
  EXTENSION_LOAD_TIME,
  HTTP,
  SERVER_TYPES
}