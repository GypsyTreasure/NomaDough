import { useAppStore } from '../../store/useAppStore'
import { useGeometryStore } from '../../store/useGeometryStore'
import { useGenerateGeometry } from '../../hooks/useGenerateGeometry'
import { Cpu } from 'lucide-react'

interface SliderFieldProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
}

function SliderField({ label, value, min, max, step, unit, onChange }: SliderFieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#777', fontSize: '12px' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)))
            }}
            style={{ width: '58px', textAlign: 'right', fontSize: '12px', padding: '3px 6px' }}
          />
          <span style={{ color: '#3a3a3a', fontSize: '11px', minWidth: '18px' }}>{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%' }}
      />
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ width: '3px', height: '11px', background: '#00ff00', borderRadius: '2px', flexShrink: 0 }} />
      <span style={{ color: '#888', fontSize: '10px', letterSpacing: '1.2px', textTransform: 'uppercase', fontWeight: 600 }}>
        {children}
      </span>
    </div>
  )
}

function Divider() {
  return <div style={{ height: '1px', background: '#161616' }} />
}

function TrapezoidPreview({ a, b, c }: { a: number; b: number; c: number }) {
  const W = 180
  const H = 60
  const pad = 10
  const availW = W - pad * 2
  const availH = H - pad * 2 - 14 // leave room for label

  const scaleX = availW / Math.max(b, 1)
  const scaleY = availH / Math.max(c, 1)

  const aW = a * scaleX
  const bW = b * scaleX
  const cH = c * scaleY

  const midX = W / 2
  const topY = pad
  const bottomY = pad + cH

  const points = [
    `${midX - aW / 2},${topY}`,
    `${midX + aW / 2},${topY}`,
    `${midX + bW / 2},${bottomY}`,
    `${midX - bW / 2},${bottomY}`,
  ].join(' ')

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <polygon
        points={points}
        fill="rgba(0,255,0,0.08)"
        stroke="#00aa00"
        strokeWidth="1"
      />
      {/* A label */}
      <line x1={midX - aW / 2} y1={topY - 4} x2={midX + aW / 2} y2={topY - 4} stroke="#333" strokeWidth="0.5" />
      <text x={midX} y={topY - 2} textAnchor="middle" fill="#333" fontSize="5">A={a}mm</text>
      {/* B label */}
      <line x1={midX - bW / 2} y1={bottomY + 5} x2={midX + bW / 2} y2={bottomY + 5} stroke="#333" strokeWidth="0.5" />
      <text x={midX} y={bottomY + 11} textAnchor="middle" fill="#333" fontSize="5">B={b}mm</text>
      {/* C label */}
      <line x1={midX + bW / 2 + 3} y1={topY} x2={midX + bW / 2 + 3} y2={bottomY} stroke="#333" strokeWidth="0.5" />
      <text x={midX + bW / 2 + 8} y={(topY + bottomY) / 2 + 2} fill="#333" fontSize="5">C={c}</text>
    </svg>
  )
}

export function SettingsPanel() {
  const { settings, updateSettings, updateCutterProfile, updateBridgeProfile, imageContext } = useAppStore()
  const { isGenerating } = useGeometryStore()
  const generateGeometry = useGenerateGeometry()
  const { sketchHeightMm, cutterProfile, bridgeProfile } = settings

  const hasPaths = imageContext.processedVectorPaths.length > 0
  const canRegenerate = hasPaths && !isGenerating

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* Output Size */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <SectionTitle>Output Size</SectionTitle>
        <SliderField
          label="Sketch Height"
          value={sketchHeightMm}
          min={20} max={250} step={1} unit="mm"
          onChange={(v) => updateSettings({ sketchHeightMm: v })}
        />
      </div>

      <Divider />

      {/* Cutter Profile */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <SectionTitle>Cutter Profile</SectionTitle>

        <SliderField
          label="Cutting Edge (A)"
          value={cutterProfile.a}
          min={0.1} max={2.0} step={0.05} unit="mm"
          onChange={(v) => updateCutterProfile({ a: v })}
        />
        <SliderField
          label="Base Width (B)"
          value={cutterProfile.b}
          min={1.0} max={10.0} step={0.1} unit="mm"
          onChange={(v) => updateCutterProfile({ b: v })}
        />
        <SliderField
          label="Wall Height (C)"
          value={cutterProfile.c}
          min={5.0} max={30.0} step={0.5} unit="mm"
          onChange={(v) => updateCutterProfile({ c: v })}
        />

        <TrapezoidPreview a={cutterProfile.a} b={cutterProfile.b} c={cutterProfile.c} />
      </div>

      <Divider />

      {/* Bridge Profile */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <SectionTitle>Bridge Profile</SectionTitle>
        <SliderField
          label="Bridge Width (S)"
          value={bridgeProfile.s}
          min={1.0} max={10.0} step={0.5} unit="mm"
          onChange={(v) => updateBridgeProfile({ s: v })}
        />
        <SliderField
          label="Bridge Height (W)"
          value={bridgeProfile.w}
          min={0.5} max={5.0} step={0.5} unit="mm"
          onChange={(v) => updateBridgeProfile({ w: v })}
        />
      </div>

      {/* Regenerate button — visible when paths are loaded */}
      {hasPaths && (
        <>
          <Divider />
          <button
            onClick={() => generateGeometry()}
            disabled={!canRegenerate}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px',
              background: canRegenerate ? 'rgba(0,255,0,0.06)' : '#0d0d0d',
              border: `1px solid ${canRegenerate ? '#00aa00' : '#1a1a1a'}`,
              borderRadius: '6px',
              color: canRegenerate ? '#00cc00' : '#2e2e2e',
              fontSize: '12px',
              fontWeight: 600,
              cursor: canRegenerate ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              letterSpacing: '0.3px',
            }}
            onMouseEnter={(e) => {
              if (canRegenerate) {
                e.currentTarget.style.background = 'rgba(0,255,0,0.10)'
                e.currentTarget.style.borderColor = '#00ff00'
                e.currentTarget.style.color = '#00ff00'
              }
            }}
            onMouseLeave={(e) => {
              if (canRegenerate) {
                e.currentTarget.style.background = 'rgba(0,255,0,0.06)'
                e.currentTarget.style.borderColor = '#00aa00'
                e.currentTarget.style.color = '#00cc00'
              }
            }}
          >
            <Cpu size={13} />
            {isGenerating ? 'Generating…' : 'Regenerate 3D Model'}
          </button>
        </>
      )}

      {/* Help text */}
      {!hasPaths && (
        <p style={{ color: '#2a2a2a', fontSize: '10px', lineHeight: 1.6 }}>
          Upload a sketch to generate the 3D cutter. After generating, adjust parameters and click Regenerate.
        </p>
      )}
    </div>
  )
}
