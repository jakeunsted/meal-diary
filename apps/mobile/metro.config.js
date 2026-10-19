const { getPostHogExpoConfig } = require('posthog-react-native/metro');
const { withNativewind } = require('nativewind/metro');

// SDK 52+ configures monorepo resolution automatically — do not set watchFolders
// or nodeModulesPaths manually (breaks web SSR in npm workspaces).
// getPostHogExpoConfig wraps Expo's default config and tags bundles for source maps.
const config = getPostHogExpoConfig(__dirname);

module.exports = withNativewind(config, { inlineRem: 16 });
