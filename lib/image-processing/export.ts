import JSZip from 'jszip';
import { EditorSettings, AspectRatioPreset } from '@/types/image';
import { canvasToBlob, loadImageElement } from './resize';
import {
  getAdjustmentsFilterString,
  applySharpnessFilter,
} from './adjustments';

/**
 * Calculates canvas dimensions based on chosen aspect ratio preset
 */
export function calculateAspectRatioDimensions(
  naturalWidth: number,
  naturalHeight: number,
  aspectRatio: AspectRatioPreset = 'original',
  customWidth?: number,
  customHeight?: number
): { width: number; height: number } {
  const origW = naturalWidth || 800;
  const origH = naturalHeight || 800;

  switch (aspectRatio) {
    case '1:1': {
      const size = Math.max(origW, origH);
      return { width: size, height: size };
    }
    case '4:5': {
      if (origW / origH > 4 / 5) {
        return { width: origW, height: Math.round(origW * (5 / 4)) };
      } else {
        return { width: Math.round(origH * (4 / 5)), height: origH };
      }
    }
    case '3:4': {
      if (origW / origH > 3 / 4) {
        return { width: origW, height: Math.round(origW * (4 / 3)) };
      } else {
        return { width: Math.round(origH * (3 / 4)), height: origH };
      }
    }
    case '16:9': {
      if (origW / origH > 16 / 9) {
        return { width: origW, height: Math.round(origW * (9 / 16)) };
      } else {
        return { width: Math.round(origH * (16 / 9)), height: origH };
      }
    }
    case '9:16': {
      if (origW / origH > 9 / 16) {
        return { width: origW, height: Math.round(origW * (16 / 9)) };
      } else {
        return { width: Math.round(origH * (9 / 16)), height: origH };
      }
    }
    case 'custom': {
      return {
        width: Math.max(50, customWidth || origW),
        height: Math.max(50, customHeight || origH),
      };
    }
    case 'original':
    default:
      return { width: origW, height: origH };
  }
}

/**
 * Renders the cutout image onto an export canvas with full professional styling:
 * - Background (transparent, white, black, custom color, custom background image)
 * - Positioning (contain, fit, center, custom drag & zoom)
 * - Rotation and flipping (horizontal/vertical)
 * - Studio shadow with presets (soft, natural, strong) and full controls
 * - Border / stroke (color, width, radius)
 * - Essential adjustments (brightness, contrast, saturation, sharpness, blur)
 * - Crop & aspect ratio presets
 */
