import logoSvg from '../../assets/logo.svg'
import { useGeometryStore } from '../../store/useGeometryStore'
import { useAppStore } from '../../store/useAppStore'
import { exportSTL } from '../../utils/exporter'
import { Download } from 'lucide-react'

export function TopNav() {
  const { exportReady, mesh } = useGeometryStore()
  const { imageContext } = useAppStore()

  const handleExport = () => {
    if (!mesh || !exportReady) return
    exportSTL(mesh, imageContext.fileNameBase)
  }

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        height: '56px',
        background: '#0d0d0d',
        borderBottom: '1px solid #1e1e1e',
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <img
          src={logoSvg}
          alt="NomaDough"
          style={{
            height: '28px',
            filter: 'invert(1) brightness(10)',
          }}
        />
        <span
          style={{
            color: '#00ff00',
            fontWeight: 600,
            fontSize: '15px',
            letterSpacing: '0.5px',
          }}
        >
          NomaDough
        </span>
      </div>

      {/* Title */}
      <span
        style={{
          color: '#555',
          fontSize: '12px',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
        }}
      >
        3D Cookie Cutter Generator
      </span>

      {/* Export button */}
      <button
        onClick={handleExport}
        disabled={!exportReady}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          background: exportReady ? '#00ff00' : '#1a1a1a',
          color: exportReady ? '#000' : '#444',
          border: `1px solid ${exportReady ? '#00ff00' : '#333'}`,
          borderRadius: '6px',
          cursor: exportReady ? 'pointer' : 'not-allowed',
          fontSize: '13px',
          fontWeight: 600,
          transition: 'all 0.2s',
          letterSpacing: '0.3px',
        }}
      >
        <Download size={14} />
        Eksportuj STL
      </button>
    </header>
  )
}
