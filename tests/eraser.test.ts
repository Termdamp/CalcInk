import { describe, expect, it } from 'vitest';
import { findStrokesHit, strokeHitsCircle, sweepStamps ,computePixelErase, eraseCircleFromStroke, createIdGenerator } from '../src/strokes';
import { makeStroke } from './helpers';
import type { Stroke } from '../src/types';

const line = makeStroke('line', [[0, 0], [100, 0]], 2); // half-width 1

describe('stroke eraser hit-testing', () => {
  it('counts the ink thickness: reach = radius + half width', () => {
    expect(strokeHitsCircle(line, { x: 50, y: 10 }, 8)).toBe(false); // 10 > 9
    expect(strokeHitsCircle(line, { x: 50, y: 10 }, 9.5)).toBe(true); // 10 ≤ 10.5
  });

  it('hits near the ends and misses beyond them', () => {
    expect(strokeHitsCircle(line, { x: 104, y: 0 }, 5)).toBe(true);
    expect(strokeHitsCircle(line, { x: 110, y: 0 }, 5)).toBe(false);
  });

  it('hits a single-point dot', () => {
    const dot = makeStroke('dot', [[20, 20]], 4);
    expect(strokeHitsCircle(dot, { x: 25, y: 20 }, 4)).toBe(true); // 5 ≤ 4 + 2
    expect(strokeHitsCircle(dot, { x: 40, y: 20 }, 4)).toBe(false);
  });

  it('rejects far-away strokes (bounding-box prefilter)', () => {
    expect(strokeHitsCircle(line, { x: 500, y: 500 }, 10)).toBe(false);
  });

  it('returns each hit id once, in a single call over many stamps', () => {
    const other = makeStroke('other', [[0, 50], [100, 50]], 2);
    const stamps = [{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }];
    expect(findStrokesHit([line, other], stamps, 5)).toEqual(['line']);
  });
});

describe('sweepStamps', () => {
  it('spaces stamps no further apart than requested and ends at the target', () => {
    const stamps = sweepStamps({ x: 0, y: 0 }, { x: 100, y: 0 }, 10);
    expect(stamps).toHaveLength(10);
    expect(stamps[stamps.length - 1]).toEqual({ x: 100, y: 0 });
  });

  it('gives exactly one stamp when the pointer did not move', () => {
    expect(sweepStamps({ x: 5, y: 5 }, { x: 5, y: 5 }, 10)).toEqual([{ x: 5, y: 5 }]);
  });

  it('prevents tunneling through a thin stroke on a fast flick', () => {
    const thin = makeStroke('thin', [[50, -50], [50, 50]], 1);
    const from = { x: 0, y: 0 };
    const to = { x: 100, y: 0 };
    expect(findStrokesHit([thin], [to], 5)).toEqual([]); // endpoint only: missed
    expect(findStrokesHit([thin], sweepStamps(from, to, 2.5), 5)).toEqual(['thin']);
  });
});
const ids = createIdGenerator();
const xs = (stroke: Stroke | undefined) => stroke?.points.map((p) => p.x) ?? [];

describe('pixel eraser (stroke splitting)', () => {
  it('splits a line into two fragments around the eraser', () => {
    // reach = 10 + half width 1 = 11 → the cut spans x = 39 … 61
    const pieces = eraseCircleFromStroke(line, { x: 50, y: 0 }, 10, ids);
    expect(pieces).toHaveLength(2);
    const [left, right] = xs(pieces?.[0]).concat([NaN], xs(pieces?.[1])).join().split('NaN,');
    expect(left).toBeDefined();
    expect(right).toBeDefined();
    expect(xs(pieces?.[0])[0]).toBeCloseTo(0, 6);
    expect(xs(pieces?.[0])[1]).toBeCloseTo(39, 6);
    expect(xs(pieces?.[1])[0]).toBeCloseTo(61, 6);
    expect(xs(pieces?.[1])[1]).toBeCloseTo(100, 6);
  });

  it('trims the end of a stroke without leaving a stray dot', () => {
    const pieces = eraseCircleFromStroke(line, { x: 0, y: 0 }, 10, ids);
    expect(pieces).toHaveLength(1);
    expect(xs(pieces?.[0])[0]).toBeCloseTo(11, 6);
    expect(xs(pieces?.[0])[1]).toBeCloseTo(100, 6);
  });

  it('returns [] when a stroke is erased completely', () => {
    const tiny = makeStroke('tiny', [[45, 0], [55, 0]], 2);
    expect(eraseCircleFromStroke(tiny, { x: 50, y: 0 }, 10, ids)).toEqual([]);
  });

  it('returns null for a miss, and erases a dot entirely or not at all', () => {
    expect(eraseCircleFromStroke(line, { x: 50, y: 30 }, 5, ids)).toBeNull();
    const dot = makeStroke('dot', [[20, 20]], 4);
    expect(eraseCircleFromStroke(dot, { x: 22, y: 20 }, 3, ids)).toEqual([]);
    expect(eraseCircleFromStroke(dot, { x: 60, y: 20 }, 3, ids)).toBeNull();
  });

  it('cuts around a corner into two separate pieces', () => {
    const corner = makeStroke('corner', [[0, 0], [50, 0], [50, 50]], 2);
    const pieces = eraseCircleFromStroke(corner, { x: 50, y: 0 }, 5, ids); // reach 6
    expect(pieces).toHaveLength(2);
    expect(pieces?.[0]?.points.at(-1)?.x).toBeCloseTo(44, 6);
    expect(pieces?.[1]?.points[0]?.y).toBeCloseTo(6, 6);
  });

  it('interpolates pressure and time at the cut points', () => {
    const pen: Stroke = {
      id: 'pen',
      width: 2,
      points: [
        { x: 0, y: 0, t: 0, pressure: 0 },
        { x: 100, y: 0, t: 100, pressure: 1 },
      ],
    };
    // reach = 10 + (2 × 1.65)/2 = 11.65 → entry u = 0.3835, exit u = 0.6165
    const pieces = eraseCircleFromStroke(pen, { x: 50, y: 0 }, 10, ids);
    expect(pieces?.[0]?.points.at(-1)?.pressure).toBeCloseTo(0.3835, 4);
    expect(pieces?.[0]?.points.at(-1)?.t).toBeCloseTo(38.35, 3);
    expect(pieces?.[1]?.points[0]?.pressure).toBeCloseTo(0.6165, 4);
  });

  it('re-cuts fragments when several stamps hit the same stroke', () => {
    const result = computePixelErase(
      [line],
      [{ x: 30, y: 0 }, { x: 70, y: 0 }],
      5,
      ids,
    ); // reach 6 → cuts at 24…36 and 64…76
    expect(result.removeIds).toEqual(['line']);
    expect(result.added).toHaveLength(3);
    expect(xs(result.added[0])[1]).toBeCloseTo(24, 6);
    expect(xs(result.added[1])[0]).toBeCloseTo(36, 6);
    expect(xs(result.added[1])[1]).toBeCloseTo(64, 6);
    expect(xs(result.added[2])[0]).toBeCloseTo(76, 6);
  });

  it('gives every fragment a unique id and leaves untouched strokes alone', () => {
    const far = makeStroke('far', [[0, 200], [100, 200]], 2);
    const result = computePixelErase([line, far], [{ x: 50, y: 0 }], 10, ids);
    expect(result.removeIds).toEqual(['line']);
    expect(new Set(result.added.map((s) => s.id)).size).toBe(result.added.length);
  });
});