'use client';

import React, { useState } from 'react';
import { QueueItem } from '@/types/image';
import { formatBytes, sanitizeFilename } from '@/lib/utils';
import {
  Loader2,
  Trash2,
  Download,
  Copy,
  Check,
  Maximize2,
  RotateCcw,
} from 'lucide-react';
import { triggerBrowserDownload } from '@/lib/image-processing/export';

interface ImageCardProps {
  item: QueueItem;
  isSelected: boolean;
  onSelect: (item: QueueItem) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  disabled?: boolean;
}

export function ImageCard({
  item,
  isSelected,
  onSelect,
  onRemove,
  onRetry,
  disabled,
}: ImageCardProps) {
  const [isCopied, setIsCopied] = useState(false);

  const isCompleted = item.status === 'completed';
  const isProcessing = item.status === 'processing';
  const isFailed = item.status === 'failed';
  const isWaiting = item.status === 'waiting';

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.resultBlob) {
      const filename = sanitizeFilename(item.name, '-transparent');
      triggerBrowserDownload(item.resultBlob, filename);
    }
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.resultBlob) return;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': item.resultBlob }),
      ]);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.warn('Clipboard write error:', err);
    }
  };

  return (
    <div
      onClick={() => onSelect(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSelect(item);
        }
      }}
      className={`group relative flex flex-col rounded-lg overflow-hidden border transition-colors cursor-pointer select-none bg-[var(--surface)] text-[var(--text-primary)] ${
        isSelected
          ? 'border-[var(--text-primary)]'
          : 'border-[var(--border)] hover:border-[var(--border-strong)]'
      }`}
    >
      {/* Thumbnail Area */}
      <div
        className={`relative aspect-square w-full flex items-center justify-center overflow-hidden border-b border-[var(--border)] ${
          isCompleted ? 'checkerboard-pattern' : 'bg-[var(--background)]'
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={isCompleted && item.resultUrl ? item.resultUrl : item.originalUrl}
          alt={item.name}
          className="max-h-full max-w-full object-contain p-2.5 transition-transform"
        />

        {/* Minimal Processing Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-[var(--background)]/85 flex flex-col items-center justify-center p-3">
            <Loader2 className="w-5 h-5 text-[var(--text-primary)] animate-spin mb-1.5" />
            <span className="text-xs font-medium text-[var(--text-primary)]">Processing…</span>
            <span className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">
              {item.progress}%
            </span>
          </div>
        )}

        {/* Minimal Failed Overlay */}
        {isFailed && (
          <div className="absolute inset-0 bg-[var(--surface)]/95 flex flex-col items-center justify-center p-3 text-center">
            <span className="text-xs font-medium text-[var(--text-primary)] mb-1">
              Could not process
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRetry(item.id);
              }}
              className="mt-1.5 px-2 py-1 text-xs rounded border border-[var(--border-strong)] bg-[var(--background)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3 text-[var(--text-muted)]" />
              Retry
            </button>
          </div>
        )}

        {/* Minimal Status indicator tag */}
        <div className="absolute top-2 left-2 text-[10px] font-mono px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--background)]/90 text-[var(--text-muted)]">
          {isWaiting && 'Queued'}
          {isProcessing && 'Processing'}
          {isCompleted && 'Ready'}
          {isFailed && 'Failed'}
        </div>
      </div>

      {/* Card Info Footer */}
      <div className="p-2.5 flex flex-col justify-between gap-2 flex-1">
        <div>
          <p
            className="text-xs font-medium text-[var(--text-primary)] truncate"
            title={item.name}
          >
            {item.name}
          </p>
          <p className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">
            {item.originalWidth && item.originalHeight
              ? `${item.originalWidth} × ${item.originalHeight}`
              : formatBytes(item.size)}
          </p>
        </div>

        {/* Card Actions: Preview / Copy / Download / Delete */}
        <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-1 text-xs">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(item);
            }}
            className="text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors py-0.5"
          >
            Preview
          </button>

          <div className="flex items-center gap-1">
            {isCompleted && (
              <>
                <button
                  type="button"
                  onClick={handleCopy}
                  title="Copy to clipboard"
                  aria-label="Copy to clipboard"
                  className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
                >
                  {isCopied ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  title="Download PNG"
                  aria-label="Download PNG"
                  className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item.id);
                }}
                title="Remove image"
                aria-label="Remove image"
                className="p-1 rounded text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
