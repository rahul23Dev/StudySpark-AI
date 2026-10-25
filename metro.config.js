// Lets the app import .svg files as React components (react-native-svg-transformer),
// and serves what expo-sqlite needs on web (its .wasm file and cross-origin isolation).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer/expo'),
};
config.resolver = {
  ...config.resolver,
  assetExts: [...config.resolver.assetExts.filter((ext) => ext !== 'svg'), 'wasm'],
  sourceExts: [...config.resolver.sourceExts, 'svg'],
  // apps/api is the separate Next.js backend (its own node_modules and React); never bundle it.
  blockList: [/[\\/]apps[\\/]api[\\/].*/],
};
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => (req, res, next) => {
    // SharedArrayBuffer (used by expo-sqlite on web) requires a cross-origin isolated page.
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return middleware(req, res, next);
  },
};

module.exports = config;
