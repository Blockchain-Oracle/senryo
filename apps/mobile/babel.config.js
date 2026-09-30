// React Compiler memoizes the app's own components only (apps/mobile/src); shared packages run uncompiled, as on web.
// babel-preset-expo adds the Reanimated/worklets plugin itself (SDK 54+).
module.exports = function config(api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { "react-compiler": { sources: (filename) => filename.includes("/mobile/src/") } }]],
  };
};
