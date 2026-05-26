import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    reporters: process.env['CI'] ? ['default'] : ['verbose'],
    testTimeout: 10_000,
  },
});
