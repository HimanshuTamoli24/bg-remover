'use client';

import React from 'react';
import { QueueItem, ModelProgressEvent } from '@/types/image';
import { Loader2 } from 'lucide-react';
import { formatBytes } from '@/lib/utils';

interface ProcessingProgressProps {
  items: QueueItem[];
  isProcessing: boolean;
  currentItemId: string | null;
  modelProgress: ModelProgressEvent | null;
  activeDevice: 'webgpu' | 'wasm' | 'cpu';
}

export function ProcessingProgress({
  items,
  isProcessing,
  currentItemId,
  modelProgress,
  activeDevice,
}: ProcessingProgressProps) {
  const isModelDownloading =
    modelProgress && (modelProgress.status === 'downloading' || modelProgress.status === 'loading');

  if (!isProcessing && !isModelDownloading) {
    return null;
  }

  const completedCount = items.filter((i) => i.status === 'completed').length;
  const currentItemIndex = items.findIndex((i) => i.id === currentItemId);

  return (
    <div className="w-full my-4 p-4 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs transition-colors">
      {/* 1. Model Download Banner (First-time load only) */}
      {isModelDownloading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[var(--text-primary)]">
            <span className="font-medium">
              Preparing background remover ({activeDevice.toUpperCase()})
            </span>
            <span className="font-mono text-[var(--text-muted)]">
              {modelProgress.progress || 0}%
            </span>
          </div>

          <div className="w-full bg-[var(--border)] rounded-full h-1 overflow-hidden">
            <div
              className="bg-[var(--text-primary)] h-full transition-all duration-200"
              style={{ width: `${modelProgress.progress || 0}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>
              {modelProgress.loaded && modelProgress.total
                ? `${formatBytes(modelProgress.loaded)} / ${formatBytes(modelProgress.total)}`
                : 'Downloading weights to local browser cache'}
            </span>
            <span>Cached on device for instant future runs</span>
          </div>
        </div>
      )}

      {/* 2. Batch Progress Indicator */}
      {isProcessing && !isModelDownloading && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[var(--text-primary)]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="font-medium">
              Processing {currentItemIndex !== -1 ? currentItemIndex + 1 : completedCount + 1} of {items.length}…
            </span>
          </div>

          <div className="text-[11px] font-mono text-[var(--text-muted)]">
            {completedCount} completed
          </div>
        </div>
      )}
    </div>
  );
}
