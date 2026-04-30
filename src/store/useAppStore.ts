import { create } from 'zustand'
import type { AppSettings, ImageContext } from '../types'

interface AppStore {
  settings: AppSettings
  imageContext: ImageContext
  isProcessingCV: boolean
  cvProgress: number
  updateSettings: (partial: Partial<AppSettings>) => void
  updateCutterProfile: (partial: Partial<AppSettings['cutterProfile']>) => void
  updateBridgeProfile: (partial: Partial<AppSettings['bridgeProfile']>) => void
  setImageContext: (partial: Partial<ImageContext>) => void
  setIsProcessingCV: (val: boolean) => void
  setCvProgress: (val: number) => void
  reset: () => void
}

const defaultSettings: AppSettings = {
  sketchHeightMm: 80,
  cutterProfile: { a: 0.2, b: 3.0, c: 12.0 },
  bridgeProfile: { s: 3.0, w: 2.0 },
}

const defaultImageContext: ImageContext = {
  file: null,
  fileNameBase: 'cookie',
  originalUrl: null,
  processedVectorPaths: [],
}

export const useAppStore = create<AppStore>((set) => ({
  settings: defaultSettings,
  imageContext: defaultImageContext,
  isProcessingCV: false,
  cvProgress: 0,

  updateSettings: (partial) =>
    set((s) => ({ settings: { ...s.settings, ...partial } })),

  updateCutterProfile: (partial) =>
    set((s) => ({
      settings: {
        ...s.settings,
        cutterProfile: { ...s.settings.cutterProfile, ...partial },
      },
    })),

  updateBridgeProfile: (partial) =>
    set((s) => ({
      settings: {
        ...s.settings,
        bridgeProfile: { ...s.settings.bridgeProfile, ...partial },
      },
    })),

  setImageContext: (partial) =>
    set((s) => ({ imageContext: { ...s.imageContext, ...partial } })),

  setIsProcessingCV: (val) => set({ isProcessingCV: val }),
  setCvProgress: (val) => set({ cvProgress: val }),

  reset: () =>
    set({ settings: defaultSettings, imageContext: defaultImageContext }),
}))
