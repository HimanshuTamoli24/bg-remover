'use client';

import React from 'react';
import { QueueItem } from '@/types/image';
import { formatBytes, formatDuration, sanitizeFilename } from '@/lib/utils';
import {
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  X,
  Download,
  RotateCcw,
  Eye,
  SlidersHorizontal,
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

  return (
    <div
      onClick={() => onSelect(item)}
      className={`group relative flex flex-col rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer ${
        isSelected
          ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-zinc-900'
          : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/60'
      }`}
    >
      {/* Remove Button */}
      {!disabled && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(item.id);
          }}
          title="Remove image"
          className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/60 hover:bg-red-950/80 text-zinc-400 hover:text-red-300 border border-zinc-700/50 hover:border-red-700/60 backdrop-blur transition-all opacity-0 group-hover:opacity-100"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Thumbnail Container */}
      <div
        className={`relative aspect-square w-full flex items-center justify-center overflow-hidden ${
          isCompleted ? 'checkerboard-bg' : 'bg-zinc-950'
        }`}
      >
        {/* Image preview (Result if completed, otherwise original) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={isCompleted && item.resultUrl ? item.resultUrl : item.originalUrl}
          alt={item.name}
          className="max-h-full max-w-full object-contain p-2 select-none transition-transform duration-200 group-hover:scale-[1.02]"
        />

        {/* Processing Spinner Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-2" />
            <span className="text-xs font-medium text-zinc-200">Removing background...</span>
            <div className="w-3/4 bg-zinc-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-indigo-500 h-full transition-all duration-300"
                style={{ width: `${item.progress}%` }}
              />
            </div>
            <span className="text-[10px] text-zinc-400 mt-1">{item.progress}%</span>
          </div>
        )}

        {/* Failed Overlay */}
        {isFailed && (
          <div className="absolute inset-0 bg-red-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-3 text-center">
            <AlertCircle className="w-7 h-7 text-red-400 mb-1.5" />
            <p className="text-xs font-semibold text-red-200">Processing Failed</p>
            <p className="text-[10px] text-red-300 line-clamp-2 mt-0.5 px-2">
              {item.errorMessage || 'Could not process this image.'}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRetry(item.id);
              }}
              className="mt-2 px-2.5 py-1 text-xs rounded-lg bg-red-800/80 hover:bg-red-700 text-white flex items-center gap-1 font-medium transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Retry
            </button>
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium backdrop-blur bg-black/70 border border-zinc-700/50">
          {isWaiting && (
            <>
              <Clock className="w-3 h-3 text-zinc-400" />
              <span className="text-zinc-300">Waiting</span>
            </>
          )}
          {isProcessing && (
            <>
              <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
              <span className="text-indigo-300">Processing</span>
            </>
          )}
          {isCompleted && (
            <>
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-300">
                Ready {item.durationMs ? `(${formatDuration(item.durationMs)})` : ''}
              </span>
            </>
          )}
          {isFailed && (
            <>
              <AlertCircle className="w-3 h-3 text-red-400" />
              <span className="text-red-300">Failed</span>
            </>
          )}
        </div>
      </div>

      {/* Card Info Footer */}
      <div className="p-3 bg-zinc-900/90 border-t border-zinc-800/80 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-1 mb-1">
          <p className="text-xs font-medium text-zinc-200 truncate" title={item.name}>
            {item.name}
          </p>
        </div>

        <div className="flex items-center justify-between text-[11px] text-zinc-400">
          <span>{formatBytes(item.size)}</span>
          {item.originalWidth && item.originalHeight && (
            <span>
              {item.originalWidth} × {item.originalHeight}
            </span>
          )}
        </div>

        {/* Action Buttons for Completed Items */}
        {isCompleted && (
          <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2">
            <button
              onClick={() => onSelect(item)}
              className="flex-1 py-1 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Eye className="w-3 h-3 text-zinc-400" />
              Inspect
            </button>
            <button
              onClick={handleDownload}
              title="Download transparent PNG"
              className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
