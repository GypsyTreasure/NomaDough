import * as THREE from 'three';
import { CutterProfile, ContourResult } from '../types';

export function buildProfileShape(profile: CutterProfile): THREE.Shape {
  const { a, b, c } = profile;
  const shape = new THREE.Shape();
  shape.moveTo(-b / 2, 0);
  shape.lineTo(b / 2, 0);
  shape.lineTo(a / 2, c);
  shape.lineTo(-a / 2, c);
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
