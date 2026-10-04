'use client';

import React, { useState } from 'react';
import { QueueItem, EditorSettings } from '@/types/image';
import { Archive, Loader2 } from 'lucide-react';
import {
  createZipArchive,
  renderFinalBlob,
  triggerBrowserDownload,
} from '@/lib/image-processing/export';
import { sanitizeFilename } from '@/lib/utils';
import { loadImageElement } from '@/lib/image-processing/resize';
import { toast } from 'sonner';

interface DownloadButtonProps {
  items: QueueItem[];
  settings: EditorSettings;
  disabled?: boolean;
}

export function DownloadButton({ items, settings, disabled }: DownloadButtonProps) {
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);

  const completedItems = items.filter(
    (i) => i.status === 'completed' && (i.resultBlob || i.userEditedResultBlob)
  );
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
        const cutoutUrl = item.userEditedResultUrl || item.resultUrl!;
        let fileBlob = item.userEditedResultBlob || item.resultBlob!;

        try {
          const img = await loadImageElement(cutoutUrl);
          fileBlob = await renderFinalBlob(
            img,
            settings,
            item.originalWidth,
            item.originalHeight
          );
        } catch (renderErr) {
          console.warn(`Failed to apply full styling to ${item.name}:`, renderErr);
        }

        const ext = settings.exportFormat || 'png';
        const suffix =
          settings.backgroundType === 'transparent'
            ? '-cutout'
            : `-${settings.backgroundType}`;
        const filename = sanitizeFilename(item.name, `${suffix}.${ext}`);

        zipEntries.push({ filename, blob: fileBlob });
        setZipProgress(Math.round(((i + 1) / completedItems.length) * 50));
      }

      const zipBlob = await createZipArchive(zipEntries, (percent) => {
        setZipProgress(50 + Math.round(percent * 0.5));
      });

      const zipFilename = `cutouts-${new Date().toISOString().slice(0, 10)}.zip`;
      triggerBrowserDownload(zipBlob, zipFilename);
      toast.success(`Downloaded all ${count} images as ZIP archive`);
    } catch (err) {
      console.error('Failed to create ZIP download:', err);
      toast.error('Failed to generate ZIP archive in browser');
    } finally {
      setIsZipping(false);
      setZipProgress(0);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownloadAllZip}
      disabled={disabled || isZipping || count === 0}
      className="h-8 px-3 rounded-md border border-[var(--border)] hover:border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40"
    >
      {isZipping ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Zipping {zipProgress}%…</span>
        </>
      ) : (
        <>
          <Archive className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span>Download All ZIP ({count})</span>
        </>
      )}
    </button>
  );
}
