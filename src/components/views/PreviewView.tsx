import { useStore } from '../../store/useStore'
import { useGenerate3D } from '../../hooks/useGenerate3D'
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

// Stroke colors for multiple contours
const COLORS = ['#00ff00','#00ccff','#ffaa00','#ff44aa','#aa44ff','#ff6644']

export function PreviewView() {
  const { imageUrl, rawContourPaths, contourPaths, imageWidth, imageHeight } = useStore()
  const generate3D = useGenerate3D()

  if (rawContourPaths.length === 0 || imageWidth === 0) return null

  // Compute total path lengths in mm for display
  const totalLengthMm = contourPaths.reduce((sum, path) => {
    let len = 0
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i-1].x, dy = path[i].y - path[i-1].y
      len += Math.sqrt(dx*dx + dy*dy)
    }
    return sum + len
  }, 0)

  // Build SVG paths from raw pixel coordinates
  const svgPaths = rawContourPaths.map((path, idx) => {
    if (path.length < 2) return null
    const d = path.map((pt, i) => `${i===0?'M':'L'}${pt.x},${pt.y}`).join(' ') + ' Z'
    return (
      <path
        key={idx}
        d={d}
        fill="none"
        stroke={COLORS[idx % COLORS.length]}
        strokeWidth="2"
        strokeLinejoin="round"
        opacity="0.9"
      />
    )
  })

  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column',
      background:'#080808', overflow:'hidden', animation:'fadeIn .25s ease',
    }}>
      {/* Header bar */}
      <div style={{
        padding:'12px 20px', borderBottom:'1px solid #141414',
        display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <CheckCircle size={16} color="#00ff00" />
          <span style={{ color:'#888', fontSize:'12px' }}>
            Contour extraction complete —&nbsp;
            <span style={{ color:'#00ff00', fontWeight:600 }}>
              {rawContourPaths.length} contour{rawContourPaths.length>1?'s':''} detected
            </span>
            &nbsp;·&nbsp;
            <span style={{ color:'#555' }}>~{totalLengthMm.toFixed(0)} mm total path</span>
          </span>
        </div>

        <div style={{ display:'flex', gap:'10px' }}>
          <button
            onClick={() => useStore.getState().reset()}
            style={{
              display:'flex', alignItems:'center', gap:'6px',
              padding:'7px 14px',
              background:'transparent', border:'1px solid #252525',
              borderRadius:'6px', color:'#444', fontSize:'12px', cursor:'pointer',
              transition:'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='#ff4444'; e.currentTarget.style.color='#ff4444' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='#252525'; e.currentTarget.style.color='#444' }}
          >
            <XCircle size={13} /> Reject — Re-upload
          </button>

          <button
            onClick={generate3D}
            style={{
              display:'flex', alignItems:'center', gap:'6px',
              padding:'7px 18px',
              background:'#00ff00', border:'1px solid #00ff00',
              borderRadius:'6px', color:'#000', fontSize:'12px', fontWeight:700, cursor:'pointer',
              boxShadow:'0 0 14px #00ff0055',
              transition:'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow='0 0 22px #00ff0088' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow='0 0 14px #00ff0055' }}
          >
            ✓ &nbsp;Accept &amp; Generate 3D Model
          </button>
        </div>
      </div>

      {/* Preview canvas */}
      <div style={{
        flex:1, display:'flex', alignItems:'center', justifyContent:'center',
        padding:'20px', gap:'20px', overflow:'hidden',
      }}>
        {/* Original image */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'8px' }}>
          <span style={{ color:'#333', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase' }}>
            Original
          </span>
          <div style={{
            border:'1px solid #1a1a1a', borderRadius:'6px', overflow:'hidden',
            maxWidth:'calc(50vw - 180px)', maxHeight:'calc(100vh - 220px)',
          }}>
            <img
              src={imageUrl!}
              alt="Original sketch"
              style={{ display:'block', maxWidth:'100%', maxHeight:'calc(100vh - 236px)', objectFit:'contain' }}
            />
          </div>
        </div>

        {/* Extracted contours */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'8px' }}>
          <span style={{ color:'#333', fontSize:'10px', letterSpacing:'1px', textTransform:'uppercase' }}>
            Extracted Contours
          </span>
          <div style={{
            border:'1px solid #1a1a1a', borderRadius:'6px', overflow:'hidden', background:'#0a0a0a',
            maxWidth:'calc(50vw - 180px)', maxHeight:'calc(100vh - 220px)',
          }}>
            <svg
              viewBox={`0 0 ${imageWidth} ${imageHeight}`}
              style={{ display:'block', maxWidth:'100%', maxHeight:'calc(100vh - 236px)' }}
            >
              {/* Faint image background */}
              <image href={imageUrl!} width={imageWidth} height={imageHeight} opacity="0.12" />
              {svgPaths}
            </svg>
          </div>
        </div>
      </div>

      {/* Legend */}
      {rawContourPaths.length > 1 && (
        <div style={{
          padding:'8px 20px', borderTop:'1px solid #141414', flexShrink:0,
          display:'flex', alignItems:'center', gap:'16px',
        }}>
          <AlertTriangle size={12} color="#888" />
          <span style={{ color:'#444', fontSize:'11px' }}>
            Multiple contours detected — bridges will be automatically generated to connect them
          </span>
          {rawContourPaths.map((_, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:'5px' }}>
              <div style={{ width:'16px', height:'2px', background: COLORS[i % COLORS.length], borderRadius:'1px' }} />
              <span style={{ color:'#333', fontSize:'10px' }}>Loop {i+1}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
