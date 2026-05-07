import type { CVWorkerMessage, CVWorkerResult, CVWorkerError, ContourResult } from '../types';

declare function importScripts(...urls: string[]): void;

const OPENCV_URL = 'https://docs.opencv.org/4.8.0/opencv.js';

let resolveCV!: () => void;
const cvReady = new Promise<void>((resolve) => { resolveCV = resolve; });

(self as any).Module = { onRuntimeInitialized() { resolveCV(); } };

// importScripts works in classic workers (production); in Vite dev mode the
// worker is a module worker where importScripts is unavailable — fall back to
// fetch + indirect eval so the same source works in both environments.
if (typeof importScripts === 'function') {
  importScripts(OPENCV_URL);
} else {
  fetch(OPENCV_URL)
    .then(r => r.text())
    .then(code => { (0, eval)(code); })
    .catch(err => { console.error('Failed to load OpenCV.js:', err); });
}

function chaikin(pts: {x:number;y:number}[], iters: number): {x:number;y:number}[] {
  for (let k = 0; k < iters; k++) {
    const out: typeof pts = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      out.push({ x: 0.75*a.x + 0.25*b.x, y: 0.75*a.y + 0.25*b.y });
      out.push({ x: 0.25*a.x + 0.75*b.x, y: 0.25*a.y + 0.75*b.y });
    }
    pts = out;
  }
  return pts;
}

