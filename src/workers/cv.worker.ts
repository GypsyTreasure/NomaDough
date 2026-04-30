/// <reference lib="webworker" />

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare let cv: any

let cvReady = false

function loadOpenCV(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (cvReady) {
      resolve()
      return
    }
    // @ts-expect-error global
    self.Module = {
      onRuntimeInitialized() {
        cvReady = true
        resolve()
      },
    }
    try {
      importScripts('https://docs.opencv.org/4.8.0/opencv.js')
    } catch (e) {
      reject(e)
    }
  })
}

function imageDataToMat(imageData: ImageData) {
  const mat = cv.matFromImageData(imageData)
  return mat
}

function processImage(
  imageData: ImageData,
  targetHeightMm: number
): Array<Array<{ x: number; y: number }>> {
  const src = imageDataToMat(imageData)
  const gray = new cv.Mat()
  const blurred = new cv.Mat()
  const binary = new cv.Mat()

  // Convert to grayscale
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)

  // Gaussian blur to reduce noise
  const ksize = new cv.Size(5, 5)
  cv.GaussianBlur(gray, blurred, ksize, 0)

  // Otsu's binarization - isolate dark lines
  cv.threshold(blurred, binary, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU)

  // Find contours
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  cv.findContours(
    binary,
    contours,
    hierarchy,
    cv.RETR_EXTERNAL,
    cv.CHAIN_APPROX_TC89_KCOS
  )

  const minArea = (imageData.width * imageData.height) * 0.0001

  // Collect all contour vertices for bounding box
  const allPaths: Array<Array<{ x: number; y: number }>> = []
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i)
    const area = cv.contourArea(contour)
    if (area < minArea) {
      contour.delete()
      continue
    }

    const approx = new cv.Mat()
    const epsilon = 0.005 * cv.arcLength(contour, true)
    cv.approxPolyDP(contour, approx, epsilon, true)

    const pts: Array<{ x: number; y: number }> = []
    for (let j = 0; j < approx.rows; j++) {
      const x = approx.data32S[j * 2]
      const y = approx.data32S[j * 2 + 1]
      pts.push({ x, y })
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }

    if (pts.length >= 3) {
      allPaths.push(pts)
    }

    approx.delete()
    contour.delete()
  }

  // Scale to real-world dimensions
  const pixelHeight = maxY - minY
  const scaleFactor = pixelHeight > 0 ? targetHeightMm / pixelHeight : 1

  const scaled = allPaths.map((path) =>
    path.map((pt) => ({
      x: (pt.x - minX) * scaleFactor,
      y: (pt.y - minY) * scaleFactor,
    }))
  )

  // Cleanup
  src.delete()
  gray.delete()
  blurred.delete()
  binary.delete()
  contours.delete()
  hierarchy.delete()

  return scaled
}

self.onmessage = async (e: MessageEvent) => {
  const { imageData, targetHeightMm } = e.data

  try {
    self.postMessage({ type: 'progress', value: 10 })

    await loadOpenCV()
    self.postMessage({ type: 'progress', value: 30 })

    const paths = processImage(imageData, targetHeightMm)
    self.postMessage({ type: 'progress', value: 90 })

    self.postMessage({ type: 'result', paths })
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
