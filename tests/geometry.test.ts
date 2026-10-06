import { describe, expect, it } from 'vitest';
import {
  bboxesOverlap,
  boundsOf,
  distanceToSegment,
  distanceToSegmentSquared,
  projectOnSegment,
} from '../src/strokes';
import { makeStroke } from './helpers';

const A = { x: 0, y: 0 };
const B = { x: 10, y: 0 };

describe('distanceToSegment', () => {
  it('is the perpendicular distance when the foot is inside the segment', () => {
    expect(distanceToSegment({ x: 5, y: 3 }, A, B)).toBe(3);
  });

  it('measures to endpoint A when the foot falls beyond A', () => {
    expect(distanceToSegment({ x: -4, y: 3 }, A, B)).toBe(5);
  });

  it('measures to endpoint B when the foot falls beyond B', () => {
    expect(distanceToSegment({ x: 14, y: 3 }, A, B)).toBe(5);
  });

  it('is 0 on the segment and at both endpoints', () => {
    expect(distanceToSegment({ x: 5, y: 0 }, A, B)).toBe(0);
    expect(distanceToSegment(A, A, B)).toBe(0);
    expect(distanceToSegment(B, A, B)).toBe(0);
  });

  it('handles a zero-length segment (no division by zero)', () => {
    const p = { x: 2, y: 2 };
    expect(distanceToSegment({ x: 5, y: 6 }, p, p)).toBe(5);
    expect(Number.isFinite(distanceToSegment({ x: 5, y: 6 }, p, p))).toBe(true);
  });

  it('works on diagonals and vertical segments', () => {
    expect(distanceToSegment({ x: 10, y: 10 }, A, { x: 10, y: 10 })).toBe(0);
    expect(distanceToSegment({ x: 0, y: 10 }, A, { x: 10, y: 10 })).toBeCloseTo(7.0711, 4);
    expect(distanceToSegment({ x: 3, y: 5 }, A, { x: 0, y: 10 })).toBe(3);
  });

  it('is symmetric in the segment direction', () => {
    const p = { x: 3, y: 7 };
    expect(distanceToSegment(p, A, B)).toBe(distanceToSegment(p, B, A));
  });

  it('squared variant agrees with the plain one', () => {
    expect(distanceToSegmentSquared({ x: 5, y: 3 }, A, B)).toBe(9);
  });
});

describe('projectOnSegment', () => {
  it('returns the clamped position along the segment', () => {
    expect(projectOnSegment({ x: 5, y: 3 }, A, B)).toBe(0.5);
    expect(projectOnSegment({ x: -4, y: 3 }, A, B)).toBe(0);
    expect(projectOnSegment({ x: 14, y: 3 }, A, B)).toBe(1);
  });
});

describe('bounds', () => {
  it('inflates the centerline bounds by half the stroke width', () => {
    const stroke = makeStroke('s', [[0, 0], [10, 5]], 4);
    expect(boundsOf(stroke)).toEqual({ x: -2, y: -2, width: 14, height: 9 });
  });

  it('caches only frozen strokes', () => {
    const stroke = makeStroke('s', [[0, 0], [10, 5]], 4);
    expect(boundsOf(stroke)).not.toBe(boundsOf(stroke));
    Object.freeze(stroke);
    expect(boundsOf(stroke)).toBe(boundsOf(stroke));
  });

  it('treats touching boxes as overlapping and separated boxes as not', () => {
    const box = { x: 0, y: 0, width: 10, height: 10 };
    expect(bboxesOverlap(box, { x: 10, y: 0, width: 5, height: 5 })).toBe(true);
    expect(bboxesOverlap(box, { x: 11, y: 0, width: 5, height: 5 })).toBe(false);
  });
});