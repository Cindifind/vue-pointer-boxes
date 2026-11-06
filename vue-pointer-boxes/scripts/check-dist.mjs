import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

// 发布前自检：dist 必须真的包含 README 承诺的能力，且与新版本号一致。
// 起因：1.1.0 发布的 dist 来自旧源码，README 里的 markdown / @layer / 富文本全都不存在。

const abs = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url))
const read = (p) => readFileSync(abs(p), 'utf8')
const pkg = JSON.parse(read('package.json'))
const errors = []

const bundles = ['dist/vue-pointer-boxes.es.js', 'dist/vue-pointer-boxes.umd.js', 'dist/vue-pointer-boxes.umd.cjs']
const markers = [
  ['Markdown 渲染', 'markdown'],
  ['富文本模式字段', 'dataset.mode'],
  ['级联层样式 @layer', '@layer'],
  ['逐字模糊上限 blurCharLimit', 'blurCharLimit'],
  ['长文整体淡入上限 richCharLimit', 'richCharLimit'],
  ['markdown 代码块子 box', 'vpb-md-code'],
]

let esCode = ''
for (const file of bundles) {
  if (!existsSync(abs(file))) { errors.push(`缺少 ${file}（先跑 npm run build）`); continue }
  const code = read(file)
  if (file.endsWith('.es.js')) esCode = code
  for (const [label, marker] of markers) {
    if (!code.includes(marker)) errors.push(`${file} 里找不到「${label}」，产物可能是旧版本`)
  }
}

// umd.cjs 是 umd.js 的副本，两者必须一致，否则 copy-umd 那步没执行
if (existsSync(abs('dist/vue-pointer-boxes.umd.js')) && existsSync(abs('dist/vue-pointer-boxes.umd.cjs'))) {
  if (read('dist/vue-pointer-boxes.umd.js') !== read('dist/vue-pointer-boxes.umd.cjs')) {
    errors.push('umd.cjs 与 umd.js 内容不一致，copy-umd 步骤可能未执行')
  }
}

// 版本戳：防止把旧 dist 当作新版本发出去
let info = null
try { info = JSON.parse(read('dist/build-info.json')) } catch (e) {
  errors.push('缺少 dist/build-info.json（先跑 npm run build）')
}
if (info && info.version !== pkg.version) {
  errors.push(`dist 版本 ${info.version} 与 package.json 的 ${pkg.version} 不一致，请重新构建`)
}

// README 里声称需要当前版本才有的能力，必须在同一版本下被文档化
const readme = read('README.md')
if (!readme.includes(`v${pkg.version}`)) {
  errors.push(`README 未标注当前版本 v${pkg.version} 的版本对应关系`)
}

if (errors.length) {
  console.error('[check-dist] FAILED')
  errors.forEach((e) => console.error('  - ' + e))
  process.exit(1)
}

const kb = (n) => (n / 1024).toFixed(1) + ' kB'
console.log(`[check-dist] OK ${pkg.name}@${pkg.version}`)
console.log(`  dist/vue-pointer-boxes.es.js    ${kb(Buffer.byteLength(esCode, 'utf8'))}`)
console.log(`  features: ${info.features.join(', ')}`)
