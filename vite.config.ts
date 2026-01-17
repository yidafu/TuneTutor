import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/TuneTutor/',
  resolve: {
    alias: {
      // Provide browser-compatible stubs for Node.js modules used by musicxml-io
      'fs/promises': resolve(__dirname, 'src/vite-browser-shims/fs-promises.ts'),
    },
  },
  optimizeDeps: {
  },
})

function resolve(_dir: string, file: string) {
  return new URL(file, import.meta.url).href
}
