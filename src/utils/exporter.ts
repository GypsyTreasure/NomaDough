import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { manualMergeGeometries } from './geometry';

function geometryToBlob(geometry: THREE.BufferGeometry): Blob {
  const exporter = new STLExporter();
  const mesh = new THREE.Mesh(geometry);
  const stlData = exporter.parse(mesh, { binary: true });
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
    // Single loop → merge cutter + all ribs into one body
    const allGeos = ribGeometries.length > 0
      ? [geometries[0], ...ribGeometries]
      : [geometries[0]];
    const blob = geometryToBlob(manualMergeGeometries(allGeos));
    triggerDownload(blob, buildExportFilename(imageFile));
    return blob;
  }

  // Multiple loops → one file per loop; all ribs go with loop 0
  const base = imageFile ? imageFile.name.replace(/\.[^.]+$/, '') : 'shape';
  const blobs: Blob[] = geometries.map((geo, i) => {
    const loopGeos = i === 0 && ribGeometries.length > 0
      ? [geo, ...ribGeometries]
      : [geo];
    return geometryToBlob(manualMergeGeometries(loopGeos));
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
