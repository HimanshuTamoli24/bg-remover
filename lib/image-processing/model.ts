import { ModelProgressEvent, ProcessingResult, AVAILABLE_MODELS } from '@/types/image';
import { applyMaskToOriginal, createGrayscaleMaskImageData, MaskRefinementOptions } from './mask';
import { imageElementToImageData, loadImageElement } from './resize';

export interface BackgroundRemover {
  readonly id: string;
  readonly name: string;
  readonly hubId: string;
  readonly device: 'webgpu' | 'wasm' | 'cpu';

  initialize(onProgress?: (progress: ModelProgressEvent) => void): Promise<void>;
  isInitialized(): boolean;
  removeBackground(
    image: ImageData | ImageBitmap | HTMLImageElement | File | Blob | string,
    options?: MaskRefinementOptions & { onProgress?: (percent: number) => void }
  ): Promise<ProcessingResult>;
  dispose(): Promise<void>;
}

export class TransformersBackgroundRemover implements BackgroundRemover {
  public readonly id: string;
  public readonly name: string;
  public readonly hubId: string;
  public device: 'webgpu' | 'wasm' | 'cpu' = 'wasm';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private model: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private processor: any = null;
  private initializingPromise: Promise<void> | null = null;

  constructor(modelId = 'rmbg-1.4') {
    const found = AVAILABLE_MODELS.find((m) => m.id === modelId) || AVAILABLE_MODELS[0];
    this.id = found.id;
    this.name = found.name;
    this.hubId = found.hubId;
  }

  public isInitialized(): boolean {
    return this.model !== null && this.processor !== null;
  }

  public async initialize(onProgress?: (progress: ModelProgressEvent) => void): Promise<void> {
    if (this.isInitialized()) {
      onProgress?.({ status: 'ready', progress: 100, message: 'Model is ready' });
      return;
    }

    if (this.initializingPromise) {
      return this.initializingPromise;
    }

    this.initializingPromise = (async () => {
      if (typeof window === 'undefined') {
        throw new Error('BackgroundRemover must be initialized in a browser environment');
      }

      onProgress?.({
        status: 'init',
        progress: 0,
        message: 'Initializing browser AI runtime...',
      });

      // Dynamically import @huggingface/transformers
      const { AutoModel, AutoProcessor, env } = await import('@huggingface/transformers');

      // Configure client-side environment
      env.allowLocalModels = false;
      env.useBrowserCache = true;

      // Determine acceleration device
      const hasWebGpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
      this.device = hasWebGpu ? 'webgpu' : 'wasm';

      const fileLoads: Record<string, { loaded: number; total: number }> = {};

      const progressCallback = (event: {
        status: string;
        file?: string;
        loaded?: number;
        total?: number;
        progress?: number;
        name?: string;
      }) => {
        if (!onProgress) return;

        if (event.status === 'initiate') {
          onProgress({
            status: 'downloading',
            progress: 0,
            file: event.file,
            message: `Starting download: ${event.file || 'model weights'}...`,
          });
        } else if (event.status === 'progress' && event.file) {
          fileLoads[event.file] = {
            loaded: event.loaded || 0,
            total: event.total || 0,
          };

          let totalLoaded = 0;
          let totalBytes = 0;
          for (const item of Object.values(fileLoads)) {
            totalLoaded += item.loaded;
            totalBytes += item.total;
          }

          const percent =
            totalBytes > 0
              ? Math.min(99, Math.round((totalLoaded / totalBytes) * 100))
              : (event.progress || 0);

          onProgress({
            status: 'downloading',
            progress: percent,
            loaded: totalLoaded,
            total: totalBytes,
            file: event.file,
            message: `Downloading AI model: ${percent}%`,
          });
        } else if (event.status === 'done') {
          onProgress({
            status: 'loading',
            progress: 99,
            file: event.file,
            message: 'Loading model into browser memory...',
          });
        }
      };

      try {
        // Try WebGPU first if supported
        this.model = await AutoModel.from_pretrained(this.hubId, {
          device: this.device,
          progress_callback: progressCallback,
          dtype: 'fp32',
        });
      } catch (gpuError) {
        console.warn(`Failed to initialize on ${this.device}, falling back to wasm:`, gpuError);
        this.device = 'wasm';
        onProgress?.({
          status: 'loading',
          progress: 50,
          message: 'Falling back to WebAssembly CPU engine...',
        });

        this.model = await AutoModel.from_pretrained(this.hubId, {
          device: 'wasm',
          progress_callback: progressCallback,
          dtype: 'fp32',
        });
      }

      // Load processor
      this.processor = await AutoProcessor.from_pretrained(this.hubId, {
        progress_callback: progressCallback,
      });

      onProgress?.({
        status: 'ready',
        progress: 100,
        message: `Ready (${this.device.toUpperCase()})`,
      });
    })();

    return this.initializingPromise;
  }

