/**
 * Abstract interface that all server implementations must follow
 * @interface
 */
class ServerInterface {
  /**
   * Initializes and starts the server
   * @returns {Promise<void>}
   * @abstract
   */
  async initialize() {
    throw new Error('ServerInterface.initialize() must be implemented by subclass');
  }

  /**
   * Gracefully shuts down the server
   * @returns {Promise<void>}
   * @abstract
   */
  async shutdown() {
    throw new Error('ServerInterface.shutdown() must be implemented by subclass');
  }
}

module.exports = ServerInterface;