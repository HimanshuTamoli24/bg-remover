'use client';

import React from 'react';
import { QueueItem, EditorSettings } from '@/types/image';
import { ImageCard } from './image-card';
import { Trash2, Square } from 'lucide-react';
import { DownloadButton } from './download-button';

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
  settings?: EditorSettings;
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
  settings,
}: ImageGridProps) {
  if (items.length === 0) return null;

  const waitingCount = items.filter((i) => i.status === 'waiting').length;
  const completedCount = items.filter((i) => i.status === 'completed').length;

  return (
    <section className="w-full mt-10">
      {/* Selected Images Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-semibold text-[var(--text-primary)]">
            Selected Images
          </h2>
          <span className="text-xs text-[var(--text-muted)] font-mono">
            {items.length} {items.length === 1 ? 'image' : 'images'}
          </span>
          {completedCount > 0 && (
            <span className="text-xs text-[var(--text-secondary)] font-mono">
              · {completedCount} ready
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Download all completed images button */}
          {completedCount > 0 && settings && (
            <DownloadButton
              items={items}
              settings={settings}
              disabled={isProcessing}
            />
          )}

          {/* Action buttons */}
          {isProcessing ? (
            <button
              onClick={onCancel}
              className="px-3 py-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Stop</span>
            </button>
          ) : waitingCount > 0 ? (
            <button
              onClick={onProcess}
              className="px-4 py-1.5 rounded-md bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:opacity-90 text-xs font-medium flex items-center gap-1.5 transition-opacity"
            >
              <span>Process {waitingCount} {waitingCount === 1 ? 'image' : 'images'}</span>
            </button>
          ) : null}

          {/* Destructive Clear All Button with subtle red on hover */}
          <button
            onClick={onClear}
            disabled={isProcessing}
            title="Clear all images"
            aria-label="Clear all images"
            className="px-2.5 py-1.5 rounded-md text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>

      {/* Responsive Grid: 4 columns desktop, 3 columns tablet, 2 columns mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
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
    </section>
  );
}
