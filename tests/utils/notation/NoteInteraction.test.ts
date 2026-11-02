import { describe, expect, it, vi } from 'vitest'

import {
  checkPairingGeometry,
  collectGraphicNotes,
  hitNoteFromPosition,
  NoteInteraction,
  occupiesPlaybackSlot,
  pointToUnit,
  rendersNotehead,
  unitToPx,
  zipNotesWithElements,
  type NotePosition,
} from '@/utils/notation/NoteInteraction'
import { buildFakeScore, stubContainerRect, type FakeScoreSpec } from '../../helpers/osmdFake'
import type { Note } from 'opensheetmusicdisplay'

function fakeSource(
  fields: {
    isGrace?: boolean
    tie?: 'start' | 'continue'
    tieStart?: Record<string, unknown>
    printObject?: boolean
    /** 休止符（isRest() = true，不带整休止标志） */
    rest?: boolean
    /** 全小节休止：isRest() = true 且 IsWholeMeasureRest = true */
    wholeMeasureRest?: boolean
    /** 休止时长等价判定用：Length.RealValue 与小节拍号 RealValue */
    lengthReal?: number
    measureTsReal?: number
    /** 音符类型时值（`<type>` 解析产物；无 `<type>` 的 measure=yes 休止为 0，实测） */
    typeLength?: number
  } = {},
): Note {
  return {
    IsGraceNote: fields.isGrace === true,
    PrintObject: fields.printObject !== false,
    IsWholeMeasureRest: fields.wholeMeasureRest === true,
    isRest: () => fields.rest === true || fields.wholeMeasureRest === true,
    Length: { RealValue: fields.lengthReal ?? 0.25 },
    TypeLength:
      fields.typeLength === undefined ? undefined : { RealValue: fields.typeLength },
    SourceMeasure:
      fields.measureTsReal === undefined
        ? undefined
        : { ActiveTimeSignature: { RealValue: fields.measureTsReal } },
    NoteTie:
      fields.tie === 'start'
        ? { StartNote: undefined }
        : fields.tie === 'continue'
          ? { StartNote: fields.tieStart }
          : undefined,
  } as unknown as Note
}

describe('occupiesPlaybackSlot（audio.md §2.2 计数规则镜像）', () => {
  it('装饰音与连音线延续音不占位；休止符与发音音符占位', () => {
    const start = fakeSource({ tie: 'start' })
    // 起始音的 NoteTie.StartNote 指向自身
    ;(start.NoteTie as { StartNote: Note }).StartNote = start
    expect(occupiesPlaybackSlot(fakeSource())).toBe(true)
    expect(occupiesPlaybackSlot(fakeSource({ isGrace: true }))).toBe(false)
    expect(occupiesPlaybackSlot(start)).toBe(true)
    expect(occupiesPlaybackSlot(fakeSource({ tie: 'continue', tieStart: start as unknown as Record<string, unknown> }))).toBe(false)
  })
})

describe('rendersNotehead（防线 1 成员判定，OSMD 1.9.7 五谱实测 2026-10-28）', () => {
  it('带 <type> 的休止渲染（含全小节休止）；PrintObject=false 不渲染', () => {
    expect(rendersNotehead(fakeSource({ rest: true, typeLength: 1, lengthReal: 1 }))).toBe(true)
    expect(rendersNotehead(fakeSource({ rest: true, typeLength: 0.25 }))).toBe(true)
    expect(rendersNotehead(fakeSource({ printObject: false }))).toBe(false)
  })

  it('TypeLength=0 的休止（<rest measure="yes"/> 无 <type>）不渲染——《刻》谱 m34/59/70 回归', () => {
    expect(rendersNotehead(fakeSource({ rest: true, typeLength: 0, lengthReal: 1 }))).toBe(false)
  })

  it('TypeLength 未知的休止保守渲染（只收窄已实测类，不扩大排除面）', () => {
    expect(rendersNotehead(fakeSource({ rest: true }))).toBe(true)
  })

  it('排除只对休止收窄：TypeLength=0 的发音音符不受影响', () => {
    expect(rendersNotehead(fakeSource({ typeLength: 0 }))).toBe(true)
  })
})

