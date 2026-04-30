import { useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useGeometryStore } from '../store/useGeometryStore'
import { deserializeGeometry } from '../utils/csg-helpers'
import GeometryWorker from '../workers/geometry.worker?worker'
import type { GeometryWorkerMessage } from '../types'

export function useGenerateGeometry() {
  const { settings, imageContext } = useAppStore()
  const geoStore = useGeometryStore()

  return useCallback(
    async (paths?: Array<Array<{ x: number; y: number }>>) => {
      const pathsToUse = paths ?? imageContext.processedVectorPaths
      if (pathsToUse.length === 0) return

      geoStore.reset()
      geoStore.setIsGenerating(true)
      geoStore.setProgress(0)

      const geoWorker = new GeometryWorker()
      try {
        await new Promise<void>((resolve, reject) => {
          geoWorker.onmessage = (e: MessageEvent<GeometryWorkerMessage>) => {
            if (e.data.type === 'progress') geoStore.setProgress(e.data.value)
            if (e.data.type === 'result') {
              const geo = deserializeGeometry(e.data.buffer)
              geoStore.setMesh(geo)
              geoStore.setExportReady(true)
              geoStore.setIsGenerating(false)
              geoWorker.terminate()
              resolve()
            }
            if (e.data.type === 'error') {
              geoStore.setIsGenerating(false)
              geoWorker.terminate()
              reject(new Error(e.data.message))
            }
          }
          geoWorker.postMessage({ paths: pathsToUse, settings })
        })
      } catch (err) {
        console.error('Geometry generation failed:', err)
        geoStore.setIsGenerating(false)
      }
    },
    [settings, imageContext.processedVectorPaths, geoStore]
  )
}
