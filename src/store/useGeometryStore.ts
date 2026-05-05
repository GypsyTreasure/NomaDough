import { create } from 'zustand';
import * as THREE from 'three';

interface GeometryStore {
  geometries: THREE.BufferGeometry[];
  setGeometries: (g: THREE.BufferGeometry[]) => void;
  stlBlob: Blob | null;
  setStlBlob: (b: Blob | null) => void;
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
}

export const useGeometryStore = create<GeometryStore>((set) => ({
  geometries: [],
  stlBlob: null,
  isGenerating: false,

  setGeometries: (g) => set({ geometries: g }),
  setStlBlob: (b) => set({ stlBlob: b }),
  setIsGenerating: (v) => set({ isGenerating: v }),
}));
