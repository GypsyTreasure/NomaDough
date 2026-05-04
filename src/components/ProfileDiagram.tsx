import { useAppStore } from '../store/useAppStore';

export function ProfileDiagram() {
  const { a, b, c } = useAppStore((s) => s.settings.cutterProfile);

  // Vertical orientation matching the sketch:
  // A (cutting edge, narrow) at TOP — loop/path passes through its center
  // B (base, wide) at BOTTOM — sits on dough
  // C = height (bracket on right side)
  const svgW = 210;
  const svgH = 150;
  const padLeft = 16;
  const padRight = 52;  // C bracket + label
  const padTop = 30;    // "loop" label above A
  const padBottom = 26; // B label below

  const drawW = svgW - padLeft - padRight;
  const drawH = svgH - padTop - padBottom;

  // Scale: B is the widest element horizontally, C is the full height
  const scaleX = drawW / Math.max(b, 1);
  const scaleY = Math.min(drawH / Math.max(c, 1), scaleX * 3);
  const scaledB = b * scaleX;
  const scaledA = Math.max(a * scaleX, 2);
  const scaledC = c * scaleY;

  const cx = padLeft + drawW / 2;
  const baseY = padTop + Math.min(scaledC, drawH);
  const topY = baseY - scaledC;

  const pts = [
    [cx - scaledB / 2, baseY],
    [cx + scaledB / 2, baseY],
    [cx + scaledA / 2, topY],
    [cx - scaledA / 2, topY],
  ].map((p) => p.join(',')).join(' ');

  const rightEdge = cx + scaledB / 2;
  const cBracketX = rightEdge + 10;

  return (
    <div>
      <label style={{ display: 'block', color: '#7A9BB8', fontSize: '11px', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '8px' }}>
        Wall Profile
      </label>
      <div style={{ background: '#0F2035', borderRadius: '8px', border: '1px solid #1A3558', padding: '8px' }}>
        <svg width={svgW} height={svgH} style={{ display: 'block', margin: '0 auto' }}>

          {/* Trapezoid */}
          <polygon points={pts} fill="rgba(34,197,154,0.08)" stroke="#22C59A" strokeWidth="1.5" />

          {/* Loop marker at center of A (top edge) */}
          <circle cx={cx} cy={topY} r={3.5} fill="#22C59A" />
          {/* loop label above */}
          <line x1={cx} y1={topY - 4} x2={cx} y2={topY - 14} stroke="#22C59A" strokeWidth="1" strokeDasharray="2,2" />
          <text x={cx} y={topY - 16} textAnchor="middle" fill="#22C59A" fontSize="8" fontFamily="Barlow, sans-serif" letterSpacing="0.5">
            loop
          </text>

          {/* A label — top edge */}
          <line x1={cx - scaledA / 2 - 2} y1={topY} x2={cx + scaledA / 2 + 2} y2={topY} stroke="#22C59A" strokeWidth="1" strokeDasharray="2,2" opacity="0.4"/>
          <text x={cx - scaledB / 2 - 4} y={topY + 3} textAnchor="end" fill="#22C59A" fontSize="9" fontFamily="monospace">
            A={a.toFixed(2)}
          </text>

          {/* B label — bottom edge */}
          <line x1={cx - scaledB / 2} y1={baseY + 7} x2={cx + scaledB / 2} y2={baseY + 7} stroke="#7A9BB8" strokeWidth="1" />
          <line x1={cx - scaledB / 2} y1={baseY + 4} x2={cx - scaledB / 2} y2={baseY + 10} stroke="#7A9BB8" strokeWidth="1" />
          <line x1={cx + scaledB / 2} y1={baseY + 4} x2={cx + scaledB / 2} y2={baseY + 10} stroke="#7A9BB8" strokeWidth="1" />
          <text x={cx} y={baseY + 20} textAnchor="middle" fill="#7A9BB8" fontSize="9" fontFamily="monospace">
            B={b.toFixed(1)} mm
          </text>

          {/* C bracket — right side height */}
          <line x1={cBracketX} y1={topY} x2={cBracketX} y2={baseY} stroke="#7A9BB8" strokeWidth="1" />
          <line x1={cBracketX - 3} y1={topY} x2={cBracketX + 3} y2={topY} stroke="#7A9BB8" strokeWidth="1" />
          <line x1={cBracketX - 3} y1={baseY} x2={cBracketX + 3} y2={baseY} stroke="#7A9BB8" strokeWidth="1" />
          <text x={cBracketX + 6} y={(topY + baseY) / 2 + 4} textAnchor="start" fill="#7A9BB8" fontSize="9" fontFamily="monospace">
            C={c.toFixed(0)}
          </text>

          {/* dough surface line at bottom */}
          <line x1={padLeft} y1={baseY + 1} x2={cx + scaledB / 2 + 4} y2={baseY + 1} stroke="#1A3558" strokeWidth="1" strokeDasharray="3,3" />
          <text x={padLeft} y={baseY - 3} textAnchor="start" fill="#1A3558" fontSize="7" fontFamily="Barlow, sans-serif">
            dough
          </text>

        </svg>
      </div>
    </div>
  );
}
