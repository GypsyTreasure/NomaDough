import * as THREE from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'

export function unpackGeometry(buffer: ArrayBuffer): THREE.BufferGeometry {
  const packed = new Float32Array(buffer)
  const posLen = packed[0]
  const norLen = packed[1]
  const pos = packed.slice(2, 2 + posLen)
  const nor = packed.slice(2 + posLen, 2 + posLen + norLen)

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  if (norLen > 0) geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  geo.computeVertexNormals()
  geo.computeBoundingBox()
  return geo
}

export function exportSTL(geometry: THREE.BufferGeometry, fileNameBase: string) {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial())
  const exporter = new STLExporter()
  const result = exporter.parse(mesh, { binary: true })
  const data = result instanceof DataView ? result.buffer : new TextEncoder().encode(result as string).buffer
  const blob = new Blob([data], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `NomaDough-${fileNameBase}-by_NomaDirection.STL`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
