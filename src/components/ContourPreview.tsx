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
      const maxW = canvas.parentElement?.clientWidth ?? 400;
      const scale = Math.min(maxW / img.width, 300 / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 0.55;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1.0;

      if (contourResult && contourResult.pixelPoints.length > 2) {
        const scaleX = canvas.width / contourResult.imageWidth;
        const scaleY = canvas.height / contourResult.imageHeight;
        const pts = contourResult.pixelPoints;

        ctx.beginPath();
        ctx.moveTo(pts[0].x * scaleX, pts[0].y * scaleY);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x * scaleX, pts[i].y * scaleY);
        }
        ctx.closePath();
        ctx.strokeStyle = '#22C59A';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(34, 197, 154, 0.07)';
        ctx.fill();
      } else if (processingError) {
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#E05050';
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
      <label style={{ display: 'block', color: '#7A9BB8', fontSize: '11px', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '8px' }}>
        Contour Preview
      </label>

      <div style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', border: '1px solid #1A3558', background: '#0F2035' }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: 'auto' }} />

        {processingState === 'processing' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(13,27,42,0.75)',
          }}>
            <span style={{ color: '#22C59A', fontSize: '12px', fontFamily: "'Barlow', sans-serif" }}>Processing…</span>
          </div>
        )}
      </div>

      {contourResult && (
        <div style={{ color: '#7A9BB8', fontSize: '11px', marginTop: '6px', fontFamily: 'monospace' }}>
          {contourResult.pixelPoints.length} pts
          {wMm !== null && hMm !== null && ` · ~${wMm}×${hMm} mm`}
        </div>
      )}

      {processingError && (
        <div style={{
          color: '#E05050', fontSize: '11px', marginTop: '6px', padding: '8px',
          background: '#1A0F0F', borderRadius: '4px', border: '1px solid #3A1A1A',
        }}>
          {processingError}
        </div>
      )}
    </div>
  );
}
