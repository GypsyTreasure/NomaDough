import type { CVWorkerMessage, CVWorkerResult, CVWorkerError, ContourResult } from '../types';

declare function importScripts(...urls: string[]): void;

const OPENCV_URL = 'https://docs.opencv.org/4.8.0/opencv.js';

let resolveCV!: () => void;
const cvReady = new Promise<void>((resolve) => { resolveCV = resolve; });
(self as any).Module = { onRuntimeInitialized() { resolveCV(); } };

// Classic workers (production build) use importScripts.
// Vite dev mode creates module workers where importScripts is unavailable
// — fall back to fetch + indirect eval.
if (typeof importScripts === 'function') {
  importScripts(OPENCV_URL);
} else {
  fetch(OPENCV_URL)
    .then(r => r.text())
    .then(code => { (0, eval)(code); })
    .catch(err => console.error('[cv.worker] OpenCV load failed:', err));
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

    // ── Step 1: True black-and-white conversion ───────────────────────────
    //
    // normalize() stretches the pixel range to [0, 255] so that the darkest
    // pixels in the image (ink, regardless of colour or darkness) map to 0
    // and paper maps to 255.  A single global Otsu threshold then reliably
    // separates all ink from all paper in one shot.
    const src    = M(_cv.matFromImageData(imageData));
    const gray   = M(new _cv.Mat());
    _cv.cvtColor(src, gray, _cv.COLOR_RGBA2GRAY);
    _cv.normalize(gray, gray, 0, 255, _cv.NORM_MINMAX);

    const blurred = M(new _cv.Mat());
    _cv.GaussianBlur(gray, blurred, new _cv.Size(3, 3), 0);

    const binary = M(new _cv.Mat());
    if (settings.threshold === 'auto') {
      _cv.threshold(blurred, binary, 0, 255,
        (_cv.THRESH_BINARY_INV | _cv.THRESH_OTSU));
    } else {
      _cv.threshold(blurred, binary,
        settings.threshold as number, 255, _cv.THRESH_BINARY_INV);
    }

    // ── Step 2: Morphological cleanup ─────────────────────────────────────
    const k3     = M(_cv.getStructuringElement(_cv.MORPH_RECT, new _cv.Size(3, 3)));
    const closed = M(new _cv.Mat());
    _cv.morphologyEx(binary, closed, _cv.MORPH_CLOSE, k3, new _cv.Point(-1, -1), 1);
    const opened = M(new _cv.Mat());
    _cv.morphologyEx(closed, opened, _cv.MORPH_OPEN,  k3, new _cv.Point(-1, -1), 1);

    // ── Step 3: Find contours with 2-level hierarchy (RETR_CCOMP) ────────
    //
    // RETR_CCOMP puts the outer boundary of every ink stroke at level 0
    // (parent == -1) and the inner-edge duplicate at level 1 (parent != -1).
    // A shape that sits inside a hole (avocado pit inside body, A's inner
    // triangle) is placed back at level 0 per the CCOMP spec.
    // Filtering by parent == -1 therefore gives us exactly one contour per
    // drawn element — no manual deduplication needed.
    const contours  = M(new _cv.MatVector());
    const hierarchy = M(new _cv.Mat());
    _cv.findContours(opened, contours, hierarchy,
      _cv.RETR_CCOMP     ?? 2,
      _cv.CHAIN_APPROX_SIMPLE ?? 2);

    const minArea = imageArea * 0.0005;

    interface RawLoop {
      pts:  Array<{x: number; y: number}>;
      area: number;
      cx:   number;
      cy:   number;
    }

    const raw: RawLoop[] = [];

    for (let i = 0; i < contours.size(); i++) {
      // hierarchy layout per contour: [next, prev, first_child, parent]
      const parent = hierarchy.data32S[i * 4 + 3];
      if (parent !== -1) continue;   // skip inner stroke-edge duplicates

      const c    = contours.get(i);
      const area = _cv.contourArea(c);
      if (area < minArea) continue;

      const rect = _cv.boundingRect(c);
      if (rect.x <= 2 && rect.y <= 2 &&
          rect.x + rect.width  >= W - 2 &&
          rect.y + rect.height >= H - 2) continue;
      if (rect.width * rect.height > imageArea * 0.92) continue;

      const perimeter = _cv.arcLength(c, true);
      // Roughness > 6 → too jagged to be a drawn shape (noise blob).
      if (perimeter / (2 * Math.sqrt(Math.PI * area)) > 6.0) continue;

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

    if (raw.length === 0) {
      cleanup();
      self.postMessage({
        type: 'ERROR',
        message: 'No shape detected. Ensure the drawing has a clear outline on a lighter background, or adjust the threshold slider.',
      } as CVWorkerError);
      return;
    }

    // ── Step 4: Select up to expectedLoops (largest first) ───────────────
    raw.sort((a, b) => b.area - a.area);

    const take = settings.expectedLoops <= 0
      ? raw.length
      : Math.min(settings.expectedLoops, raw.length);
    const selected = raw.slice(0, take);

    // ── Step 5: Scale to mm and smooth ────────────────────────────────────
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
      innerContours: finalLoops.slice(1).map(l => ({
        points:      l.points,
        pixelPoints: l.pixelPoints,
      })),
      imageWidth:  W,
      imageHeight: H,
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
