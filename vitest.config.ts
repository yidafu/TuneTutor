import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import stylex from '@stylexjs/rollup-plugin';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    // dev 模式编译 stylex.create：测试里拿到真实原子类名，jsdom 同时注入样式。
    // importSources 收窄到精确包名，避免误处理含 'stylex' 字样的非 JS 模块
    stylex({ dev: true, importSources: ['@stylexjs/stylex'] }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
