import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useGeometryStore } from '../store/useGeometryStore';
import { ImageUpload } from './ImageUpload';
import { ContourPreview } from './ContourPreview';
import { ProfileDiagram } from './ProfileDiagram';
import { generateAllCutterGeometries } from '../utils/geometry';
import { exportAllSTLs, buildExportFilename } from '../utils/exporter';
import { fileToImageData } from '../utils/cv-helpers';
import type { CVWorkerResult, CVWorkerError } from '../types';

const DARKNESS_MAP = { light: 180, medium: 128, dark: 70 } as const;
const DARKNESS_LABELS = {
  light: 'Light grey / white background',
  medium: 'Standard paper',
  dark: 'Coloured / warm background',
} as const;
type DarknessTier = keyof typeof DARKNESS_MAP;

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

const sliderStyle: React.CSSProperties = {
  width: '100%',
  accentColor: '#7EC845',
};

export function SettingsPanel() {
  const settings = useAppStore((s) => s.settings);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const updateRibSettings = useAppStore((s) => s.updateRibSettings);
  const imageFile = useAppStore((s) => s.imageFile);
  const imageUrl = useAppStore((s) => s.imageUrl);
  const processingState = useAppStore((s) => s.processingState);
  const contourResult = useAppStore((s) => s.contourResult);
  const setContourResult = useAppStore((s) => s.setContourResult);
  const setProcessingState = useAppStore((s) => s.setProcessingState);

  const geometries = useGeometryStore((s) => s.geometries);
  const setGeometries = useGeometryStore((s) => s.setGeometries);
  const ribGeometries = useGeometryStore((s) => s.ribGeometries);
  const setRibGeometries = useGeometryStore((s) => s.setRibGeometries);
  const stlBlob = useGeometryStore((s) => s.stlBlob);
  const setStlBlob = useGeometryStore((s) => s.setStlBlob);
  const isGenerating = useGeometryStore((s) => s.isGenerating);
  const setIsGenerating = useGeometryStore((s) => s.setIsGenerating);

  const workerRef = useRef<Worker | null>(null);

  // Threshold UX local state
  const [thresholdAuto, setThresholdAuto] = useState(true);
  const [darknessTier, setDarknessTier] = useState<DarknessTier>('light');
  const [fineTune, setFineTune] = useState(0);

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
          expectedLoops: settings.expectedLoops,
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
        const { cutterGeometries, ribGeometries: ribs } = generateAllCutterGeometries(
          contourResult, settings.cutterProfile, settings.ribSettings
        );
        setGeometries(cutterGeometries);
        setRibGeometries(ribs);
        setStlBlob(null);
      } catch (err: any) {
        alert('3D generation failed. Try increasing smoothing or re-uploading image.\n\n' + (err.message ?? ''));
      } finally {
        setIsGenerating(false);
      }
    }, 0);
  }, [contourResult, settings.cutterProfile, settings.ribSettings, setGeometries, setRibGeometries, setStlBlob, setIsGenerating]);

  const handleExport = useCallback(() => {
    if (geometries.length === 0) return;
    const blob = exportAllSTLs(geometries, ribGeometries, imageFile);
    setStlBlob(blob);
  }, [geometries, ribGeometries, imageFile, setStlBlob]);

  const stlSizeKb = stlBlob ? (stlBlob.size / 1024).toFixed(1) : null;
  const hasGeometry = geometries.length > 0;
  const { ribSettings } = settings;
  const ribsDisabled = !ribSettings.enabled;

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

        {/* Line darkness preset */}
        <div style={{ marginBottom: '12px' }}>
          <div style={labelStyle}>
            <span>Line darkness</span>
            <span style={valueStyle}>{DARKNESS_LABELS[darknessTier]}</span>
          </div>

          {/* Three-button toggle */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
            {(['light', 'medium', 'dark'] as const).map(tier => (
              <button
                key={tier}
                onClick={() => {
                  setDarknessTier(tier);
                  setThresholdAuto(false);
                  updateSettings({ threshold: DARKNESS_MAP[tier] + fineTune });
                }}
                style={{
                  flex: 1,
                  padding: '5px 0',
                  borderRadius: '4px',
                  border: `1px solid ${darknessTier === tier && !thresholdAuto ? '#7EC845' : '#2a2a2a'}`,
                  background: darknessTier === tier && !thresholdAuto ? '#1a2a10' : 'transparent',
                  color: darknessTier === tier && !thresholdAuto ? '#7EC845' : '#888888',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontFamily: 'Inter, sans-serif',
                  textTransform: 'capitalize',
                }}
              >
                {tier}
              </button>
            ))}
          </div>

          {/* Auto toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <button
              onClick={() => {
                const newAuto = !thresholdAuto;
                setThresholdAuto(newAuto);
                updateSettings({ threshold: newAuto ? 'auto' : DARKNESS_MAP[darknessTier] + fineTune });
              }}
              style={{
                padding: '3px 10px',
                borderRadius: '4px',
                border: `1px solid ${thresholdAuto ? '#7EC845' : '#2a2a2a'}`,
                background: thresholdAuto ? '#1a2a10' : 'transparent',
                color: thresholdAuto ? '#7EC845' : '#888888',
                cursor: 'pointer',
                fontSize: '10px',
                fontFamily: 'monospace',
              }}
            >
              Auto detect
            </button>
            <span style={{ color: '#555', fontSize: '10px' }}>
              {thresholdAuto ? '— tries multiple settings automatically' : '— use sliders above'}
            </span>
          </div>

          {/* Fine-tune: only shown when not auto */}
          {!thresholdAuto && (
            <div>
              <div style={{ ...labelStyle, marginTop: '4px' }}>
                <span style={{ color: '#666', fontSize: '11px' }}>Fine-tune</span>
                <span style={valueStyle}>
                  {fineTune > 0 ? `+${fineTune}` : fineTune}
                  {' '}(darker ← → lighter)
                </span>
              </div>
              <input
                type="range"
                min={-30}
                max={30}
                step={5}
                value={fineTune}
                onChange={(e) => {
                  const ft = parseInt(e.target.value);
                  setFineTune(ft);
                  updateSettings({ threshold: DARKNESS_MAP[darknessTier] + ft });
                }}
                style={sliderStyle}
              />
            </div>
          )}
        </div>

        {/* Target shape height */}
        <div style={{ marginBottom: '10px' }}>
          <div style={labelStyle}>
            <span>Target shape height</span>
            <span style={valueStyle}>{settings.targetHeightMm} mm</span>
          </div>
          <input
            type="range" min={8} max={300} step={5}
            value={settings.targetHeightMm}
            onChange={(e) => updateSettings({ targetHeightMm: parseInt(e.target.value) })}
            style={sliderStyle}
          />
        </div>

        {/* Number of loops */}
        <div style={{ marginBottom: '10px' }}>
          <div style={labelStyle}>
            <span>Loops to detect</span>
            <span style={valueStyle}>{settings.expectedLoops}</span>
          </div>
          <input
            type="range" min={1} max={6} step={1}
            value={settings.expectedLoops}
            onChange={(e) => updateSettings({ expectedLoops: parseInt(e.target.value) })}
            style={sliderStyle}
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
            style={sliderStyle}
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
            style={sliderStyle}
          />
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
            style={sliderStyle}
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
            style={sliderStyle}
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
            style={sliderStyle}
          />
        </div>

        <ProfileDiagram />
      </div>

      {/* 3. Reinforcement Ribs */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>3 · Reinforcement Ribs</div>

        {/* Enable toggle */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={ribSettings.enabled}
              onChange={(e) => updateRibSettings({ enabled: e.target.checked })}
              style={{ accentColor: '#22C59A', width: '14px', height: '14px' }}
            />
            <span style={{ color: ribSettings.enabled ? '#F0F0F0' : '#7A9BB8', fontSize: '12px' }}>
              Add bottom ribs
            </span>
          </label>
        </div>

        {/* Grid spacing */}
        <div style={{ marginBottom: '10px', opacity: ribsDisabled ? 0.4 : 1, transition: 'opacity 0.15s' }}>
          <div style={labelStyle}>
            <span>Rib spacing</span>
            <span style={valueStyle}>{ribSettings.spacing} mm</span>
          </div>
          <input type="range" min={5} max={50} step={1}
            value={ribSettings.spacing} disabled={ribsDisabled}
            onChange={(e) => updateRibSettings({ spacing: parseInt(e.target.value) })}
            style={sliderStyle} />
        </div>

        {/* Grid angle */}
        <div style={{ marginBottom: '10px', opacity: ribsDisabled ? 0.4 : 1, transition: 'opacity 0.15s' }}>
          <div style={labelStyle}>
            <span>Rib angle</span>
            <span style={valueStyle}>{ribSettings.angle}°</span>
          </div>
          <input type="range" min={0} max={90} step={5}
            value={ribSettings.angle} disabled={ribsDisabled}
            onChange={(e) => updateRibSettings({ angle: parseInt(e.target.value) })}
            style={sliderStyle} />
          <div style={{ color: '#1A3558', fontSize: '10px', fontFamily: 'monospace', marginTop: '2px' }}>
            0° = parallel · 45° = diagonal · 90° = perpendicular
          </div>
        </div>

        {/* Rib height */}
        <div style={{ marginBottom: '10px', opacity: ribsDisabled ? 0.4 : 1, transition: 'opacity 0.15s' }}>
          <div style={labelStyle}>
            <span>Rib height</span>
            <span style={valueStyle}>{ribSettings.ribHeight.toFixed(1)} mm</span>
          </div>
          <input type="range" min={1} max={10} step={0.5}
            value={ribSettings.ribHeight} disabled={ribsDisabled}
            onChange={(e) => updateRibSettings({ ribHeight: parseFloat(e.target.value) })}
            style={sliderStyle} />
        </div>

        {/* Rib width */}
        <div style={{ marginBottom: '10px', opacity: ribsDisabled ? 0.4 : 1, transition: 'opacity 0.15s' }}>
          <div style={labelStyle}>
            <span>Rib width</span>
            <span style={valueStyle}>{ribSettings.ribWidth.toFixed(1)} mm</span>
          </div>
          <input type="range" min={0.5} max={5} step={0.1}
            value={ribSettings.ribWidth} disabled={ribsDisabled}
            onChange={(e) => updateRibSettings({ ribWidth: parseFloat(e.target.value) })}
            style={sliderStyle} />
        </div>

        {/* Grid centre offset */}
        <div style={{ marginBottom: '10px', opacity: ribsDisabled ? 0.4 : 1, transition: 'opacity 0.15s' }}>
          <div style={labelStyle}>
            <span>Grid centre X</span>
            <span style={valueStyle}>{ribSettings.offsetX > 0 ? '+' : ''}{ribSettings.offsetX} mm</span>
          </div>
          <input type="range" min={-50} max={50} step={1}
            value={ribSettings.offsetX} disabled={ribsDisabled}
            onChange={(e) => updateRibSettings({ offsetX: parseInt(e.target.value) })}
            style={sliderStyle} />
        </div>

        <div style={{ marginBottom: '10px', opacity: ribsDisabled ? 0.4 : 1, transition: 'opacity 0.15s' }}>
          <div style={labelStyle}>
            <span>Grid centre Y</span>
            <span style={valueStyle}>{ribSettings.offsetY > 0 ? '+' : ''}{ribSettings.offsetY} mm</span>
          </div>
          <input type="range" min={-50} max={50} step={1}
            value={ribSettings.offsetY} disabled={ribsDisabled}
            onChange={(e) => updateRibSettings({ offsetY: parseInt(e.target.value) })}
            style={sliderStyle} />
          <div style={{ color: '#1A3558', fontSize: '10px', fontFamily: 'monospace', marginTop: '2px' }}>
            Grid starts at bbox centre + offset. Rib ends always land on wall.
          </div>
        </div>
      </div>

      {/* 4. Generate & Export */}
      <div>
        <div style={sectionTitle}>4 · Generate & Export</div>

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
          Export STL
        </button>

        {stlSizeKb && (
          <div style={{ color: '#7A9BB8', fontSize: '11px', fontFamily: 'monospace', textAlign: 'center', marginTop: '2px' }}>
            STL: {stlSizeKb} KB
          </div>
        )}

        {hasGeometry && (
          <div style={{ color: '#1A3558', fontSize: '10px', textAlign: 'center', marginTop: '4px', wordBreak: 'break-all' }}>
            {buildExportFilename(imageFile)}
          </div>
        )}
      </div>
    </div>
  );
}
