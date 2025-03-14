/**
 * @fileoverview Unix socket server API for the Python interpreter switcher
 * Re-exports core server management functions for external consumption
 *
 * This module acts as the public API for the unixSocketServer directory,
 * providing a clean interface for starting and shutting down the server.
 *
 * @module unixSocketServer
 */

const { startUnixSocketServer, gracefullyShutdownServer } = require("./socketServerManager")

module.exports = {
  startUnixSocketServer,
  gracefullyShutdownServer,
}
