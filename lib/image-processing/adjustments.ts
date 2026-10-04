import {
  ImageAdjustments,
  ShadowPreset,
  ShadowSettings,
  EcommercePreset,
  EditorSettings,
  DEFAULT_EDITOR_SETTINGS,
} from '@/types/image';

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

/**
 * Scans image/canvas alpha channel to determine the exact bounding box of the product.
 * Efficiently samples pixels to detect bounding extents.
 */
export function detectProductBounds(
  source: HTMLImageElement | HTMLCanvasElement
): BoundingBox {
  const naturalWidth =
    'naturalWidth' in source ? source.naturalWidth : source.width;
  const naturalHeight =
    'naturalHeight' in source ? source.naturalHeight : source.height;

  const w = naturalWidth || 800;
  const h = naturalHeight || 800;

  // Use a downsampled canvas for ultra-fast bounding box detection if image is very large
  const maxScanDim = 600;
  const scale = Math.min(1, maxScanDim / Math.max(w, h));
  const scanW = Math.max(1, Math.round(w * scale));
  const scanH = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = scanW;
  canvas.height = scanH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    return {
      minX: 0,
      minY: 0,
      maxX: w,
      maxY: h,
      width: w,
      height: h,
      centerX: w / 2,
      centerY: h / 2,
    };
  }

  ctx.drawImage(source, 0, 0, scanW, scanH);
  const imgData = ctx.getImageData(0, 0, scanW, scanH);
  const data = imgData.data;

  let minX = scanW;
  let minY = scanH;
  let maxX = 0;
  let maxY = 0;
  let hasPixels = false;

  // Scan alpha channel
  for (let y = 0; y < scanH; y++) {
    for (let x = 0; x < scanW; x++) {
      const alpha = data[(y * scanW + x) * 4 + 3];
      if (alpha > 15) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        hasPixels = true;
      }
    }
  }

  // Free memory
  canvas.width = 0;
  canvas.height = 0;

  if (!hasPixels || maxX < minX || maxY < minY) {
    return {
      minX: 0,
      minY: 0,
      maxX: w,
      maxY: h,
      width: w,
      height: h,
      centerX: w / 2,
      centerY: h / 2,
    };
  }

  // Scale back to original coordinates
  const origMinX = Math.max(0, Math.floor(minX / scale));
  const origMinY = Math.max(0, Math.floor(minY / scale));
  const origMaxX = Math.min(w, Math.ceil(maxX / scale));
  const origMaxY = Math.min(h, Math.ceil(maxY / scale));

  const boxW = Math.max(1, origMaxX - origMinX);
  const boxH = Math.max(1, origMaxY - origMinY);

  return {
    minX: origMinX,
    minY: origMinY,
    maxX: origMaxX,
    maxY: origMaxY,
    width: boxW,
    height: boxH,
    centerX: origMinX + boxW / 2,
    centerY: origMinY + boxH / 2,
  };
}

/**
 * Returns CSS filter string for standard adjustments.
 */
export function getAdjustmentsFilterString(adjustments: ImageAdjustments): string {
  const b = 100 + (adjustments.brightness || 0);
  const c = 100 + (adjustments.contrast || 0);
  const s = 100 + (adjustments.saturation || 0);
  const blur = adjustments.blur || 0;

  const filters: string[] = [];
  if (b !== 100) filters.push(`brightness(${Math.max(0, b)}%)`);
  if (c !== 100) filters.push(`contrast(${Math.max(0, c)}%)`);
  if (s !== 100) filters.push(`saturate(${Math.max(0, s)}%)`);
  if (blur > 0) filters.push(`blur(${blur}px)`);

  return filters.length > 0 ? filters.join(' ') : 'none';
}

/**
 * Applies a 3x3 unsharp mask convolution kernel to enhance edge sharpness.
 */
export function applySharpnessFilter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sharpness: number
): void {
  if (!sharpness || sharpness <= 0) return;

  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const src = imgData.data;
    const output = ctx.createImageData(width, height);
    const dst = output.data;

    // Kernel strength: 0 to 100 -> k: 0 to 0.6
    const k = (sharpness / 100) * 0.55;
    const centerWeight = 1 + 4 * k;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const alpha = src[idx + 3];

        if (alpha < 10) {
          // Transparent pixel
          dst[idx + 3] = 0;
          continue;
        }

        // Clamp coordinates for border pixels
        const top = (Math.max(0, y - 1) * width + x) * 4;
        const bottom = (Math.min(height - 1, y + 1) * width + x) * 4;
        const left = (y * width + Math.max(0, x - 1)) * 4;
        const right = (y * width + Math.min(width - 1, x + 1)) * 4;

        for (let c = 0; c < 3; c++) {
          const val =
            src[idx + c] * centerWeight -
            (src[top + c] + src[bottom + c] + src[left + c] + src[right + c]) * k;
          dst[idx + c] = Math.min(255, Math.max(0, Math.round(val)));
        }
        dst[idx + 3] = alpha;
      }
    }

    ctx.putImageData(output, 0, 0);
  } catch (err) {
    console.warn('Sharpness convolution skipped:', err);
  }
}

