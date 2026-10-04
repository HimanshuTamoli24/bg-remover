'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  QueueItem,
  EditorSettings,
  BackgroundType,
  ProductPosition,
  AspectRatioPreset,
  ShadowPreset,
  EcommercePreset,
  DEFAULT_TRANSFORM,
  DEFAULT_ADJUSTMENTS,
  DEFAULT_SHADOW_SETTINGS,
} from '@/types/image';
import {
  renderEditedImageCanvas,
  renderFinalBlob,
  triggerBrowserDownload,
} from '@/lib/image-processing/export';
import {
  detectProductBounds,
  applyEcommercePreset,
  getShadowPresetConfig,
} from '@/lib/image-processing/adjustments';
import {
  applyEraserStroke,
  applyRestoreStroke,
} from '@/lib/image-processing/touchup';
import { useEditorHistory } from '@/hooks/use-editor-history';
import { sanitizeFilename } from '@/lib/utils';
import {
  Download,
  Copy,
  Check,
  Undo2,
  Redo2,
  RotateCcw,
  Move,
  Eraser,
  Paintbrush,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Crosshair,
  Sliders,
  Sparkles,
  Layers,
  Image as ImageIcon,
  Crop as CropIcon,
  Sun,
  Contrast as ContrastIcon,
  Palette,
  Focus,
  Eye,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

interface EditorProps {
  item: QueueItem;
  settings: EditorSettings;
  onUpdateSettings: (settings: EditorSettings) => void;
  onApplyBatchSettings?: (
    type: 'all' | 'background' | 'position' | 'shadow' | 'adjustments' | 'canvas',
    settings: EditorSettings
  ) => void;
  onCutoutModified?: (newBlob: Blob, newUrl: string) => void;
}

type EditorTab = 'position' | 'background' | 'effects' | 'adjustments' | 'export';
type ToolMode = 'move' | 'eraser' | 'pen';

export function Editor({
  item,
  settings: initialSettings,
  onUpdateSettings,
  onApplyBatchSettings,
  onCutoutModified,
}: EditorProps) {
  // 1. History hook for undo/redo and resets
  const {
    settings,
    canUndo,
    canRedo,
    undo,
    redo,
    updateSettings,
    commitSettingsToHistory,
    resetAll,
    resetSection,
  } = useEditorHistory(initialSettings, onUpdateSettings);

  const [activeTab, setActiveTab] = useState<EditorTab>('position');
  const [toolMode, setToolMode] = useState<ToolMode>('move');
  const [brushSize, setBrushSize] = useState<number>(24);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // References
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const cutoutCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const bgImageElementRef = useRef<HTMLImageElement | null>(null);

  // Mouse interaction state
  const isInteracting = useRef(false);
  const isStrokeDirty = useRef(false);
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchupUndoStack = useRef<ImageData[]>([]);
  const touchupRedoStack = useRef<ImageData[]>([]);
  const [canUndoTouchup, setCanUndoTouchup] = useState(false);
  const [canRedoTouchup, setCanRedoTouchup] = useState(false);
  const internalCutoutUrlRef = useRef<string | null>(null);
  const loadedCutoutSrcRef = useRef<string | null>(null);

  // Load Cutout Image and Original Image
  useEffect(() => {
    const cutoutSrc = item.userEditedResultUrl || item.resultUrl;
    if (!cutoutSrc) return;

    // Avoid reloading canvas if this update was triggered by our own manual stroke modification
    if (cutoutSrc === internalCutoutUrlRef.current && cutoutCanvasRef.current) {
      return;
    }

    // Avoid reloading if the exact same source is already loaded on canvas
    if (loadedCutoutSrcRef.current === cutoutSrc && cutoutCanvasRef.current) {
      return;
    }

    loadedCutoutSrcRef.current = cutoutSrc;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Create offscreen canvas for cutout to allow instant eraser / pen touchup
      const offscreen = document.createElement('canvas');
      offscreen.width = img.naturalWidth || 800;
      offscreen.height = img.naturalHeight || 800;
      const ctx = offscreen.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        cutoutCanvasRef.current = offscreen;
        // Save initial snapshot
        const initialSnap = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
        touchupUndoStack.current = [initialSnap];
        touchupRedoStack.current = [];
        setCanUndoTouchup(false);
        setCanRedoTouchup(false);
        renderPreview();
      }
    };
    img.src = cutoutSrc;
  }, [item.id, item.resultUrl, item.userEditedResultUrl]);

  // Load original image for restore pen
  useEffect(() => {
    if (!item.originalUrl) return;
    const orig = new Image();
    orig.crossOrigin = 'anonymous';
    orig.onload = () => {
      originalImageRef.current = orig;
    };
    orig.src = item.originalUrl;
  }, [item.originalUrl]);

  // Load custom background image if specified
  useEffect(() => {
    if (settings.backgroundType === 'image' && settings.bgImageSettings?.url) {
      const bgImg = new Image();
      bgImg.crossOrigin = 'anonymous';
      bgImg.onload = () => {
        bgImageElementRef.current = bgImg;
        renderPreview();
      };
      bgImg.src = settings.bgImageSettings.url;
    } else {
      bgImageElementRef.current = null;
      renderPreview();
    }
  }, [settings.backgroundType, settings.bgImageSettings?.url]);

  // Renders the live interactive canvas preview
  const renderPreview = useCallback(() => {
    if (!cutoutCanvasRef.current || !previewCanvasRef.current) return;

    const cutout = cutoutCanvasRef.current;
    const canvas = previewCanvasRef.current;

    const maxDim = 800;
    const rendered = renderEditedImageCanvas(
      cutout,
      settings,
      maxDim,
      maxDim,
      bgImageElementRef.current
    );

    canvas.width = rendered.width;
    canvas.height = rendered.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, rendered.width, rendered.height);
      ctx.drawImage(rendered, 0, 0);
    }
    rendered.width = 0;
    rendered.height = 0;
  }, [settings]);

  useEffect(() => {
    renderPreview();
  }, [renderPreview]);

  // Touchup Stroke Undo & Redo
  const handleTouchupUndo = useCallback(() => {
    if (touchupUndoStack.current.length <= 1 || !cutoutCanvasRef.current) return;
    const currentSnapshot = touchupUndoStack.current.pop()!;
    touchupRedoStack.current.push(currentSnapshot);

    const prevSnapshot = touchupUndoStack.current[touchupUndoStack.current.length - 1];
    const ctx = cutoutCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (ctx && prevSnapshot) {
      ctx.putImageData(prevSnapshot, 0, 0);
      renderPreview();

      cutoutCanvasRef.current.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          internalCutoutUrlRef.current = url;
          onCutoutModified?.(blob, url);
        }
      }, 'image/png');
    }

    setCanUndoTouchup(touchupUndoStack.current.length > 1);
    setCanRedoTouchup(touchupRedoStack.current.length > 0);
  }, [onCutoutModified, renderPreview]);

  const handleTouchupRedo = useCallback(() => {
    if (touchupRedoStack.current.length === 0 || !cutoutCanvasRef.current) return;
    const nextSnapshot = touchupRedoStack.current.pop()!;
    touchupUndoStack.current.push(nextSnapshot);

    const ctx = cutoutCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.putImageData(nextSnapshot, 0, 0);
      renderPreview();

      cutoutCanvasRef.current.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          internalCutoutUrlRef.current = url;
          onCutoutModified?.(blob, url);
        }
      }, 'image/png');
    }

    setCanUndoTouchup(touchupUndoStack.current.length > 1);
    setCanRedoTouchup(touchupRedoStack.current.length > 0);
  }, [onCutoutModified, renderPreview]);

  // Unified Global Undo & Redo
  const handleGlobalUndo = useCallback(() => {
    if (toolMode === 'eraser' || toolMode === 'pen') {
      if (canUndoTouchup) {
        handleTouchupUndo();
        return;
      }
    }
    if (canUndo) {
      undo();
    } else if (canUndoTouchup) {
      handleTouchupUndo();
    }
  }, [toolMode, canUndoTouchup, canUndo, handleTouchupUndo, undo]);

  const handleGlobalRedo = useCallback(() => {
    if (toolMode === 'eraser' || toolMode === 'pen') {
      if (canRedoTouchup) {
        handleTouchupRedo();
        return;
      }
    }
    if (canRedo) {
      redo();
    } else if (canRedoTouchup) {
      handleTouchupRedo();
    }
  }, [toolMode, canRedoTouchup, canRedo, handleTouchupRedo, redo]);

  const effectiveCanUndo =
    toolMode === 'eraser' || toolMode === 'pen'
      ? canUndoTouchup || canUndo
      : canUndo || canUndoTouchup;

  const effectiveCanRedo =
    toolMode === 'eraser' || toolMode === 'pen'
      ? canRedoTouchup || canRedo
      : canRedo || canRedoTouchup;

  // Keyboard Shortcuts for Undo (Ctrl+Z) and Redo (Ctrl+Y / Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          if (effectiveCanRedo) handleGlobalRedo();
        } else {
          e.preventDefault();
          if (effectiveCanUndo) handleGlobalUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (effectiveCanRedo) handleGlobalRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [effectiveCanUndo, effectiveCanRedo, handleGlobalUndo, handleGlobalRedo]);

  // Map preview canvas coordinate to offscreen cutout coordinate for touchup
  const mapCanvasToCutout = (
    clientX: number,
    clientY: number
  ): { x: number; y: number } | null => {
    if (!previewCanvasRef.current || !cutoutCanvasRef.current) return null;

    const canvas = previewCanvasRef.current;
    const cutout = cutoutCanvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const canvasX = ((clientX - rect.left) / rect.width) * canvas.width;
    const canvasY = ((clientY - rect.top) / rect.height) * canvas.height;

    // Inverse transform
    const transform = settings.transform || DEFAULT_TRANSFORM;
    const paddingPercent = Math.max(0, Math.min(40, settings.padding)) / 100;
    const paddedW = canvas.width * (1 - paddingPercent * 2);
    const paddedH = canvas.height * (1 - paddingPercent * 2);

    let baseScale = Math.min(paddedW / cutout.width, paddedH / cutout.height);
    if (settings.positioning === 'center' && cutout.width <= paddedW && cutout.height <= paddedH) {
      baseScale = 1;
    }

    const finalScale = baseScale * (transform.zoom || 1);
    const centerX = canvas.width / 2 + (transform.offsetX || 0) * (canvas.width / 800);
    const centerY = canvas.height / 2 + (transform.offsetY || 0) * (canvas.height / 800);

    const dx = canvasX - centerX;
    const dy = canvasY - centerY;

    const rad = (-transform.rotation * Math.PI) / 180;
    const unrotatedX = dx * Math.cos(rad) - dy * Math.sin(rad);
    const unrotatedY = dx * Math.sin(rad) + dy * Math.cos(rad);

    const scaleX = transform.flipH ? -1 : 1;
    const scaleY = transform.flipV ? -1 : 1;

    const imgX = unrotatedX / (scaleX * finalScale) + cutout.width / 2;
    const imgY = unrotatedY / (scaleY * finalScale) + cutout.height / 2;

    return { x: imgX, y: imgY };
  };

  // Canvas Mouse / Touch Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isInteracting.current = true;
    isStrokeDirty.current = false;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const rect = previewCanvasRef.current?.getBoundingClientRect();
    if (rect) {
      lastMousePos.current = {
        x: e.clientX,
        y: e.clientY,
      };
    }

    if (toolMode === 'eraser' || toolMode === 'pen') {
      const pt = mapCanvasToCutout(e.clientX, e.clientY);
      if (pt && cutoutCanvasRef.current) {
        const ctx = cutoutCanvasRef.current.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          if (toolMode === 'eraser') {
            applyEraserStroke(ctx, pt.x, pt.y, pt.x, pt.y, brushSize);
          } else if (toolMode === 'pen' && originalImageRef.current) {
            applyRestoreStroke(ctx, originalImageRef.current, pt.x, pt.y, pt.x, pt.y, brushSize);
          }
          isStrokeDirty.current = true;
          renderPreview();
        }
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // Update cursor position overlay for eraser/pen ring
    const canvas = previewCanvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      setCursorPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }

    if (!isInteracting.current) return;

    if (toolMode === 'move') {
      // Drag product on canvas
      const deltaX = e.clientX - lastMousePos.current.x;
      const deltaY = e.clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.clientX, y: e.clientY };

      const scaleFactor = 800 / (canvas?.width || 800);
      const newOffsetX = Math.round((settings.transform.offsetX || 0) + deltaX * scaleFactor);
      const newOffsetY = Math.round((settings.transform.offsetY || 0) + deltaY * scaleFactor);

      updateSettings({
        ...settings,
        transform: {
          ...settings.transform,
          offsetX: newOffsetX,
          offsetY: newOffsetY,
        },
      });
    } else if (toolMode === 'eraser' || toolMode === 'pen') {
      const prevPt = mapCanvasToCutout(lastMousePos.current.x, lastMousePos.current.y);
      const currPt = mapCanvasToCutout(e.clientX, e.clientY);
      lastMousePos.current = { x: e.clientX, y: e.clientY };

      if (prevPt && currPt && cutoutCanvasRef.current) {
        const ctx = cutoutCanvasRef.current.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          if (toolMode === 'eraser') {
            applyEraserStroke(ctx, prevPt.x, prevPt.y, currPt.x, currPt.y, brushSize);
          } else if (toolMode === 'pen' && originalImageRef.current) {
            applyRestoreStroke(
              ctx,
              originalImageRef.current,
              prevPt.x,
              prevPt.y,
              currPt.x,
              currPt.y,
              brushSize
            );
          }
          isStrokeDirty.current = true;
          renderPreview();
        }
      }
    }
  };

  const handlePointerUp = () => {
    if (!isInteracting.current) return;
    isInteracting.current = false;

    if (toolMode === 'move') {
      commitSettingsToHistory(settings);
    } else if (toolMode === 'eraser' || toolMode === 'pen') {
      if (isStrokeDirty.current && cutoutCanvasRef.current) {
        isStrokeDirty.current = false;
        const ctx = cutoutCanvasRef.current.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          const snapshot = ctx.getImageData(
            0,
            0,
            cutoutCanvasRef.current.width,
            cutoutCanvasRef.current.height
          );
          touchupUndoStack.current.push(snapshot);
          if (touchupUndoStack.current.length > 25) {
            touchupUndoStack.current.shift();
          }
          touchupRedoStack.current = [];
          setCanUndoTouchup(touchupUndoStack.current.length > 1);
          setCanRedoTouchup(false);

          // Generate blob and notify parent
          cutoutCanvasRef.current.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              internalCutoutUrlRef.current = url;
              onCutoutModified?.(blob, url);
            }
          }, 'image/png');
        }
      }
    }
  };

  // Revert all touchup brush strokes
  const handleResetTouchups = () => {
    if (!cutoutCanvasRef.current || touchupUndoStack.current.length === 0) return;
    const initialSnapshot = touchupUndoStack.current[0];
    const currentSnapshot = touchupUndoStack.current[touchupUndoStack.current.length - 1];

    if (!initialSnapshot) return;

    const ctx = cutoutCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.putImageData(initialSnapshot, 0, 0);
      if (currentSnapshot && currentSnapshot !== initialSnapshot) {
        touchupRedoStack.current.push(currentSnapshot);
      }
      touchupUndoStack.current = [initialSnapshot];
      setCanUndoTouchup(false);
      setCanRedoTouchup(touchupRedoStack.current.length > 0);
      renderPreview();

      cutoutCanvasRef.current.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          internalCutoutUrlRef.current = url;
          onCutoutModified?.(blob, url);
        }
      }, 'image/png');
      toast.success('Cutout restored to original AI result');
    }
  };

  // Auto-fit & Auto-center (Phase 2)
  const handleAutoFit = () => {
    if (!cutoutCanvasRef.current) return;
    const box = detectProductBounds(cutoutCanvasRef.current);
    const w = cutoutCanvasRef.current.width;
    const h = cutoutCanvasRef.current.height;

    // Offset required to align product center with canvas center
    const offsetX = Math.round((w / 2 - box.centerX) * (800 / w));
    const offsetY = Math.round((h / 2 - box.centerY) * (800 / h));

    // Scale so that product box comfortably fits within padded area
    const paddingPercent = Math.max(0, Math.min(40, settings.padding)) / 100;
    const availW = w * (1 - paddingPercent * 2);
    const availH = h * (1 - paddingPercent * 2);

    const fitScale = Math.min(availW / box.width, availH / box.height);
    const zoom = Math.max(0.2, Math.min(2.5, Math.round(fitScale * 100) / 100));

    commitSettingsToHistory({
      ...settings,
      transform: {
        ...settings.transform,
        offsetX,
        offsetY,
        zoom,
      },
    });
    toast.success('Product auto-fitted & centered');
  };

  // Preset Selection (Phase 6)
  const handlePresetSelect = (preset: EcommercePreset) => {
    const updated = applyEcommercePreset(preset, settings);
    commitSettingsToHistory(updated);
    toast.success(`Applied ${preset.toUpperCase()} preset`);
  };

  // Custom Background Image Upload (Phase 5)
  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    commitSettingsToHistory({
      ...settings,
      backgroundType: 'image',
      bgImageSettings: {
        url,
        fit: 'cover',
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        blur: 0,
      },
    });
    toast.success('Custom background image uploaded');
  };

  // Download & Copy Handlers
  const handleDownload = async () => {
    if (!cutoutCanvasRef.current) return;
    setIsExporting(true);
    try {
      const blob = await renderFinalBlob(
        cutoutCanvasRef.current,
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
      toast.success(`Downloaded ${filename}`);
    } catch (err) {
      console.error('Failed to export image:', err);
      toast.error('Failed to export image');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopy = async () => {
    if (!cutoutCanvasRef.current) return;
    try {
      const blob = await renderFinalBlob(
        cutoutCanvasRef.current,
        { ...settings, exportFormat: 'png' },
        item.originalWidth,
        item.originalHeight
      );
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setIsCopied(true);
      toast.success('Image copied to clipboard!');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy to clipboard:', err);
      toast.error('Could not copy image to clipboard in this browser');
    }
  };

  const zoomPercent = Math.round((settings.transform?.zoom || 1) * 100);

  return (
    <div className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl sm:rounded-2xl p-4 sm:p-6 mt-6 transition-colors shadow-xs">
      {/* 1. Studio Header Toolbar: E-Commerce Presets & Global Undo/Redo */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-[var(--border)]">
        {/* Presets Segmented Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mr-1 hidden sm:inline">
            Presets:
          </span>
          {(
            [
              { id: 'meesho', label: 'Meesho' },
              { id: 'amazon', label: 'Amazon' },
              { id: 'shopify', label: 'Shopify' },
              { id: 'instagram', label: 'Instagram' },
              { id: 'custom', label: 'Custom' },
            ] as const
          ).map((p) => {
            const isSelected = (settings.activePreset || 'custom') === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePresetSelect(p.id)}
                className={`h-7 px-2.5 rounded-md text-xs font-medium border flex items-center gap-1 transition-all ${
                  isSelected
                    ? 'bg-[var(--text-primary)] text-[var(--btn-primary-text)] border-[var(--text-primary)] shadow-xs'
                    : 'border-[var(--border)] bg-[var(--background)] hover:border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Sparkles className="w-3 h-3 opacity-70" />
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* Global Action Tools: Undo, Redo, Reset All */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={handleGlobalUndo}
            disabled={!effectiveCanUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            className="h-7 w-7 rounded-md border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--surface-hover)] disabled:opacity-30 disabled:pointer-events-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleGlobalRedo}
            disabled={!effectiveCanRedo}
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
            className="h-7 w-7 rounded-md border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--surface-hover)] disabled:opacity-30 disabled:pointer-events-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-[1px] h-4 bg-[var(--border)] mx-1" />
          <button
            type="button"
            onClick={resetAll}
            title="Reset all settings to default"
            className="h-7 px-2 rounded-md border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Reset All</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* LEFT COLUMN: Interactive Canvas Area */}
        <div className="w-full lg:w-7/12 flex flex-col items-center">
          {/* Tool Switcher Bar: Move / Eraser / Pen */}
          <div className="w-full flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1 bg-[var(--background)] p-1 rounded-lg border border-[var(--border)] shadow-2xs">
              <button
                type="button"
                onClick={() => setToolMode('move')}
                className={`h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  toolMode === 'move'
                    ? 'bg-[var(--text-primary)] text-[var(--btn-primary-text)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title="Move & Drag Product"
              >
                <Move className="w-3.5 h-3.5" />
                <span>Move</span>
              </button>

              <button
                type="button"
                onClick={() => setToolMode('eraser')}
                className={`h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  toolMode === 'eraser'
                    ? 'bg-rose-500 text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title="Eraser Tool: Erase stray background or artifacts"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Eraser</span>
              </button>

              <button
                type="button"
                onClick={() => setToolMode('pen')}
                className={`h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  toolMode === 'pen'
                    ? 'bg-blue-600 text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title="Pen Tool: Restore original image details"
              >
                <Paintbrush className="w-3.5 h-3.5" />
                <span>Pen (Restore)</span>
              </button>
            </div>

            {/* If Eraser or Pen active: Brush size slider, Undo/Redo, and Reset */}
            {(toolMode === 'eraser' || toolMode === 'pen') && (
              <div className="flex items-center gap-2 bg-[var(--background)] px-2.5 py-1 rounded-lg border border-[var(--border)] shadow-2xs">
                {/* Dedicated Touchup Stroke Undo & Redo */}
                <div className="flex items-center gap-1 border-r border-[var(--border)] pr-2">
                  <button
                    type="button"
                    onClick={handleTouchupUndo}
                    disabled={!canUndoTouchup}
                    title="Undo brush stroke (Ctrl+Z)"
                    aria-label="Undo brush stroke"
                    className="h-6 w-6 rounded border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] disabled:opacity-30 disabled:pointer-events-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors"
                  >
                    <Undo2 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={handleTouchupRedo}
                    disabled={!canRedoTouchup}
                    title="Redo brush stroke (Ctrl+Y)"
                    aria-label="Redo brush stroke"
                    className="h-6 w-6 rounded border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] disabled:opacity-30 disabled:pointer-events-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors"
                  >
                    <Redo2 className="w-3 h-3" />
                  </button>
                </div>

                <span className="text-[11px] text-[var(--text-muted)] font-medium">Size:</span>
                <input
                  type="range"
                  min={6}
                  max={80}
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                  className="w-16 sm:w-20 h-1 bg-[var(--border)] rounded appearance-none cursor-pointer accent-[var(--text-primary)]"
                />
                <span className="text-[11px] font-mono text-[var(--text-secondary)] w-6">
                  {brushSize}p
                </span>
                <button
                  type="button"
                  onClick={handleResetTouchups}
                  disabled={!canUndoTouchup && !canRedoTouchup}
                  title="Revert manual brush edits"
                  className="text-[11px] text-red-500 hover:underline ml-1 disabled:opacity-30 disabled:pointer-events-none"
                >
                  Reset
                </button>
              </div>
            )}
          </div>

          {/* Canvas Display Viewport (two-finger scroll now scrolls page naturally without auto-zoom) */}
          <div
            className={`relative w-full aspect-square max-h-[460px] rounded-xl border border-[var(--border)] flex items-center justify-center overflow-hidden select-none shadow-inner ${
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
              cursor:
                toolMode === 'move'
                  ? 'grab'
                  : toolMode === 'eraser' || toolMode === 'pen'
                  ? 'crosshair'
                  : 'default',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onMouseLeave={() => setCursorPos(null)}
          >
            <canvas
              ref={previewCanvasRef}
              className="max-h-full max-w-full object-contain pointer-events-none"
            />

            {/* Brush Circle Cursor Overlay */}
            {cursorPos && (toolMode === 'eraser' || toolMode === 'pen') && (
              <div
                className="absolute pointer-events-none rounded-full border border-white shadow-xs"
                style={{
                  width: `${brushSize}px`,
                  height: `${brushSize}px`,
                  left: `${cursorPos.x - brushSize / 2}px`,
                  top: `${cursorPos.y - brushSize / 2}px`,
                  backgroundColor:
                    toolMode === 'eraser'
                      ? 'rgba(239, 68, 68, 0.25)'
                      : 'rgba(59, 130, 246, 0.25)',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
                }}
              />
            )}

            {/* Quick Floating Zoom / Center Controls Overlay */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
              <div className="flex items-center gap-1.5 bg-black/75 backdrop-blur-md text-white px-2.5 py-1.5 rounded-lg text-xs font-mono shadow-md pointer-events-auto">
                <button
                  type="button"
                  onClick={() =>
                    updateSettings({
                      ...settings,
                      transform: {
                        ...settings.transform,
                        zoom: Math.max(0.2, Math.round(((settings.transform?.zoom || 1) - 0.1) * 10) / 10),
                      },
                    })
                  }
                  title="Zoom Out"
                  className="hover:text-amber-400 p-0.5"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="w-11 text-center font-semibold">{zoomPercent}%</span>
                <button
                  type="button"
                  onClick={() =>
                    updateSettings({
                      ...settings,
                      transform: {
                        ...settings.transform,
                        zoom: Math.min(3.0, Math.round(((settings.transform?.zoom || 1) + 0.1) * 10) / 10),
                      },
                    })
                  }
                  title="Zoom In"
                  className="hover:text-amber-400 p-0.5"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <div className="w-[1px] h-3 bg-white/20 mx-1" />
                <button
                  type="button"
                  onClick={() =>
                    commitSettingsToHistory({
                      ...settings,
                      transform: { ...settings.transform, zoom: 1 },
                    })
                  }
                  title="Reset Zoom to 100%"
                  className="text-[11px] text-white/70 hover:text-white"
                >
                  1:1
                </button>
              </div>

              <div className="flex items-center gap-1 pointer-events-auto">
                <button
                  type="button"
                  onClick={handleAutoFit}
                  title="Auto Fit & Center Product"
                  className="h-8 px-2.5 rounded-lg bg-black/75 backdrop-blur-md text-white hover:bg-black text-xs font-medium flex items-center gap-1.5 shadow-md transition-colors"
                >
                  <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Auto Fit</span>
                </button>
              </div>
            </div>
          </div>

          {/* Canvas Resolution & Status Info */}
          <div className="mt-2.5 flex items-center justify-between w-full text-[11px] text-[var(--text-muted)] font-mono">
            <span>
              Canvas: {settings.aspectRatio.toUpperCase()} · Padding: {settings.padding}%
            </span>
            <span>
              {item.originalWidth || 800} × {item.originalHeight || 800} px original
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN: Tool Tabs & Controls */}
        <div className="w-full lg:w-5/12 flex flex-col">
          {/* Studio Navigation Tabs */}
          <div className="grid grid-cols-5 gap-1 p-1 bg-[var(--background)] rounded-lg border border-[var(--border)] mb-4">
            {(
              [
                { id: 'position', label: 'Position', icon: Move },
                { id: 'background', label: 'Backdrop', icon: ImageIcon },
                { id: 'effects', label: 'Effects', icon: Sparkles },
                { id: 'adjustments', label: 'Adjust', icon: Sliders },
                { id: 'export', label: 'Export', icon: Download },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`h-8 rounded-md text-xs font-medium flex flex-col sm:flex-row items-center justify-center gap-1 transition-all ${
                    isActive
                      ? 'bg-[var(--text-primary)] text-[var(--btn-primary-text)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-[10px] sm:text-xs">{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: POSITIONING & CANVAS */}
          {activeTab === 'position' && (
            <div className="space-y-4">
              {/* Aspect Ratio Presets (Phase 2) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    Aspect Ratio
                  </label>
                  <span className="text-[11px] text-[var(--text-muted)] font-mono">
                    {settings.aspectRatio}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: 'original', label: 'Original' },
                      { id: '1:1', label: '1:1 Square' },
                      { id: '4:5', label: '4:5 Portrait' },
                      { id: '3:4', label: '3:4' },
                      { id: '16:9', label: '16:9' },
                      { id: '9:16', label: '9:16 Reel' },
                      { id: 'custom', label: 'Custom' },
                    ] as const
                  ).map((ar) => {
                    const isSelected = settings.aspectRatio === ar.id;
                    return (
                      <button
                        key={ar.id}
                        type="button"
                        onClick={() =>
                          commitSettingsToHistory({
                            ...settings,
                            aspectRatio: ar.id,
                          })
                        }
                        className={`h-7 px-2 rounded-md text-xs font-medium border flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-[var(--text-primary)] text-[var(--btn-primary-text)] border-[var(--text-primary)]'
                            : 'border-[var(--border)] bg-[var(--background)] hover:border-[var(--border-strong)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {ar.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Padding Slider */}
              <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--background)]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-[var(--text-primary)]">
                    Canvas Padding
                  </span>
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
                    updateSettings({
                      ...settings,
                      padding: parseInt(e.target.value, 10),
                    })
                  }
                  onMouseUp={() => commitSettingsToHistory(settings)}
                  className="w-full h-1 bg-[var(--border)] rounded appearance-none cursor-pointer accent-[var(--text-primary)]"
                />
              </div>

              {/* Drag Position Offsets & Centering */}
              <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--background)] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--text-primary)]">
                    Product Position (X / Y)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        commitSettingsToHistory({
                          ...settings,
                          transform: { ...settings.transform, offsetX: 0 },
                        })
                      }
                      className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] underline"
                    >
                      Center X
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() =>
                        commitSettingsToHistory({
                          ...settings,
                          transform: { ...settings.transform, offsetY: 0 },
                        })
                      }
                      className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] underline"
                    >
                      Center Y
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] text-[var(--text-muted)] mb-1">
                      <span>Horizontal X</span>
                      <span className="font-mono">{settings.transform.offsetX || 0}px</span>
                    </div>
                    <input
                      type="range"
                      min={-300}
                      max={300}
                      value={settings.transform.offsetX || 0}
                      onChange={(e) =>
                        updateSettings({
                          ...settings,
                          transform: {
                            ...settings.transform,
                            offsetX: parseInt(e.target.value, 10),
                          },
                        })
                      }
                      onMouseUp={() => commitSettingsToHistory(settings)}
                      className="w-full h-1 bg-[var(--border)] rounded appearance-none cursor-pointer accent-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-[var(--text-muted)] mb-1">
                      <span>Vertical Y</span>
                      <span className="font-mono">{settings.transform.offsetY || 0}px</span>
                    </div>
                    <input
                      type="range"
                      min={-300}
                      max={300}
                      value={settings.transform.offsetY || 0}
                      onChange={(e) =>
                        updateSettings({
                          ...settings,
                          transform: {
                            ...settings.transform,
                            offsetY: parseInt(e.target.value, 10),
                          },
                        })
                      }
                      onMouseUp={() => commitSettingsToHistory(settings)}
                      className="w-full h-1 bg-[var(--border)] rounded appearance-none cursor-pointer accent-[var(--text-primary)]"
                    />
                  </div>
                </div>
              </div>

              {/* Rotation & Flip Controls (Phase 1) */}
              <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--background)] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--text-primary)]">
                    Rotation & Flip
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      commitSettingsToHistory({
                        ...settings,
                        transform: {
                          ...settings.transform,
                          rotation: 0,
                          flipH: false,
                          flipV: false,
                        },
                      })
                    }
                    className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] underline"
                  >
                    Reset
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    value={settings.transform.rotation || 0}
                    onChange={(e) =>
                      updateSettings({
                        ...settings,
                        transform: {
                          ...settings.transform,
                          rotation: parseInt(e.target.value, 10),
                        },
                      })
                    }
                    onMouseUp={() => commitSettingsToHistory(settings)}
                    className="flex-1 h-1 bg-[var(--border)] rounded appearance-none cursor-pointer accent-[var(--text-primary)]"
                  />
                  <span className="text-xs font-mono text-[var(--text-secondary)] w-10 text-right">
                    {settings.transform.rotation || 0}°
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      commitSettingsToHistory({
                        ...settings,
                        transform: {
                          ...settings.transform,
                          rotation: ((settings.transform.rotation || 0) - 90 + 360) % 360,
                        },
                      })
                    }
                    className="h-7 px-2 rounded-md border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-xs flex items-center justify-center gap-1"
                    title="Rotate 90° CCW"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>-90°</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      commitSettingsToHistory({
                        ...settings,
                        transform: {
                          ...settings.transform,
                          rotation: ((settings.transform.rotation || 0) + 90) % 360,
                        },
                      })
                    }
                    className="h-7 px-2 rounded-md border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-xs flex items-center justify-center gap-1"
                    title="Rotate 90° CW"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>+90°</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      commitSettingsToHistory({
                        ...settings,
                        transform: {
                          ...settings.transform,
                          flipH: !settings.transform.flipH,
                        },
                      })
                    }
                    className={`h-7 px-2 rounded-md border text-xs flex items-center justify-center gap-1 ${
                      settings.transform.flipH
                        ? 'bg-[var(--text-primary)] text-[var(--btn-primary-text)] border-[var(--text-primary)]'
                        : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]'
                    }`}
                    title="Flip Horizontal"
                  >
                    <FlipHorizontal className="w-3 h-3" />
                    <span>Flip H</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      commitSettingsToHistory({
                        ...settings,
                        transform: {
                          ...settings.transform,
                          flipV: !settings.transform.flipV,
                        },
                      })
                    }
                    className={`h-7 px-2 rounded-md border text-xs flex items-center justify-center gap-1 ${
                      settings.transform.flipV
                        ? 'bg-[var(--text-primary)] text-[var(--btn-primary-text)] border-[var(--text-primary)]'
                        : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]'
                    }`}
                    title="Flip Vertical"
                  >
                    <FlipVertical className="w-3 h-3" />
                    <span>Flip V</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BACKGROUND (Phase 5) */}
          {activeTab === 'background' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-2">
                  Backdrop Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'transparent', label: 'Transparent' },
                      { id: 'white', label: 'Pure White' },
                      { id: 'black', label: 'Dark / Black' },
                      { id: 'custom', label: 'Solid Color' },
                      { id: 'image', label: 'Custom Image' },
                    ] as const
                  ).map((b) => {
                    const isSelected = settings.backgroundType === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() =>
                          commitSettingsToHistory({
                            ...settings,
                            backgroundType: b.id,
                          })
                        }
                        className={`h-8 px-2.5 rounded-md text-xs font-medium border flex items-center justify-center capitalize transition-colors ${
                          isSelected
                            ? 'bg-[var(--text-primary)] text-[var(--btn-primary-text)] border-[var(--text-primary)] shadow-2xs'
                            : 'border-[var(--border)] bg-[var(--background)] hover:border-[var(--border-strong)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {b.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Solid Color Picker */}
              {settings.backgroundType === 'custom' && (
                <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--background)] space-y-2">
                  <span className="text-xs font-medium text-[var(--text-primary)] block">
                    Pick Solid Color
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.customColor}
                      onChange={(e) =>
                        updateSettings({
                          ...settings,
                          backgroundType: 'custom',
                          customColor: e.target.value,
                        })
                      }
                      onBlur={() => commitSettingsToHistory(settings)}
                      className="w-9 h-9 rounded-md border border-[var(--border)] p-0.5 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={settings.customColor}
                      onChange={(e) =>
                        updateSettings({
                          ...settings,
                          backgroundType: 'custom',
                          customColor: e.target.value,
                        })
                      }
                      onBlur={() => commitSettingsToHistory(settings)}
                      className="h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text-primary)] font-mono uppercase w-32"
                    />
                  </div>
                </div>
              )}

              {/* Custom Background Image Controls */}
              {settings.backgroundType === 'image' && (
                <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--background)] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text-primary)]">
                      Background Image
                    </span>
                    {settings.bgImageSettings?.url && (
                      <button
                        type="button"
                        onClick={() =>
                          commitSettingsToHistory({
                            ...settings,
                            backgroundType: 'transparent',
                            bgImageSettings: null,
                          })
                        }
                        className="text-xs text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <label className="flex items-center justify-center gap-2 h-10 px-3 rounded-md border border-dashed border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] cursor-pointer text-xs font-medium text-[var(--text-primary)]">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Background Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleBgImageUpload}
                      className="hidden"
                    />
                  </label>

                  {settings.bgImageSettings?.url && (
                    <div className="space-y-2.5 pt-2 border-t border-[var(--border)]">
                      {/* Fit Mode */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-muted)]">Fitting:</span>
                        <div className="flex gap-1">
                          {(['cover', 'contain'] as const).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() =>
                                commitSettingsToHistory({
                                  ...settings,
                                  bgImageSettings: {
                                    ...settings.bgImageSettings!,
                                    fit: m,
                                  },
                                })
                              }
                              className={`h-6 px-2 rounded text-[11px] font-medium capitalize border ${
                                settings.bgImageSettings?.fit === m
                                  ? 'bg-[var(--text-primary)] text-[var(--btn-primary-text)] border-[var(--text-primary)]'
                                  : 'border-[var(--border)] bg-[var(--surface)]'
                              }`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Blur Slider */}
                      <div>
                        <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
                          <span>Background Blur</span>
                          <span className="font-mono">{settings.bgImageSettings.blur || 0}px</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={30}
                          value={settings.bgImageSettings.blur || 0}
                          onChange={(e) =>
                            updateSettings({
                              ...settings,
                              bgImageSettings: {
                                ...settings.bgImageSettings!,
                                blur: parseInt(e.target.value, 10),
                              },
                            })
                          }
                          onMouseUp={() => commitSettingsToHistory(settings)}
                          className="w-full h-1 bg-[var(--border)] rounded appearance-none cursor-pointer accent-[var(--text-primary)]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: EFFECTS (SHADOW & BORDER) (Phase 3) */}
          {activeTab === 'effects' && (
            <div className="space-y-4">
              {/* Product Shadow Card */}
              <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--background)] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[var(--text-primary)] block">
                      Realistic Studio Shadow
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Natural contact ground shadow
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.shadowSettings.enabled}
                    onChange={(e) =>
                      commitSettingsToHistory({
                        ...settings,
                        shadow: e.target.checked,
                        shadowSettings: {
                          ...settings.shadowSettings,
                          enabled: e.target.checked,
                          preset: e.target.checked ? 'natural' : 'none',
                        },
                      })
                    }
                    className="w-4 h-4 rounded border-[var(--border-strong)] accent-[var(--text-primary)] cursor-pointer"
                  />
                </div>

                {settings.shadowSettings.enabled && (
                  <div className="space-y-3 pt-2 border-t border-[var(--border)]">
                    {/* Shadow Presets */}
                    <div>
                      <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider block mb-1.5 font-semibold">
                        Shadow Intensity
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['soft', 'natural', 'strong'] as const).map((pr) => {
                          const isSelected = settings.shadowSettings.preset === pr;
                          return (
                            <button
                              key={pr}
                              type="button"
                              onClick={() => {
                                const conf = getShadowPresetConfig(pr);
                                commitSettingsToHistory({
                                  ...settings,
                                  shadowSettings: conf,
                                  shadowBlur: conf.blur,
                                  shadowOpacity: conf.opacity,
                                  shadowOffsetY: conf.offsetY,
                                });
                              }}
                              className={`h-7 rounded-md text-xs font-medium border capitalize flex items-center justify-center ${
                                isSelected
                                  ? 'bg-[var(--text-primary)] text-[var(--btn-primary-text)] border-[var(--text-primary)]'
                                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]'
                              }`}
                            >
                              {pr}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Shadow Opacity */}
                    <div>
                      <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
                        <span>Opacity</span>
                        <span className="font-mono">
                          {Math.round(settings.shadowSettings.opacity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={5}
                        max={100}
                        value={Math.round(settings.shadowSettings.opacity * 100)}
                        onChange={(e) =>
                          updateSettings({
                            ...settings,
                            shadowSettings: {
                              ...settings.shadowSettings,
                              opacity: parseInt(e.target.value, 10) / 100,
                            },
                          })
                        }
                        onMouseUp={() => commitSettingsToHistory(settings)}
                        className="w-full h-1 bg-[var(--border)] rounded appearance-none cursor-pointer accent-[var(--text-primary)]"
                      />
                    </div>

                    {/* Shadow Blur */}
                    <div>
                      <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
                        <span>Softness / Blur</span>
                        <span className="font-mono">{settings.shadowSettings.blur}px</span>
                      </div>
                      <input
                        type="range"
                        min={4}
                        max={60}
                        value={settings.shadowSettings.blur}
                        onChange={(e) =>
                          updateSettings({
                            ...settings,
                            shadowSettings: {
                              ...settings.shadowSettings,
                              blur: parseInt(e.target.value, 10),
                            },
                          })
                        }
                        onMouseUp={() => commitSettingsToHistory(settings)}
                        className="w-full h-1 bg-[var(--border)] rounded appearance-none cursor-pointer accent-[var(--text-primary)]"
                      />
                    </div>

                    {/* Vertical Offset */}
                    <div>
                      <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
                        <span>Vertical Distance</span>
                        <span className="font-mono">{settings.shadowSettings.offsetY}px</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={50}
                        value={settings.shadowSettings.offsetY}
                        onChange={(e) =>
                          updateSettings({
                            ...settings,
                            shadowSettings: {
                              ...settings.shadowSettings,
                              offsetY: parseInt(e.target.value, 10),
                            },
                          })
                        }
                        onMouseUp={() => commitSettingsToHistory(settings)}
                        className="w-full h-1 bg-[var(--border)] rounded appearance-none cursor-pointer accent-[var(--text-primary)]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Product Border / Stroke Card */}
              <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--background)] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[var(--text-primary)] block">
                      Canvas Frame / Border
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Solid border frame around product canvas
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.borderSettings.enabled}
                    onChange={(e) =>
                      commitSettingsToHistory({
                        ...settings,
                        borderSettings: {
                          ...settings.borderSettings,
                          enabled: e.target.checked,
                          width: e.target.checked && settings.borderSettings.width === 0 ? 2 : settings.borderSettings.width,
                        },
                      })
                    }
                    className="w-4 h-4 rounded border-[var(--border-strong)] accent-[var(--text-primary)] cursor-pointer"
                  />
                </div>

                {settings.borderSettings.enabled && (
                  <div className="space-y-3 pt-2 border-t border-[var(--border)]">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.borderSettings.color}
                        onChange={(e) =>
                          updateSettings({
                            ...settings,
                            borderSettings: {
                              ...settings.borderSettings,
                              color: e.target.value,
                            },
                          })
                        }
                        onBlur={() => commitSettingsToHistory(settings)}
                        className="w-7 h-7 rounded border border-[var(--border)] p-0.5 cursor-pointer bg-transparent"
                      />
                      <span className="text-xs text-[var(--text-muted)]">Border Color</span>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
                        <span>Width</span>
                        <span className="font-mono">{settings.borderSettings.width}px</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={16}
                        value={settings.borderSettings.width}
                        onChange={(e) =>
                          updateSettings({
                            ...settings,
                            borderSettings: {
                              ...settings.borderSettings,
                              width: parseInt(e.target.value, 10),
                            },
                          })
                        }
                        onMouseUp={() => commitSettingsToHistory(settings)}
                        className="w-full h-1 bg-[var(--border)] rounded appearance-none cursor-pointer accent-[var(--text-primary)]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: IMAGE ADJUSTMENTS (Phase 4) */}
          {activeTab === 'adjustments' && (
            <div className="space-y-3.5 p-3.5 rounded-lg border border-[var(--border)] bg-[var(--background)]">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                <span className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                  Color & Clarity
                </span>
                <button
                  type="button"
                  onClick={() => resetSection('adjustments')}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] underline"
                >
                  Reset All
                </button>
              </div>

              {/* Brightness */}
              <div>
                <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
                  <span className="flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span>Brightness</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[var(--text-muted)]">
                      {settings.adjustments.brightness > 0 ? `+${settings.adjustments.brightness}` : settings.adjustments.brightness}
                    </span>
                    {settings.adjustments.brightness !== 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          commitSettingsToHistory({
                            ...settings,
                            adjustments: { ...settings.adjustments, brightness: 0 },
                          })
                        }
                        className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  min={-60}
                  max={60}
                  value={settings.adjustments.brightness}
                  onChange={(e) =>
                    updateSettings({
                      ...settings,
                      adjustments: {
                        ...settings.adjustments,
                        brightness: parseInt(e.target.value, 10),
                      },
                    })
                  }
                  onMouseUp={() => commitSettingsToHistory(settings)}
                  className="w-full h-1 bg-[var(--border)] rounded appearance-none cursor-pointer accent-[var(--text-primary)]"
                />
              </div>

              {/* Contrast */}
              <div>
                <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
                  <span className="flex items-center gap-1.5">
                    <ContrastIcon className="w-3.5 h-3.5 text-blue-500" />
                    <span>Contrast</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[var(--text-muted)]">
                      {settings.adjustments.contrast > 0 ? `+${settings.adjustments.contrast}` : settings.adjustments.contrast}
                    </span>
                    {settings.adjustments.contrast !== 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          commitSettingsToHistory({
                            ...settings,
                            adjustments: { ...settings.adjustments, contrast: 0 },
                          })
                        }
                        className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  min={-60}
                  max={60}
                  value={settings.adjustments.contrast}
                  onChange={(e) =>
                    updateSettings({
                      ...settings,
                      adjustments: {
                        ...settings.adjustments,
                        contrast: parseInt(e.target.value, 10),
                      },
                    })
                  }
                  onMouseUp={() => commitSettingsToHistory(settings)}
                  className="w-full h-1 bg-[var(--border)] rounded appearance-none cursor-pointer accent-[var(--text-primary)]"
                />
              </div>

              {/* Saturation */}
              <div>
                <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
                  <span className="flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-pink-500" />
                    <span>Saturation</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[var(--text-muted)]">
                      {settings.adjustments.saturation > 0 ? `+${settings.adjustments.saturation}` : settings.adjustments.saturation}
                    </span>
                    {settings.adjustments.saturation !== 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          commitSettingsToHistory({
                            ...settings,
                            adjustments: { ...settings.adjustments, saturation: 0 },
                          })
                        }
                        className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  min={-60}
                  max={60}
                  value={settings.adjustments.saturation}
                  onChange={(e) =>
                    updateSettings({
                      ...settings,
                      adjustments: {
                        ...settings.adjustments,
                        saturation: parseInt(e.target.value, 10),
                      },
                    })
                  }
                  onMouseUp={() => commitSettingsToHistory(settings)}
                  className="w-full h-1 bg-[var(--border)] rounded appearance-none cursor-pointer accent-[var(--text-primary)]"
                />
              </div>

              {/* Sharpness */}
              <div>
                <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
                  <span className="flex items-center gap-1.5">
                    <Focus className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Sharpness (Clarity)</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[var(--text-muted)]">
                      {settings.adjustments.sharpness}
                    </span>
                    {settings.adjustments.sharpness !== 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          commitSettingsToHistory({
                            ...settings,
                            adjustments: { ...settings.adjustments, sharpness: 0 },
                          })
                        }
                        className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={60}
                  value={settings.adjustments.sharpness}
                  onChange={(e) =>
                    updateSettings({
                      ...settings,
                      adjustments: {
                        ...settings.adjustments,
                        sharpness: parseInt(e.target.value, 10),
                      },
                    })
                  }
                  onMouseUp={() => commitSettingsToHistory(settings)}
                  className="w-full h-1 bg-[var(--border)] rounded appearance-none cursor-pointer accent-[var(--text-primary)]"
                />
              </div>

              {/* Blur */}
              <div>
                <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-purple-500" />
                    <span>Soft Blur</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[var(--text-muted)]">
                      {settings.adjustments.blur}px
                    </span>
                    {settings.adjustments.blur !== 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          commitSettingsToHistory({
                            ...settings,
                            adjustments: { ...settings.adjustments, blur: 0 },
                          })
                        }
                        className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={settings.adjustments.blur}
                  onChange={(e) =>
                    updateSettings({
                      ...settings,
                      adjustments: {
                        ...settings.adjustments,
                        blur: parseInt(e.target.value, 10),
                      },
                    })
                  }
                  onMouseUp={() => commitSettingsToHistory(settings)}
                  className="w-full h-1 bg-[var(--border)] rounded appearance-none cursor-pointer accent-[var(--text-primary)]"
                />
              </div>
            </div>
          )}

          {/* TAB 5: EXPORT & BATCH (Phase 8) */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              {/* Format selection */}
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-2">
                  Export Format
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['png', 'jpg', 'webp'] as const).map((fmt) => {
                    const isSelected = (settings.exportFormat || 'png') === fmt;
                    return (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() =>
                          commitSettingsToHistory({ ...settings, exportFormat: fmt })
                        }
                        className={`h-9 px-3 rounded-md text-xs font-medium border flex items-center justify-center uppercase transition-colors ${
                          isSelected
                            ? 'bg-[var(--text-primary)] text-[var(--btn-primary-text)] border-[var(--text-primary)] shadow-2xs'
                            : 'border-[var(--border)] bg-[var(--background)] hover:border-[var(--border-strong)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {fmt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Direct Actions: Download & Copy */}
              <div className="flex gap-2">
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

                <button
                  type="button"
                  onClick={handleCopy}
                  className="h-10 px-4 rounded-md border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--surface-hover)] text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  {isCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{isCopied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Batch Processing Options (Phase 8) */}
              <div className="pt-3 border-t border-[var(--border)] space-y-2">
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider block">
                  Batch Sync Options
                </label>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      onApplyBatchSettings?.('background', settings);
                      toast.success('Applied current background to all batch images');
                    }}
                    className="h-8 px-2 rounded-md border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium text-left truncate"
                  >
                    Sync Background
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onApplyBatchSettings?.('position', settings);
                      toast.success('Applied positioning & canvas to all batch images');
                    }}
                    className="h-8 px-2 rounded-md border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium text-left truncate"
                  >
                    Sync Positioning
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onApplyBatchSettings?.('shadow', settings);
                      toast.success('Applied shadows & effects to all batch images');
                    }}
                    className="h-8 px-2 rounded-md border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium text-left truncate"
                  >
                    Sync Shadow
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onApplyBatchSettings?.('adjustments', settings);
                      toast.success('Applied color adjustments to all batch images');
                    }}
                    className="h-8 px-2 rounded-md border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium text-left truncate"
                  >
                    Sync Adjustments
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onApplyBatchSettings?.('all', settings);
                    toast.success('Applied all styling & presets to all queue images');
                  }}
                  className="w-full h-8 px-3 rounded-md border border-[var(--border)] hover:border-[var(--border-strong)] bg-[var(--background)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors mt-2"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Apply all settings to all images</span>
                </button>
              </div>
            </div>
          )}

          {/* Persistent Quick Download Button at Bottom of Controls if not on export tab */}
          {activeTab !== 'export' && (
            <div className="pt-4 mt-auto border-t border-[var(--border)] flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={isExporting}
                className="flex-1 h-9 px-3 rounded-md bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:opacity-90 text-xs font-medium flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {isExporting
                    ? 'Exporting…'
                    : `Download ${(settings.exportFormat || 'png').toUpperCase()}`}
                </span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="h-9 px-3 rounded-md border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--surface-hover)] text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                {isCopied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{isCopied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
