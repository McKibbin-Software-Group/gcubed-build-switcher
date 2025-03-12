"use strict"
const { getExtensionSettings } = require("../config/settings")
const { SERVER_TYPES } = require("../utils/constants")
const HttpServer = require("./httpServer")
const SocketServer = require("./socketServer")

/**
 * Creates appropriate server based on configuration
 * @returns {Promise<Object>} Initialized server instance
 */
async function createServer() {
  const settings = getExtensionSettings()
  let server

  switch (settings.serverType) {
    case SERVER_TYPES.HTTP:
      server = new HttpServer(settings)
      break

    case SERVER_TYPES.SOCKET:
      server = new SocketServer(settings)
      break

    default:
      console.warn(`Unknown server type "${settings.serverType}", defaulting to HTTP server`)
      server = new HttpServer(settings)
  }

  await server.initialize()
  return server
}

module.exports = {
  createServer
}