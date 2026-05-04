import { useAppStore } from '../store/useAppStore';

export function ProfileDiagram() {
  const { a, b, c } = useAppStore((s) => s.settings.cutterProfile);

  // Rotated 90°: C is now horizontal (wall depth), B is left side (base, wide),
  // A is right side (cutting edge, narrow). Trapezoid lies on its side.
  const svgW = 220;
  const svgH = 110;
  const padLeft = 44;   // room for B label
  const padRight = 50;  // room for A label + "cutting edge"
  const padTop = 22;    // room for C arrow
  const padBottom = 14;

  const drawW = svgW - padLeft - padRight;
  const drawH = svgH - padTop - padBottom;
  const cy = padTop + drawH / 2;

  // Scale so both C (horizontal) and B (vertical) fit — keep same scale factor
  const scale = Math.min(drawW / Math.max(c, 1), drawH / Math.max(b, 1));
  const scaledC = c * scale;
  const scaledB = b * scale;
  const scaledA = Math.max(a * scale, 2);

  const leftX = padLeft;
  const rightX = leftX + scaledC;

  // Four corners of the trapezoid
  const blX = leftX;  const blY = cy + scaledB / 2;  // base-left bottom
  const tlX = leftX;  const tlY = cy - scaledB / 2;  // base-left top
  const trX = rightX; const trY = cy - scaledA / 2;  // cutting-edge top
  const brX = rightX; const brY = cy + scaledA / 2;  // cutting-edge bottom

  const pts = `${blX},${blY} ${tlX},${tlY} ${trX},${trY} ${brX},${brY}`;

  return (
    <div>
      <label style={{ display: 'block', color: '#7A9BB8', fontSize: '11px', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '8px' }}>
        Wall Profile
      </label>
      <div style={{ background: '#0F2035', borderRadius: '8px', border: '1px solid #1A3558', padding: '8px' }}>
        <svg width={svgW} height={svgH} style={{ display: 'block', margin: '0 auto' }}>
          <polygon points={pts} fill="rgba(34,197,154,0.08)" stroke="#22C59A" strokeWidth="1.5" />

          {/* B — left side (base) */}
          <line x1={leftX - 7} y1={blY} x2={leftX - 7} y2={tlY} stroke="#7A9BB8" strokeWidth="1" />
          <line x1={leftX - 10} y1={blY} x2={leftX - 4} y2={blY} stroke="#7A9BB8" strokeWidth="1" />
          <line x1={leftX - 10} y1={tlY} x2={leftX - 4} y2={tlY} stroke="#7A9BB8" strokeWidth="1" />
          <text x={leftX - 12} y={cy + 4} textAnchor="end" fill="#7A9BB8" fontSize="9" fontFamily="monospace">
            B={b.toFixed(1)}
          </text>

          {/* A — right side (cutting edge) */}
          <line x1={rightX + 7} y1={brY} x2={rightX + 7} y2={trY} stroke="#22C59A" strokeWidth="1" />
          <line x1={rightX + 4} y1={brY} x2={rightX + 10} y2={brY} stroke="#22C59A" strokeWidth="1" />
          <line x1={rightX + 4} y1={trY} x2={rightX + 10} y2={trY} stroke="#22C59A" strokeWidth="1" />
          <text x={rightX + 13} y={cy + 1} textAnchor="start" fill="#22C59A" fontSize="9" fontFamily="monospace">
            A={a.toFixed(2)}
          </text>
          <text x={rightX + 13} y={cy + 11} textAnchor="start" fill="#1A6B5A" fontSize="8" fontFamily="Barlow, sans-serif">
            edge
          </text>

          {/* C — horizontal span (wall height) */}
          <line x1={leftX} y1={padTop - 6} x2={rightX} y2={padTop - 6} stroke="#7A9BB8" strokeWidth="1" />
          <line x1={leftX} y1={padTop - 9} x2={leftX} y2={padTop - 3} stroke="#7A9BB8" strokeWidth="1" />
          <line x1={rightX} y1={padTop - 9} x2={rightX} y2={padTop - 3} stroke="#7A9BB8" strokeWidth="1" />
          <text x={(leftX + rightX) / 2} y={padTop - 9} textAnchor="middle" fill="#7A9BB8" fontSize="9" fontFamily="monospace">
            C={c.toFixed(0)} mm
          </text>

          {/* Direction labels */}
          <text x={leftX - 2} y={svgH - 3} textAnchor="middle" fill="#1A3558" fontSize="8" fontFamily="Barlow, sans-serif">
            dough
          </text>
        </svg>
      </div>
    </div>
  );
}
