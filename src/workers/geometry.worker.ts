/// <reference lib="webworker" />
import * as THREE from 'three'
import { CSG } from 'three-csg-ts'
import type { AppSettings } from '../types'

type Pt = { x: number; y: number }

// ─── Cross-section profile ────────────────────────────────────────────────────
// Orientation (per spec):
//   • Trace path lies in the XZ plane (Y = 0) — this is the "XY surface"
//   • A (cutting edge, narrow) is IN the XZ plane at Y = 0
//   • B (base, wide) is at Y = +C (raised, the stable base for 3D printing)
//   • Bridges are raised from Y = 0 upward
//
// Anchor = center of A so the cutting edge strictly follows the extracted path.
function makeCutterShape(a: number, b: number, c: number): THREE.Shape {
  const shape = new THREE.Shape()
  // Anchor at (0,0) = center of A (cutting edge in XZ plane, Y=0)
  shape.moveTo(-a / 2, 0)        // A left  — cutting edge (Y=0)
  shape.lineTo(a / 2, 0)         // A right — cutting edge (Y=0)
  shape.lineTo(b / 2, c)         // B right — base (Y=+C)
  shape.lineTo(-b / 2, c)        // B left  — base (Y=+C)
  shape.closePath()
  return shape
}

function buildLoopMesh(pts: Pt[], settings: AppSettings): THREE.Mesh | null {
  if (pts.length < 3) return null
  const { a, b, c } = settings.cutterProfile

  // Path in XZ plane — X from image maps to world X, Y from image maps to world Z
  const points = pts.map(p => new THREE.Vector3(p.x, 0, p.y))
  // Close the loop
  const first = points[0], last = points[points.length - 1]
  if (first.distanceTo(last) > 0.01) points.push(first.clone())

  const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5)
  const pathLen = curve.getLength()
  if (pathLen < 1) return null
  const steps = Math.max(64, Math.ceil(pathLen / 0.4))

  const shape = makeCutterShape(a, b, c)
  const geo = new THREE.ExtrudeGeometry(shape, { extrudePath: curve, steps, bevelEnabled: false })
  geo.computeVertexNormals()

  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial())
}

function centroid(mesh: THREE.Mesh): THREE.Vector3 {
  const box = new THREE.Box3().setFromObject(mesh)
  return box.getCenter(new THREE.Vector3())
}

// Prim's MST to connect all meshes with minimum total bridge length
function mst(centroids: THREE.Vector3[]): [number, number][] {
  const n = centroids.length
  if (n <= 1) return []
  const inTree = new Array(n).fill(false)
  const minDist = new Array(n).fill(Infinity)
  const parent = new Array(n).fill(-1)
  inTree[0] = true
  for (let i = 1; i < n; i++) {
    minDist[i] = centroids[0].distanceTo(centroids[i])
    parent[i] = 0
  }
  const edges: [number, number][] = []
  for (let iter = 0; iter < n - 1; iter++) {
    let u = -1
    for (let i = 0; i < n; i++) if (!inTree[i] && (u < 0 || minDist[i] < minDist[u])) u = i
    inTree[u] = true
    edges.push([parent[u], u])
    for (let v = 0; v < n; v++) {
      if (!inTree[v]) {
        const d = centroids[u].distanceTo(centroids[v])
        if (d < minDist[v]) { minDist[v] = d; parent[v] = u }
      }
    }
  }
  return edges
}

// Bridge: box connecting two centroids, base at Y=0, rising to Y=w
function buildBridge(from: THREE.Vector3, to: THREE.Vector3, s: number, w: number): THREE.Mesh {
  // Project onto XZ plane
  const f = new THREE.Vector3(from.x, 0, from.z)
  const t = new THREE.Vector3(to.x, 0, to.z)
  const dir = new THREE.Vector3().subVectors(t, f)
  const len = dir.length()
  if (len < 0.1) return new THREE.Mesh()

  const geo = new THREE.BoxGeometry(len, w, s)
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial())
  // Position: center between from and to, base at Y=0 so center at Y=w/2
  mesh.position.set((f.x + t.x) / 2, w / 2, (f.z + t.z) / 2)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize())
  return mesh
}

function buildGeometry(paths: Pt[][], settings: AppSettings): THREE.BufferGeometry | null {
  const meshes: THREE.Mesh[] = []
  for (const path of paths) {
    const m = buildLoopMesh(path, settings)
    if (m) meshes.push(m)
  }
  if (meshes.length === 0) return null

  if (meshes.length > 1) {
    const centers = meshes.map(centroid)
    const edges = mst(centers)
    const { s, w } = settings.bridgeProfile
    for (const [i, j] of edges) meshes.push(buildBridge(centers[i], centers[j], s, w))
  }

  let result = meshes[0]
  for (let i = 1; i < meshes.length; i++) {
    try {
      result.updateMatrixWorld(true)
      meshes[i].updateMatrixWorld(true)
      result = CSG.union(result, meshes[i])
    } catch { /* skip failing CSG piece */ }
  }

  result.geometry.computeVertexNormals()
  result.geometry.computeBoundingBox()
  return result.geometry
}

self.onmessage = (e: MessageEvent) => {
  const { paths, settings } = e.data as { paths: Pt[][], settings: AppSettings }
  try {
    self.postMessage({ type: 'progress', value: 5 })
    const geo = buildGeometry(paths, settings)
    self.postMessage({ type: 'progress', value: 85 })

    if (!geo) {
      self.postMessage({ type: 'error', message: 'No 3D geometry could be generated from the detected contours.' })
      return
    }

    const pos = geo.attributes.position.array as Float32Array
    const nor = geo.attributes.normal.array as Float32Array
    const packed = new Float32Array(2 + pos.length + nor.length)
    packed[0] = pos.length
    packed[1] = nor.length
    packed.set(pos, 2)
    packed.set(nor, 2 + pos.length)

    self.postMessage({ type: 'progress', value: 100 })
    self.postMessage({ type: 'result', buffer: packed.buffer }, [packed.buffer])
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
