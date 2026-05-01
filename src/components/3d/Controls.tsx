import { OrbitControls } from '@react-three/drei'

export function Controls() {
  return (
    <OrbitControls
      makeDefault
      enableDamping dampingFactor={0.07}
      enablePan enableZoom enableRotate
      rotateSpeed={0.7} zoomSpeed={1.2}
      target={[0, 0, 0]}
    />
  )
}
