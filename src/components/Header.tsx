import { Fragment, useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useClickOutside } from '../hooks/useClickOutside'
import { useTheme } from '../hooks/useTheme'
import { LANGUAGES, LANGUAGE_NAMES } from '../locales/languages'
import { useI18n } from '../locales/useI18n'
import { THEME_EN_NAMES, THEME_GROUPS, THEME_SWATCHES } from '../themes'
import { ThemeIcon } from './icons/ThemeIcon'

function LangSwitcher() {
  const { language, setLanguage } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex cursor-pointer items-center gap-[7px] rounded-btn border border-line-strong bg-transparent px-[13px] py-[7px] text-[13px] font-medium text-fg-2 transition hover:bg-surface-3 hover:text-fg"
      >
        {LANGUAGE_NAMES[language]}
        <span aria-hidden className="text-[10px] text-fg-3">▼</span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={LANGUAGE_NAMES[language]}
          className="absolute right-0 top-[calc(100%+6px)] z-40 w-44 overflow-hidden rounded-btn border border-line-strong bg-surface-2 py-1 shadow-pop"
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
                className={`flex w-full cursor-pointer items-center px-3 py-2 text-left text-[13px] transition hover:bg-surface-3 ${
                  lang === language ? 'font-semibold text-fg' : 'text-fg-2'
                }`}
              >
                <span className="flex-1">{LANGUAGE_NAMES[lang]}</span>
                {lang === language && (
                  <span aria-hidden className="text-verm-deep">✓</span>
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
 * 皮肤切换器（skin-switching.html v1.1 §④-01）：页头「🎨 当前皮肤名 ▼」，
 * 弹层 272px 分「经典 / 古风」两组共 9 款，点选即时换肤并持久化（T4），
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
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex cursor-pointer items-center gap-[7px] rounded-btn border border-line-strong bg-transparent px-[13px] py-[7px] text-[13px] font-medium text-fg-2 transition hover:bg-surface-3 hover:text-fg"
      >
        <ThemeIcon name="palette" className="h-4 w-4" />
        {t.theme[theme]}
        <span aria-hidden className="text-[10px] text-fg-3">▼</span>
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-[272px] rounded-card border border-line-strong bg-surface-2 p-1.5 shadow-pop">
          <div className="flex items-baseline justify-between px-2.5 pb-1 pt-2">
            <b className="text-[13px]">{t.theme.label}</b>
            <span className="text-[11px] text-fg-3">{t.theme.appliedHint}</span>
          </div>
          <ul role="listbox" aria-label={t.theme.label}>
            {THEME_GROUPS.map((group) => (
              <Fragment key={group.id}>
                <li
                  role="presentation"
                  className="px-2.5 pb-0.5 pt-1.5 text-[10.5px] font-bold tracking-[1.2px] text-fg-3"
                >
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
                        className={`flex w-full cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13px] transition hover:bg-surface-3 ${
                          selected ? 'bg-surface-3 font-semibold text-fg' : 'text-fg-2'
                        }`}
                      >
                        <span aria-hidden className="inline-flex flex-none gap-[3px]">
                          {THEME_SWATCHES[id].map((color) => (
                            <i
                              key={color}
                              className="h-[11px] w-[11px] rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]"
                              style={{ background: color }}
                            />
                          ))}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {t.theme[id]}
                          <em className="ml-1.5 text-[11px] font-normal not-italic text-fg-3">
                            {THEME_EN_NAMES[id]}
                          </em>
                        </span>
                        {selected && (
                          <span aria-hidden className="flex-none font-bold text-verm-deep">✓</span>
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

/** 应用壳页头：品牌 + 双页导航 + 皮肤/语言切换（ui-design.html v3 + skin-switching v1.1） */
export default function Header() {
  const { t } = useI18n()

  const segLinkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-none px-[2px] py-1.5 text-[13.5px] font-semibold transition-colors ${
      isActive ? 'text-fg shadow-[inset_0_-2px_0_var(--color-verm)]' : 'text-fg-2 hover:text-fg'
    }`

  return (
    <header className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line bg-header px-[22px]">
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="grid h-9 w-9 place-items-center overflow-hidden rounded-[10px] bg-ink text-cream shadow-[inset_0_0_0_1px_rgb(255_255_255/0.14),0_2px_6px_rgb(72_60_36/0.3)]"
        >
          {/* 品牌标志「反复记号」：几何须与 docs/brand/tunetutor-app-icon.svg 保持一致 */}
          <svg className="block h-full w-full" viewBox="0 0 64 64">
            <g transform="translate(8.32,8.32) scale(0.74)" fill="currentColor">
              <rect x="14.1" y="8" width="8" height="48" />
              <rect x="29.7" y="8" width="2.6" height="48" />
              <circle cx="44.7" cy="24" r="5.2" />
              <circle cx="44.7" cy="40" r="5.2" />
            </g>
          </svg>
        </div>
        <div>
          <div className="font-serif text-[17px] font-bold tracking-[0.4px]">TuneTutor</div>
          <div className="mt-px text-[11px] text-fg-3">{t.appSubtitle}</div>
        </div>
      </div>
      <nav className="flex gap-[22px]" aria-label={t.appSubtitle}>
        <NavLink to="/" end className={segLinkClass}>
          {t.navScore}
        </NavLink>
        <NavLink to="/audio" className={segLinkClass}>
          {t.navAudio}
        </NavLink>
      </nav>
      <div className="flex items-center gap-2.5">
        <ThemeSwitcher />
        <LangSwitcher />
      </div>
    </header>
  )
}
