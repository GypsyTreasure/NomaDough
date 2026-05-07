import type { CVWorkerMessage, CVWorkerResult, CVWorkerError, ContourResult } from '../types';

declare function importScripts(...urls: string[]): void;
declare const cv: any;

const cvReady = new Promise<void>((resolve) => {
  if (typeof cv !== 'undefined' && cv.Mat) { resolve(); return; }
  (self as any).Module = { onRuntimeInitialized: () => resolve() };
});

importScripts('https://docs.opencv.org/4.8.0/opencv.js');

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

  try {
    await cvReady;

    const src    = M(cv.matFromImageData(imageData));
    const gray   = M(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    const blurred = M(new cv.Mat());
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    const binary = M(new cv.Mat());

    if (settings.threshold === 'auto') {
      const shortDim = Math.min(W, H);
      let blockSize = Math.max(11, Math.round(shortDim / 20));
      if (blockSize % 2 === 0) blockSize += 1;
      cv.adaptiveThreshold(blurred, binary, 255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, blockSize, 8);
    } else {
      cv.threshold(blurred, binary, settings.threshold as number, 255, cv.THRESH_BINARY_INV);
    }

    const k3     = M(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3)));
    const closed = M(new cv.Mat());
    cv.morphologyEx(binary, closed, cv.MORPH_CLOSE, k3, new cv.Point(-1, -1), 1);
    const opened = M(new cv.Mat());
    cv.morphologyEx(closed, opened, cv.MORPH_OPEN, k3, new cv.Point(-1, -1), 1);

    const contours  = M(new cv.MatVector());
    const hierarchy = M(new cv.Mat());
    cv.findContours(opened, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_TC89_KCOS);

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
      const area = cv.contourArea(c);
      if (area < minArea) continue;

      const rect = cv.boundingRect(c);
      if (rect.x <= 2 && rect.y <= 2 &&
          rect.x + rect.width  >= W - 2 &&
          rect.y + rect.height >= H - 2) continue;
      if (rect.width * rect.height > imageArea * 0.92) continue;

      const perimeter = cv.arcLength(c, true);
      // Roughness filter: roughness > 4 means too jagged, skip
      const roughness = perimeter / (2 * Math.sqrt(Math.PI * area));
      if (roughness > 4.0) continue;

      const epsilon = Math.max(1.5, Math.min(0.005 * perimeter, 8.0));
      const approx  = new cv.Mat();
      cv.approxPolyDP(c, approx, epsilon, true);

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

    // Concentric dedup: same ink ring has two edges; keep the larger
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

    // Proximity dedup: nearly-overlapping smaller sibling → remove
    function getBbox(pts: Array<{x:number;y:number}>) {
      const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
      return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
    }

    afterConcentric.sort((a, b) => b.area - a.area);

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
      mats.forEach(m => { try { m.delete(); } catch (_) {} });
      self.postMessage({ type: 'ERROR', message: 'No shape detected. Ensure a clear outline on a lighter background.' } as CVWorkerError);
      return;
    }

    // Select up to expectedLoops (0 = all)
    const take = settings.expectedLoops <= 0
      ? afterProximity.length
      : Math.min(settings.expectedLoops, afterProximity.length);
    const selected = afterProximity.slice(0, take);

    // Scale using primary loop's pixel bounding box
    const primary   = selected[0];
    const primYs    = primary.pts.map(p => p.y);
    const primXs    = primary.pts.map(p => p.x);
    const pixH      = Math.max(...primYs) - Math.min(...primYs);

    if (pixH < 1) {
      mats.forEach(m => { try { m.delete(); } catch (_) {} });
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

    mats.forEach(m => { try { m.delete(); } catch (_) {} });

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
    mats.forEach(m => { try { m.delete(); } catch (_) {} });
    self.postMessage({ type: 'ERROR', message: err.message ?? String(err) } as CVWorkerError);
  }
};
