import { OrbitControls } from '@react-three/drei'

export function Controls() {
  return (
    <OrbitControls
      makeDefault
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      dampingFactor={0.08}
      enableDamping={true}
      rotateSpeed={0.7}
      zoomSpeed={1.2}
    />
  )
}
