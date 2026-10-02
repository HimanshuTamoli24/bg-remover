import { getBackgroundRemover } from './model';
import { imageDataToBlob } from './resize';
import { ProcessingResult } from '@/types/image';
import { MaskRefinementOptions } from './mask';

export interface RemoveBackgroundExecutionOptions extends MaskRefinementOptions {
  modelId?: string;
  onProgress?: (progressPercent: number) => void;
}

export interface RemoveBackgroundOutput {
  resultBlob: Blob;
  resultUrl: string;
  maskBlob: Blob;
  maskUrl: string;
  width: number;
  height: number;
  durationMs: number;
}

/**
 * Removes background from an image completely in the browser.
 * Preserves original resolution and applies edge refinement & defringing.
 */
export async function removeBackgroundLocally(
  source: ImageData | ImageBitmap | HTMLImageElement | File | Blob | string,
  options: RemoveBackgroundExecutionOptions = {}
): Promise<RemoveBackgroundOutput> {
  const startTime = performance.now();
  const remover = getBackgroundRemover(options.modelId || 'rmbg-1.4');

  // Perform inference and matting
  const result: ProcessingResult = await remover.removeBackground(source, {
    defringe: options.defringe ?? true,
    refineEdges: options.refineEdges ?? true,
    onProgress: options.onProgress,
  });

  // Convert resulting ImageData to Blob
  const [resultBlob, maskBlob] = await Promise.all([
    imageDataToBlob(result.resultImageData),
    imageDataToBlob(result.maskImageData),
  ]);

  const durationMs = Math.round(performance.now() - startTime);

  return {
    resultBlob,
    resultUrl: URL.createObjectURL(resultBlob),
    maskBlob,
    maskUrl: URL.createObjectURL(maskBlob),
    width: result.width,
    height: result.height,
    durationMs,
  };
}
