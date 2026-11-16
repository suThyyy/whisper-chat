const {
  withGradleProperties,
  withAppBuildGradle,
  createRunOncePlugin,
} = require('@expo/config-plugins');

const PLUGIN_NAME = 'withGradleArch';

/**
 * Config Plugin to optimize Android native builds:
 * 1. Sets reactNativeArchitectures in android/gradle.properties (default: 'arm64-v8a,x86_64')
 *    to prevent building unused 32-bit legacy ABIs, saving disk space and compile time.
 * 2. Injects CMAKE_OBJECT_PATH_MAX=250 into defaultConfig.externalNativeBuild.cmake
 *    to protect against Windows 260-char MAX_PATH Ninja errors.
 */
const withGradleArch = (config, options = {}) => {
  const architectures = options.architectures || 'arm64-v8a,x86_64';

  config = withGradleProperties(config, (modConfig) => {
    const existing = modConfig.modResults.find(
      (item) => item.type === 'property' && item.key === 'reactNativeArchitectures'
    );
    if (existing) {
      existing.value = architectures;
    } else {
      modConfig.modResults.push({
        type: 'property',
        key: 'reactNativeArchitectures',
        value: architectures,
      });
    }
    return modConfig;
  });

  config = withAppBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    if (!contents.includes('CMAKE_OBJECT_PATH_MAX')) {
      contents = contents.replace(
        /defaultConfig\s*\{/,
        `defaultConfig {\n        externalNativeBuild {\n            cmake {\n                arguments "-DCMAKE_OBJECT_PATH_MAX=250"\n            }\n        }`
      );
      modConfig.modResults.contents = contents;
    }
    return modConfig;
  });

  return config;
};

module.exports = createRunOncePlugin(withGradleArch, PLUGIN_NAME, '1.0.0');
