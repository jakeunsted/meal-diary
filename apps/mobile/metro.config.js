const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

// SDK 52+ configures monorepo resolution automatically — do not set watchFolders
// or nodeModulesPaths manually (breaks web SSR in npm workspaces).
const config = getDefaultConfig(__dirname);

module.exports = withNativewind(config, { inlineRem: 16 });
