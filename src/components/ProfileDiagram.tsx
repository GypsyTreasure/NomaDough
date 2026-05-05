import { useAppStore } from '../store/useAppStore';

export function ProfileDiagram() {
  const { a, b, c } = useAppStore((s) => s.settings.cutterProfile);

  // Fixed layout — B (wide) at bottom, A (narrow) at top, C = height on right
  // A and B are horizontal lines parallel to the dough surface
  // C is vertical, perpendicular to A and B
  // Loop dot sits at the center of the A line (top)

  const W = 200;
  const H = 160;

  // Drawing area
  const left   = 14;
  const right  = W - 44;  // leaves room for C bracket
  const top    = 32;       // leaves room for "loop" label above A
  const bottom = H - 22;  // leaves room for B label below

  const drawW = right - left;
  const drawH = bottom - top;
  const cx = left + drawW / 2;

  // Uniform scale: maintain true A/B/C proportions — tallest/widest dimension fills its axis
  const scale = Math.min(drawH / Math.max(c, 1), drawW / Math.max(b, 0.1));

  const halfB = (b * scale) / 2;
  const halfA = Math.max((a * scale) / 2, 1.5);  // minimum 1.5px so A is always visible
  const scaledC = c * scale;

  // Vertex positions (SVG: y increases downward, so bottom = larger y)
  const topY    = bottom - scaledC;   // A edge (cutting edge) — top of shape
  const bottomY = bottom;             // B edge (base) — sits on dough

  const bL = cx - halfB;  const bR = cx + halfB;   // B corners
  const aL = cx - halfA;  const aR = cx + halfA;   // A corners

  const pts = `${bL},${bottomY} ${bR},${bottomY} ${aR},${topY} ${aL},${topY}`;

  const bracketX = right + 10;

  return (
    <div>
      <label style={{ display: 'block', color: '#7A9BB8', fontSize: '11px', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '8px' }}>
        Wall Profile
      </label>
      <div style={{ background: '#0F2035', borderRadius: '8px', border: '1px solid #1A3558', padding: '6px' }}>
        <svg width={W} height={H} style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}>

          {/* Trapezoid body */}
          <polygon points={pts} fill="rgba(34,197,154,0.10)" stroke="#22C59A" strokeWidth="1.5" />

          {/* ── Loop marker: dot + label above A edge ── */}
          <circle cx={cx} cy={topY} r={4} fill="#22C59A" />
          <line x1={cx} y1={topY - 5} x2={cx} y2={topY - 15}
            stroke="#22C59A" strokeWidth="1" strokeDasharray="2,2" />
          <text x={cx} y={topY - 18} textAnchor="middle"
            fill="#22C59A" fontSize="9" fontFamily="Barlow, sans-serif" letterSpacing="0.5">
            loop
          </text>

          {/* ── A label (left side, at A edge height) ── */}
          <text x={aL - 4} y={topY + 4} textAnchor="end"
            fill="#22C59A" fontSize="9" fontFamily="monospace">
            A={a.toFixed(2)}
          </text>

          {/* ── B dimension line below base ── */}
          <line x1={bL} y1={bottomY + 7} x2={bR} y2={bottomY + 7} stroke="#7A9BB8" strokeWidth="1" />
          <line x1={bL} y1={bottomY + 4} x2={bL} y2={bottomY + 10} stroke="#7A9BB8" strokeWidth="1" />
          <line x1={bR} y1={bottomY + 4} x2={bR} y2={bottomY + 10} stroke="#7A9BB8" strokeWidth="1" />
          <text x={cx} y={bottomY + 20} textAnchor="middle"
            fill="#7A9BB8" fontSize="9" fontFamily="monospace">
            B={b.toFixed(1)} mm
          </text>

          {/* ── Dough surface dashed line at base ── */}
          <line x1={left - 4} y1={bottomY + 1} x2={right + 2} y2={bottomY + 1}
            stroke="#1A3558" strokeWidth="1" strokeDasharray="4,3" />

          {/* ── C bracket on right side ── */}
          <line x1={bracketX} y1={topY} x2={bracketX} y2={bottomY} stroke="#7A9BB8" strokeWidth="1" />
          <line x1={bracketX - 3} y1={topY}    x2={bracketX + 3} y2={topY}    stroke="#7A9BB8" strokeWidth="1" />
          <line x1={bracketX - 3} y1={bottomY} x2={bracketX + 3} y2={bottomY} stroke="#7A9BB8" strokeWidth="1" />
          <text x={bracketX + 6} y={(topY + bottomY) / 2 + 4} textAnchor="start"
            fill="#7A9BB8" fontSize="9" fontFamily="monospace">
            C={c.toFixed(0)}
          </text>

        </svg>
      </div>
    </div>
  );
}
