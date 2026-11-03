module.exports = {
  preset: 'jest-expo',
  moduleDirectories: ['node_modules', '<rootDir>/node_modules/expo/node_modules'],
  testPathIgnorePatterns: ['<rootDir>/tests/firestore.rules.test.mjs'],
};
