'use client';

import React, { useState, useRef, useEffect, useCallback, MouseEvent } from 'react';
import { QueueItem } from '@/types/image';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { formatDuration } from '@/lib/utils';

interface BeforeAfterProps {
  item: QueueItem;
}

type ViewMode = 'split' | 'side-by-side' | 'before' | 'after' | 'mask';

export function BeforeAfter({ item }: BeforeAfterProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [sliderPos, setSliderPos] = useState(50);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingSlider = useRef(false);

  useEffect(() => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setSliderPos(50);
  }, [item.id]);

  const handleSliderMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(percent);
  }, []);

  const onMouseDownSlider = (e: MouseEvent) => {
    e.preventDefault();
    isDraggingSlider.current = true;
  };

  const onTouchStartSlider = () => {
    isDraggingSlider.current = true;
  };

  useEffect(() => {
    const onMouseMove = (e: globalThis.MouseEvent) => {
      if (isDraggingSlider.current) {
        handleSliderMove(e.clientX);
      }
    };
    const onMouseUp = () => {
      isDraggingSlider.current = false;
    };
    const onTouchMove = (e: globalThis.TouchEvent) => {
      if (isDraggingSlider.current && e.touches[0]) {
        handleSliderMove(e.touches[0].clientX);
      }
    };
    const onTouchEnd = () => {
      isDraggingSlider.current = false;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [handleSliderMove]);

  const onMouseDownPan = (e: MouseEvent) => {
    if (zoomLevel > 1 && !isDraggingSlider.current) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const onMouseMovePan = (e: MouseEvent) => {
    if (isPanning && zoomLevel > 1) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const onMouseUpPan = () => {
    setIsPanning(false);
  };

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => {
      const next = Math.max(1, Math.min(4, Math.round((prev + delta) * 10) / 10));
      if (next === 1) {
        setPanOffset({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const resetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const hasResult = Boolean(item.resultUrl);

  return (
    <div className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl sm:rounded-2xl overflow-hidden flex flex-col transition-colors">
      {/* Workspace Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--background)]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs sm:text-sm font-medium text-[var(--text-primary)] truncate max-w-[200px] sm:max-w-xs">
            {item.name}
          </span>
          {item.originalWidth && item.originalHeight && (
            <span className="text-[11px] text-[var(--text-muted)] font-mono hidden sm:inline">
              ({item.originalWidth} × {item.originalHeight})
            </span>
          )}
          {item.durationMs && (
            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              · {formatDuration(item.durationMs)}
            </span>
          )}
        </div>

        {/* View mode toggle + Zoom controls */}
        <div className="flex items-center gap-2">
          {hasResult && (
            <div className="flex items-center rounded-md border border-[var(--border)] p-0.5 text-xs bg-[var(--surface)]">
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  viewMode === 'split'
                    ? 'bg-[var(--text-primary)] text-[var(--btn-primary-text)] font-medium'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Split
              </button>
              <button
                type="button"
                onClick={() => setViewMode('side-by-side')}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  viewMode === 'side-by-side'
                    ? 'bg-[var(--text-primary)] text-[var(--btn-primary-text)] font-medium'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Side by Side
              </button>
              <button
                type="button"
                onClick={() => setViewMode('before')}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  viewMode === 'before'
                    ? 'bg-[var(--text-primary)] text-[var(--btn-primary-text)] font-medium'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Before
              </button>
              <button
                type="button"
                onClick={() => setViewMode('after')}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  viewMode === 'after'
                    ? 'bg-[var(--text-primary)] text-[var(--btn-primary-text)] font-medium'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                After
              </button>
              {item.maskUrl && (
                <button
                  type="button"
                  onClick={() => setViewMode('mask')}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    viewMode === 'mask'
                      ? 'bg-[var(--text-primary)] text-[var(--btn-primary-text)] font-medium'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Mask
                </button>
              )}
            </div>
          )}

          {/* Minimal Zoom Controls */}
          <div className="flex items-center rounded-md border border-[var(--border)] p-0.5 text-xs bg-[var(--surface)]">
            <button
              type="button"
              onClick={() => handleZoom(-0.5)}
              disabled={zoomLevel <= 1}
              title="Zoom out"
              aria-label="Zoom out"
              className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-1.5 text-[var(--text-primary)] min-w-[28px] text-center">
              {zoomLevel}x
            </span>
            <button
              type="button"
              onClick={() => handleZoom(0.5)}
              disabled={zoomLevel >= 4}
              title="Zoom in"
              aria-label="Zoom in"
              className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {zoomLevel > 1 && (
              <button
                type="button"
                onClick={resetZoom}
                title="Reset zoom"
                aria-label="Reset zoom"
                className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Large Image Canvas */}
      <div
        ref={containerRef}
        onMouseDown={onMouseDownPan}
        onMouseMove={onMouseMovePan}
        onMouseUp={onMouseUpPan}
        className={`relative w-full h-[360px] sm:h-[440px] md:h-[480px] select-none overflow-hidden ${
          zoomLevel > 1 ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
      >
        <div
          className="w-full h-full flex items-center justify-center transition-transform duration-75"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
            transformOrigin: 'center center',
          }}
        >
          {/* 1. SPLIT COMPARISON SLIDER */}
          {hasResult && viewMode === 'split' && (
            <div className="relative w-full h-full flex items-center justify-center p-4">
              {/* Result background layer (checkerboard) */}
              <div className="absolute inset-4 checkerboard-pattern rounded-lg overflow-hidden flex items-center justify-center border border-[var(--border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.resultUrl}
                  alt="Result background removed"
                  className="max-h-full max-w-full object-contain pointer-events-none"
                />
                <span className="absolute bottom-3 right-3 text-[11px] font-mono px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--background)]/90 text-[var(--text-primary)] pointer-events-none">
                  After
                </span>
              </div>

              {/* Original foreground layer (clipped by slider) */}
              <div
                className="absolute inset-4 bg-[var(--background)] rounded-lg overflow-hidden flex items-center justify-center border border-[var(--border)]"
                style={{
                  clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.originalUrl}
                  alt="Original"
                  className="max-h-full max-w-full object-contain pointer-events-none"
                />
                <span className="absolute bottom-3 left-3 text-[11px] font-mono px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--background)]/90 text-[var(--text-primary)] pointer-events-none">
                  Before
                </span>
              </div>

              {/* Draggable Divider Line & Minimal Handle */}
              <div
                onMouseDown={onMouseDownSlider}
                onTouchStart={onTouchStartSlider}
                className="absolute top-4 bottom-4 w-px bg-[var(--text-primary)] cursor-ew-resize z-20 flex items-center justify-center"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="w-6 h-6 rounded-full bg-[var(--background)] text-[var(--text-primary)] border border-[var(--border-strong)] flex items-center justify-center text-[10px] pointer-events-auto hover:scale-105 active:scale-95 transition-transform shadow-none">
                  ⇄
                </div>
              </div>
            </div>
          )}

          {/* 2. SIDE BY SIDE MODE */}
          {hasResult && viewMode === 'side-by-side' && (
            <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              <div className="relative w-full h-full bg-[var(--background)] rounded-lg border border-[var(--border)] flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.originalUrl}
                  alt="Original"
                  className="max-h-full max-w-full object-contain p-2"
                />
                <span className="absolute bottom-2 left-2 text-[11px] font-mono px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--background)]/90 text-[var(--text-primary)]">
                  Before
                </span>
              </div>

              <div className="relative w-full h-full checkerboard-pattern rounded-lg border border-[var(--border)] flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.resultUrl}
                  alt="Result"
                  className="max-h-full max-w-full object-contain p-2"
                />
                <span className="absolute bottom-2 right-2 text-[11px] font-mono px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--background)]/90 text-[var(--text-primary)]">
                  After
                </span>
              </div>
            </div>
          )}

          {/* 3. BEFORE ONLY MODE */}
          {hasResult && viewMode === 'before' && (
            <div className="w-full h-full p-4 flex items-center justify-center">
              <div className="relative w-full h-full bg-[var(--background)] rounded-lg border border-[var(--border)] flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.originalUrl}
                  alt="Before"
                  className="max-h-full max-w-full object-contain p-2"
                />
                <span className="absolute bottom-2 left-2 text-[11px] font-mono px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--background)]/90 text-[var(--text-primary)]">
                  Before
                </span>
              </div>
            </div>
          )}

          {/* 4. AFTER ONLY MODE */}
          {hasResult && viewMode === 'after' && (
            <div className="w-full h-full p-4 flex items-center justify-center">
              <div className="relative w-full h-full checkerboard-pattern rounded-lg border border-[var(--border)] flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.resultUrl}
                  alt="After"
                  className="max-h-full max-w-full object-contain p-2"
                />
                <span className="absolute bottom-2 right-2 text-[11px] font-mono px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--background)]/90 text-[var(--text-primary)]">
                  After
                </span>
              </div>
            </div>
          )}

          {/* 5. MASK MATTE MODE */}
          {hasResult && viewMode === 'mask' && item.maskUrl && (
            <div className="relative w-full h-full bg-black rounded-lg p-4 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.maskUrl}
                alt="Alpha mask"
                className="max-h-full max-w-full object-contain p-2"
              />
              <span className="absolute bottom-3 left-3 text-[11px] font-mono px-2 py-0.5 rounded border border-zinc-800 bg-zinc-950 text-zinc-300">
                Alpha Mask
              </span>
            </div>
          )}

          {/* Waiting/Processing fallback */}
          {!hasResult && (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.originalUrl}
                alt={item.name}
                className="max-h-64 object-contain rounded-lg border border-[var(--border)] mb-3 bg-[var(--background)]"
              />
              <p className="text-xs text-[var(--text-secondary)]">
                Click &apos;Process&apos; to remove the background
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
