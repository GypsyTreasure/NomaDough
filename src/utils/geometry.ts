import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CutterProfile, ContourResult, RibSettings } from '../types';

export function buildProfileShape(profile: CutterProfile): THREE.Shape {
  const { a, b, c } = profile;
  const shape = new THREE.Shape();
  // For a CatmullRomCurve3 in the XZ plane, Three.js Frenet frames give:
  //   normals   = (0, -1, 0)  →  shape local X maps to world -Y
  //   binormals = radial XZ   →  shape local Y maps to wall thickness in XZ
  // So: base at local x=0 → world Y=0; cutting edge at local x=-c → world Y=c.
  shape.moveTo(0,  -b / 2);  // base, world Y=0
  shape.lineTo(0,   b / 2);
  shape.lineTo(-c,  a / 2);  // cutting edge, world Y=c
  shape.lineTo(-c, -a / 2);
  shape.closePath();
  return shape;
}

export function buildContourCurve(points: Array<{ x: number; y: number }>): THREE.CatmullRomCurve3 {
  const vec3Points = points.map((p) => new THREE.Vector3(p.x, 0, p.y));
  return new THREE.CatmullRomCurve3(vec3Points, true, 'catmullrom', 0.5);
}

export function generateCutterGeometry(
  contour: ContourResult,
  profile: CutterProfile
): THREE.BufferGeometry {
  const shape = buildProfileShape(profile);
  const curve = buildContourCurve(contour.points);
  const pathLength = curve.getLength();
  const steps = Math.max(Math.round(pathLength / 0.5), 100);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    extrudePath: curve,
    steps,
    bevelEnabled: false,
  });

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

// ─── Cohen-Sutherland line clipping ────────────────────────────────────────

const CS_INSIDE = 0, CS_LEFT = 1, CS_RIGHT = 2, CS_BOTTOM = 4, CS_TOP = 8;

function computeOutcode(x: number, y: number, minX: number, minY: number, maxX: number, maxY: number): number {
  let code = CS_INSIDE;
  if (x < minX) code |= CS_LEFT;
  else if (x > maxX) code |= CS_RIGHT;
  if (y < minY) code |= CS_BOTTOM;
  else if (y > maxY) code |= CS_TOP;
  return code;
}

function clipLineToBbox(
  x1: number, y1: number, x2: number, y2: number,
  minX: number, minY: number, maxX: number, maxY: number
): { x1: number; y1: number; x2: number; y2: number } | null {
  let outcode1 = computeOutcode(x1, y1, minX, minY, maxX, maxY);
  let outcode2 = computeOutcode(x2, y2, minX, minY, maxX, maxY);

  while (true) {
    if (!(outcode1 | outcode2)) return { x1, y1, x2, y2 };
    if (outcode1 & outcode2) return null;

    const outcodeOut = outcode1 ? outcode1 : outcode2;
    let x = 0, y = 0;

    if (outcodeOut & CS_TOP) {
      x = x1 + (x2 - x1) * (maxY - y1) / (y2 - y1);
      y = maxY;
    } else if (outcodeOut & CS_BOTTOM) {
      x = x1 + (x2 - x1) * (minY - y1) / (y2 - y1);
      y = minY;
    } else if (outcodeOut & CS_RIGHT) {
      y = y1 + (y2 - y1) * (maxX - x1) / (x2 - x1);
      x = maxX;
    } else {
      y = y1 + (y2 - y1) * (minX - x1) / (x2 - x1);
      x = minX;
    }

    if (outcodeOut === outcode1) {
      x1 = x; y1 = y;
      outcode1 = computeOutcode(x1, y1, minX, minY, maxX, maxY);
    } else {
      x2 = x; y2 = y;
      outcode2 = computeOutcode(x2, y2, minX, minY, maxX, maxY);
    }
  }
}

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

// ─── Rib segment generation (shared between solid geometry and line preview) ─

