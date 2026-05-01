import { create } from 'zustand'
import type { AppPhase, AppSettings, CVWorkerResult } from '../types'
import type * as THREE from 'three'

const DEFAULT_SETTINGS: AppSettings = {
  sketchHeightMm: 80,
  cutterProfile: { a: 0.2, b: 3.0, c: 12.0 },
  bridgeProfile: { s: 3.0, w: 2.0 },
}

interface AppStore {
  phase: AppPhase
  errorMessage: string | null

  // Image
  imageFile: File | null
  imageUrl: string | null
  fileNameBase: string

  // CV results
  cvProgress: number
  contourPaths: Array<Array<{ x: number; y: number }>>
  rawContourPaths: Array<Array<{ x: number; y: number }>>
  imageWidth: number
  imageHeight: number

  // Geometry
  geoProgress: number
  geometry: THREE.BufferGeometry | null

  // Settings
  settings: AppSettings

  // ── Actions ──
  setPhase: (p: AppPhase) => void
  setError: (msg: string) => void
  setImage: (file: File, url: string, name: string) => void
  setCvProgress: (v: number) => void
  setCVResult: (r: CVWorkerResult) => void
  setGeoProgress: (v: number) => void
  setGeometry: (g: THREE.BufferGeometry) => void
  updateSettings: (p: Partial<AppSettings>) => void
  updateCutter: (p: Partial<AppSettings['cutterProfile']>) => void
  updateBridge: (p: Partial<AppSettings['bridgeProfile']>) => void
  reset: () => void
}

export const useStore = create<AppStore>((set) => ({
  phase: 'idle',
  errorMessage: null,
  imageFile: null,
  imageUrl: null,
  fileNameBase: 'cookie',
  cvProgress: 0,
  contourPaths: [],
  rawContourPaths: [],
  imageWidth: 0,
  imageHeight: 0,
  geoProgress: 0,
  geometry: null,
  settings: DEFAULT_SETTINGS,

  setPhase: (phase) => set({ phase, errorMessage: null }),
  setError: (errorMessage) => set({ phase: 'error', errorMessage }),
  setImage: (imageFile, imageUrl, fileNameBase) =>
    set({ imageFile, imageUrl, fileNameBase, phase: 'cv-loading', cvProgress: 0, contourPaths: [], rawContourPaths: [], geometry: null, errorMessage: null }),
  setCvProgress: (cvProgress) => set({ cvProgress }),
  setCVResult: ({ paths, rawPaths, imageWidth, imageHeight }) =>
    set({ contourPaths: paths, rawContourPaths: rawPaths, imageWidth, imageHeight }),
  setGeoProgress: (geoProgress) => set({ geoProgress }),
  setGeometry: (geometry) => set({ geometry, phase: 'ready' }),
  updateSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
  updateCutter: (p) =>
    set((s) => ({ settings: { ...s.settings, cutterProfile: { ...s.settings.cutterProfile, ...p } } })),
  updateBridge: (p) =>
    set((s) => ({ settings: { ...s.settings, bridgeProfile: { ...s.settings.bridgeProfile, ...p } } })),
  reset: () =>
    set({ phase: 'idle', errorMessage: null, imageFile: null, imageUrl: null, contourPaths: [], rawContourPaths: [], geometry: null, cvProgress: 0, geoProgress: 0 }),
}))
