import * as THREE from 'three';
import { useGeometryStore } from '../../store/useGeometryStore';

const MAIN_COLOR = '#7EC845';
const INNER_COLOR = '#FF8C00';

export function CutterModel() {
  const geometries = useGeometryStore((s) => s.geometries);

  if (geometries.length === 0) return null;

  return (
    <>
      {geometries.map((geo, i) => (
        <mesh key={i} geometry={geo} castShadow receiveShadow>
          <meshStandardMaterial
            color={i === 0 ? MAIN_COLOR : INNER_COLOR}
            metalness={0.1}
            roughness={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </>
  );
}
