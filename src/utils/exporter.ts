import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

export function exportSTL(geometry: THREE.BufferGeometry, filename: string): Blob {
  const exporter = new STLExporter();
  const mesh = new THREE.Mesh(geometry);
  const stlData = exporter.parse(mesh, { binary: true });
  // STLExporter with binary:true returns DataView; extract its ArrayBuffer for Blob
  const blobPart = stlData instanceof DataView ? stlData.buffer as ArrayBuffer : stlData as string;
  const blob = new Blob([blobPart], { type: 'application/octet-stream' });

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);

  return blob;
}

export function buildExportFilename(imageFile: File | null): string {
  if (!imageFile) return 'NomaDough-shape-by_NomaDirection.STL';
  const base = imageFile.name.replace(/\.[^.]+$/, '');
  return `NomaDough-${base}-by_NomaDirection.STL`;
}
