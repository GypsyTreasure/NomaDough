export function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid #1A3558',
      padding: '10px 20px',
      textAlign: 'center',
      flexShrink: 0,
      background: '#0D1B2A',
    }}>
      <span style={{ color: '#7A9BB8', fontSize: '12px' }}>
        Powered by{' '}
        <a
          href="https://nomadirection.pl"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#22C59A', textDecoration: 'none' }}
        >
          NomaDirection
        </a>
        {' '}— Manufacturing Consulting & Digital Tools
      </span>
    </footer>
  );
}
