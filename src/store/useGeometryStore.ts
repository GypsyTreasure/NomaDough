import { create } from 'zustand'
import type * as THREE from 'three'

interface GeometryStore {
  isGenerating: boolean
  progress: number
  mesh: THREE.BufferGeometry | null
  exportReady: boolean
  setIsGenerating: (val: boolean) => void
  setProgress: (val: number) => void
  setMesh: (mesh: THREE.BufferGeometry | null) => void
  setExportReady: (val: boolean) => void
  reset: () => void
}

export const useGeometryStore = create<GeometryStore>((set) => ({
  isGenerating: false,
  progress: 0,
  mesh: null,
  exportReady: false,

  setIsGenerating: (val) => set({ isGenerating: val }),
  setProgress: (val) => set({ progress: val }),
  setMesh: (mesh) => set({ mesh }),
  setExportReady: (val) => set({ exportReady: val }),
  reset: () =>
    set({ isGenerating: false, progress: 0, mesh: null, exportReady: false }),
}))
