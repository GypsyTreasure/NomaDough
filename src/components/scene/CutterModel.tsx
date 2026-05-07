import * as THREE from 'three';
import { useGeometryStore } from '../../store/useGeometryStore';

const MAIN_COLOR = '#7EC845';
const INNER_COLOR = '#FF8C00';
const RIB_COLOR = '#3A8A00';

export function CutterModel() {
  const geometries = useGeometryStore((s) => s.geometries);
  const ribGeometries = useGeometryStore((s) => s.ribGeometries);

  if (geometries.length === 0) return null;

  return (
    <>
      {geometries.map((geo, i) => (
        <mesh key={`cutter-${i}`} geometry={geo} castShadow receiveShadow>
          <meshStandardMaterial
            color={i === 0 ? MAIN_COLOR : INNER_COLOR}
            metalness={0.1}
            roughness={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {ribGeometries.map((geo, i) => (
        <mesh key={`rib-${i}`} geometry={geo} castShadow receiveShadow>
          <meshStandardMaterial
            color={RIB_COLOR}
            metalness={0.05}
            roughness={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </>
  );
}
