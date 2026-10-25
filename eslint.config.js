// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // apps/api is a separate Next.js project with its own tooling.
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'apps/**'],
  },
]);
