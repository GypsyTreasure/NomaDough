import { useRef, useState, useCallback } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useGeometryStore } from '../../store/useGeometryStore'
import { fileToImageData } from '../../utils/cv-helpers'
import { useGenerateGeometry } from '../../hooks/useGenerateGeometry'
import CVWorker from '../../workers/cv.worker?worker'
import { Upload, CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import type { CVWorkerMessage } from '../../types'

export function ImageUpload() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
  const generateGeometry = useGenerateGeometry()

  const processFile = useCallback(
    async (file: File) => {
      const nameWithoutExt = file.name.replace(/\.[^.]+$/, '')
      const url = URL.createObjectURL(file)
      setImageContext({ file, fileNameBase: nameWithoutExt, originalUrl: url, processedVectorPaths: [] })
      geoStore.reset()
      setError(null)
      setIsProcessingCV(true)
      setCvProgress(0)

      try {
        const imageData = await fileToImageData(file)

        const cvWorker = new CVWorker()
        const paths = await new Promise<Array<Array<{ x: number; y: number }>>>(
          (resolve, reject) => {
            const timeout = setTimeout(() => {
              cvWorker.terminate()
              reject(new Error('OpenCV timed out loading. Check your internet connection.'))
            }, 30000)

            cvWorker.onmessage = (e: MessageEvent<CVWorkerMessage>) => {
              if (e.data.type === 'progress') setCvProgress(e.data.value)
              if (e.data.type === 'result') {
                clearTimeout(timeout)
                cvWorker.terminate()
                resolve(e.data.paths)
              }
              if (e.data.type === 'error') {
                clearTimeout(timeout)
                cvWorker.terminate()
                reject(new Error(e.data.message))
              }
            }
            cvWorker.postMessage(
              { imageData, targetHeightMm: settings.sketchHeightMm },
              [imageData.data.buffer]
            )
          }
        )

        setIsProcessingCV(false)

        if (paths.length === 0) {
          setError('No contours detected. Try a sketch with clear dark lines on a white background.')
          return
        }

        setImageContext({ processedVectorPaths: paths })
        await generateGeometry(paths)
      } catch (err) {
        setIsProcessingCV(false)
        geoStore.setIsGenerating(false)
        setError(err instanceof Error ? err.message : 'Processing failed. Please try again.')
      }
    },
    [settings.sketchHeightMm, setImageContext, setIsProcessingCV, setCvProgress, geoStore, generateGeometry]
  )

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const isLoading = isProcessingCV || geoStore.isGenerating
  const phase = isProcessingCV ? 'Extracting contours…' : 'Generating 3D mesh…'
  const progress = isProcessingCV ? cvProgress : geoStore.progress

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <label style={{ color: '#666', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' }}>
        Sketch Input
      </label>

      {/* Drop zone */}
      <div
        onClick={() => !isLoading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${isDragging ? '#00ff00' : error ? '#ff4444' : imageContext.originalUrl ? '#252525' : '#1e1e1e'}`,
          borderRadius: '8px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          minHeight: '140px',
          background: isDragging ? 'rgba(0,255,0,0.03)' : '#0f0f0f',
          transition: 'border-color 0.2s',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {imageContext.originalUrl ? (
          <>
            <img
              src={imageContext.originalUrl}
              alt="Sketch preview"
              style={{
                maxHeight: '120px',
                maxWidth: '100%',
                objectFit: 'contain',
                borderRadius: '4px',
                opacity: isLoading ? 0.3 : 1,
                transition: 'opacity 0.2s',
              }}
            />
            <span style={{ color: '#444', fontSize: '11px', letterSpacing: '0.3px' }}>
              {imageContext.fileNameBase}
            </span>
          </>
        ) : (
          <>
            <Upload size={28} style={{ color: '#333' }} />
            <span style={{ color: '#444', fontSize: '12px', textAlign: 'center', lineHeight: 1.5 }}>
              Drop sketch here or click to browse<br />
              <span style={{ color: '#2e2e2e', fontSize: '10px' }}>PNG · JPG · HEIC</span>
            </span>
          </>
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.82)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
          }}>
            <Loader2
              size={22}
              style={{ color: '#00ff00', animation: 'spin 0.9s linear infinite' }}
            />
            <div style={{ width: '75%', height: '2px', background: '#1c1c1c', borderRadius: '1px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #00cc00, #00ff00)',
                transition: 'width 0.35s ease',
                boxShadow: '0 0 6px #00ff00',
              }} />
            </div>
            <span style={{ color: '#555', fontSize: '10px', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              {phase}
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

      {/* Error state */}
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          padding: '10px 12px',
          background: 'rgba(255,50,50,0.06)',
          border: '1px solid rgba(255,50,50,0.2)',
          borderRadius: '6px',
          animation: 'fadeIn 0.2s ease',
        }}>
          <AlertCircle size={14} style={{ color: '#ff5555', flexShrink: 0, marginTop: '1px' }} />
          <span style={{ color: '#cc4444', fontSize: '11px', lineHeight: 1.5 }}>{error}</span>
        </div>
      )}

      {/* Success state */}
      {imageContext.processedVectorPaths.length > 0 && !isLoading && !error && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={12} style={{ color: '#00ff00' }} />
            <span style={{ color: '#555', fontSize: '11px' }}>
              {imageContext.processedVectorPaths.length} contour{imageContext.processedVectorPaths.length !== 1 ? 's' : ''} detected
            </span>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              background: 'transparent',
              border: '1px solid #252525',
              borderRadius: '4px',
              color: '#444',
              fontSize: '10px',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#00ff00'; e.currentTarget.style.color = '#00ff00' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#252525'; e.currentTarget.style.color = '#444' }}
          >
            <RefreshCw size={10} />
            Re-upload
          </button>
        </div>
      )}
    </div>
  )
}
