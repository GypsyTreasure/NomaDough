import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGeometryStore } from '../../store/useGeometryStore'

export function Model() {
  const { mesh } = useGeometryStore()
  const groupRef = useRef<THREE.Group>(null)

  // Slow auto-rotate when model is loaded
  useFrame((_, delta) => {
    if (groupRef.current && mesh) {
      groupRef.current.rotation.z += delta * 0.05
    }
  })

  useEffect(() => {
    if (groupRef.current && mesh) {
      // Center the model
      const box = new THREE.Box3().setFromBufferAttribute(
        mesh.attributes.position as THREE.BufferAttribute
      )
      const center = new THREE.Vector3()
      box.getCenter(center)
      groupRef.current.position.set(-center.x, -center.y, -center.z)
    }
  }, [mesh])

  if (!mesh) return null

  return (
    <group ref={groupRef}>
      <mesh geometry={mesh}>
        <meshStandardMaterial
          color="#00ff88"
          roughness={0.3}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Wireframe overlay */}
      <mesh geometry={mesh}>
        <meshBasicMaterial
          color="#00ff00"
          wireframe={true}
          opacity={0.05}
          transparent={true}
        />
      </mesh>
    </group>
  )
}
