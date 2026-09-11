import { execSync } from 'node:child_process'
import fs from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const packageJson = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

let gitHash = 'c7b86f1'
try {
  gitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
} catch {
  // fallback if git is unavailable
}

function devFaviconPlugin(): Plugin {
  return {
    name: 'dev-favicon',
    apply: 'serve',
    transformIndexHtml(html: string) {
      return html
        .replace(/href="(\.\/)?favicon\.svg"/g, 'href="./favicon-dev.svg"')
        .replace(/href="(\.\/)?favicon-32x32\.png"/g, 'href="./favicon-dev-32x32.png"')
        .replace(/href="(\.\/)?favicon-16x16\.png"/g, 'href="./favicon-dev-16x16.png"')
        .replace(/href="(\.\/)?apple-touch-icon\.png"/g, 'href="./apple-touch-icon-dev.png"')
        .replace(/href="(\.\/)?favicon\.ico"/g, 'href="./favicon-dev.ico"')
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [tailwindcss(), react(), devFaviconPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version || '1.0.0'),
    __GIT_COMMIT_HASH__: JSON.stringify(gitHash),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
})

