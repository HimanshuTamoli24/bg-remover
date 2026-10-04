export type QueueItemStatus = 'waiting' | 'processing' | 'completed' | 'failed';

export interface QueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  originalUrl: string;
  originalWidth?: number;
  originalHeight?: number;
  status: QueueItemStatus;
  progress: number;
  errorMessage?: string;
  resultBlob?: Blob;
  resultUrl?: string;
  maskBlob?: Blob;
  maskUrl?: string;
  durationMs?: number;
  userEditedResultUrl?: string;
  userEditedResultBlob?: Blob;
}

export type BackgroundType = 'transparent' | 'white' | 'black' | 'custom' | 'image';
export type ProductPosition = 'center' | 'fit' | 'contain' | 'custom';
export type ExportFormat = 'png' | 'jpg' | 'webp';
export type AspectRatioPreset = 'original' | '1:1' | '4:5' | '3:4' | '16:9' | '9:16' | 'custom';
export type ShadowPreset = 'none' | 'soft' | 'natural' | 'strong' | 'custom';
export type EcommercePreset = 'custom' | 'meesho' | 'amazon' | 'shopify' | 'instagram';

export interface CustomBackgroundImage {
  url: string;
  fit: 'cover' | 'contain';
  zoom: number; // 0.5 to 2.0 (default 1)
  offsetX: number; // -100 to 100%
  offsetY: number; // -100 to 100%
  blur: number; // 0 to 30px
}

export interface ShadowSettings {
  enabled: boolean;
  preset: ShadowPreset;
  opacity: number; // 0 - 1
  blur: number; // 0 - 60
  offsetX: number; // -50 - 50
  offsetY: number; // -50 - 50
  spread: number; // 0 - 20
}

export interface BorderSettings {
  enabled: boolean;
  color: string;
  width: number; // 0 - 20px
  radius: number; // 0 - 50px
}

export interface ImageAdjustments {
  brightness: number; // -100 to 100 (0 default)
  contrast: number; // -100 to 100 (0 default)
  saturation: number; // -100 to 100 (0 default)
  sharpness: number; // 0 to 100 (0 default)
  blur: number; // 0 to 20 (0 default)
}

export interface ProductTransform {
  zoom: number; // 0.2 to 3.0 (default 1.0 = 100%)
  offsetX: number; // px offset from center
  offsetY: number; // px offset from center
  rotation: number; // 0 to 360 deg
  flipH: boolean;
  flipV: boolean;
}

export interface CropBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EditorSettings {
  // Background
  backgroundType: BackgroundType;
  customColor: string;
  bgImageSettings?: CustomBackgroundImage | null;

  // Positioning & Transform
  positioning: ProductPosition;
  padding: number; // 0 to 40 percentage
  transform: ProductTransform;

  // Canvas & Composition
  aspectRatio: AspectRatioPreset;
  customWidth?: number;
  customHeight?: number;
  crop?: CropBounds | null;

  // Effects
  shadow: boolean;
  shadowBlur: number;
  shadowOpacity: number;
  shadowOffsetY: number;
  shadowSettings: ShadowSettings;
  borderSettings: BorderSettings;

  // Image adjustments
  adjustments: ImageAdjustments;

  // Preset
  activePreset?: EcommercePreset;

  // Edge & Export options
  refineEdges: boolean;
  defringe: boolean;
  exportFormat: ExportFormat;
}

export const DEFAULT_TRANSFORM: ProductTransform = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  flipH: false,
  flipV: false,
};

export const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpness: 0,
  blur: 0,
};

export const DEFAULT_SHADOW_SETTINGS: ShadowSettings = {
  enabled: false,
  preset: 'none',
  opacity: 0.25,
  blur: 20,
  offsetX: 0,
  offsetY: 12,
  spread: 0,
};

export const DEFAULT_BORDER_SETTINGS: BorderSettings = {
  enabled: false,
  color: '#000000',
  width: 0,
  radius: 0,
};

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  backgroundType: 'transparent',
  customColor: '#ffffff',
  bgImageSettings: null,
  positioning: 'contain',
  padding: 8,
  transform: { ...DEFAULT_TRANSFORM },
  aspectRatio: 'original',
  crop: null,
  shadow: false,
  shadowBlur: 20,
  shadowOpacity: 0.25,
  shadowOffsetY: 12,
  shadowSettings: { ...DEFAULT_SHADOW_SETTINGS },
  borderSettings: { ...DEFAULT_BORDER_SETTINGS },
  adjustments: { ...DEFAULT_ADJUSTMENTS },
  activePreset: 'custom',
  refineEdges: true,
  defringe: true,
  exportFormat: 'png',
};

export interface ModelInfo {
  id: string;
  hubId: string;
  name: string;
  tagline: string;
  size: string;
  recommended?: boolean;
  isLite?: boolean;
}

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'rmbg-1.4',
    hubId: 'briaai/RMBG-1.4',
    name: 'BRIA RMBG-1.4',
    tagline: 'Lightweight & instant for products (~44 MB, recommended for all devices)',
    size: '~44 MB',
    recommended: true,
  },
  {
    id: 'birefnet-lite',
    hubId: 'onnx-community/BiRefNet_lite-ONNX',
    name: 'BiRefNet Lite',
    tagline: 'High-resolution refiner for complex edges (~110 MB WebGPU / ~224 MB CPU)',
    size: '~110–224 MB',
    isLite: true,
  },
  {
    id: 'birefnet-full',
    hubId: 'onnx-community/BiRefNet-ONNX',
    name: 'BiRefNet (Full)',
    tagline: 'Heavy studio model (~490 MB WebGPU / ~928 MB CPU, requires high RAM/GPU)',
    size: '~490–928 MB',
  },
];

export interface ModelProgressEvent {
  status: 'init' | 'downloading' | 'loading' | 'ready' | 'error';
  progress?: number;
  loaded?: number;
  total?: number;
  file?: string;
  message?: string;
}

export interface ProcessingResult {
  resultImageData: ImageData;
  maskImageData: ImageData;
  width: number;
  height: number;
}