describe('collectGraphicNotes（双索引计数，selection.md §2.1）', () => {
  /** 构造单小节谱：序列 [普通, 装饰音, tie起始, tie延续, 休止占位(普通)] */
  function specOf(sequence: unknown[]): unknown[][] {
    return [[{ staffEntries: [{ graphicalVoiceEntries: [{ notes: sequence }] }] }]]
  }

  it('noteIndex 只对占位音符递增；装饰音指向下一占位音，延续音指向起始音', () => {
    let tieStart: Note | null = null
    const sources: Note[] = []
    const push = (fields: Parameters<typeof fakeSource>[0]): Note => {
      const note = fakeSource(fields)
      sources.push(note)
      return note
    }
    push({})
    push({ isGrace: true })
    tieStart = push({ tie: 'start' })
    ;(tieStart.NoteTie as { StartNote: Note }).StartNote = tieStart
    push({ tie: 'continue', tieStart: tieStart as unknown as Record<string, unknown> })
    push({})

    const { notes, slotCount } = collectGraphicNotes(
      specOf(sources.map((n) => ({ sourceNote: n }))) as never,
    )
    expect(slotCount).toBe(3)
    expect(notes.map((n) => n.noteIndex)).toEqual([0, 1, 1, 1, 2])
    expect(notes.map((n) => n.occupiesSlot)).toEqual([true, false, true, false, true])
    expect(notes[3]?.tieStartNoteIndex).toBe(1)
    expect(notes.map((n) => n.graphicIndex)).toEqual([0, 1, 2, 3, 4])
  })

  it('PrintObject=false 不产生图形序但仍占播放位（与光标层对齐）', () => {
    const sources = [fakeSource({}), fakeSource({ printObject: false }), fakeSource({})]
    const { notes, slotCount } = collectGraphicNotes(
      specOf(sources.map((n) => ({ sourceNote: n }))) as never,
    )
    expect(slotCount).toBe(3)
    expect(notes).toHaveLength(2)
    expect(notes.map((n) => n.noteIndex)).toEqual([0, 2])
  })

  it('全小节休止产生图形序且占播放位（OSMD 1.9.7 实测：带 <type> 的解析休止渲染 notehead）', () => {
    const sources = [fakeSource({}), fakeSource({ wholeMeasureRest: true }), fakeSource({})]
    const { notes, slotCount } = collectGraphicNotes(
      specOf(sources.map((n) => ({ sourceNote: n }))) as never,
    )
    expect(slotCount).toBe(3)
    expect(notes).toHaveLength(3)
    expect(notes.map((n) => n.noteIndex)).toEqual([0, 1, 2])
    expect(notes.map((n) => n.graphicIndex)).toEqual([0, 1, 2])
  })

  it('TypeLength=0 的休止不进图形序但仍占播放位（防线 1 计数对齐，《刻》谱回归）', () => {
    const sources = [
      fakeSource({}),
      fakeSource({ rest: true, typeLength: 0, lengthReal: 1 }),
      fakeSource({}),
    ]
    const { notes, slotCount } = collectGraphicNotes(
      specOf(sources.map((n) => ({ sourceNote: n }))) as never,
    )
    expect(slotCount).toBe(3)
    expect(notes).toHaveLength(2)
    expect(notes.map((n) => n.noteIndex)).toEqual([0, 2])
    expect(notes.map((n) => n.graphicIndex)).toEqual([0, 1])
  })

  it('行号按 ParentStaffLine 身份分配（换行 → 下一行号）', () => {
    const rowA = { id: 'row-a' }
    const rowB = { id: 'row-b' }
    const measure = (row: object): unknown => ({
      ParentStaffLine: row,
      staffEntries: [{ graphicalVoiceEntries: [{ notes: [{ sourceNote: fakeSource({}) }] }] }],
    })
    const measures = [[measure(rowA)], [measure(rowB)], [measure(rowA)]]
    const { notes } = collectGraphicNotes(measures as never)
    expect(notes.map((n) => n.rowIndex)).toEqual([0, 1, 0])
  })
})

