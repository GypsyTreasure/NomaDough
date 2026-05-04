import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useGeometryStore } from '../store/useGeometryStore';
import { ImageUpload } from './ImageUpload';
import { ContourPreview } from './ContourPreview';
import { ProfileDiagram } from './ProfileDiagram';
import { generateCutterGeometry } from '../utils/geometry';
import { exportSTL, buildExportFilename } from '../utils/exporter';
import { fileToImageData } from '../utils/cv-helpers';
import type { CVWorkerResult, CVWorkerError } from '../types';

const labelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  color: '#888888',
  fontSize: '12px',
  marginBottom: '4px',
};

const valueStyle: React.CSSProperties = {
  color: '#f0f0f0',
  fontFamily: 'monospace',
  fontSize: '11px',
};

const sliderStyle: React.CSSProperties = {
  width: '100%',
  accentColor: '#7EC845',
  cursor: 'pointer',
};

const btnBase: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  borderRadius: '6px',
  border: 'none',
  cursor: 'pointer',
  fontSize: '13px',
  fontFamily: 'Inter, sans-serif',
  fontWeight: 600,
  transition: 'all 0.15s',
};

const sectionStyle: React.CSSProperties = {
  marginBottom: '20px',
  paddingBottom: '20px',
  borderBottom: '1px solid #2a2a2a',
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

  const geometry = useGeometryStore((s) => s.geometry);
  const setGeometry = useGeometryStore((s) => s.setGeometry);
  const stlBlob = useGeometryStore((s) => s.stlBlob);
  const setStlBlob = useGeometryStore((s) => s.setStlBlob);
  const isGenerating = useGeometryStore((s) => s.isGenerating);
  const setIsGenerating = useGeometryStore((s) => s.setIsGenerating);

  const workerRef = useRef<Worker | null>(null);
  const [thresholdAuto, setThresholdAuto] = useState(true);

  const handleDetect = useCallback(async () => {
    if (!imageFile) return;
    setProcessingState('processing');

    try {
      const imageData = await fileToImageData(imageFile);

      if (workerRef.current) {
        workerRef.current.terminate();
      }

      const worker = new Worker(new URL('../workers/cv.worker.ts', import.meta.url), { type: 'module' });
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
          targetHeightMm: settings.targetHeightMm,
        },
      });
    } catch (err: any) {
      setProcessingState('error', err.message ?? 'Failed to process image.');
    }
  }, [imageFile, settings, thresholdAuto, setContourResult, setProcessingState]);

  const handleGenerate = useCallback(() => {
    if (!contourResult) return;
    setIsGenerating(true);
    try {
      const geo = generateCutterGeometry(contourResult, settings.cutterProfile);
      setGeometry(geo);
      setStlBlob(null);
    } catch (err: any) {
      alert('3D generation failed. Try increasing smoothing or re-uploading image.\n\n' + (err.message ?? ''));
    } finally {
      setIsGenerating(false);
    }
  }, [contourResult, settings.cutterProfile, setGeometry, setStlBlob, setIsGenerating]);

  const handleExport = useCallback(() => {
    if (!geometry) return;
    const filename = buildExportFilename(imageFile);
    const blob = exportSTL(geometry, filename);
    setStlBlob(blob);
  }, [geometry, imageFile, setStlBlob]);

  const stlSizeKb = stlBlob ? (stlBlob.size / 1024).toFixed(1) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', padding: '16px', overflowY: 'auto', height: '100%' }}>

      {/* Image section */}
      <div style={sectionStyle}>
        <div style={{ color: '#7EC845', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 600 }}>
          1. Image Input
        </div>

        <div style={{ marginBottom: '12px' }}>
          <ImageUpload />
        </div>

        {/* Threshold */}
        <div style={{ marginBottom: '12px' }}>
          <div style={labelStyle}>
            <span>Threshold</span>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button
                onClick={() => setThresholdAuto(!thresholdAuto)}
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: `1px solid ${thresholdAuto ? '#7EC845' : '#2a2a2a'}`,
                  background: thresholdAuto ? '#1a2a10' : 'transparent',
                  color: thresholdAuto ? '#7EC845' : '#888888',
                  cursor: 'pointer',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                }}
              >
                Auto (Otsu)
              </button>
              {!thresholdAuto && (
                <span style={valueStyle}>{typeof settings.threshold === 'number' ? settings.threshold : 128}</span>
              )}
            </div>
          </div>
          {!thresholdAuto && (
            <input
              type="range"
              min={0}
              max={255}
              step={1}
              value={typeof settings.threshold === 'number' ? settings.threshold : 128}
              onChange={(e) => updateSettings({ threshold: parseInt(e.target.value) })}
              style={sliderStyle}
            />
          )}
        </div>

        {/* Smoothing */}
        <div style={{ marginBottom: '12px' }}>
          <div style={labelStyle}>
            <span>Smoothing iterations</span>
            <span style={valueStyle}>{settings.smoothing}</span>
          </div>
          <input
            type="range"
            min={0}
            max={5}
            step={1}
            value={settings.smoothing}
            onChange={(e) => updateSettings({ smoothing: parseInt(e.target.value) })}
            style={sliderStyle}
          />
        </div>

        {/* Detect button */}
        <button
          onClick={handleDetect}
          disabled={!imageFile || processingState === 'processing'}
          style={{
            ...btnBase,
            background: imageFile && processingState !== 'processing' ? '#7EC845' : '#1a2a10',
            color: imageFile && processingState !== 'processing' ? '#0f0f0f' : '#444444',
            cursor: imageFile && processingState !== 'processing' ? 'pointer' : 'not-allowed',
            marginBottom: '12px',
          }}
        >
          {processingState === 'processing' ? 'Detecting…' : 'Detect Contour'}
        </button>

        {/* Contour Preview */}
        {imageUrl && <ContourPreview />}
      </div>

      {/* Cutter Profile section */}
      <div style={sectionStyle}>
        <div style={{ color: '#7EC845', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 600 }}>
          2. Cutter Profile
        </div>

        {/* Target size */}
        <div style={{ marginBottom: '12px' }}>
          <div style={labelStyle}>
            <span>Target shape height</span>
            <span style={valueStyle}>{settings.targetHeightMm} mm</span>
          </div>
          <input
            type="range"
            min={20}
            max={300}
            step={5}
            value={settings.targetHeightMm}
            onChange={(e) => updateSettings({ targetHeightMm: parseInt(e.target.value) })}
            style={sliderStyle}
          />
        </div>

        {/* A */}
        <div style={{ marginBottom: '12px' }}>
          <div style={labelStyle}>
            <span>A — Cutting edge width</span>
            <span style={valueStyle}>{settings.cutterProfile.a.toFixed(2)} mm</span>
          </div>
          <input
            type="range"
            min={0.1}
            max={2.0}
            step={0.05}
            value={settings.cutterProfile.a}
            onChange={(e) => updateProfile({ a: parseFloat(e.target.value) })}
            style={sliderStyle}
          />
        </div>

        {/* B */}
        <div style={{ marginBottom: '12px' }}>
          <div style={labelStyle}>
            <span>B — Base width</span>
            <span style={valueStyle}>{settings.cutterProfile.b.toFixed(1)} mm</span>
          </div>
          <input
            type="range"
            min={1.0}
            max={8.0}
            step={0.1}
            value={settings.cutterProfile.b}
            onChange={(e) => updateProfile({ b: parseFloat(e.target.value) })}
            style={sliderStyle}
          />
        </div>

        {/* C */}
        <div style={{ marginBottom: '12px' }}>
          <div style={labelStyle}>
            <span>C — Wall height</span>
            <span style={valueStyle}>{settings.cutterProfile.c.toFixed(0)} mm</span>
          </div>
          <input
            type="range"
            min={5}
            max={50}
            step={1}
            value={settings.cutterProfile.c}
            onChange={(e) => updateProfile({ c: parseFloat(e.target.value) })}
            style={sliderStyle}
          />
        </div>

        <ProfileDiagram />
      </div>

      {/* Generate & Export section */}
      <div>
        <div style={{ color: '#7EC845', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 600 }}>
          3. Generate & Export
        </div>

        <button
          onClick={handleGenerate}
          disabled={!contourResult || isGenerating}
          style={{
            ...btnBase,
            background: contourResult && !isGenerating ? '#7EC845' : '#1a2a10',
            color: contourResult && !isGenerating ? '#0f0f0f' : '#444444',
            cursor: contourResult && !isGenerating ? 'pointer' : 'not-allowed',
            marginBottom: '8px',
          }}
        >
          {isGenerating ? 'Generating…' : 'Generate 3D Model'}
        </button>

        <button
          onClick={handleExport}
          disabled={!geometry}
          style={{
            ...btnBase,
            background: geometry ? '#1a2a10' : 'transparent',
            color: geometry ? '#7EC845' : '#444444',
            border: `1px solid ${geometry ? '#7EC845' : '#2a2a2a'}`,
            cursor: geometry ? 'pointer' : 'not-allowed',
            marginBottom: '8px',
          }}
        >
          Export STL
        </button>

        {stlSizeKb && (
          <div style={{ color: '#888888', fontSize: '11px', fontFamily: 'monospace', textAlign: 'center' }}>
            STL: {stlSizeKb} KB
          </div>
        )}

        {geometry && (
          <div style={{ color: '#444444', fontSize: '10px', textAlign: 'center', marginTop: '4px', wordBreak: 'break-all' }}>
            {buildExportFilename(imageFile)}
          </div>
        )}
      </div>
    </div>
  );
}
