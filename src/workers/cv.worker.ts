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

  try {
    await cvReady;
    const _cv = (self as any).cv;

    // ── Step 1: Preprocessing ────────────────────────────────────────────────
    const src = _cv.matFromImageData(imageData);
    const gray = new _cv.Mat();
    _cv.cvtColor(src, gray, _cv.COLOR_RGBA2GRAY);

    // CLAHE for local contrast boost — normalises lighting gradients
    const equalized = new _cv.Mat();
    try {
      const clahe = _cv.createCLAHE(2.0, new _cv.Size(8, 8));
      clahe.apply(gray, equalized);
      clahe.delete();
    } catch (_) {
      // Some WASM builds omit createCLAHE — fall back to global equalisation
      _cv.equalizeHist(gray, equalized);
    }

    const blurred = new _cv.Mat();
    _cv.GaussianBlur(equalized, blurred, new _cv.Size(5, 5), 0);

    // ── Helper: threshold → morph close (3×3, 1 iter) → RETR_CCOMP contours ─
    function detectContoursAtThreshold(thresh: number): { contours: any; hierarchy: any } {
      const binary = new _cv.Mat();
      _cv.threshold(blurred, binary, thresh, 255, _cv.THRESH_BINARY_INV);

      // 3×3 kernel, 1 iteration only — prevents merging spiral arms
      const kernel = _cv.getStructuringElement(_cv.MORPH_RECT, new _cv.Size(3, 3));
      const closed = new _cv.Mat();
      _cv.morphologyEx(binary, closed, _cv.MORPH_CLOSE, kernel, new _cv.Point(-1, -1), 1);
      kernel.delete();
      binary.delete();

      const contours = new _cv.MatVector();
      const hierarchy = new _cv.Mat();
      // RETR_CCOMP: two-level hierarchy — level 0 = outer, level 1 = holes
      _cv.findContours(closed, contours, hierarchy, _cv.RETR_CCOMP, _cv.CHAIN_APPROX_TC89_KCOS);
      closed.delete();

      return { contours, hierarchy };
    }

    // ── Score a contour set: prefer large, compact, non-frame contours ───────
    function scoreContours(contours: any, imgW: number, imgH: number): number {
      const imageArea = imgW * imgH;
      let score = 0;
      let validCount = 0;

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = _cv.contourArea(contour);
        if (area < 500) continue;

        const rect = _cv.boundingRect(contour);
        const bboxArea = rect.width * rect.height;
        if (bboxArea > imageArea * 0.85) continue;
        // Skip contours touching all 4 edges (frame artifacts)
        if (rect.x <= 2 && rect.y <= 2 &&
            rect.x + rect.width >= imgW - 2 &&
            rect.y + rect.height >= imgH - 2) continue;

        const perimeter = _cv.arcLength(contour, true);
        const compactness = perimeter > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0;

        score += area * Math.max(compactness, 0.05);
        validCount++;
      }

      return validCount > 0 ? score : 0;
    }

    // ── Step 2: Determine best threshold ─────────────────────────────────────
    let bestThreshold = 128;

    if (settings.threshold === 'auto') {
      // Get Otsu value as starting candidate
      const tempBin = new _cv.Mat();
      const otsuRaw = _cv.threshold(blurred, tempBin, 0, 255, _cv.THRESH_BINARY_INV | _cv.THRESH_OTSU);
      tempBin.delete();
      const otsuVal = (typeof otsuRaw === 'number' && isFinite(otsuRaw)) ? Math.round(otsuRaw) : 128;

      const candidates = [
        otsuVal,
        otsuVal - 20,
        otsuVal - 40,
        otsuVal - 60,
        otsuVal + 10,
        180, 160, 140, 128, 110, 90, 70, 50,
      ].filter(t => t >= 20 && t <= 240)
       .filter((v, i, a) => a.indexOf(v) === i);

      let bestScore = -1;
      for (const thresh of candidates) {
        const { contours, hierarchy } = detectContoursAtThreshold(thresh);
        const s = scoreContours(contours, imageData.width, imageData.height);
        if (s > bestScore) {
          bestScore = s;
          bestThreshold = thresh;
        }
        contours.delete();
        hierarchy.delete();
      }
    } else {
      bestThreshold = settings.threshold as number;
    }

    // ── Step 3: Final detection at best threshold ─────────────────────────────
    const { contours, hierarchy } = detectContoursAtThreshold(bestThreshold);

    // ── Step 4: Collect valid loops via RETR_CCOMP hierarchy ─────────────────
    // hierarchy.data32S layout per contour i: [next, prev, firstChild, parent]
    // parent === -1 → top-level outer contour; parent >= 0 → inner hole
    const imageArea = imageData.width * imageData.height;

    interface ValidLoop {
      pixelPoints: Array<{ x: number; y: number }>;
      area: number;
      role: 'outer' | 'inner';
    }

    const validLoops: ValidLoop[] = [];

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = _cv.contourArea(contour);
      if (area < 300) continue;

      const rect = _cv.boundingRect(contour);
      const bboxArea = rect.width * rect.height;
      if (bboxArea > imageArea * 0.85) continue;
      if (rect.x <= 2 && rect.y <= 2 &&
          rect.x + rect.width >= imageData.width - 2 &&
          rect.y + rect.height >= imageData.height - 2) continue;

      const parent = hierarchy.data32S[i * 4 + 3];
      const role: 'outer' | 'inner' = parent === -1 ? 'outer' : 'inner';

      // approxPolyDP with retry at smaller epsilon for spirals/low-point results
      const simplified = new _cv.Mat();
      _cv.approxPolyDP(contour, simplified, 2.0, true);

      let pts: Array<{ x: number; y: number }> = [];

      if (simplified.rows < 10) {
        simplified.delete();
        const simplified2 = new _cv.Mat();
        _cv.approxPolyDP(contour, simplified2, 1.0, true);
        for (let j = 0; j < simplified2.rows; j++) {
          pts.push({ x: simplified2.data32S[j * 2], y: simplified2.data32S[j * 2 + 1] });
        }
        simplified2.delete();
      } else {
        for (let j = 0; j < simplified.rows; j++) {
          pts.push({ x: simplified.data32S[j * 2], y: simplified.data32S[j * 2 + 1] });
        }
        simplified.delete();
      }

      if (pts.length >= 4) {
        validLoops.push({ pixelPoints: pts, area, role });
      }
    }

    contours.delete();
    hierarchy.delete();

    if (validLoops.length === 0) {
      throw new Error(
        'No shape detected. Ensure the drawing has a clear outline on a light background. ' +
        'Try "Dark lines" mode if the drawing is faint.'
      );
    }

    // Sort: outer contours by area desc first, then inner by area desc
    validLoops.sort((a, b) => {
      if (a.role !== b.role) return a.role === 'outer' ? -1 : 1;
      return b.area - a.area;
    });

    // ── Step 5: Smooth + scale each loop to mm ────────────────────────────────
    const primaryLoop = validLoops.find(l => l.role === 'outer') ?? validLoops[0];
    const primaryPts = primaryLoop.pixelPoints;
    const ys = primaryPts.map(p => p.y);
    const xs = primaryPts.map(p => p.x);
    const pixelHeight = Math.max(...ys) - Math.min(...ys);

    if (pixelHeight < 1) {
      throw new Error('Detected shape is too small. Try adjusting the threshold or photograph in better lighting.');
    }

    const scaleFactor = settings.targetHeightMm / pixelHeight;
    const cx_px = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cy_px = (Math.max(...ys) + Math.min(...ys)) / 2;

    function applySmoothing(rawPts: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
      let pts = [...rawPts];

      // Stage 1: global Chaikin smoothing
      for (let iter = 0; iter < settings.smoothing; iter++) {
        const smoothed: typeof pts = [];
        const n = pts.length;
        for (let i = 0; i < n; i++) {
          const p0 = pts[i];
          const p1 = pts[(i + 1) % n];
          smoothed.push({ x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y });
          smoothed.push({ x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y });
        }
        pts = smoothed;
      }

      // Stage 2: corner-preserving shape perfection
      if (settings.shapePerfection > 0) {
        pts = cornerPreservingSmooth(pts, settings.shapePerfection);
      }

      return pts;
    }

    function scaleToMm(pts: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
      return pts.map(p => ({
        x: (p.x - cx_px) * scaleFactor,
        y: (p.y - cy_px) * scaleFactor,
      }));
    }

    const loops: Array<{ points: any[]; pixelPoints: any[]; role: 'outer' | 'inner' }> =
      validLoops.map(loop => {
        const smoothedPts = applySmoothing(loop.pixelPoints);
        return {
          pixelPoints: smoothedPts,
          points: scaleToMm(smoothedPts),
          role: loop.role,
        };
      });

    // Cleanup all OpenCV mats
    [src, gray, equalized, blurred].forEach(m => { try { m.delete(); } catch (_) {} });

    // Build result — maintain legacy fields for geometry.ts compatibility
    const innerLoops = loops.filter(l => l.role === 'inner');

    const result: ContourResult = {
      loops,
      points: loops[0].points,
      pixelPoints: loops[0].pixelPoints,
      innerContours: innerLoops.map(l => ({
        points: l.points,
        pixelPoints: l.pixelPoints,
      })),
      imageWidth: imageData.width,
      imageHeight: imageData.height,
    };

    self.postMessage({ type: 'CONTOUR_RESULT', result } as CVWorkerResult);
  } catch (err: any) {
    self.postMessage({ type: 'ERROR', message: err.message ?? String(err) } as CVWorkerError);
  }
};
