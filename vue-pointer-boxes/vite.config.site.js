import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 展示首页（静态站点）构建：产出 dist-site 下的纯静态文件，可直接部署到任意静态托管
export default defineConfig({
  // 相对路径，方便部署到子目录或用本地静态服务打开
  base: './',
  plugins: [vue()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'dist-site',
    emptyOutDir: true,
  },
})
