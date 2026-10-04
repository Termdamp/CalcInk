import type { Size } from '../types';

export interface ViewportInfo {
  readonly size: Size; // CSS px
  readonly dpr: number;
}

export interface Viewport {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** Canvas size in CSS pixels. */
  readonly size: Size;
  readonly dpr: number;
  /** Fires after the bitmap was resized/rescaled (which clears it, so redraw!). */
  onChange(listener: (info: ViewportInfo) => void): () => void;
  destroy(): void;
}

/** Dev-only override: open the page with ?dpr=1 to see what a missing HiDPI setup looks like. */
function getDpr(): number {
  if (import.meta.env.DEV) {
    const forced = Number(new URLSearchParams(location.search).get('dpr'));
    if (forced > 0) return forced;
  }
  return window.devicePixelRatio || 1;
}

/** Calls `onChange` once, now and each time the monitor's DPR changes. */
function watchDpr(onChange: () => void): () => void {
  let mql: MediaQueryList | null = null;
  const handler = (): void => {
    onChange();
    arm(); // a media query that matched 1.0 won't match 2.0, so re-arm for the new value
  };
  const arm = (): void => {
    mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mql.addEventListener('change', handler, { once: true });
  };
  arm();
  return () => mql?.removeEventListener('change', handler);
}

export function createViewport(canvas: HTMLCanvasElement): Viewport {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  let size: Size = { width: 0, height: 0 };
  let dpr = getDpr();
  const listeners = new Set<(info: ViewportInfo) => void>();

  const apply = (cssWidth: number, cssHeight: number): void => {
    dpr = getDpr();
    size = { width: cssWidth, height: cssHeight };
    const bitmapW = Math.max(1, Math.round(cssWidth * dpr));
    const bitmapH = Math.max(1, Math.round(cssHeight * dpr));
    // Assigning width/height ALWAYS clears the bitmap, even to the same value, so only when changed.
    if (canvas.width !== bitmapW) canvas.width = bitmapW;
    if (canvas.height !== bitmapH) canvas.height = bitmapH;
    // Resizing resets the context state, so set the transform every time (absolute, not cumulative).
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const listener of listeners) listener({ size, dpr });
  };

  const initial = canvas.getBoundingClientRect();
  apply(initial.width, initial.height);

  const observer = new ResizeObserver((entries) => {
    const entry = entries[entries.length - 1];
    if (!entry) return;
    const { width, height } = entry.contentRect;
    if (width === size.width && height === size.height) return;
    apply(width, height);
  });
  observer.observe(canvas);

  const stopWatchingDpr = watchDpr(() => apply(size.width, size.height));

  return {
    canvas,
    ctx,
    get size() {
      return size;
    },
    get dpr() {
      return dpr;
    },
    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    destroy() {
      observer.disconnect();
      stopWatchingDpr();
      listeners.clear();
    },
  };
}