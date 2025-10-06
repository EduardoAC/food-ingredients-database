import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src')
    }
  },
  test: {
    environment: 'node',
    setupFiles: ['tests/setup/msw.ts'],
    include: ['tests/**/*.test.ts'],
    clearMocks: true
  },
  server: {
    fs: {
      allow: [path.resolve(rootDir)]
    }
  }
})
