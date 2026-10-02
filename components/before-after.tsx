'use client';

import React, { useState, useRef, useEffect, useCallback, MouseEvent, TouchEvent } from 'react';
import { QueueItem } from '@/types/image';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Split,
  Columns,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import { formatDuration } from '@/lib/utils';

interface BeforeAfterProps {
  item: QueueItem;
}

type ViewMode = 'slider' | 'side-by-side' | 'mask';

export function BeforeAfter({ item }: BeforeAfterProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('slider');
  const [sliderPos, setSliderPos] = useState(50); // percentage 0 to 100
  const [zoomLevel, setZoomLevel] = useState(1); // 1x to 4x
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingSlider = useRef(false);

  // Reset zoom and pan when item changes
  useEffect(() => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setSliderPos(50);
  }, [item.id]);

  // Handle slider movement
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

  // Pan handling when zoomed in
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
    <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
      {/* Top Header / Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-zinc-950/60 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-100 truncate max-w-[200px] sm:max-w-xs">
            {item.name}
          </span>
          {item.durationMs && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
              Processed in {formatDuration(item.durationMs)}
            </span>
          )}
        </div>

        {/* View mode toggle & zoom controls */}
        <div className="flex items-center gap-2">
          {hasResult && (
            <div className="flex items-center rounded-xl bg-zinc-800/80 p-0.5 border border-zinc-700/60 text-xs">
              <button
                onClick={() => setViewMode('slider')}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors ${
                  viewMode === 'slider'
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Split className="w-3.5 h-3.5" />
                Slider
              </button>
              <button
                onClick={() => setViewMode('side-by-side')}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors ${
                  viewMode === 'side-by-side'
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                Side by Side
              </button>
              {item.maskUrl && (
                <button
                  onClick={() => setViewMode('mask')}
                  className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors ${
                    viewMode === 'mask'
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Mask
                </button>
              )}
            </div>
          )}

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-zinc-800/80 rounded-xl p-0.5 border border-zinc-700/60">
            <button
              onClick={() => handleZoom(-0.5)}
              disabled={zoomLevel <= 1}
              title="Zoom out"
              className="p-1 rounded text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-1.5 text-zinc-300 min-w-8 text-center">
              {zoomLevel}x
            </span>
            <button
              onClick={() => handleZoom(0.5)}
              disabled={zoomLevel >= 4}
              title="Zoom in (inspect edges)"
              className="p-1 rounded text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {zoomLevel > 1 && (
              <button
                onClick={resetZoom}
                title="Reset zoom"
                className="p-1 rounded text-zinc-400 hover:text-zinc-200"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Display Area */}
      <div
        ref={containerRef}
        onMouseDown={onMouseDownPan}
        onMouseMove={onMouseMovePan}
        onMouseUp={onMouseUpPan}
        className={`relative w-full h-[380px] sm:h-[460px] md:h-[520px] select-none overflow-hidden ${
          zoomLevel > 1 ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
      >
        {/* Transform wrapper for Zoom and Pan */}
        <div
          className="w-full h-full flex items-center justify-center transition-transform duration-75"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
            transformOrigin: 'center center',
          }}
        >
          {/* 1. SLIDER COMPARISON MODE */}
          {hasResult && viewMode === 'slider' && (
            <div className="relative w-full h-full max-w-4xl flex items-center justify-center p-4">
              {/* Background Layer: Cutout with Checkerboard */}
              <div className="absolute inset-4 checkerboard-bg rounded-xl overflow-hidden flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.resultUrl}
                  alt="Background removed result"
                  className="max-h-full max-w-full object-contain pointer-events-none"
                />
                <span className="absolute bottom-3 right-3 text-[11px] font-semibold px-2 py-1 rounded bg-black/75 text-emerald-400 border border-emerald-500/30 backdrop-blur pointer-events-none">
                  AI Cutout
                </span>
              </div>

              {/* Foreground Layer: Original clipped by slider */}
              <div
                className="absolute inset-4 bg-zinc-950 rounded-xl overflow-hidden flex items-center justify-center"
                style={{
                  clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.originalUrl}
                  alt="Original product image"
                  className="max-h-full max-w-full object-contain pointer-events-none"
                />
                <span className="absolute bottom-3 left-3 text-[11px] font-semibold px-2 py-1 rounded bg-black/75 text-zinc-300 border border-zinc-700/60 backdrop-blur pointer-events-none">
                  Original
                </span>
              </div>

              {/* Slider Line & Handle */}
              <div
                onMouseDown={onMouseDownSlider}
                onTouchStart={onTouchStartSlider}
                className="absolute top-4 bottom-4 w-1 bg-white cursor-ew-resize z-20 shadow-2xl flex items-center justify-center -ml-0.5"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="w-8 h-8 rounded-full bg-white text-zinc-900 shadow-xl border border-zinc-200 flex items-center justify-center font-bold text-xs pointer-events-auto hover:scale-110 active:scale-95 transition-transform">
                  ⇄
                </div>
              </div>
            </div>
          )}

          {/* 2. SIDE-BY-SIDE MODE */}
          {hasResult && viewMode === 'side-by-side' && (
            <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              {/* Original */}
              <div className="relative w-full h-full bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.originalUrl}
                  alt="Original"
                  className="max-h-full max-w-full object-contain p-2"
                />
                <span className="absolute bottom-2 left-2 text-[11px] font-semibold px-2 py-0.5 rounded bg-black/70 text-zinc-300 border border-zinc-700/50">
                  Original
                </span>
              </div>

              {/* Result */}
              <div className="relative w-full h-full checkerboard-bg rounded-xl border border-zinc-800 flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.resultUrl}
                  alt="Result"
                  className="max-h-full max-w-full object-contain p-2"
                />
                <span className="absolute bottom-2 right-2 text-[11px] font-semibold px-2 py-0.5 rounded bg-black/70 text-emerald-400 border border-emerald-500/30">
                  Cutout (Transparent)
                </span>
              </div>
            </div>
          )}

          {/* 3. MASK MATTE MODE */}
          {hasResult && viewMode === 'mask' && item.maskUrl && (
            <div className="relative w-full h-full bg-black rounded-xl p-4 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.maskUrl}
                alt="Alpha segmentation matte"
                className="max-h-full max-w-full object-contain p-2"
              />
              <span className="absolute bottom-6 left-6 text-[11px] font-semibold px-2.5 py-1 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-700">
                Calculated Alpha Mask (White = Keep, Black = Cut)
              </span>
            </div>
          )}

          {/* Fallback if result not yet completed */}
          {!hasResult && (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.originalUrl}
                alt={item.name}
                className="max-h-72 object-contain rounded-xl border border-zinc-800 mb-4"
              />
              <p className="text-sm font-medium text-zinc-300">
                Click &apos;Process&apos; to remove the background
              </p>
            </div>
          )}
        </div>

        {/* Edge inspection helper badge */}
        {zoomLevel > 1 && (
          <div className="absolute top-3 left-3 bg-black/80 backdrop-blur px-2.5 py-1 rounded-lg border border-zinc-700/60 text-[11px] text-zinc-300 flex items-center gap-1.5 z-20">
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            <span>Click & drag to inspect edges</span>
          </div>
        )}
      </div>
    </div>
  );
}
