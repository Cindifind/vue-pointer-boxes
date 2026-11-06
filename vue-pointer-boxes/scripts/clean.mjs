import { rm } from 'node:fs/promises'
import { fileURLToPath, URL } from 'node:url'

// 用法: node scripts/clean.mjs dist [dist-site ...]
//
// 必须用异步 rm。Windows + Node 24 下同步的 fs.rmSync(recursive) 在项目路径上会原生崩溃
// （0xC0000409，日志停在 "N modules transformed"，崩在删除内部而非退出期），
// 而 build.emptyOutDir 走的正是同步删除路径 —— 输出目录里一旦有文件，构建就崩。
// 所以产物目录要在 Vite 启动之前由这个脚本删掉，并保留 EBUSY / EPERM 重试。
const targets = process.argv.slice(2)

if (!targets.length) {
  console.error('用法: node scripts/clean.mjs <目录...>')
  process.exitCode = 1
} else {
  for (const target of targets) {
    const dir = fileURLToPath(new URL(`../${target}`, import.meta.url))
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 })
    console.log(`[clean] ${target}/ removed`)
  }
}
