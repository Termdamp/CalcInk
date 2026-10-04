import type { StrokeStore } from '../strokes';
import type { Point, Size, Stroke } from '../types';
import type { Viewport } from './viewport';

/** Drawn beneath the ink (debug patterns now; maybe a grid or ruled lines later). */
export type Underlay = (ctx: CanvasRenderingContext2D, size: Size) => void;

export interface Renderer {
  /** Schedule a redraw on the next animation frame (multiple calls coalesce). */
  requestRender(): void;
  /** Redraw synchronously (used on resize so there is no blank frame). */
  renderNow(): void;
  setUnderlay(underlay: Underlay | null): void;
  /** Called at the end of every render. Used by the latency probe. */
  onRendered(listener: () => void): () => void;
  destroy(): void;
}

const INK = '#16161d';

const midpoint = (a: Point, b: Point): { x: number; y: number } => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

/** Pen pressure 0.5 gives the stroke's nominal width; 0 gives 35%; 1 gives 165%. */
function widthAt(stroke: Stroke, p: Point): number {
  return p.pressure === undefined ? stroke.width : stroke.width * (0.35 + 1.3 * p.pressure);
}

function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, width: number): void {
  ctx.beginPath();
  ctx.arc(x, y, width / 2, 0, Math.PI * 2);
  ctx.fill();
}

/** Reference implementation: connect raw samples with straight segments (jagged). */
function drawStrokePolyline(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const pts = stroke.points;
  const first = pts[0];
  if (!first) return;
  if (pts.length === 1) {
    drawDot(ctx, first.x, first.y, stroke.width);
    return;
  }
  ctx.lineWidth = stroke.width;
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (p) ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}

/**
 * Quadratic Bezier through midpoints: each sample is a control point, and each curve ends at
 * the midpoint between two samples. Tangents match at the joins, so there are no corners.
 */
function drawStrokeSmooth(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const pts = stroke.points;
  const first = pts[0];
  if (!first) return;
  const last = pts[pts.length - 1] ?? first;

  if (pts.length === 1) {
    drawDot(ctx, first.x, first.y, widthAt(stroke, first)); // a tap is a dot (decimal point)
    return;
  }

  if (first.pressure === undefined) {
    // Uniform width: one path and one stroke() call. Fastest, and no seams.
    ctx.lineWidth = stroke.width;
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i];
      const next = pts[i + 1];
      if (!p || !next) continue;
      const m = midpoint(p, next);
      ctx.quadraticCurveTo(p.x, p.y, m.x, m.y); // control = sample, end = midpoint
    }
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    return;
  }

  // Pressure-sensitive: stroke each curve piece separately so each can have its own width.
  // Round line caps hide the seams between pieces.
  let from: { x: number; y: number } = first;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const next = pts[i + 1];
    if (!p || !next) continue;
    const m = midpoint(p, next);
    ctx.lineWidth = widthAt(stroke, p);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(p.x, p.y, m.x, m.y);
    ctx.stroke();
    from = m;
  }
  ctx.lineWidth = widthAt(stroke, last);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

/** Dev-only: open the page with ?smooth=0 to compare against raw lineTo. */
const SMOOTHING = !(
  import.meta.env.DEV && new URLSearchParams(location.search).get('smooth') === '0'
);
const drawStroke = SMOOTHING ? drawStrokeSmooth : drawStrokePolyline;

export function createRenderer(viewport: Viewport, store: StrokeStore): Renderer {
  let rafId = 0;
  let underlay: Underlay | null = null;
  const renderedListeners = new Set<() => void>();

  const renderNow = (): void => {
    if (rafId !== 0) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    const { ctx, size } = viewport;
    ctx.clearRect(0, 0, size.width, size.height);
    underlay?.(ctx, size);

    // Context state is reset by every canvas resize, so set it on every render.
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of store.strokes) drawStroke(ctx, stroke);
    if (store.activeStroke) drawStroke(ctx, store.activeStroke);

    for (const listener of renderedListeners) listener();
  };

  const requestRender = (): void => {
    if (rafId !== 0) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      renderNow();
    });
  };

  const stopStore = store.subscribe(requestRender);
  const stopViewport = viewport.onChange(renderNow); // resize clears the bitmap: redraw immediately

  return {
    requestRender,
    renderNow,
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
      stopStore();
      stopViewport();
      renderedListeners.clear();
    },
  };
}