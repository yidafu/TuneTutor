import { useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import * as stylex from '@stylexjs/stylex'
import Header from './components/Header'
import OriginalAudioPage from './pages/OriginalAudioPage'
import ScorePage from './pages/ScorePage'

const styles = stylex.create({
  root: {
    display: 'flex',
    height: '100dvh',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  main: {
    display: 'flex',
    width: '100%',
    minHeight: 0,
    flex: 1,
    flexDirection: 'column',
    paddingTop: '20px',
  },
})

/**
 * 路由壳：Header 导航 + 两页共享 tempo（乐谱页可改，原曲页只读，
 * docs/tech.md §2.3）。整页 h-dvh 不滚动，各页自管内容滚动与吸底操作栏；
 * 播放引擎接入后，离开乐谱页需在此停止 Transport。
 */
export default function App() {
  const [tempo, setTempo] = useState(90)

  return (
    <div {...stylex.props(styles.root)}>
      <Header />
      <main {...stylex.props(styles.main)}>
        <Routes>
          <Route path="/" element={<ScorePage tempo={tempo} onTempoChange={setTempo} />} />
          <Route path="/audio" element={<OriginalAudioPage tempo={tempo} />} />
        </Routes>
      </main>
    </div>
  )
}
