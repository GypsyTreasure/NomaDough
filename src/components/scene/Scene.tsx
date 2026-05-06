import { Canvas } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import { Suspense, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { CutterModel } from './CutterModel';
import { SceneControls } from './SceneControls';
import { useGeometryStore } from '../../store/useGeometryStore';
import { useAppStore } from '../../store/useAppStore';
import { generateRibLinePositions } from '../../utils/geometry';

function RibLinesPreview() {
  const contourResult = useAppStore((s) => s.contourResult);
  const ribSettings = useAppStore((s) => s.settings.ribSettings);

  const lineGeo = useMemo(() => {
    if (!ribSettings.enabled || !contourResult) return null;
    const positions = generateRibLinePositions(contourResult, ribSettings);
    if (positions.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [contourResult, ribSettings]);

  useEffect(() => {
    return () => { lineGeo?.dispose(); };
  }, [lineGeo]);

  if (!lineGeo) return null;

  return (
    <lineSegments geometry={lineGeo}>
      <lineBasicMaterial color="#22C59A" opacity={0.55} transparent />
    </lineSegments>
  );
}

function SceneContent() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[50, 100, 50]} intensity={1.0} color="#22C59A" castShadow />
      <directionalLight position={[-40, 60, -30]} intensity={0.4} color="#7AB8D8" />
      <pointLight position={[0, 60, 0]} intensity={0.2} color="#ffffff" />

      <Grid
        position={[0, 0, 0]}
        args={[400, 400]}
        cellSize={10}
        cellThickness={0.4}
        cellColor="#1A3558"
        sectionSize={50}
        sectionThickness={0.8}
        sectionColor="#1A3558"
        fadeDistance={500}
        fadeStrength={1.5}
        infiniteGrid
      />

      <SceneControls />

      <RibLinesPreview />

      <Suspense fallback={null}>
        <CutterModel />
      </Suspense>
    </>
  );
}

export function Scene() {
  const geometry = useGeometryStore((s) => s.geometry);

  return (
    <div style={{ width: '100%', height: '100%', background: '#0D1B2A', position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 80, 120], fov: 45, near: 0.1, far: 2000 }}
        shadows
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#0D1B2A' }}
      >
        <SceneContent />
      </Canvas>

      {!geometry && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center', pointerEvents: 'none',
        }}>
          <div style={{ color: '#1A3558', fontSize: '52px', marginBottom: '12px', lineHeight: 1 }}>⬡</div>
          <div style={{ color: '#1A3558', fontSize: '13px', fontFamily: "'Barlow', sans-serif", fontWeight: 300 }}>
            Detect a contour, then Generate 3D Model
          </div>
        </div>
      )}
    </div>
  );
}
