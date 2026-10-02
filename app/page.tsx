'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/header';
import { UploadZone } from '@/components/upload-zone';
import { ImageGrid } from '@/components/image-grid';
import { ProcessingProgress } from '@/components/processing-progress';
import { BeforeAfter } from '@/components/before-after';
import { Editor } from '@/components/editor';
import { DownloadButton } from '@/components/download-button';
import {
  imageQueue,
  QueueState,
  MAX_BATCH_SIZE,
} from '@/lib/queue/image-queue';
import {
  QueueItem,
  EditorSettings,
  DEFAULT_EDITOR_SETTINGS,
  ModelProgressEvent,
} from '@/types/image';
import { SAMPLE_PRODUCTS } from '@/lib/sample-images';
import { getBackgroundRemover } from '@/lib/image-processing/model';
import {
  Sparkles,
  Layers,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Sliders,
  Image as ImageIcon,
} from 'lucide-react';

export default function Home() {
  const [queueState, setQueueState] = useState<QueueState>({
    items: [],
    isProcessing: false,
    currentItemId: null,
    completedCount: 0,
    totalCount: 0,
  });

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(DEFAULT_EDITOR_SETTINGS);
  const [modelProgress, setModelProgress] = useState<ModelProgressEvent | null>(null);
  const [activeModelId, setActiveModelId] = useState('rmbg-1.4');
  const [activeDevice, setActiveDevice] = useState<'webgpu' | 'wasm' | 'cpu'>('wasm');
  const [isPreloadingModel, setIsPreloadingModel] = useState(false);
  const [sampleLoading, setSampleLoading] = useState<string | null>(null);

  // Subscribe to ImageQueue state updates
  useEffect(() => {
    const unsubscribe = imageQueue.subscribe((state) => {
      setQueueState(state);

      // If selected item was deleted, clear or pick first item
      if (selectedItemId && !state.items.some((i) => i.id === selectedItemId)) {
        const nextSelected = state.items[0]?.id || null;
        setSelectedItemId(nextSelected);
      } else if (!selectedItemId && state.items.length > 0) {
        setSelectedItemId(state.items[0].id);
      }
    });

    return () => unsubscribe();
  }, [selectedItemId]);

  // Handle Model Change
  const handleModelChange = (newModelId: string) => {
    setActiveModelId(newModelId);
    imageQueue.setModel(newModelId);
  };

  // Pre-initialize model with progress callback
  const ensureModelReady = useCallback(async () => {
    try {
      const remover = getBackgroundRemover(activeModelId);
      setActiveDevice(remover.device);
      if (!remover.isInitialized()) {
        setIsPreloadingModel(true);
        await remover.initialize((progress) => {
          setModelProgress(progress);
        });
        setActiveDevice(remover.device);
      }
    } catch (err) {
      console.error('Failed to initialize AI model:', err);
    } finally {
      setIsPreloadingModel(false);
    }
  }, [activeModelId]);

  // Add files to queue
  const handleFilesSelected = useCallback(async (files: File[]) => {
    try {
      await imageQueue.addFiles(files);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Could not add images');
    }
  }, []);

  // Dedicated button paste handler using modern Clipboard API
  const handlePasteFromClipboard = useCallback(async () => {
    if (typeof window === 'undefined') return;

    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        alert('Please press Ctrl+V (or ⌘V) directly on the page to paste your copied image.');
        return;
      }

      const clipboardItems = await navigator.clipboard.read();
      const imageFiles: File[] = [];

      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const ext = imageType.split('/')[1] || 'png';
          const file = new File([blob], `clipboard-image-${Date.now()}.${ext}`, {
            type: imageType,
          });
          imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        handleFilesSelected(imageFiles);
      } else {
        alert('No image found in your clipboard. Please copy an image (or take a screenshot) and try again!');
      }
    } catch (err) {
      console.warn('Clipboard read permission or API error:', err);
      alert('Could not access clipboard directly. Please press Ctrl + V (or ⌘V) to paste the image directly.');
    }
  }, [handleFilesSelected]);

  // Global window paste listener: Users can press Ctrl+V anywhere
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Don't intercept if user is typing in a text/color input
      if (
        document.activeElement instanceof HTMLInputElement &&
        document.activeElement.type === 'text'
      ) {
        return;
      }

      if (!e.clipboardData) return;

      const items = e.clipboardData.items;
      const imageFiles: File[] = [];

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            const ext = file.type.split('/')[1] || 'png';
            const namedFile = new File([file], `pasted-image-${Date.now()}.${ext}`, {
              type: file.type || 'image/png',
            });
            imageFiles.push(namedFile);
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        handleFilesSelected(imageFiles);
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [handleFilesSelected]);

  // Load sample product
  const handleLoadSample = async (sampleId: string) => {
    const sample = SAMPLE_PRODUCTS.find((s) => s.id === sampleId);
    if (!sample) return;

    if (queueState.items.length >= MAX_BATCH_SIZE) {
      alert(`Maximum ${MAX_BATCH_SIZE} images per batch reached.`);
      return;
    }

    setSampleLoading(sampleId);
    try {
      const file = await sample.generate();
      await imageQueue.addFiles([file]);
    } catch (err) {
      console.error('Failed to load sample image:', err);
    } finally {
      setSampleLoading(null);
    }
  };

  // Start batch processing
  const handleStartProcessing = async () => {
    await ensureModelReady();
    imageQueue.processQueue();
  };

  const handleCancelProcessing = () => {
    imageQueue.cancel();
  };

  const handleRemoveItem = (id: string) => {
    imageQueue.removeItem(id);
  };

  const handleRetryItem = (id: string) => {
    imageQueue.retryItem(id);
  };

  const handleClearAll = () => {
    imageQueue.clear();
    setSelectedItemId(null);
  };

  const selectedItem =
    queueState.items.find((i) => i.id === selectedItemId) || queueState.items[0] || null;

  const completedItems = queueState.items.filter((i) => i.status === 'completed');

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col antialiased">
      {/* Top Header */}
      <Header
        activeModelId={activeModelId}
        onSelectModel={handleModelChange}
        disabled={queueState.isProcessing}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 md:py-12">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>High-Accuracy E-Commerce Segmentation</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-3">
            Remove Product Backgrounds <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-300 to-indigo-200">
              Directly in Your Browser
            </span>
          </h1>

          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
            Clean, professional product photos for your store. <br className="hidden sm:inline" />
            <strong className="text-zinc-200">No server uploads. No accounts. 100% client-side privacy.</strong>
          </p>
        </div>

        {/* Upload Area */}
        <div className="max-w-3xl mx-auto">
          <UploadZone
            currentCount={queueState.items.length}
            onFilesSelected={handleFilesSelected}
            onPasteFromClipboard={handlePasteFromClipboard}
            disabled={queueState.isProcessing}
          />

          {/* Sample Product Cards for Instant 1-Click Testing */}
          {queueState.items.length < MAX_BATCH_SIZE && (
            <div className="mt-6 pt-6 border-t border-zinc-900 text-center">
              <p className="text-xs text-zinc-400 mb-3 font-medium">
                Don&apos;t have a product photo on hand? Try an instant e-commerce sample:
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                {SAMPLE_PRODUCTS.map((sample) => (
                  <button
                    key={sample.id}
                    onClick={() => handleLoadSample(sample.id)}
                    disabled={sampleLoading === sample.id}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-300 flex items-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50"
                  >
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span>{sample.type}</span>
                    <span className="text-[10px] text-zinc-400">({sample.category})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* First-load Model Loading Progress Banner & Batch Queue Progress */}
        <div className="max-w-4xl mx-auto">
          <ProcessingProgress
            items={queueState.items}
            isProcessing={queueState.isProcessing || isPreloadingModel}
            currentItemId={queueState.currentItemId}
            modelProgress={modelProgress}
            activeDevice={activeDevice}
          />
        </div>

        {/* Queue Items Grid */}
        <ImageGrid
          items={queueState.items}
          selectedItem={selectedItem}
          onSelect={(item) => setSelectedItemId(item.id)}
          onRemove={handleRemoveItem}
          onRetry={handleRetryItem}
          onClear={handleClearAll}
          onProcess={handleStartProcessing}
          onCancel={handleCancelProcessing}
          isProcessing={queueState.isProcessing}
        />

        {/* Selected Item Inspection & Editor */}
        {selectedItem && (
          <div className="mt-10 pt-8 border-t border-zinc-800/80">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-400" />
                  Inspect & Refine Cutout
                </h2>
                <p className="text-xs text-zinc-400">
                  Inspect edges, compare against original photo, and apply custom e-commerce styling
                </p>
              </div>

              {/* Batch ZIP Export */}
              <DownloadButton
                items={queueState.items}
                settings={editorSettings}
                disabled={queueState.isProcessing}
              />
            </div>

            {/* Before / After Viewer */}
            <BeforeAfter item={selectedItem} />

            {/* Styling Toolbar (Background, Positioning, Padding, Realistic Shadow) */}
            {selectedItem.status === 'completed' && (
              <Editor
                item={selectedItem}
                settings={editorSettings}
                onUpdateSettings={setEditorSettings}
              />
            )}
          </div>
        )}

        {/* Feature Highlights Footer */}
        <div className="mt-16 pt-10 border-t border-zinc-900 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-zinc-400">
          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
            <div className="flex items-center gap-2 text-zinc-200 font-semibold mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Client-Side Only
            </div>
            <p className="leading-relaxed">
              Your images never leave your computer. Model inference executes directly in your browser via WebGPU/WebAssembly.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
            <div className="flex items-center gap-2 text-zinc-200 font-semibold mb-1">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Original Resolution Preserved
            </div>
            <p className="leading-relaxed">
              The AI segmentation mask is mapped back to the 100% original full-resolution image with sub-pixel edge defringing.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
            <div className="flex items-center gap-2 text-zinc-200 font-semibold mb-1">
              <CheckCircle2 className="w-4 h-4 text-teal-400" />
              Batch Processing & ZIP
            </div>
            <p className="leading-relaxed">
              Queue up to 10 product photos at once. Download individual transparent PNGs or batch export everything as a ZIP.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-zinc-900 bg-zinc-950 py-6 text-center text-xs text-zinc-400">
        <p>
          CutoutStudio • Browser-Based E-Commerce Background Remover • Built with Next.js & Transformers.js
        </p>
      </footer>
    </div>
  );
}
