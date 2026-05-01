import { useCallback } from 'react'
import { useStore } from '../store/useStore'
import { fileToImageData } from '../utils/image'
import CVWorker from '../workers/cv.worker?worker&inline'
import type { CVWorkerMessage } from '../types'

export function useProcessImage() {
  const store = useStore()

  return useCallback(async (file: File) => {
    const name = file.name.replace(/\.[^.]+$/, '')
    const url = URL.createObjectURL(file)
    store.setImage(file, url, name)

    try {
      const imageData = await fileToImageData(file)
      const worker = new CVWorker()

      const result = await new Promise<{ paths: any; rawPaths: any; imageWidth: number; imageHeight: number }>(
        (resolve, reject) => {
          const timeout = setTimeout(() => {
            worker.terminate()
            reject(new Error(
              'OpenCV.js timed out loading (30s). Make sure you have an internet connection — OpenCV is loaded from CDN.'
            ))
          }, 30_000)

          worker.onmessage = (e: MessageEvent<CVWorkerMessage>) => {
            const msg = e.data
            if (msg.type === 'progress') {
              store.setCvProgress(msg.value)
            } else if (msg.type === 'result') {
              clearTimeout(timeout)
              worker.terminate()
              resolve(msg as any)
            } else if (msg.type === 'error') {
              clearTimeout(timeout)
              worker.terminate()
              reject(new Error(msg.message))
            }
          }
          worker.onerror = (ev) => {
            clearTimeout(timeout)
            worker.terminate()
            reject(new Error(ev.message || 'CV worker crashed'))
          }

          worker.postMessage(
            { imageData, targetHeightMm: store.settings.sketchHeightMm },
            [imageData.data.buffer]
          )
        }
      )

      if (result.paths.length === 0) {
        store.setError(
          'No contours were detected in this image.\n\n' +
          'Tips:\n• Use a clear sketch with dark lines on a white/light background\n' +
          '• Avoid very faint or highly detailed drawings\n• Try scanning instead of photographing'
        )
        return
      }

      store.setCVResult(result)
      store.setPhase('preview')
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err))
    }
  }, [store])
}