  public async removeBackground(
    imageSource: ImageData | ImageBitmap | HTMLImageElement | File | Blob | string,
    options?: MaskRefinementOptions & { onProgress?: (percent: number) => void }
  ): Promise<ProcessingResult> {
    if (!this.isInitialized()) {
      await this.initialize();
    }

    if (!this.model || !this.processor) {
      throw new Error('AI Background Remover failed to initialize');
    }

    const { RawImage } = await import('@huggingface/transformers');

    // 1. Resolve source to original ImageData (preserving original resolution)
    let originalImageData: ImageData;
    let cleanupBitmap: ImageBitmap | null = null;

    if (imageSource instanceof ImageData) {
      originalImageData = imageSource;
    } else if (typeof ImageBitmap !== 'undefined' && imageSource instanceof ImageBitmap) {
      cleanupBitmap = imageSource;
      const canvas = document.createElement('canvas');
      canvas.width = imageSource.width;
      canvas.height = imageSource.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Could not create 2D canvas context');
      ctx.drawImage(imageSource, 0, 0);
      originalImageData = ctx.getImageData(0, 0, imageSource.width, imageSource.height);
      canvas.width = 0;
      canvas.height = 0;
    } else if (typeof HTMLImageElement !== 'undefined' && imageSource instanceof HTMLImageElement) {
      originalImageData = imageElementToImageData(imageSource);
    } else {
      const img = await loadImageElement(imageSource as File | Blob | string);
      originalImageData = imageElementToImageData(img);
    }

    const origWidth = originalImageData.width;
    const origHeight = originalImageData.height;

    options?.onProgress?.(15);

    // 2. Wrap image for Transformers.js
    const rawImg = new RawImage(
      originalImageData.data,
      origWidth,
      origHeight,
      4
    );

    options?.onProgress?.(30);

    // 3. Preprocess image
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inputs: any = await this.processor(rawImg);

    // Map input tensor name to model's expected input name
    const session = this.model.sessions?.['model'] || Object.values(this.model.sessions || {})[0];
    const sessionInputNames: string[] = session?.inputNames || [];
    if (sessionInputNames.length > 0 && !sessionInputNames.includes('pixel_values')) {
      const targetInputName = sessionInputNames[0];
      inputs[targetInputName] = inputs.pixel_values || Object.values(inputs)[0];
    }

    options?.onProgress?.(50);

    // 4. Run model inference locally in browser
    const outputs = await this.model(inputs);

    options?.onProgress?.(75);

    // 5. Extract output segmentation tensor
    const sessionOutputNames: string[] = session?.outputNames || [];
    const outputKey = sessionOutputNames.length > 0 ? sessionOutputNames[0] : Object.keys(outputs)[0];
    const outputTensor = outputs[outputKey];

    if (!outputTensor) {
      throw new Error('Segmentation model did not return output tensor');
    }

    // 6. Process tensor into alpha mask: apply sigmoid, convert to uint8 [0..255]
    // Shape is typically [1, 1, H, W] or [1, H, W]
    const item = outputTensor[0];
    const epsilon = 1e-5;
    if (item.data.some((x: number) => x < -epsilon || x > 1 + epsilon)) {
      item.sigmoid_();
    }

    const maskTensor = item.mul_(255).to('uint8');

    // Scale mask back to 100% of original image dimensions
    const maskRawImage = await RawImage.fromTensor(maskTensor).resize(origWidth, origHeight);

    // Create grayscale mask ImageData
    let maskImageData: ImageData;
    if (maskRawImage.channels === 1) {
      maskImageData = createGrayscaleMaskImageData(
        maskRawImage.data,
        maskRawImage.width,
        maskRawImage.height
      );
    } else {
      const maskPixels = new Uint8ClampedArray(origWidth * origHeight);
      const srcData = maskRawImage.data;
      for (let i = 0; i < maskPixels.length; i++) {
        maskPixels[i] = srcData[i * maskRawImage.channels];
      }
      maskImageData = createGrayscaleMaskImageData(maskPixels, origWidth, origHeight);
    }

    options?.onProgress?.(88);

    // 7. Apply mask directly to full original resolution with edge refinement & despill
    const refinedResult = applyMaskToOriginal(originalImageData, maskImageData, {
      defringe: options?.defringe ?? true,
      refineEdges: options?.refineEdges ?? true,
    });

    options?.onProgress?.(100);

    // Release temporary bitmap if any
    if (cleanupBitmap) {
      try {
        cleanupBitmap.close();
      } catch {
        // Ignore
      }
    }

    return {
      resultImageData: refinedResult,
      maskImageData,
      width: origWidth,
      height: origHeight,
    };
  }

  public async dispose(): Promise<void> {
    if (this.model) {
      try {
        if (typeof this.model.dispose === 'function') {
          await this.model.dispose();
        }
      } catch (err) {
        console.warn('Error disposing model:', err);
      }
      this.model = null;
    }
    this.processor = null;
    this.initializingPromise = null;
  }
}

const instances: Map<string, TransformersBackgroundRemover> = new Map();

export function getBackgroundRemover(modelId = 'rmbg-1.4'): BackgroundRemover {
  if (!instances.has(modelId)) {
    instances.set(modelId, new TransformersBackgroundRemover(modelId));
  }
  return instances.get(modelId)!;
}
