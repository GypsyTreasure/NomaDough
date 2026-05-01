import { useStore } from './store/useStore'
import { TopNav } from './components/layout/TopNav'
import { Sidebar } from './components/layout/Sidebar'
import { EmptyView } from './components/views/EmptyView'
import { PreviewView } from './components/views/PreviewView'
import { SceneView } from './components/3d/SceneView'
import { ErrorView } from './components/views/ErrorView'

function MainContent() {
  const { phase } = useStore()

  switch (phase) {
    case 'idle':
      return <EmptyView />
    case 'cv-loading':
      // Show empty view with a dim overlay while CV loads (progress shown in sidebar)
      return <EmptyView />
    case 'preview':
      return <PreviewView />
    case 'geo-loading':
    case 'ready':
      return <SceneView />
    case 'error':
      return <ErrorView />
    default:
      return <EmptyView />
  }
}

function App() {
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <TopNav />
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <Sidebar />
        <MainContent />
      </div>
    </div>
  )
}

export default App
