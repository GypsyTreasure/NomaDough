import { useGeometryStore } from '../../store/useGeometryStore'
import { useAppStore } from '../../store/useAppStore'
import { exportSTL } from '../../utils/exporter'
import { Download } from 'lucide-react'

// Inline logo: white text, #00ff00 green dot, no background rect
function NomaDirLogo({ height = 26 }: { height?: number }) {
  return (
    <svg
      viewBox="0 0 282 56"
      height={height}
      aria-label="NomaDirection"
      style={{ display: 'block' }}
    >
      <text
        x="0" y="42"
        fontFamily="'Barlow','Arial',sans-serif"
        fontSize="38"
        fill="#ffffff"
        letterSpacing="-0.5"
      >
        <tspan fontWeight="300">Noma</tspan>
        <tspan fontWeight="500">Direction</tspan>
      </text>
      <circle cx="268" cy="37" r="6" fill="#00ff00" />
    </svg>
  )
}

export function TopNav() {
  const { exportReady, mesh } = useGeometryStore()
  const { imageContext } = useAppStore()

  const handleExport = () => {
    if (!mesh || !exportReady) return
    exportSTL(mesh, imageContext.fileNameBase)
  }

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      height: '52px',
      background: '#0d0d0d',
      borderBottom: '1px solid #181818',
      flexShrink: 0,
      zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <NomaDirLogo height={22} />
        <div style={{ width: '1px', height: '18px', background: '#1e1e1e' }} />
        <span style={{ color: '#444', fontSize: '12px', letterSpacing: '0.3px' }}>
          NomaDough
        </span>
      </div>

      {/* Title — hidden on small screens */}
      <span style={{
        color: '#2e2e2e',
        fontSize: '11px',
        letterSpacing: '2px',
        textTransform: 'uppercase',
      }}>
        3D Cookie Cutter Generator
      </span>

      {/* Export button */}
      <button
        onClick={handleExport}
        disabled={!exportReady}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          padding: '7px 16px',
          background: exportReady ? '#00ff00' : '#111',
          color: exportReady ? '#000' : '#333',
          border: `1px solid ${exportReady ? '#00ff00' : '#1e1e1e'}`,
          borderRadius: '6px',
          cursor: exportReady ? 'pointer' : 'not-allowed',
          fontSize: '12px',
          fontWeight: 700,
          transition: 'all 0.2s',
          letterSpacing: '0.3px',
          boxShadow: exportReady ? '0 0 12px rgba(0,255,0,0.25)' : 'none',
        }}
        onMouseEnter={(e) => { if (exportReady) e.currentTarget.style.boxShadow = '0 0 20px rgba(0,255,0,0.4)' }}
        onMouseLeave={(e) => { if (exportReady) e.currentTarget.style.boxShadow = '0 0 12px rgba(0,255,0,0.25)' }}
      >
        <Download size={13} />
        Eksportuj STL
      </button>
    </header>
  )
}
