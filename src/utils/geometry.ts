import * as THREE from 'three';
import { CutterProfile, ContourResult } from '../types';

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

export function generateAllCutterGeometries(
  contour: ContourResult,
  profile: CutterProfile
): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];

  // Main contour
  geometries.push(generateCutterGeometry(contour, profile));

  // Inner contours — same profile, same coordinate space
  for (const inner of contour.innerContours) {
    const innerResult: ContourResult = {
      points: inner.points,
      pixelPoints: inner.pixelPoints,
      innerContours: [],
      imageWidth: contour.imageWidth,
      imageHeight: contour.imageHeight,
    };
    geometries.push(generateCutterGeometry(innerResult, profile));
  }

  return geometries;
}
