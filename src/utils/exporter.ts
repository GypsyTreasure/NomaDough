import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

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

export function exportSTL(geometry: THREE.BufferGeometry, filename: string): Blob {
  const blob = geometryToBlob(geometry);
  triggerDownload(blob, filename);
  return blob;
}

export function exportAllSTLs(geometries: THREE.BufferGeometry[], imageFile: File | null): Blob {
  if (geometries.length === 0) return new Blob([], { type: 'application/octet-stream' });

  if (geometries.length === 1) {
    return exportSTL(geometries[0], buildExportFilename(imageFile));
  }

  // Multiple geometries — download each sequentially with 300ms delay
  const base = imageFile ? imageFile.name.replace(/\.[^.]+$/, '') : 'shape';
  const blobs: Blob[] = geometries.map(g => geometryToBlob(g));

  blobs.forEach((blob, i) => {
    const filename = `NomaDough-${base}-loop${i + 1}-by_NomaDirection.STL`;
    setTimeout(() => triggerDownload(blob, filename), i * 300);
  });

  // Return the first blob as the representative blob for size display
  return blobs[0];
}

export function buildExportFilename(imageFile: File | null): string {
  if (!imageFile) return 'NomaDough-shape-by_NomaDirection.STL';
  const base = imageFile.name.replace(/\.[^.]+$/, '');
  return `NomaDough-${base}-by_NomaDirection.STL`;
}