self.onmessage = async (e: MessageEvent<CVWorkerMessage>) => {
  if (e.data.type !== 'PROCESS_IMAGE') return;
  const { imageData, settings } = e.data;
  const W = imageData.width, H = imageData.height;
  const imageArea = W * H;
  const mats: any[] = [];
  const M = (mat: any) => { mats.push(mat); return mat; };
  const cleanup = () => mats.forEach(m => { try { m.delete(); } catch (_) {} });

  try {
    await cvReady;
    const _cv = (self as any).cv;

    const src    = M(_cv.matFromImageData(imageData));
    const gray   = M(new _cv.Mat());
    _cv.cvtColor(src, gray, _cv.COLOR_RGBA2GRAY);
    const blurred = M(new _cv.Mat());
    _cv.GaussianBlur(gray, blurred, new _cv.Size(5, 5), 0);
    const binary = M(new _cv.Mat());

    if (settings.threshold === 'auto') {
      const shortDim = Math.min(W, H);
      let blockSize = Math.max(11, Math.round(shortDim / 20));
      if (blockSize % 2 === 0) blockSize += 1;
      try {
        _cv.adaptiveThreshold(blurred, binary, 255,
          _cv.ADAPTIVE_THRESH_GAUSSIAN_C,
          _cv.THRESH_BINARY_INV,
          blockSize, 8);
      } catch {
        // Fall back to Otsu if adaptiveThreshold fails
        _cv.threshold(blurred, binary, 0, 255,
          (_cv.THRESH_BINARY_INV | _cv.THRESH_OTSU));
      }
    } else {
      _cv.threshold(blurred, binary, settings.threshold as number, 255,
        _cv.THRESH_BINARY_INV);
    }

    const k3     = M(_cv.getStructuringElement(_cv.MORPH_RECT, new _cv.Size(3, 3)));
    const closed = M(new _cv.Mat());
    _cv.morphologyEx(binary, closed, _cv.MORPH_CLOSE, k3, new _cv.Point(-1, -1), 1);
    const opened = M(new _cv.Mat());
    _cv.morphologyEx(closed, opened, _cv.MORPH_OPEN, k3, new _cv.Point(-1, -1), 1);

    const contours  = M(new _cv.MatVector());
    const hierarchy = M(new _cv.Mat());
    // RETR_LIST=1, CHAIN_APPROX_SIMPLE=2  (use numeric fallbacks for safety)
    _cv.findContours(opened, contours, hierarchy,
      _cv.RETR_LIST   ?? 1,
      _cv.CHAIN_APPROX_SIMPLE ?? 2);

    const minArea = imageArea * 0.0005;
    const diag    = Math.hypot(W, H);

    interface RawLoop {
      pts: Array<{x: number; y: number}>;
      area: number;
      cx: number;
      cy: number;
    }

    const raw: RawLoop[] = [];

    for (let i = 0; i < contours.size(); i++) {
      const c    = contours.get(i);
      const area = _cv.contourArea(c);
      if (area < minArea) continue;

      const rect = _cv.boundingRect(c);
      // Skip frame-edge and near-full-image contours
      if (rect.x <= 2 && rect.y <= 2 &&
          rect.x + rect.width  >= W - 2 &&
          rect.y + rect.height >= H - 2) continue;
      if (rect.width * rect.height > imageArea * 0.92) continue;

      const perimeter = _cv.arcLength(c, true);
      // Roughness: raw pixel contour perimeter vs ideal circular perimeter.
      // >6 = very jagged noise blob; threshold relaxed from 4 because
      // adaptive-threshold contours have more pixel-level staircase than Otsu.
      const roughness = perimeter / (2 * Math.sqrt(Math.PI * area));
      if (roughness > 6.0) continue;

      const epsilon = Math.max(1.5, Math.min(0.005 * perimeter, 8.0));
      const approx  = new _cv.Mat();
      _cv.approxPolyDP(c, approx, epsilon, true);

      const pts: Array<{x: number; y: number}> = [];
      for (let j = 0; j < approx.rows; j++) {
        pts.push({ x: approx.data32S[j * 2], y: approx.data32S[j * 2 + 1] });
      }
      approx.delete();

      if (pts.length < 4) continue;

      const xs = pts.map(p => p.x);
      const ys = pts.map(p => p.y);
      raw.push({
        pts,
        area,
        cx: (Math.min(...xs) + Math.max(...xs)) / 2,
        cy: (Math.min(...ys) + Math.max(...ys)) / 2,
      });
    }

    // Concentric dedup: two edges of the same ink stroke → keep the larger
    const afterConcentric: RawLoop[] = [];
    for (const loop of raw) {
      let absorbed = false;
      for (let k = 0; k < afterConcentric.length; k++) {
        const kept = afterConcentric[k];
        if (Math.hypot(loop.cx - kept.cx, loop.cy - kept.cy) < diag * 0.15) {
          if (loop.area > kept.area) afterConcentric[k] = loop;
          absorbed = true;
          break;
        }
      }
      if (!absorbed) afterConcentric.push(loop);
    }

    // Sort by area descending before proximity check
    afterConcentric.sort((a, b) => b.area - a.area);

    // Proximity dedup: nearly-touching smaller sibling → remove
    function getBbox(pts: Array<{x:number;y:number}>) {
      const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
      return { x1: Math.min(...xs), y1: Math.min(...ys),
               x2: Math.max(...xs), y2: Math.max(...ys) };
    }

    const afterProximity: RawLoop[] = [];
    for (const loop of afterConcentric) {
      const bA = getBbox(loop.pts);
      let redundant = false;
      for (const kept of afterProximity) {
        const bB = getBbox(kept.pts);
        const gap = Math.max(0,
          Math.max(bA.x1, bB.x1) - Math.min(bA.x2, bB.x2),
          Math.max(bA.y1, bB.y1) - Math.min(bA.y2, bB.y2)
        );
        if (gap < 15 && loop.area < kept.area * 0.5) {
          redundant = true;
          break;
        }
      }
      if (!redundant) afterProximity.push(loop);
    }

    if (afterProximity.length === 0) {
      cleanup();
      self.postMessage({
        type: 'ERROR',
        message: 'No shape detected. Ensure a clear outline on a lighter background.',
      } as CVWorkerError);
      return;
    }

    // Select up to expectedLoops (0 = all)
    const take = settings.expectedLoops <= 0
      ? afterProximity.length
      : Math.min(settings.expectedLoops, afterProximity.length);
    const selected = afterProximity.slice(0, take);

    // Scale using primary loop's pixel bounding box
    const primary = selected[0];
    const primYs  = primary.pts.map(p => p.y);
    const primXs  = primary.pts.map(p => p.x);
    const pixH    = Math.max(...primYs) - Math.min(...primYs);

    if (pixH < 1) {
      cleanup();
      self.postMessage({ type: 'ERROR', message: 'Detected shape is too small.' } as CVWorkerError);
      return;
    }

    const scale = settings.targetHeightMm / pixH;
    const cx_px = (Math.min(...primXs) + Math.max(...primXs)) / 2;
    const cy_px = (Math.min(...primYs) + Math.max(...primYs)) / 2;

    const finalLoops = selected.map((loop, idx) => {
      const smoothPx = chaikin(loop.pts, settings.smoothing);
      const mmPts = smoothPx.map(p => ({
        x: (p.x - cx_px) * scale,
        y: (p.y - cy_px) * scale,
      }));
      return {
        points:      mmPts,
        pixelPoints: smoothPx,
        role:        (idx === 0 ? 'outer' : 'inner') as 'outer' | 'inner',
      };
    });

    cleanup();

    const result: ContourResult = {
      loops:         finalLoops,
      points:        finalLoops[0].points,
      pixelPoints:   finalLoops[0].pixelPoints,
      innerContours: finalLoops.slice(1).map(l => ({ points: l.points, pixelPoints: l.pixelPoints })),
      imageWidth:    W,
      imageHeight:   H,
    };

    self.postMessage({ type: 'CONTOUR_RESULT', result } as CVWorkerResult);
  } catch (err: any) {
    console.error('[cv.worker] error:', err);
    cleanup();
    self.postMessage({
      type: 'ERROR',
      message: err?.message ?? String(err),
    } as CVWorkerError);
  }
};
