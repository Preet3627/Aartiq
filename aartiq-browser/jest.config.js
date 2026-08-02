module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/tests/**/*.test.js', '**/tests/**/*.test.js', '**/tests/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['@swc/jest', {
      jsc: {
        parser: { syntax: 'typescript', tsx: false },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
      module: { type: 'commonjs' },
    }],
    '^.+\\.(js|jsx|mjs|cjs)$': ['@swc/jest', {
      jsc: { parser: { syntax: 'ecmascript' } },
      module: { type: 'commonjs' },
    }],
  },
  transformIgnorePatterns: [],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/automation/**/*.js',
    'src/workers/**/*.js',
    'src/lib/SecurityValidator.js',
    'src/lib/AICommandParser.js',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 30000,
};
