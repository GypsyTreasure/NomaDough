import { Canvas } from '@react-three/fiber'
import { Environment, Grid } from '@react-three/drei'
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
      gap: '16px',
    }}>
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" opacity={0.25}>
        <rect x="8" y="8" width="56" height="56" rx="6" stroke="#00ff00" strokeWidth="1.5" strokeDasharray="4 3" />
        <path d="M18 36 L36 18 L54 36 L36 54 Z" stroke="#00ff00" strokeWidth="1" fill="none" opacity="0.6" />
        <circle cx="36" cy="36" r="4" fill="#00ff00" opacity="0.5" />
        <line x1="36" y1="8" x2="36" y2="18" stroke="#00ff00" strokeWidth="1" opacity="0.3" />
        <line x1="36" y1="54" x2="36" y2="64" stroke="#00ff00" strokeWidth="1" opacity="0.3" />
        <line x1="8" y1="36" x2="18" y2="36" stroke="#00ff00" strokeWidth="1" opacity="0.3" />
        <line x1="54" y1="36" x2="64" y2="36" stroke="#00ff00" strokeWidth="1" opacity="0.3" />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
        <span style={{ color: '#3a3a3a', fontSize: '13px', letterSpacing: '0.5px' }}>
          Upload a sketch to begin
        </span>
        <span style={{ color: '#252525', fontSize: '11px' }}>
          PNG · JPG · HEIC
        </span>
      </div>
    </div>
  )
}

function LoadingOverlay({ progress, phase }: { progress: number; phase: string }) {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      gap: '14px',
    }}>
      <div style={{
        width: '220px',
        height: '1px',
        background: '#1a1a1a',
        borderRadius: '1px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #007700, #00ff00)',
          transition: 'width 0.4s ease',
          boxShadow: '0 0 10px #00ff00',
        }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
        <span style={{ color: '#3a3a3a', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
          {phase}
        </span>
        <span style={{ color: '#2a2a2a', fontSize: '10px', fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  )
}

export function Scene() {
  const { mesh, isGenerating, progress } = useGeometryStore()
  const { isProcessingCV, cvProgress } = useAppStore()

  const showEmpty = !mesh && !isGenerating && !isProcessingCV
  const showLoading = isGenerating || isProcessingCV

  const loadingPhase = isProcessingCV ? 'Extracting contours' : 'Generating 3D mesh'
  const loadingProgress = isProcessingCV ? cvProgress / 2 : 50 + progress / 2

  return (
    <div style={{ flex: 1, position: 'relative', background: '#0a0a0a', overflow: 'hidden' }}>
      {showEmpty && <EmptyState />}
      {showLoading && <LoadingOverlay progress={loadingProgress} phase={loadingPhase} />}

      <Canvas
        camera={{ position: [0, 50, 100], fov: 40, near: 0.1, far: 10000 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#0a0a0a' }}
      >
        <ambientLight intensity={0.5} color="#ffffff" />
        <directionalLight position={[60, 120, 60]} intensity={1.4} color="#ffffff" />
        <directionalLight position={[-40, -40, -40]} intensity={0.25} color="#00ff44" />
        <pointLight position={[0, 0, 60]} intensity={0.4} color="#00ff00" distance={300} />

        <Suspense fallback={null}>
          <Environment preset="night" />
        </Suspense>

        <Grid
          args={[600, 600]}
          cellSize={10}
          cellThickness={0.25}
          cellColor="#161616"
          sectionSize={50}
          sectionThickness={0.4}
          sectionColor="#202020"
          fadeDistance={350}
          position={[0, -25, 0]}
        />

        <Suspense fallback={null}>
          <Model />
        </Suspense>

        <Controls />
      </Canvas>

      {/* Model ready badge */}
      {mesh && !showLoading && (
        <div style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          padding: '6px 14px',
          background: 'rgba(10,10,10,0.75)',
          border: '1px solid #1c1c1c',
          borderRadius: '20px',
          backdropFilter: 'blur(10px)',
          animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            background: '#00ff00',
            borderRadius: '50%',
            animation: 'pulse 2.5s ease-in-out infinite',
            boxShadow: '0 0 6px #00ff00',
          }} />
          <span style={{ color: '#484848', fontSize: '10px', letterSpacing: '0.4px' }}>
            Model ready · Drag to rotate · Scroll to zoom
          </span>
        </div>
      )}
    </div>
  )
}
