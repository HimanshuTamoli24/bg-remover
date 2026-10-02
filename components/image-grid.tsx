'use client';

import React from 'react';
import { QueueItem } from '@/types/image';
import { ImageCard } from './image-card';
import { Trash2, Play, Square, Sparkles } from 'lucide-react';
import { MAX_BATCH_SIZE } from '@/lib/queue/image-queue';

interface ImageGridProps {
  items: QueueItem[];
  selectedItem: QueueItem | null;
  onSelect: (item: QueueItem) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onClear: () => void;
  onProcess: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}

export function ImageGrid({
  items,
  selectedItem,
  onSelect,
  onRemove,
  onRetry,
  onClear,
  onProcess,
  onCancel,
  isProcessing,
}: ImageGridProps) {
  if (items.length === 0) return null;

  const waitingCount = items.filter((i) => i.status === 'waiting').length;
  const completedCount = items.filter((i) => i.status === 'completed').length;
  const failedCount = items.filter((i) => i.status === 'failed').length;

  return (
    <div className="w-full mt-6">
      {/* Queue Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-zinc-100">
            Selected Images
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono">
            {items.length} / {MAX_BATCH_SIZE}
          </span>
          {completedCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-800/40">
              {completedCount} Done
            </span>
          )}
          {failedCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-950/70 text-red-400 border border-red-800/40">
              {failedCount} Failed
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Action buttons */}
          {isProcessing ? (
            <button
              onClick={onCancel}
              className="px-3.5 py-1.5 rounded-xl bg-red-950 hover:bg-red-900 border border-red-800/60 text-red-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              Stop Processing
            </button>
          ) : waitingCount > 0 ? (
            <button
              onClick={onProcess}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Process {waitingCount} {waitingCount === 1 ? 'Image' : 'Images'}
            </button>
          ) : null}

          <button
            onClick={onClear}
            disabled={isProcessing}
            title="Clear all images"
            className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
        {items.map((item) => (
          <ImageCard
            key={item.id}
            item={item}
            isSelected={selectedItem?.id === item.id}
            onSelect={onSelect}
            onRemove={onRemove}
            onRetry={onRetry}
            disabled={isProcessing}
          />
        ))}
      </div>
    </div>
  );
}
