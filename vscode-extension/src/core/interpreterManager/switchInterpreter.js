const vscode = require('vscode');
const path = require('path');
const {
  getPythonApi,
  refreshPythonEnvironments,
  isInterpreterInEnvironments,
  formatEnvironmentsForLogging,
  delay
} = require('./pythonExtension');
const { InterpreterResponse } = require('../../core/messaging/message');

/**
 * Maximum retries when checking for interpreter in environments
 * @type {number}
 */
const MAX_ENVIRONMENT_CHECK_RETRIES = 2;

/**
 * Delay between environment check retries in milliseconds
 * @type {number}
 */
const ENVIRONMENT_CHECK_RETRY_DELAY_MS = 1000;

/**
 * Core function to switch Python interpreter
 * @param {InterpreterRequest} request - Protocol-agnostic request
 * @param {Object} [logger=console] - Logger to use
 * @returns {Promise<InterpreterResponse>} Protocol-agnostic response
 */
async function switchInterpreter(request, logger = console) {
  // Validate request
  if (!request.isValid()) {
    const validationError = request.getValidationError() || "Invalid request";
    logger.error(`Validation error: ${validationError}`);
    return InterpreterResponse.error(validationError);
  }

  try {
    // Resolve absolute path
    const absoluteInterpreterPath = resolveInterpreterPath(request.pythonPath);
    logger.info(`Resolved interpreter path: ${absoluteInterpreterPath}`);

    // Get Python API
    const pythonApi = await getPythonApi();

    // Attempt to switch the interpreter
    return await performInterpreterSwitch(
      pythonApi,
      absoluteInterpreterPath,
      request.pythonPath,
      request.shortName,
      logger
    );
  } catch (error) {
    logger.error(`Failed to switch interpreter: ${error.message}`);
    return InterpreterResponse.error(`Failed to switch interpreter: ${error.message}`);
  }
}

/**
 * Resolves interpreter path to absolute path
 * @param {string} interpreterPath - Path to interpreter (absolute or relative)
 * @returns {string} Absolute path to interpreter
 * @throws {Error} If no workspace is open
 */
function resolveInterpreterPath(interpreterPath) {
  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
    throw new Error('No workspace folder is open');
  }

  return path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath, interpreterPath);
}

/**
 * Performs the actual interpreter switching operation
 * @param {Object} pythonApi - Python extension API
 * @param {string} absoluteInterpreterPath - Absolute path to interpreter
 * @param {string} requestedPath - Original requested path
 * @param {string} shortName - Short display name (optional)
 * @param {Object} logger - Logger to use
 * @returns {Promise<InterpreterResponse>} Result of operation
 */
async function performInterpreterSwitch(
  pythonApi,
  absoluteInterpreterPath,
  requestedPath,
  shortName,
  logger
) {
  // First refresh environments
  let environments = await refreshPythonEnvironments(pythonApi);
  logger.info('Known Python environments before switching:');
  logger.info(formatEnvironmentsForLogging(environments));

  // Check if interpreter exists, with retries
  if (!await validateInterpreterExists(pythonApi, absoluteInterpreterPath, environments, logger)) {
    const errorMessage = `Cannot switch to '${requestedPath}' - not found in available Python environments`;
    logger.error(errorMessage);

    return InterpreterResponse.error(errorMessage, {
      requestedPath: absoluteInterpreterPath,
      availableEnvironments: formatEnvironmentsForLogging(environments)
    });
  }

  // Switch interpreter
  const displayName = shortName || requestedPath;
  logger.info(`Switching to interpreter: ${displayName}`);

  try {
    await pythonApi.environments.updateActiveEnvironmentPath(absoluteInterpreterPath);

    // Refresh again to confirm switch
    environments = await refreshPythonEnvironments(pythonApi);
    logger.info('Known Python environments after switching:');
    logger.info(formatEnvironmentsForLogging(environments));

    // Notify user
    vscode.window.showInformationMessage(`Switched to Python interpreter: ${displayName}`);

    return InterpreterResponse.success({
      requestedPath: requestedPath,
      absolutePath: absoluteInterpreterPath
    });
  } catch (error) {
    return InterpreterResponse.error(
      `Failed during interpreter switch operation: ${error.message}`
    );
  }
}

/**
 * Validates that interpreter exists in environments, with retries
 * @param {Object} pythonApi - Python extension API
 * @param {string} interpreterPath - Path to check
 * @param {Array} environments - Current environments
 * @param {Object} logger - Logger to use
 * @returns {Promise<boolean>} True if interpreter exists
 */
async function validateInterpreterExists(pythonApi, interpreterPath, environments, logger) {
  // Check if already in environments
  if (isInterpreterInEnvironments(interpreterPath, environments)) {
    return true;
  }

  // Not found, try refreshing and checking again
  for (let attempt = 1; attempt <= MAX_ENVIRONMENT_CHECK_RETRIES; attempt++) {
    logger.warn(`Interpreter not found in environments, retrying (attempt ${attempt}/${MAX_ENVIRONMENT_CHECK_RETRIES})...`);

    await delay(ENVIRONMENT_CHECK_RETRY_DELAY_MS);
    environments = await refreshPythonEnvironments(pythonApi, true);

    if (isInterpreterInEnvironments(interpreterPath, environments)) {
      return true;
    }
  }

  // Still not found after retries
  return false;
}

module.exports = { switchInterpreter };