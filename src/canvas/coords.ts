import type { Size } from '../types';

/** The subset of DOMRect we need, so this stays testable without a DOM. */
export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Convert window-relative client coordinates to canvas CSS-pixel coordinates.
 *
 * `rect` is the canvas's on-screen box; `cssSize` is its layout size. They differ only when an
 * ancestor applies a CSS transform. Devicepixelratio is deliberately NOT involved.
 * Results are not clamped: a captured pointer can legitimately leave the canvas.
 */
export function clientToCanvas(
  clientX: number,
  clientY: number,
  rect: RectLike,
  cssSize: Size,
): { x: number; y: number } {
  const scaleX = rect.width > 0 ? cssSize.width / rect.width : 1;
  const scaleY = rect.height > 0 ? cssSize.height / rect.height : 1;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}