/**
 * Protocol-agnostic request interface
 */
class InterpreterRequest {
  /**
   * @param {string} pythonPath - Path to Python interpreter
   * @param {string} [shortName] - Short display name
   */
  constructor(pythonPath, shortName = null) {
    this.pythonPath = pythonPath;
    this.shortName = shortName;
  }

  isValid() {
    return typeof this.pythonPath === 'string' && this.pythonPath.trim() !== '';
  }
}

/**
 * Protocol-agnostic response interface
 */
class InterpreterResponse {
  /**
   * @param {boolean} success - Whether the operation succeeded
   * @param {string} [error] - Error message if failed
   * @param {Object} [data] - Additional data
   */
  constructor(success, error = null, data = {}) {
    this.success = success;
    this.error = error;
    this.data = data;
  }
}

module.exports = { InterpreterRequest, InterpreterResponse };