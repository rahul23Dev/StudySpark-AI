import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Tests never reach the real provider: make an accidental real call fail fast.
    env: { ANTHROPIC_API_KEY: '' },
  },
});
