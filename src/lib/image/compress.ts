// Image compression utility for FoodKit uploads.
// Uses Canvas API to resize and compress images before upload.
// Handles JPEG, PNG, WebP. Large PNGs are converted to JPEG.
// createImageBitmap respects EXIF orientation on modern browsers.

const MAX_INPUT_BYTES = 30 * 1024 * 1024   // 30 MB — reject before processing
const MAX_UPLOAD_BYTES = 4.9 * 1024 * 1024  // 4.9 MB — target after compression
const MAX_DIMENSION = 2048
const JPEG_QUALITY_STEPS = [0.85, 0.72, 0.58]
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export class ImageTooLargeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageTooLargeError'
  }
}

export class ImageFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageFormatError'
  }
}

function outputMimeType(inputType: string): 'image/jpeg' | 'image/webp' {
  // WebP → keep WebP; everything else → JPEG
  return inputType === 'image/webp' ? 'image/webp' : 'image/jpeg'
}

function outputExtension(mime: 'image/jpeg' | 'image/webp'): string {
  return mime === 'image/webp' ? 'webp' : 'jpg'
}

function scaledDimensions(width: number, height: number): { w: number; h: number } {
  if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) return { w: width, h: height }
  const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
  return { w: Math.round(width * ratio), h: Math.round(height * ratio) }
}

async function blobToFile(blob: Blob, originalName: string, mime: string): Promise<File> {
  const ext = outputExtension(mime as 'image/jpeg' | 'image/webp')
  const baseName = originalName.replace(/\.[^.]+$/, '')
  return new File([blob], `${baseName}.${ext}`, { type: mime })
}

/**
 * Compresses an image file if it exceeds the upload size limit.
 * Returns the original file if it is already small enough.
 *
 * @param file - The input image file (JPEG, PNG, or WebP)
 * @param onProgress - Optional callback for status updates
 * @throws ImageFormatError if the file type is not supported
 * @throws ImageTooLargeError if the file exceeds the 30 MB input limit or cannot be compressed
 */
export async function compressImageIfNeeded(
  file: File,
  onProgress?: (status: 'checking' | 'compressing' | 'done') => void,
): Promise<File> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new ImageFormatError('JPEG・PNG・WebP形式の画像を選んでください')
  }

  if (file.size > MAX_INPUT_BYTES) {
    throw new ImageTooLargeError('画像が大きすぎます（30MB以下にしてください）')
  }

  onProgress?.('checking')

  // Already small enough — skip compression
  if (file.size <= MAX_UPLOAD_BYTES) {
    onProgress?.('done')
    return file
  }

  onProgress?.('compressing')

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new ImageTooLargeError('画像を読み込めませんでした。別の画像をお試しください')
  }

  const { w, h } = scaledDimensions(bitmap.width, bitmap.height)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Canvas context unavailable')
  }

  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const mime = outputMimeType(file.type)

  for (const quality of JPEG_QUALITY_STEPS) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mime, quality),
    )

    if (!blob) continue

    if (blob.size <= MAX_UPLOAD_BYTES) {
      onProgress?.('done')
      return blobToFile(blob, file.name, mime)
    }
  }

  // Final fallback with lowest quality
  const fallbackBlob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, 0.45),
  )

  if (fallbackBlob && fallbackBlob.size <= MAX_UPLOAD_BYTES) {
    onProgress?.('done')
    return blobToFile(fallbackBlob, file.name, mime)
  }

  throw new ImageTooLargeError(
    '画像を圧縮しても5MBを超えています。より小さい画像を使用してください',
  )
}
