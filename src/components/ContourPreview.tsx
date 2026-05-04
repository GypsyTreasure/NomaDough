import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';

export function ContourPreview() {
  const contourResult = useAppStore((s) => s.contourResult);
  const imageUrl = useAppStore((s) => s.imageUrl);
  const processingState = useAppStore((s) => s.processingState);
  const processingError = useAppStore((s) => s.processingError);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Scale to fit container (max 400px wide)
      const maxW = canvas.parentElement?.clientWidth ?? 400;
      const scale = Math.min(maxW / img.width, 300 / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw image at 60% opacity
      ctx.globalAlpha = 0.6;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1.0;

      if (contourResult && contourResult.pixelPoints.length > 2) {
        const scaleX = canvas.width / contourResult.imageWidth;
        const scaleY = canvas.height / contourResult.imageHeight;

        // Draw contour
        ctx.beginPath();
        const pts = contourResult.pixelPoints;
        ctx.moveTo(pts[0].x * scaleX, pts[0].y * scaleY);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x * scaleX, pts[i].y * scaleY);
        }
        ctx.closePath();
        ctx.strokeStyle = '#7EC845';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Fill with very low opacity
        ctx.fillStyle = 'rgba(126, 200, 69, 0.08)';
        ctx.fill();

      } else if (processingError) {
        // Red dashed overlay on error
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
        ctx.setLineDash([]);
      }
    };
    img.src = imageUrl;
  }, [imageUrl, contourResult, processingError]);

  if (!imageUrl) return null;

  const mmPoints = contourResult?.points ?? [];
  const xs = mmPoints.map((p) => p.x);
  const ys = mmPoints.map((p) => p.y);
  const wMm = mmPoints.length > 0 ? Math.round(Math.max(...xs) - Math.min(...xs)) : null;
  const hMm = mmPoints.length > 0 ? Math.round(Math.max(...ys) - Math.min(...ys)) : null;

  return (
    <div>
      <label style={{ display: 'block', color: '#888888', fontSize: '11px', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '8px' }}>
        Contour Preview
      </label>

      <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid #2a2a2a', background: '#111111' }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />

        {processingState === 'processing' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
          }}>
            <div style={{ color: '#7EC845', fontSize: '12px' }}>Processing…</div>
          </div>
        )}
      </div>

      {contourResult && (
        <div style={{ color: '#888888', fontSize: '11px', marginTop: '6px', fontFamily: 'monospace' }}>
          {contourResult.pixelPoints.length} points detected
          {wMm !== null && hMm !== null && ` | Shape: ~${wMm}×${hMm} mm`}
        </div>
      )}

      {processingError && (
        <div style={{
          color: '#ff4444', fontSize: '11px', marginTop: '6px', padding: '8px',
          background: '#1a0000', borderRadius: '4px', border: '1px solid #440000',
        }}>
          {processingError}
        </div>
      )}
    </div>
  );
}
