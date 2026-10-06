import type { Point, Stroke } from '../types';
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
const EPS = 1e-9;

function lerpPoint(a: Point, b: Point, u: number): Point {
  const point: Point = {
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
    t: a.t + (b.t - a.t) * u,
  };
  if (a.pressure !== undefined && b.pressure !== undefined) {
    point.pressure = a.pressure + (b.pressure - a.pressure) * u;
  }
  return point;
}

/** The parameter interval [u1, u2] ⊂ [0,1] where segment a→b is inside the disc, or null. */
function segmentInsideDisc(a: Point, b: Point, c: Vec, r: number): [number, number] | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const fx = a.x - c.x;
  const fy = a.y - c.y;
  const qa = dx * dx + dy * dy;
  const qc = fx * fx + fy * fy - r * r;
  if (qa === 0) return qc < 0 ? [0, 1] : null; // zero-length segment
  const qb = 2 * (fx * dx + fy * dy);
  const disc = qb * qb - 4 * qa * qc;
  if (disc <= 0) return null;
  const root = Math.sqrt(disc);
  const u1 = (-qb - root) / (2 * qa);
  const u2 = (-qb + root) / (2 * qa);
  if (u2 <= 0 || u1 >= 1) return null; // the disc is before or after this segment
  return [Math.max(0, u1), Math.min(1, u2)];
}

/**
 * Cuts the part of `stroke` inside the eraser disc out of it.
 * Returns null if the stroke is untouched, [] if it was erased completely,
 * otherwise the surviving pieces as new strokes.
 */
export function eraseCircleFromStroke(
  stroke: Stroke,
  center: Vec,
  radius: number,
  makeId: () => string,
): Stroke[] | null {
  const pts = stroke.points;
  const first = pts[0];
  if (!first) return null;
  if (!bboxesOverlap(boundsOf(stroke), circleBounds(center, radius))) return null;

  const reach = radius + maxHalfWidth(stroke);
  if (pts.length === 1) return distSq(first, center) < reach * reach ? [] : null;

  const runs: Point[][] = [];
  let current: Point[] = [];
  let touched = false;
  const flush = (): void => {
    if (current.length >= 2) runs.push(current);
    current = [];
  };

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (!a || !b) continue;
    const span = segmentInsideDisc(a, b, center, reach);
    const startsOutside = span === null || span[0] > EPS;
    if (startsOutside && current.length === 0) current.push(a);
    if (!span) {
      current.push(b); // the whole segment is outside
      continue;
    }
    touched = true;
    if (span[0] > EPS) current.push(lerpPoint(a, b, span[0])); // entry point closes the run
    flush();
    if (span[1] < 1 - EPS) current = [lerpPoint(a, b, span[1]), b]; // exit point opens a new run
  }
  flush();

  return touched ? runs.map((points) => ({ id: makeId(), width: stroke.width, points })) : null;
}

export interface EraseResult {
  /** Ids of document strokes that were cut or removed. */
  removeIds: string[];
  /** Surviving fragments to add in their place. */
  added: Stroke[];
}

/**
 * Net effect of dragging the pixel eraser through `stamps`. Pure: it does not touch the store.
 * Fragments created by earlier stamps are re-cut by later ones, so one call can erase a long path.
 */
export function computePixelErase(
  strokes: readonly Stroke[],
  stamps: readonly Vec[],
  radius: number,
  makeId: () => string,
): EraseResult {
  const removed = new Set<string>();
  let added: Stroke[] = [];

  for (const stamp of stamps) {
    const refined: Stroke[] = [];
    for (const fragment of added) {
      const pieces = eraseCircleFromStroke(fragment, stamp, radius, makeId);
      if (pieces) refined.push(...pieces);
      else refined.push(fragment);
    }
    added = refined;

    for (const stroke of strokes) {
      if (removed.has(stroke.id)) continue;
      const pieces = eraseCircleFromStroke(stroke, stamp, radius, makeId);
      if (pieces) {
        removed.add(stroke.id);
        added.push(...pieces);
      }
    }
  }
  return { removeIds: [...removed], added };
}