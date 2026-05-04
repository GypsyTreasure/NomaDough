export function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid #2a2a2a',
        padding: '12px 20px',
        textAlign: 'center',
        flexShrink: 0,
        background: '#0f0f0f',
      }}
    >
      <span style={{ color: '#888888', fontSize: '12px' }}>
        Powered by{' '}
        <a
          href="https://nomadirection.pl"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#7EC845', textDecoration: 'none' }}
        >
          NomaDirection
        </a>
        {' '}— Manufacturing Consulting & Digital Tools
      </span>
    </footer>
  );
}
