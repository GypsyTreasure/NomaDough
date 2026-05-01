import { useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { useProcessImage } from '../../hooks/useProcessImage'
import { Upload, RefreshCw } from 'lucide-react'

export function ImageUpload() {
  const ref = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const { phase, imageUrl, fileNameBase } = useStore()
  const processImage = useProcessImage()

  const busy = phase === 'cv-loading' || phase === 'geo-loading'

  const handle = (file: File) => {
    if (!file.type.startsWith('image/') && !file.name.match(/\.(heic|heif)$/i)) {
      useStore.getState().setError('Unsupported file type. Please use PNG, JPG, or HEIC.')
      return
    }
    processImage(file)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
      <span style={{ color:'#555', fontSize:'10px', letterSpacing:'1.2px', textTransform:'uppercase' }}>
        Upload Sketch
      </span>

      <div
        onClick={() => !busy && ref.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if(f) handle(f) }}
        style={{
          position:'relative', minHeight:'130px',
          border:`2px dashed ${drag ? '#00ff00' : '#1e1e1e'}`,
          borderRadius:'8px', background:'#0d0d0d',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'8px',
          cursor: busy ? 'default' : 'pointer',
          transition:'border-color .2s',
          overflow:'hidden',
        }}
      >
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt="Preview"
              style={{ maxHeight:'110px', maxWidth:'calc(100% - 16px)', objectFit:'contain', borderRadius:'4px', opacity: busy ? .3 : 1 }}
            />
            <span style={{ color:'#383838', fontSize:'10px' }}>{fileNameBase}</span>
          </>
        ) : (
          <>
            <Upload size={26} color="#2a2a2a" />
            <div style={{ textAlign:'center' }}>
              <p style={{ color:'#353535', fontSize:'12px' }}>Drop sketch or click to browse</p>
              <p style={{ color:'#252525', fontSize:'10px', marginTop:'3px' }}>PNG · JPG · HEIC</p>
            </div>
          </>
        )}
      </div>

      <input
        ref={ref} type="file" accept="image/*,.heic,.heif"
        style={{ display:'none' }}
        onChange={e => { const f = e.target.files?.[0]; if(f) handle(f); e.target.value='' }}
      />

      {imageUrl && !busy && (
        <button
          onClick={() => ref.current?.click()}
          style={{
            display:'flex', alignItems:'center', justifyContent:'center', gap:'5px',
            padding:'5px', background:'transparent',
            border:'1px solid #1e1e1e', borderRadius:'5px',
            color:'#3a3a3a', fontSize:'11px',
            transition:'all .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor='#00ff00'; e.currentTarget.style.color='#00ff00' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor='#1e1e1e'; e.currentTarget.style.color='#3a3a3a' }}
        >
          <RefreshCw size={11} /> Re-upload image
        </button>
      )}
    </div>
  )
}
