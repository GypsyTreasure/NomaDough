import { useRef, useState, useCallback } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useGeometryStore } from '../../store/useGeometryStore'
import { fileToImageData } from '../../utils/cv-helpers'
import { deserializeGeometry } from '../../utils/csg-helpers'
import CVWorker from '../../workers/cv.worker?worker'
import GeometryWorker from '../../workers/geometry.worker?worker'
import { Upload, ImageIcon, Loader2 } from 'lucide-react'
import type { CVWorkerMessage, GeometryWorkerMessage } from '../../types'

export function ImageUpload() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const {
    imageContext,
    settings,
    isProcessingCV,
    cvProgress,
    setImageContext,
    setIsProcessingCV,
    setCvProgress,
  } = useAppStore()

  const geoStore = useGeometryStore()

  const processFile = useCallback(
    async (file: File) => {
      const nameWithoutExt = file.name.replace(/\.[^.]+$/, '')
      const url = URL.createObjectURL(file)
      setImageContext({ file, fileNameBase: nameWithoutExt, originalUrl: url, processedVectorPaths: [] })
      geoStore.reset()
      setIsProcessingCV(true)
      setCvProgress(0)

      try {
        const imageData = await fileToImageData(file)

        // CV Worker
        const cvWorker = new CVWorker()
        const paths = await new Promise<Array<Array<{ x: number; y: number }>>>(
          (resolve, reject) => {
            cvWorker.onmessage = (e: MessageEvent<CVWorkerMessage>) => {
              if (e.data.type === 'progress') setCvProgress(e.data.value)
              if (e.data.type === 'result') { cvWorker.terminate(); resolve(e.data.paths) }
              if (e.data.type === 'error') { cvWorker.terminate(); reject(new Error(e.data.message)) }
            }
            cvWorker.postMessage({ imageData, targetHeightMm: settings.sketchHeightMm }, [imageData.data.buffer])
          }
        )

        setImageContext({ processedVectorPaths: paths })
        setIsProcessingCV(false)
        setCvProgress(100)

        // Geometry Worker
        geoStore.setIsGenerating(true)
        geoStore.setProgress(0)

        const geoWorker = new GeometryWorker()
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
          geoWorker.postMessage({ paths, settings })
        })
      } catch (err) {
        console.error('Processing error:', err)
        setIsProcessingCV(false)
        geoStore.setIsGenerating(false)
      }
    },
    [settings, setImageContext, setIsProcessingCV, setCvProgress, geoStore]
  )

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const isLoading = isProcessingCV || geoStore.isGenerating
  const progress = isProcessingCV ? cvProgress : geoStore.progress

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <label style={{ color: '#888', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>
        Sketch Input
      </label>

      {/* Drop zone */}
      <div
        onClick={() => !isLoading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${isDragging ? '#00ff00' : imageContext.originalUrl ? '#2a2a2a' : '#222'}`,
          borderRadius: '8px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          minHeight: '120px',
          background: isDragging ? 'rgba(0,255,0,0.04)' : '#111',
          transition: 'all 0.2s',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {imageContext.originalUrl ? (
          <>
            <img
              src={imageContext.originalUrl}
              alt="Preview"
              style={{
                maxHeight: '80px',
                maxWidth: '100%',
                objectFit: 'contain',
                borderRadius: '4px',
                opacity: isLoading ? 0.4 : 1,
              }}
            />
            <span style={{ color: '#555', fontSize: '11px' }}>
              {imageContext.fileNameBase}
            </span>
          </>
        ) : (
          <>
            <Upload size={24} style={{ color: '#444' }} />
            <span style={{ color: '#555', fontSize: '12px', textAlign: 'center' }}>
              Drop sketch here<br />
              <span style={{ color: '#333', fontSize: '10px' }}>PNG, JPG, HEIC</span>
            </span>
          </>
        )}

        {isLoading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}>
            <Loader2 size={20} style={{ color: '#00ff00', animation: 'spin 1s linear infinite' }} />
            <div style={{
              width: '80%',
              height: '2px',
              background: '#1a1a1a',
              borderRadius: '1px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: '#00ff00',
                transition: 'width 0.3s',
              }} />
            </div>
            <span style={{ color: '#888', fontSize: '10px' }}>
              {isProcessingCV ? 'Extracting contours...' : 'Generating 3D...'}
            </span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />

      {imageContext.processedVectorPaths.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ImageIcon size={12} style={{ color: '#00ff00' }} />
          <span style={{ color: '#555', fontSize: '11px' }}>
            {imageContext.processedVectorPaths.length} contour{imageContext.processedVectorPaths.length !== 1 ? 's' : ''} detected
          </span>
        </div>
      )}
    </div>
  )
}
