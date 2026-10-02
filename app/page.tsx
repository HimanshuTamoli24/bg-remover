'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from '@/components/header';
import { UploadZone } from '@/components/upload-zone';
import { ImageGrid } from '@/components/image-grid';
import { ProcessingProgress } from '@/components/processing-progress';
import { BeforeAfter } from '@/components/before-after';
import { ImageCarousel } from '@/components/image-carousel';
import { Editor } from '@/components/editor';
import { DownloadButton } from '@/components/download-button';
import {
  imageQueue,
  QueueState,
} from '@/lib/queue/image-queue';
import {
  EditorSettings,
  DEFAULT_EDITOR_SETTINGS,
  ModelProgressEvent,
} from '@/types/image';
import { getBackgroundRemover } from '@/lib/image-processing/model';
import { toast } from 'sonner';

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

  // Ref to smoothly scroll to image section upon upload
  const imageSectionRef = useRef<HTMLDivElement>(null);

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
    toast(`Switched AI model to ${newModelId}`);
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
      toast.error('Failed to load AI model weights');
    } finally {
      setIsPreloadingModel(false);
    }
  }, [activeModelId]);

  // Add files to queue, toast, and scroll to image section
  const handleFilesSelected = useCallback(async (files: File[]) => {
    try {
      await imageQueue.addFiles(files);
      toast.success(`Uploaded ${files.length} image${files.length > 1 ? 's' : ''}`);

      // Smoothly scroll down to the image section
      setTimeout(() => {
        imageSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 150);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not add images';
      toast.error(message);
    }
  }, []);

  // Dedicated button paste handler using modern Clipboard API
  const handlePasteFromClipboard = useCallback(async () => {
    if (typeof window === 'undefined') return;

    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        toast.info('Press Ctrl+V (or ⌘V) directly on the page to paste');
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
        toast.info('No image found in clipboard. Copy an image first.');
      }
    } catch (err) {
      console.warn('Clipboard read permission or API error:', err);
      toast.info('Press Ctrl+V (or ⌘V) to paste the image directly');
    }
  }, [handleFilesSelected]);

  // Global window paste listener: Users can press Ctrl+V anywhere
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Don't intercept if user is typing in a text input
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

  // Queue actions
  const handleStartProcessing = async () => {
    toast.info('Starting background removal…');
    await ensureModelReady();
    imageQueue.processQueue();
  };

  const handleCancelProcessing = () => {
    imageQueue.cancel();
    toast('Processing stopped');
  };

  const handleRemoveItem = (id: string) => {
    imageQueue.removeItem(id);
    toast('Image removed');
  };

  const handleRetryItem = (id: string) => {
    imageQueue.retryItem(id);
  };

  const handleClearAll = () => {
    imageQueue.clear();
    setSelectedItemId(null);
    toast('Queue cleared');
  };

  const selectedItem =
    queueState.items.find((i) => i.id === selectedItemId) || queueState.items[0] || null;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)] flex flex-col antialiased transition-colors">
      {/* 1. Minimal Header */}
      <Header
        activeModelId={activeModelId}
        onSelectModel={handleModelChange}
        disabled={queueState.isProcessing}
      />

      <main className="flex-1 w-full max-w-[1100px] mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-20 flex flex-col">
        {/* 2. Centered Hero Section (Directly on page background) */}
        <section className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-[var(--text-primary)] leading-[1.15]">
            Remove Product Backgrounds <br className="hidden sm:inline" />
            Directly in Your Browser
          </h1>

          <p className="mt-3.5 text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed max-w-lg mx-auto">
            Clean product photos directly in your browser. <br className="hidden sm:inline" />
            No server uploads. No accounts. Your images stay on your device.
          </p>
        </section>

        {/* 3. Upload Workspace */}
        <section className="w-full">
          <UploadZone
            currentCount={queueState.items.length}
            onFilesSelected={handleFilesSelected}
            onPasteFromClipboard={handlePasteFromClipboard}
            disabled={queueState.isProcessing}
          />
        </section>

        {/* 4. Processing Progress (Only shows when preparing model or processing) */}
        <ProcessingProgress
          items={queueState.items}
          isProcessing={queueState.isProcessing || isPreloadingModel}
          currentItemId={queueState.currentItemId}
          modelProgress={modelProgress}
          activeDevice={activeDevice}
        />

        {/* 5. Selected Images Section (with ref for smooth auto-scroll upon upload) */}
        <div ref={imageSectionRef} className="scroll-mt-20">
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
            settings={editorSettings}
          />
        </div>

        {/* 6. Image Workspace (Before / After Preview & Controls) */}
        {selectedItem && (
          <section className="mt-12 pt-8 border-t border-[var(--border)]">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-[var(--text-primary)]">
                  Preview & Export
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Inspect edges and adjust export styling
                </p>
              </div>

              {/* Batch ZIP Export */}
              <DownloadButton
                items={queueState.items}
                settings={editorSettings}
                disabled={queueState.isProcessing}
              />
            </div>

            {/* Before / After Split Workspace */}
            <BeforeAfter item={selectedItem} />

            {/* Bottom Image Carousel for quick thumbnail preview & switching */}
            <ImageCarousel
              items={queueState.items}
              selectedItem={selectedItem}
              onSelect={(item) => setSelectedItemId(item.id)}
            />

            {/* Controls (Background, Format, Positioning, Shadow, Export) */}
            {selectedItem.status === 'completed' && (
              <Editor
                item={selectedItem}
                settings={editorSettings}
                onUpdateSettings={setEditorSettings}
              />
            )}
          </section>
        )}
      </main>

      {/* 7. Minimal Clean Footer */}
      <footer className="w-full border-t border-[var(--border)] py-6 text-center text-xs text-[var(--text-muted)] bg-[var(--background)]">
        <p>
          RemoveBG • Browser-based product background remover • 100% client-side
        </p>
      </footer>
    </div>
  );
}
