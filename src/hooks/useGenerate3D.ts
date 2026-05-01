import { useCallback } from 'react'
import { useStore } from '../store/useStore'
import { unpackGeometry } from '../utils/geometry'
import GeoWorker from '../workers/geometry.worker?worker&inline'
import type { GeoWorkerMessage } from '../types'

export function useGenerate3D() {
  const store = useStore()

  return useCallback(async () => {
    const { contourPaths, settings } = store
    if (contourPaths.length === 0) return

    store.setPhase('geo-loading')
    store.setGeoProgress(0)

    const worker = new GeoWorker()
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          worker.terminate()
          reject(new Error('3D generation timed out (120s). The sketch may be too complex.'))
        }, 120_000)

        worker.onmessage = (e: MessageEvent<GeoWorkerMessage>) => {
          const msg = e.data
          if (msg.type === 'progress') {
            store.setGeoProgress(msg.value)
          } else if (msg.type === 'result') {
            clearTimeout(timeout)
            worker.terminate()
            const geo = unpackGeometry(msg.buffer)
            store.setGeometry(geo)
            resolve()
          } else if (msg.type === 'error') {
            clearTimeout(timeout)
            worker.terminate()
            reject(new Error(msg.message))
          }
        }
        worker.onerror = (ev) => {
          clearTimeout(timeout)
          worker.terminate()
          reject(new Error(ev.message || 'Geometry worker crashed'))
        }

        worker.postMessage({ paths: contourPaths, settings })
      })
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err))
    }
  }, [store])
}
