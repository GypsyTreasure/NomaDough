export interface CutterProfile {
  a: number; // Top width (mm) - Default: 0.2
  b: number; // Base width (mm) - Default: 3.0
  c: number; // Height (mm) - Default: 12.0
}

export interface BridgeProfile {
  s: number; // Width (mm) - Default: 3.0
  w: number; // Height from base (mm) - Default: 2.0
}

export interface AppSettings {
  sketchHeightMm: number;
  cutterProfile: CutterProfile;
  bridgeProfile: BridgeProfile;
}

export interface ImageContext {
  file: File | null;
  fileNameBase: string;
  originalUrl: string | null;
  processedVectorPaths: Array<Array<{ x: number; y: number }>>;
}

export interface GeometryState {
  isGenerating: boolean;
  progress: number;
  meshData: Float32Array | null;
  exportReady: boolean;
}

export interface CVWorkerPayload {
  imageData: ImageData;
  targetHeightMm: number;
}

export interface GeometryWorkerPayload {
  paths: Array<Array<{ x: number; y: number }>>;
  settings: AppSettings;
}

export type CVWorkerMessage =
  | { type: 'progress'; value: number }
  | { type: 'result'; paths: Array<Array<{ x: number; y: number }>> }
  | { type: 'error'; message: string };

export type GeometryWorkerMessage =
  | { type: 'progress'; value: number }
  | { type: 'result'; buffer: ArrayBuffer }
  | { type: 'error'; message: string };
