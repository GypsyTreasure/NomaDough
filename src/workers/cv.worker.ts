import type { CVWorkerMessage, CVWorkerResult, CVWorkerError, ContourResult } from '../types';

declare function importScripts(...urls: string[]): void;
declare const cv: any;

// Module.onRuntimeInitialized MUST be set before importScripts so OpenCV
// can call it when the WASM finishes loading.
let resolveCV!: () => void;
const cvReady = new Promise<void>((resolve) => { resolveCV = resolve; });

(self as any).Module = {
  onRuntimeInitialized() { resolveCV(); },
};

importScripts('https://docs.opencv.org/4.8.0/opencv.js');

function cornerPreservingSmooth(
  points: Array<{x: number, y: number}>,
  shapePerfection: number
): Array<{x: number, y: number}> {
  if (points.length < 4) return points;

  const cornerThresholdDeg = 30 - shapePerfection * 20;
  const cornerThresholdRad = (cornerThresholdDeg * Math.PI) / 180;

  function angle(p0: {x:number,y:number}, p1: {x:number,y:number}, p2: {x:number,y:number}): number {
    const ax = p0.x - p1.x, ay = p0.y - p1.y;
    const bx = p2.x - p1.x, by = p2.y - p1.y;
    const dot = ax*bx + ay*by;
    const magA = Math.hypot(ax, ay), magB = Math.hypot(bx, by);
    if (magA === 0 || magB === 0) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot / (magA * magB))));
  }

  const n = points.length;
  const isCorner = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];
    const a = angle(prev, curr, next);
    if (Math.PI - a < cornerThresholdRad) isCorner[i] = true;
  }

  // Apply Chaikin only on non-corner segments (2 iterations fixed)
  let pts = [...points];
  for (let iter = 0; iter < 2; iter++) {
    const newPts: typeof pts = [];
    const n2 = pts.length;
    for (let i = 0; i < n2; i++) {
      const j = (i + 1) % n2;
      if (isCorner[i % isCorner.length] || isCorner[j % isCorner.length]) {
        newPts.push(pts[i]);
      } else {
        newPts.push({ x: 0.75*pts[i].x + 0.25*pts[j].x, y: 0.75*pts[i].y + 0.25*pts[j].y });
        newPts.push({ x: 0.25*pts[i].x + 0.75*pts[j].x, y: 0.25*pts[i].y + 0.75*pts[j].y });
      }
    }
    pts = newPts;
  }

  // At high shapePerfection, snap near-90° corners to exact 90°
  if (shapePerfection > 0.5) {
    const snapStrength = (shapePerfection - 0.5) * 2;
    pts = pts.map((p, i) => {
      if (!isCorner[i % isCorner.length]) return p;
      const prev = pts[(i - 1 + pts.length) % pts.length];
      const next = pts[(i + 1) % pts.length];
      const ax = p.x - prev.x, ay = p.y - prev.y;
      const bx = next.x - p.x, by = next.y - p.y;
      const angleDeg = Math.abs(Math.atan2(ay, ax) - Math.atan2(by, bx)) * 180 / Math.PI;
      if (Math.abs(angleDeg - 90) < 20 || Math.abs(angleDeg - 270) < 20) {
        const len = Math.hypot(ax, ay);
        const snappedX = prev.x + Math.round(ax / len) * len;
        const snappedY = prev.y + Math.round(ay / len) * len;
        return {
          x: p.x + (snappedX - p.x) * snapStrength,
          y: p.y + (snappedY - p.y) * snapStrength,
        };
      }
      return p;
    });
  }

  return pts;
}

