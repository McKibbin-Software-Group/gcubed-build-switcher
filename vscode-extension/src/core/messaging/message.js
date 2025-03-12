/**
 * @typedef {Object} InterpreterRequestPayload
 * @property {string} pythonPath - Path to Python interpreter
 * @property {string} [shortName] - Optional display name for the interpreter
 */

/**
 * Represents a protocol-agnostic interpreter request
 */
class InterpreterRequest {
  /**
   * @param {string} pythonPath - Path to Python interpreter
   * @param {string} [shortName] - Short display name
   * @param {Object} [metadata] - Additional metadata
   */
  constructor(pythonPath, shortName = null, metadata = {}) {
    this.pythonPath = pythonPath;
    this.shortName = shortName;
    this.metadata = metadata;
    this.timestamp = new Date();
  }

  /**
   * Validates if this is a well-formed request
   * @returns {boolean} True if valid
   */
  isValid() {
    return typeof this.pythonPath === 'string' && this.pythonPath.trim() !== '';
  }

  /**
   * Gets validation error message if invalid
   * @returns {string|null} Error message or null if valid
   */
  getValidationError() {
    if (!this.pythonPath) {
      return "Missing required parameter: pythonPath";
    }

    if (typeof this.pythonPath !== 'string') {
      return "pythonPath must be a string";
    }

    if (this.pythonPath.trim() === '') {
      return "pythonPath cannot be empty";
    }

    return null;
  }
}

/**
 * Represents a protocol-agnostic interpreter response
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
    this.timestamp = new Date();
  }

  /**
   * Creates a successful response
   * @param {Object} [data={}] - Data to include in response
   * @returns {InterpreterResponse} Successful response
   */
  static success(data = {}) {
    return new InterpreterResponse(true, null, data);
  }

  /**
   * Creates an error response
   * @param {string} error - Error message
   * @param {Object} [data={}] - Additional error data
   * @returns {InterpreterResponse} Error response
   */
  static error(error, data = {}) {
    return new InterpreterResponse(false, error, data);
  }
}

module.exports = {
  InterpreterRequest,
  InterpreterResponse
};