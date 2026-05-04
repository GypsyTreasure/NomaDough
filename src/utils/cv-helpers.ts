import heic2any from 'heic2any';

export async function normalizeImageFile(file: File): Promise<File> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.heic') || name.endsWith('.heif')) {
    try {
      const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
      const blob = Array.isArray(converted) ? converted[0] : converted;
      return new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
    } catch {
      throw new Error('Could not read HEIC image. Try converting to JPG first.');
    }
  }
  return file;
}

export async function fileToImageData(file: File): Promise<ImageData> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<ImageData>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Cap at 2000px on longest edge to keep CV fast
        const maxDim = 2000;
        let { width, height } = img;
        if (Math.max(width, height) > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(ctx.getImageData(0, 0, width, height));
      };
      img.onerror = () => reject(new Error('Failed to load image.'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
