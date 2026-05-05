import { useCallback, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useGeometryStore } from '../store/useGeometryStore';
import { ImageUpload } from './ImageUpload';
import { ContourPreview } from './ContourPreview';
import { ProfileDiagram } from './ProfileDiagram';
import { generateAllCutterGeometries } from '../utils/geometry';
import { exportAllSTLs, buildExportFilename } from '../utils/exporter';
import { fileToImageData } from '../utils/cv-helpers';
import type { CVWorkerResult, CVWorkerError } from '../types';

const labelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  color: '#7A9BB8',
  fontSize: '12px',
  marginBottom: '4px',
};

const valueStyle: React.CSSProperties = {
  color: '#F0F0F0',
  fontFamily: 'monospace',
  fontSize: '11px',
};

const sectionTitle: React.CSSProperties = {
  color: '#22C59A',
  fontSize: '11px',
  letterSpacing: '1px',
  textTransform: 'uppercase' as const,
  marginBottom: '12px',
  fontWeight: 600,
  fontFamily: "'Barlow', sans-serif",
};

const sectionStyle: React.CSSProperties = {
  marginBottom: '20px',
  paddingBottom: '20px',
  borderBottom: '1px solid #1A3558',
};

export function SettingsPanel() {
  const settings = useAppStore((s) => s.settings);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const imageFile = useAppStore((s) => s.imageFile);
  const imageUrl = useAppStore((s) => s.imageUrl);
  const processingState = useAppStore((s) => s.processingState);
  const contourResult = useAppStore((s) => s.contourResult);
  const setContourResult = useAppStore((s) => s.setContourResult);
  const setProcessingState = useAppStore((s) => s.setProcessingState);

  const geometries = useGeometryStore((s) => s.geometries);
  const setGeometries = useGeometryStore((s) => s.setGeometries);
  const stlBlob = useGeometryStore((s) => s.stlBlob);
  const setStlBlob = useGeometryStore((s) => s.setStlBlob);
  const isGenerating = useGeometryStore((s) => s.isGenerating);
  const setIsGenerating = useGeometryStore((s) => s.setIsGenerating);

  const workerRef = useRef<Worker | null>(null);

  const loopCountAuto = settings.loopCount === 'auto';
  const loopCountValue = typeof settings.loopCount === 'number' ? settings.loopCount : 1;
  const thresholdAuto = settings.threshold === 'auto';

  const handleDetect = useCallback(async () => {
    if (!imageFile) return;
    setProcessingState('processing');

    try {
      const imageData = await fileToImageData(imageFile);

      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }

      const worker = new Worker(new URL('../workers/cv.worker.ts', import.meta.url));
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent<CVWorkerResult | CVWorkerError>) => {
        if (e.data.type === 'CONTOUR_RESULT') {
          setContourResult(e.data.result);
          setProcessingState('done');
        } else {
          setProcessingState('error', e.data.message);
        }
        worker.terminate();
        workerRef.current = null;
      };

      worker.onerror = (e) => {
        setProcessingState('error', e.message ?? 'Worker error.');
        worker.terminate();
        workerRef.current = null;
      };

      worker.postMessage({
        type: 'PROCESS_IMAGE',
        imageData,
        settings: {
          threshold: thresholdAuto ? 'auto' : settings.threshold,
          smoothing: settings.smoothing,
          shapePerfection: settings.shapePerfection,
          targetHeightMm: settings.targetHeightMm,
          loopCount: settings.loopCount,
        },
      });
    } catch (err: any) {
      setProcessingState('error', err.message ?? 'Failed to process image.');
    }
  }, [imageFile, settings, thresholdAuto, setContourResult, setProcessingState]);

  const handleGenerate = useCallback(() => {
    if (!contourResult) return;
    setIsGenerating(true);
    setTimeout(() => {
      try {
        const geos = generateAllCutterGeometries(contourResult, settings.cutterProfile);
        setGeometries(geos);
        setStlBlob(null);
      } catch (err: any) {
        alert('3D generation failed. Try increasing smoothing or re-uploading image.\n\n' + (err.message ?? ''));
      } finally {
        setIsGenerating(false);
      }
    }, 0);
  }, [contourResult, settings.cutterProfile, setGeometries, setStlBlob, setIsGenerating]);

  const handleExport = useCallback(() => {
    if (geometries.length === 0) return;
    const blob = exportAllSTLs(geometries, imageFile);
    setStlBlob(blob);
  }, [geometries, imageFile, setStlBlob]);

  const stlSizeKb = stlBlob ? (stlBlob.size / 1024).toFixed(1) : null;
  const hasGeometry = geometries.length > 0;

  const btnPrimary = (enabled: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '10px',
    borderRadius: '6px',
    border: 'none',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontSize: '13px',
    fontFamily: "'Barlow', sans-serif",
    fontWeight: 600,
    letterSpacing: '0.3px',
    background: enabled ? '#22C59A' : '#0F2A20',
    color: enabled ? '#0D1B2A' : '#1A3558',
    transition: 'all 0.15s',
    marginBottom: '8px',
  });

  const btnOutline = (enabled: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '10px',
    borderRadius: '6px',
    border: `1px solid ${enabled ? '#22C59A' : '#1A3558'}`,
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontSize: '13px',
    fontFamily: "'Barlow', sans-serif",
    fontWeight: 600,
    letterSpacing: '0.3px',
    background: 'transparent',
    color: enabled ? '#22C59A' : '#1A3558',
    transition: 'all 0.15s',
    marginBottom: '8px',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '16px', overflowY: 'auto', height: '100%', gap: '0' }}>

      {/* 1. Image */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>1 · Image Input</div>

        <div style={{ marginBottom: '12px' }}>
          <ImageUpload />
        </div>

        {/* Threshold */}
        <div style={{ marginBottom: '10px' }}>
          <div style={labelStyle}>
            <span>Threshold</span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                onClick={() => updateSettings({ threshold: thresholdAuto ? 128 : 'auto' })}
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: `1px solid ${thresholdAuto ? '#22C59A' : '#1A3558'}`,
                  background: thresholdAuto ? '#0F2A20' : 'transparent',
                  color: thresholdAuto ? '#22C59A' : '#7A9BB8',
                  cursor: 'pointer',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                }}
              >
                Auto (adaptive)
              </button>
              {!thresholdAuto && <span style={valueStyle}>{typeof settings.threshold === 'number' ? settings.threshold : 128}</span>}
            </div>
          </div>
          {!thresholdAuto && (
            <input
              type="range" min={0} max={255} step={1}
              value={typeof settings.threshold === 'number' ? settings.threshold : 128}
              onChange={(e) => updateSettings({ threshold: parseInt(e.target.value) })}
            />
          )}
        </div>

        {/* Target shape height — here because it feeds into Detect Contour */}
        <div style={{ marginBottom: '10px' }}>
          <div style={labelStyle}>
            <span>Target shape height</span>
            <span style={valueStyle}>{settings.targetHeightMm} mm</span>
          </div>
          <input
            type="range" min={8} max={300} step={5}
            value={settings.targetHeightMm}
            onChange={(e) => updateSettings({ targetHeightMm: parseInt(e.target.value) })}
          />
        </div>

        {/* Smoothing */}
        <div style={{ marginBottom: '12px' }}>
          <div style={labelStyle}>
            <span>Smoothing</span>
            <span style={valueStyle}>{settings.smoothing} iter</span>
          </div>
          <input
            type="range" min={0} max={10} step={1}
            value={settings.smoothing}
            onChange={(e) => updateSettings({ smoothing: parseInt(e.target.value) })}
          />
        </div>

        {/* Shape Perfection */}
        <div style={{ marginBottom: '12px' }}>
          <div style={labelStyle}>
            <span>Shape Perfection</span>
            <span style={valueStyle}>{Math.round(settings.shapePerfection * 100)}%</span>
          </div>
          <div style={{ color: '#7A9BB8', fontSize: '10px', marginBottom: '4px', fontFamily: 'monospace' }}>
            0 = organic curves &nbsp;←&nbsp;&nbsp;→&nbsp; 1 = perfect geometry
          </div>
          <input
            type="range" min={0.0} max={1.0} step={0.01}
            value={settings.shapePerfection}
            onChange={(e) => updateSettings({ shapePerfection: parseFloat(e.target.value) })}
          />
        </div>

        {/* Loop Count */}
        <div style={{ marginBottom: '12px' }}>
          <div style={labelStyle}>
            <span>Loop count</span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                onClick={() => updateSettings({ loopCount: loopCountAuto ? loopCountValue : 'auto' })}
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: `1px solid ${loopCountAuto ? '#22C59A' : '#1A3558'}`,
                  background: loopCountAuto ? '#0F2A20' : 'transparent',
                  color: loopCountAuto ? '#22C59A' : '#7A9BB8',
                  cursor: 'pointer',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                }}
              >
                Auto
              </button>
              {!loopCountAuto && (
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={loopCountValue}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(20, parseInt(e.target.value) || 1));
                    updateSettings({ loopCount: v });
                  }}
                  style={{
                    width: '48px',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    border: '1px solid #1A3558',
                    background: '#0D1B2A',
                    color: '#F0F0F0',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    textAlign: 'center',
                  }}
                />
              )}
            </div>
          </div>
          <div style={{ color: '#7A9BB8', fontSize: '10px', marginTop: '2px', fontFamily: 'monospace' }}>
            {loopCountAuto ? 'Auto detects all shapes.' : 'Set manually if auto picks up noise.'}
          </div>
        </div>

        <button
          onClick={handleDetect}
          disabled={!imageFile || processingState === 'processing'}
          style={btnPrimary(!!imageFile && processingState !== 'processing')}
        >
          {processingState === 'processing' ? 'Detecting…' : 'Detect Contour'}
        </button>

        {imageUrl && <ContourPreview />}
      </div>

      {/* 2. Cutter Profile */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>2 · Cutter Profile</div>

        <div style={{ marginBottom: '10px' }}>
          <div style={labelStyle}>
            <span>A — Cutting edge</span>
            <span style={valueStyle}>{settings.cutterProfile.a.toFixed(2)} mm</span>
          </div>
          <input
            type="range" min={0.1} max={2.0} step={0.05}
            value={settings.cutterProfile.a}
            onChange={(e) => updateProfile({ a: parseFloat(e.target.value) })}
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <div style={labelStyle}>
            <span>B — Base width</span>
            <span style={valueStyle}>{settings.cutterProfile.b.toFixed(1)} mm</span>
          </div>
          <input
            type="range" min={1.0} max={8.0} step={0.1}
            value={settings.cutterProfile.b}
            onChange={(e) => updateProfile({ b: parseFloat(e.target.value) })}
          />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <div style={labelStyle}>
            <span>C — Wall height</span>
            <span style={valueStyle}>{settings.cutterProfile.c.toFixed(0)} mm</span>
          </div>
          <input
            type="range" min={5} max={50} step={1}
            value={settings.cutterProfile.c}
            onChange={(e) => updateProfile({ c: parseFloat(e.target.value) })}
          />
        </div>

        <ProfileDiagram />
      </div>

      {/* 3. Generate & Export */}
      <div>
        <div style={sectionTitle}>3 · Generate & Export</div>

        <button
          onClick={handleGenerate}
          disabled={!contourResult || isGenerating}
          style={btnPrimary(!!contourResult && !isGenerating)}
        >
          {isGenerating ? 'Generating…' : 'Generate 3D Model'}
        </button>

        <button
          onClick={handleExport}
          disabled={!hasGeometry}
          style={btnOutline(hasGeometry)}
        >
          {geometries.length > 1 ? `Export STL (${geometries.length} files)` : 'Export STL'}
        </button>

        {stlSizeKb && (
          <div style={{ color: '#7A9BB8', fontSize: '11px', fontFamily: 'monospace', textAlign: 'center', marginTop: '2px' }}>
            STL: {stlSizeKb} KB{geometries.length > 1 ? ` × ${geometries.length}` : ''}
          </div>
        )}

        {hasGeometry && (
          <div style={{ color: '#1A3558', fontSize: '10px', textAlign: 'center', marginTop: '4px', wordBreak: 'break-all' }}>
            {geometries.length > 1
              ? buildExportFilename(imageFile).replace('.STL', '-loop1…N.STL')
              : buildExportFilename(imageFile)}
          </div>
        )}
      </div>
    </div>
  );
}
