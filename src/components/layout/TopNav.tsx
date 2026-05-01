import { useStore } from '../../store/useStore'
import { exportSTL } from '../../utils/geometry'
import { Download } from 'lucide-react'

// Inline SVG logo inspired by nd-logo-transparent.svg — white text, bright green dot
function NomaDirLogo() {
  return (
    <svg viewBox="0 0 240 44" height="22" aria-label="NomaDough by NomaDirection" style={{ display:'block', flexShrink:0 }}>
      <text x="0" y="32" fontFamily="system-ui,'Segoe UI',sans-serif" fontSize="30" fill="#ffffff" letterSpacing="-0.5">
        <tspan fontWeight="300">Noma</tspan><tspan fontWeight="700" fill="#00ff00">Dough</tspan>
      </text>
      <circle cx="232" cy="26" r="5" fill="#00ff00" />
    </svg>
  )
}

export function TopNav() {
  const { phase, geometry, fileNameBase } = useStore()
  const canExport = phase === 'ready' && geometry != null

  const handleExport = () => {
    if (!geometry) return
    exportSTL(geometry, fileNameBase)
  }

  return (
    <header style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'0 20px', height:'52px', flexShrink:0,
      background:'#0c0c0c', borderBottom:'1px solid #181818',
    }}>
      {/* Brand */}
      <a
        href="https://nomadirection.pl"
        target="_blank"
        rel="noopener noreferrer"
        style={{ display:'flex', alignItems:'center', gap:'10px', textDecoration:'none' }}
      >
        <NomaDirLogo />
        <span style={{ color:'#2a2a2a', fontSize:'10px', letterSpacing:'1.5px', textTransform:'uppercase', marginTop:'1px' }}>
          by NomaDirection
        </span>
      </a>

      {/* Sub-title */}
      <span style={{ color:'#252525', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase' }}>
        3D Cookie Cutter Generator
      </span>

      {/* Export */}
      <button
        onClick={handleExport}
        disabled={!canExport}
        style={{
          display:'flex', alignItems:'center', gap:'7px',
          padding:'7px 18px',
          background: canExport ? '#00ff00' : '#101010',
          color: canExport ? '#000' : '#2a2a2a',
          border:`1px solid ${canExport ? '#00ff00' : '#1a1a1a'}`,
          borderRadius:'6px',
          fontSize:'12px', fontWeight:700, letterSpacing:'0.4px',
          cursor: canExport ? 'pointer' : 'not-allowed',
          transition:'all .2s',
          boxShadow: canExport ? '0 0 14px #00ff0044' : 'none',
          animation: canExport ? 'glow 2.5s ease-in-out infinite' : 'none',
        }}
      >
        <Download size={13} />
        Eksportuj STL
      </button>
    </header>
  )
}
