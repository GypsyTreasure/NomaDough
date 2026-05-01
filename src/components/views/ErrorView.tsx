import { useStore } from '../../store/useStore'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export function ErrorView() {
  const { errorMessage, reset } = useStore()

  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      background:'#080808', gap:'20px', padding:'40px',
      animation:'fadeIn .25s ease',
    }}>
      <AlertTriangle size={36} color="#ff4444" opacity={0.7} />

      <div style={{ textAlign:'center', maxWidth:'480px', display:'flex', flexDirection:'column', gap:'10px' }}>
        <p style={{ color:'#cc3333', fontSize:'14px', fontWeight:600 }}>
          Could not generate the model
        </p>
        <pre style={{
          color:'#663333', fontSize:'11px', lineHeight:1.7,
          background:'#0e0808', border:'1px solid #2a1111',
          borderRadius:'6px', padding:'12px 16px',
          textAlign:'left', whiteSpace:'pre-wrap', fontFamily:'inherit',
        }}>
          {errorMessage}
        </pre>
      </div>

      <button
        onClick={reset}
        style={{
          display:'flex', alignItems:'center', gap:'8px',
          padding:'9px 20px',
          background:'transparent', border:'1px solid #331111',
          borderRadius:'6px', color:'#663333',
          fontSize:'12px', fontWeight:600, cursor:'pointer',
          transition:'all .15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor='#ff4444'; e.currentTarget.style.color='#ff4444' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor='#331111'; e.currentTarget.style.color='#663333' }}
      >
        <RotateCcw size={13} /> Start over
      </button>
    </div>
  )
}
