export function TopNav() {
  return (
    <nav style={{
      height: '52px',
      background: '#0D1B2A',
      borderBottom: '1px solid #1A3558',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      flexShrink: 0,
      gap: '14px',
    }}>
      {/* NomaDirection logo — rendered inline, no background rect */}
      <a
        href="https://nomadirection.pl"
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', lineHeight: 1 }}
      >
        <svg viewBox="0 0 282 56" height="28" aria-label="NomaDirection" style={{ display: 'block' }}>
          <text
            x="0" y="42"
            fontFamily="'Barlow', Arial, sans-serif"
            fontSize="38"
            letterSpacing="-0.5"
          >
            <tspan fontWeight="300" fill="#FFFFFF">Noma</tspan>
            <tspan fontWeight="500" fill="#FFFFFF">Direction</tspan>
          </text>
          <circle cx="268" cy="37" r="6" fill="#1A6B5A" />
        </svg>
      </a>

      <span style={{ color: '#1A3558', fontSize: '20px', fontWeight: 300 }}>|</span>

      <span style={{ color: '#22C59A', fontWeight: 600, fontSize: '16px', letterSpacing: '0.5px', fontFamily: "'Barlow', sans-serif" }}>
        NomaDough
      </span>

      <span style={{ color: '#7A9BB8', fontSize: '13px', fontWeight: 300 }}>
        3D Cookie Cutter Generator
      </span>

      <div style={{ marginLeft: 'auto' }}>
        <a
          href="https://nomadirection.pl"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#1A3558', fontSize: '12px', textDecoration: 'none', letterSpacing: '0.5px', transition: 'color 0.15s' }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.color = '#22C59A'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#1A3558'; }}
        >
          nomadirection.pl
        </a>
      </div>
    </nav>
  );
}
