import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

export default defineConfig({
  plugins: [
    // React Compiler memoises components and hooks at build time (React 19 ships its runtime)
    react({ babel: { plugins: [['babel-plugin-react-compiler', {}]] } }),
    crx({ manifest }),
  ],
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
})
