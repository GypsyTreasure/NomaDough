import logoSvg from '../../assets/logo.svg';

export function TopNav() {
  return (
    <nav
      style={{
        height: '52px',
        background: '#0f0f0f',
        borderBottom: '1px solid #2a2a2a',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        flexShrink: 0,
        gap: '12px',
      }}
    >
      <a
        href="https://nomadirection.pl"
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}
      >
        <img
          src={logoSvg}
          alt="NomaDough"
          style={{ height: '28px', filter: 'invert(1)' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <span style={{ color: '#7EC845', fontWeight: 700, fontSize: '18px', letterSpacing: '0.5px' }}>
          NomaDough
        </span>
      </a>

      <span style={{ color: '#2a2a2a', fontSize: '20px', fontWeight: 300 }}>|</span>

      <span style={{ color: '#888888', fontSize: '13px' }}>
        3D Cookie Cutter Generator
      </span>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <a
          href="https://nomadirection.pl"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#444444', fontSize: '12px', textDecoration: 'none', letterSpacing: '0.5px' }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.color = '#7EC845'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#444444'; }}
        >
          NomaDirection.pl
        </a>
      </div>
    </nav>
  );
}
