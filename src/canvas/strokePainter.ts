import { widthAt } from '../strokes';
import type { Point, Stroke } from '../types';

const INK = '#16161d';

/** Canvas state is reset by every resize, so apply it before every paint. */
export function applyInk(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

const midpoint = (a: Point, b: Point): { x: number; y: number } => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, width: number): void {
  ctx.beginPath();
  ctx.arc(x, y, width / 2, 0, Math.PI * 2);
  ctx.fill();
}

/** Reference implementation: straight segments between raw samples (jagged). */
function paintPolyline(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
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

/** Quadratic Bezier through midpoints; pressure strokes get per-piece widths. */
function paintSmooth(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const pts = stroke.points;
  const first = pts[0];
  if (!first) return;
  const last = pts[pts.length - 1] ?? first;

  if (pts.length === 1) {
    drawDot(ctx, first.x, first.y, widthAt(stroke, first)); // a tap is a dot (decimal point)
    return;
  }

  if (first.pressure === undefined) {
    ctx.lineWidth = stroke.width;
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i];
      const next = pts[i + 1];
      if (!p || !next) continue;
      const m = midpoint(p, next);
      ctx.quadraticCurveTo(p.x, p.y, m.x, m.y);
    }
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    return;
  }

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

export const paintStroke = SMOOTHING ? paintSmooth : paintPolyline;