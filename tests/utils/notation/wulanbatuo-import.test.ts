import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import type { Cursor, Note } from "opensheetmusicdisplay";
import { processFile } from "@/utils/notation/processFile";
import { buildPlaybackData, halfToneToNoteName } from "../../../src/audio/playbackData";

const SCORE_PATH = "musicxml/乌兰巴托的夜.musicxml";

describe("乌兰巴托的夜.musicxml import", () => {
  it("parses 63 measures with beams", async () => {
    const buf = readFileSync(SCORE_PATH);
    const file = new File([buf], "乌兰巴托的夜.musicxml", { type: "application/xml" });
    const result = await processFile(file);
    expect(result.parsedScore.measures).toHaveLength(63);
    expect(buf.toString("utf-8")).toContain('<beam number="2">begin</beam>');
  });
});

/**
 * 同音连结线（tie）必须成对，且在播放域合并为单条目（docs/audio.md §2.2-2/§2.2-3：
 * 延续音不占位不播，起始音取 NoteTie.Duration）。本谱为 OMR 产物，2026-10-19 修复
 * 6 处数据缺陷：m33/m39/m45/m49/m53 重复段末音漏写 tie start（同乐句在 m13/m17/
 * m37/m41/m58 写法健全，逐音对照可证），m61 一处幻觉 tie stop（同音候选隔 4 音，
 * tie 不允许跨音，判为误读删除）。本组回归防止悬空 stop / 漏写 start 再次混入：
 * 悬空 stop 会被 OSMD 静默丢弃，同音两音各自发音，延音断裂。
 *
 * 时戳对齐说明：OSMD 光标时间线与本谱 XML duration 累计存在恒定漂移（OMR 时值瑕疵，
 * m17 起实测 +1/16），故播放域断言全部以 OSMD 自身时戳为锚，不从 XML 重算。
 * 断言按「时距终点锚定」：tie 起始音带前置倚音时（本谱多处 B#5 倚音），A17 挤压式
 * 插放推迟主音 start、等量缩短 duration，终点不变。
 */

/** XML 层配对完整性：每个 tie stop 都有同声部同音 start，且无未闭合 start */
function assertTiePairsMatched(xml: string): number {
  const open = new Map<string, string>()
  let pairs = 0
  let measure = 0
  for (const match of xml.matchAll(/<measure number="(\d+)"|<note\b[\s\S]*?<\/note>/g)) {
    const body = match[0]
    if (body.startsWith("<measure")) {
      measure = Number(match[1])
      continue
    }
    const step = body.match(/<step>(\w)<\/step>/)?.[1]
    if (step === undefined) continue
    const alter = Number(body.match(/<alter>(-?\d+)<\/alter>/)?.[1] ?? 0)
    const octave = Number(body.match(/<octave>(\d+)<\/octave>/)?.[1] ?? 4)
    const voice = body.match(/<voice>(\d+)<\/voice>/)?.[1] ?? "1"
    const key = `${voice}|${step}${"#".repeat(Math.max(0, alter))}${octave}`
    const ties = [...body.matchAll(/<tie type="(\w+)"/g)].map((t) => t[1])
    if (ties.includes("stop")) {
      expect(open.get(key), `m${measure} ${key} tie stop 无同音 start 配对`).toBeDefined()
      open.delete(key)
      pairs += 1
    }
    if (ties.includes("start")) open.set(key, `m${measure}`)
  }
  expect([...open.values()], "tie start 未闭合").toEqual([])
  return pairs
}

interface TieNote {
  noteName: string
  /** OSMD 光标绝对时间戳（RealValue） */
  ts: number
  len: number
  tieDur: number
}

async function collectTieNotes(cursor: Cursor): Promise<{ starts: TieNote[]; continues: TieNote[] }> {
  const starts: TieNote[] = []
  const continues: TieNote[] = []
  cursor.reset()
  for (let step = 0; step < 1_000_000; step += 1) {
    if (cursor.iterator.EndReached) break
    for (const voiceEntry of cursor.iterator.CurrentVoiceEntries) {
      for (const note of voiceEntry.Notes as Note[]) {
        if (note.isRest()) continue
        const tie = note.NoteTie
        if (tie === undefined || tie === null) continue
        const record: TieNote = {
          noteName: halfToneToNoteName(note.halfTone + 12),
          ts: cursor.iterator.currentTimeStamp.RealValue,
          len: note.Length.RealValue,
          tieDur: tie.Duration?.RealValue ?? 0,
        }
        if (tie.StartNote === note) starts.push(record)
        else continues.push(record)
      }
    }
    cursor.next()
  }
  return { starts, continues }
}

async function loadRealCursor(): Promise<Cursor> {
  const { OpenSheetMusicDisplay } = await import("opensheetmusicdisplay")
  const container = document.createElement("div")
  const osmd = new OpenSheetMusicDisplay(container, { autoResize: false, backend: "svg" })
  await osmd.load(readFileSync(SCORE_PATH, "utf-8"))
  const manager = osmd.Sheet.MusicPartManager
  let iterator = manager.getIterator()
  return {
    reset: () => {
      iterator = manager.getIterator()
    },
    next: () => iterator.moveToNext(),
    get iterator() {
      return iterator
    },
  } as unknown as Cursor
}

describe("乌兰巴托的夜 tie 数据完整性", () => {
  it("每个 tie stop 都有同声部同音 start 配对（共 12 组，无悬空）", () => {
    const pairs = assertTiePairsMatched(readFileSync(SCORE_PATH, "utf-8"))
    expect(pairs).toBe(12)
  })
})

describe("乌兰巴托的夜 播放数据同音 tie 合并（真实 OSMD 光标，jsdom 加载不渲染）", () => {
  const EPS = 1e-6

  it("OSMD 侧 12 组 tie 全部建立链路（start 12 个、延续音 12 个）", async () => {
    const { starts, continues } = await collectTieNotes(await loadRealCursor())
    expect(starts).toHaveLength(12)
    expect(continues).toHaveLength(12)
    // 合并链路生效：NoteTie.Duration 必须大于起始段自身时值（= 各段之和）
    for (const start of starts) {
      expect(start.tieDur, `tie start @${start.ts} ${start.noteName} 未合并`).toBeGreaterThan(
        start.len,
      )
    }
  })

  it("每组 tie 合并为单条目（时距终点 = 起始点 + NoteTie.Duration），延续段不再独立发音", async () => {
    const cursor = await loadRealCursor()
    const { starts, continues } = await collectTieNotes(cursor)
    const entries = buildPlaybackData(cursor)
    for (const start of starts) {
      const endRv = start.ts + start.tieDur
      const merged = entries.find(
        (entry) =>
          entry.noteName === start.noteName &&
          entry.startRv >= start.ts - EPS &&
          Math.abs(entry.startRv + entry.durationRv - endRv) < EPS,
      )
      expect(
        merged,
        `tie start @${start.ts} ${start.noteName} 应合并为单条目（时距终点 ${endRv}）`,
      ).toBeDefined()
    }
    for (const continuation of continues) {
      const reattack = entries.find(
        (entry) =>
          entry.noteName === continuation.noteName &&
          Math.abs(entry.startRv - continuation.ts) < EPS,
      )
      expect(
        reattack,
        `tie 延续音 @${continuation.ts} ${continuation.noteName} 不应独立发音`,
      ).toBeUndefined()
    }
  })
})
