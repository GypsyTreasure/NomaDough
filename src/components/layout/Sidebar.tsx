import { useStore } from '../../store/useStore'
import { ImageUpload } from '../forms/ImageUpload'
import { SettingsPanel } from '../forms/SettingsPanel'
import { Loader2 } from 'lucide-react'

function PhaseIndicator() {
  const { phase, cvProgress } = useStore()

  if (phase === 'cv-loading') return (
    <div style={{
      padding:'10px 12px', background:'#0d0d0d',
      border:'1px solid #151515', borderRadius:'6px',
      display:'flex', flexDirection:'column', gap:'8px',
      animation:'fadeIn .2s ease',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        <Loader2 size={13} color="#00ff00" style={{ animation:'spin .9s linear infinite' }} />
        <span style={{ color:'#555', fontSize:'11px' }}>Extracting contours…</span>
      </div>
      <div style={{ height:'2px', background:'#1a1a1a', borderRadius:'1px', overflow:'hidden' }}>
        <div style={{
          height:'100%', width:`${cvProgress}%`,
          background:'linear-gradient(90deg,#006600,#00ff00)',
          transition:'width .3s ease', boxShadow:'0 0 6px #00ff00',
        }} />
      </div>
      <span style={{ color:'#2a2a2a', fontSize:'10px' }}>
        Loading OpenCV.js from CDN — requires internet
      </span>
    </div>
  )

  if (phase === 'geo-loading') return (
    <div style={{
      padding:'10px 12px', background:'#0d0d0d',
      border:'1px solid #151515', borderRadius:'6px',
      display:'flex', alignItems:'center', gap:'8px',
    }}>
      <Loader2 size={13} color="#00ff00" style={{ animation:'spin .9s linear infinite' }} />
      <span style={{ color:'#555', fontSize:'11px' }}>Generating 3D mesh…</span>
    </div>
  )

  return null
}

export function Sidebar() {
  return (
    <aside style={{
      width:'296px', minWidth:'296px', flexShrink:0,
      background:'#0c0c0c', borderRight:'1px solid #161616',
      display:'flex', flexDirection:'column', overflow:'hidden',
    }}>
      <div style={{
        flex:1, overflowY:'auto', padding:'16px',
        display:'flex', flexDirection:'column', gap:'16px',
      }}>
        <ImageUpload />
        <PhaseIndicator />
        <div style={{ height:'1px', background:'#141414' }} />
        <SettingsPanel />
      </div>

      {/* Footer */}
      <div style={{
        padding:'10px 16px', borderTop:'1px solid #131313', flexShrink:0,
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <a
          href="https://nomadirection.pl"
          target="_blank" rel="noopener noreferrer"
          style={{ color:'#252525', fontSize:'10px', textDecoration:'none', letterSpacing:'.5px' }}
          onMouseEnter={e => { (e.target as HTMLElement).style.color='#00ff00' }}
          onMouseLeave={e => { (e.target as HTMLElement).style.color='#252525' }}
        >
          nomadirection.pl
        </a>
        <span style={{ color:'#1c1c1c', fontSize:'9px', letterSpacing:'1px' }}>
          NomaDough v2
        </span>
      </div>
    </aside>
  )
}
