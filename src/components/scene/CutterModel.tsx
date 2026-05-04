import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useGeometryStore } from '../../store/useGeometryStore';

export function CutterModel() {
  const geometry = useGeometryStore((s) => s.geometry);
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (meshRef.current && geometry) {
      meshRef.current.geometry = geometry;
    }
  }, [geometry]);

  if (!geometry) return null;

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color="#7EC845"
        metalness={0.1}
        roughness={0.5}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
