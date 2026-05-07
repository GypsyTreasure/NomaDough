import { create } from 'zustand';
import { AppSettings, ContourResult, CutterProfile, RibSettings } from '../types';

const defaultSettings: AppSettings = {
  targetHeightMm: 80,
  smoothing: 2,
  shapePerfection: 0.3,
  cutterProfile: { a: 0.2, b: 3.0, c: 12.0 },
  ribSettings: {
    enabled: false,
    spacing: 15,
    angle: 0,
    ribHeight: 3,
    ribWidth: 3.0,
    offsetX: 0,
    offsetY: 0,
  },
  threshold: 'auto',
};

type ProcessingState = 'idle' | 'processing' | 'done' | 'error';

interface AppStore {
  settings: AppSettings;
  updateProfile: (patch: Partial<CutterProfile>) => void;
  updateSettings: (patch: Partial<Omit<AppSettings, 'cutterProfile' | 'ribSettings'>>) => void;
  updateRibSettings: (patch: Partial<RibSettings>) => void;
  imageFile: File | null;
  imageUrl: string | null;
  setImage: (file: File) => void;
  processingState: ProcessingState;
  processingError: string | null;
  contourResult: ContourResult | null;
  setContourResult: (r: ContourResult) => void;
  setProcessingState: (s: ProcessingState, error?: string) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  settings: defaultSettings,
  imageFile: null,
  imageUrl: null,
  processingState: 'idle',
  processingError: null,
  contourResult: null,

  // ribWidth no longer auto-syncs with profile.b — it is independent
  updateProfile: (patch) =>
    set((state) => ({
      settings: {
        ...state.settings,
        cutterProfile: { ...state.settings.cutterProfile, ...patch },
      },
    })),

  updateSettings: (patch) =>
    set((state) => ({
      settings: { ...state.settings, ...patch },
    })),

  updateRibSettings: (patch) =>
    set((state) => ({
      settings: {
        ...state.settings,
        ribSettings: { ...state.settings.ribSettings, ...patch },
      },
    })),

  setImage: (file) => {
    const prev = get().imageUrl;
    if (prev) URL.revokeObjectURL(prev);
    const url = URL.createObjectURL(file);
    set({ imageFile: file, imageUrl: url, contourResult: null, processingState: 'idle', processingError: null });
  },

  setContourResult: (r) => set({ contourResult: r }),

  setProcessingState: (s, error) =>
    set({ processingState: s, processingError: error ?? null }),
}));
