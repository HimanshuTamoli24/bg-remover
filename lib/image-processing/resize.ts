/**
 * Utilities for loading, scaling, and managing image data and canvas buffers across all major image types:
 * PNG, JPEG, JPG, WEBP, AVIF, BMP, GIF, SVG, TIFF, ICO, HEIC, etc.
 */

export function isSupportedImageType(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) {
    return true;
  }
  const extMatch = file.name.match(/\.(jpe?g|png|webp|avif|bmp|gif|svg|tiff?|ico|heic|heif)$/i);
  return Boolean(extMatch);
}

export async function loadImageElement(source: string | Blob): Promise<HTMLImageElement> {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  const img = new Image();
  img.crossOrigin = 'anonymous';

  return new Promise((resolve, reject) => {
    img.onload = () => {
      resolve(img);
    };
    img.onerror = (err) => {
      reject(new Error(`Failed to decode image (${typeof source === 'string' ? source : 'file'}). Please ensure it is a valid image.`));
    };
    img.src = url;
  });
}

export function getImageDimensions(file: File | Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || img.width || 800;
      const height = img.naturalHeight || img.height || 800;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to determine image dimensions'));
    };
    img.src = url;
  });
}

export function imageElementToImageData(img: HTMLImageElement): ImageData {
  const width = img.naturalWidth || img.width || 800;
  const height = img.naturalHeight || img.height || 800;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Could not create canvas 2D context');
  }

  ctx.drawImage(img, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height);
  // Free canvas
  canvas.width = 0;
  canvas.height = 0;
  return data;
}

export function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Could not create canvas 2D context');
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality = 1.0): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to generate image Blob from canvas'));
        }
      },
      type,
      quality
    );
  });
}

export function imageDataToBlob(imageData: ImageData): Promise<Blob> {
  const canvas = imageDataToCanvas(imageData);
  const blobPromise = canvasToBlob(canvas);
  blobPromise.finally(() => {
    canvas.width = 0;
    canvas.height = 0;
  });
  return blobPromise;
}

export function scaleImageData(
  source: ImageData,
  targetWidth: number,
  targetHeight: number
): ImageData {
  if (source.width === targetWidth && source.height === targetHeight) {
    return source;
  }

  const srcCanvas = imageDataToCanvas(source);
  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = targetWidth;
  dstCanvas.height = targetHeight;

  const dstCtx = dstCanvas.getContext('2d', { willReadFrequently: true });
  if (!dstCtx) {
    throw new Error('Failed to create canvas 2D context for scaling');
  }

  // Use high quality image smoothing
  dstCtx.imageSmoothingEnabled = true;
  dstCtx.imageSmoothingQuality = 'high';
  dstCtx.drawImage(srcCanvas, 0, 0, targetWidth, targetHeight);

  const res = dstCtx.getImageData(0, 0, targetWidth, targetHeight);

  // Clean up
  srcCanvas.width = 0;
  srcCanvas.height = 0;
  dstCanvas.width = 0;
  dstCanvas.height = 0;

  return res;
}
