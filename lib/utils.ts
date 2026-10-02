export { cn } from "cn";

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function sanitizeFilename(filename: string, suffix = '-nobg', ext = '.png'): string {
  const dotIndex = filename.lastIndexOf('.');
  const baseName = dotIndex !== -1 ? filename.substring(0, dotIndex) : filename;
  const cleanBase = baseName.replace(/[^a-zA-Z0-9_\-]/g, '_');
  // Avoid double extension if suffix already includes it
  if (suffix.endsWith('.png') || suffix.endsWith('.jpg') || suffix.endsWith('.webp')) {
    return `${cleanBase}${suffix}`;
  }
  return `${cleanBase}${suffix}${ext}`;
}

export function isWebGPUSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}
