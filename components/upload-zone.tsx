'use client';

import React, { useState, useRef, DragEvent, ChangeEvent, ClipboardEvent } from 'react';
import { Upload, AlertCircle, Clipboard } from 'lucide-react';
import { MAX_BATCH_SIZE } from '@/lib/queue/image-queue';
import { isSupportedImageType } from '@/lib/image-processing/resize';

interface UploadZoneProps {
  currentCount: number;
  onFilesSelected: (files: File[]) => void;
  onPasteFromClipboard?: () => void;
  disabled?: boolean;
}

export function UploadZone({
  currentCount,
  onFilesSelected,
  onPasteFromClipboard,
  disabled,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remainingSlots = MAX_BATCH_SIZE - currentCount;

  const handleFiles = (incomingFiles: FileList | File[]) => {
    setErrorMessage(null);
    const fileArray = Array.from(incomingFiles);

    // Filter valid image types
    const validFiles = fileArray.filter(isSupportedImageType);

    if (validFiles.length === 0) {
      setErrorMessage(
        'Please select or drop valid image files (JPG, PNG, WEBP, JPEG, AVIF).'
      );
      return;
    }

    if (currentCount + validFiles.length > MAX_BATCH_SIZE) {
      setErrorMessage(
        `Maximum ${MAX_BATCH_SIZE} images per batch. ${remainingSlots} remaining.`
      );
      return;
    }

    onFilesSelected(validFiles);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && remainingSlots > 0) {
      setIsDragging(true);
    }
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || remainingSlots <= 0) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    if (disabled || remainingSlots <= 0) return;
    if (!e.clipboardData) return;

    const items = e.clipboardData.items;
    const pastedFiles: File[] = [];

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          const ext = file.type.split('/')[1] || 'png';
          const namedFile = new File([file], `clipboard-image-${Date.now()}.${ext}`, {
            type: file.type || 'image/png',
          });
          pastedFiles.push(namedFile);
        }
      }
    }

    if (pastedFiles.length > 0) {
      e.preventDefault();
      handleFiles(pastedFiles);
    }
  };

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  };

  const openPicker = () => {
    if (!disabled && remainingSlots > 0 && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="w-full" onPaste={onPaste} tabIndex={0}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.jpg,.jpeg,.png,.webp,.avif"
        onChange={onFileInputChange}
        className="hidden"
        disabled={disabled || remainingSlots <= 0}
      />

      {/* Full-width, high-touch drag-and-drop target */}
      <div
        onClick={openPicker}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        aria-label="Upload images by dropping files or clicking to browse"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
        className={`w-full h-[240px] sm:h-[280px] md:h-[300px] rounded-xl sm:rounded-2xl border border-dashed flex flex-col items-center justify-center p-6 text-center transition-all cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-[var(--text-primary)] ${
          disabled || remainingSlots <= 0
            ? 'opacity-50 cursor-not-allowed border-[var(--border)] bg-[var(--surface)]'
            : isDragging
            ? 'border-[var(--text-primary)] bg-[var(--surface-hover)]'
            : 'border-[var(--border-strong)] hover:border-[var(--text-primary)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]'
        }`}
      >
        {/* Monochrome Upload Icon */}
        <div className="w-10 h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] flex items-center justify-center mb-4 text-[var(--text-primary)] transition-transform">
          <Upload className="w-4 h-4 text-[var(--text-primary)]" />
        </div>

        {/* Primary label */}
        <h3 className="text-base sm:text-lg font-medium text-[var(--text-primary)] mb-1">
          {remainingSlots <= 0 ? 'Batch limit reached (10 images)' : 'Drop images here'}
        </h3>

        {/* Secondary label */}
        <p className="text-sm text-[var(--text-secondary)] mb-3">
          {remainingSlots <= 0
            ? 'Clear completed images to add more'
            : 'or click to browse from device'}
        </p>

        {/* Format metadata restrictions */}
        <div className="text-xs text-[var(--text-muted)] tracking-wider mb-4">
          JPG · PNG · WEBP · JPEG
        </div>

        {/* Clipboard helper button & shortcut */}
        {remainingSlots > 0 && !disabled && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPasteFromClipboard?.();
              }}
              className="px-3 py-1.5 rounded-md border border-[var(--border)] hover:border-[var(--border-strong)] bg-[var(--background)] hover:bg-[var(--surface)] text-[var(--text-primary)] text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Clipboard className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>Paste from clipboard</span>
              <kbd className="hidden sm:inline-block px-1 py-0.5 text-[10px] rounded bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)] font-mono ml-0.5">
                Ctrl+V
              </kbd>
            </button>
          </div>
        )}
      </div>

      {/* Error state: Monochrome border + text */}
      {errorMessage && (
        <div className="mt-3 p-3 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-primary)] text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] underline text-xs"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
