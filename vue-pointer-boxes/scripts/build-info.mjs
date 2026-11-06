import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

// 在 dist 里盖一个版本戳，check-dist 用它拦住「拿旧产物发新版本」
const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'))

const info = {
  name: pkg.name,
  version: pkg.version,
  builtAt: new Date().toISOString(),
  features: [
    'mode:text',
    'mode:html',
    'mode:markdown',
    'rich-text',
    'cascade-layer-styles',
    'font-inherit',
    'markdown-code-child-box',
    'blur-char-limit',
  ],
}

writeFileSync(
  fileURLToPath(new URL('../dist/build-info.json', import.meta.url)),
  JSON.stringify(info, null, 2) + '\n',
)
console.log(`[build-info] ${pkg.name}@${pkg.version}`)