self.onmessage = async (e: MessageEvent<CVWorkerMessage>) => {
  if (e.data.type !== 'PROCESS_IMAGE') return;
  const { imageData, settings } = e.data;

  try {
    await cvReady;
    const _cv = (self as any).cv;

    const src = _cv.matFromImageData(imageData);
    const gray = new _cv.Mat();
    _cv.cvtColor(src, gray, _cv.COLOR_RGBA2GRAY);

    // Normalize contrast to full 0-255 range (fixes low-contrast pencil drawings)
    _cv.normalize(gray, gray, 0, 255, _cv.NORM_MINMAX);

    // CLAHE to boost local contrast in low-contrast regions (clipLimit=3.0, tileGridSize=8x8)
    const clahe = new _cv.CLAHE(3.0, new _cv.Size(8, 8));
    const enhanced = new _cv.Mat();
    clahe.apply(gray, enhanced);

    const blurred = new _cv.Mat();
    _cv.GaussianBlur(enhanced, blurred, new _cv.Size(7, 7), 0);

    const binary = new _cv.Mat();
    if (settings.threshold === 'auto') {
      _cv.threshold(blurred, binary, 0, 255, _cv.THRESH_BINARY_INV + _cv.THRESH_OTSU);
    } else {
      _cv.threshold(blurred, binary, settings.threshold as number, 255, _cv.THRESH_BINARY_INV);
    }

    const kernel = _cv.getStructuringElement(_cv.MORPH_RECT, new _cv.Size(5, 5));
    const closed = new _cv.Mat();
    _cv.morphologyEx(binary, closed, _cv.MORPH_CLOSE, kernel, new _cv.Point(-1, -1), 3);

    const contours = new _cv.MatVector();
    const hierarchy = new _cv.Mat();
    _cv.findContours(closed, contours, hierarchy, _cv.RETR_EXTERNAL, _cv.CHAIN_APPROX_TC89_KCOS);

    let largestIdx = -1;
    let largestArea = 0;
    for (let i = 0; i < contours.size(); i++) {
      const area = _cv.contourArea(contours.get(i));
      if (area > largestArea) { largestArea = area; largestIdx = i; }
    }

    if (largestIdx === -1 || largestArea < 500) {
      throw new Error('No shape detected. Ensure the drawing has a clear closed outline on a light background.');
    }

    const contourRect = _cv.boundingRect(contours.get(largestIdx));
    const imageArea = imageData.width * imageData.height;
    const bboxArea = contourRect.width * contourRect.height;
    if (bboxArea > imageArea * 0.85) {
      throw new Error('Threshold too low — the entire image border was detected. Try increasing the threshold.');
    }

    const epsilon = 2.0 + settings.shapePerfection * 8.0;
    const simplified = new _cv.Mat();
    _cv.approxPolyDP(contours.get(largestIdx), simplified, epsilon, true);

    let pixelPoints: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < simplified.rows; i++) {
      pixelPoints.push({
        x: simplified.data32S[i * 2],
        y: simplified.data32S[i * 2 + 1],
      });
    }

    pixelPoints = cornerPreservingSmooth(pixelPoints, settings.shapePerfection);

    const ys = pixelPoints.map((p) => p.y);
    const xs = pixelPoints.map((p) => p.x);
    const pixelHeight = Math.max(...ys) - Math.min(...ys);

    if (pixelHeight < 1) {
      throw new Error('Detected shape is too small. Try adjusting the threshold or photograph in better lighting.');
    }

    const scaleFactor = settings.targetHeightMm / pixelHeight;
    const cx_px = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cy_px = (Math.max(...ys) + Math.min(...ys)) / 2;

    const mmPoints = pixelPoints.map((p) => ({
      x: (p.x - cx_px) * scaleFactor,
      y: (p.y - cy_px) * scaleFactor,
    }));

    [src, gray, enhanced, blurred, binary, kernel, closed, simplified, contours, hierarchy].forEach((m) => {
      try { m.delete(); } catch (_) {}
    });
    try { clahe.delete(); } catch (_) {}

    const result: ContourResult = {
      points: mmPoints,
      pixelPoints,
      imageWidth: imageData.width,
      imageHeight: imageData.height,
    };

    self.postMessage({ type: 'CONTOUR_RESULT', result } as CVWorkerResult);
  } catch (err: any) {
    self.postMessage({ type: 'ERROR', message: err.message ?? String(err) } as CVWorkerError);
  }
};
