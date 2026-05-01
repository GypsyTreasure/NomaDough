export function EmptyView() {
  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      background:'#080808', gap:'18px', userSelect:'none',
    }}>
      {/* Minimal cookie cutter icon */}
      <svg width="90" height="90" viewBox="0 0 90 90" fill="none" opacity={0.18}>
        <circle cx="45" cy="45" r="30" stroke="#00ff00" strokeWidth="1.5" strokeDasharray="5 3" />
        <path d="M45 18 L55 35 L72 35 L59 46 L64 63 L45 53 L26 63 L31 46 L18 35 L35 35 Z"
          stroke="#00ff00" strokeWidth="1" fill="rgba(0,255,0,.05)" />
        <circle cx="45" cy="45" r="3" fill="#00ff00" />
      </svg>

      <div style={{ textAlign:'center', display:'flex', flexDirection:'column', gap:'6px' }}>
        <p style={{ color:'#282828', fontSize:'14px', fontWeight:500 }}>
          Upload a sketch to start
        </p>
        <p style={{ color:'#1c1c1c', fontSize:'11px', lineHeight:1.6 }}>
          Draw your cookie shape on paper, photograph it,<br />
          and upload — the app will extract the outline<br />
          and generate a printable 3D cookie cutter.
        </p>
      </div>
    </div>
  )
}
