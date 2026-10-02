import { scaleImageData } from './resize';

export interface MaskRefinementOptions {
  defringe?: boolean;
  refineEdges?: boolean;
  featherRadius?: number;
}

/**
 * Creates an ImageData object representing the grayscale mask (0=bg, 255=fg)
 */
export function createGrayscaleMaskImageData(
  maskData: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): ImageData {
  const result = new ImageData(width, height);
  const data = result.data;
  const totalPixels = width * height;

  for (let i = 0; i < totalPixels; i++) {
    const val = maskData[i];
    const offset = i * 4;
    data[offset] = val;
    data[offset + 1] = val;
    data[offset + 2] = val;
    data[offset + 3] = 255;
  }

  return result;
}

/**
 * Combines original image with a mask and applies edge refinement & despill (halo removal).
 * Accurately scales the mask to the original image dimensions without losing original resolution.
 */
export function applyMaskToOriginal(
  originalImageData: ImageData,
  maskImageData: ImageData,
  options: MaskRefinementOptions = { defringe: true, refineEdges: true }
): ImageData {
  const { width, height } = originalImageData;

  // 1. Ensure mask matches original image dimensions
  let alignedMask = maskImageData;
  if (maskImageData.width !== width || maskImageData.height !== height) {
    alignedMask = scaleImageData(maskImageData, width, height);
  }

  const origPixels = originalImageData.data;
  const maskPixels = alignedMask.data;
  const totalPixels = width * height;

  const result = new ImageData(width, height);
  const outPixels = result.data;

  // Copy RGB and inject alpha from mask
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    outPixels[idx] = origPixels[idx];         // R
    outPixels[idx + 1] = origPixels[idx + 1]; // G
    outPixels[idx + 2] = origPixels[idx + 2]; // B

    // Mask value can come from red channel (or alpha if single/4 channel)
    const rawAlpha = maskPixels[idx + 3] !== undefined && maskPixels[idx] === maskPixels[idx + 1] && maskPixels[idx] === maskPixels[idx + 2]
      ? maskPixels[idx] // Grayscale mask
      : maskPixels[idx + 3]; // Alpha channel

    outPixels[idx + 3] = rawAlpha;
  }

  // 2. Edge smoothing: apply anti-aliasing sigmoid to prevent harsh stepping on angled edges
  if (options.refineEdges) {
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4 + 3;
      const a = outPixels[idx];
      // Soften transitions around the threshold while preserving solid opaque (>240) and transparent (<15)
      if (a > 15 && a < 240) {
        // Smooth non-linear curve to eliminate micro-banding
        const norm = (a - 15) / 225; // 0 to 1
        const smoothed = Math.round((Math.sin((norm - 0.5) * Math.PI) * 0.5 + 0.5) * 225 + 15);
        outPixels[idx] = smoothed;
      }
    }
  }

  // 3. Defringe / Despill (Halo removal):
  // Eliminates white halos around products shot on white backgrounds
  // and dark halos around products shot on dark backgrounds.
  if (options.defringe) {
    defringeBorders(outPixels, width, height);
  }

  return result;
}

/**
 * High-performance edge defringing.
 * For semi-transparent edge pixels (alpha between 25 and 230), finds the nearest
 * fully opaque product color and blends the edge RGB towards the product's true color.
 * This completely neutralizes studio background halos (white/gray/color bleed) on cutouts.
 */
function defringeBorders(data: Uint8ClampedArray, width: number, height: number): void {
  const semiTransparentIndices: number[] = [];

  // Pass 1: Collect boundary pixels
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];
      if (alpha > 20 && alpha < 235) {
        semiTransparentIndices.push(idx, x, y);
      }
    }
  }

  // Pass 2: Despill RGB against neighbor product color
  for (let k = 0; k < semiTransparentIndices.length; k += 3) {
    const idx = semiTransparentIndices[k];
    const x = semiTransparentIndices[k + 1];
    const y = semiTransparentIndices[k + 2];
    const alpha = data[idx + 3];

    let neighborR = 0;
    let neighborG = 0;
    let neighborB = 0;
    let count = 0;

    // Search 3x3 neighborhood for solid product pixels (alpha > 240)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nIdx = ((y + dy) * width + (x + dx)) * 4;
        if (data[nIdx + 3] >= 240) {
          neighborR += data[nIdx];
          neighborG += data[nIdx + 1];
          neighborB += data[nIdx + 2];
          count++;
        }
      }
    }

    if (count > 0) {
      const avgR = neighborR / count;
      const avgG = neighborG / count;
      const avgB = neighborB / count;

      // Blend current pixel RGB towards neighbor RGB based on transparency
      // The more transparent the edge pixel was, the more background bleed it contained
      const bleedFactor = (255 - alpha) / 255 * 0.45; // subtle, natural push
      data[idx] = Math.round(data[idx] * (1 - bleedFactor) + avgR * bleedFactor);
      data[idx + 1] = Math.round(data[idx + 1] * (1 - bleedFactor) + avgG * bleedFactor);
      data[idx + 2] = Math.round(data[idx + 2] * (1 - bleedFactor) + avgB * bleedFactor);
    }
  }
}
