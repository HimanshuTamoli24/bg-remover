'use client';

import React, { useState } from 'react';
import { QueueItem, EditorSettings } from '@/types/image';
import { Download, Archive, Loader2, Check } from 'lucide-react';
import { createZipArchive, renderFinalBlob, triggerBrowserDownload } from '@/lib/image-processing/export';
import { sanitizeFilename } from '@/lib/utils';
import { loadImageElement } from '@/lib/image-processing/resize';

interface DownloadButtonProps {
  items: QueueItem[];
  settings: EditorSettings;
  disabled?: boolean;
}

export function DownloadButton({ items, settings, disabled }: DownloadButtonProps) {
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);

  const completedItems = items.filter((i) => i.status === 'completed' && i.resultBlob);
  const count = completedItems.length;

  if (count === 0) return null;

  const handleDownloadAllZip = async () => {
    if (count === 0 || isZipping) return;

    setIsZipping(true);
    setZipProgress(5);

    try {
      const zipEntries: { filename: string; blob: Blob }[] = [];

      for (let i = 0; i < completedItems.length; i++) {
        const item = completedItems[i];
        let fileBlob = item.resultBlob!;

        // If custom styling (white, black, custom, padding, shadow) is active, render final styled canvas
        if (
          settings.backgroundType !== 'transparent' ||
          settings.padding > 0 ||
          settings.shadow
        ) {
          try {
            const img = await loadImageElement(item.resultUrl!);
            fileBlob = await renderFinalBlob(
              img,
              settings,
              item.originalWidth,
              item.originalHeight
            );
          } catch (renderErr) {
            console.warn(`Failed to apply styling to ${item.name}, using raw cutout:`, renderErr);
          }
        }

        const filename = sanitizeFilename(
          item.name,
          settings.backgroundType === 'transparent' ? '-transparent' : `-${settings.backgroundType}`
        );

        zipEntries.push({ filename, blob: fileBlob });
        setZipProgress(Math.round(((i + 1) / completedItems.length) * 50));
      }

      // Package in ZIP client-side
      const zipBlob = await createZipArchive(zipEntries, (percent) => {
        setZipProgress(50 + Math.round(percent * 0.5));
      });

      const zipFilename = `product-cutouts-${new Date().toISOString().slice(0, 10)}.zip`;
      triggerBrowserDownload(zipBlob, zipFilename);
    } catch (err) {
      console.error('Failed to create ZIP download:', err);
      alert('Failed to generate ZIP archive in browser. You can still download individual images.');
    } finally {
      setIsZipping(false);
      setZipProgress(0);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleDownloadAllZip}
        disabled={disabled || isZipping || count === 0}
        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:pointer-events-none"
      >
        {isZipping ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Zipping {zipProgress}%...</span>
          </>
        ) : (
          <>
            <Archive className="w-4 h-4" />
            <span>
              Download All as ZIP ({count} {count === 1 ? 'image' : 'images'})
            </span>
          </>
        )}
      </button>
    </div>
  );
}
