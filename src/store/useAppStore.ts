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
  },
  detectionMode: 'auto',
  loopThresholds: [128],
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

  updateProfile: (patch) =>
    set((state) => {
      const newProfile = { ...state.settings.cutterProfile, ...patch };
      return {
        settings: {
          ...state.settings,
          cutterProfile: newProfile,
          ribSettings: {
            ...state.settings.ribSettings,
            ribWidth: newProfile.b,
          },
        },
      };
    }),

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
