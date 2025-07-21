import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/Hero-of-Dwarf/' : '/',
  root: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    // 代码分割配置
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        // 手动代码分割
        manualChunks: (id) => {
          // Phaser 单独打包
          if (id.includes('node_modules/phaser')) {
            return 'phaser';
          }
          // 游戏核心代码
          if (id.includes('/entities/') || id.includes('/managers/')) {
            return 'game';
          }
          // UI和系统
          if (id.includes('/systems/') || id.includes('match3')) {
            return 'ui';
          }
        },
        // 分块文件名
        chunkFileNames: 'assets/[name]-[hash].js',
      },
    },
    // 提高代码分割阈值
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 3000,
    open: true,
  },
  publicDir: 'public',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})