describe('DOM 配对三层防线（selection.md §3.3）', () => {
  it('防线 1：数量不等整条放弃（返回 null）', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const { elements } = buildFakeScore(
      { measures: [{ notes: [{ x: 10, y: 10 }, { x: 30, y: 10 }] }] },
      container,
    )
    const fakeNote = { source: { PositionAndShape: { AbsolutePosition: { x: 1, y: 1 } } } }
    expect(zipNotesWithElements([fakeNote as never], elements)).toBeNull()
    expect(zipNotesWithElements([fakeNote as never, fakeNote as never], elements)).toHaveLength(2)
    container.remove()
  })

  it('防线 2：中位偏移标定，偏离超 5px 的配对剔除', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    stubContainerRect(container)
    const { elements } = buildFakeScore(
      {
        measures: [
          { notes: [{ x: 100, y: 50 }, { x: 200, y: 50 }, { x: 300, y: 50 }] },
        ],
      },
      container,
    )
    // 第三个配对伪造 PAS（期望位置偏 30px）→ 应被剔除
    const makeNote = (unitX: number) =>
      ({
        source: {
          sourceNote: { isRest: () => false },
          PositionAndShape: { AbsolutePosition: { x: unitX, y: 5 } },
        },
      }) as never
    const notes = [makeNote(10), makeNote(20), makeNote(33)]
    const pairs = zipNotesWithElements(notes, elements)!
    const kept = checkPairingGeometry(pairs, 1, { x: 20, y: 10, width: 1000, height: 400 })
    expect(kept).toHaveLength(2)
    container.remove()
  })

  it('防线 2：休止/音符分类标定——类间 bbox 偏差 >5px 不再整类误杀（v1.9，《刻》谱实测）', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    stubContainerRect(container)
    // 交错排列（zip 按序配对）：音符 dy=0、休止 dy=+7（类间差 > 容差 5px）；
    // 混合中位数取音符类 0 → 休止整类被剔，分类标定后全部保留
    const spec = [
      { x: 100, y: 50 }, { x: 150, y: 57 }, { x: 200, y: 50 }, { x: 250, y: 57 },
      { x: 300, y: 50 }, { x: 350, y: 57 }, { x: 400, y: 50 }, { x: 500, y: 50 },
    ]
    const { elements } = buildFakeScore({ measures: [{ notes: spec }] }, container)
    const makeSource = (unitX: number, rest: boolean) =>
      ({
        source: {
          sourceNote: { isRest: () => rest },
          PositionAndShape: { AbsolutePosition: { x: unitX, y: 5 } },
        },
      }) as never
    const notes = [
      makeSource(8, false), makeSource(13, true), makeSource(18, false),
      makeSource(23, true), makeSource(28, false), makeSource(33, true),
      makeSource(38, false), makeSource(48, false),
    ]
    const pairs = zipNotesWithElements(notes, elements)!
    const kept = checkPairingGeometry(pairs, 1, { x: 20, y: 10, width: 1000, height: 400 })
    expect(kept).toHaveLength(8)

    // 类内个体漂移仍剔除：末枚休止伪造 PAS 偏 30px（期望 630 vs 实际 350）
    const notes2 = [
      makeSource(8, false), makeSource(13, true), makeSource(18, false),
      makeSource(23, true), makeSource(28, false), makeSource(33, true),
      makeSource(38, false),
      makeSource(63, true),
    ]
    const pairs2 = zipNotesWithElements(notes2, elements)!
    const kept2 = checkPairingGeometry(pairs2, 1, { x: 20, y: 10, width: 1000, height: 400 })
    expect(kept2).toHaveLength(7)
    expect(kept2).not.toContain(pairs2[7])
    container.remove()
  })

  it('build：rect 缓存为容器相对像素，命中链 closest → 元素映射', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    stubContainerRect(container)
    const spec: FakeScoreSpec = {
      measures: [{ notes: [{ x: 60, y: 40 }, { x: 120, y: 40 }] }],
    }
    const { osmd, elements } = buildFakeScore(spec, container)
    const interaction = new NoteInteraction(osmd as never, container)
    const result = interaction.build()
    expect(result.degraded).toBe(false)
    expect(result.positions).toHaveLength(2)
    expect(result.positions[0]).toMatchObject({ measureIndex: 0, noteIndex: 0, x: 60, y: 40 })

    const hit = interaction.hitFromEvent({ target: elements[1]!, clientX: 0, clientY: 0 })
    expect(hit?.noteIndex).toBe(1)

    // 空白目标（非 notehead、无回落命中）→ null = 框选入口
    const blank = interaction.hitFromEvent({ target: container, clientX: 0, clientY: 0 })
    expect(blank).toBeNull()
    container.remove()
  })

  it('hitFromClientPoint：按坐标命中（pointer capture 把 dblclick target 重定向到 stage，e2e 实测）', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    stubContainerRect(container)
    const spec: FakeScoreSpec = {
      measures: [{ notes: [{ x: 60, y: 40 }, { x: 120, y: 40 }] }],
    }
    const { osmd, elements } = buildFakeScore(spec, container)
    const interaction = new NoteInteraction(osmd as never, container)
    interaction.build()

    // elementFromPoint 返回音符头 → 命中；返回空白 → null（无最近邻回落：空白双击不设乐句）
    const elementFromPoint = vi.fn<(x: number, y: number) => Element | null>()
      .mockReturnValueOnce(elements[0] as unknown as Element)
      .mockReturnValueOnce(container)
    Object.defineProperty(document, 'elementFromPoint', {
      value: elementFromPoint,
      configurable: true,
    })
    try {
      expect(interaction.hitFromClientPoint(60, 40)?.noteIndex).toBe(0)
      expect(interaction.hitFromClientPoint(999, 999)).toBeNull()
    } finally {
      delete (document as unknown as Record<string, unknown>).elementFromPoint
    }
    container.remove()
  })

  it('计数守卫失败 → degraded，位置为空（洞超出防线 1 假设）', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    stubContainerRect(container)
    const { osmd } = buildFakeScore(
      { measures: [{ notes: [{ x: 10, y: 10 }, { x: 20, y: 10, printObject: false }] }] },
      container,
    )
    // 图形层 1 个可配对音符，DOM 有 1 个元素——人工多塞一个元素制造失衡
    const extra = document.createElement('div')
    extra.classList.add('vf-notehead')
    container.appendChild(extra)
    const interaction = new NoteInteraction(osmd as never, container)
    const result = interaction.build()
    expect(result.degraded).toBe(true)
    expect(result.positions).toHaveLength(0)
    container.remove()
  })

  it('全小节休止照常配对（「世界赠予我的」m1–m6/m26–m29 实测矩阵：解析休止有 notehead DOM）', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    stubContainerRect(container)
    const { osmd, elements } = buildFakeScore(
      {
        measures: [
          {
            notes: [
              { x: 10, y: 10 },
              { x: 20, y: 10, wholeMeasureRest: true },
              { x: 30, y: 10 },
            ],
          },
        ],
      },
      container,
    )
    expect(elements).toHaveLength(3) // 替身镜像真实 OSMD：解析休止（含全小节）产生 notehead DOM
    const interaction = new NoteInteraction(osmd as never, container)
    const result = interaction.build()
    // v1.7 误排除时：collect 2 ≠ DOM 3 → 计数守卫整条放弃（positions 清空、选择全灭）
    expect(result.degraded).toBe(false)
    expect(result.positions).toHaveLength(3)
    expect(result.positions.map((p) => p.noteIndex)).toEqual([0, 1, 2])
    container.remove()
  })

  it('缺 GraphicSheet（测试替身不完整）→ 降级不抛错', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const interaction = new NoteInteraction(undefined as never, container)
    const result = interaction.build()
    expect(result).toEqual({ positions: [], degraded: true })
    container.remove()
  })
})

