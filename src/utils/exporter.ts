import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

// Build a scene-graph group from one cutter geometry + its rib geometries so
// STLExporter traverses all children and writes them into a single binary STL.
function buildGroup(cutterGeo: THREE.BufferGeometry, ribGeos: THREE.BufferGeometry[]): THREE.Group {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(cutterGeo));
  for (const rib of ribGeos) {
    group.add(new THREE.Mesh(rib));
  }
  return group;
}

function groupToBlob(group: THREE.Group): Blob {
  const exporter = new STLExporter();
  const stlData = exporter.parse(group, { binary: true });
  const blobPart = stlData instanceof DataView ? stlData.buffer as ArrayBuffer : stlData as string;
  return new Blob([blobPart], { type: 'application/octet-stream' });
}

function triggerDownload(blob: Blob, filename: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export function exportAllSTLs(
  geometries: THREE.BufferGeometry[],
  ribGeometries: THREE.BufferGeometry[],
  imageFile: File | null
): Blob {
  if (geometries.length === 0) return new Blob([], { type: 'application/octet-stream' });

  if (geometries.length === 1) {
    // Single loop — one STL with cutter + all ribs
    const group = buildGroup(geometries[0], ribGeometries);
    const blob = groupToBlob(group);
    triggerDownload(blob, buildExportFilename(imageFile));
    return blob;
  }

  // Multiple loops — one STL per loop; ribs are distributed to the first loop
  // (ribs span the whole bounding box so they logically belong to the main contour)
  const base = imageFile ? imageFile.name.replace(/\.[^.]+$/, '') : 'shape';
  const blobs: Blob[] = geometries.map((geo, i) => {
    const ribs = i === 0 ? ribGeometries : [];
    return groupToBlob(buildGroup(geo, ribs));
  });

  blobs.forEach((blob, i) => {
    const filename = `NomaDough-${base}-loop${i + 1}-by_NomaDirection.STL`;
    setTimeout(() => triggerDownload(blob, filename), i * 300);
  });

  return blobs[0];
}

export function buildExportFilename(imageFile: File | null): string {
  if (!imageFile) return 'NomaDough-shape-by_NomaDirection.STL';
  const base = imageFile.name.replace(/\.[^.]+$/, '');
  return `NomaDough-${base}-by_NomaDirection.STL`;
}
