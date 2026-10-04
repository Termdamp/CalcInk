import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node', // math/strokes/recognition logic needs no DOM
    include: ['tests/**/*.test.ts'],
  },
});
