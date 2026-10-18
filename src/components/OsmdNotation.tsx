import { useEffect, useRef } from 'react'
import * as stylex from '@stylexjs/stylex'
import { OsmdRender } from '../utils/notation/OsmdRender'
import { useI18n } from '../locales/useI18n'

const styles = stylex.create({
  stage: {
    marginTop: '8px',
    display: 'grid',
    minHeight: '160px',
    flex: 1,
    alignItems: 'center',
    justifyItems: 'center',
    borderRadius: 'var(--radius-card)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'var(--color-line-strong)',
    backgroundColor: 'var(--color-wash)',
    paddingInline: '24px',
  },
  stageLoaded: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingInline: 0,
  },
  placeholder: {
    maxWidth: '420px',
    textAlign: 'center',
    fontSize: '13px',
    color: 'var(--color-fg-3)',
  },
  osmdContainer: {
    width: '100%',
  },
  footer: {
    marginTop: '14px',
    display: 'flex',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: 'var(--color-line)',
    paddingTop: '10px',
    fontSize: '11.5px',
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--color-ink-2)',
  },
  zoomRow: {
    display: 'inline-flex',
    gap: '4px',
  },
  zoomChip: {
    borderRadius: '6px',
    backgroundColor: 'var(--color-surface-3)',
    paddingInline: '8px',
    paddingBlock: '2px',
    color: 'var(--color-fg-2)',
  },
})

interface OsmdNotationProps {
  /** 解包后的主谱 XML 原文（processFile 产物）；undefined = 未加载 */
  rawContent?: string
}

/**
 * 纸面乐谱卡渲染区 + 页脚。持有 OSMD 实例（docs/tech.md §6.1）：
 * rawContent 变更即 load+render；渲染错误仅进 console（导入期错误已在 FileLoaderModal 提示）。
 * 选择/乐句覆盖层与光标跟随在播放域接入时补齐（P2）。
 */
export default function OsmdNotation({ rawContent }: OsmdNotationProps) {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (container === null || rawContent === undefined) return
    const renderer = new OsmdRender(container)
    void renderer.load(rawContent).catch((error: unknown) => {
      console.error('[OsmdNotation] render failed:', error)
    })
    return () => {
      container.innerHTML = ''
    }
  }, [rawContent])

  return (
    <>
      <div
        {...stylex.props(styles.stage, rawContent !== undefined && styles.stageLoaded)}
      >
        {rawContent === undefined ? (
          <p {...stylex.props(styles.placeholder)}>{t.notationPlaceholder}</p>
        ) : (
          <div ref={containerRef} {...stylex.props(styles.osmdContainer)} />
        )}
      </div>
      <div {...stylex.props(styles.footer)}>
        <span>{t.notationFootInfo}</span>
        <span {...stylex.props(styles.zoomRow)} aria-hidden="true">
          <span {...stylex.props(styles.zoomChip)}>－</span>
          <span {...stylex.props(styles.zoomChip)}>100%</span>
          <span {...stylex.props(styles.zoomChip)}>＋</span>
        </span>
      </div>
    </>
  )
}