export function renderEditedImageCanvas(
  cutoutElement: HTMLImageElement | HTMLCanvasElement,
  settings: EditorSettings,
  targetWidth?: number,
  targetHeight?: number,
  bgImageElement?: HTMLImageElement | null
): HTMLCanvasElement {
  const naturalWidth =
    ('naturalWidth' in cutoutElement
      ? cutoutElement.naturalWidth
      : cutoutElement.width) || 800;
  const naturalHeight =
    ('naturalHeight' in cutoutElement
      ? cutoutElement.naturalHeight
      : cutoutElement.height) || 800;

  // 1. Calculate base aspect ratio dimensions
  const fullDims = calculateAspectRatioDimensions(
    naturalWidth,
    naturalHeight,
    settings.aspectRatio,
    settings.customWidth,
    settings.customHeight
  );

  let canvasWidth = fullDims.width;
  let canvasHeight = fullDims.height;

  // If rendering for preview with a bounding constraint, scale down proportionally
  if (targetWidth && targetHeight) {
    const scale = Math.min(
      targetWidth / fullDims.width,
      targetHeight / fullDims.height
    );
    canvasWidth = Math.max(1, Math.round(fullDims.width * scale));
    canvasHeight = Math.max(1, Math.round(fullDims.height * scale));
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Failed to create canvas 2D rendering context');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const scaleRatio = canvasWidth / 800;

  // 2. Render Background
  if (settings.backgroundType === 'white') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  } else if (settings.backgroundType === 'black') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  } else if (settings.backgroundType === 'custom') {
    ctx.fillStyle = settings.customColor || '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  } else if (settings.backgroundType === 'image' && bgImageElement) {
    // Render custom background image with cover / contain, zoom, offset, and blur
    const bgConfig = settings.bgImageSettings || {
      fit: 'cover',
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      blur: 0,
      url: '',
    };

    const bgNatW = bgImageElement.naturalWidth || bgImageElement.width || 800;
    const bgNatH = bgImageElement.naturalHeight || bgImageElement.height || 800;

    let bgDrawW = canvasWidth;
    let bgDrawH = canvasHeight;

    const bgScaleFit =
      bgConfig.fit === 'contain'
        ? Math.min(canvasWidth / bgNatW, canvasHeight / bgNatH)
        : Math.max(canvasWidth / bgNatW, canvasHeight / bgNatH);

    const bgFinalScale = bgScaleFit * (bgConfig.zoom || 1);
    bgDrawW = bgNatW * bgFinalScale;
    bgDrawH = bgNatH * bgFinalScale;

    const bgDrawX =
      (canvasWidth - bgDrawW) / 2 + ((bgConfig.offsetX || 0) / 100) * canvasWidth;
    const bgDrawY =
      (canvasHeight - bgDrawH) / 2 + ((bgConfig.offsetY || 0) / 100) * canvasHeight;

    ctx.save();
    if (bgConfig.blur && bgConfig.blur > 0) {
      ctx.filter = `blur(${bgConfig.blur * scaleRatio}px)`;
    }
    ctx.drawImage(bgImageElement, bgDrawX, bgDrawY, bgDrawW, bgDrawH);
    ctx.restore();
  } else {
    // Transparent (or White for JPEG which lacks alpha channel)
    if (settings.exportFormat === 'jpg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    } else {
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    }
  }

  // 3. Calculate Product Positioning, Padding, and Drag/Zoom/Transform
  const paddingPercent = Math.max(0, Math.min(40, settings.padding)) / 100;
  const paddedWidth = canvasWidth * (1 - paddingPercent * 2);
  const paddedHeight = canvasHeight * (1 - paddingPercent * 2);

  let baseScale = Math.min(
    paddedWidth / naturalWidth,
    paddedHeight / naturalHeight
  );

  if (settings.positioning === 'center') {
    if (naturalWidth <= paddedWidth && naturalHeight <= paddedHeight) {
      baseScale = 1;
    }
  }

  const transform = settings.transform || {
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    flipH: false,
    flipV: false,
  };

  const finalScale = baseScale * (transform.zoom || 1);
  const drawWidth = naturalWidth * finalScale;
  const drawHeight = naturalHeight * finalScale;

  // Normalized offset: transform.offsetX/Y is stored in canonical 800px coordinate space
  const centerX =
    canvasWidth / 2 + (transform.offsetX || 0) * (canvasWidth / 800);
  const centerY =
    canvasHeight / 2 + (transform.offsetY || 0) * (canvasHeight / 800);

  // 4. Render Product Shadow (Phase 3)
  const isShadowEnabled =
    settings.shadowSettings?.enabled ?? settings.shadow ?? false;

  if (isShadowEnabled) {
    const sOpacity =
      settings.shadowSettings?.opacity ?? settings.shadowOpacity ?? 0.25;
    const sBlur =
      (settings.shadowSettings?.blur ?? settings.shadowBlur ?? 20) * scaleRatio;
    const sOffsetX = (settings.shadowSettings?.offsetX ?? 0) * scaleRatio;
    const sOffsetY =
      (settings.shadowSettings?.offsetY ?? settings.shadowOffsetY ?? 12) *
      scaleRatio;

    ctx.save();
    ctx.translate(centerX, centerY);

    if (transform.rotation) {
      ctx.rotate((transform.rotation * Math.PI) / 180);
    }

    const scaleX = transform.flipH ? -1 : 1;
    const scaleY = transform.flipV ? -1 : 1;
    if (scaleX !== 1 || scaleY !== 1) {
      ctx.scale(scaleX, scaleY);
    }

    ctx.shadowColor = `rgba(0, 0, 0, ${sOpacity})`;
    ctx.shadowBlur = Math.max(0, sBlur);
    ctx.shadowOffsetX = sOffsetX;
    ctx.shadowOffsetY = sOffsetY;

    ctx.drawImage(
      cutoutElement,
      -drawWidth / 2,
      -drawHeight / 2,
      drawWidth,
      drawHeight
    );

    ctx.restore();
  }

  // 5. Draw Product with Image Adjustments (Phase 4)
  ctx.save();
  ctx.translate(centerX, centerY);

  if (transform.rotation) {
    ctx.rotate((transform.rotation * Math.PI) / 180);
  }

  const scaleX = transform.flipH ? -1 : 1;
  const scaleY = transform.flipV ? -1 : 1;
  if (scaleX !== 1 || scaleY !== 1) {
    ctx.scale(scaleX, scaleY);
  }

  if (settings.adjustments) {
    ctx.filter = getAdjustmentsFilterString(settings.adjustments);
  }

  ctx.drawImage(
    cutoutElement,
    -drawWidth / 2,
    -drawHeight / 2,
    drawWidth,
    drawHeight
  );

  ctx.restore();

  // 6. Apply Sharpness Convolution Filter if requested (Phase 4)
  if (settings.adjustments?.sharpness && settings.adjustments.sharpness > 0) {
    applySharpnessFilter(
      ctx,
      canvasWidth,
      canvasHeight,
      settings.adjustments.sharpness
    );
  }

  // 7. Render Border / Stroke (Phase 3)
  if (settings.borderSettings?.enabled && settings.borderSettings.width > 0) {
    const borderWidth = settings.borderSettings.width * scaleRatio;
    const borderRadius = (settings.borderSettings.radius || 0) * scaleRatio;

    ctx.save();
    ctx.strokeStyle = settings.borderSettings.color || '#000000';
    ctx.lineWidth = borderWidth;

    const halfBorder = borderWidth / 2;
    const bW = canvasWidth - borderWidth;
    const bH = canvasHeight - borderWidth;

    if (borderRadius > 0 && typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(halfBorder, halfBorder, bW, bH, borderRadius);
      ctx.stroke();
    } else {
      ctx.strokeRect(halfBorder, halfBorder, bW, bH);
    }
    ctx.restore();
  }

  // 8. Crop (Phase 2)
  if (
    settings.crop &&
    settings.crop.width > 0 &&
    settings.crop.height > 0 &&
    (settings.crop.width < 1 || settings.crop.height < 1)
  ) {
    // Crop rectangle normalized (0 to 1)
    const cropX = Math.round(settings.crop.x * canvasWidth);
    const cropY = Math.round(settings.crop.y * canvasHeight);
    const cropW = Math.round(settings.crop.width * canvasWidth);
    const cropH = Math.round(settings.crop.height * canvasHeight);

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropW;
    croppedCanvas.height = cropH;
    const cropCtx = croppedCanvas.getContext('2d');
    if (cropCtx) {
      cropCtx.drawImage(
        canvas,
        cropX,
        cropY,
        cropW,
        cropH,
        0,
        0,
        cropW,
        cropH
      );
      canvas.width = 0;
      canvas.height = 0;
      return croppedCanvas;
    }
  }

  return canvas;
}

/**
 * Exports edited canvas to a Blob with selected format (PNG, JPG, WEBP)
 */
export async function renderFinalBlob(
  cutoutElement: HTMLImageElement | HTMLCanvasElement,
  settings: EditorSettings,
  targetWidth?: number,
  targetHeight?: number
): Promise<Blob> {
  let bgImageElement: HTMLImageElement | null = null;
  if (
    settings.backgroundType === 'image' &&
    settings.bgImageSettings?.url
  ) {
    try {
      bgImageElement = await loadImageElement(settings.bgImageSettings.url);
    } catch (err) {
      console.warn('Failed to load background image for export:', err);
    }
  }

  const canvas = renderEditedImageCanvas(
    cutoutElement,
    settings,
    targetWidth,
    targetHeight,
    bgImageElement
  );

  const mimeType =
    settings.exportFormat === 'jpg'
      ? 'image/jpeg'
      : settings.exportFormat === 'webp'
      ? 'image/webp'
      : 'image/png';
  const quality = settings.exportFormat === 'png' ? 1.0 : 0.95;
  const blob = await canvasToBlob(canvas, mimeType, quality);

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

  for (const item of items) {
    zip.file(item.filename, item.blob);
  }

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
