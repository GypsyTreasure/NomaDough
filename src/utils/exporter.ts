import * as THREE from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'

export function exportSTL(geometry: THREE.BufferGeometry, fileNameBase: string): void {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial())
  const exporter = new STLExporter()
  const result = exporter.parse(mesh, { binary: true })
  const arrayBuffer = result instanceof DataView ? result.buffer as ArrayBuffer : new TextEncoder().encode(result as string).buffer as ArrayBuffer

  const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `NomaDough-${fileNameBase}-by_NomaDirection.STL`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
