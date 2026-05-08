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

// ── Tooltip info icon ─────────────────────────────────────────────────────────

function Tip({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      style={{ cursor: 'help', color: '#3A5878', fontSize: '10px', marginLeft: '4px', userSelect: 'none', flexShrink: 0 }}
    >ⓘ</span>
  );
}

// ── Inline-editable number (click the value to type a number directly) ────────

interface EditValProps {
  value: number;
  onChange: (v: number) => void;
  min: number; max: number; step: number;
  suffix?: string;
  color?: string;
}

function EditVal({ value, onChange, min, max, step, suffix = '', color = '#F0F0F0' }: EditValProps) {
  const isFloat = step < 1;
  const digits = isFloat ? (step < 0.1 ? 2 : 1) : 0;
  const display = isFloat ? value.toFixed(digits) : String(value);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '1px' }}>
      <input
        type="number"
        min={min} max={max} step={step}
        value={isFloat ? value : Math.round(value)}
        onChange={e => {
          const n = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value);
          if (!isNaN(n) && n >= min && n <= max) onChange(n);
        }}
        onFocus={e => e.target.select()}
        onWheel={e => (e.target as HTMLInputElement).blur()}
        style={{
          background: 'transparent', border: 'none',
          borderBottom: '1px dotted #2A4A68',
          color, fontFamily: 'monospace', fontSize: '11px',
          width: `${Math.max(display.length, 2) + 1}ch`,
          textAlign: 'right', padding: '0', outline: 'none', cursor: 'text',
          WebkitAppearance: 'none', MozAppearance: 'textfield',
        } as React.CSSProperties}
      />
      {suffix && <span style={{ color: '#7A9BB8', fontFamily: 'monospace', fontSize: '11px' }}>{suffix}</span>}
    </span>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const labelRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  color: '#7A9BB8', fontSize: '12px', marginBottom: '4px',
};
const sectionTitle: React.CSSProperties = {
  color: '#22C59A', fontSize: '11px', letterSpacing: '1px',
  textTransform: 'uppercase' as const, marginBottom: '12px',
  fontWeight: 600, fontFamily: "'Barlow', sans-serif",
};
const sectionBox: React.CSSProperties = {
  marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #1A3558',
};
const sliderStyle: React.CSSProperties = { width: '100%', accentColor: '#7EC845' };
const hint: React.CSSProperties = { color: '#3A5878', fontSize: '10px', fontFamily: 'monospace', marginTop: '2px' };
const labelSpan = (tip: string, label: string) => (
  <span style={{ display: 'flex', alignItems: 'center' }}>{label}<Tip text={tip} /></span>
);

// ─────────────────────────────────────────────────────────────────────────────

