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
}

export type BackgroundType = 'transparent' | 'white' | 'black' | 'custom';
export type ProductPosition = 'center' | 'fit' | 'contain';
export type ExportFormat = 'png' | 'jpg' | 'webp';

export interface EditorSettings {
  backgroundType: BackgroundType;
  customColor: string;
  positioning: ProductPosition;
  padding: number; // 0 to 40 percentage
  shadow: boolean;
  shadowBlur: number;
  shadowOpacity: number;
  shadowOffsetY: number;
  refineEdges: boolean;
  defringe: boolean;
  exportFormat: ExportFormat;
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  backgroundType: 'transparent',
  customColor: '#ffffff',
  positioning: 'contain',
  padding: 8,
  shadow: false,
  shadowBlur: 20,
  shadowOpacity: 0.25,
  shadowOffsetY: 12,
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
    tagline: 'Fastest & highly accurate for e-commerce products (~44 MB)',
    size: '~44 MB',
    recommended: true,
  },
  {
    id: 'birefnet-lite',
    hubId: 'onnx-community/BiRefNet_lite-ONNX',
    name: 'BiRefNet Lite',
    tagline: 'High-resolution bilateral refiner, preserves fine straps & wires (~110 MB)',
    size: '~110 MB',
    isLite: true,
  },
  {
    id: 'birefnet-full',
    hubId: 'onnx-community/BiRefNet-ONNX',
    name: 'BiRefNet (Full)',
    tagline: 'Maximum precision dichotomous segmentation model (~490 MB)',
    size: '~490 MB',
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
