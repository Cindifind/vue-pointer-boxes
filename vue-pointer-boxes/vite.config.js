import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL('./src/index.js', import.meta.url)),
      name: 'VuePointerBoxes',
      formats: ['es'],
      fileName: () => 'vue-pointer-boxes.es.js',
    },
    rollupOptions: {
      external: ['vue'],
    },
  },
})
