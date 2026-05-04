import { useAppStore } from '../store/useAppStore';

export function ProfileDiagram() {
  const { a, b, c } = useAppStore((s) => s.settings.cutterProfile);

  const svgW = 200;
  const svgH = 140;
  const padX = 40;
  const padY = 20;
  const drawW = svgW - padX * 2;
  const drawH = svgH - padY * 2 - 16;

  const scale = drawW / Math.max(b * 2, 1);
  const scaledB = b * scale;
  const scaledA = Math.max(a * scale, 2);
  const scaledC = Math.min(c * scale * 1.5, drawH);

  const cx = svgW / 2;
  const baseY = padY + drawH;
  const topY = baseY - scaledC;

  const pts = [
    [cx - scaledB / 2, baseY],
    [cx + scaledB / 2, baseY],
    [cx + scaledA / 2, topY],
    [cx - scaledA / 2, topY],
  ].map((p) => p.join(',')).join(' ');

  return (
    <div>
      <label style={{ display: 'block', color: '#7A9BB8', fontSize: '11px', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '8px' }}>
        Wall Profile
      </label>
      <div style={{ background: '#0F2035', borderRadius: '8px', border: '1px solid #1A3558', padding: '8px' }}>
        <svg width={svgW} height={svgH} style={{ display: 'block', margin: '0 auto' }}>
          <polygon points={pts} fill="rgba(34,197,154,0.08)" stroke="#22C59A" strokeWidth="1.5" />

          {/* A — cutting edge */}
          <line x1={cx - scaledA / 2} y1={topY - 6} x2={cx + scaledA / 2} y2={topY - 6} stroke="#22C59A" strokeWidth="1" />
          <text x={cx} y={topY - 9} textAnchor="middle" fill="#22C59A" fontSize="9" fontFamily="monospace">
            A = {a.toFixed(2)} mm
          </text>
          <text x={cx} y={topY - 20} textAnchor="middle" fill="#1A3558" fontSize="8" fontFamily="Barlow, sans-serif">
            cutting edge ↑
          </text>

          {/* B — base */}
          <line x1={cx - scaledB / 2} y1={baseY + 8} x2={cx + scaledB / 2} y2={baseY + 8} stroke="#7A9BB8" strokeWidth="1" />
          <text x={cx} y={baseY + 18} textAnchor="middle" fill="#7A9BB8" fontSize="9" fontFamily="monospace">
            B = {b.toFixed(1)} mm
          </text>

          {/* C — height */}
          <line x1={cx + scaledB / 2 + 6} y1={topY} x2={cx + scaledB / 2 + 6} y2={baseY} stroke="#7A9BB8" strokeWidth="1" />
          <text x={cx + scaledB / 2 + 14} y={(topY + baseY) / 2 + 3} textAnchor="start" fill="#7A9BB8" fontSize="9" fontFamily="monospace">
            C={c.toFixed(0)}
          </text>
        </svg>
      </div>
    </div>
  );
}
