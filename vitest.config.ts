import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['testUnitarios/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
