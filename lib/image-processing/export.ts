import JSZip from 'jszip';
import { EditorSettings } from '@/types/image';
import { canvasToBlob } from './resize';

/**
 * Renders the cutout image onto an export canvas with user styling:
 * - Background color (transparent, white, black, custom)
 * - Padding and positioning (center, contain, fit)
 * - Optional natural realistic product shadow
 */
export function renderEditedImageCanvas(
  cutoutElement: HTMLImageElement | HTMLCanvasElement,
  settings: EditorSettings,
  targetWidth?: number,
  targetHeight?: number
): HTMLCanvasElement {
  const naturalWidth = ('naturalWidth' in cutoutElement ? cutoutElement.naturalWidth : cutoutElement.width) || targetWidth || 800;
  const naturalHeight = ('naturalHeight' in cutoutElement ? cutoutElement.naturalHeight : cutoutElement.height) || targetHeight || 800;

  const canvasWidth = targetWidth || naturalWidth;
  const canvasHeight = targetHeight || naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Failed to create canvas 2D rendering context');
  }

  // 1. Draw Background
  if (settings.backgroundType === 'white') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  } else if (settings.backgroundType === 'black') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  } else if (settings.backgroundType === 'custom') {
    ctx.fillStyle = settings.customColor || '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  } else {
    // Transparent: clearRect
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  }

  // 2. Calculate positioning & padding
  const paddingPercent = Math.max(0, Math.min(40, settings.padding)) / 100;
  const paddedWidth = canvasWidth * (1 - paddingPercent * 2);
  const paddedHeight = canvasHeight * (1 - paddingPercent * 2);

  let drawWidth = naturalWidth;
  let drawHeight = naturalHeight;

  if (settings.positioning === 'contain' || settings.positioning === 'fit') {
    const scale = Math.min(paddedWidth / naturalWidth, paddedHeight / naturalHeight);
    drawWidth = naturalWidth * scale;
    drawHeight = naturalHeight * scale;
  } else if (settings.positioning === 'center') {
    // Keep 1:1 if it fits within padded area, otherwise scale to fit
    if (naturalWidth > paddedWidth || naturalHeight > paddedHeight) {
      const scale = Math.min(paddedWidth / naturalWidth, paddedHeight / naturalHeight);
      drawWidth = naturalWidth * scale;
      drawHeight = naturalHeight * scale;
    }
  }

  const drawX = (canvasWidth - drawWidth) / 2;
  const drawY = (canvasHeight - drawHeight) / 2;

  // 3. Render natural studio shadow if enabled
  if (settings.shadow) {
    ctx.save();
    // Configure natural soft contact shadow
    const blur = settings.shadowBlur || 24;
    const offsetY = settings.shadowOffsetY || 12;
    const opacity = settings.shadowOpacity || 0.22;

    ctx.shadowColor = `rgba(0, 0, 0, ${opacity})`;
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = offsetY;

    // Draw shadow pass
    ctx.drawImage(cutoutElement, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();
  }

  // 4. Draw crisp product foreground
  ctx.drawImage(cutoutElement, drawX, drawY, drawWidth, drawHeight);

  return canvas;
}

/**
 * Exports edited canvas to a PNG Blob
 */
export async function renderFinalBlob(
  cutoutElement: HTMLImageElement | HTMLCanvasElement,
  settings: EditorSettings,
  targetWidth?: number,
  targetHeight?: number
): Promise<Blob> {
  const canvas = renderEditedImageCanvas(cutoutElement, settings, targetWidth, targetHeight);
  const blob = await canvasToBlob(canvas, 'image/png');
  // Free canvas memory
  canvas.width = 0;
  canvas.height = 0;
  return blob;
}

/**
 * Creates a ZIP archive directly in browser using JSZip
 */
export async function createZipArchive(
  items: { filename: string; blob: Blob }[],
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const zip = new JSZip();

  // Add each file to the zip
  for (const item of items) {
    zip.file(item.filename, item.blob);
  }

  // Generate ZIP in browser
  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      onProgress?.(Math.round(metadata.percent));
    }
  );

  return zipBlob;
}

/**
 * Triggers a direct browser file download
 */
export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
