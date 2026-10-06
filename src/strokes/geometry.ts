import type { BBox, Stroke } from '../types';
import { maxHalfWidth } from './ink';

export interface Vec {
  x: number;
  y: number;
}

/**
 * Where on segment AB (as t in [0,1]) is the point nearest to p?
 * t* = (p−a)·(b−a) / |b−a|², clamped to [0,1]. A zero-length segment gives 0.
 */
export function projectOnSegment(p: Vec, a: Vec, b: Vec): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;
  if (lengthSq === 0) return 0;
  const t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSq;
  return Math.min(1, Math.max(0, t));
}

export function distanceToSegmentSquared(p: Vec, a: Vec, b: Vec): number {
  const t = projectOnSegment(p, a, b);
  const dx = p.x - (a.x + (b.x - a.x) * t);
  const dy = p.y - (a.y + (b.y - a.y) * t);
  return dx * dx + dy * dy;
}

export function distanceToSegment(p: Vec, a: Vec, b: Vec): number {
  return Math.sqrt(distanceToSegmentSquared(p, a, b));
}

export function bboxesOverlap(a: BBox, b: BBox): boolean {
  return (
    a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height
  );
}

export function circleBounds(center: Vec, radius: number): BBox {
  return { x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2 };
}

const boundsCache = new WeakMap<Stroke, BBox>();

/**
 * Bounding box of the stroke's ink (centerline bounds inflated by the largest half-width).
 * Cached per stroke object, but only for FROZEN strokes: a live stroke still changes.
 */
export function boundsOf(stroke: Stroke): BBox {
  const cached = boundsCache.get(stroke);
  if (cached) return cached;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of stroke.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const pad = maxHalfWidth(stroke);
  const box: BBox =
    stroke.points.length === 0
      ? { x: 0, y: 0, width: 0, height: 0 }
      : { x: minX - pad, y: minY - pad, width: maxX - minX + 2 * pad, height: maxY - minY + 2 * pad };

  if (Object.isFrozen(stroke)) boundsCache.set(stroke, box);
  return box;
}