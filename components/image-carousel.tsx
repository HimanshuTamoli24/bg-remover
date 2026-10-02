'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { QueueItem } from '@/types/image';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react';

interface ImageCarouselProps {
  items: QueueItem[];
  selectedItem: QueueItem | null;
  onSelect: (item: QueueItem) => void;
  onRemove?: (id: string) => void;
  disabled?: boolean;
}

export function ImageCarousel({
  items,
  selectedItem,
  onSelect,
  onRemove,
  disabled,
}: ImageCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeThumbRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the active thumbnail into the center of the carousel strip
  useEffect(() => {
    if (activeThumbRef.current && scrollContainerRef.current) {
      activeThumbRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [selectedItem?.id]);

  const scroll = useCallback((direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = 240;
    scrollContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl sm:rounded-2xl p-3 sm:p-4 mt-4 transition-colors">
      <div className="flex items-center justify-between gap-2 mb-2 px-1">
        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          Batch Queue ({items.length})
        </span>
        <span className="text-[11px] text-[var(--text-muted)] font-mono">
          Click image to switch preview
        </span>
      </div>

      <div className="relative flex items-center group">
        {/* Left Arrow Button */}
        {items.length > 2 && (
          <button
            type="button"
            onClick={() => scroll('left')}
            title="Scroll left"
            aria-label="Scroll carousel left"
            className="absolute left-0 z-20 w-8 h-8 rounded-full border border-[var(--border-strong)] bg-[var(--background)]/90 text-[var(--text-primary)] hover:bg-[var(--surface-hover)] shadow-sm flex items-center justify-center -ml-2 sm:-ml-3 transition-transform hover:scale-105 active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        {/* Scrollable Thumbnails Strip */}
        <div
          ref={scrollContainerRef}
          className="w-full flex items-center gap-3 overflow-x-auto py-1 px-4 scroll-smooth no-scrollbar select-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item) => {
            const isSelected = selectedItem?.id === item.id;
            const isCompleted = item.status === 'completed';
            const isProcessing = item.status === 'processing';
            const isWaiting = item.status === 'waiting';
            const isFailed = item.status === 'failed';

            return (
              <div
                key={item.id}
                ref={isSelected ? activeThumbRef : null}
                onClick={() => onSelect(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onSelect(item);
                  }
                }}
                className={`relative group/card flex-shrink-0 w-24 sm:w-28 md:w-32 rounded-lg border text-left p-1.5 transition-all outline-none cursor-pointer focus-visible:ring-1 focus-visible:ring-[var(--text-primary)] ${
                  isSelected
                    ? 'border-[var(--text-primary)] ring-2 ring-[var(--text-primary)]/20 bg-[var(--background)] shadow-sm scale-[1.02]'
                    : 'border-[var(--border)] hover:border-[var(--border-strong)] bg-[var(--surface)] opacity-75 hover:opacity-100'
                }`}
              >
                {/* Delete Thumbnail Button with subtle red on hover */}
                {onRemove && !disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(item.id);
                    }}
                    title="Remove image"
                    aria-label={`Remove ${item.name}`}
                    className="absolute top-2 right-2 z-20 p-1 rounded-full bg-[var(--background)]/90 border border-[var(--border)] text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover/card:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}

                {/* Thumbnail Image Container */}
                <div
                  className={`relative w-full aspect-square rounded-md overflow-hidden flex items-center justify-center border border-[var(--border)] ${
                    isCompleted ? 'checkerboard-pattern' : 'bg-[var(--background)]'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={isCompleted && item.resultUrl ? item.resultUrl : item.originalUrl}
                    alt={item.name}
                    className="max-h-full max-w-full object-contain p-1 pointer-events-none"
                  />

                  {/* Status Indicator Badge */}
                  <div className="absolute top-1 left-1 p-0.5 rounded-full bg-[var(--background)]/90 border border-[var(--border)]">
                    {isCompleted && (
                      <CheckCircle2 className="w-3 h-3 text-[var(--text-primary)]" />
                    )}
                    {isProcessing && (
                      <Loader2 className="w-3 h-3 text-[var(--text-primary)] animate-spin" />
                    )}
                    {isWaiting && (
                      <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                    )}
                    {isFailed && (
                      <AlertCircle className="w-3 h-3 text-red-500" />
                    )}
                  </div>
                </div>

                {/* Filename caption */}
                <div className="mt-1.5 px-0.5">
                  <p
                    className="text-[11px] font-medium text-[var(--text-primary)] truncate"
                    title={item.name}
                  >
                    {item.name}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono truncate">
                    {isCompleted
                      ? 'Ready'
                      : isProcessing
                      ? `${item.progress}%`
                      : isWaiting
                      ? 'Waiting'
                      : 'Failed'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Arrow Button */}
        {items.length > 2 && (
          <button
            type="button"
            onClick={() => scroll('right')}
            title="Scroll right"
            aria-label="Scroll carousel right"
            className="absolute right-0 z-20 w-8 h-8 rounded-full border border-[var(--border-strong)] bg-[var(--background)]/90 text-[var(--text-primary)] hover:bg-[var(--surface-hover)] shadow-sm flex items-center justify-center -mr-2 sm:-mr-3 transition-transform hover:scale-105 active:scale-95"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
