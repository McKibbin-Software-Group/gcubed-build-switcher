/**
 * Server factory module for creating the appropriate server implementation
 */
"use strict"
const { SERVER_TYPES } = require('../utils/constants');
const HttpServer = require('./http/httpServer');
const SocketServer = require('./socket/socketServer');
const { serverLogger } = require('../core/messaging');

/**
 * Creates a server instance based on configuration
 *
 * @param {Object} settings - Extension settings
 * @param {string} settings.serverType - Type of server to create
 * @param {Object} [logger=serverLogger] - Logger instance
 * @returns {Promise<Object>} Initialized server instance
 * @throws {Error} If server type is unsupported or initialization fails
 */
async function createServerFromConfig(settings, logger = serverLogger) {
  logger.info(`Creating ${settings.serverType} server`);

  let server;

  switch (settings.serverType) {
    case SERVER_TYPES.HTTP:
      server = new HttpServer(settings, logger);
      break;

    case SERVER_TYPES.SOCKET:
      server = new SocketServer(settings, logger);
      break;

    default:
      const errorMessage = `Unsupported server type: ${settings.serverType}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
  }

  // Initialize and return the server
  await server.initialize();
  return server;
}

module.exports = {
  createServerFromConfig
};