import { QueueItem, QueueItemStatus } from '@/types/image';
import { removeBackgroundLocally } from '../image-processing/remove-background';
import { getImageDimensions } from '../image-processing/resize';

export const MAX_BATCH_SIZE = 10;

export interface QueueState {
  items: QueueItem[];
  isProcessing: boolean;
  currentItemId: string | null;
  completedCount: number;
  totalCount: number;
}

export type QueueSubscriber = (state: QueueState) => void;

export class ImageQueueManager {
  private items: QueueItem[] = [];
  private isProcessing = false;
  private currentItemId: string | null = null;
  private subscribers: Set<QueueSubscriber> = new Set();
  private abortController: AbortController | null = null;
  private activeModelId = 'rmbg-1.4';

  public setModel(modelId: string) {
    this.activeModelId = modelId;
  }

  public getModel(): string {
    return this.activeModelId;
  }

  public subscribe(fn: QueueSubscriber): () => void {
    this.subscribers.add(fn);
    fn(this.getState());
    return () => {
      this.subscribers.delete(fn);
    };
  }

  private notify() {
    const state = this.getState();
    this.subscribers.forEach((fn) => fn(state));
  }

  public getState(): QueueState {
    const completedCount = this.items.filter((i) => i.status === 'completed').length;
    return {
      items: [...this.items],
      isProcessing: this.isProcessing,
      currentItemId: this.currentItemId,
      completedCount,
      totalCount: this.items.length,
    };
  }

  /**
   * Adds files to the queue. Validates max 10 images constraint.
   * Throws an error if adding the files would exceed 10 images.
   */
  public async addFiles(newFiles: File[]): Promise<void> {
    const currentCount = this.items.length;
    if (currentCount + newFiles.length > MAX_BATCH_SIZE) {
      throw new Error(
        `Maximum ${MAX_BATCH_SIZE} images per batch. Please select fewer images.`
      );
    }

    const newItems: QueueItem[] = [];

    for (const file of newFiles) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const originalUrl = URL.createObjectURL(file);

      const item: QueueItem = {
        id,
        file,
        name: file.name,
        size: file.size,
        originalUrl,
        status: 'waiting',
        progress: 0,
      };

      // Probe dimensions asynchronously
      getImageDimensions(file)
        .then(({ width, height }) => {
          item.originalWidth = width;
          item.originalHeight = height;
          this.notify();
        })
        .catch(() => {
          // Ignore error on dimension probe
        });

      newItems.push(item);
    }

    this.items = [...this.items, ...newItems];
    this.notify();
  }

  public removeItem(id: string): void {
    const item = this.items.find((i) => i.id === id);
    if (item) {
      // Memory cleanup: Revoke URLs
      try {
        if (item.originalUrl) URL.revokeObjectURL(item.originalUrl);
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
        if (item.maskUrl) URL.revokeObjectURL(item.maskUrl);
      } catch {
        // Ignore
      }
    }

    this.items = this.items.filter((i) => i.id !== id);
    this.notify();
  }

  public clear(): void {
    // Revoke all URLs
    for (const item of this.items) {
      try {
        if (item.originalUrl) URL.revokeObjectURL(item.originalUrl);
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
        if (item.maskUrl) URL.revokeObjectURL(item.maskUrl);
      } catch {
        // Ignore
      }
    }
    this.items = [];
    this.currentItemId = null;
    this.isProcessing = false;
    this.notify();
  }

  /**
   * Processes the queue sequentially to protect browser memory.
   * Ensures that a single failure doesn't halt the rest of the batch.
   */
  public async processQueue(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.abortController = new AbortController();
    this.notify();

    try {
      while (true) {
        if (this.abortController.signal.aborted) {
          break;
        }

        // Find next waiting item
        const nextItem = this.items.find((i) => i.status === 'waiting');
        if (!nextItem) {
          break;
        }

        this.currentItemId = nextItem.id;
        this.updateItem(nextItem.id, {
          status: 'processing',
          progress: 5,
          errorMessage: undefined,
        });

        try {
          // Remove background locally
          const output = await removeBackgroundLocally(nextItem.file, {
            modelId: this.activeModelId,
            defringe: true,
            refineEdges: true,
            onProgress: (percent) => {
              this.updateItem(nextItem.id, {
                progress: percent,
              });
            },
          });

          if (this.abortController.signal.aborted) {
            URL.revokeObjectURL(output.resultUrl);
            URL.revokeObjectURL(output.maskUrl);
            break;
          }

          this.updateItem(nextItem.id, {
            status: 'completed',
            progress: 100,
            resultBlob: output.resultBlob,
            resultUrl: output.resultUrl,
            maskBlob: output.maskBlob,
            maskUrl: output.maskUrl,
            durationMs: output.durationMs,
            originalWidth: output.width,
            originalHeight: output.height,
          });
        } catch (err: unknown) {
          console.error(`Failed to process ${nextItem.name}:`, err);
          const errorMsg =
            err instanceof Error ? err.message : 'Could not process this image.';

          this.updateItem(nextItem.id, {
            status: 'failed',
            progress: 0,
            errorMessage: `${errorMsg} Try JPG or PNG, a smaller image, or a different product photo.`,
          });
          // Continue to next item without breaking the batch
        }
      }
    } finally {
      this.isProcessing = false;
      this.currentItemId = null;
      this.notify();
    }
  }

  public retryItem(id: string): void {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;

    this.updateItem(id, {
      status: 'waiting',
      progress: 0,
      errorMessage: undefined,
    });

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  public cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.isProcessing = false;
    this.currentItemId = null;

    // Reset processing item to waiting
    this.items = this.items.map((item) =>
      item.status === 'processing' ? { ...item, status: 'waiting', progress: 0 } : item
    );
    this.notify();
  }

  private updateItem(id: string, partial: Partial<QueueItem>) {
    this.items = this.items.map((i) => (i.id === id ? { ...i, ...partial } : i));
    this.notify();
  }
}

// Global queue manager singleton for convenient application-wide state
export const imageQueue = new ImageQueueManager();
