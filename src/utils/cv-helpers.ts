export async function fileToImageData(file: File): Promise<ImageData> {
  let blob: Blob = file

  // Handle HEIC/HEIF
  if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic')) {
    const heic2any = (await import('heic2any')).default
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
    blob = Array.isArray(converted) ? converted[0] : converted
  }

  const url = URL.createObjectURL(blob)
  try {
    const img = await loadImage(url)
    const canvas = new OffscreenCanvas(img.naturalWidth, img.naturalHeight)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}
