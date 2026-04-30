import { ImageUpload } from '../forms/ImageUpload'
import { SettingsPanel } from '../forms/SettingsPanel'
import ndLogo from '../../assets/nd-logo-transparent.svg'

export function Sidebar() {
  return (
    <aside
      style={{
        width: '300px',
        minWidth: '300px',
        background: '#0d0d0d',
        borderRight: '1px solid #1e1e1e',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <ImageUpload />
        <SettingsPanel />
      </div>

      {/* Footer branding */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid #1a1a1a',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <img
          src={ndLogo}
          alt="NomaDirection"
          style={{
            height: '20px',
            filter: 'invert(1) brightness(5)',
            opacity: 0.4,
          }}
        />
        <span style={{ color: '#333', fontSize: '10px', letterSpacing: '1px' }}>
          by NomaDirection
        </span>
      </div>
    </aside>
  )
}
