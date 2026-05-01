import { Canvas } from '@react-three/fiber'
import { Environment, Grid } from '@react-three/drei'
import { Suspense } from 'react'
import { Controls } from './Controls'
import { Model } from './Model'
import { useStore } from '../../store/useStore'

export function SceneView() {
  const { phase, geoProgress } = useStore()
  const isGenerating = phase === 'geo-loading'

  return (
    <div style={{ flex:1, position:'relative', background:'#080808', overflow:'hidden' }}>
      {/* Progress bar across top */}
      {isGenerating && (
        <div style={{
          position:'absolute', top:0, left:0, right:0, zIndex:10,
          height:'2px', background:'#111',
        }}>
          <div style={{
            height:'100%', width:`${geoProgress}%`,
            background:'linear-gradient(90deg,#006600,#00ff00)',
            transition:'width .4s ease',
            boxShadow:'0 0 8px #00ff00',
          }} />
        </div>
      )}

      {/* Generating overlay text */}
      {isGenerating && (
        <div style={{
          position:'absolute', inset:0, zIndex:9,
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          pointerEvents:'none', gap:'14px',
          animation:'fadeIn .2s ease',
        }}>
          <div style={{ width:'180px', display:'flex', flexDirection:'column', alignItems:'center', gap:'10px' }}>
            <span style={{ color:'#2a2a2a', fontSize:'10px', letterSpacing:'1.5px', textTransform:'uppercase' }}>
              Generating 3D mesh
            </span>
            <span style={{ color:'#1e1e1e', fontSize:'22px', fontVariantNumeric:'tabular-nums', fontWeight:200 }}>
              {geoProgress}%
            </span>
          </div>
        </div>
      )}

      <Canvas
        camera={{ position: [0, 80, 120], fov: 40, near: 0.1, far: 50000 }}
        gl={{ antialias: true }}
        shadows
        style={{ background: '#080808' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[60, 120, 60]} intensity={1.4} castShadow />
        <directionalLight position={[-40, 20, -60]} intensity={0.3} color="#00ff44" />

        <Suspense fallback={null}>
          <Environment preset="night" />
        </Suspense>

        {/* XY "table" surface — the base plane at Y=0 */}
        <Grid
          args={[800, 800]}
          cellSize={10} cellThickness={0.2} cellColor="#111111"
          sectionSize={50} sectionThickness={0.4} sectionColor="#1a1a1a"
          fadeDistance={500} position={[0, 0, 0]}
        />

        <Model />
        <Controls />
      </Canvas>

      {/* Ready badge */}
      {phase === 'ready' && (
        <div style={{
          position:'absolute', bottom:16, right:16,
          display:'flex', alignItems:'center', gap:'8px',
          padding:'6px 14px',
          background:'rgba(8,8,8,.8)', border:'1px solid #1a1a1a',
          borderRadius:'20px', backdropFilter:'blur(8px)',
          animation:'fadeIn .3s ease',
        }}>
          <div style={{
            width:'6px', height:'6px', borderRadius:'50%', background:'#00ff00',
            animation:'pulse 2.5s ease-in-out infinite',
            boxShadow:'0 0 6px #00ff00',
          }} />
          <span style={{ color:'#3a3a3a', fontSize:'10px', letterSpacing:'.4px' }}>
            Model ready · Drag to rotate · Scroll to zoom
          </span>
        </div>
      )}
    </div>
  )
}
