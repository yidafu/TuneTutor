import { Fragment, useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import * as stylex from '@stylexjs/stylex'
import { useClickOutside } from '../hooks/useClickOutside'
import { useTheme } from '../hooks/useTheme'
import { LANGUAGES, LANGUAGE_NAMES } from '../locales/languages'
import { useI18n } from '../locales/useI18n'
import { THEME_EN_NAMES, THEME_GROUPS, THEME_SWATCHES } from '../themes'
import { menuPop, menuItem, menuTrigger } from './menu.styles'
import { ThemeGlyph, ThemeIcon } from './icons/ThemeIcon'

const styles = stylex.create({
  anchor: {
    position: 'relative',
  },
  chevron: {
    fontSize: '10px',
    color: 'var(--color-fg-3)',
  },
  icon16: {
    height: '16px',
    width: '16px',
  },
  glyph17: {
    height: '17px',
    width: '17px',
    flex: 'none',
  },
  langName: {
    flex: 1,
  },
  langCheck: {
    color: 'var(--color-verm-deep)',
  },
  themePop: {
    top: 'calc(100% + 8px)',
    width: '272px',
    paddingBlock: '6px',
    paddingInline: '6px',
    borderRadius: 'var(--radius-card)',
  },
  themePopHead: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingInline: '10px',
    paddingBottom: '4px',
    paddingTop: '8px',
  },
  popTitle: {
    fontSize: '13px',
  },
  popHint: {
    fontSize: '11px',
    color: 'var(--color-fg-3)',
  },
  groupRow: {
    paddingInline: '10px',
    paddingBottom: '2px',
    paddingTop: '6px',
    fontSize: '10.5px',
    fontWeight: 700,
    letterSpacing: '1.2px',
    color: 'var(--color-fg-3)',
  },
  themeOption: {
    gap: '10px',
    borderRadius: '8px',
    paddingInline: '10px',
  },
  optionSelected: {
    backgroundColor: 'var(--color-surface-3)',
    fontWeight: 600,
    color: 'var(--color-fg)',
  },
  optionIdle: {
    color: 'var(--color-fg-2)',
  },
  swatchRow: {
    display: 'inline-flex',
    flex: 'none',
    gap: '3px',
  },
  swatchDot: {
    height: '11px',
    width: '11px',
    borderRadius: 9999,
    boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.12)',
  },
  nameWrap: {
    minWidth: 0,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  enName: {
    marginLeft: '6px',
    fontSize: '11px',
    fontWeight: 400,
    fontStyle: 'normal',
    color: 'var(--color-fg-3)',
  },
  checkMark: {
    flex: 'none',
    fontWeight: 700,
    color: 'var(--color-verm-deep)',
  },
  header: {
    display: 'flex',
    minHeight: '64px',
    flexShrink: 0,
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: '16px',
    rowGap: '4px',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--color-line)',
    backgroundColor: 'var(--color-header)',
    paddingInline: '22px',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  brandBox: {
    display: 'grid',
    height: '36px',
    width: '36px',
    alignItems: 'center',
    justifyItems: 'center',
    overflow: 'hidden',
    borderRadius: '10px',
    backgroundColor: 'var(--color-ink)',
    color: 'var(--color-cream)',
    boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.14), 0 2px 6px rgb(72 60 36 / 0.3)',
  },
  brandSvg: {
    display: 'block',
    height: '100%',
    width: '100%',
  },
  brandName: {
    fontFamily: 'var(--font-serif)',
    fontSize: '17px',
    fontWeight: 700,
    letterSpacing: '0.4px',
  },
  subtitle: {
    marginTop: '1px',
    fontSize: '11px',
    color: 'var(--color-fg-3)',
  },
  nav: {
    display: 'flex',
    gap: '22px',
  },
  navLink: {
    paddingInline: '2px',
    paddingBlock: '6px',
    fontSize: '13.5px',
    fontWeight: 600,
    // 触控专项（PRD G12）：触屏导航命中面加大
    '@media (pointer: coarse)': {
      paddingBlock: '10px',
    },
  },
  navLinkActive: {
    color: 'var(--color-fg)',
    boxShadow: 'inset 0 -2px 0 var(--color-verm)',
  },
  navLinkIdle: {
    color: 'var(--color-fg-2)',
    ':hover': {
      color: 'var(--color-fg)',
    },
  },
  switcherRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
})

