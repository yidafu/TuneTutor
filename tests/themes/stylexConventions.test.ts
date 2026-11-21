import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * StyleX 书写约定守卫（phone-compat P11/P2）：源码静态扫描（读文件走 cwd，tests 约定），
 * 新代码回归即红。jsdom 不注入 StyleX 样式表，这类约定只能在源码层兜住。
 */
const SRC = join(process.cwd(), 'src')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

/** 逐行扫描，命中 predicate(line, 上一非空行) 的位置以 file:line 返回 */
function scan(predicate: (line: string, previous: string) => boolean): string[] {
  const offenders: string[] = []
  for (const file of sourceFiles(SRC)) {
    let previous = ''
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        if (predicate(line, previous)) offenders.push(`${relative(process.cwd(), file)}:${index + 1}`)
        if (line.trim() !== '') previous = line
      })
  }
  return offenders
}

describe('StyleX 书写约定', () => {
  it("悬停门控：每个 ':hover' 键的上一非空行都是 '@media (hover: hover)'", () => {
    // 触屏点按后 :hover 会粘滞，裸写会在 iPad/手机上留下高亮残影
    const offenders = scan(
      (line, previous) => /^\s*':hover':/.test(line) && !previous.includes("'@media (hover: hover)'"),
    )
    expect(offenders).toEqual([])
  })

  it("媒体查询键不得写成 'a and b' 复合查询（改用嵌套单条件）", () => {
    // StyleX 0.19.1 dev 运行时注入的去重键正则 /^@media\s*\([^)]+\)\s*{/ 不认复合查询，
    // 回落成「整条查询文本」作键：同一复合查询下只有第一条规则被插入，其余在 dev 下
    // 静默丢失（生产构建静态抽取不受影响，2026-11-09 框选开关 display 规则实测丢失）
    const offenders = scan((line) => /'@(media|supports|container) \([^)]*\) and /.test(line))
    expect(offenders).toEqual([])
  })
})
