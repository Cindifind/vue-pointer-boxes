import { copyFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

// 为 require() 消费者提供 CJS 后缀副本（package.json "type": "module"）
copyFileSync(
  fileURLToPath(new URL('../dist/vue-pointer-boxes.umd.js', import.meta.url)),
  fileURLToPath(new URL('../dist/vue-pointer-boxes.umd.cjs', import.meta.url)),
)
console.log('[build] dist/vue-pointer-boxes.umd.cjs ready')