function LangSwitcher() {
  const { language, setLanguage } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))

  return (
    <div {...stylex.props(styles.anchor)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        {...stylex.props(menuTrigger.base)}
      >
        {LANGUAGE_NAMES[language]}
        <span aria-hidden {...stylex.props(styles.chevron)}>▼</span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={LANGUAGE_NAMES[language]}
          {...stylex.props(menuPop.base)}
        >
          {LANGUAGES.map((lang) => (
            <li key={lang}>
              <button
                type="button"
                role="option"
                aria-selected={lang === language}
                onClick={() => {
                  setLanguage(lang)
                  setOpen(false)
                }}
                {...stylex.props(
                  menuItem.base,
                  lang === language ? styles.optionSelected : styles.optionIdle,
                )}
              >
                <span {...stylex.props(styles.langName)}>{LANGUAGE_NAMES[lang]}</span>
                {lang === language && (
                  <span aria-hidden {...stylex.props(styles.langCheck)}>✓</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * 皮肤切换器（skin-switching.html v1.3 §④-01）：页头「🎨 当前皮肤名 ▼」，
 * 弹层 272px 分「经典 / 古风」两组共 9 款，行 = 主题 identity 字形（ThemeGlyph，
 * 以该肤笔触渲染）+ 名称 + 英文副标 + 三色圆点预览；点选即时换肤并持久化（T4），
 * 关闭范式与 LangSwitcher 共用 useClickOutside，另支持 Esc。
 */
function ThemeSwitcher() {
  const { t } = useI18n()
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  return (
    <div {...stylex.props(styles.anchor)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        {...stylex.props(menuTrigger.base)}
      >
        <ThemeIcon name="palette" style={styles.icon16} />
        {t.theme[theme]}
        <span aria-hidden {...stylex.props(styles.chevron)}>▼</span>
      </button>
      {open && (
        <div {...stylex.props(menuPop.base, styles.themePop)}>
          <div {...stylex.props(styles.themePopHead)}>
            <b {...stylex.props(styles.popTitle)}>{t.theme.label}</b>
            <span {...stylex.props(styles.popHint)}>{t.theme.appliedHint}</span>
          </div>
          <ul role="listbox" aria-label={t.theme.label}>
            {THEME_GROUPS.map((group) => (
              <Fragment key={group.id}>
                <li role="presentation" {...stylex.props(styles.groupRow)}>
                  {t.theme.group[group.id]}
                </li>
                {group.themes.map((id) => {
                  const selected = id === theme
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          setTheme(id)
                          setOpen(false)
                        }}
                        {...stylex.props(
                          menuItem.base,
                          styles.themeOption,
                          selected ? styles.optionSelected : styles.optionIdle,
                        )}
                      >
                        <ThemeGlyph themeId={id} style={styles.glyph17} />
                        <span {...stylex.props(styles.nameWrap)}>
                          {t.theme[id]}
                          <em {...stylex.props(styles.enName)}>{THEME_EN_NAMES[id]}</em>
                        </span>
                        <span aria-hidden {...stylex.props(styles.swatchRow)}>
                          {THEME_SWATCHES[id].map((color) => (
                            <i
                              key={color}
                              {...stylex.props(styles.swatchDot)}
                              style={{ background: color }}
                            />
                          ))}
                        </span>
                        {selected && (
                          <span aria-hidden {...stylex.props(styles.checkMark)}>✓</span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </Fragment>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** 应用壳页头：品牌 + 双页导航 + 皮肤/语言切换（ui-design.html v3 + skin-switching v1.3） */
export default function Header() {
  const { t } = useI18n()

  return (
    <header {...stylex.props(styles.header)}>
      <div {...stylex.props(styles.brandRow)}>
        <div aria-hidden {...stylex.props(styles.brandBox)}>
          {/* 品牌标志「反复记号」：几何须与 docs/brand/tunetutor-app-icon.svg 保持一致 */}
          <svg {...stylex.props(styles.brandSvg)} viewBox="0 0 64 64">
            <g transform="translate(8.32,8.32) scale(0.74)" fill="currentColor">
              <rect x="14.1" y="8" width="8" height="48" />
              <rect x="29.7" y="8" width="2.6" height="48" />
              <circle cx="44.7" cy="24" r="5.2" />
              <circle cx="44.7" cy="40" r="5.2" />
            </g>
          </svg>
        </div>
        <div>
          <div {...stylex.props(styles.brandName)}>TuneTutor</div>
          <div {...stylex.props(styles.subtitle)}>{t.appSubtitle}</div>
        </div>
      </div>
      <nav {...stylex.props(styles.nav)} aria-label={t.appSubtitle}>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            stylex.props(styles.navLink, isActive ? styles.navLinkActive : styles.navLinkIdle)
              .className ?? ''
          }
        >
          {t.navScore}
        </NavLink>
        <NavLink
          to="/audio"
          className={({ isActive }) =>
            stylex.props(styles.navLink, isActive ? styles.navLinkActive : styles.navLinkIdle)
              .className ?? ''
          }
        >
          {t.navAudio}
        </NavLink>
      </nav>
      <div {...stylex.props(styles.switcherRow)}>
        <ThemeSwitcher />
        <LangSwitcher />
      </div>
    </header>
  )
}
