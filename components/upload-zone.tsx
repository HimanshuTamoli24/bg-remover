'use client';

import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { UploadCloud, ShieldCheck, AlertCircle, Sparkles, Image as ImageIcon } from 'lucide-react';
import { MAX_BATCH_SIZE } from '@/lib/queue/image-queue';
import { isSupportedImageType } from '@/lib/image-processing/resize';

interface UploadZoneProps {
  currentCount: number;
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export function UploadZone({ currentCount, onFilesSelected, disabled }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remainingSlots = MAX_BATCH_SIZE - currentCount;

  const handleFiles = (incomingFiles: FileList | File[]) => {
    setErrorMessage(null);
    const fileArray = Array.from(incomingFiles);

    // Filter valid image types - support all major raster & vector image formats
    const validFiles = fileArray.filter(isSupportedImageType);

    if (validFiles.length === 0) {
      setErrorMessage('Please select valid image files (PNG, JPG, WEBP, AVIF, BMP, GIF, SVG, TIFF, etc.).');
      return;
    }

    // Hard requirement 5: Validate max 10 images
    if (currentCount + validFiles.length > MAX_BATCH_SIZE) {
      setErrorMessage(
        `Maximum ${MAX_BATCH_SIZE} images per batch. You have ${currentCount} loaded and tried to add ${validFiles.length}. Please select fewer images.`
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
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.jpg,.jpeg,.png,.webp,.avif,.bmp,.tiff,.tif,.gif,.svg,.ico,.heic,.heif"
        onChange={onFileInputChange}
        className="hidden"
        disabled={disabled || remainingSlots <= 0}
      />

      <div
        onClick={openPicker}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`relative group cursor-pointer transition-all duration-200 rounded-2xl border-2 border-dashed p-8 md:p-12 text-center flex flex-col items-center justify-center ${
          disabled || remainingSlots <= 0
            ? 'opacity-60 cursor-not-allowed border-zinc-800 bg-zinc-950/40'
            : isDragging
            ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
            : 'border-zinc-800 hover:border-zinc-600 bg-zinc-900/40 hover:bg-zinc-900/60'
        }`}
      >
        <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center mb-4 text-zinc-300 group-hover:text-indigo-400 group-hover:border-indigo-500/40 group-hover:scale-105 transition-all">
          <UploadCloud className="w-8 h-8" />
        </div>

        <h3 className="text-lg md:text-xl font-medium text-zinc-100 mb-2">
          {remainingSlots <= 0 ? 'Batch limit reached (10 images)' : 'Drop product images here'}
        </h3>

        <p className="text-sm text-zinc-400 mb-5">
          {remainingSlots <= 0 ? (
            'Process or clear existing images to add more'
          ) : (
            <>
              or <span className="text-indigo-400 font-medium underline underline-offset-4">click to browse</span> from your device
            </>
          )}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-zinc-400">
          <span className="px-2.5 py-1 rounded-full bg-zinc-800/80 border border-zinc-700/50">
            PNG • JPG • WEBP • AVIF • BMP • GIF • SVG • TIFF & more
          </span>
          <span className="px-2.5 py-1 rounded-full bg-zinc-800/80 border border-zinc-700/50">
            {remainingSlots} / {MAX_BATCH_SIZE} slots remaining
          </span>
          <span className="px-2.5 py-1 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            100% In-Browser AI
          </span>
        </div>
      </div>

      {/* Error message banner */}
      {errorMessage && (
        <div className="mt-4 p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-red-200 text-sm flex items-start gap-3 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-300">Selection Error</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-200 text-xs px-2 py-1 rounded border border-red-800/60"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Requirement 17: Prominent Privacy Guarantee */}
      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-zinc-400">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span>
          <strong>100% Client-Side Privacy:</strong> Your images are processed locally in your browser. They are never uploaded to a server.
        </span>
      </div>
    </div>
  );
}