type Seg = { x1: number; y1: number; x2: number; y2: number };

function buildRibSegments(points: Array<{ x: number; y: number }>, ribs: RibSettings): Seg[] {
  const ribW = ribs.ribWidth;
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const diagLen = Math.hypot(maxX - minX, maxY - minY) * 1.5;

  const angleRad = (ribs.angle * Math.PI) / 180;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const perpX = Math.sin(angleRad),  perpY  = -Math.cos(angleRad);
  const ribDirX = Math.cos(angleRad), ribDirY = Math.sin(angleRad);

  const segments: Seg[] = [];
  const steps = Math.ceil(diagLen / ribs.spacing);

  for (let i = -steps; i <= steps; i++) {
    const offsetX = perpX * i * ribs.spacing;
    const offsetY = perpY * i * ribs.spacing;

    const startX = cx + offsetX - ribDirX * diagLen / 2;
    const startY = cy + offsetY - ribDirY * diagLen / 2;
    const endX   = cx + offsetX + ribDirX * diagLen / 2;
    const endY   = cy + offsetY + ribDirY * diagLen / 2;

    const clipped = clipLineToBbox(
      startX, startY, endX, endY,
      minX - ribW, minY - ribW, maxX + ribW, maxY + ribW
    );
    if (!clipped) continue;

    const midX = (clipped.x1 + clipped.x2) / 2;
    const midY = (clipped.y1 + clipped.y2) / 2;
    if (!isPointInPolygon(midX, midY, points)) continue;

    segments.push(clipped);
  }
  return segments;
}

// ─── Solid rib geometry (baked into STL on Generate click) ──────────────────

function generateRibGeometriesForPoints(
  points: Array<{ x: number; y: number }>,
  ribW: number,
  ribs: RibSettings
): THREE.BufferGeometry[] {
  const ribH = 3.0;
  const segments = buildRibSegments(points, ribs);
  const geos: THREE.BufferGeometry[] = [];

  for (const seg of segments) {
    const segLen = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
    if (segLen < 1.0) continue;

    const geo = new THREE.BoxGeometry(segLen, ribH, ribW);
    geo.translate(0, ribH / 2, 0);

    const ribAngle = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1);
    geo.rotateY(-ribAngle);

    geo.translate((seg.x1 + seg.x2) / 2, 0, (seg.y1 + seg.y2) / 2);
    geos.push(geo);
  }
  return geos;
}

// ─── Line positions for live preview in Scene ────────────────────────────────

export function generateRibLinePositions(
  contour: ContourResult,
  ribs: RibSettings
): number[] {
  if (!ribs.enabled || ribs.spacing <= 0) return [];

  const positions: number[] = [];
  const allPointSets = [
    contour.points,
    ...contour.innerContours.map(ic => ic.points),
  ];

  for (const pts of allPointSets) {
    for (const seg of buildRibSegments(pts, ribs)) {
      // contour x → world X, contour y → world Z, Y=0.5 above base plane
      positions.push(seg.x1, 0.5, seg.y1, seg.x2, 0.5, seg.y2);
    }
  }

  return positions;
}

// ─── Main entry points ───────────────────────────────────────────────────────

export function generateAllCutterGeometries(
  contour: ContourResult,
  profile: CutterProfile,
  ribs?: RibSettings
): THREE.BufferGeometry[] {
  const result: THREE.BufferGeometry[] = [];

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

  for (const c of allContours) {
    const mainGeo = generateCutterGeometry(c, profile);

    if (ribs?.enabled) {
      const ribGeos = generateRibGeometriesForPoints(c.points, profile.b, ribs);
      if (ribGeos.length > 0) {
        const merged = mergeGeometries([mainGeo, ...ribGeos]);
        if (merged) {
          merged.computeVertexNormals();
          result.push(merged);
          continue;
        }
      }
    }

    result.push(mainGeo);
  }

  return result;
}
