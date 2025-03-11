module.exports = {
  testEnvironment: 'node',
  rootDir: '../../',  // Point to vscode-extension root directory
  testMatch: ['**/tests/httpServer/**/*.test.js'],
  verbose: true,
  testTimeout: 10000, // 10 second timeout for network tests
};