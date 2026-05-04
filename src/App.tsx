import { Suspense } from 'react';
import { TopNav } from './components/layout/TopNav';
import { Footer } from './components/layout/Footer';
import { SettingsPanel } from './components/SettingsPanel';
import { Scene } from './components/scene/Scene';

function App() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: '#0D1B2A', fontFamily: "'Barlow', system-ui, sans-serif",
    }}>
      <TopNav />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left sidebar */}
        <div style={{
          width: '320px', minWidth: '280px',
          background: '#0F2035',
          borderRight: '1px solid #1A3558',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <SettingsPanel />
        </div>

        {/* Right 3D panel */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#7A9BB8', fontSize: '13px' }}>
              Loading 3D renderer…
            </div>
          }>
            <Scene />
          </Suspense>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default App;