/**
 * Returns predefined shadow presets.
 */
export function getShadowPresetConfig(preset: ShadowPreset): ShadowSettings {
  switch (preset) {
    case 'none':
      return {
        enabled: false,
        preset: 'none',
        opacity: 0,
        blur: 0,
        offsetX: 0,
        offsetY: 0,
        spread: 0,
      };
    case 'soft':
      return {
        enabled: true,
        preset: 'soft',
        opacity: 0.16,
        blur: 16,
        offsetX: 0,
        offsetY: 10,
        spread: 0,
      };
    case 'natural':
      return {
        enabled: true,
        preset: 'natural',
        opacity: 0.28,
        blur: 24,
        offsetX: 0,
        offsetY: 16,
        spread: 2,
      };
    case 'strong':
      return {
        enabled: true,
        preset: 'strong',
        opacity: 0.45,
        blur: 36,
        offsetX: 0,
        offsetY: 22,
        spread: 4,
      };
    default:
      return {
        enabled: false,
        preset: 'none',
        opacity: 0.25,
        blur: 20,
        offsetX: 0,
        offsetY: 12,
        spread: 0,
      };
  }
}

/**
 * Generates ready-to-use e-commerce presets:
 * - Meesho: Square 1:1, Clean pure white background, centered, 10% padding, crisp fit, JPG format
 * - Amazon: Square 1:1, Pure White background #FFFFFF (strict standard), 8% padding (fills >85%), JPG format
 * - Shopify: Square 1:1 or 4:5, Soft studio shadow, 10% padding, WebP/PNG format
 * - Instagram: Square 1:1 or 4:5, Natural contact shadow, 12% padding, PNG format
 */
export function applyEcommercePreset(
  preset: EcommercePreset,
  currentSettings: EditorSettings
): EditorSettings {
  if (preset === 'meesho') {
    return {
      ...currentSettings,
      activePreset: 'meesho',
      backgroundType: 'white',
      customColor: '#ffffff',
      bgImageSettings: null,
      aspectRatio: '1:1',
      positioning: 'contain',
      padding: 10,
      transform: {
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        rotation: 0,
        flipH: false,
        flipV: false,
      },
      shadow: false,
      shadowSettings: getShadowPresetConfig('none'),
      borderSettings: { enabled: false, color: '#000000', width: 0, radius: 0 },
      adjustments: { brightness: 2, contrast: 4, saturation: 2, sharpness: 10, blur: 0 },
      exportFormat: 'jpg',
    };
  }

  if (preset === 'amazon') {
    return {
      ...currentSettings,
      activePreset: 'amazon',
      backgroundType: 'white',
      customColor: '#ffffff',
      bgImageSettings: null,
      aspectRatio: '1:1',
      positioning: 'contain',
      padding: 8, // Product fills >85% of frame per Amazon guideline
      transform: {
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        rotation: 0,
        flipH: false,
        flipV: false,
      },
      shadow: false,
      shadowSettings: getShadowPresetConfig('none'),
      borderSettings: { enabled: false, color: '#000000', width: 0, radius: 0 },
      adjustments: { brightness: 0, contrast: 5, saturation: 0, sharpness: 15, blur: 0 },
      exportFormat: 'jpg',
    };
  }

  if (preset === 'shopify') {
    return {
      ...currentSettings,
      activePreset: 'shopify',
      backgroundType: 'white',
      customColor: '#ffffff',
      bgImageSettings: null,
      aspectRatio: '1:1',
      positioning: 'contain',
      padding: 10,
      transform: {
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        rotation: 0,
        flipH: false,
        flipV: false,
      },
      shadow: true,
      shadowBlur: 20,
      shadowOpacity: 0.2,
      shadowOffsetY: 12,
      shadowSettings: getShadowPresetConfig('soft'),
      borderSettings: { enabled: false, color: '#000000', width: 0, radius: 0 },
      adjustments: { brightness: 2, contrast: 3, saturation: 5, sharpness: 12, blur: 0 },
      exportFormat: 'webp',
    };
  }

  if (preset === 'instagram') {
    return {
      ...currentSettings,
      activePreset: 'instagram',
      backgroundType: 'white',
      customColor: '#ffffff',
      bgImageSettings: null,
      aspectRatio: '4:5',
      positioning: 'contain',
      padding: 12,
      transform: {
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        rotation: 0,
        flipH: false,
        flipV: false,
      },
      shadow: true,
      shadowBlur: 24,
      shadowOpacity: 0.25,
      shadowOffsetY: 16,
      shadowSettings: getShadowPresetConfig('natural'),
      borderSettings: { enabled: false, color: '#000000', width: 0, radius: 0 },
      adjustments: { brightness: 2, contrast: 4, saturation: 8, sharpness: 10, blur: 0 },
      exportFormat: 'png',
    };
  }

  // Custom or default
  return {
    ...currentSettings,
    activePreset: 'custom',
  };
}
