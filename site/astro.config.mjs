import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  site: 'https://setflow.kasvith.me',
  // The live demo imports the extension's own shared utils from ../src
  vite: { plugins: [tailwindcss()], server: { fs: { allow: ['..'] } } },
})
