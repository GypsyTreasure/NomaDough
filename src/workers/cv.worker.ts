/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */

declare let cv: any
let cvReady = false

function loadOpenCV(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (cvReady) { resolve(); return }
    ;(self as any).Module = {
      onRuntimeInitialized() { cvReady = true; resolve() },
    }
    try {
      // Try jsDelivr first (reliable CORS), fallback to official CDN
      importScripts('https://cdn.jsdelivr.net/npm/opencv.js@1.2.1/opencv.js')
    } catch {
      try {
        importScripts('https://docs.opencv.org/4.9.0/opencv.js')
      } catch (e2) {
        reject(new Error('Could not load OpenCV.js. Check your internet connection.'))
      }
    }
  })
}

function processImage(
  imageData: ImageData,
  targetHeightMm: number
): { paths: Array<Array<{x:number,y:number}>>, rawPaths: Array<Array<{x:number,y:number}>> } {
  const src = cv.matFromImageData(imageData)
  const gray = new cv.Mat()
  const blurred = new cv.Mat()
  const binary = new cv.Mat()

  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
  cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0)
  cv.threshold(blurred, binary, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU)

  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_TC89_KCOS)

  const minArea = imageData.width * imageData.height * 0.0002
  const rawPaths: Array<Array<{x:number,y:number}>> = []
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i)
    if (cv.contourArea(cnt) < minArea) { cnt.delete(); continue }

    const approx = new cv.Mat()
    cv.approxPolyDP(cnt, approx, 0.005 * cv.arcLength(cnt, true), true)

    const pts: Array<{x:number,y:number}> = []
    for (let j = 0; j < approx.rows; j++) {
      const x = approx.data32S[j * 2]
      const y = approx.data32S[j * 2 + 1]
      pts.push({ x, y })
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }

    if (pts.length >= 3) rawPaths.push(pts)
    approx.delete()
    cnt.delete()
  }

  src.delete(); gray.delete(); blurred.delete(); binary.delete()
  contours.delete(); hierarchy.delete()

  if (rawPaths.length === 0) return { paths: [], rawPaths: [] }

  const pixelHeight = maxY - minY
  const scaleFactor = pixelHeight > 0 ? targetHeightMm / pixelHeight : 1

  const paths = rawPaths.map(path =>
    path.map(pt => ({
      x: (pt.x - minX) * scaleFactor,
      y: (pt.y - minY) * scaleFactor,
    }))
  )

  return { paths, rawPaths }
}

self.onmessage = async (e: MessageEvent) => {
  const { imageData, targetHeightMm } = e.data
  try {
    self.postMessage({ type: 'progress', value: 5 })
    await loadOpenCV()
    self.postMessage({ type: 'progress', value: 40 })
    const { paths, rawPaths } = processImage(imageData, targetHeightMm)
    self.postMessage({ type: 'progress', value: 95 })
    self.postMessage({
      type: 'result',
      paths,
      rawPaths,
      imageWidth: imageData.width,
      imageHeight: imageData.height,
    })
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
