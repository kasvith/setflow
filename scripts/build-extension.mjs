import { copyFile, mkdir, writeFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'

const distDir = 'dist'

// Copy public files
const publicFiles = ['icon16.png', 'icon48.png', 'icon128.png', 'content.css']

for (const file of publicFiles) {
  if (existsSync(`public/${file}`)) {
    await copyFile(`public/${file}`, `${distDir}/${file}`)
    console.log(`Copied ${file}`)
  }
}

// Create production manifest
const manifest = {
  manifest_version: 3,
  name: 'Setflow',
  description: 'Track your journey phases on YouTube Music',
  version: '1.0.0',
  permissions: ['storage'],
  action: {
    default_popup: 'popup.html',
    default_title: 'Setflow',
    default_icon: {
      '16': 'icon16.png',
      '48': 'icon48.png',
      '128': 'icon128.png',
    },
  },
  icons: {
    '16': 'icon16.png',
    '48': 'icon48.png',
    '128': 'icon128.png',
  },
  content_scripts: [
    {
      matches: ['*://music.youtube.com/*'],
      js: ['content.js'],
      css: ['content.css'],
    },
  ],
  background: {
    service_worker: 'background.js',
    type: 'module',
  },
}

await writeFile(`${distDir}/manifest.json`, JSON.stringify(manifest, null, 2))
console.log('Created manifest.json')

// Rename popup HTML
if (existsSync(`${distDir}/src/popup/index.html`)) {
  const html = await readFile(`${distDir}/src/popup/index.html`, 'utf-8')
  // Fix asset paths in HTML
  const fixedHtml = html.replace(/\.\.\/\.\.\//g, './')
  await writeFile(`${distDir}/popup.html`, fixedHtml)
  console.log('Created popup.html')
}

console.log('Build complete!')
