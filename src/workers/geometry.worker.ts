/// <reference lib="webworker" />
import * as THREE from 'three'
import { CSG } from 'three-csg-ts'
import type { AppSettings } from '../types'

interface Point2D { x: number; y: number }

function buildTrapezoidShape(a: number, b: number, c: number): THREE.Shape {
  const shape = new THREE.Shape()
  // Anchor at center of top edge (cutting edge)
  shape.moveTo(-a / 2, 0)
  shape.lineTo(a / 2, 0)
  shape.lineTo(b / 2, -c)
  shape.lineTo(-b / 2, -c)
  shape.closePath()
  return shape
}

function buildMeshFromPath(
  pts: Point2D[],
  settings: AppSettings
): THREE.Mesh | null {
  if (pts.length < 2) return null

  const { a, b, c } = settings.cutterProfile

  // Create 3D curve from 2D path (z=0)
  const vec3s = pts.map((p) => new THREE.Vector3(p.x, p.y, 0))

  // Close the loop if first/last points are close
  const first = vec3s[0]
  const last = vec3s[vec3s.length - 1]
  const dist = first.distanceTo(last)
  if (dist > 0.5) {
    vec3s.push(first.clone())
  }

  const curve = new THREE.CatmullRomCurve3(vec3s, true, 'catmullrom', 0.5)
  const pathLength = curve.getLength()
  const steps = Math.max(50, Math.ceil(pathLength / 0.5))

  const shape = buildTrapezoidShape(a, b, c)

  const geo = new THREE.ExtrudeGeometry(shape, {
    extrudePath: curve,
    steps,
    bevelEnabled: false,
  })
  geo.computeVertexNormals()

  const mat = new THREE.MeshStandardMaterial({ color: 0x00ff88, side: THREE.DoubleSide })
  return new THREE.Mesh(geo, mat)
}

function computeCentroid(mesh: THREE.Mesh): THREE.Vector3 {
  const box = new THREE.Box3().setFromObject(mesh)
  return box.getCenter(new THREE.Vector3())
}

function buildBridge(
  from: THREE.Vector3,
  to: THREE.Vector3,
  s: number,
  w: number
): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(to, from)
  const length = direction.length()

  const geo = new THREE.BoxGeometry(length, w, s)
  const mat = new THREE.MeshStandardMaterial({ color: 0x00ff88 })
  const mesh = new THREE.Mesh(geo, mat)

  const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5)
  mesh.position.copy(mid)

  const axis = new THREE.Vector3(1, 0, 0)
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    axis,
    direction.normalize()
  )
  mesh.quaternion.copy(quaternion)

  return mesh
}

function minimumSpanningTree(centroids: THREE.Vector3[]): [number, number][] {
  const n = centroids.length
  if (n <= 1) return []

  // Prim's MST
  const inTree = new Array(n).fill(false)
  const minDist = new Array(n).fill(Infinity)
  const parent = new Array(n).fill(-1)
  const edges: [number, number][] = []

  inTree[0] = true
  for (let i = 1; i < n; i++) {
    minDist[i] = centroids[0].distanceTo(centroids[i])
    parent[i] = 0
  }

  for (let iter = 0; iter < n - 1; iter++) {
    let u = -1
    for (let i = 0; i < n; i++) {
      if (!inTree[i] && (u === -1 || minDist[i] < minDist[u])) u = i
    }
    inTree[u] = true
    edges.push([parent[u], u])

    for (let v = 0; v < n; v++) {
      if (!inTree[v]) {
        const d = centroids[u].distanceTo(centroids[v])
        if (d < minDist[v]) {
          minDist[v] = d
          parent[v] = u
        }
      }
    }
  }

  return edges
}

function buildGeometry(
  paths: Point2D[][],
  settings: AppSettings
): THREE.BufferGeometry | null {
  const meshes: THREE.Mesh[] = []

  for (const path of paths) {
    const mesh = buildMeshFromPath(path, settings)
    if (mesh) meshes.push(mesh)
  }

  if (meshes.length === 0) return null

  // Add bridges if multiple meshes
  if (meshes.length > 1) {
    const centroids = meshes.map(computeCentroid)
    const edges = minimumSpanningTree(centroids)
    const { s, w } = settings.bridgeProfile

    for (const [i, j] of edges) {
      const bridge = buildBridge(centroids[i], centroids[j], s, w)
      meshes.push(bridge)
    }
  }

  // CSG union all meshes
  let result: THREE.Mesh = meshes[0]

  for (let i = 1; i < meshes.length; i++) {
    try {
      result.updateMatrixWorld(true)
      meshes[i].updateMatrixWorld(true)
      result = CSG.union(result, meshes[i])
    } catch {
      // If CSG fails for this piece, skip it silently
    }
  }

  result.geometry.computeVertexNormals()
  result.geometry.computeBoundingBox()

  return result.geometry
}

self.onmessage = (e: MessageEvent) => {
  const { paths, settings } = e.data as {
    paths: Point2D[][]
    settings: AppSettings
  }

  try {
    self.postMessage({ type: 'progress', value: 10 })

    const geo = buildGeometry(paths, settings)
    self.postMessage({ type: 'progress', value: 80 })

    if (!geo) {
      self.postMessage({ type: 'error', message: 'No geometry generated' })
      return
    }

    // Serialize positions + normals for transfer
    const positions = geo.attributes.position.array as Float32Array
    const normals = geo.attributes.normal.array as Float32Array

    // Pack: [positionCount, positions..., normals...]
    const posCount = positions.length
    const normCount = normals.length
    const packed = new Float32Array(2 + posCount + normCount)
    packed[0] = posCount
    packed[1] = normCount
    packed.set(positions, 2)
    packed.set(normals, 2 + posCount)

    self.postMessage({ type: 'progress', value: 100 })
    self.postMessage({ type: 'result', buffer: packed.buffer }, [packed.buffer])
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
