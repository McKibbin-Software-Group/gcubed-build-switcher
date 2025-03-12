/**
 * Python extension API interaction module
 */
const vscode = require('vscode');
const pythonExt = require('@vscode/python-extension');

/**
 * Maximum number of retries when looking for Python extension
 * @type {number}
 */
const MAX_EXTENSION_DISCOVERY_RETRIES = 3;

/**
 * Delay between extension discovery retries in milliseconds
 * @type {number}
 */
const EXTENSION_DISCOVERY_RETRY_DELAY_MS = 500;

/**
 * Retrieves and ensures the Python extension is activated
 * @returns {Promise<Object>} Python API object
 * @throws {Error} If Python extension cannot be found or activated
 */
async function getPythonApi() {
  const pythonExtension = await locatePythonExtensionWithRetry();

  if (!pythonExtension) {
    throw new Error('Python extension not found after multiple attempts. Please ensure it is installed.');
  }

  // Activate extension if not already active
  if (!pythonExtension.isActive) {
    await activatePythonExtension(pythonExtension);
  }

  // Get and return the API
  return await pythonExt.PythonExtension.api();
}

/**
 * Attempts to locate the Python extension with retries
 * @param {number} [maxRetries=MAX_EXTENSION_DISCOVERY_RETRIES] - Maximum retry attempts
 * @param {number} [delayMs=EXTENSION_DISCOVERY_RETRY_DELAY_MS] - Delay between attempts
 * @returns {Promise<vscode.Extension|null>} The Python extension or null if not found
 */
async function locatePythonExtensionWithRetry(
  maxRetries = MAX_EXTENSION_DISCOVERY_RETRIES,
  delayMs = EXTENSION_DISCOVERY_RETRY_DELAY_MS
) {
  let retryCount = 0;
  let pythonExtension = vscode.extensions.getExtension('ms-python.python');

  while (!pythonExtension && retryCount < maxRetries) {
    console.warn(`Python extension not found, retrying (${retryCount + 1}/${maxRetries})...`);
    await delay(delayMs);
    pythonExtension = vscode.extensions.getExtension('ms-python.python');
    retryCount++;
  }

  return pythonExtension;
}

/**
 * Activates the Python extension
 * @param {vscode.Extension} pythonExtension - The Python extension to activate
 * @returns {Promise<void>}
 * @throws {Error} If activation fails
 */
async function activatePythonExtension(pythonExtension) {
  try {
    console.info('Activating Python extension...');
    await pythonExtension.activate();
    console.info('Python extension activated successfully');
  } catch (error) {
    throw new Error(`Failed to activate Python extension: ${error.message}`);
  }
}

/**
 * Refreshes Python environments
 * @param {Object} pythonApi - Python extension API
 * @param {boolean} [forceRefresh=true] - Whether to force refresh
 * @returns {Promise<Array>} List of known environments
 */
async function refreshPythonEnvironments(pythonApi, forceRefresh = true) {
  await pythonApi.environments.refreshEnvironments({ forceRefresh });
  return pythonApi.environments.known;
}

/**
 * Checks if a Python interpreter path exists in known environments
 * @param {string} interpreterPath - Absolute path to the interpreter
 * @param {Array} environments - List of known environments
 * @returns {boolean} True if interpreter exists in environments
 */
function isInterpreterInEnvironments(interpreterPath, environments) {
  return environments.some(env => {
    const envKey = Object.keys(env)[0];
    return env[envKey].path === interpreterPath;
  });
}

/**
 * Creates a delay promise
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>} Promise that resolves after the delay
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Formats environments as a readable string for logging
 * @param {Array} environments - Python environments array
 * @returns {string} Formatted string representation
 */
function formatEnvironmentsForLogging(environments) {
  return environments
    .map(env => {
      const key = Object.keys(env)[0];
      return `${key}: id='${env[key].id}', path='${env[key].path}'`;
    })
    .join('\n');
}

module.exports = {
  getPythonApi,
  refreshPythonEnvironments,
  isInterpreterInEnvironments,
  formatEnvironmentsForLogging,
  delay
};