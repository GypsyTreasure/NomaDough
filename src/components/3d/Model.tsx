import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useGeometryStore } from '../../store/useGeometryStore'

export function Model() {
  const { mesh } = useGeometryStore()
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (!groupRef.current || !mesh) return
    // Center geometry to world origin so OrbitControls targets correctly
    mesh.computeBoundingBox()
    const center = new THREE.Vector3()
    mesh.boundingBox!.getCenter(center)
    groupRef.current.position.set(-center.x, -center.y, -center.z)
  }, [mesh])

  if (!mesh) return null

  return (
    <group ref={groupRef}>
      <mesh geometry={mesh} castShadow receiveShadow>
        <meshStandardMaterial
          color="#00ee77"
          roughness={0.25}
          metalness={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}
