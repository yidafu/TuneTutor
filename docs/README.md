# TuneTutor 文档导读

本目录是 TuneTutor（包 `tune-tutor`，仓库 `note-slice`）的全部设计文档。工程入口约定（命令、代码规范、已知坑）见根目录 [AGENTS.md](../AGENTS.md)。

**现状（2026-10-17）**：旧实现已删除，正按以下基线重写；旧代码见 git 历史（≤ `666183c`）。

## 文档地图

| 文档 | 职责 | 效力 |
| --- | --- | --- |
| [prd.md](./prd.md) | 产品需求：目标/KR、用户细分、功能清单 F1–F14（F14 二期）与规划功能 G1–G18、交互流、发布里程碑 | 产品基线（权威） |
| [ui-design.html](./ui-design.html) | 页面高保真示意、组件状态、设计规范（独立 HTML，浏览器直接打开） | UI 基准（权威） |
| [brand.html](./brand.html) | 品牌标志「反复记号」：构成比例、变体与文件清单（[brand/](./brand/)）、尺寸下限、安全区、用色禁忌、错误用法、字体授权与复现说明 | 视觉资产基准（权威） |
| [tech.md](./tech.md) | 技术规格：模块划分、数据契约、存储/i18n/构建约束、测试与里程碑 | 技术基线（权威） |
| [audio.md](./audio.md) | 音频播放技术规格：播放数据模型（乐谱时域）、look-ahead 播放引擎与可注入时钟、乐器音色、节拍器、原曲波形可视化与切片循环（自 tech.md §4/§5 拆分扩写，含同类实现调研、官方播放器逆向对照与决策 A1–A18；v2.0 起架构对齐官方播放器） | 技术基线（音频域细则，权威） |
| [selection.md](./selection.md) | 选择交互技术规格：音符命中测试、双索引对齐、端点解析与 LoopRange 推导、选择状态机、覆盖层（自 tech.md §6 拆分扩写，含同类实现调研、spike 实测与决策 S1–S8） | 技术基线（选择域细则，权威） |
| [musicxml.md](./musicxml.md) | MusicXML 导入解析技术规格：导入管线与 .mxl 解包、连线符（连结线/连线）、停顿、连音、装饰音、倚音等全部标记的解析映射与契约承载、错误分类（自 tech.md §2.2/§3 拆分扩写，含 musicxml-io 0.2.11 实测与决策 M1–M11） | 技术基线（导入解析域细则，权威） |
| [features/](./features/) | 二期功能规格，逐功能一篇（当前：[text-selection.md](./features/text-selection.md) 拖拽多行框选、[skin-switching.html](./features/skin-switching.html) 皮肤切换、[phone-compat.md](./features/phone-compat.md) 手机端布局兼容） | 补充规格（不得与基线冲突） |
| [test-cases.md](./test-cases.md) | 测试用例清单：功能（F1–F14 + 二期皮肤）→ 自动化用例映射（单元/集成/e2e，按域编号 TC-*）、手动验收过单（TC-MAN）、样例谱与夹具清单、已知盲区 | 用例清单（随实现维护；验证的行为契约以基线为准，冲突先修规格再修用例） |

## 阅读顺序

新接手者 / AI 代理：`AGENTS.md`（工程约定）→ PRD（做什么）→ UI 设计稿（长什么样）→ tech（怎么做）→ 实现导入解析前读 [musicxml.md](./musicxml.md)（导入解析域细则）→ 实现音频播放前读 [audio.md](./audio.md)（音频域细则）→ 实现选择交互前读 [selection.md](./selection.md)（选择域细则）→ 动窄视口/触屏布局前读 [features/phone-compat.md](./features/phone-compat.md)（手机布局细则）→ 涉及二期功能时再读 `features/` 对应篇。

## 冲突裁决

1. PRD 与 UI 设计稿定「做什么」，tech 定「怎么做」；
2. `features/` 只扩充行为，与基线冲突时以基线为准，并回改 features 文档；
3. audio.md 是 tech 的音频域细化，音频域内冲突以 audio.md 为准，并回改 tech.md 对应摘要；selection.md 是 tech 的选择域细化，选择域内冲突以 selection.md 为准，并回改 tech.md 对应摘要；musicxml.md 是 tech 的导入解析域细化，导入解析域内冲突以 musicxml.md 为准，并回改 tech.md 对应摘要；
4. 实现与文档冲突时，先修文档再修代码。

## 维护约定

- 新增功能规格放 `features/<功能名>.md`，不改动三份基线；
- 音频播放相关变更（`src/audio/`、播放控制、原曲页播放）改 [audio.md](./audio.md)，决策记录随变更更新；
- 选择交互相关变更（`src/utils/notation/`、选择覆盖层、乐谱页选择接线）改 [selection.md](./selection.md)，决策记录随变更更新；
- MusicXML 导入解析相关变更（`processFile.ts`、`musicXMLParser.ts`、标记域契约）改 [musicxml.md](./musicxml.md)，决策记录随变更更新；
- 用户可见文案必须进四语言文件（硬约束，tech §8）；
- 品牌标志与变体改 [brand.html](./brand.html)，矢量源文件放 `docs/brand/`，不放进 `public/`（那是会被构建产物直接暴露的代码目录）；favicon 由 `vite.config.ts` 的 `brandFavicon` 插件从 `docs/brand/tunetutor-app-icon.svg` 生成，不要在 `public/` 里再放一份副本。
- 测试用例清单随用例增删与盲区认领更新 [test-cases.md](./test-cases.md)（新增合成夹具同步 fixtures.test.ts 清单断言，新增自动化用例落 §3–§9 对应域，盲区落地后从 §12 注销）；
- 样例谱清单与 spike 验证结论记录于 tech §13。
