import { Canvas } from '@react-three/fiber'
import { Environment, Grid, Center } from '@react-three/drei'
import { Suspense } from 'react'
import { Controls } from './Controls'
import { Model } from './Model'
import { useGeometryStore } from '../../store/useGeometryStore'
import { useAppStore } from '../../store/useAppStore'

function EmptyState() {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      gap: '12px',
    }}>
      <svg
        width="80"
        height="80"
        viewBox="0 0 80 80"
        fill="none"
        opacity={0.15}
      >
        <rect x="10" y="10" width="60" height="60" rx="4" stroke="#00ff00" strokeWidth="1.5" strokeDasharray="4 4" />
        <path d="M20 40 L40 20 L60 40 L40 60 Z" stroke="#00ff00" strokeWidth="1" fill="none" />
        <circle cx="40" cy="40" r="4" fill="#00ff00" opacity="0.5" />
      </svg>
      <span style={{ color: '#2a2a2a', fontSize: '13px', letterSpacing: '0.5px' }}>
        Upload a sketch to begin
      </span>
    </div>
  )
}

function LoadingOverlay({ progress }: { progress: number }) {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      gap: '16px',
    }}>
      <div style={{
        width: '200px',
        height: '2px',
        background: '#1a1a1a',
        borderRadius: '1px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #00ff00, #00aa44)',
          transition: 'width 0.4s ease',
          boxShadow: '0 0 8px #00ff00',
        }} />
      </div>
      <span style={{ color: '#444', fontSize: '11px', letterSpacing: '1px' }}>
        GENERATING 3D MODEL — {Math.round(progress)}%
      </span>
    </div>
  )
}

export function Scene() {
  const { mesh, isGenerating, progress } = useGeometryStore()
  const { isProcessingCV, cvProgress } = useAppStore()

  const showEmpty = !mesh && !isGenerating && !isProcessingCV
  const showLoading = isGenerating || isProcessingCV
  const loadingProgress = isProcessingCV ? cvProgress / 2 : 50 + progress / 2

  return (
    <div style={{ flex: 1, position: 'relative', background: '#0a0a0a', overflow: 'hidden' }}>
      {showEmpty && <EmptyState />}
      {showLoading && <LoadingOverlay progress={loadingProgress} />}

      <Canvas
        camera={{ position: [0, 40, 80], fov: 45, near: 0.1, far: 10000 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#0a0a0a' }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.4} color="#ffffff" />
        <directionalLight position={[50, 100, 50]} intensity={1.2} color="#ffffff" castShadow />
        <directionalLight position={[-50, -50, -50]} intensity={0.3} color="#00ff44" />
        <pointLight position={[0, 0, 50]} intensity={0.5} color="#00ff00" distance={200} />

        {/* Environment */}
        <Suspense fallback={null}>
          <Environment preset="night" />
        </Suspense>

        {/* Grid */}
        <Grid
          args={[500, 500]}
          cellSize={10}
          cellThickness={0.3}
          cellColor="#1a1a1a"
          sectionSize={50}
          sectionThickness={0.5}
          sectionColor="#252525"
          fadeDistance={300}
          position={[0, -20, 0]}
        />

        {/* Model */}
        <Center>
          <Suspense fallback={null}>
            <Model />
          </Suspense>
        </Center>

        <Controls />
      </Canvas>

      {/* Info overlay when model is loaded */}
      {mesh && !showLoading && (
        <div style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          background: 'rgba(0,0,0,0.6)',
          border: '1px solid #1e1e1e',
          borderRadius: '20px',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{ width: '6px', height: '6px', background: '#00ff00', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
          <span style={{ color: '#555', fontSize: '10px', letterSpacing: '0.5px' }}>
            Model Ready · Drag to rotate
          </span>
        </div>
      )}
    </div>
  )
}