export function SettingsPanel() {
  const settings     = useAppStore(s => s.settings);
  const updateProfile    = useAppStore(s => s.updateProfile);
  const updateSettings   = useAppStore(s => s.updateSettings);
  const updateRibSettings = useAppStore(s => s.updateRibSettings);
  const imageFile    = useAppStore(s => s.imageFile);
  const imageUrl     = useAppStore(s => s.imageUrl);
  const processingState  = useAppStore(s => s.processingState);
  const contourResult    = useAppStore(s => s.contourResult);
  const setContourResult = useAppStore(s => s.setContourResult);
  const setProcessingState = useAppStore(s => s.setProcessingState);

  const geometries      = useGeometryStore(s => s.geometries);
  const setGeometries   = useGeometryStore(s => s.setGeometries);
  const ribGeometries   = useGeometryStore(s => s.ribGeometries);
  const setRibGeometries = useGeometryStore(s => s.setRibGeometries);
  const stlBlob         = useGeometryStore(s => s.stlBlob);
  const setStlBlob      = useGeometryStore(s => s.setStlBlob);
  const isGenerating    = useGeometryStore(s => s.isGenerating);
  const setIsGenerating = useGeometryStore(s => s.setIsGenerating);

  const workerRef = useRef<Worker | null>(null);

  const thresholdAuto  = settings.threshold === 'auto';
  const thresholdValue = typeof settings.threshold === 'number' ? settings.threshold : 128;

  const handleDetect = useCallback(async () => {
    if (!imageFile) return;
    setProcessingState('processing');
    try {
      const imageData = await fileToImageData(imageFile);
      if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; }
      const worker = new Worker(new URL('../workers/cv.worker.ts', import.meta.url));
      workerRef.current = worker;
      worker.onmessage = (e: MessageEvent<CVWorkerResult | CVWorkerError>) => {
        if (e.data.type === 'CONTOUR_RESULT') { setContourResult(e.data.result); setProcessingState('done'); }
        else { setProcessingState('error', e.data.message); }
        worker.terminate(); workerRef.current = null;
      };
      worker.onerror = e => { setProcessingState('error', e.message ?? 'Worker error.'); worker.terminate(); workerRef.current = null; };
      worker.postMessage({
        type: 'PROCESS_IMAGE', imageData,
        settings: {
          threshold: settings.threshold,
          expectedLoops: settings.expectedLoops,
          smoothing: settings.smoothing,
          shapePerfection: settings.shapePerfection,
          targetHeightMm: settings.targetHeightMm,
        },
      });
    } catch (err: any) { setProcessingState('error', err.message ?? 'Failed to process image.'); }
  }, [imageFile, settings, setContourResult, setProcessingState]);

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
        alert('3D generation failed. Try increasing Edge Smoothing or re-uploading the image.\n\n' + (err.message ?? ''));
      } finally { setIsGenerating(false); }
    }, 0);
  }, [contourResult, settings.cutterProfile, settings.ribSettings, setGeometries, setRibGeometries, setStlBlob, setIsGenerating]);

  const handleExport = useCallback(() => {
    if (geometries.length === 0) return;
    setStlBlob(exportAllSTLs(geometries, ribGeometries, imageFile));
  }, [geometries, ribGeometries, imageFile, setStlBlob]);

  const stlSizeKb  = stlBlob ? (stlBlob.size / 1024).toFixed(1) : null;
  const hasGeometry = geometries.length > 0;
  const { ribSettings } = settings;
  const ribsOff = !ribSettings.enabled;

  const btnPrimary = (on: boolean): React.CSSProperties => ({
    width: '100%', padding: '10px', borderRadius: '6px', border: 'none',
    cursor: on ? 'pointer' : 'not-allowed', fontSize: '13px',
    fontFamily: "'Barlow', sans-serif", fontWeight: 600, letterSpacing: '0.3px',
    background: on ? '#22C59A' : '#0F2A20', color: on ? '#0D1B2A' : '#1A3558',
    transition: 'all 0.15s', marginBottom: '8px',
  });
  const btnOutline = (on: boolean): React.CSSProperties => ({
    width: '100%', padding: '10px', borderRadius: '6px',
    border: `1px solid ${on ? '#22C59A' : '#1A3558'}`,
    cursor: on ? 'pointer' : 'not-allowed', fontSize: '13px',
    fontFamily: "'Barlow', sans-serif", fontWeight: 600, letterSpacing: '0.3px',
    background: 'transparent', color: on ? '#22C59A' : '#1A3558',
    transition: 'all 0.15s', marginBottom: '8px',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '16px', overflowY: 'auto', height: '100%' }}>

      {/* ── 1 · Detect Shape ──────────────────────────────────────────────── */}
      <div style={sectionBox}>
        <div style={sectionTitle}>1 · Detect Shape</div>

        {/* Photo upload */}
        <div style={{ marginBottom: '12px' }}>
          <ImageUpload />
        </div>

        {/* ★ Number of shapes — most critical setting, highlighted */}
        <div style={{
          marginBottom: '12px', padding: '8px 10px', borderRadius: '6px',
          border: '1px solid #8B6914', background: '#1A1500',
        }}>
          <div style={{ ...labelRow, color: '#F0C040', marginBottom: '6px' }}>
            <span style={{ display: 'flex', alignItems: 'center', fontWeight: 600 }}>
              ★ Number of shapes
              <Tip text="How many closed outlines to detect and use. 1 = simple shape (circle, star, spiral). 2 = shape with a hole (letter A, avocado with pit, donut). Must match what you drew." />
            </span>
            <EditVal
              value={settings.expectedLoops}
              onChange={v => updateSettings({ expectedLoops: v })}
              min={1} max={6} step={1} color="#F0C040"
            />
          </div>
          <input type="range" min={1} max={6} step={1}
            value={settings.expectedLoops}
            onChange={e => updateSettings({ expectedLoops: parseInt(e.target.value) })}
            style={{ ...sliderStyle, accentColor: '#F0C040' }}
          />
          <div style={{ ...hint, color: '#7A6010', marginTop: '4px' }}>
            1 = outer outline only · 2 = with inner hole (e.g. letter A) · etc.
          </div>
        </div>

        {/* Detection sensitivity */}
        <div style={{ marginBottom: '12px' }}>
          <div style={labelRow}>
            {labelSpan('How dark a mark must be relative to the surrounding paper to be detected as ink. Auto adjusts automatically. Lower = detect faint pencil lines. Higher = only bold/dark ink.', 'Detection sensitivity')}
            <span style={{ color: '#F0F0F0', fontFamily: 'monospace', fontSize: '11px' }}>
              {thresholdAuto ? 'Auto' : thresholdValue}
            </span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox" checked={thresholdAuto}
              onChange={e => updateSettings({ threshold: e.target.checked ? 'auto' : thresholdValue })}
              style={{ accentColor: '#22C59A', width: '13px', height: '13px' }}
            />
            <span style={{ color: '#7A9BB8', fontSize: '11px' }}>Auto (recommended)</span>
          </label>
          {!thresholdAuto && (
            <>
              <input type="range" min={10} max={250} step={5}
                value={thresholdValue}
                onChange={e => updateSettings({ threshold: parseInt(e.target.value) })}
                style={sliderStyle}
              />
              <div style={hint}>Low = faint lines · High = bold lines only</div>
            </>
          )}
        </div>

        {/* Cutter height */}
        <div style={{ marginBottom: '10px' }}>
          <div style={labelRow}>
            {labelSpan('The final outer height of the printed cookie cutter in mm. Your drawing is scaled to this height. Typical cookie cutters: 30–80 mm.', 'Cutter height')}
            <EditVal value={settings.targetHeightMm} onChange={v => updateSettings({ targetHeightMm: v })}
              min={8} max={300} step={5} suffix=" mm" />
          </div>
          <input type="range" min={8} max={300} step={5}
            value={settings.targetHeightMm}
            onChange={e => updateSettings({ targetHeightMm: parseInt(e.target.value) })}
            style={sliderStyle} />
        </div>

        {/* Edge smoothing */}
        <div style={{ marginBottom: '10px' }}>
          <div style={labelRow}>
            {labelSpan('Smoothing passes applied to the detected outline. 0 = raw polygon. 2–3 = natural curves. Sharp corners are always preserved regardless of this setting.', 'Edge smoothing')}
            <EditVal value={settings.smoothing} onChange={v => updateSettings({ smoothing: v })}
              min={0} max={10} step={1} />
          </div>
          <input type="range" min={0} max={10} step={1}
            value={settings.smoothing}
            onChange={e => updateSettings({ smoothing: parseInt(e.target.value) })}
            style={sliderStyle} />
        </div>

        {/* Corner preservation */}
        <div style={{ marginBottom: '12px' }}>
          <div style={labelRow}>
            {labelSpan('How strongly sharp angles are kept during smoothing. 0% = curves smoothed freely (natural organic shapes). 100% = all corners kept sharp (geometric/architectural designs).', 'Corner preservation')}
            <EditVal
              value={Math.round(settings.shapePerfection * 100)}
              onChange={v => updateSettings({ shapePerfection: v / 100 })}
              min={0} max={100} step={1} suffix="%" />
          </div>
          <input type="range" min={0} max={100} step={1}
            value={Math.round(settings.shapePerfection * 100)}
            onChange={e => updateSettings({ shapePerfection: parseInt(e.target.value) / 100 })}
            style={sliderStyle} />
          <div style={hint}>0% = organic curves · 100% = sharp geometry</div>
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

      {/* ── 2 · Cutter Profile ────────────────────────────────────────────── */}
      <div style={sectionBox}>
        <div style={sectionTitle}>2 · Cutter Profile</div>

        <div style={{ marginBottom: '10px' }}>
          <div style={labelRow}>
            {labelSpan('Width of the cutting edge at the tip. Thinner = sharper cut, easier dough release. Typical: 0.2–0.5 mm.', 'Blade tip (A)')}
            <EditVal value={settings.cutterProfile.a} onChange={v => updateProfile({ a: v })}
              min={0.1} max={2.0} step={0.05} suffix=" mm" />
          </div>
          <input type="range" min={0.1} max={2.0} step={0.05}
            value={settings.cutterProfile.a}
            onChange={e => updateProfile({ a: parseFloat(e.target.value) })}
            style={sliderStyle} />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <div style={labelRow}>
            {labelSpan('Width of the cutter wall at the base. Wider = more stable print. Typical: 2–4 mm.', 'Base width (B)')}
            <EditVal value={settings.cutterProfile.b} onChange={v => updateProfile({ b: v })}
              min={1.0} max={8.0} step={0.1} suffix=" mm" />
          </div>
          <input type="range" min={1.0} max={8.0} step={0.1}
            value={settings.cutterProfile.b}
            onChange={e => updateProfile({ b: parseFloat(e.target.value) })}
            style={sliderStyle} />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <div style={labelRow}>
            {labelSpan('Height of the cutter walls. Taller = cuts deeper into dough. Typical: 10–20 mm.', 'Wall height (C)')}
            <EditVal value={settings.cutterProfile.c} onChange={v => updateProfile({ c: v })}
              min={5} max={50} step={1} suffix=" mm" />
          </div>
          <input type="range" min={5} max={50} step={1}
            value={settings.cutterProfile.c}
            onChange={e => updateProfile({ c: parseFloat(e.target.value) })}
            style={sliderStyle} />
        </div>

        <ProfileDiagram />
      </div>

      {/* ── 3 · Reinforcement Ribs ────────────────────────────────────────── */}
      <div style={sectionBox}>
        <div style={sectionTitle}>3 · Reinforcement Ribs</div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={ribSettings.enabled}
              onChange={e => updateRibSettings({ enabled: e.target.checked })}
              style={{ accentColor: '#22C59A', width: '14px', height: '14px' }} />
            <span style={{ color: ribSettings.enabled ? '#F0F0F0' : '#7A9BB8', fontSize: '12px' }}>
              Add reinforcement ribs
            </span>
            <Tip text="Adds thin cross-bars at the base of the cutter to prevent warping and strengthen the structure during and after printing." />
          </label>
        </div>

        {(([
          ['Rib spacing',   'Distance between adjacent ribs. Smaller = more ribs = stronger but uses more material.', 'spacing',   5,   50, 1,   ' mm', ''],
          ['Rib angle',     'Direction of the rib lines. 0° = horizontal, 45° = diagonal, 90° = vertical.',           'angle',     0,   90, 5,   '°',   '0° = horizontal · 45° = diagonal · 90° = vertical'],
          ['Rib height',    'How tall each rib rises above the base surface.',                                         'ribHeight', 1,   10, 0.5, ' mm', ''],
          ['Rib thickness', 'Width of each individual rib.',                                                           'ribWidth',  0.5, 5,  0.1, ' mm', ''],
          ['Grid offset X', 'Shift the rib grid horizontally from the shape centre.',                                  'offsetX',   -50, 50, 1,   ' mm', ''],
          ['Grid offset Y', 'Shift the rib grid vertically from the shape centre.',                                    'offsetY',   -50, 50, 1,   ' mm', ''],
        ] as const)).map(([label, tip, key, min, max, step, suffix, rowHint]) => {
          const val = ribSettings[key] as number;
          return (
            <div key={key} style={{ marginBottom: '10px', opacity: ribsOff ? 0.4 : 1, transition: 'opacity 0.15s' }}>
              <div style={labelRow}>
                {labelSpan(tip, label)}
                <EditVal value={val} onChange={v => updateRibSettings({ [key]: v })}
                  min={min} max={max} step={step} suffix={suffix} />
              </div>
              <input type="range" min={min} max={max} step={step}
                value={val} disabled={ribsOff}
                onChange={e => updateRibSettings({ [key]: (step as number) < 1 ? parseFloat(e.target.value) : parseInt(e.target.value) })}
                style={sliderStyle} />
              {rowHint && <div style={hint}>{rowHint}</div>}
            </div>
          );
        })}
      </div>

      {/* ── 4 · Generate & Export ─────────────────────────────────────────── */}
      <div>
        <div style={sectionTitle}>4 · Generate & Export</div>

        <button onClick={handleGenerate} disabled={!contourResult || isGenerating}
          style={btnPrimary(!!contourResult && !isGenerating)}>
          {isGenerating ? 'Generating…' : 'Generate 3D Model'}
        </button>

        <button onClick={handleExport} disabled={!hasGeometry} style={btnOutline(hasGeometry)}>
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
