/**
 * 走带端到端（docs/audio.md §3、PlaybackControls）：
 * 单按钮切换（v1.6：播放中主按钮语义转「停止」，无常驻停止副键）。
 * 点击 Play 走完整链路：usePlayback → PlaybackEngine（look-ahead 调度）→
 * InstrumentLoader（Tone.js 采样器，构建期内联的 mp3 资产）→ 状态事件回写
 * playing → 按钮 aria-pressed/标签翻转。
 * UI 没有 ready 门控（引擎预载钢琴采样期间 Play 可点但被静默丢弃，§3.6），
 * 所以用重试点击对齐真实用户行为：点了没反应就再点。
 */
import { test } from '@e2e-dev/web'
import { expect } from 'e2e'
import { openApp, waitForNoteheads } from './helpers'

test('transport button toggles between Play and Stop', async ({ app, screen, browser }) => {
  await openApp(app, browser)
  await waitForNoteheads(browser)

  const play = screen.getByRole('button', { name: 'Play' })
  await expect(play).toHaveAttribute('aria-pressed', 'false')
  // 单按钮切换：停止态不存在独立停止键（toBeHidden 对「不存在」也通过）
  await expect(screen.getByRole('button', { name: 'Stop' })).toBeHidden({ timeout: 1_000 })

  // 引擎就绪前点击被丢弃（toggle 在 engine===null 时 no-op）→ 重试直至按钮翻转
  await expect
    .poll(
      async () => {
        const stop = screen.getByRole('button', { name: 'Stop' })
        if ((await stop.count()) > 0 && (await stop.first().isVisible())) return true
        await play.click()
        return false
      },
      { timeout: 30_000, interval: 1_000 },
    )
    .toBe(true)

  const stop = screen.getByRole('button', { name: 'Stop' })
  await expect(stop).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 })

  await stop.click()
  await expect(screen.getByRole('button', { name: 'Play' })).toHaveAttribute(
    'aria-pressed',
    'false',
    { timeout: 10_000 },
  )
})
