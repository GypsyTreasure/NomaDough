import * as THREE from 'three';
import { CutterProfile, ContourResult, RibSettings } from '../types';

// ─── Cutter profile & extrusion ─────────────────────────────────────────────

export function buildProfileShape(profile: CutterProfile): THREE.Shape {
  const { a, b, c } = profile;
  const shape = new THREE.Shape();
  shape.moveTo(0,  -b / 2);
  shape.lineTo(0,   b / 2);
  shape.lineTo(-c,  a / 2);
  shape.lineTo(-c, -a / 2);
  shape.closePath();
  return shape;
}

export function buildContourCurve(points: Array<{ x: number; y: number }>): THREE.CurvePath<THREE.Vector3> {
  // Straight LineCurve3 segments so the 3D extrusion follows exactly the same
  // polyline the 2D preview draws.  CatmullRomCurve3 added extra curvature at
  // corners, making the 3D outline differ from the 2D preview.
  const path = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < points.length; i++) {
    const a = new THREE.Vector3(points[i].x, 0, points[i].y);
    const b = new THREE.Vector3(points[(i + 1) % points.length].x, 0, points[(i + 1) % points.length].y);
    path.add(new THREE.LineCurve3(a, b));
  }
  return path;
}

export function generateCutterGeometry(
  contour: ContourResult,
  profile: CutterProfile
): THREE.BufferGeometry {
  const shape = buildProfileShape(profile);
  const curve = buildContourCurve(contour.points);
  const pathLength = curve.getLength();
  // Need at least as many steps as polygon segments so each corner gets its own frame.
  const steps = Math.max(contour.points.length, Math.round(pathLength / 0.5), 100);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    extrudePath: curve,
    steps,
    bevelEnabled: false,
  });

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

// ─── Polygon helpers ─────────────────────────────────────────────────────────

function isPointInPolygon(px: number, py: number, polygon: Array<{ x: number; y: number }>): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Clip an infinite line (origin + unit direction) to the interior of a polygon.
// Returns all inside sub-segments, with each endpoint extended by wallPenetration
// so the rib box physically overlaps the cutter wall.
function clipLineToPolygon(
  ox: number, oy: number,
  dx: number, dy: number,
  polygon: Array<{ x: number; y: number }>,
  wallPenetration: number
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const ts: number[] = [];
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const ex = polygon[i].x - polygon[j].x;
    const ey = polygon[i].y - polygon[j].y;
    const qx = polygon[j].x - ox;
    const qy = polygon[j].y - oy;

    // Solve: ox + t*dx = polygon[j].x + s*ex  →  t*dx - s*ex = qx
    //        oy + t*dy = polygon[j].y + s*ey  →  t*dy - s*ey = qy
    const denom = ex * dy - ey * dx;
    if (Math.abs(denom) < 1e-10) continue; // parallel

    const t = (ex * qy - ey * qx) / denom;
    const s = (dx * qy - dy * qx) / denom;

    if (s >= -1e-6 && s <= 1 + 1e-6) {
      ts.push(t);
    }
  }

  if (ts.length < 2) return [];
  ts.sort((a, b) => a - b);

  const segs: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (let i = 0; i < ts.length - 1; i++) {
    const t1 = ts[i], t2 = ts[i + 1];
    if (t2 - t1 < 0.5) continue; // skip degenerate segments

    const tmid = (t1 + t2) / 2;
    if (isPointInPolygon(ox + tmid * dx, oy + tmid * dy, polygon)) {
      // Extend slightly into the wall so the rib box overlaps with the cutter wall
      segs.push({
        x1: ox + (t1 - wallPenetration) * dx,
        y1: oy + (t1 - wallPenetration) * dy,
        x2: ox + (t2 + wallPenetration) * dx,
        y2: oy + (t2 + wallPenetration) * dy,
      });
    }
  }

  return segs;
}

// ─── Shared rib segment generator (used by solid geo + line preview) ─────────

type Seg = { x1: number; y1: number; x2: number; y2: number };