describe('坐标换算（决策 S4，官方公式 issue #504/#857）', () => {
  it('px = unit × 10 × zoom；unit = px ÷ 10 ÷ zoom', () => {
    expect(unitToPx(2.5, 1)).toBe(25)
    expect(unitToPx(2.5, 2)).toBe(50)
    expect(pointToUnit(50, 1)).toBe(5)
    expect(pointToUnit(50, 2)).toBe(2.5)
  })
})

describe('hitNoteFromPosition（命中视图 → 端点解析入参）', () => {
  it('占位/装饰/延音延续三分类', () => {
    const base = { measureIndex: 0, graphicIndex: 0, x: 0, y: 0, width: 10, height: 10, rowIndex: 0 }
    const slot = { ...base, noteIndex: 1, occupiesSlot: true } as NotePosition
    const grace = { ...base, noteIndex: 2, occupiesSlot: false } as NotePosition
    const cont = { ...base, noteIndex: 1, occupiesSlot: false, tieStartNoteIndex: 1 } as NotePosition
    expect(hitNoteFromPosition(slot)).toMatchObject({ endpoint: 'slot', noteIndex: 1 })
    expect(hitNoteFromPosition(grace)).toMatchObject({ endpoint: 'grace' })
    expect(hitNoteFromPosition(cont)).toMatchObject({ endpoint: 'tie-continue', tieStartNoteIndex: 1 })
  })
})
