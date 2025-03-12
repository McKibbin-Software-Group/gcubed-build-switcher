/**
 * Core messaging components for handling interpreter switching
 */
"use strict"
const { createLogger, serverLogger, extensionLogger, interpreterLogger } = require("./logger")
const createMessageProcessor = require("./processor")

module.exports = {
  // Logger exports
  createLogger,
  serverLogger,
  extensionLogger,
  interpreterLogger,

  // Message processor factory
  createMessageProcessor,
}
