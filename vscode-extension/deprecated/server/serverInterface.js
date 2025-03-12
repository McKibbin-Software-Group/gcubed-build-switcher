"use strict"

/**
 * Defines the interface all server implementations must follow
 */
class ServerInterface {
  /**
   * Initializes the server
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error("ServerInterface.initialize() must be implemented by subclass")
  }

  /**
   * Shuts down the server
   * @returns {Promise<void>}
   */
  async shutdown() {
    throw new Error("ServerInterface.shutdown() must be implemented by subclass")
  }
}

module.exports = ServerInterface