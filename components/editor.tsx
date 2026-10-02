'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { QueueItem, EditorSettings } from '@/types/image';
import { renderEditedImageCanvas, renderFinalBlob, triggerBrowserDownload } from '@/lib/image-processing/export';
import { sanitizeFilename } from '@/lib/utils';
import {
  Download,
  Paintbrush,
  Maximize,
  Sliders,
  Layers,
  Sparkles,
  SunMedium,
  Check,
} from 'lucide-react';

interface EditorProps {
  item: QueueItem;
  settings: EditorSettings;
  onUpdateSettings: (settings: EditorSettings) => void;
}

export function Editor({ item, settings, onUpdateSettings }: EditorProps) {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const imageElementRef = useRef<HTMLImageElement | null>(null);

  // Load cutout image element for rendering
  useEffect(() => {
    if (!item.resultUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageElementRef.current = img;
      renderPreview();
    };
    img.src = item.resultUrl;
  }, [item.resultUrl]);

  // Render preview whenever settings change
  const renderPreview = useCallback(() => {
    if (!imageElementRef.current || !previewCanvasRef.current) return;

    const img = imageElementRef.current;
    const canvas = previewCanvasRef.current;

    // Use a reasonable display resolution for live preview
    const maxDim = 800;
    let targetW = img.naturalWidth || 800;
    let targetH = img.naturalHeight || 800;

    if (targetW > maxDim || targetH > maxDim) {
      const scale = Math.min(maxDim / targetW, maxDim / targetH);
      targetW = Math.round(targetW * scale);
      targetH = Math.round(targetH * scale);
    }

    const rendered = renderEditedImageCanvas(img, settings, targetW, targetH);

    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, targetW, targetH);
      ctx.drawImage(rendered, 0, 0);
    }
    rendered.width = 0;
    rendered.height = 0;
  }, [settings]);

  useEffect(() => {
    renderPreview();
  }, [renderPreview]);

  const handleDownloadStyled = async () => {
    if (!imageElementRef.current) return;
    setIsExporting(true);
    try {
      const blob = await renderFinalBlob(
        imageElementRef.current,
        settings,
        item.originalWidth,
        item.originalHeight
      );
      const filename = sanitizeFilename(
        item.name,
        `-${settings.backgroundType}${settings.shadow ? '-shadow' : ''}`
      );
      triggerBrowserDownload(blob, filename);
    } catch (err) {
      console.error('Failed to export styled image:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mt-6">
      <div className="p-4 bg-zinc-950/60 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Paintbrush className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-zinc-100">
            Product Styling & Export
          </h3>
          <span className="text-xs text-zinc-400">
            (Applies to individual export & batch ZIP)
          </span>
        </div>

        <button
          onClick={handleDownloadStyled}
          disabled={isExporting}
          className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          {isExporting ? 'Exporting...' : 'Download Styled PNG'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
        {/* Controls Column */}
        <div className="space-y-6 lg:border-r lg:border-zinc-800 lg:pr-6">
          {/* 1. Background Option */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-2.5">
              Background
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings, backgroundType: 'transparent' })}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all ${
                  settings.backgroundType === 'transparent'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white ring-2 ring-indigo-500/20'
                    : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <div className="w-6 h-6 rounded-lg checkerboard-bg border border-zinc-700 mb-1.5" />
                Transparent
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings, backgroundType: 'white' })}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all ${
                  settings.backgroundType === 'white'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white ring-2 ring-indigo-500/20'
                    : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <div className="w-6 h-6 rounded-lg bg-white border border-zinc-300 mb-1.5" />
                Pure White
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings, backgroundType: 'black' })}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all ${
                  settings.backgroundType === 'black'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white ring-2 ring-indigo-500/20'
                    : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <div className="w-6 h-6 rounded-lg bg-black border border-zinc-700 mb-1.5" />
                Black
              </button>

              <div
                onClick={() => onUpdateSettings({ ...settings, backgroundType: 'custom' })}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                  settings.backgroundType === 'custom'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white ring-2 ring-indigo-500/20'
                    : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <input
                  type="color"
                  value={settings.customColor}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      backgroundType: 'custom',
                      customColor: e.target.value,
                    })
                  }
                  className="w-6 h-6 rounded-lg cursor-pointer border-0 p-0 mb-1.5 bg-transparent"
                />
                Custom
              </div>
            </div>
          </div>

          {/* 2. Positioning */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-2.5">
              Product Positioning
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['contain', 'fit', 'center'] as const).map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, positioning: pos })}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium capitalize transition-all ${
                    settings.positioning === pos
                      ? 'border-indigo-500 bg-indigo-500/10 text-white ring-1 ring-indigo-500'
                      : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Padding Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Padding
              </label>
              <span className="text-xs font-mono text-indigo-400">{settings.padding}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={settings.padding}
              onChange={(e) =>
                onUpdateSettings({ ...settings, padding: parseInt(e.target.value, 10) })
              }
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
              <span>Edge (0%)</span>
              <span>Generous (30%)</span>
            </div>
          </div>

          {/* 4. Natural Shadow Toggle */}
          <div className="pt-2 border-t border-zinc-800/80">
            <label className="flex items-center justify-between cursor-pointer group">
              <div>
                <span className="text-xs font-semibold text-zinc-200 block">
                  Add Product Shadow
                </span>
                <span className="text-[11px] text-zinc-400 block mt-0.5">
                  Generates a subtle, natural studio contact shadow beneath the product
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.shadow}
                onChange={(e) => onUpdateSettings({ ...settings, shadow: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 focus:ring-offset-zinc-900 border-zinc-700 bg-zinc-950 cursor-pointer"
              />
            </label>

            {settings.shadow && (
              <div className="mt-4 pl-3 border-l-2 border-indigo-500/40 space-y-3">
                <div>
                  <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                    <span>Shadow Softness</span>
                    <span className="font-mono text-zinc-300">{settings.shadowBlur}px</span>
                  </div>
                  <input
                    type="range"
                    min={6}
                    max={48}
                    value={settings.shadowBlur}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, shadowBlur: parseInt(e.target.value, 10) })
                    }
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Styled Preview Column */}
        <div className="lg:col-span-2 flex flex-col items-center justify-center">
          <div
            className={`relative w-full aspect-square max-h-[460px] rounded-2xl border border-zinc-800 flex items-center justify-center overflow-hidden ${
              settings.backgroundType === 'transparent' ? 'checkerboard-bg' : ''
            }`}
            style={{
              backgroundColor:
                settings.backgroundType === 'white'
                  ? '#ffffff'
                  : settings.backgroundType === 'black'
                  ? '#000000'
                  : settings.backgroundType === 'custom'
                  ? settings.customColor
                  : undefined,
            }}
          >
            <canvas
              ref={previewCanvasRef}
              className="max-h-full max-w-full object-contain"
            />
          </div>

          <div className="mt-3 flex items-center gap-3 text-xs text-zinc-400">
            <span>
              Export dimensions: {item.originalWidth || 800} × {item.originalHeight || 800} px
            </span>
            <span>•</span>
            <span className="text-emerald-400 font-medium">100% Original Resolution</span>
          </div>
        </div>
      </div>
    </div>
  );
}
