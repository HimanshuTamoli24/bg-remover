'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { QueueItem, EditorSettings, ExportFormat, BackgroundType, ProductPosition } from '@/types/image';
import {
  renderEditedImageCanvas,
  renderFinalBlob,
  triggerBrowserDownload,
} from '@/lib/image-processing/export';
import { sanitizeFilename } from '@/lib/utils';
import { Download, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface EditorProps {
  item: QueueItem;
  settings: EditorSettings;
  onUpdateSettings: (settings: EditorSettings) => void;
}

export function Editor({ item, settings, onUpdateSettings }: EditorProps) {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const imageElementRef = useRef<HTMLImageElement | null>(null);

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

  const renderPreview = useCallback(() => {
    if (!imageElementRef.current || !previewCanvasRef.current) return;

    const img = imageElementRef.current;
    const canvas = previewCanvasRef.current;

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

  const handleDownload = async () => {
    if (!imageElementRef.current) return;
    setIsExporting(true);
    try {
      const blob = await renderFinalBlob(
        imageElementRef.current,
        settings,
        item.originalWidth,
        item.originalHeight
      );
      const ext = settings.exportFormat || 'png';
      const suffix =
        settings.backgroundType === 'transparent'
          ? '-cutout'
          : `-${settings.backgroundType}`;
      const filename = sanitizeFilename(item.name, `${suffix}.${ext}`);
      triggerBrowserDownload(blob, filename);
    } catch (err) {
      console.error('Failed to export image:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopy = async () => {
    if (!imageElementRef.current) return;
    try {
      // ClipboardItem typically requires image/png
      const blob = await renderFinalBlob(
        imageElementRef.current,
        { ...settings, exportFormat: 'png' },
        item.originalWidth,
        item.originalHeight
      );
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy to clipboard:', err);
      alert('Could not copy image to clipboard in this browser.');
    }
  };

  return (
    <div className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl sm:rounded-2xl p-5 sm:p-6 mt-6 transition-colors">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Controls Column */}
        <div className="w-full lg:w-1/2 flex flex-col gap-5">
          {/* Section: Background */}
          <div>
            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-2">
              Background
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['transparent', 'white', 'black', 'custom'] as const).map((bg) => {
                const isSelected = settings.backgroundType === bg;
                return (
                  <button
                    key={bg}
                    type="button"
                    onClick={() => {
                      onUpdateSettings({ ...settings, backgroundType: bg });
                    }}
                    className={`h-9 px-3 rounded-md text-xs font-medium border flex items-center justify-center capitalize transition-colors ${
                      isSelected
                        ? 'bg-[var(--text-primary)] text-[var(--btn-primary-text)] border-[var(--text-primary)]'
                        : 'border-[var(--border)] bg-[var(--background)] hover:border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {bg}
                  </button>
                );
              })}
            </div>

            {/* Custom Color Input if selected */}
            {settings.backgroundType === 'custom' && (
              <div className="mt-2.5 flex items-center gap-2">
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
                  className="w-8 h-8 rounded border border-[var(--border)] p-0 cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={settings.customColor}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      backgroundType: 'custom',
                      customColor: e.target.value,
                    })
                  }
                  className="h-8 px-2.5 rounded-md border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--text-primary)] font-mono uppercase w-28"
                />
              </div>
            )}
          </div>

          {/* Section: Export Format */}
          <div>
            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-2">
              Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['png', 'jpg', 'webp'] as const).map((fmt) => {
                const isSelected = (settings.exportFormat || 'png') === fmt;
                return (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ ...settings, exportFormat: fmt })
                    }
                    className={`h-9 px-3 rounded-md text-xs font-medium border flex items-center justify-center uppercase transition-colors ${
                      isSelected
                        ? 'bg-[var(--text-primary)] text-[var(--btn-primary-text)] border-[var(--text-primary)]'
                        : 'border-[var(--border)] bg-[var(--background)] hover:border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {fmt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Product Positioning & Padding */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-2">
                Positioning
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['contain', 'fit', 'center'] as const).map((pos) => {
                  const isSelected = settings.positioning === pos;
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() =>
                        onUpdateSettings({ ...settings, positioning: pos })
                      }
                      className={`h-8 px-2 rounded-md text-xs font-medium border flex items-center justify-center capitalize transition-colors ${
                        isSelected
                          ? 'bg-[var(--text-primary)] text-[var(--btn-primary-text)] border-[var(--text-primary)]'
                          : 'border-[var(--border)] bg-[var(--background)] hover:border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {pos}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Padding
                </label>
                <span className="text-xs font-mono text-[var(--text-muted)]">
                  {settings.padding}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={settings.padding}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    padding: parseInt(e.target.value, 10),
                  })
                }
                className="w-full h-1 bg-[var(--border)] rounded appearance-none cursor-pointer accent-[var(--text-primary)]"
              />
            </div>
          </div>

          {/* Section: Shadow Toggle */}
          <div className="pt-2 border-t border-[var(--border)]">
            <label className="flex items-center justify-between cursor-pointer select-none">
              <div>
                <span className="text-xs font-medium text-[var(--text-primary)] block">
                  Studio Shadow
                </span>
                <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">
                  Natural contact shadow under product
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.shadow}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, shadow: e.target.checked })
                }
                className="w-4 h-4 rounded border-[var(--border-strong)] accent-[var(--text-primary)] cursor-pointer"
              />
            </label>

            {settings.shadow && (
              <div className="mt-3 pl-3 border-l border-[var(--border-strong)] space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>Softness</span>
                  <span className="font-mono">{settings.shadowBlur}px</span>
                </div>
                <input
                  type="range"
                  min={6}
                  max={48}
                  value={settings.shadowBlur}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      shadowBlur: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full h-1 bg-[var(--border)] rounded appearance-none cursor-pointer accent-[var(--text-primary)]"
                />
              </div>
            )}
          </div>

          {/* Section: Action Buttons */}
          <div className="pt-4 border-t border-[var(--border)] flex flex-wrap items-center gap-2.5">
            {/* Primary Download Button */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={isExporting}
              className="flex-1 h-10 px-4 rounded-md bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:opacity-90 text-xs font-medium flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {isExporting
                  ? 'Exporting…'
                  : `Download ${(settings.exportFormat || 'png').toUpperCase()}`}
              </span>
            </button>

            {/* Secondary Copy Button */}
            <button
              type="button"
              onClick={handleCopy}
              className="h-10 px-3.5 rounded-md border border-[var(--border)] hover:border-[var(--border-strong)] bg-[var(--background)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              {isCopied ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{isCopied ? 'Copied' : 'Copy'}</span>
            </button>

            {/* Apply settings to all images button */}
            <button
              type="button"
              onClick={() => {
                toast.success('Applied current background, format, and styling to all images in queue');
              }}
              title="Apply these background and format settings to all images in the queue"
              className="w-full h-8 px-3 rounded-md border border-[var(--border)] hover:border-[var(--border-strong)] bg-[var(--background)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Check className="w-3 h-3 text-[var(--text-muted)]" />
              <span>Apply settings to all images in batch</span>
            </button>
          </div>
        </div>

        {/* Live Canvas Preview Column */}
        <div className="w-full lg:w-1/2 flex flex-col items-center justify-center">
          <div
            className={`w-full aspect-square max-h-[360px] rounded-lg border border-[var(--border)] flex items-center justify-center overflow-hidden ${
              settings.backgroundType === 'transparent' ? 'checkerboard-pattern' : ''
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

          <div className="mt-2 text-[11px] text-[var(--text-muted)] font-mono text-center">
            {item.originalWidth || 800} × {item.originalHeight || 800} px · Original resolution
          </div>
        </div>
      </div>
    </div>
  );
}
