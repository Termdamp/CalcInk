import type { Draft, StrokeStore } from '../strokes';
import type { Size, Stroke } from '../types';
import { applyInk, paintStroke } from './strokePainter';
import type { Viewport } from './viewport';

/** Drawn beneath the ink on the committed layer (debug patterns now; maybe ruled lines later). */
export type Underlay = (ctx: CanvasRenderingContext2D, size: Size) => void;

export interface RendererOptions {
  committed: Viewport;
  live: Viewport;
  store: StrokeStore;
  draft: Draft;
}

export interface Renderer {
  /** Mark everything dirty and repaint on the next animation frame. */
  requestRender(): void;
  /** Repaint everything synchronously. */
  renderNow(): void;
  setUnderlay(underlay: Underlay | null): void;
  /** Called after any frame in which something was painted. */
  onRendered(listener: () => void): () => void;
  destroy(): void;
}

export function createRenderer({ committed, live, store, draft }: RendererOptions): Renderer {
  let rafId = 0;
  let committedFull = true; // committed layer needs a complete repaint
  let pending: Stroke[] = []; // strokes appended since the last paint (incremental path)
  let liveDirty = true;
  let underlay: Underlay | null = null;
  const renderedListeners = new Set<() => void>();

  const paintCommitted = (): void => {
    const { ctx, size } = committed;
    applyInk(ctx);
    if (committedFull) {
      ctx.clearRect(0, 0, size.width, size.height);
      underlay?.(ctx, size);
      applyInk(ctx); // the underlay may have changed the context state
      for (const stroke of store.strokes) paintStroke(ctx, stroke);
    } else {
      for (const stroke of pending) paintStroke(ctx, stroke);
    }
    committedFull = false;
    pending = [];
  };

  const paintLive = (): void => {
    const { ctx, size } = live;
    ctx.clearRect(0, 0, size.width, size.height);
    applyInk(ctx);
    if (draft.current) paintStroke(ctx, draft.current);
    liveDirty = false;
  };

  const flush = (): void => {
    rafId = 0;
    let painted = false;
    if (committedFull || pending.length > 0) {
      paintCommitted();
      painted = true;
    }
    if (liveDirty) {
      paintLive();
      painted = true;
    }
    if (painted) for (const listener of renderedListeners) listener();
  };

  const schedule = (): void => {
    if (rafId === 0) rafId = requestAnimationFrame(flush);
  };

  const invalidateAll = (): void => {
    committedFull = true;
    pending = [];
    liveDirty = true;
  };

  const offStore = store.on('change', (change) => {
    if (change.append && !committedFull) {
      for (const stroke of change.added) pending.push(stroke);
    } else {
      committedFull = true;
      pending = [];
    }
    schedule();
  });

  const offDraft = draft.on('change', () => {
    liveDirty = true;
    schedule();
  });

  // A resize wipes the bitmap, so repaint synchronously: no blank frame is ever shown.
  const offCommitted = committed.onChange(() => {
    committedFull = true;
    pending = [];
    paintCommitted();
  });
  const offLive = live.onChange(() => {
    liveDirty = true;
    paintLive();
  });

  return {
    requestRender() {
      invalidateAll();
      schedule();
    },
    renderNow() {
      invalidateAll();
      if (rafId !== 0) cancelAnimationFrame(rafId);
      flush();
    },
    setUnderlay(next) {
      underlay = next;
    },
    onRendered(listener) {
      renderedListeners.add(listener);
      return () => {
        renderedListeners.delete(listener);
      };
    },
    destroy() {
      if (rafId !== 0) cancelAnimationFrame(rafId);
      offStore();
      offDraft();
      offCommitted();
      offLive();
      renderedListeners.clear();
    },
  };
}