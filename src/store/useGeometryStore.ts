import { create } from 'zustand';
import * as THREE from 'three';

interface GeometryStore {
  geometry: THREE.BufferGeometry | null;
  setGeometry: (g: THREE.BufferGeometry) => void;
  stlBlob: Blob | null;
  setStlBlob: (b: Blob | null) => void;
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
}

export const useGeometryStore = create<GeometryStore>((set) => ({
  geometry: null,
  stlBlob: null,
  isGenerating: false,

  setGeometry: (g) => set({ geometry: g }),
  setStlBlob: (b) => set({ stlBlob: b }),
  setIsGenerating: (v) => set({ isGenerating: v }),
}));
