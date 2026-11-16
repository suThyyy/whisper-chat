module.exports = {
  preset: 'jest-expo',
  moduleDirectories: ['node_modules', '<rootDir>/node_modules/expo/node_modules'],
  testPathIgnorePatterns: ['<rootDir>/tests/firestore.rules.test.mjs'],
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@noble))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
};
