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

  // Always merge all cutter loops + all ribs into a single body / single STL file
  const merged = manualMergeGeometries([...geometries, ...ribGeometries]);
  const blob = geometryToBlob(merged);
  triggerDownload(blob, buildExportFilename(imageFile));
  return blob;
}

export function buildExportFilename(imageFile: File | null): string {
  if (!imageFile) return 'NomaDough-shape-by_NomaDirection.STL';
  const base = imageFile.name.replace(/\.[^.]+$/, '');
  return `NomaDough-${base}-by_NomaDirection.STL`;
}
