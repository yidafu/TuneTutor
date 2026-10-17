import { useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import OriginalAudioPage from './pages/OriginalAudioPage'
import ScorePage from './pages/ScorePage'

/**
 * 路由壳：Header 导航 + 两页共享 tempo（乐谱页可改，原曲页只读，
 * docs/tech.md §2.3）。整页 h-dvh 不滚动，各页自管内容滚动与吸底操作栏；
 * 播放引擎接入后，离开乐谱页需在此停止 Transport。
 */
export default function App() {
  const [tempo, setTempo] = useState(90)

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Header />
      <main className="flex w-full min-h-0 flex-1 flex-col pt-5">
        <Routes>
          <Route path="/" element={<ScorePage tempo={tempo} onTempoChange={setTempo} />} />
          <Route path="/audio" element={<OriginalAudioPage tempo={tempo} />} />
        </Routes>
      </main>
    </div>
  )
}
