module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/tests/**/*.test.js', '**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/automation/**/*.js',
    'src/workers/**/*.js',
    'src/lib/SecurityValidator.js',
    'src/lib/AICommandParser.js'
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 30000
};
