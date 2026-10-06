import { describe, expect, it } from 'vitest';
import { findStrokesHit, strokeHitsCircle, sweepStamps } from '../src/strokes';
import { makeStroke } from './helpers';

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