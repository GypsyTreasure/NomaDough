import { useStore } from '../../store/useStore'
import { useGenerate3D } from '../../hooks/useGenerate3D'
import { Cpu } from 'lucide-react'

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'10px' }}>
      <div style={{ width:'2px', height:'10px', background:'#00ff00', borderRadius:'1px', flexShrink:0 }} />
      <span style={{ color:'#666', fontSize:'10px', letterSpacing:'1.2px', textTransform:'uppercase', fontWeight:600 }}>
        {children}
      </span>
    </div>
  )
}

function Row({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string
  onChange: (v: number) => void
}) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ color:'#666', fontSize:'11px' }}>{label}</span>
        <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
          <input type="number" value={value} min={min} max={max} step={step}
            onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v))) }} />
          <span style={{ color:'#333', fontSize:'10px', minWidth:'20px' }}>{unit}</span>
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))} />
    </div>
  )
}

function Divider() {
  return <div style={{ height:'1px', background:'#141414', margin:'4px 0' }} />
}

function TrapezoidDiagram({ a, b, c }: { a: number; b: number; c: number }) {
  const W = 200, H = 80, pad = 16
  const availW = W - pad * 2
  const availH = H - pad - 22

  const sx = availW / Math.max(b, 0.01)
  const sy = availH / Math.max(c, 0.01)
  const aW = a * sx, bW = b * sx, cH = c * sy
  const mx = W / 2

  // A at top (Y=0), B at bottom (Y=cH) — matching actual 3D orientation
  const topY = pad, botY = pad + cH

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display:'block', marginTop:'4px' }}>
      <polygon
        points={`${mx-aW/2},${topY} ${mx+aW/2},${topY} ${mx+bW/2},${botY} ${mx-bW/2},${botY}`}
        fill="rgba(0,255,0,.07)" stroke="#004400" strokeWidth="1"
      />
      {/* A label — cutting edge at top */}
      <line x1={mx-aW/2} y1={topY-4} x2={mx+aW/2} y2={topY-4} stroke="#1e3a1e" strokeWidth=".8"/>
      <text x={mx} y={topY-6} textAnchor="middle" fill="#2a5a2a" fontSize="7">A = {a}mm (cutting edge)</text>
      {/* B label — base at bottom */}
      <line x1={mx-bW/2} y1={botY+5} x2={mx+bW/2} y2={botY+5} stroke="#1e3a1e" strokeWidth=".8"/>
      <text x={mx} y={botY+14} textAnchor="middle" fill="#2a5a2a" fontSize="7">B = {b}mm (base)</text>
      {/* C label on right */}
      <line x1={mx+bW/2+4} y1={topY} x2={mx+bW/2+4} y2={botY} stroke="#1e3a1e" strokeWidth=".8"/>
      <text x={mx+bW/2+10} y={(topY+botY)/2+3} fill="#2a5a2a" fontSize="7">C={c}</text>
      {/* Orientation label */}
      <text x="2" y={H-2} fill="#1a2e1a" fontSize="6">↑ Y (height)</text>
    </svg>
  )
}

export function SettingsPanel() {
  const { settings, phase, contourPaths, updateSettings, updateCutter, updateBridge } = useStore()
  const { cutterProfile: cp, bridgeProfile: bp } = settings
  const generate3D = useGenerate3D()

  const canGenerate = phase === 'preview' || phase === 'ready'
  const isGenerating = phase === 'geo-loading'

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

      <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        <Label>Output Size</Label>
        <Row label="Sketch Height" value={settings.sketchHeightMm}
          min={20} max={250} step={1} unit="mm"
          onChange={v => updateSettings({ sketchHeightMm: v })} />
      </div>

      <Divider />

      <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        <Label>Cutter Profile</Label>
        <Row label="A — Cutting edge" value={cp.a} min={0.1} max={2} step={0.05} unit="mm" onChange={v => updateCutter({ a: v })} />
        <Row label="B — Base width"   value={cp.b} min={1}   max={10} step={0.1}  unit="mm" onChange={v => updateCutter({ b: v })} />
        <Row label="C — Wall height"  value={cp.c} min={5}   max={30} step={0.5}  unit="mm" onChange={v => updateCutter({ c: v })} />
        <TrapezoidDiagram a={cp.a} b={cp.b} c={cp.c} />
      </div>

      <Divider />

      <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        <Label>Bridge Profile</Label>
        <Row label="S — Bridge width"  value={bp.s} min={1} max={10} step={0.5} unit="mm" onChange={v => updateBridge({ s: v })} />
        <Row label="W — Bridge height" value={bp.w} min={0.5} max={5} step={0.5} unit="mm" onChange={v => updateBridge({ w: v })} />
      </div>

      {contourPaths.length > 0 && (
        <>
          <Divider />
          <button
            onClick={generate3D}
            disabled={!canGenerate}
            style={{
              display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
              padding:'10px 14px',
              background: canGenerate ? 'rgba(0,255,0,.06)' : '#0d0d0d',
              border:`1px solid ${canGenerate ? '#006600' : '#151515'}`,
              borderRadius:'6px',
              color: canGenerate ? '#00cc00' : '#222',
              fontSize:'12px', fontWeight:700,
              cursor: canGenerate ? 'pointer' : 'not-allowed',
              transition:'all .2s',
              letterSpacing:'.3px',
            }}
            onMouseEnter={e => { if(canGenerate){ e.currentTarget.style.background='rgba(0,255,0,.12)'; e.currentTarget.style.borderColor='#00ff00'; e.currentTarget.style.color='#00ff00' } }}
            onMouseLeave={e => { if(canGenerate){ e.currentTarget.style.background='rgba(0,255,0,.06)'; e.currentTarget.style.borderColor='#006600'; e.currentTarget.style.color='#00cc00' } }}
          >
            <Cpu size={13} />
            {isGenerating ? 'Generating…' : phase === 'ready' ? 'Regenerate 3D' : 'Generate 3D Model'}
          </button>
        </>
      )}

      <p style={{ color:'#222', fontSize:'10px', lineHeight:1.6, marginTop:'-4px' }}>
        {contourPaths.length === 0
          ? 'Upload a sketch to begin. Adjust settings after extraction.'
          : `${contourPaths.length} contour${contourPaths.length>1?'s':''} loaded. Change settings and regenerate at any time.`
        }
      </p>
    </div>
  )
}
