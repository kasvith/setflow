import { defineConfig } from 'astro/config'

export default defineConfig({
  // The live demo imports the extension's own shared utils from ../src
  vite: { server: { fs: { allow: ['..'] } } },
})
