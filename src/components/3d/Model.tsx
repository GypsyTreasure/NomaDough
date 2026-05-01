import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useStore } from '../../store/useStore'

export function Model() {
  const { geometry } = useStore()
  const ref = useRef<THREE.Group>(null)

  useEffect(() => {
    if (!ref.current || !geometry) return
    geometry.computeBoundingBox()
    const center = new THREE.Vector3()
    geometry.boundingBox!.getCenter(center)
    // Keep the base at Y=0 — only center on X and Z
    ref.current.position.set(-center.x, 0, -center.z)
  }, [geometry])

  if (!geometry) return null

  return (
    <group ref={ref}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color="#00dd66"
          roughness={0.2}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}
