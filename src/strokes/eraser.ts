import type { Stroke } from '../types';
import {
  bboxesOverlap,
  boundsOf,
  circleBounds,
  distanceToSegmentSquared,
  type Vec,
} from './geometry';
import { maxHalfWidth } from './ink';

const distSq = (a: Vec, b: Vec): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/**
 * Positions to test between two eraser samples (excluding `from`, including `to`),
 * at most `spacing` apart, so a fast flick cannot tunnel through a thin stroke.
 */
export function sweepStamps(from: Vec, to: Vec, spacing: number): Vec[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / Math.max(spacing, 0.5)));
  const stamps: Vec[] = [];
  for (let i = 1; i <= steps; i++) {
    stamps.push({ x: from.x + (dx * i) / steps, y: from.y + (dy * i) / steps });
  }
  return stamps;
}

/** Does an eraser circle touch this stroke's ink? */
export function strokeHitsCircle(stroke: Stroke, center: Vec, radius: number): boolean {
  const first = stroke.points[0];
  if (!first) return false;
  if (!bboxesOverlap(boundsOf(stroke), circleBounds(center, radius))) return false; // cheap reject

  const reach = radius + maxHalfWidth(stroke);
  const reachSq = reach * reach;
  const pts = stroke.points;
  if (pts.length === 1) return distSq(first, center) <= reachSq;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (a && b && distanceToSegmentSquared(center, a, b) <= reachSq) return true;
  }
  return false;
}

/** Ids of every stroke touched by any stamp. */
export function findStrokesHit(
  strokes: readonly Stroke[],
  stamps: readonly Vec[],
  radius: number,
): string[] {
  const hit = new Set<string>();
  for (const stamp of stamps) {
    for (const stroke of strokes) {
      if (!hit.has(stroke.id) && strokeHitsCircle(stroke, stamp, radius)) hit.add(stroke.id);
    }
  }
  return [...hit];
}