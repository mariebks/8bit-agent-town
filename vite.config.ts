import { defineConfig } from 'vite';
import path from 'path';

const isPlaywright = process.env.PLAYWRIGHT === '1';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src/shared')
    }
  },
  server: {
    port: 3000,
    open: !isPlaywright
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['e2e/**']
  }
});
