export interface CutterProfile {
  a: number;  // Cutting edge width (mm) — TOP of cutter, narrow
  b: number;  // Base width (mm) — BOTTOM of cutter, wide
  c: number;  // Wall height (mm)
}

export interface RibSettings {
  enabled: boolean;
  spacing: number;    // mm between ribs, default 15, range 5–50
  angle: number;      // degrees, default 0 (horizontal), range 0–90
  ribHeight: number;  // fixed 3mm — read-only display
  ribWidth: number;   // mirrors profile B — read-only display
}

export interface AppSettings {
  targetHeightMm: number;
  smoothing: number;        // Chaikin iterations 0–10
  shapePerfection: number;  // 0.0 (organic/curved) to 1.0 (geometric/straight), default 0.3
  threshold: number | 'auto';
  cutterProfile: CutterProfile;
  ribSettings: RibSettings;
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
  settings: Pick<AppSettings, 'threshold' | 'smoothing' | 'shapePerfection' | 'targetHeightMm'>;
}

export interface CVWorkerResult {
  type: 'CONTOUR_RESULT';
  result: ContourResult;
}

export interface CVWorkerError {
  type: 'ERROR';
  message: string;
}
