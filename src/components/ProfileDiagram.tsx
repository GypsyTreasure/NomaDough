import { useAppStore } from '../store/useAppStore';

export function ProfileDiagram() {
  const { a, b, c } = useAppStore((s) => s.settings.cutterProfile);

  // SVG canvas dimensions
  const svgW = 200;
  const svgH = 140;
  const padX = 40;
  const padY = 20;

  const drawW = svgW - padX * 2;
  const drawH = svgH - padY * 2 - 16; // leave room for bottom label

  // Scale to fit diagram area — b is widest element
  const scale = drawW / Math.max(b * 2, 1);
  const scaledB = b * scale;
  const scaledA = a * scale;
  const scaledC = Math.min(c * scale * 1.5, drawH); // height scaling

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
      <label style={{ display: 'block', color: '#888888', fontSize: '11px', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '8px' }}>
        Wall Profile (cross-section)
      </label>
      <div style={{ background: '#111111', borderRadius: '8px', border: '1px solid #2a2a2a', padding: '8px' }}>
        <svg width={svgW} height={svgH} style={{ display: 'block', margin: '0 auto' }}>
          {/* Trapezoid */}
          <polygon points={pts} fill="rgba(126,200,69,0.08)" stroke="#7EC845" strokeWidth="1.5" />

          {/* A label — top edge */}
          <line x1={cx - scaledA / 2} y1={topY - 6} x2={cx + scaledA / 2} y2={topY - 6} stroke="#7EC845" strokeWidth="1" />
          <text x={cx} y={topY - 9} textAnchor="middle" fill="#7EC845" fontSize="9" fontFamily="monospace">
            A = {a.toFixed(2)} mm
          </text>

          {/* B label — bottom edge */}
          <line x1={cx - scaledB / 2} y1={baseY + 8} x2={cx + scaledB / 2} y2={baseY + 8} stroke="#888888" strokeWidth="1" />
          <text x={cx} y={baseY + 18} textAnchor="middle" fill="#888888" fontSize="9" fontFamily="monospace">
            B = {b.toFixed(1)} mm
          </text>

          {/* C label — height */}
          <line x1={cx + scaledB / 2 + 6} y1={topY} x2={cx + scaledB / 2 + 6} y2={baseY} stroke="#888888" strokeWidth="1" />
          <text x={cx + scaledB / 2 + 14} y={(topY + baseY) / 2 + 3} textAnchor="start" fill="#888888" fontSize="9" fontFamily="monospace">
            C = {c.toFixed(0)} mm
          </text>

          {/* Cutting edge label */}
          <text x={cx} y={topY - 20} textAnchor="middle" fill="#444444" fontSize="8" fontFamily="Inter, sans-serif">
            cutting edge ↑
          </text>

          {/* Base label */}
          <text x={cx - scaledB / 2 - 4} y={baseY + 3} textAnchor="end" fill="#444444" fontSize="8" fontFamily="Inter, sans-serif">
            base →
          </text>
        </svg>
      </div>
    </div>
  );
}
