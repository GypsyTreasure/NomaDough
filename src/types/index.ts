export interface CutterProfile {
  a: number;  // Cutting edge width (mm) — TOP of cutter, narrow
  b: number;  // Base width (mm) — BOTTOM of cutter, wide
  c: number;  // Wall height (mm)
}

export interface AppSettings {
  targetHeightMm: number;
  smoothing: number;        // Chaikin iterations 0–10
  shapePerfection: number;  // 0.0 (organic/curved) to 1.0 (geometric/straight)
  cutterProfile: CutterProfile;
  detectionMode: 'auto' | 'manual';
  loopThresholds: number[]; // manual: one per loop; auto: unused
}

export interface ContourResult {
  points: Array<{ x: number; y: number }>;       // Main contour scaled to mm
  pixelPoints: Array<{ x: number; y: number }>;  // Main contour original pixel coords
  innerContours: Array<{                          // Additional loops (same coordinate space)
    points: Array<{ x: number; y: number }>;
    pixelPoints: Array<{ x: number; y: number }>;
  }>;
  imageWidth: number;
  imageHeight: number;
}

export interface CVWorkerMessage {
  type: 'PROCESS_IMAGE';
  imageData: ImageData;
  settings: {
    smoothing: number;
    shapePerfection: number;
    targetHeightMm: number;
    detectionMode: 'auto' | 'manual';
    loopThresholds: number[]; // manual: N values for N loops; auto: ignored
  };
}

export interface CVWorkerResult {
  type: 'CONTOUR_RESULT';
  result: ContourResult;
}

export interface CVWorkerError {
  type: 'ERROR';
  message: string;
}
