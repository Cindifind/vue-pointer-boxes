import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// 库模式下 Vite 不替换 process.env.NODE_ENV，这里手动替换，
// 否则浏览器里内嵌的 Vue 会抛 "process is not defined"
const replaceProcessEnv = {
  name: 'vpb-replace-process-env',
  transform(code) {
    if (!code.includes('process.env.NODE_ENV')) return null
    return {
      code: code.replace(/process\.env\.NODE_ENV/g, '"production"'),
      map: null,
    }
  },
}

export default defineConfig({
  plugins: [vue(), replaceProcessEnv],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    __DEV__: false,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL('./src/index.js', import.meta.url)),
      name: 'VuePointerBoxes',
      formats: ['umd'],
      fileName: () => 'vue-pointer-boxes.umd.js',
    },
    rollupOptions: {
      external: [],
      output: {
        exports: 'named',
      },
    },
  },
})