function buildRibSegments(points: Array<{ x: number; y: number }>, ribs: RibSettings): Seg[] {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const diagLen = Math.hypot(maxX - minX, maxY - minY) * 1.5;

  const angleRad = (ribs.angle * Math.PI) / 180;
  // Grid centre = bbox centre + user offset
  const gridCx = (minX + maxX) / 2 + ribs.offsetX;
  const gridCy = (minY + maxY) / 2 + ribs.offsetY;

  const ribDirX = Math.cos(angleRad), ribDirY = Math.sin(angleRad);
  const perpX   = Math.sin(angleRad), perpY   = -Math.cos(angleRad);

  // wallPenetration = 0: rib endpoints land exactly on the polygon boundary.
  // Any positive value pushes the box outside the wall and causes visible protrusion.
  const wallPenetration = 0;
  const steps = Math.ceil(diagLen / ribs.spacing) + 2;
  const segs: Seg[] = [];

  for (let i = -steps; i <= steps; i++) {
    const lineOx = gridCx + perpX * i * ribs.spacing;
    const lineOy = gridCy + perpY * i * ribs.spacing;
    segs.push(...clipLineToPolygon(lineOx, lineOy, ribDirX, ribDirY, points, wallPenetration));
  }

  return segs;
}

// ─── Solid rib geometry (separate meshes, dark green, baked on Generate) ─────

function generateRibGeometriesForPoints(
  points: Array<{ x: number; y: number }>,
  ribs: RibSettings
): THREE.BufferGeometry[] {
  const { ribHeight, ribWidth } = ribs;
  const segs = buildRibSegments(points, ribs);
  const geos: THREE.BufferGeometry[] = [];

  for (const seg of segs) {
    const segLen = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
    if (segLen < 0.5) continue;

    const geo = new THREE.BoxGeometry(segLen, ribHeight, ribWidth);
    geo.translate(0, ribHeight / 2, 0); // sit on Y = 0 plane
    geo.rotateY(-Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1));
    geo.translate((seg.x1 + seg.x2) / 2, 0, (seg.y1 + seg.y2) / 2);
    geos.push(geo);
  }

  return geos;
}

// ─── Line preview positions (live, no generation needed) ─────────────────────

export function generateRibLinePositions(
  contour: ContourResult,
  ribs: RibSettings
): number[] {
  if (!ribs.enabled || ribs.spacing <= 0) return [];

  const positions: number[] = [];

  // Preview lines only for main contour (same rule as solid geometry)
  for (const seg of buildRibSegments(contour.points, ribs)) {
    positions.push(seg.x1, 0.5, seg.y1, seg.x2, 0.5, seg.y2);
  }

  return positions;
}

// ─── Manual geometry merge (avoids mergeGeometries attribute-compatibility issues) ──

export function manualMergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let vertOffset = 0;

  for (const geo of geos) {
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const normAttr = geo.getAttribute('normal') as THREE.BufferAttribute | undefined;

    for (let i = 0; i < posAttr.count; i++) {
      positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      if (normAttr) {
        normals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
      } else {
        normals.push(0, 1, 0);
      }
    }

    if (geo.index) {
      const idx = geo.index;
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.getX(i) + vertOffset);
      }
    } else {
      for (let i = 0; i < posAttr.count; i++) {
        indices.push(i + vertOffset);
      }
    }

    vertOffset += posAttr.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setIndex(indices);
  merged.computeVertexNormals();
  return merged;
}

// ─── Main entry point ────────────────────────────────────────────────────────

export interface CutterGenerationResult {
  cutterGeometries: THREE.BufferGeometry[];
  ribGeometries: THREE.BufferGeometry[];
}

export function generateAllCutterGeometries(
  contour: ContourResult,
  profile: CutterProfile,
  ribSettings?: RibSettings
): CutterGenerationResult {
  const allContours: ContourResult[] = [
    contour,
    ...contour.innerContours.map(inner => ({
      points: inner.points,
      pixelPoints: inner.pixelPoints,
      innerContours: [],
      imageWidth: contour.imageWidth,
      imageHeight: contour.imageHeight,
    })),
  ];

  const cutterGeometries: THREE.BufferGeometry[] = [];
  const ribGeometries: THREE.BufferGeometry[] = [];

  for (const c of allContours) {
    cutterGeometries.push(generateCutterGeometry(c, profile));
  }

  // Ribs only on the main (outer) contour — clip to its polygon, which naturally
  // spans inner-loop areas so ribs crosscut secondary loops without stopping at them.
  if (ribSettings?.enabled) {
    ribGeometries.push(...generateRibGeometriesForPoints(contour.points, ribSettings));
  }

  return { cutterGeometries, ribGeometries };
}
