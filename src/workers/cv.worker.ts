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
    // bendAngle: 0 = straight line, π/2 = 90° turn, π = U-turn
    const bendAngle = Math.PI - angle(prev, curr, next);
    if (bendAngle > cornerThresholdRad) isCorner[i] = true;
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
      // Otsu's method finds the optimal global threshold by maximising inter-class variance
      // between the two histogram peaks (paper vs. ink). It works reliably for uniform-
      // background images (grey, white, cream paper + pencil/pen). Adaptive threshold was
      // tried previously but its large block size (≥11px) is dominated by paper pixels when
      // lines are thin, causing marks to fall below the local threshold.
      _cv.threshold(blurred, binary, 0, 255, _cv.THRESH_BINARY_INV | _cv.THRESH_OTSU);
    } else {
      _cv.threshold(blurred, binary, settings.threshold as number, 255, _cv.THRESH_BINARY_INV);
    }

    // ── Rule 1: adaptive gap-filling ─────────────────────────────────────────
    // Estimate average pen radius via distance transform of the ink mask.
    // distanceTransform gives each ink pixel its distance to the nearest paper pixel,
    // so the mean over ink pixels = average pen radius.
    // We correct for the large number of background (paper) zeros in the overall mean:
    //   mean_ink = mean_all × total_pixels / ink_pixels
    const dist = new _cv.Mat();
    _cv.distanceTransform(binary, dist, _cv.DIST_L2, 5);
    const fgCount = _cv.countNonZero(binary);
    const totalPx = binary.rows * binary.cols;
    const rawMeanDist: number = _cv.mean(dist)[0];
    const penRadius = fgCount > 100 ? (rawMeanDist * totalPx / fgCount) : 2.0;
    const penThickness = Math.max(2.0, penRadius * 2.0);
    dist.delete();

    // Close gaps up to 10× pen thickness, capped at 25px.
    // A 25px kernel closes realistic pencil gaps (5–20px) in ~1s on a 1500×2000px image.
    // Larger values cause multi-second hangs (O(k² × pixels)) and merge nearby separate
    // shapes — the inner circle / triangle would be bridged into the outer outline.
    let closeKernelSize = Math.round(penThickness * 10);
    if (closeKernelSize % 2 === 0) closeKernelSize += 1;
    closeKernelSize = Math.max(5, Math.min(closeKernelSize, 25));

    const kernel = _cv.getStructuringElement(
      _cv.MORPH_ELLIPSE,
      new _cv.Size(closeKernelSize, closeKernelSize)
    );
    const closed = new _cv.Mat();
    _cv.morphologyEx(binary, closed, _cv.MORPH_CLOSE, kernel, new _cv.Point(-1, -1), 1);
    kernel.delete();

    const contours = new _cv.MatVector();
    const hierarchy = new _cv.Mat();
    _cv.findContours(closed, contours, hierarchy, _cv.RETR_EXTERNAL, _cv.CHAIN_APPROX_TC89_KCOS);

    // Collect all contours with area >= 500px²
    const validContours: Array<{ idx: number; area: number }> = [];
    for (let i = 0; i < contours.size(); i++) {
      const area = _cv.contourArea(contours.get(i));
      if (area >= 500) validContours.push({ idx: i, area });
    }

    if (validContours.length === 0) {
      throw new Error('No shape detected. Ensure the drawing has a clear closed outline on a light background.');
    }

    // Sort by area descending — largest first
    validContours.sort((a, b) => b.area - a.area);

    // Check main contour is not border-filling
    const mainRect = _cv.boundingRect(contours.get(validContours[0].idx));
    const imageArea = imageData.width * imageData.height;
    if (mainRect.width * mainRect.height > imageArea * 0.85) {
      throw new Error('Threshold too low — the entire image border was detected. Try increasing the threshold.');
    }

    // ── Rule 2: color-similarity filter ──────────────────────────────────────
    // All loops drawn by the same pen/pencil have very similar grayscale values.
    // Sample mean intensity along each contour in the normalized gray image and
    // reject any contour whose average ink colour differs by more than 40 levels
    // from the main (largest-area) contour. This removes noise from paper texture,
    // shadows, or other incidental marks detected at the threshold edge.
    function sampleIntensity(contourIdx: number): number {
      const mat = contours.get(contourIdx);
      const n = mat.rows;
      const step = Math.max(1, Math.floor(n / 80));
      let sum = 0, cnt = 0;
      for (let i = 0; i < n; i += step) {
        const px = mat.data32S[i * 2];
        const py = mat.data32S[i * 2 + 1];
        if (px >= 0 && px < gray.cols && py >= 0 && py < gray.rows) {
          sum += gray.data[py * gray.cols + px];
          cnt++;
        }
      }
      return cnt > 0 ? sum / cnt : 128;
    }

    const mainIntensity = sampleIntensity(validContours[0].idx);
    const colorFiltered = validContours.filter((c, i) => {
      if (i === 0) return true;
      return Math.abs(sampleIntensity(c.idx) - mainIntensity) <= 40;
    });

    // Apply loopCount selection
    let selected: typeof colorFiltered;
    if (settings.loopCount === 'auto') {
      const areaThreshold = colorFiltered[0].area * 0.05;
      selected = colorFiltered.filter(c => c.area >= areaThreshold);
    } else {
      selected = colorFiltered.slice(0, settings.loopCount as number);
    }

    const epsilon = 2.0 + settings.shapePerfection * 2.0;

    // Simplify + smooth a single contour mat → pixel point array
    function processContour(contourMat: any): Array<{ x: number; y: number }> {
      const simplified = new _cv.Mat();
      _cv.approxPolyDP(contourMat, simplified, epsilon, true);

      let pts: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < simplified.rows; i++) {
        pts.push({ x: simplified.data32S[i * 2], y: simplified.data32S[i * 2 + 1] });
      }
      simplified.delete();

      // Stage 1: Chaikin smoothing (global, independent of corner detection)
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

      // Stage 2: corner-preserving shape perfection — only active when shapePerfection > 0.
      // At sp=0 this is skipped entirely; calling it at sp=0 would still apply 2 Chaikin
      // iterations to non-corner segments (corner threshold 120° ≫ typical 90° bend),
      // producing rounded corners and kinks even when the user expects the raw outline.
      if (settings.shapePerfection > 0) {
        pts = cornerPreservingSmooth(pts, settings.shapePerfection);
      }
      return pts;
    }

    // Process all selected contours into pixel-space point arrays
    const allPixelPoints = selected.map(c => processContour(contours.get(c.idx)));

    // ── Rule 3: self-proximity filter (inner contours only) ───────────────────
    // A valid drawn outline never has two non-adjacent points closer than 10×
    // pen thickness to each other. Contours that violate this are noise artefacts
    // (e.g. morphology-created figure-8 blobs).
    const selfProxMinDistSq = Math.pow(penThickness * 10, 2);
    function hasSelfProximity(pts: Array<{ x: number; y: number }>): boolean {
      const n = pts.length;
      if (n < 6) return false;
      // Exclude pairs that are ≤15% of the contour apart (adjacent in the loop)
      const minSep = Math.max(3, Math.floor(n * 0.15));
      const step = Math.max(1, Math.floor(n / 80));
      for (let i = 0; i < n; i += step) {
        for (let j = i + minSep; j <= i + n - minSep; j += step) {
          const jj = j % n;
          const dx = pts[i].x - pts[jj].x;
          const dy = pts[i].y - pts[jj].y;
          if (dx * dx + dy * dy < selfProxMinDistSq) return true;
        }
      }
      return false;
    }

    // Main contour is always kept; inner contours that fail Rule 3 are dropped.
    const validPixelPoints = [allPixelPoints[0]];
    for (let k = 1; k < allPixelPoints.length; k++) {
      if (!hasSelfProximity(allPixelPoints[k])) validPixelPoints.push(allPixelPoints[k]);
    }

    // Compute scale + center from main contour only — all others share the same transform
    const mainPixelPoints = validPixelPoints[0];
    const mainYs = mainPixelPoints.map(p => p.y);
    const mainXs = mainPixelPoints.map(p => p.x);
    const pixelHeight = Math.max(...mainYs) - Math.min(...mainYs);

    if (pixelHeight < 1) {
      throw new Error('Detected shape is too small. Try adjusting the threshold or photograph in better lighting.');
    }

    const scaleFactor = settings.targetHeightMm / pixelHeight;
    const cx_px = (Math.max(...mainXs) + Math.min(...mainXs)) / 2;
    const cy_px = (Math.max(...mainYs) + Math.min(...mainYs)) / 2;

    const scaleContour = (pts: Array<{ x: number; y: number }>) =>
      pts.map(p => ({ x: (p.x - cx_px) * scaleFactor, y: (p.y - cy_px) * scaleFactor }));

    // kernel and dist are already deleted inline above
    [src, gray, enhanced, blurred, binary, closed, contours, hierarchy].forEach((m) => {
      try { m.delete(); } catch (_) {}
    });
    try { clahe.delete(); } catch (_) {}

    const result: ContourResult = {
      points: scaleContour(mainPixelPoints),
      pixelPoints: mainPixelPoints,
      innerContours: validPixelPoints.slice(1).map(pts => ({
        points: scaleContour(pts),
        pixelPoints: pts,
      })),
      imageWidth: imageData.width,
      imageHeight: imageData.height,
    };

    self.postMessage({ type: 'CONTOUR_RESULT', result } as CVWorkerResult);
  } catch (err: any) {
    self.postMessage({ type: 'ERROR', message: err.message ?? String(err) } as CVWorkerError);
  }
};
