import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'

/** OSMD 选项基线（docs/tech.md §6.1） */
const OSMD_OPTIONS = {
  autoResize: true,
  backend: 'svg',
  disableCursor: false,
  drawTitle: true,
  drawComposer: true,
  drawPartNames: true,
  coloringEnabled: true,
}

/**
 * OSMD 实例管理（docs/tech.md §6.1）：一个容器一个实例，load 同一份 rawContent 幂等
 * （React 严格模式二次执行 effect 不重渲染）。rawContent 是唯一渲染输入（决策 M2，
 * 禁止喂 serialize() 重序列化产物）。
 */
export class OsmdRender {
  private readonly osmd: OpenSheetMusicDisplay
  private loadedContent: string | null = null

  constructor(container: HTMLElement) {
    this.osmd = new OpenSheetMusicDisplay(container, OSMD_OPTIONS)
  }

  get instance(): OpenSheetMusicDisplay {
    return this.osmd
  }

  async load(rawContent: string): Promise<void> {
    if (this.loadedContent === rawContent) return
    await this.osmd.load(rawContent)
    this.osmd.render()
    this.loadedContent = rawContent
  }

  /** 清空渲染并失效内容缓存；重渲染/清除时必须失效音符缓存（tech.md §6.1） */
  clear(): void {
    this.osmd.clear()
    this.loadedContent = null
  }
}
