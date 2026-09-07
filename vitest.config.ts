import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts so the extension build plugins stay out of the test run
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
})
