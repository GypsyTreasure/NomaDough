import { Canvas } from '@react-three/fiber';
import { Grid, Environment } from '@react-three/drei';
import { Suspense } from 'react';
import { CutterModel } from './CutterModel';
import { SceneControls } from './SceneControls';
import { useGeometryStore } from '../../store/useGeometryStore';
import { useAppStore } from '../../store/useAppStore';

function EmptyState() {
  return (
    <mesh rotation={[0, 0, 0]}>
      <boxGeometry args={[0, 0, 0]} />
    </mesh>
  );
}

function SceneContent() {
  const geometry = useGeometryStore((s) => s.geometry);
  const c = useAppStore((s) => s.settings.cutterProfile.c);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[50, 100, 50]}
        intensity={1.2}
        color="#7EC845"
        castShadow
      />
      <directionalLight position={[-50, 80, -30]} intensity={0.5} color="#ffffff" />
      <pointLight position={[0, 50, 0]} intensity={0.3} color="#ffffff" />

      <Grid
        position={[0, 0, 0]}
        args={[300, 300]}
        cellSize={10}
        cellThickness={0.5}
        cellColor="#2a2a2a"
        sectionSize={50}
        sectionThickness={1}
        sectionColor="#333333"
        fadeDistance={400}
        fadeStrength={1}
        infiniteGrid
      />

      <SceneControls />

      <Suspense fallback={null}>
        {geometry ? <CutterModel /> : <EmptyState />}
      </Suspense>
    </>
  );
}

export function Scene() {
  const geometry = useGeometryStore((s) => s.geometry);
  const c = useAppStore((s) => s.settings.cutterProfile.c);

  return (
    <div style={{ width: '100%', height: '100%', background: '#0f0f0f' }}>
      <Canvas
        camera={{ position: [0, 80, 120], fov: 45, near: 0.1, far: 2000 }}
        shadows
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#0f0f0f' }}
      >
        <SceneContent />
      </Canvas>

      {!geometry && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ color: '#2a2a2a', fontSize: '48px', marginBottom: '16px' }}>⬡</div>
          <div style={{ color: '#444444', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
            Upload an image and detect a contour to generate the 3D preview
          </div>
        </div>
      )}
    </div>
  );
}
