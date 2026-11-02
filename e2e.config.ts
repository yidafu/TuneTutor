import type { E2EConfig } from 'e2e'
import { web } from '@e2e-dev/web'

/**
 * tester-army/e2e 集成测试（docs/tech.md §12 门禁之外的浏览器层）：
 * - 全部用 locator/断言确定性步骤，不使用 agent 步骤 → 无需模型 API key；
 * - 端口用 0（runner 挑空闲端口替换 {port}），避免与常驻 dev server 抢 5173/5174；
 * - Vite base 是 /TuneTutor/（GitHub Pages 部署约束），url 带前缀，测试里
 *   app.open('/TuneTutor/#/…') 绝对路径打开。
 */
export default {
  tests: 'tests/e2e/**/*.e2e.ts',
  targets: [
    {
      engine: web(),
      app: {
        url: 'http://127.0.0.1:0/TuneTutor/',
        command: {
          executable: 'pnpm',
          // --host 127.0.0.1：vite 默认绑 localhost(::1)，runner 按声明的 127.0.0.1 探活会不可达
          args: ['dev', '--host', '127.0.0.1', '--port', '{port}', '--strictPort'],
          log: '.e2e/logs/app.log',
        },
      },
    },
  ],
} satisfies E2EConfig
