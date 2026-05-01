// ─── Settings ───────────────────────────────────────────────────────────────

export interface CutterProfile {
  a: number   // Cutting edge width (mm) – default 0.2
  b: number   // Base width (mm) – default 3.0
  c: number   // Wall height (mm) – default 12.0
}

export interface BridgeProfile {
  s: number   // Bridge width (mm) – default 3.0
  w: number   // Bridge height (mm) – default 2.0
}

export interface AppSettings {
  sketchHeightMm: number
  cutterProfile: CutterProfile
  bridgeProfile: BridgeProfile
}

// ─── App state machine ───────────────────────────────────────────────────────

export type AppPhase =
  | 'idle'
  | 'cv-loading'
  | 'preview'
  | 'geo-loading'
  | 'ready'
  | 'error'

// ─── Worker messages ─────────────────────────────────────────────────────────

export interface CVWorkerInput {
  imageData: ImageData
  targetHeightMm: number
}

export interface CVWorkerResult {
  paths: Array<Array<{ x: number; y: number }>>        // mm-scaled
  rawPaths: Array<Array<{ x: number; y: number }>>     // pixel coordinates
  imageWidth: number
  imageHeight: number
}

export type CVWorkerMessage =
  | { type: 'progress'; value: number }
  | { type: 'result' } & CVWorkerResult
  | { type: 'error'; message: string }

export interface GeoWorkerInput {
  paths: Array<Array<{ x: number; y: number }>>
  settings: AppSettings
}

export type GeoWorkerMessage =
  | { type: 'progress'; value: number }
  | { type: 'result'; buffer: ArrayBuffer }
  | { type: 'error'; message: string }
