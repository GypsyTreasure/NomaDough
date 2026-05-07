import type { CVWorkerMessage, CVWorkerResult, CVWorkerError, ContourResult } from '../types';

declare function importScripts(...urls: string[]): void;

const OPENCV_URL = 'https://docs.opencv.org/4.8.0/opencv.js';

let resolveCV!: () => void;
const cvReady = new Promise<void>((resolve) => { resolveCV = resolve; });

(self as any).Module = { onRuntimeInitialized() { resolveCV(); } };

// importScripts works in classic workers (production build).
// Vite dev mode creates module workers where importScripts is unavailable —
// fall back to fetch + indirect eval so both environments work.
if (typeof importScripts === 'function') {
  importScripts(OPENCV_URL);
} else {
  fetch(OPENCV_URL)
    .then(r => r.text())
    .then(code => { (0, eval)(code); })
    .catch(err => { console.error('[cv.worker] Failed to load OpenCV.js:', err); });
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

    // ── Step 1: Convert to true black-and-white ───────────────────────────
    // Normalize contrast first so faint ink and dark ink are both driven to
    // black, then apply a single global threshold to get a clean 2-colour
    // image with no intermediate shades.

    const src   = M(_cv.matFromImageData(imageData));
    const gray  = M(new _cv.Mat());
    _cv.cvtColor(src, gray, _cv.COLOR_RGBA2GRAY);

    // Stretch the pixel range to [0, 255] so that the darkest pixels
    // (ink) become 0 and the lightest (paper) become 255.  This makes
    // faint loops visible to a single global threshold.
    _cv.normalize(gray, gray, 0, 255, _cv.NORM_MINMAX);

    // Light blur to kill single-pixel noise without softening ink edges.
    const blurred = M(new _cv.Mat());
    _cv.GaussianBlur(gray, blurred, new _cv.Size(3, 3), 0);

    // Binarise: anything darker than the threshold becomes white (ink),
    // everything else black (background) — THRESH_BINARY_INV.
    // Auto mode uses Otsu which finds the paper/ink valley automatically.
    // Manual mode uses the user-supplied value on the normalised image.
    const binary = M(new _cv.Mat());
    if (settings.threshold === 'auto') {
      _cv.threshold(blurred, binary, 0, 255,
        (_cv.THRESH_BINARY_INV | _cv.THRESH_OTSU));
    } else {
      _cv.threshold(blurred, binary,
        settings.threshold as number, 255,
        _cv.THRESH_BINARY_INV);
    }

    // ── Step 2: Morphological cleanup ─────────────────────────────────────
    // CLOSE seals small pen-lift gaps; OPEN removes isolated noise dots.
    const k3     = M(_cv.getStructuringElement(_cv.MORPH_RECT, new _cv.Size(3, 3)));
    const closed = M(new _cv.Mat());
    _cv.morphologyEx(binary, closed, _cv.MORPH_CLOSE, k3, new _cv.Point(-1, -1), 1);
    const opened = M(new _cv.Mat());
    _cv.morphologyEx(closed, opened, _cv.MORPH_OPEN, k3, new _cv.Point(-1, -1), 1);

    // ── Step 3: Find all closed contours ─────────────────────────────────
    // RETR_LIST returns every independent closed loop without hierarchy, so
    // all shapes (outer and inner) are treated equally.
    const contours  = M(new _cv.MatVector());
    const hierarchy = M(new _cv.Mat());
    _cv.findContours(opened, contours, hierarchy,
      _cv.RETR_LIST    ?? 1,
      _cv.CHAIN_APPROX_SIMPLE ?? 2);

    // ── Step 4: Filter and simplify each candidate loop ──────────────────
    const minArea = imageArea * 0.0005;
    const diag    = Math.hypot(W, H);

    interface RawLoop {
      pts:  Array<{x: number; y: number}>;
      area: number;
      cx:   number;
      cy:   number;
    }

    const raw: RawLoop[] = [];

    for (let i = 0; i < contours.size(); i++) {
      const c    = contours.get(i);
      const area = _cv.contourArea(c);
      if (area < minArea) continue;

      const rect = _cv.boundingRect(c);
      // Reject contours that span the entire image (photo border artefact).
      if (rect.x <= 2 && rect.y <= 2 &&
          rect.x + rect.width  >= W - 2 &&
          rect.y + rect.height >= H - 2) continue;
      if (rect.width * rect.height > imageArea * 0.92) continue;

      const perimeter = _cv.arcLength(c, true);
      // Roughness: ratio of actual perimeter to ideal circular perimeter.
      // Values > 6 indicate very jagged noise rather than a drawn shape.
      const roughness = perimeter / (2 * Math.sqrt(Math.PI * area));
      if (roughness > 6.0) continue;

      // Adaptive epsilon keeps large contours detailed and small ones smooth.
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

    // ── Step 5: Deduplication ─────────────────────────────────────────────
    // Concentric dedup: adaptive-threshold creates inner + outer edge of
    // each ink stroke as two concentric contours.  Keep the larger one.
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

    afterConcentric.sort((a, b) => b.area - a.area);

    // Proximity dedup: smaller loop whose bounding box nearly coincides with
    // a larger one and is less than half its area → remove.
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
        message: 'No shape detected. Try adjusting the threshold slider or ensure the drawing has a clear outline.',
      } as CVWorkerError);
      return;
    }

    // ── Step 6: Select up to expectedLoops results ────────────────────────
    const take = settings.expectedLoops <= 0
      ? afterProximity.length
      : Math.min(settings.expectedLoops, afterProximity.length);
    const selected = afterProximity.slice(0, take);

    // ── Step 7: Scale to mm and smooth ────────────────────────────────────
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
