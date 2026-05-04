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

self.onmessage = async (e: MessageEvent<CVWorkerMessage>) => {
  if (e.data.type !== 'PROCESS_IMAGE') return;
  const { imageData, settings } = e.data;

  try {
    await cvReady;
    const _cv = (self as any).cv;

    const src = _cv.matFromImageData(imageData);
    const gray = new _cv.Mat();
    _cv.cvtColor(src, gray, _cv.COLOR_RGBA2GRAY);

    const blurred = new _cv.Mat();
    _cv.GaussianBlur(gray, blurred, new _cv.Size(5, 5), 0);

    const binary = new _cv.Mat();
    if (settings.threshold === 'auto') {
      _cv.threshold(blurred, binary, 0, 255, _cv.THRESH_BINARY_INV + _cv.THRESH_OTSU);
    } else {
      _cv.threshold(blurred, binary, settings.threshold as number, 255, _cv.THRESH_BINARY_INV);
    }

    const kernel = _cv.getStructuringElement(_cv.MORPH_RECT, new _cv.Size(3, 3));
    const closed = new _cv.Mat();
    _cv.morphologyEx(binary, closed, _cv.MORPH_CLOSE, kernel, new _cv.Point(-1, -1), 2);

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

    const simplified = new _cv.Mat();
    _cv.approxPolyDP(contours.get(largestIdx), simplified, 2.0, true);

    let pixelPoints: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < simplified.rows; i++) {
      pixelPoints.push({
        x: simplified.data32S[i * 2],
        y: simplified.data32S[i * 2 + 1],
      });
    }

    for (let iter = 0; iter < settings.smoothing; iter++) {
      const smoothed: typeof pixelPoints = [];
      const n = pixelPoints.length;
      for (let i = 0; i < n; i++) {
        const p0 = pixelPoints[i];
        const p1 = pixelPoints[(i + 1) % n];
        smoothed.push({ x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y });
        smoothed.push({ x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y });
      }
      pixelPoints = smoothed;
    }

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

    [src, gray, blurred, binary, kernel, closed, simplified, contours, hierarchy].forEach((m) => {
      try { m.delete(); } catch (_) {}
    });

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
