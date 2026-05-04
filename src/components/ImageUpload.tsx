import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { normalizeImageFile } from '../utils/cv-helpers';

export function ImageUpload() {
  const setImage = useAppStore((s) => s.setImage);
  const imageUrl = useAppStore((s) => s.imageUrl);
  const imageFile = useAppStore((s) => s.imageFile);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    try {
      const normalized = await normalizeImageFile(file);
      setImage(normalized);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load image.');
    }
  }, [setImage]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          border: `1px dashed ${dragging ? '#22C59A' : '#1A3558'}`,
          borderRadius: '8px',
          padding: '14px',
          cursor: 'pointer',
          background: dragging ? '#0F2A20' : '#0F2035',
          transition: 'all 0.15s',
          textAlign: 'center',
          minHeight: '72px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
        }}
      >
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt="Uploaded"
              style={{ maxHeight: '110px', maxWidth: '100%', borderRadius: '4px', objectFit: 'contain' }}
            />
            <span style={{ color: '#7A9BB8', fontSize: '11px' }}>{imageFile?.name}</span>
            <span style={{ color: '#1A3558', fontSize: '10px' }}>Click to replace</span>
          </>
        ) : (
          <>
            <div style={{ color: '#1A3558', fontSize: '26px' }}>↑</div>
            <div style={{ color: '#7A9BB8', fontSize: '12px' }}>Drop image here or click to browse</div>
            <div style={{ color: '#1A3558', fontSize: '10px' }}>JPEG · PNG · HEIC · HEIF</div>
          </>
        )}
      </div>

      {error && (
        <div style={{ color: '#E05050', fontSize: '11px', marginTop: '6px', padding: '6px 8px', background: '#1A0F0F', borderRadius: '4px', border: '1px solid #3A1A1A' }}>
          {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        style={{ display: 'none' }}
        onChange={onInputChange}
      />
    </div>
  );
}
