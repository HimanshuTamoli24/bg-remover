"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/header";
import { UploadZone } from "@/components/upload-zone";
import { ProcessingProgress } from "@/components/processing-progress";
import { BeforeAfter } from "@/components/before-after";
import { ImageCarousel } from "@/components/image-carousel";
import { Editor } from "@/components/editor";
import { DownloadButton } from "@/components/download-button";
import { imageQueue, QueueState } from "@/lib/queue/image-queue";
import {
  EditorSettings,
  DEFAULT_EDITOR_SETTINGS,
  ModelProgressEvent,
} from "@/types/image";
import { getBackgroundRemover } from "@/lib/image-processing/model";
import { toast } from "sonner";
import { Square, Trash2 } from "lucide-react";

export default function Home() {
  const [queueState, setQueueState] = useState<QueueState>({
    items: [],
    isProcessing: false,
    currentItemId: null,
    completedCount: 0,
    totalCount: 0,
  });

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(
    DEFAULT_EDITOR_SETTINGS,
  );
  const [modelProgress, setModelProgress] = useState<ModelProgressEvent | null>(
    null,
  );
  const [activeModelId, setActiveModelId] = useState("rmbg-1.4");
  const [activeDevice, setActiveDevice] = useState<"webgpu" | "wasm" | "cpu">(
    "wasm",
  );
  const [isPreloadingModel, setIsPreloadingModel] = useState(false);

  // Ref to smoothly scroll to image workspace upon upload
  const workspaceSectionRef = useRef<HTMLDivElement>(null);

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
      console.error("Failed to initialize AI model:", err);
      toast.error("Failed to load AI model weights");
    } finally {
      setIsPreloadingModel(false);
    }
  }, [activeModelId]);

  // Add files to queue, toast, and scroll to preview workspace
  const handleFilesSelected = useCallback(async (files: File[]) => {
    try {
      await imageQueue.addFiles(files);
      toast.success(
        `Uploaded ${files.length} image${files.length > 1 ? "s" : ""}`,
      );

      // Smoothly scroll down to the preview workspace
      setTimeout(() => {
        workspaceSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 150);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Could not add images";
      toast.error(message);
    }
  }, []);

  // Dedicated button paste handler using modern Clipboard API
  const handlePasteFromClipboard = useCallback(async () => {
    if (typeof window === "undefined") return;

    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        toast.info("Press Ctrl+V (or ⌘V) directly on the page to paste");
        return;
      }

      const clipboardItems = await navigator.clipboard.read();
      const imageFiles: File[] = [];

      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const ext = imageType.split("/")[1] || "png";
          const file = new File(
            [blob],
            `clipboard-image-${Date.now()}.${ext}`,
            {
              type: imageType,
            },
          );
          imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        handleFilesSelected(imageFiles);
      } else {
        toast.info("No image found in clipboard. Copy an image first.");
      }
    } catch (err) {
      console.warn("Clipboard read permission or API error:", err);
      toast.info("Press Ctrl+V (or ⌘V) to paste the image directly");
    }
  }, [handleFilesSelected]);

  // Global window paste listener: Users can press Ctrl+V anywhere
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (
        document.activeElement instanceof HTMLInputElement &&
        document.activeElement.type === "text"
      ) {
        return;
      }

      if (!e.clipboardData) return;

      const items = e.clipboardData.items;
      const imageFiles: File[] = [];

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            const ext = file.type.split("/")[1] || "png";
            const namedFile = new File(
              [file],
              `pasted-image-${Date.now()}.${ext}`,
              {
                type: file.type || "image/png",
              },
            );
            imageFiles.push(namedFile);
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        handleFilesSelected(imageFiles);
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => {
      window.removeEventListener("paste", handleGlobalPaste);
    };
  }, [handleFilesSelected]);

  // Queue actions
  const handleStartProcessing = async () => {
    toast.info("Starting background removal…");
    await ensureModelReady();
    imageQueue.processQueue();
  };

  const handleCancelProcessing = () => {
    imageQueue.cancel();
    toast("Processing stopped");
  };

  const handleRemoveItem = (id: string) => {
    imageQueue.removeItem(id);
    toast("Image removed");
  };

  const handleClearAll = () => {
    imageQueue.clear();
    setSelectedItemId(null);
    toast("Queue cleared");
  };

  const selectedItem =
    queueState.items.find((i) => i.id === selectedItemId) ||
    queueState.items[0] ||
    null;

  // Handle manual eraser & pen brush modifications to the cutout
  const handleCutoutModified = useCallback(
    (blob: Blob, url: string) => {
      if (!selectedItem) return;
      imageQueue.updateItem(selectedItem.id, {
        userEditedResultBlob: blob,
        userEditedResultUrl: url,
      });
    },
    [selectedItem]
  );

  // Handle batch setting synchronization across images
  const handleApplyBatchSettings = useCallback(
    (
      type: "all" | "background" | "position" | "shadow" | "adjustments" | "canvas",
      newSettings: EditorSettings
    ) => {
      setEditorSettings((prev) => {
        switch (type) {
          case "background":
            return {
              ...prev,
              backgroundType: newSettings.backgroundType,
              customColor: newSettings.customColor,
              bgImageSettings: newSettings.bgImageSettings,
            };
          case "position":
            return {
              ...prev,
              positioning: newSettings.positioning,
              padding: newSettings.padding,
              transform: { ...newSettings.transform },
              aspectRatio: newSettings.aspectRatio,
            };
          case "shadow":
            return {
              ...prev,
              shadow: newSettings.shadow,
              shadowBlur: newSettings.shadowBlur,
              shadowOpacity: newSettings.shadowOpacity,
              shadowOffsetY: newSettings.shadowOffsetY,
              shadowSettings: { ...newSettings.shadowSettings },
              borderSettings: { ...newSettings.borderSettings },
            };
          case "adjustments":
            return {
              ...prev,
              adjustments: { ...newSettings.adjustments },
            };
          case "canvas":
            return {
              ...prev,
              aspectRatio: newSettings.aspectRatio,
              crop: newSettings.crop,
            };
          case "all":
          default:
            return { ...newSettings };
        }
      });
    },
    []
  );

  const waitingCount = queueState.items.filter(
    (i) => i.status === "waiting",
  ).length;
  const completedCount = queueState.items.filter(
    (i) => i.status === "completed",
  ).length;

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
            Clean product photos directly in your browser.{" "}
            <br className="hidden sm:inline" />
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

        {/* 5. Main Image Workspace & Carousel (Directly connects to preview, no redundant grid) */}
        {selectedItem && (
          <section
            ref={workspaceSectionRef}
            className="mt-10 pt-8 border-t border-[var(--border)] scroll-mt-16"
          >
            {/* Workspace Header Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-[var(--text-primary)]">
                  Preview & Export
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  {queueState.items.length}{" "}
                  {queueState.items.length === 1 ? "image" : "images"} in queue
                  {completedCount > 0 && ` · ${completedCount} ready`}
                  {waitingCount > 0 && ` · ${waitingCount} waiting`}
                </p>
              </div>

              {/* Action Buttons: Process / Stop / Download ZIP / Clear */}
              <div className="flex items-center gap-2">
                {queueState.isProcessing ? (
                  <button
                    onClick={handleCancelProcessing}
                    className="px-3 py-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Stop</span>
                  </button>
                ) : waitingCount > 0 ? (
                  <button
                    onClick={handleStartProcessing}
                    className="px-4 py-1.5 rounded-md bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:opacity-90 text-xs font-medium flex items-center gap-1.5 transition-opacity"
                  >
                    <span>
                      Process {waitingCount}{" "}
                      {waitingCount === 1 ? "image" : "images"}
                    </span>
                  </button>
                ) : null}

                {/* Batch ZIP Export Button */}
                <DownloadButton
                  items={queueState.items}
                  settings={editorSettings}
                  disabled={queueState.isProcessing}
                />

                {/* Clear Queue Button with subtle red on hover */}
                <button
                  onClick={handleClearAll}
                  disabled={queueState.isProcessing}
                  title="Clear all images"
                  aria-label="Clear all images"
                  className="px-2.5 py-1.5 rounded-md text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              </div>
            </div>

            {/* Before / After Split Workspace */}
            <BeforeAfter item={selectedItem} />

            {/* Bottom Image Carousel for quick thumbnail preview & switching */}
            <ImageCarousel
              items={queueState.items}
              selectedItem={selectedItem}
              onSelect={(item) => setSelectedItemId(item.id)}
              onRemove={handleRemoveItem}
              disabled={queueState.isProcessing}
            />

            {/* Controls (Background, Format, Positioning, Shadow, Export) */}
            {selectedItem.status === "completed" && (
              <Editor
                item={selectedItem}
                settings={editorSettings}
                onUpdateSettings={setEditorSettings}
                onApplyBatchSettings={handleApplyBatchSettings}
                onCutoutModified={handleCutoutModified}
              />
            )}
          </section>
        )}
      </main>

      {/* 6. Minimal Clean Footer */}
      <footer className="w-full border-t border-[var(--border)] py-6 text-center text-xs text-[var(--text-muted)] bg-[var(--background)]">
        <p>
          RemoveBG • Browser-based product background remover • 100% client-side
        </p>
      </footer>
    </div>
  );
}
