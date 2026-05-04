import { OrbitControls } from '@react-three/drei';

export function SceneControls() {
  return (
    <OrbitControls
      makeDefault
      enableDamping
      dampingFactor={0.05}
      minDistance={20}
      maxDistance={500}
    />
  );
}
