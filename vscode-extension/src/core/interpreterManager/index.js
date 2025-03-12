/**
 * Interpreter Manager module
 */
const { switchInterpreter } = require('./switchInterpreter');
const pythonExtensionUtils = require('./pythonExtension');

class InterpreterManager {
  /**
   * Creates an interpreter manager instance
   * @param {Object} [logger=console] - Logging object
   */
  constructor(logger = console) {
    this.logger = logger;
  }

  /**
   * Switches the Python interpreter
   * @param {InterpreterRequest} request - The interpreter switch request
   * @returns {Promise<InterpreterResponse>} Response with result
   */
  async switchInterpreter(request) {
    return switchInterpreter(request, this.logger);
  }
}

module.exports = {
  InterpreterManager,
  ...pythonExtensionUtils
};