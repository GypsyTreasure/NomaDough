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

function cornerPreservingSmooth(
  points: Array<{x: number, y: number}>,
  shapePerfection: number
): Array<{x: number, y: number}> {
  if (points.length < 4) return points;

  // sp=0 (organic): high threshold → only sharp spikes preserved, curves smoothed freely
  // sp=1 (geometric): low threshold → even gentle angles treated as corners, fully preserved
  const cornerThresholdDeg = 120 - shapePerfection * 100; // 120° at 0 → 20° at 1.0
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
    const bendAngle = Math.PI - angle(prev, curr, next);
    if (bendAngle > cornerThresholdRad) isCorner[i] = true;
  }

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
  const W = imageData.width, H = imageData.height;
  const imageArea = W * H;
  const mats: any[] = [];
  const M = (mat: any) => { mats.push(mat); return mat; };
  const cleanup = () => mats.forEach(m => { try { m.delete(); } catch (_) {} });

  try {
    await cvReady;
    const _cv = (self as any).cv;

    // ── Step 1: Local-background subtraction → true ink mask ─────────────
    //
    // Global normalize+Otsu fails on photos: it stretches the contrast range
    // including lighting gradients and paper-edge shadows, so the photo border
    // gets detected as "ink".
    //
    // Fix: estimate the local paper colour at every pixel using a large
    // Gaussian blur (the blur radius must be larger than the widest ink stroke
    // but much smaller than the drawn shapes).  Subtracting the actual pixel
    // from this estimate gives a "darkness map" that is positive only where ink
    // is locally darker than the surrounding paper.  Lighting gradients and
    // shadows are uniformly dark relative to their own neighbourhood, so they
    // subtract to ≈ 0 and are never thresholded as ink.
    const src      = M(_cv.matFromImageData(imageData));
    const gray     = M(new _cv.Mat());
    _cv.cvtColor(src, gray, _cv.COLOR_RGBA2GRAY);

    // Tiny blur kills single-pixel sensor noise before background estimation.
    const smoothed = M(new _cv.Mat());
    _cv.GaussianBlur(gray, smoothed, new _cv.Size(3, 3), 0);

    // Background estimate: large Gaussian ≈ local paper colour.
    // The kernel must span > 4× the widest ink stroke so the blur is not pulled
    // down by the dark ink pixels.  Phone photos have strokes 30–60 px wide, so
    // 51 px (fixed) is insufficient — scale with the shorter image dimension.
    // Target: ~7% of the shorter side, min 51, always odd.
    const shortSide  = Math.min(W, H);
    const bgEstRaw   = Math.max(51, Math.round(shortSide * 0.07));
    const bgEstK     = bgEstRaw % 2 === 0 ? bgEstRaw + 1 : bgEstRaw;
    const bgEst = M(new _cv.Mat());
    _cv.GaussianBlur(smoothed, bgEst, new _cv.Size(bgEstK, bgEstK), 0);

    // darkness = bgEst − smoothed  (saturating: negative → 0)
    // Paper:  bgEst ≈ smoothed  → 0
    // Ink:    bgEst > smoothed  → positive
    // Shadow: both are equally dark → still ≈ 0
    const darkness = M(new _cv.Mat());
    _cv.subtract(bgEst, smoothed, darkness);

    // Normalise to [0, 255] so the threshold slider stays on a consistent scale.
    _cv.normalize(darkness, darkness, 0, 255, _cv.NORM_MINMAX);

    const binary = M(new _cv.Mat());
    if (settings.threshold === 'auto') {
      // Otsu finds the paper/ink split in the darkness map automatically.
      _cv.threshold(darkness, binary, 0, 255,
        (_cv.THRESH_BINARY | _cv.THRESH_OTSU));
    } else {
      // Manual: slider value is directly the darkness threshold (0–255).
      _cv.threshold(darkness, binary,
        settings.threshold as number, 255, _cv.THRESH_BINARY);
    }

    // ── Step 2: Morphological cleanup ─────────────────────────────────────
    // Kernel sizes scale with image resolution so pen-lift gaps that are tiny
    // relative to the drawing (~1% of short side) get sealed regardless of
    // whether the image is a small scan or a full-res phone photo.
    // CLOSE seals small gaps; OPEN removes isolated noise dots.
    const closeRaw = Math.max(5, Math.round(shortSide * 0.01));
    const closeK   = closeRaw % 2 === 0 ? closeRaw + 1 : closeRaw;
    const openRaw  = Math.max(3, Math.round(shortSide * 0.003));
    const openK    = openRaw  % 2 === 0 ? openRaw  + 1 : openRaw;
    const k5     = M(_cv.getStructuringElement(_cv.MORPH_RECT, new _cv.Size(closeK, closeK)));
    const k3     = M(_cv.getStructuringElement(_cv.MORPH_RECT, new _cv.Size(openK, openK)));
    const closed = M(new _cv.Mat());
    _cv.morphologyEx(binary, closed, _cv.MORPH_CLOSE, k5, new _cv.Point(-1, -1), 1);
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

      if (pts.length < 3) continue;  // triangles (3 pts) are valid shapes

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
        message: 'No shape detected. Tips: (1) make sure the outline is fully closed — no gaps; (2) use dark ink on a lighter background; (3) try adjusting the threshold slider.',
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

    function applySmoothing(rawPts: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
      let pts = [...rawPts];

      // Stage 1: global Chaikin smoothing
      for (let iter = 0; iter < settings.smoothing; iter++) {
        const out: typeof pts = [];
        const n = pts.length;
        for (let i = 0; i < n; i++) {
          const a = pts[i], b = pts[(i + 1) % n];
          out.push({ x: 0.75*a.x + 0.25*b.x, y: 0.75*a.y + 0.25*b.y });
          out.push({ x: 0.25*a.x + 0.75*b.x, y: 0.25*a.y + 0.75*b.y });
        }
        pts = out;
      }

      // Stage 2: corner-preserving shape perfection
      if (settings.shapePerfection > 0) {
        pts = cornerPreservingSmooth(pts, settings.shapePerfection);
      }

      return pts;
    }

    const finalLoops = selected.map((loop, idx) => {
      const smoothPx = applySmoothing(loop.pts);
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
