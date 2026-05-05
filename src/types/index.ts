export interface CutterProfile {
  a: number;  // Cutting edge width (mm) — TOP of cutter, narrow
  b: number;  // Base width (mm) — BOTTOM of cutter, wide
  c: number;  // Wall height (mm)
}

export interface AppSettings {
  targetHeightMm: number;
  shapePerfection: number;  // 0.0 (organic/curved) to 1.0 (geometric/straight), default 0.3
  threshold: number | 'auto';
  cutterProfile: CutterProfile;
}

export interface ContourResult {
  points: Array<{ x: number; y: number }>;       // Scaled to mm
  pixelPoints: Array<{ x: number; y: number }>;  // Original pixel coords
  imageWidth: number;
  imageHeight: number;
}

export interface CVWorkerMessage {
  type: 'PROCESS_IMAGE';
  imageData: ImageData;
  settings: Pick<AppSettings, 'threshold' | 'shapePerfection' | 'targetHeightMm'>;
}

export interface CVWorkerResult {
  type: 'CONTOUR_RESULT';
  result: ContourResult;
}

export interface CVWorkerError {
  type: 'ERROR';
  message: string;
}
