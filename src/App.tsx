import { TopNav } from './components/layout/TopNav'
import { Sidebar } from './components/layout/Sidebar'
import { Scene } from './components/3d/Scene'

function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0a' }}>
      <TopNav />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <Scene />
      </div>
    </div>
  )
}

export default App
