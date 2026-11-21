import * as stylex from '@stylexjs/stylex'

/**
 * 下拉弹层（listbox）三件套：Header 语言/皮肤切换器与乐器选择器共用。
 * 颜色一律走皮肤 token，禁写死色值。
 */

/** 弹层触发按钮（语言 / 皮肤切换器共用；乐器选择器因底色不同自带样式） */
export const menuTrigger = stylex.create({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    paddingInline: '13px',
    paddingBlock: '7px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-line-strong)',
    borderRadius: 'var(--radius-btn)',
    backgroundColor: 'transparent',
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--color-fg-2)',
    // 悬停门控（phone-compat P11）：触屏点按后 :hover 会粘滞，只给真悬停设备
    '@media (hover: hover)': {
      ':hover': {
        backgroundColor: 'var(--color-surface-3)',
        color: 'var(--color-fg)',
      },
    },
    // 触控专项（PRD G12）：触屏下拉钮命中面加大
    '@media (pointer: coarse)': {
      paddingBlock: '10px',
    },
  },
})

/**
 * 弹层容器：右对齐挂在触发钮下方（ul 自带的列表样式一并清掉）。
 * 手机窄屏（phone-compat P3）：宽高双向钳到视口内、超高内滚；水平位置的
 * 左溢由调用方 usePopoverClamp 算 translateX 偏移补偿。
 */
export const menuPop = stylex.create({
  base: {
    position: 'absolute',
    right: 0,
    top: 'calc(100% + 6px)',
    zIndex: 40,
    width: '176px',
    maxWidth: 'calc(100vw - 24px)',
    maxHeight: 'calc(100dvh - 140px)',
    margin: 0,
    paddingBlock: '4px',
    paddingInline: 0,
    listStyle: 'none',
    overflowX: 'hidden',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-line-strong)',
    borderRadius: 'var(--radius-btn)',
    backgroundColor: 'var(--color-surface-2)',
    boxShadow: 'var(--shadow-pop)',
  },
})

/** 弹层选项行：选中态 / 未选中态由调用方按条件追加 */
export const menuItem = stylex.create({
  base: {
    display: 'flex',
    width: '100%',
    alignItems: 'center',
    paddingInline: '12px',
    paddingBlock: '8px',
    textAlign: 'left',
    fontSize: '13px',
    '@media (hover: hover)': {
      ':hover': {
        backgroundColor: 'var(--color-surface-3)',
      },
    },
    // 触控专项（PRD G12）：触屏选项行加高（下拉整行可点）
    '@media (pointer: coarse)': {
      paddingBlock: '12px',
    },
  },
})
