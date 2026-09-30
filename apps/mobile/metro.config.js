// Expo SDK 52+ configures Metro for monorepos by itself (docs.expo.dev/guides/monorepos): no watchFolders or
// nodeModulesPaths here. The one addition, ported from the pre-existing kit: workspace packages may carry their own
// dev copies of React / React Query, and React Native refuses two Reacts, so every import of these singletons
// resolves from the app's own node_modules.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const SINGLETONS = ["react", "react-native", "@tanstack/react-query"];
const appEntry = path.join(__dirname, "node_modules", "index.js");

const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const pinned = SINGLETONS.some((name) => moduleName === name || moduleName.startsWith(`${name}/`));
  const ctx = pinned ? { ...context, originModulePath: appEntry } : context;
  return (upstream ?? context.resolveRequest)(ctx, moduleName, platform);
};

module.exports = config;
