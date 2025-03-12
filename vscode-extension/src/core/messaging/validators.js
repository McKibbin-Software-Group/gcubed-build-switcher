/**
 * Validates interpreter path request
 *
 * @param {Object} request - Request object containing pythonPath
 * @returns {Object} Validation result {isValid, errorMessage}
 */
function validateInterpreterRequest(request) {
  if (!request || !request.pythonPath) {
    return { isValid: false, errorMessage: "Missing required parameter: pythonPath" };
  }

  if (typeof request.pythonPath !== 'string') {
    return { isValid: false, errorMessage: "pythonPath must be a string" };
  }

  if (request.pythonPath.trim() === '') {
    return { isValid: false, errorMessage: "pythonPath cannot be empty" };
  }

  return { isValid: true, errorMessage: null };
}

/**
 * Creates standardized response object
 *
 * @param {boolean} success - Success status
 * @param {string|null} error - Optional error message
 * @param {Object} data - Additional response data
 * @returns {Object} Formatted response object
 */
function createResponse(success, error = null, data = {}) {
  return {
    success,
    ...(error && { error }),
    ...data,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  validateInterpreterRequest,
  createResponse
};