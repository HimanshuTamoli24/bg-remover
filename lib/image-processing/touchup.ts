/**
 * Utility functions for manual eraser and pen (restore) brush touchups on product cutouts.
 */

export interface TouchupStrokeOptions {
  brushSize: number;
  mode: 'eraser' | 'pen';
}

/**
 * Erases a circular stroke path on the cutout canvas (destination-out)
 */
export function applyEraserStroke(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  brushSize: number
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = brushSize;

  ctx.beginPath();
  if (x1 === x2 && y1 === y2) {
    ctx.arc(x1, y1, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Restores original pixels from the original image element onto the cutout canvas
 */
export function applyRestoreStroke(
  ctx: CanvasRenderingContext2D,
  originalImage: HTMLImageElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  brushSize: number
): void {
  ctx.save();
  // Using original image pattern to paint back exact source pixels
  const pattern = ctx.createPattern(originalImage, 'no-repeat');
  if (pattern) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = pattern;
    ctx.fillStyle = pattern;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;

    ctx.beginPath();
    if (x1 === x2 && y1 === y2) {
      ctx.arc(x1, y1, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
  ctx.restore();
}
