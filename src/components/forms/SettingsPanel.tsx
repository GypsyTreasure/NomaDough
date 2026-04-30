import { useAppStore } from '../../store/useAppStore'

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#888', fontSize: '12px' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(parseFloat(e.target.value) || min)}
            style={{ width: '60px', textAlign: 'right', fontSize: '12px' }}
          />
          <span style={{ color: '#444', fontSize: '11px' }}>{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', height: '2px' }}
      />
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '2px',
    }}>
      <div style={{ width: '3px', height: '12px', background: '#00ff00', borderRadius: '2px' }} />
      <span style={{ color: '#aaa', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600 }}>
        {children}
      </span>
    </div>
  )
}

export function SettingsPanel() {
  const { settings, updateSettings, updateCutterProfile, updateBridgeProfile } = useAppStore()
  const { sketchHeightMm, cutterProfile, bridgeProfile } = settings

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Sketch Size */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <SectionTitle>Output Size</SectionTitle>
        <SliderField
          label="Sketch Height"
          value={sketchHeightMm}
          min={20}
          max={200}
          step={1}
          unit="mm"
          onChange={(v) => updateSettings({ sketchHeightMm: v })}
        />
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: '#1a1a1a' }} />

      {/* Cutter Profile */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <SectionTitle>Cutter Profile</SectionTitle>

        <SliderField
          label="Cutting Edge (A)"
          value={cutterProfile.a}
          min={0.1}
          max={2.0}
          step={0.05}
          unit="mm"
          onChange={(v) => updateCutterProfile({ a: v })}
        />

        <SliderField
          label="Base Width (B)"
          value={cutterProfile.b}
          min={1.0}
          max={8.0}
          step={0.1}
          unit="mm"
          onChange={(v) => updateCutterProfile({ b: v })}
        />

        <SliderField
          label="Height (C)"
          value={cutterProfile.c}
          min={5.0}
          max={30.0}
          step={0.5}
          unit="mm"
          onChange={(v) => updateCutterProfile({ c: v })}
        />

        {/* Profile preview */}
        <svg
          width="100%"
          height="50"
          viewBox="0 0 100 50"
          style={{ opacity: 0.7 }}
        >
          {/* Draw trapezoid preview */}
          {(() => {
            const a = cutterProfile.a
            const b = cutterProfile.b
            const c = cutterProfile.c
            const scale = 12 / Math.max(a, b, c)
            const aScaled = a * scale
            const bScaled = b * scale
            const cScaled = c * scale
            const cx = 50
            const topY = 10
            const bottomY = topY + cScaled
            return (
              <polygon
                points={`
                  ${cx - aScaled / 2},${topY}
                  ${cx + aScaled / 2},${topY}
                  ${cx + bScaled / 2},${bottomY}
                  ${cx - bScaled / 2},${bottomY}
                `}
                fill="rgba(0,255,0,0.15)"
                stroke="#00ff00"
                strokeWidth="0.5"
              />
            )
          })()}
          <text x="50" y="46" textAnchor="middle" fill="#444" fontSize="6">
            Trapezoid Cross-Section
          </text>
        </svg>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: '#1a1a1a' }} />

      {/* Bridge Profile */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <SectionTitle>Bridge Profile</SectionTitle>

        <SliderField
          label="Bridge Width (S)"
          value={bridgeProfile.s}
          min={1.0}
          max={10.0}
          step={0.5}
          unit="mm"
          onChange={(v) => updateBridgeProfile({ s: v })}
        />

        <SliderField
          label="Bridge Height (W)"
          value={bridgeProfile.w}
          min={0.5}
          max={5.0}
          step={0.5}
          unit="mm"
          onChange={(v) => updateBridgeProfile({ w: v })}
        />
      </div>

      {/* Info note */}
      <div style={{
        padding: '10px 12px',
        background: '#111',
        borderRadius: '6px',
        border: '1px solid #1a1a1a',
      }}>
        <p style={{ color: '#444', fontSize: '10px', lineHeight: '1.6' }}>
          Upload a sketch to generate the 3D model. Adjust settings and re-upload to regenerate.
        </p>
      </div>
    </div>
  )
}
