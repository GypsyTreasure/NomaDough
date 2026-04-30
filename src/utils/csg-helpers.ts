import * as THREE from 'three'

export function deserializeGeometry(buffer: ArrayBuffer): THREE.BufferGeometry {
  const packed = new Float32Array(buffer)
  const posCount = packed[0]
  const normCount = packed[1]

  const positions = packed.slice(2, 2 + posCount)
  const normals = packed.slice(2 + posCount, 2 + posCount + normCount)

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  if (normCount > 0) {
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  }
  geo.computeVertexNormals()
  geo.computeBoundingBox()
  return geo
}
